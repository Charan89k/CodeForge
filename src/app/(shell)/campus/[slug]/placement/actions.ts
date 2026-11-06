"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import type { CmsFormState } from "@/app/(shell)/admin/courses/actions";
import { PlacementStage } from "@/generated/prisma/enums";
import { InstitutionError, requireMemberOrThrow } from "@/lib/tenancy/context";
import { route } from "@/lib/utils";
import {
  addCompanyNote,
  addContact,
  applyToDrive,
  createCompany,
  createDrive,
  driveSchema,
  importPlacementRecords,
  moveApplication,
  recordSchema,
  respondToOffer,
  setDriveStatus,
  upsertPlacementRecord,
  withdrawApplication,
} from "@/services/placement";

/**
 * Each of these is a public endpoint, so each resolves the member from the
 * session and leaves the decision to the service, which checks again.
 */
const id = z.string().min(1).max(64);
const text = (form: FormData, name: string) => String(form.get(name) ?? "").trim();
const optionalNumber = (form: FormData, name: string) =>
  text(form, name) === "" ? null : Number(text(form, name));
const csvList = (value: string) =>
  value
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);

async function run(slug: string, work: () => Promise<unknown>): Promise<CmsFormState> {
  try {
    await work();
  } catch (error) {
    if (error instanceof InstitutionError) return { error: error.message };
    if (error instanceof z.ZodError) {
      const issue = error.issues[0];
      return {
        error: `${String(issue?.path[0] ?? "Form")}: ${issue?.message ?? "invalid"}`,
      };
    }
    throw error;
  }
  revalidatePath(`/campus/${slug}/placement`, "layout");
  return { saved: true };
}

const office = (slug: string) => requireMemberOrThrow(slug, "placement.manage");
const member = (slug: string) => requireMemberOrThrow(slug);

export async function createCompanyAction(
  slug: string,
  _state: CmsFormState,
  form: FormData
): Promise<CmsFormState> {
  const ctx = await office(slug);
  return run(slug, () =>
    createCompany(ctx, {
      name: text(form, "name"),
      website: text(form, "website"),
      industry: text(form, "industry"),
    })
  );
}

export async function addContactAction(
  slug: string,
  companyId: string,
  _state: CmsFormState,
  form: FormData
): Promise<CmsFormState> {
  const ctx = await office(slug);
  return run(slug, () =>
    addContact(ctx, id.parse(companyId), {
      name: text(form, "name"),
      title: text(form, "title"),
      email: text(form, "email"),
      phone: text(form, "phone"),
    })
  );
}

export async function addNoteAction(
  slug: string,
  companyId: string,
  _state: CmsFormState,
  form: FormData
): Promise<CmsFormState> {
  const ctx = await office(slug);
  return run(slug, () => addCompanyNote(ctx, id.parse(companyId), text(form, "body")));
}

export async function createDriveAction(
  slug: string,
  _state: CmsFormState,
  form: FormData
): Promise<CmsFormState> {
  const ctx = await office(slug);
  const parsed = driveSchema.safeParse({
    companyId: text(form, "companyId"),
    title: text(form, "title"),
    description: text(form, "description"),
    packageLpa: optionalNumber(form, "packageLpa"),
    isInternship: form.get("isInternship") === "on",
    // datetime-local has no zone; the form says UTC, so read it as UTC.
    deadline: new Date(`${text(form, "deadline")}:00Z`),
    minCgpa: optionalNumber(form, "minCgpa"),
    maxBacklogs: optionalNumber(form, "maxBacklogs"),
    minAttendance: optionalNumber(form, "minAttendance"),
    departments: csvList(text(form, "departments")),
    batchYears: csvList(text(form, "batchYears")).map(Number),
    requiredSkills: csvList(text(form, "requiredSkills")),
    excludePlaced: form.get("excludePlaced") === "on",
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      error: `${String(issue?.path[0] ?? "Form")}: ${issue?.message ?? "invalid"}`,
    };
  }
  let driveId = "";
  const result = await run(slug, async () => {
    ({ id: driveId } = await createDrive(ctx, parsed.data));
  });
  if (result.error) return result;
  redirect(route(`/campus/${slug}/placement/drives/${driveId}`));
}

export async function setDriveStatusAction(
  slug: string,
  driveId: string,
  status: "OPEN" | "CLOSED" | "COMPLETED"
): Promise<CmsFormState> {
  const ctx = await office(slug);
  return run(slug, () => setDriveStatus(ctx, id.parse(driveId), status));
}

export async function moveApplicationAction(
  slug: string,
  applicationId: string,
  to: string,
  _state: CmsFormState,
  form: FormData
): Promise<CmsFormState> {
  const ctx = await office(slug);
  const stage = z.nativeEnum(PlacementStage).parse(to);
  return run(slug, () =>
    moveApplication(ctx, id.parse(applicationId), stage, {
      offerLpa: optionalNumber(form, "offerLpa"),
    })
  );
}

export async function saveRecordAction(
  slug: string,
  userId: string,
  _state: CmsFormState,
  form: FormData
): Promise<CmsFormState> {
  const ctx = await office(slug);
  return run(slug, () =>
    upsertPlacementRecord(
      ctx,
      id.parse(userId),
      recordSchema.parse({
        department: text(form, "department"),
        batchYear: Number(text(form, "batchYear")),
        cgpa: Number(text(form, "cgpa")),
        backlogs: Number(text(form, "backlogs") || 0),
        attendancePercent: optionalNumber(form, "attendancePercent"),
        skills: csvList(text(form, "skills")),
      })
    )
  );
}

export type ImportState = CmsFormState & {
  saved_count?: number;
  rows?: { line: number; email: string; error?: string }[];
};

export async function importRecordsAction(
  slug: string,
  _state: ImportState,
  form: FormData
): Promise<ImportState> {
  const ctx = await office(slug);
  try {
    const { saved, rows } = await importPlacementRecords(ctx, text(form, "csv"));
    revalidatePath(`/campus/${slug}/placement`, "layout");
    const bad = rows.filter((r) => r.error);
    if (bad.length > 0) {
      const first = bad[0]!;
      return {
        error: `Nothing was imported. ${bad.length} row(s) need fixing; line ${first.line} (${first.email}): ${first.error}`,
      };
    }
    return { saved: true, saved_count: saved };
  } catch (error) {
    if (error instanceof InstitutionError) return { error: error.message };
    throw error;
  }
}

export async function applyAction(
  slug: string,
  driveId: string
): Promise<CmsFormState> {
  const ctx = await member(slug);
  return run(slug, () => applyToDrive(ctx, id.parse(driveId)));
}

export async function withdrawAction(
  slug: string,
  applicationId: string
): Promise<CmsFormState> {
  const ctx = await member(slug);
  return run(slug, () => withdrawApplication(ctx, id.parse(applicationId)));
}

export async function respondToOfferAction(
  slug: string,
  applicationId: string,
  accept: boolean
): Promise<CmsFormState> {
  const ctx = await member(slug);
  return run(slug, () => respondToOffer(ctx, id.parse(applicationId), accept));
}
