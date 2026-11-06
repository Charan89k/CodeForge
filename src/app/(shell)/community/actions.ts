"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import type { CmsFormState } from "@/app/(shell)/admin/courses/actions";
import { requireUserOrThrow } from "@/lib/auth/session";
import { BODY_MAX, REPLY_MAX, TITLE_MAX, TITLE_MIN } from "@/lib/community/content";
import { route } from "@/lib/utils";
import {
  CommunityError,
  acceptAnswer,
  createThread,
  removeOwn,
  replyToThread,
  toggleVote,
  type CommunityTarget,
} from "@/services/community";
import {
  appealDecision,
  blockPerson,
  reportContent,
  REPORT_REASONS,
  unblockPerson,
} from "@/services/community-safety";

/**
 * Each of these is a public endpoint: the session is read here and every
 * rule is checked again in the service.
 */

const id = z.string().min(1).max(64);
const target = z.union([z.object({ threadId: id }), z.object({ postId: id })]);
const text = (form: FormData, key: string) => String(form.get(key) ?? "");

const FIELD_MESSAGES: Record<string, string> = {
  title: `A title is ${TITLE_MIN} to ${TITLE_MAX} characters.`,
  body: `Write something first, up to ${BODY_MAX.toLocaleString("en")} characters.`,
  reply: `Write a reply first, up to ${REPLY_MAX.toLocaleString("en")} characters.`,
  category: "Choose a category.",
  kind: "Choose a discussion or a question.",
  reason: "Choose a reason.",
  note: "Keep the note under 500 characters.",
  appeal: "Explain in 10 to 1,000 characters.",
};

function failure(error: unknown, field = "body"): CmsFormState {
  if (error instanceof CommunityError) return { error: error.message };
  if (error instanceof z.ZodError) {
    const key = String(error.issues[0]?.path[0] ?? field);
    return { error: FIELD_MESSAGES[key] ?? FIELD_MESSAGES[field] ?? "Check the form." };
  }
  throw error;
}

const threadPath = (threadId: string) => `/community/t/${id.parse(threadId)}`;

export async function createThreadAction(
  _state: CmsFormState,
  form: FormData
): Promise<CmsFormState> {
  const user = await requireUserOrThrow();
  let threadId = "";
  try {
    threadId = await createThread(user, {
      category: text(form, "category"),
      kind: text(form, "kind") === "QUESTION" ? "QUESTION" : "DISCUSSION",
      title: text(form, "title"),
      body: text(form, "body"),
    });
  } catch (error) {
    return failure(error);
  }
  revalidatePath("/community");
  redirect(route(threadPath(threadId)));
}

export async function replyAction(
  threadId: string,
  _state: CmsFormState,
  form: FormData
): Promise<CmsFormState> {
  const user = await requireUserOrThrow();
  try {
    await replyToThread(user, id.parse(threadId), text(form, "reply"));
  } catch (error) {
    return failure(error, "reply");
  }
  revalidatePath(threadPath(threadId));
  return { saved: true };
}

export async function voteAction(threadId: string, on: CommunityTarget): Promise<void> {
  const user = await requireUserOrThrow();
  try {
    await toggleVote(user, target.parse(on));
  } catch (error) {
    if (!(error instanceof CommunityError)) throw error;
  }
  revalidatePath(threadPath(threadId));
}

export async function acceptAction(
  threadId: string,
  postId: string | null
): Promise<void> {
  const user = await requireUserOrThrow();
  await acceptAnswer(
    user,
    id.parse(threadId),
    postId === null ? null : id.parse(postId)
  );
  revalidatePath(threadPath(threadId));
}

export async function removeAction(
  threadId: string,
  on: CommunityTarget
): Promise<void> {
  const user = await requireUserOrThrow();
  await removeOwn(user, target.parse(on));
  revalidatePath(threadPath(threadId));
  revalidatePath("/community");
}

export async function reportAction(
  on: CommunityTarget,
  _state: CmsFormState,
  form: FormData
): Promise<CmsFormState> {
  const user = await requireUserOrThrow();
  const reason = REPORT_REASONS.find((r) => r === text(form, "reason"));
  try {
    if (!reason) throw new CommunityError("invalid", FIELD_MESSAGES.reason!);
    await reportContent(user, target.parse(on), { reason, note: text(form, "note") });
  } catch (error) {
    return failure(error, "note");
  }
  return { saved: true };
}

export async function appealAction(
  threadId: string,
  on: CommunityTarget,
  _state: CmsFormState,
  form: FormData
): Promise<CmsFormState> {
  const user = await requireUserOrThrow();
  try {
    await appealDecision(user, target.parse(on), text(form, "appeal"));
  } catch (error) {
    return failure(error, "appeal");
  }
  revalidatePath(threadPath(threadId));
  return { saved: true };
}

export async function blockAction(threadId: string, userId: string): Promise<void> {
  const user = await requireUserOrThrow();
  await blockPerson(user, id.parse(userId));
  revalidatePath(threadPath(threadId));
}

export async function unblockAction(userId: string): Promise<void> {
  const user = await requireUserOrThrow();
  await unblockPerson(user, id.parse(userId));
  revalidatePath("/community/blocked");
}
