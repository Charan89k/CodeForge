"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAdminOrThrow } from "@/lib/auth/session";
import {
  AptitudeReviewError,
  archiveAptitudeQuestion,
  createAptitudeQuestion,
  publishAptitudeQuestion,
  questionInputSchema,
} from "@/services/aptitude";

function refresh() {
  revalidatePath("/admin/aptitude");
  revalidatePath("/aptitude");
  revalidatePath("/campus/aptitude");
}

export async function createQuestionAction(form: FormData): Promise<void> {
  const admin = await requireAdminOrThrow();
  const parsed = questionInputSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) redirect("/admin/aptitude?msg=invalid");
  await createAptitudeQuestion(admin, parsed.data);
  refresh();
  redirect("/admin/aptitude?msg=created");
}

export async function publishQuestionAction(id: string): Promise<void> {
  const admin = await requireAdminOrThrow();
  try {
    await publishAptitudeQuestion(admin, id);
  } catch (error) {
    if (error instanceof AptitudeReviewError) redirect("/admin/aptitude?msg=refused");
    throw error;
  }
  refresh();
  redirect("/admin/aptitude?msg=published");
}

export async function archiveQuestionAction(id: string): Promise<void> {
  const admin = await requireAdminOrThrow();
  await archiveAptitudeQuestion(admin, id);
  refresh();
  redirect("/admin/aptitude?msg=archived");
}
