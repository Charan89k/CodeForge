import "server-only";

import { z } from "zod";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

import {
  CommunityError,
  canModerate,
  displayName,
  type CommunityActor,
  type CommunityTarget,
} from "./community";
import { notifyQuietly } from "./notifications";

/**
 * Moderators act with a reason, every action is recorded, the author is told
 * what happened and why, and a decision can be appealed to a different
 * moderator. Platform admins moderate; admins can grant others the role.
 */

export type Moderator = CommunityActor & { email: string };

export const reasonSchema = z.string().trim().min(3).max(300);
const QUEUE_READ = 300;
const QUEUE_SHOWN = 50;

async function assertModerator(actor: Moderator): Promise<void> {
  if (!(await canModerate(actor))) {
    throw new CommunityError("forbidden", "Only community moderators can do that.");
  }
}

function record(
  tx: Prisma.TransactionClient,
  actor: Moderator,
  action: string,
  reason: string,
  target: { threadId?: string; postId?: string; targetUserId?: string }
) {
  return tx.communityModerationAction.create({
    data: {
      moderatorId: actor.id,
      moderatorEmail: actor.email,
      action,
      reason,
      ...target,
    },
  });
}

const AUTHOR = { select: { profile: { select: { username: true } } } } as const;

/** Reported items, most-reported first, each with why people reported it. */
export async function reportQueue(actor: Moderator) {
  await assertModerator(actor);
  const reports = await prisma.communityReport.findMany({
    where: { status: "OPEN" },
    orderBy: { createdAt: "asc" },
    take: QUEUE_READ,
    select: {
      threadId: true,
      postId: true,
      reason: true,
      note: true,
      createdAt: true,
      thread: {
        select: {
          id: true,
          title: true,
          body: true,
          status: true,
          authorId: true,
          author: AUTHOR,
        },
      },
      post: {
        select: {
          id: true,
          body: true,
          status: true,
          threadId: true,
          authorId: true,
          author: AUTHOR,
          thread: { select: { title: true } },
        },
      },
    },
  });
  const groups = new Map<
    string,
    {
      target: CommunityTarget;
      threadId: string;
      title: string;
      excerpt: string;
      status: string;
      authorId: string | null;
      authorName: string;
      reasons: Record<string, number>;
      notes: string[];
      firstReportedAt: Date;
      count: number;
    }
  >();
  for (const r of reports) {
    const key = r.threadId ? `t:${r.threadId}` : `p:${r.postId}`;
    const item = r.thread ?? r.post;
    if (!item) continue;
    const group = groups.get(key) ?? {
      target: r.threadId ? { threadId: r.threadId } : { postId: r.postId! },
      threadId: r.thread ? r.thread.id : r.post!.threadId,
      title: r.thread ? r.thread.title : r.post!.thread.title,
      excerpt: item.body.slice(0, 280),
      status: item.status,
      authorId: item.authorId,
      authorName: displayName(item.author),
      reasons: {},
      notes: [],
      firstReportedAt: r.createdAt,
      count: 0,
    };
    group.count += 1;
    group.reasons[r.reason] = (group.reasons[r.reason] ?? 0) + 1;
    if (r.note && group.notes.length < 5) group.notes.push(r.note);
    groups.set(key, group);
  }
  return [...groups.values()]
    .sort((a, b) => b.count - a.count || +a.firstReportedAt - +b.firstReportedAt)
    .slice(0, QUEUE_SHOWN);
}

async function itemFor(target: CommunityTarget) {
  if ("threadId" in target) {
    const t = await prisma.communityThread.findUnique({
      where: { id: target.threadId },
      select: { id: true, status: true, authorId: true, title: true },
    });
    return (
      t && { status: t.status, authorId: t.authorId, threadId: t.id, title: t.title }
    );
  }
  const p = await prisma.communityPost.findUnique({
    where: { id: target.postId },
    select: {
      status: true,
      authorId: true,
      threadId: true,
      thread: { select: { title: true } },
    },
  });
  return (
    p && {
      status: p.status,
      authorId: p.authorId,
      threadId: p.threadId,
      title: p.thread.title,
    }
  );
}

async function setStatus(
  tx: Prisma.TransactionClient,
  target: CommunityTarget,
  threadId: string,
  status: "VISIBLE" | "HIDDEN",
  hiddenReason: string | null
) {
  if ("threadId" in target) {
    await tx.communityThread.update({
      where: { id: target.threadId },
      data: { status, hiddenReason },
    });
    return;
  }
  await tx.communityPost.update({
    where: { id: target.postId },
    data: { status, hiddenReason },
  });
  // Reply counts follow what readers can see.
  await tx.communityThread.update({
    where: { id: threadId },
    data: { replyCount: { [status === "HIDDEN" ? "decrement" : "increment"]: 1 } },
  });
  if (status === "HIDDEN") {
    await tx.communityThread.updateMany({
      where: { id: threadId, acceptedPostId: target.postId },
      data: { acceptedPostId: null },
    });
  }
}

/** Hides a post from everyone but its author, who is told why and can appeal. */
export async function hideContent(
  actor: Moderator,
  target: CommunityTarget,
  reasonInput: string
): Promise<void> {
  await assertModerator(actor);
  const reason = reasonSchema.parse(reasonInput);
  const item = await itemFor(target);
  if (!item || item.status !== "VISIBLE") {
    throw new CommunityError("not_found", "Only a visible post can be hidden.");
  }
  await prisma.$transaction(async (tx) => {
    await setStatus(tx, target, item.threadId, "HIDDEN", reason);
    await tx.communityReport.updateMany({
      where: { ...target, status: "OPEN" },
      data: { status: "ACTIONED", handledById: actor.id, handledAt: new Date() },
    });
    await record(tx, actor, "hide", reason, target);
  });
  if (item.authorId) {
    await notifyQuietly({
      userId: item.authorId,
      kind: "COMMUNITY",
      title: "A moderator hid your post",
      body: `${reason} You can appeal from the thread.`,
      href: `/community/t/${item.threadId}`,
    });
  }
}

export async function restoreContent(
  actor: Moderator,
  target: CommunityTarget,
  reasonInput: string
): Promise<void> {
  await assertModerator(actor);
  const reason = reasonSchema.parse(reasonInput);
  const item = await itemFor(target);
  if (!item || item.status !== "HIDDEN") {
    throw new CommunityError("not_found", "Only a hidden post can be restored.");
  }
  await prisma.$transaction(async (tx) => {
    await setStatus(tx, target, item.threadId, "VISIBLE", null);
    await record(tx, actor, "restore", reason, target);
  });
}

/** Closes the reports on an item without acting on it. */
export async function dismissReports(
  actor: Moderator,
  target: CommunityTarget,
  reasonInput: string
): Promise<number> {
  await assertModerator(actor);
  const reason = reasonSchema.parse(reasonInput);
  return prisma.$transaction(async (tx) => {
    const { count } = await tx.communityReport.updateMany({
      where: { ...target, status: "OPEN" },
      data: { status: "DISMISSED", handledById: actor.id, handledAt: new Date() },
    });
    if (count > 0) await record(tx, actor, "dismiss", reason, target);
    return count;
  });
}

export async function setThreadLocked(
  actor: Moderator,
  threadId: string,
  locked: boolean,
  reasonInput: string
): Promise<void> {
  await assertModerator(actor);
  const reason = reasonSchema.parse(reasonInput);
  await prisma.$transaction(async (tx) => {
    const { count } = await tx.communityThread.updateMany({
      where: { id: threadId, locked: !locked },
      data: { locked },
    });
    if (count === 0) throw new CommunityError("not_found", "Nothing to change.");
    await record(tx, actor, locked ? "lock" : "unlock", reason, { threadId });
  });
}

export const restrictionSchema = z.object({
  days: z.number().int().min(1).max(90),
  reason: reasonSchema,
});

/** Pauses one account's posting. Never an admin, never yourself. */
export async function restrictPoster(
  actor: Moderator,
  userId: string,
  input: z.infer<typeof restrictionSchema>
): Promise<void> {
  await assertModerator(actor);
  const { days, reason } = restrictionSchema.parse(input);
  if (userId === actor.id)
    throw new CommunityError("invalid", "You cannot restrict yourself.");
  const person = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  if (!person) throw new CommunityError("not_found", "That person does not exist.");
  if (person.role === "ADMIN") {
    throw new CommunityError("forbidden", "An admin cannot be restricted here.");
  }
  const until = new Date(Date.now() + days * 24 * 60 * 60_000);
  await prisma.$transaction(async (tx) => {
    await tx.communityRestriction.upsert({
      where: { userId },
      create: { userId, until, reason, createdById: actor.id },
      update: { until, reason, createdById: actor.id },
    });
    await record(tx, actor, "restrict", `${days} days: ${reason}`, {
      targetUserId: userId,
    });
  });
  await notifyQuietly({
    userId,
    kind: "COMMUNITY",
    title: "Your community posting is paused",
    body: `Until ${until.toISOString().slice(0, 10)}. ${reason}`,
    href: "/community",
  });
}

export async function liftRestriction(
  actor: Moderator,
  userId: string,
  reasonInput: string
): Promise<void> {
  await assertModerator(actor);
  const reason = reasonSchema.parse(reasonInput);
  await prisma.$transaction(async (tx) => {
    const { count } = await tx.communityRestriction.deleteMany({ where: { userId } });
    if (count === 0)
      throw new CommunityError("not_found", "That account is not restricted.");
    await record(tx, actor, "unrestrict", reason, { targetUserId: userId });
  });
}

export async function appealQueue(actor: Moderator) {
  await assertModerator(actor);
  const appeals = await prisma.communityAppeal.findMany({
    where: { status: "OPEN" },
    orderBy: { createdAt: "asc" },
    take: QUEUE_SHOWN,
    select: {
      id: true,
      message: true,
      createdAt: true,
      threadId: true,
      postId: true,
      thread: { select: { title: true, body: true, hiddenReason: true } },
      post: {
        select: {
          body: true,
          hiddenReason: true,
          threadId: true,
          thread: { select: { title: true } },
        },
      },
    },
  });
  return appeals.map((a) => ({
    id: a.id,
    message: a.message,
    createdAt: a.createdAt,
    threadId: a.threadId ?? a.post?.threadId ?? "",
    title: a.thread?.title ?? a.post?.thread.title ?? "",
    excerpt: (a.thread?.body ?? a.post?.body ?? "").slice(0, 280),
    hiddenReason: a.thread?.hiddenReason ?? a.post?.hiddenReason ?? null,
  }));
}

/**
 * Decides an appeal. The moderator who hid the post cannot be the one who
 * hears the appeal, so a decision is always checked by a second person.
 */
export async function decideAppeal(
  actor: Moderator,
  appealId: string,
  overturn: boolean,
  noteInput: string
): Promise<void> {
  await assertModerator(actor);
  const note = reasonSchema.parse(noteInput);
  const appeal = await prisma.communityAppeal.findUnique({
    where: { id: appealId },
    select: { status: true, authorId: true, threadId: true, postId: true },
  });
  if (!appeal || appeal.status !== "OPEN") {
    throw new CommunityError("not_found", "That appeal is not open.");
  }
  const target: CommunityTarget = appeal.threadId
    ? { threadId: appeal.threadId }
    : { postId: appeal.postId! };
  const hid = await prisma.communityModerationAction.findFirst({
    where: { ...target, action: "hide" },
    orderBy: { createdAt: "desc" },
    select: { moderatorId: true },
  });
  if (hid?.moderatorId === actor.id) {
    throw new CommunityError(
      "forbidden",
      "A different moderator must hear an appeal of your decision."
    );
  }
  const item = await itemFor(target);
  await prisma.$transaction(async (tx) => {
    const claimed = await tx.communityAppeal.updateMany({
      where: { id: appealId, status: "OPEN" },
      data: {
        status: overturn ? "OVERTURNED" : "UPHELD",
        handledById: actor.id,
        handledAt: new Date(),
      },
    });
    if (claimed.count !== 1)
      throw new CommunityError("not_found", "That appeal is not open.");
    if (overturn && item?.status === "HIDDEN") {
      await setStatus(tx, target, item.threadId, "VISIBLE", null);
    }
    await record(
      tx,
      actor,
      overturn ? "appeal-overturned" : "appeal-upheld",
      note,
      target
    );
  });
  await notifyQuietly({
    userId: appeal.authorId,
    kind: "COMMUNITY",
    title: overturn ? "Your appeal was accepted" : "Your appeal was not accepted",
    body: note,
    href: `/community/t/${item?.threadId ?? ""}`,
  });
}

export async function moderationLog(actor: Moderator) {
  await assertModerator(actor);
  return prisma.communityModerationAction.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

export async function listRestrictions(actor: Moderator) {
  await assertModerator(actor);
  const rows = await prisma.communityRestriction.findMany({
    where: { until: { gt: new Date() } },
    orderBy: { until: "asc" },
    take: 100,
    select: {
      userId: true,
      until: true,
      reason: true,
      user: { select: { profile: { select: { username: true } } } },
    },
  });
  return rows.map((r) => ({ ...r, name: displayName(r.user) }));
}

/** Only platform admins choose moderators. */
export async function setModerator(
  actor: Moderator,
  userId: string,
  grant: boolean
): Promise<void> {
  if (actor.role !== "ADMIN") {
    throw new CommunityError("forbidden", "Only an admin can choose moderators.");
  }
  await prisma.$transaction(async (tx) => {
    if (grant) {
      await tx.communityModerator.upsert({
        where: { userId },
        create: { userId, grantedById: actor.id },
        update: {},
      });
    } else {
      await tx.communityModerator.deleteMany({ where: { userId } });
    }
    await record(
      tx,
      actor,
      grant ? "grant-moderator" : "revoke-moderator",
      "Admin decision",
      {
        targetUserId: userId,
      }
    );
  });
}

export async function listModerators(actor: Moderator) {
  await assertModerator(actor);
  const rows = await prisma.communityModerator.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      userId: true,
      createdAt: true,
      user: { select: { email: true, profile: { select: { username: true } } } },
    },
  });
  return rows.map((r) => ({
    userId: r.userId,
    since: r.createdAt,
    name: r.user.profile?.username ?? r.user.email,
  }));
}
