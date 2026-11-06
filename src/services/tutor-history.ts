import "server-only";

import { prisma } from "@/lib/db";

/**
 * A learner's own tutor conversations. Every query names `userId`, so a
 * conversation id from another account matches no row and reads as missing.
 */

const LISTED = 100;
const DAY_MS = 24 * 60 * 60_000;

export async function listTutorConversations(userId: string) {
  return prisma.aIConversation.findMany({
    where: { userId, mode: "TUTOR" },
    orderBy: { updatedAt: "desc" },
    take: LISTED,
    select: {
      id: true,
      title: true,
      updatedAt: true,
      _count: { select: { messages: true } },
    },
  });
}

export async function getTutorTranscript(userId: string, id: string) {
  return prisma.aIConversation.findFirst({
    where: { id, userId, mode: "TUTOR" },
    select: {
      id: true,
      title: true,
      messages: {
        where: { role: { not: "SYSTEM" } },
        orderBy: { createdAt: "asc" },
        select: { id: true, role: true, content: true, helpful: true },
      },
    },
  });
}

export async function deleteTutorConversation(
  userId: string,
  id: string
): Promise<boolean> {
  const { count } = await prisma.aIConversation.deleteMany({
    where: { id, userId, mode: "TUTOR" },
  });
  return count === 1;
}

export async function deleteAllTutorConversations(userId: string): Promise<number> {
  const { count } = await prisma.aIConversation.deleteMany({
    where: { userId, mode: "TUTOR" },
  });
  return count;
}

/** Only on the tutor's own answers, in the learner's own conversations. */
export async function rateTutorAnswer(
  userId: string,
  messageId: string,
  helpful: boolean
): Promise<boolean> {
  const { count } = await prisma.aIMessage.updateMany({
    where: {
      id: messageId,
      role: "ASSISTANT",
      conversation: { userId, mode: "TUTOR" },
    },
    data: { helpful },
  });
  return count === 1;
}

/** Deletes conversations idle for `days`. Runs only when retention is configured. */
export async function purgeExpiredTutorConversations(
  days: number,
  now = new Date()
): Promise<number> {
  const { count } = await prisma.aIConversation.deleteMany({
    where: {
      mode: "TUTOR",
      updatedAt: { lt: new Date(now.getTime() - days * DAY_MS) },
    },
  });
  return count;
}
