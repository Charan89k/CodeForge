import "server-only";

import { z } from "zod";

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { RATE_LIMITS, rateLimit } from "@/lib/rate-limit";

import {
  CommunityError,
  liveTarget,
  type CommunityActor,
  type CommunityTarget,
} from "./community";

/**
 * What a learner does to keep themselves and others safe: report a post,
 * block a person, appeal a moderator's decision about their own post.
 */

export const REPORT_REASONS = [
  "SPAM",
  "HARASSMENT",
  "OFF_TOPIC",
  "UNSAFE_LINK",
  "COPIED_CONTENT",
  "OTHER",
] as const;

export const reportSchema = z.object({
  reason: z.enum(REPORT_REASONS),
  note: z.string().trim().max(500).optional(),
});

async function safetyLimit(actor: CommunityActor) {
  if (
    !(await rateLimit(`community-safety:${actor.id}`, RATE_LIMITS.COMMUNITY_SAFETY))
      .success
  ) {
    throw new CommunityError("limited", "That is a lot at once. Try again in a while.");
  }
}

const isUniqueClash = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";

/** One report per person per item. Reporting again says it is already with us. */
export async function reportContent(
  actor: CommunityActor,
  target: CommunityTarget,
  input: z.infer<typeof reportSchema>
): Promise<"reported" | "already"> {
  const { reason, note } = reportSchema.parse(input);
  const row = await liveTarget(target);
  if (row.authorId === actor.id) {
    throw new CommunityError("forbidden", "You cannot report your own post.");
  }
  await safetyLimit(actor);
  try {
    await prisma.communityReport.create({
      data: { reporterId: actor.id, ...target, reason, note: note || null },
    });
    return "reported";
  } catch (error) {
    if (isUniqueClash(error)) return "already";
    throw error;
  }
}

export async function blockPerson(
  actor: CommunityActor,
  userId: string
): Promise<void> {
  if (userId === actor.id)
    throw new CommunityError("invalid", "You cannot block yourself.");
  await safetyLimit(actor);
  const exists = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });
  if (!exists) throw new CommunityError("not_found", "That person does not exist.");
  await prisma.communityBlock.createMany({
    data: [{ blockerId: actor.id, blockedId: userId }],
    skipDuplicates: true,
  });
}

export async function unblockPerson(
  actor: CommunityActor,
  userId: string
): Promise<void> {
  await prisma.communityBlock.deleteMany({
    where: { blockerId: actor.id, blockedId: userId },
  });
}

/** The people this learner has blocked, by username only. */
export async function listBlocked(actor: CommunityActor) {
  const rows = await prisma.communityBlock.findMany({
    where: { blockerId: actor.id },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      blockedId: true,
      createdAt: true,
      blocked: { select: { profile: { select: { username: true } } } },
    },
  });
  return rows.map((r) => ({
    userId: r.blockedId,
    name: r.blocked.profile?.username ?? "A learner",
    since: r.createdAt,
  }));
}

export const appealSchema = z.string().trim().min(10).max(1000);

/** The author of a hidden post asks for it to be looked at again, once. */
export async function appealDecision(
  actor: CommunityActor,
  target: CommunityTarget,
  input: string
): Promise<void> {
  const message = appealSchema.parse(input);
  const row =
    "threadId" in target
      ? await prisma.communityThread.findUnique({
          where: { id: target.threadId },
          select: { authorId: true, status: true },
        })
      : await prisma.communityPost.findUnique({
          where: { id: target.postId },
          select: { authorId: true, status: true },
        });
  if (!row || row.authorId !== actor.id || row.status !== "HIDDEN") {
    throw new CommunityError(
      "not_found",
      "Only a hidden post of your own can be appealed."
    );
  }
  await safetyLimit(actor);
  try {
    await prisma.communityAppeal.create({
      data: { authorId: actor.id, ...target, message },
    });
  } catch (error) {
    if (isUniqueClash(error)) {
      throw new CommunityError("duplicate", "You have already appealed this decision.");
    }
    throw error;
  }
}
