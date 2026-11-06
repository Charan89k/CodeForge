"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireUserOrThrow } from "@/lib/auth/session";
import {
  deleteAllTutorConversations,
  deleteTutorConversation,
  rateTutorAnswer,
} from "@/services/tutor-history";

export async function deleteConversationAction(id: string): Promise<void> {
  const user = await requireUserOrThrow();
  await deleteTutorConversation(user.id, id);
  revalidatePath("/ai-tutor/history");
  redirect("/ai-tutor/history?msg=deleted");
}

export async function deleteAllConversationsAction(form: FormData): Promise<void> {
  const user = await requireUserOrThrow();
  if (form.get("confirm") !== "on") redirect("/ai-tutor/history?msg=confirm");
  await deleteAllTutorConversations(user.id);
  revalidatePath("/ai-tutor/history");
  redirect("/ai-tutor/history?msg=deleted-all");
}

export async function rateAnswerAction(
  conversationId: string,
  messageId: string,
  helpful: boolean
): Promise<void> {
  const user = await requireUserOrThrow();
  await rateTutorAnswer(user.id, messageId, helpful);
  revalidatePath(`/ai-tutor/history/${conversationId}`);
}
