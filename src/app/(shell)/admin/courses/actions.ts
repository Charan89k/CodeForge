"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { Difficulty } from "@/generated/prisma/enums";
import { requireAdminOrThrow } from "@/lib/auth/session";
import { route } from "@/lib/utils";
import {
  CmsError,
  createChapter,
  createCourse,
  createSection,
  parseCourseForm,
  publishRevision,
  rejectRevision,
  restoreRevision,
  saveDraft,
  setCoursePublished,
  submitForReview,
  updateCourse,
} from "@/services/cms";

export type CmsFormState = { error?: string; saved?: boolean };

const id = z.string().min(1).max(64);
const list = (value: FormDataEntryValue | null) =>
  String(value ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

/** A CmsError carries a message written for the author; anything else rethrows. */
function failure(error: unknown): CmsFormState {
  if (error instanceof CmsError) return { error: error.message };
  throw error;
}

function firstIssue(error: z.ZodError): string {
  const issue = error.issues[0];
  return `${String(issue?.path[0] ?? "Form")}: ${issue?.message ?? "invalid"}`;
}

export async function createCourseAction(
  _state: CmsFormState,
  form: FormData
): Promise<CmsFormState> {
  const admin = await requireAdminOrThrow();
  const parsed = parseCourseForm(form);
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  let courseId = "";
  try {
    courseId = await createCourse(admin, parsed.data);
  } catch (error) {
    return failure(error);
  }
  redirect(route(`/admin/courses/${courseId}`));
}

export async function updateCourseAction(
  courseId: string,
  _state: CmsFormState,
  form: FormData
): Promise<CmsFormState> {
  const admin = await requireAdminOrThrow();
  const parsed = parseCourseForm(form);
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  try {
    await updateCourse(admin, id.parse(courseId), parsed.data);
  } catch (error) {
    return failure(error);
  }
  revalidatePath(`/admin/courses/${courseId}`);
  return { saved: true };
}

export async function setCoursePublishedAction(
  courseId: string,
  published: boolean
): Promise<CmsFormState> {
  const admin = await requireAdminOrThrow();
  try {
    await setCoursePublished(admin, id.parse(courseId), published);
  } catch (error) {
    return failure(error);
  }
  revalidatePath(`/admin/courses/${courseId}`);
  revalidatePath("/learn");
  return { saved: true };
}

export async function createSectionAction(
  courseId: string,
  _state: CmsFormState,
  form: FormData
): Promise<CmsFormState> {
  const admin = await requireAdminOrThrow();
  try {
    await createSection(admin, id.parse(courseId), {
      title: String(form.get("title") ?? ""),
      slug: String(form.get("slug") ?? ""),
      summary: String(form.get("summary") ?? ""),
    });
  } catch (error) {
    return failure(error);
  }
  revalidatePath(`/admin/courses/${courseId}`);
  return { saved: true };
}

export async function createChapterAction(
  courseId: string,
  sectionId: string,
  _state: CmsFormState,
  form: FormData
): Promise<CmsFormState> {
  const admin = await requireAdminOrThrow();
  let chapterId = "";
  try {
    chapterId = await createChapter(admin, id.parse(sectionId), {
      title: String(form.get("title") ?? ""),
      slug: String(form.get("slug") ?? ""),
    });
  } catch (error) {
    return failure(error);
  }
  redirect(route(`/admin/courses/${courseId}/chapters/${chapterId}`));
}

export async function saveDraftAction(
  chapterId: string,
  format: "markdown" | "blocks",
  _state: CmsFormState,
  form: FormData
): Promise<CmsFormState> {
  const admin = await requireAdminOrThrow();
  const source = String(form.get("source") ?? "");
  const difficulty = z.nativeEnum(Difficulty).safeParse(form.get("difficulty"));
  if (!difficulty.success) return { error: "Choose a difficulty." };
  try {
    await saveDraft(admin, id.parse(chapterId), {
      title: String(form.get("title") ?? ""),
      summary: String(form.get("summary") ?? ""),
      ...(format === "markdown" ? { markdown: source } : { blocksJson: source }),
      objectives: list(form.get("objectives")),
      keyTakeaways: list(form.get("keyTakeaways")),
      readingMinutes: Number(form.get("readingMinutes") ?? 5),
      difficulty: difficulty.data,
    });
  } catch (error) {
    return failure(error);
  }
  revalidatePath("/admin/courses", "layout");
  return { saved: true };
}

/** Review steps share one shape: an action on a version, with a message on failure. */
async function step(run: () => Promise<void>): Promise<CmsFormState> {
  try {
    await run();
  } catch (error) {
    return failure(error);
  }
  revalidatePath("/admin/courses", "layout");
  revalidatePath("/learn", "layout");
  return { saved: true };
}

export async function submitForReviewAction(revisionId: string): Promise<CmsFormState> {
  const admin = await requireAdminOrThrow();
  return step(() => submitForReview(admin, id.parse(revisionId)));
}

export async function publishRevisionAction(revisionId: string): Promise<CmsFormState> {
  const admin = await requireAdminOrThrow();
  return step(() => publishRevision(admin, id.parse(revisionId)));
}

export async function rejectRevisionAction(
  revisionId: string,
  _state: CmsFormState,
  form: FormData
): Promise<CmsFormState> {
  const admin = await requireAdminOrThrow();
  const note = String(form.get("note") ?? "")
    .trim()
    .slice(0, 2000);
  if (!note) return { error: "Say what needs to change." };
  return step(() => rejectRevision(admin, id.parse(revisionId), note));
}

export async function restoreRevisionAction(revisionId: string): Promise<CmsFormState> {
  const admin = await requireAdminOrThrow();
  return step(() => restoreRevision(admin, id.parse(revisionId)));
}
