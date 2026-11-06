"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { CmsFormState } from "@/app/(shell)/admin/courses/actions";
import { requireUserOrThrow } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { CommunityError, type CommunityTarget } from "@/services/community";
import {
  decideAppeal,
  dismissReports,
  hideContent,
  liftRestriction,
  restoreContent,
  restrictPoster,
  setModerator,
  setThreadLocked,
} from "@/services/community-moderation";

/**
 * Moderator endpoints. The session is read here; whether this person may
 * moderate is decided by the service on every call.
 */

const id = z.string().min(1).max(64);
const target = z.union([z.object({ threadId: id }), z.object({ postId: id })]);
const reasonOf = (form: FormData) => String(form.get("reason") ?? "");

async function moderator() {
  const user = await requireUserOrThrow();
  return { id: user.id, role: user.role, email: user.email };
}

async function run(
  paths: string[],
  work: () => Promise<unknown>
): Promise<CmsFormState> {
  try {
    await work();
  } catch (error) {
    if (error instanceof CommunityError) return { error: error.message };
    if (error instanceof z.ZodError)
      return { error: "Give a reason of 3 to 300 characters." };
    throw error;
  }
  for (const path of paths) revalidatePath(path);
  return { saved: true };
}

const paths = (threadId: string) => [
  `/community/t/${id.parse(threadId)}`,
  "/community",
  "/community/moderation",
];

export async function hideAction(
  threadId: string,
  on: CommunityTarget,
  _state: CmsFormState,
  form: FormData
): Promise<CmsFormState> {
  const actor = await moderator();
  return run(paths(threadId), () =>
    hideContent(actor, target.parse(on), reasonOf(form))
  );
}

export async function restoreAction(
  threadId: string,
  on: CommunityTarget,
  _state: CmsFormState,
  form: FormData
): Promise<CmsFormState> {
  const actor = await moderator();
  return run(paths(threadId), () =>
    restoreContent(actor, target.parse(on), reasonOf(form))
  );
}

export async function dismissAction(
  threadId: string,
  on: CommunityTarget,
  _state: CmsFormState,
  form: FormData
): Promise<CmsFormState> {
  const actor = await moderator();
  return run(paths(threadId), () =>
    dismissReports(actor, target.parse(on), reasonOf(form))
  );
}

export async function lockAction(
  threadId: string,
  locked: boolean,
  _state: CmsFormState,
  form: FormData
): Promise<CmsFormState> {
  const actor = await moderator();
  return run(paths(threadId), () =>
    setThreadLocked(actor, id.parse(threadId), locked, reasonOf(form))
  );
}

export async function restrictAction(
  userId: string,
  _state: CmsFormState,
  form: FormData
): Promise<CmsFormState> {
  const actor = await moderator();
  return run(["/community/moderation"], () =>
    restrictPoster(actor, id.parse(userId), {
      days: Number(form.get("days") ?? 0),
      reason: reasonOf(form),
    })
  );
}

export async function liftAction(
  userId: string,
  _state: CmsFormState,
  form: FormData
): Promise<CmsFormState> {
  const actor = await moderator();
  return run(["/community/moderation"], () =>
    liftRestriction(actor, id.parse(userId), reasonOf(form))
  );
}

export async function decideAppealAction(
  appealId: string,
  overturn: boolean,
  _state: CmsFormState,
  form: FormData
): Promise<CmsFormState> {
  const actor = await moderator();
  return run(["/community/moderation", "/community"], () =>
    decideAppeal(actor, id.parse(appealId), overturn, reasonOf(form))
  );
}

/** Admins name a moderator by username. */
export async function moderatorAction(
  grant: boolean,
  _state: CmsFormState,
  form: FormData
): Promise<CmsFormState> {
  const actor = await moderator();
  const username = String(form.get("username") ?? "")
    .trim()
    .toLowerCase();
  const profile = username
    ? await prisma.profile.findUnique({ where: { username }, select: { userId: true } })
    : null;
  if (!profile) return { error: "No one has that username." };
  return run(["/community/moderation"], () =>
    setModerator(actor, profile.userId, grant)
  );
}
