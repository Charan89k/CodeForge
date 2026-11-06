import type { InstitutionRole } from "@/generated/prisma/enums";

export type CampusPortal = "student" | "teacher";

const PORTAL_ROLES: Record<CampusPortal, readonly InstitutionRole[]> = {
  student: ["STUDENT"],
  teacher: ["FACULTY", "INSTITUTION_ADMIN", "PLACEMENT_OFFICER"],
};

export type PortalDecision =
  | { kind: "go"; path: string }
  /** Signed in, but holding no membership of the kind this portal serves. */
  | { kind: "refuse"; hasOtherMembership: boolean };

/**
 * Where a sign-in through a Campus portal leads.
 *
 * The URL only names the door. What opens it is the memberships read from the
 * database, so changing `student` to `teacher` in the address gets a refusal,
 * never a role.
 */
export function decidePortal(
  portal: CampusPortal,
  memberships: readonly { role: InstitutionRole; institution: { slug: string } }[],
  platformAdmin: boolean
): PortalDecision {
  const matching = memberships.filter((m) => PORTAL_ROLES[portal].includes(m.role));
  if (matching.length === 1)
    return { kind: "go", path: `/campus/${matching[0]!.institution.slug}` };
  if (matching.length > 1 || platformAdmin) return { kind: "go", path: "/campus" };
  return { kind: "refuse", hasOtherMembership: memberships.length > 0 };
}

export function isCampusPortal(value: string): value is CampusPortal {
  return value === "student" || value === "teacher";
}
