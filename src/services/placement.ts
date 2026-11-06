import "server-only";

import { z } from "zod";

import { Prisma } from "@/generated/prisma/client";
import {
  canOfficeMove,
  canWithdraw,
  evaluateEligibility,
  median,
  type EligibilityCriteria,
  type EligibilityResult,
  type PlacementStage,
  type StudentRecord,
} from "@/lib/placement/eligibility";
import {
  assertCan,
  InstitutionError,
  scopeOf,
  type MemberContext,
} from "@/lib/tenancy/context";
import { withTenantScope, type TenantTx } from "@/lib/tenancy/scope";

import { csvCell, normaliseEmail, writeAudit } from "./institutions";

/**
 * The placement cell. Every query runs under the tenant role, so row-level
 * security bounds it even if a check here were wrong. Eligibility is computed on
 * the server when a student applies and stored with the application.
 */
const num = (value: Prisma.Decimal | null): number | null =>
  value === null ? null : Number(value);

const toRecord = (row: {
  department: string;
  batchYear: number;
  cgpa: Prisma.Decimal;
  backlogs: number;
  attendancePercent: number | null;
  skills: string[];
}): StudentRecord => ({
  department: row.department,
  batchYear: row.batchYear,
  cgpa: Number(row.cgpa),
  backlogs: row.backlogs,
  attendancePercent: row.attendancePercent,
  skills: row.skills,
});

const toCriteria = (drive: {
  minCgpa: Prisma.Decimal | null;
  maxBacklogs: number | null;
  minAttendance: number | null;
  departments: string[];
  batchYears: number[];
  requiredSkills: string[];
  excludePlaced: boolean;
}): EligibilityCriteria => ({
  minCgpa: num(drive.minCgpa),
  maxBacklogs: drive.maxBacklogs,
  minAttendance: drive.minAttendance,
  departments: drive.departments,
  batchYears: drive.batchYears,
  requiredSkills: drive.requiredSkills,
  excludePlaced: drive.excludePlaced,
});

// --- Student records --------------------------------------------------------

export const recordSchema = z.object({
  department: z.string().trim().min(1).max(60),
  batchYear: z.number().int().min(2000).max(2100),
  cgpa: z.number().min(0).max(10),
  backlogs: z.number().int().min(0).max(100),
  attendancePercent: z.number().int().min(0).max(100).nullable(),
  skills: z.array(z.string().trim().min(1).max(60)).max(50),
});
export type RecordInput = z.infer<typeof recordSchema>;

export async function listPlacementStudents(ctx: MemberContext) {
  assertCan(ctx, "placement.manage");
  return withTenantScope(scopeOf(ctx), async (tx) => {
    const [members, records] = await Promise.all([
      tx.institutionMembership.findMany({
        where: { institutionId: ctx.institution.id, role: "STUDENT", status: "ACTIVE" },
        orderBy: { createdAt: "asc" },
        take: 1000,
        select: { userId: true, user: { select: { name: true, email: true } } },
      }),
      tx.placementRecord.findMany({ where: { institutionId: ctx.institution.id } }),
    ]);
    const byUser = new Map(records.map((r) => [r.userId, r]));
    return members.map((m) => {
      const record = byUser.get(m.userId);
      return {
        userId: m.userId,
        name: m.user.name,
        email: m.user.email,
        record: record ? toRecord(record) : null,
      };
    });
  });
}

async function saveRecord(
  tx: TenantTx,
  ctx: MemberContext,
  userId: string,
  input: RecordInput
): Promise<void> {
  // Only a current student of this college can have a record here.
  const member = await tx.institutionMembership.findUnique({
    where: { institutionId_userId: { institutionId: ctx.institution.id, userId } },
    select: { role: true, status: true },
  });
  if (member?.status !== "ACTIVE" || member.role !== "STUDENT") {
    throw new InstitutionError("not_found", "That person is not a student here.");
  }
  const data = { ...input, updatedById: ctx.user.id };
  await tx.placementRecord.upsert({
    where: { institutionId_userId: { institutionId: ctx.institution.id, userId } },
    create: { institutionId: ctx.institution.id, userId, ...data },
    update: data,
  });
  await writeAudit(tx, ctx.institution.id, ctx.user, {
    action: "placement.record_saved",
    targetType: "placement_record",
    targetId: userId,
    summary: `Saved placement record: ${input.department}, ${input.batchYear}, CGPA ${input.cgpa}`,
  });
}

export async function upsertPlacementRecord(
  ctx: MemberContext,
  userId: string,
  input: RecordInput
): Promise<void> {
  assertCan(ctx, "placement.manage");
  const parsed = recordSchema.parse(input);
  await withTenantScope(scopeOf(ctx), (tx) => saveRecord(tx, ctx, userId, parsed));
}

export type RecordImportRow = { line: number; email: string; error?: string };

/**
 * Bulk records as CSV: email,department,batchYear,cgpa,backlogs,attendance,skills
 * with skills separated by semicolons. Every row is validated first and nothing
 * is written unless all of them pass, so a bad file changes nothing.
 */
export async function importPlacementRecords(
  ctx: MemberContext,
  csv: string
): Promise<{ saved: number; rows: RecordImportRow[] }> {
  assertCan(ctx, "placement.manage");
  const lines = csv
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  // Errors name the file's own line, so a header row counts.
  const firstLine = lines[0]?.toLowerCase().startsWith("email,") ? 2 : 1;
  if (firstLine === 2) lines.shift();
  if (lines.length > 2000) {
    throw new InstitutionError("invalid", "Import at most 2000 rows at a time.");
  }

  return withTenantScope(scopeOf(ctx), async (tx) => {
    const students = await tx.institutionMembership.findMany({
      where: { institutionId: ctx.institution.id, role: "STUDENT", status: "ACTIVE" },
      select: { userId: true, user: { select: { email: true } } },
    });
    const byEmail = new Map(
      students.map((s) => [normaliseEmail(s.user.email), s.userId])
    );
    const valid: { userId: string; input: RecordInput }[] = [];
    const seenOn = new Map<string, number>();

    const rows = lines.map((text, i): RecordImportRow => {
      const [email = "", department, batch, cgpa, backlogs, attendance, skills] = text
        .split(",")
        .map((c) => c.trim());
      const line = i + firstLine;
      const userId = byEmail.get(normaliseEmail(email));
      if (!userId) return { line, email, error: "Not an active student here." };
      const earlier = seenOn.get(userId);
      if (earlier) return { line, email, error: `Already on line ${earlier}.` };
      seenOn.set(userId, line);
      const parsed = recordSchema.safeParse({
        department,
        batchYear: Number(batch),
        cgpa: Number(cgpa),
        backlogs: Number(backlogs || 0),
        attendancePercent: attendance ? Number(attendance) : null,
        skills: (skills ?? "")
          .split(";")
          .map((s) => s.trim())
          .filter(Boolean),
      });
      if (!parsed.success) {
        const issue = parsed.error.issues[0];
        return { line, email, error: `${String(issue?.path[0])}: ${issue?.message}` };
      }
      valid.push({ userId, input: parsed.data });
      return { line, email };
    });

    if (rows.some((r) => r.error)) return { saved: 0, rows };
    // In batches, not one row at a time: 2,000 single writes outlasted the 5 s
    // transaction limit locally. Membership was checked above, still in scope.
    for (let i = 0; i < valid.length; i += IMPORT_BATCH) {
      const batch = valid.slice(i, i + IMPORT_BATCH);
      await upsertRecords(tx, ctx, batch);
      await tx.institutionAuditLog.createMany({
        data: batch.map(({ userId, input }) => ({
          institutionId: ctx.institution.id,
          actorId: ctx.user.id,
          actorEmail: ctx.user.email,
          action: "placement.record_saved",
          targetType: "placement_record",
          targetId: userId,
          summary: `Saved placement record: ${input.department}, ${input.batchYear}, CGPA ${input.cgpa}`,
        })),
      });
    }
    return { saved: valid.length, rows };
  });
}

const IMPORT_BATCH = 500;

/** One statement per batch. Runs as te_tenant, so the record policies still apply. */
async function upsertRecords(
  tx: TenantTx,
  ctx: MemberContext,
  batch: { userId: string; input: RecordInput }[]
): Promise<void> {
  const json = JSON.stringify(
    batch.map(({ userId, input }) => ({ id: crypto.randomUUID(), userId, ...input }))
  );
  await tx.$executeRaw`
    INSERT INTO "placement_records" ("id", "institutionId", "userId", "department",
      "batchYear", "cgpa", "backlogs", "attendancePercent", "skills", "updatedById", "updatedAt")
    SELECT r.id, ${ctx.institution.id}, r."userId", r.department, r."batchYear", r.cgpa,
      r.backlogs, r."attendancePercent", ARRAY(SELECT jsonb_array_elements_text(r.skills)),
      ${ctx.user.id}, now() AT TIME ZONE 'UTC'
    FROM jsonb_to_recordset(${json}::jsonb) AS r(id text, "userId" text, department text,
      "batchYear" int, cgpa numeric, backlogs int, "attendancePercent" int, skills jsonb)
    ON CONFLICT ("institutionId", "userId") DO UPDATE SET
      "department" = EXCLUDED."department", "batchYear" = EXCLUDED."batchYear",
      "cgpa" = EXCLUDED."cgpa", "backlogs" = EXCLUDED."backlogs",
      "attendancePercent" = EXCLUDED."attendancePercent", "skills" = EXCLUDED."skills",
      "updatedById" = EXCLUDED."updatedById", "updatedAt" = EXCLUDED."updatedAt"
  `;
}

// --- Recruiter CRM ----------------------------------------------------------

export async function listCompanies(ctx: MemberContext) {
  assertCan(ctx, "placement.manage");
  return withTenantScope(scopeOf(ctx), (tx) =>
    tx.recruiterCompany.findMany({
      where: { institutionId: ctx.institution.id },
      orderBy: { name: "asc" },
      take: 500,
      include: { _count: { select: { drives: true, contacts: true } } },
    })
  );
}

/** The largest package DECIMAL(7,2) columns hold, in whole LPA. */
const MAX_LPA = 99999;

export async function createCompany(
  ctx: MemberContext,
  input: { name: string; website?: string; industry?: string }
): Promise<{ id: string }> {
  assertCan(ctx, "placement.manage");
  const name = input.name.trim();
  if (name.length < 2 || name.length > 120) {
    throw new InstitutionError("invalid", "A company name is 2 to 120 characters.");
  }
  const website = input.website?.trim() || null;
  // Rendered as a link, so a javascript: URL here would run in the office's session.
  if (website && !/^https?:\/\/[^\s]+$/i.test(website)) {
    throw new InstitutionError("invalid", "A website starts with http:// or https://.");
  }
  try {
    return await withTenantScope(scopeOf(ctx), async (tx) => {
      const company = await tx.recruiterCompany.create({
        data: {
          institutionId: ctx.institution.id,
          name,
          website,
          industry: input.industry?.trim() || null,
        },
        select: { id: true },
      });
      await writeAudit(tx, ctx.institution.id, ctx.user, {
        action: "placement.company_created",
        targetType: "recruiter_company",
        targetId: company.id,
        summary: `Added recruiter ${name}`,
      });
      return company;
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new InstitutionError("conflict", "That company is already listed.");
    }
    throw error;
  }
}

export async function getCompany(ctx: MemberContext, companyId: string) {
  assertCan(ctx, "placement.manage");
  return withTenantScope(scopeOf(ctx), (tx) =>
    tx.recruiterCompany.findFirst({
      where: { id: companyId, institutionId: ctx.institution.id },
      include: {
        contacts: { orderBy: { createdAt: "asc" } },
        notes: { orderBy: { createdAt: "desc" }, take: 100 },
        drives: {
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            title: true,
            status: true,
            packageLpa: true,
            deadline: true,
          },
        },
      },
    })
  );
}

export async function addContact(
  ctx: MemberContext,
  companyId: string,
  input: { name: string; title?: string; email?: string; phone?: string }
): Promise<void> {
  assertCan(ctx, "placement.manage");
  const name = input.name.trim();
  if (name.length < 2 || name.length > 120) {
    throw new InstitutionError("invalid", "A contact needs a name.");
  }
  await withTenantScope(scopeOf(ctx), async (tx) => {
    const company = await tx.recruiterCompany.findFirst({
      where: { id: companyId, institutionId: ctx.institution.id },
      select: { id: true },
    });
    if (!company) throw new InstitutionError("not_found", "No such company.");
    await tx.recruiterContact.create({
      data: {
        institutionId: ctx.institution.id,
        companyId,
        name,
        title: input.title?.trim() || null,
        email: input.email?.trim() || null,
        phone: input.phone?.trim() || null,
      },
    });
  });
}

export async function addCompanyNote(
  ctx: MemberContext,
  companyId: string,
  body: string
): Promise<void> {
  assertCan(ctx, "placement.manage");
  const text = body.trim();
  if (!text || text.length > 5000) {
    throw new InstitutionError("invalid", "Write a note of up to 5000 characters.");
  }
  await withTenantScope(scopeOf(ctx), async (tx) => {
    const company = await tx.recruiterCompany.findFirst({
      where: { id: companyId, institutionId: ctx.institution.id },
      select: { id: true },
    });
    if (!company) throw new InstitutionError("not_found", "No such company.");
    await tx.recruiterNote.create({
      data: {
        institutionId: ctx.institution.id,
        companyId,
        authorEmail: ctx.user.email,
        body: text,
      },
    });
  });
}

// --- Drives -----------------------------------------------------------------

export const driveSchema = z.object({
  companyId: z.string().min(1).max(64),
  title: z.string().trim().min(3).max(160),
  description: z.string().trim().min(1).max(5000),
  packageLpa: z.number().min(0).max(MAX_LPA).nullable(),
  isInternship: z.boolean(),
  deadline: z.date(),
  minCgpa: z.number().min(0).max(10).nullable(),
  maxBacklogs: z.number().int().min(0).max(100).nullable(),
  minAttendance: z.number().int().min(0).max(100).nullable(),
  departments: z.array(z.string().trim().min(1).max(60)).max(50),
  batchYears: z.array(z.number().int().min(2000).max(2100)).max(10),
  requiredSkills: z.array(z.string().trim().min(1).max(60)).max(30),
  excludePlaced: z.boolean(),
});
export type DriveInput = z.infer<typeof driveSchema>;

export async function createDrive(
  ctx: MemberContext,
  input: DriveInput
): Promise<{ id: string }> {
  assertCan(ctx, "placement.manage");
  const data = driveSchema.parse(input);
  return withTenantScope(scopeOf(ctx), async (tx) => {
    const company = await tx.recruiterCompany.findFirst({
      where: { id: data.companyId, institutionId: ctx.institution.id },
      select: { name: true },
    });
    if (!company) throw new InstitutionError("not_found", "No such company.");
    const drive = await tx.placementDrive.create({
      data: {
        ...data,
        institutionId: ctx.institution.id,
        companyName: company.name,
        createdById: ctx.user.id,
      },
      select: { id: true },
    });
    await writeAudit(tx, ctx.institution.id, ctx.user, {
      action: "placement.drive_created",
      targetType: "placement_drive",
      targetId: drive.id,
      summary: `Created drive "${data.title}" for ${company.name}`,
    });
    return drive;
  });
}

const STATUS_MOVES: Record<string, readonly string[]> = {
  DRAFT: ["OPEN"],
  OPEN: ["CLOSED"],
  CLOSED: ["OPEN", "COMPLETED"],
  COMPLETED: [],
};

export async function setDriveStatus(
  ctx: MemberContext,
  driveId: string,
  status: "OPEN" | "CLOSED" | "COMPLETED"
): Promise<void> {
  assertCan(ctx, "placement.manage");
  await withTenantScope(scopeOf(ctx), async (tx) => {
    const drive = await tx.placementDrive.findFirst({
      where: { id: driveId, institutionId: ctx.institution.id },
      select: { status: true, title: true },
    });
    if (!drive) throw new InstitutionError("not_found", "No such drive.");
    if (!STATUS_MOVES[drive.status]?.includes(status)) {
      throw new InstitutionError(
        "conflict",
        `A ${drive.status} drive cannot become ${status}.`
      );
    }
    await tx.placementDrive.update({ where: { id: driveId }, data: { status } });
    await writeAudit(tx, ctx.institution.id, ctx.user, {
      action: "placement.drive_status",
      targetType: "placement_drive",
      targetId: driveId,
      summary: `"${drive.title}" is now ${status}`,
    });
  });
}

export async function getOfficeDrive(ctx: MemberContext, driveId: string) {
  assertCan(ctx, "placement.manage");
  return withTenantScope(scopeOf(ctx), async (tx) => {
    const drive = await tx.placementDrive.findFirst({
      where: { id: driveId, institutionId: ctx.institution.id },
      include: {
        applications: {
          orderBy: { createdAt: "asc" },
          take: 1000,
          include: { user: { select: { name: true, email: true } } },
        },
      },
    });
    if (!drive) return null;

    const [members, records, placed] = await Promise.all([
      tx.institutionMembership.findMany({
        where: { institutionId: ctx.institution.id, role: "STUDENT", status: "ACTIVE" },
        select: { userId: true },
      }),
      tx.placementRecord.findMany({ where: { institutionId: ctx.institution.id } }),
      tx.placementApplication.findMany({
        where: { institutionId: ctx.institution.id, stage: "ACCEPTED" },
        select: { userId: true },
      }),
    ]);
    const byUser = new Map(records.map((r) => [r.userId, toRecord(r)]));
    const placedIds = new Set(placed.map((p) => p.userId));
    const criteria = toCriteria(drive);
    const eligibleCount = members.filter(
      (m) =>
        evaluateEligibility(
          criteria,
          byUser.get(m.userId) ?? null,
          placedIds.has(m.userId)
        ).eligible
    ).length;
    return { drive, eligibleCount, studentCount: members.length };
  });
}

export async function listOfficeDrives(ctx: MemberContext) {
  assertCan(ctx, "placement.manage");
  return withTenantScope(scopeOf(ctx), (tx) =>
    tx.placementDrive.findMany({
      where: { institutionId: ctx.institution.id },
      orderBy: { createdAt: "desc" },
      take: 200,
      include: { _count: { select: { applications: true } } },
    })
  );
}

export async function moveApplication(
  ctx: MemberContext,
  applicationId: string,
  to: PlacementStage,
  extra: { offerLpa?: number | null; interviewAt?: Date | null } = {}
): Promise<void> {
  assertCan(ctx, "placement.manage");
  await withTenantScope(scopeOf(ctx), async (tx) => {
    const application = await tx.placementApplication.findFirst({
      where: { id: applicationId, institutionId: ctx.institution.id },
      select: {
        stage: true,
        drive: { select: { title: true } },
        user: { select: { email: true } },
      },
    });
    if (!application) throw new InstitutionError("not_found", "No such application.");
    if (!canOfficeMove(application.stage, to)) {
      throw new InstitutionError(
        "conflict",
        `Cannot move from ${application.stage} to ${to}.`
      );
    }
    if (
      to === "OFFERED" &&
      !z.number().min(0).max(MAX_LPA).safeParse(extra.offerLpa).success
    ) {
      throw new InstitutionError("invalid", "An offer needs a package.");
    }
    // The stage in the filter makes two simultaneous moves resolve to one.
    const claimed = await tx.placementApplication.updateMany({
      where: { id: applicationId, stage: application.stage },
      data: {
        stage: to,
        ...(to === "OFFERED" ? { offerLpa: extra.offerLpa } : {}),
        ...(extra.interviewAt ? { interviewAt: extra.interviewAt } : {}),
      },
    });
    if (claimed.count !== 1)
      throw new InstitutionError("conflict", "It has already moved on.");
    await writeAudit(tx, ctx.institution.id, ctx.user, {
      action: "placement.application_moved",
      targetType: "placement_application",
      targetId: applicationId,
      summary: `${application.user.email} on "${application.drive.title}": ${application.stage} to ${to}`,
    });
  });
}

// --- The student's side -----------------------------------------------------

export type StudentDrive = {
  id: string;
  title: string;
  companyName: string;
  description: string;
  packageLpa: number | null;
  isInternship: boolean;
  deadline: Date;
  status: string;
  eligibility: EligibilityResult;
  application: {
    id: string;
    stage: PlacementStage;
    offerLpa: number | null;
    interviewAt: Date | null;
  } | null;
};

export async function getStudentPlacement(ctx: MemberContext) {
  return withTenantScope(scopeOf(ctx), async (tx) => {
    const [record, applications, drives] = await Promise.all([
      tx.placementRecord.findUnique({
        where: {
          institutionId_userId: {
            institutionId: ctx.institution.id,
            userId: ctx.user.id,
          },
        },
      }),
      tx.placementApplication.findMany({
        where: { institutionId: ctx.institution.id, userId: ctx.user.id },
        select: {
          id: true,
          driveId: true,
          stage: true,
          offerLpa: true,
          interviewAt: true,
        },
      }),
      tx.placementDrive.findMany({
        where: { institutionId: ctx.institution.id, status: { not: "DRAFT" } },
        orderBy: { deadline: "asc" },
        take: 200,
      }),
    ]);
    const student = record ? toRecord(record) : null;
    const placed = applications.some((a) => a.stage === "ACCEPTED");
    const mine = new Map(applications.map((a) => [a.driveId, a]));
    const list: StudentDrive[] = drives
      // A closed drive matters to a student only if they are in it.
      .filter((d) => d.status === "OPEN" || mine.has(d.id))
      .map((d) => {
        const application = mine.get(d.id);
        return {
          id: d.id,
          title: d.title,
          companyName: d.companyName,
          description: d.description,
          packageLpa: num(d.packageLpa),
          isInternship: d.isInternship,
          deadline: d.deadline,
          status: d.status,
          eligibility: evaluateEligibility(toCriteria(d), student, placed),
          application: application
            ? {
                id: application.id,
                stage: application.stage,
                offerLpa: num(application.offerLpa),
                interviewAt: application.interviewAt,
              }
            : null,
        };
      });
    return { record: student, drives: list };
  });
}

/** Refuses on the server, against server time, whatever the page showed. */
export async function applyToDrive(
  ctx: MemberContext,
  driveId: string,
  now = new Date()
) {
  if (ctx.role !== "STUDENT") {
    throw new InstitutionError("forbidden", "Only students apply to drives.");
  }
  await withTenantScope(scopeOf(ctx), async (tx) => {
    const drive = await tx.placementDrive.findFirst({
      where: { id: driveId, institutionId: ctx.institution.id, status: "OPEN" },
    });
    if (!drive) throw new InstitutionError("not_found", "That drive is not open.");
    if (drive.deadline <= now) {
      throw new InstitutionError("conflict", "The deadline for this drive has passed.");
    }
    const key = {
      institutionId_userId: { institutionId: ctx.institution.id, userId: ctx.user.id },
    };
    const [record, accepted] = await Promise.all([
      tx.placementRecord.findUnique({ where: key }),
      tx.placementApplication.count({
        where: {
          institutionId: ctx.institution.id,
          userId: ctx.user.id,
          stage: "ACCEPTED",
        },
      }),
    ]);
    const decision = evaluateEligibility(
      toCriteria(drive),
      record ? toRecord(record) : null,
      accepted > 0
    );
    if (!decision.eligible) {
      throw new InstitutionError("forbidden", "You do not meet this drive's criteria.");
    }
    const created = await tx.placementApplication.createMany({
      data: [
        {
          institutionId: ctx.institution.id,
          driveId,
          userId: ctx.user.id,
          eligibility: decision as unknown as Prisma.InputJsonValue,
        },
      ],
      skipDuplicates: true,
    });
    if (created.count === 0)
      throw new InstitutionError("conflict", "You have already applied.");
    await writeAudit(tx, ctx.institution.id, ctx.user, {
      action: "placement.applied",
      targetType: "placement_drive",
      targetId: driveId,
      summary: `${ctx.user.email} applied to "${drive.title}"`,
    });
  });
}

async function ownMove(
  ctx: MemberContext,
  applicationId: string,
  allowed: (stage: PlacementStage) => boolean,
  to: PlacementStage,
  action: string
): Promise<void> {
  try {
    await withTenantScope(scopeOf(ctx), async (tx) => {
      const application = await tx.placementApplication.findFirst({
        where: {
          id: applicationId,
          institutionId: ctx.institution.id,
          userId: ctx.user.id,
        },
        select: { stage: true },
      });
      if (!application) throw new InstitutionError("not_found", "No such application.");
      if (!allowed(application.stage)) {
        throw new InstitutionError("conflict", "That is no longer possible.");
      }
      const claimed = await tx.placementApplication.updateMany({
        where: { id: applicationId, userId: ctx.user.id, stage: application.stage },
        data: { stage: to },
      });
      if (claimed.count !== 1)
        throw new InstitutionError("conflict", "It has already moved on.");
      await writeAudit(tx, ctx.institution.id, ctx.user, {
        action,
        targetType: "placement_application",
        targetId: applicationId,
        summary: `${ctx.user.email}: ${application.stage} to ${to}`,
      });
    });
  } catch (error) {
    // The partial unique index: a second acceptance lost the race.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new InstitutionError("conflict", "You have already accepted an offer.");
    }
    throw error;
  }
}

export const withdrawApplication = (ctx: MemberContext, id: string) =>
  ownMove(ctx, id, canWithdraw, "WITHDRAWN", "placement.withdrawn");

export const respondToOffer = (ctx: MemberContext, id: string, accept: boolean) =>
  ownMove(
    ctx,
    id,
    (stage) => stage === "OFFERED",
    accept ? "ACCEPTED" : "DECLINED",
    accept ? "placement.offer_accepted" : "placement.offer_declined"
  );

// --- Reports ----------------------------------------------------------------

export async function getPlacementReport(ctx: MemberContext) {
  assertCan(ctx, "placement.manage");
  return withTenantScope(scopeOf(ctx), async (tx) => {
    const [students, records, applications, activeDrives] = await Promise.all([
      tx.institutionMembership.count({
        where: { institutionId: ctx.institution.id, role: "STUDENT", status: "ACTIVE" },
      }),
      tx.placementRecord.findMany({
        where: { institutionId: ctx.institution.id },
        select: { userId: true, department: true },
      }),
      tx.placementApplication.findMany({
        where: { institutionId: ctx.institution.id },
        select: {
          userId: true,
          stage: true,
          offerLpa: true,
          drive: { select: { companyName: true, isInternship: true } },
        },
      }),
      tx.placementDrive.count({
        where: { institutionId: ctx.institution.id, status: "OPEN" },
      }),
    ]);

    const accepted = applications.filter((a) => a.stage === "ACCEPTED");
    const fullTime = accepted.filter((a) => !a.drive.isInternship);
    const packages = fullTime
      .map((a) => num(a.offerLpa))
      .filter((p): p is number => p !== null);
    const placedIds = new Set(fullTime.map((a) => a.userId));

    const departments = new Map<string, { students: number; placed: number }>();
    for (const r of records) {
      const row = departments.get(r.department) ?? { students: 0, placed: 0 };
      row.students += 1;
      if (placedIds.has(r.userId)) row.placed += 1;
      departments.set(r.department, row);
    }
    const companies = new Map<string, number>();
    for (const a of accepted) {
      companies.set(a.drive.companyName, (companies.get(a.drive.companyName) ?? 0) + 1);
    }

    return {
      students,
      recordsEntered: records.length,
      activeDrives,
      applications: applications.length,
      offers: applications.filter((a) =>
        ["OFFERED", "ACCEPTED", "DECLINED"].includes(a.stage)
      ).length,
      placed: placedIds.size,
      internships: accepted.length - fullTime.length,
      placementPercent: students > 0 ? (placedIds.size / students) * 100 : null,
      highestLpa: packages.length > 0 ? Math.max(...packages) : null,
      medianLpa: median(packages),
      averageLpa:
        packages.length > 0
          ? packages.reduce((a, b) => a + b, 0) / packages.length
          : null,
      byDepartment: [...departments.entries()]
        .map(([department, row]) => ({ department, ...row }))
        .sort((a, b) => a.department.localeCompare(b.department)),
      byCompany: [...companies.entries()]
        .map(([company, hires]) => ({ company, hires }))
        .sort((a, b) => b.hires - a.hires),
    };
  });
}

export async function exportPlacementCsv(ctx: MemberContext): Promise<string> {
  assertCan(ctx, "placement.manage");
  const rows = await withTenantScope(scopeOf(ctx), async (tx) => {
    const found = await tx.placementApplication.findMany({
      where: { institutionId: ctx.institution.id },
      orderBy: { createdAt: "asc" },
      take: 20000,
      select: {
        stage: true,
        offerLpa: true,
        user: { select: { email: true, name: true } },
        drive: { select: { title: true, companyName: true } },
      },
    });
    await writeAudit(tx, ctx.institution.id, ctx.user, {
      action: "placement.exported",
      targetType: "institution",
      targetId: ctx.institution.id,
      summary: `Exported ${found.length} placement applications`,
    });
    return found;
  });
  const header = ["Student", "Email", "Company", "Drive", "Stage", "Offer LPA"];
  const body = rows.map((r) =>
    [
      r.user.name ?? "",
      r.user.email,
      r.drive.companyName,
      r.drive.title,
      r.stage,
      r.offerLpa === null ? "" : String(r.offerLpa),
    ]
      .map(csvCell)
      .join(",")
  );
  return [header.map(csvCell).join(","), ...body].join("\n");
}
