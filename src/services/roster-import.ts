import "server-only";

import { z } from "zod";

import type { InstitutionRole } from "@/generated/prisma/enums";
import { parseCsv } from "@/lib/csv";
import {
  assertCan,
  InstitutionError,
  scopeOf,
  type MemberContext,
} from "@/lib/tenancy/context";
import { canInviteRole } from "@/lib/tenancy/permissions";
import { withTenantScope } from "@/lib/tenancy/scope";

import { addClassMember, teaches } from "./campus-classes";
import { inviteMember, normaliseEmail, writeAudit } from "./institutions";

/**
 * Roster import: a CSV of `email`, optional `role`, optional `class`.
 *
 * Two steps, both from the same text: `previewRoster` validates every row
 * and says what would happen; `applyRoster` validates again from scratch
 * (the preview is never trusted) and does it. Safe to retry: an address
 * already a member or already invited is skipped, so running the same file
 * twice sends nothing new.
 *
 * Per row:
 *   - invite  a new address: an invitation is emailed
 *   - enrol   an existing active member with a class: added to that class
 *   - skip    already a member (no class) or already invited
 *   - error   the row is wrong and nothing happens for it
 * Suspended and revoked members are errors, not re-invites: bringing them
 * back is a decision for the roster page, not a side effect of a file.
 */

export const ROSTER_LIMITS = { maxBytes: 100_000, maxRows: 200 } as const;

const ROLES: InstitutionRole[] = [
  "STUDENT",
  "FACULTY",
  "INSTITUTION_ADMIN",
  "PLACEMENT_OFFICER",
];

export type RosterRow = {
  line: number;
  email: string;
  role: InstitutionRole | null;
  className: string | null;
  action: "invite" | "enrol" | "skip" | "error";
  message: string;
};

export type RosterPreview = {
  rows: RosterRow[];
  counts: Record<RosterRow["action"], number>;
};

function countActions(rows: RosterRow[]): RosterPreview["counts"] {
  const counts = { invite: 0, enrol: 0, skip: 0, error: 0 };
  for (const r of rows) counts[r.action] += 1;
  return counts;
}

/** Throws for a file-level problem; per-row problems become error rows. */
function readFile(text: string): { line: number; cells: Record<string, string> }[] {
  if (new TextEncoder().encode(text).length > ROSTER_LIMITS.maxBytes) {
    throw new InstitutionError("invalid", "The file is larger than 100 KB.");
  }
  let table: string[][];
  try {
    table = parseCsv(text);
  } catch {
    throw new InstitutionError("invalid", "The file is not valid CSV.");
  }
  const [header, ...body] = table;
  const columns = (header ?? []).map((h) => h.trim().toLowerCase());
  if (!columns.includes("email")) {
    throw new InstitutionError("invalid", "The first row must name an email column.");
  }
  if (columns.some((c) => !["email", "role", "class"].includes(c))) {
    throw new InstitutionError(
      "invalid",
      "Only email, role and class columns are allowed."
    );
  }
  if (body.length > ROSTER_LIMITS.maxRows) {
    throw new InstitutionError("invalid", "At most 200 rows per file.");
  }
  return body.map((cells, i) => ({
    line: i + 2,
    cells: Object.fromEntries(columns.map((c, j) => [c, (cells[j] ?? "").trim()])),
  }));
}

export async function previewRoster(
  ctx: MemberContext,
  text: string
): Promise<RosterPreview> {
  assertCan(ctx, "members.invite");
  const file = readFile(text);

  return withTenantScope(scopeOf(ctx), async (tx) => {
    const emails = file.map((r) => normaliseEmail(r.cells.email ?? ""));
    const members = await tx.institutionMembership.findMany({
      where: { institutionId: ctx.institution.id, user: { email: { in: emails } } },
      select: { status: true, role: true, user: { select: { email: true } } },
    });
    const invitations = await tx.institutionInvitation.findMany({
      where: {
        institutionId: ctx.institution.id,
        email: { in: emails },
        acceptedAt: null,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: { email: true, role: true },
    });
    const classes = await tx.cohort.findMany({
      where: { institutionId: ctx.institution.id, archivedAt: null },
      select: { id: true, name: true },
    });
    const teachable = new Set<string>();
    for (const c of classes) if (await teaches(tx, c.id)) teachable.add(c.id);

    const seen = new Map<string, number>();
    const rows: RosterRow[] = file.map(({ line, cells }) => {
      const email = normaliseEmail(cells.email ?? "");
      const rawRole = (cells.role ?? "").toUpperCase().replaceAll(" ", "_");
      const role = (rawRole ? rawRole : "STUDENT") as InstitutionRole;
      const className = cells.class ? cells.class : null;
      const row = (action: RosterRow["action"], message: string): RosterRow => ({
        line,
        email,
        role: ROLES.includes(role) ? role : null,
        className,
        action,
        message,
      });

      if (!z.string().email().max(254).safeParse(email).success) {
        return row("error", "Not a valid email address.");
      }
      if (seen.has(email)) return row("error", `Duplicate of line ${seen.get(email)}.`);
      seen.set(email, line);
      if (!ROLES.includes(role)) {
        return row(
          "error",
          "Role must be STUDENT, FACULTY, INSTITUTION_ADMIN or PLACEMENT_OFFICER."
        );
      }
      if (!canInviteRole(ctx, role)) return row("error", "You cannot grant that role.");

      const cls = className
        ? classes.find((c) => c.name.toLowerCase() === className.toLowerCase())
        : null;
      if (className && !cls) return row("error", `No class named "${className}".`);
      if (cls && !teachable.has(cls.id)) {
        return row("error", `You do not manage the class "${cls.name}".`);
      }

      const member = members.find((m) => m.user.email === email);
      if (member && member.status !== "ACTIVE") {
        return row(
          "error",
          `This membership is ${member.status.toLowerCase()}. Reactivate it from the roster instead.`
        );
      }
      if (member) {
        if (!cls) return row("skip", "Already a member.");
        if (role !== "STUDENT" && member.role === "STUDENT") {
          return row("error", "A student member cannot be added as an instructor.");
        }
        return row("enrol", `Already a member; will be added to ${cls.name}.`);
      }
      if (invitations.some((inv) => inv.email === email && inv.role === role)) {
        return row("skip", "Already invited with this role.");
      }
      return row(
        "invite",
        cls
          ? `Will be invited. Add them to ${cls.name} after they accept.`
          : "Will be invited."
      );
    });
    return { rows, counts: countActions(rows) };
  });
}

/** Re-validates from the text, then invites and enrols row by row. */
export async function applyRoster(
  ctx: MemberContext,
  text: string
): Promise<RosterPreview> {
  const preview = await previewRoster(ctx, text);
  const rows: RosterRow[] = [];

  for (const r of preview.rows) {
    if (r.action !== "invite" && r.action !== "enrol") {
      rows.push(r);
      continue;
    }
    try {
      if (r.action === "invite") {
        const { emailStatus } = await inviteMember(
          ctx,
          { email: r.email, role: r.role! },
          { bulk: true }
        );
        rows.push({
          ...r,
          message:
            emailStatus === "accepted"
              ? "Invited."
              : "Invited, but the email was not delivered. Invite again to resend.",
        });
      } else {
        const cohort = await withTenantScope(scopeOf(ctx), (tx) =>
          tx.cohort.findFirst({
            where: {
              institutionId: ctx.institution.id,
              archivedAt: null,
              name: { equals: r.className!, mode: "insensitive" },
            },
            select: { id: true },
          })
        );
        if (!cohort) throw new InstitutionError("not_found", "Class not found.");
        await addClassMember(ctx, cohort.id, {
          email: r.email,
          role: r.role === "STUDENT" ? "STUDENT" : "INSTRUCTOR",
        });
        rows.push({ ...r, message: "Added to the class." });
      }
    } catch (error) {
      if (!(error instanceof InstitutionError)) throw error;
      rows.push({ ...r, action: "error", message: error.message });
    }
  }

  const counts = countActions(rows);
  await withTenantScope(scopeOf(ctx), (tx) =>
    writeAudit(tx, ctx.institution.id, ctx.user, {
      action: "members.imported",
      targetType: "institution",
      targetId: ctx.institution.id,
      summary: `Roster import: ${counts.invite} invited, ${counts.enrol} enrolled, ${counts.skip} skipped, ${counts.error} errors`,
      metadata: counts,
    })
  );
  return { rows, counts };
}
