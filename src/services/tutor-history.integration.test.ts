import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));

import { prisma } from "@/lib/db";

import {
  deleteAllTutorConversations,
  deleteTutorConversation,
  getTutorTranscript,
  listTutorConversations,
  purgeExpiredTutorConversations,
  rateTutorAnswer,
} from "./tutor-history";

const tag = `tut${Date.now()}x${Math.floor(Math.random() * 1e6)}`;
let owner = "";
let other = "";

const user = async (name: string) =>
  (
    await prisma.user.create({
      data: { email: `${name}-${tag}@techepitome.test` },
      select: { id: true },
    })
  ).id;

async function conversation(userId: string) {
  return prisma.aIConversation.create({
    data: {
      userId,
      title: `Thread ${tag}`,
      mode: "TUTOR",
      messages: {
        create: [
          { role: "USER", content: "A question" },
          { role: "ASSISTANT", content: "An answer" },
        ],
      },
    },
    select: { id: true, messages: { select: { id: true, role: true } } },
  });
}

beforeAll(async () => {
  owner = await user("owner");
  other = await user("other");
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: [owner, other] } } });
});

describe("a learner's own conversations", () => {
  it("cannot be read, rated or deleted from another account", async () => {
    const thread = await conversation(owner);
    const answer = thread.messages.find((m) => m.role === "ASSISTANT")!;

    await expect(getTutorTranscript(other, thread.id)).resolves.toBeNull();
    await expect(listTutorConversations(other)).resolves.toEqual([]);
    await expect(rateTutorAnswer(other, answer.id, true)).resolves.toBe(false);
    await expect(deleteTutorConversation(other, thread.id)).resolves.toBe(false);

    const kept = await getTutorTranscript(owner, thread.id);
    expect(kept?.messages).toHaveLength(2);
    expect(kept?.messages.find((m) => m.id === answer.id)?.helpful).toBeNull();
  });

  it("rates only the tutor's answers, and can change its mind", async () => {
    const thread = await conversation(owner);
    const answer = thread.messages.find((m) => m.role === "ASSISTANT")!;
    const question = thread.messages.find((m) => m.role === "USER")!;

    await expect(rateTutorAnswer(owner, question.id, true)).resolves.toBe(false);
    await expect(rateTutorAnswer(owner, answer.id, true)).resolves.toBe(true);
    await expect(rateTutorAnswer(owner, answer.id, false)).resolves.toBe(true);

    const kept = await getTutorTranscript(owner, thread.id);
    expect(kept?.messages.find((m) => m.id === answer.id)?.helpful).toBe(false);
  });

  it("deleting one takes its messages with it and leaves the rest", async () => {
    const gone = await conversation(owner);
    const stays = await conversation(owner);

    await expect(deleteTutorConversation(owner, gone.id)).resolves.toBe(true);

    await expect(
      prisma.aIMessage.count({ where: { conversationId: gone.id } })
    ).resolves.toBe(0);
    await expect(getTutorTranscript(owner, stays.id)).resolves.not.toBeNull();
  });

  it("deleting all leaves other people's alone", async () => {
    const theirs = await conversation(other);

    await deleteAllTutorConversations(owner);

    await expect(listTutorConversations(owner)).resolves.toEqual([]);
    await expect(getTutorTranscript(other, theirs.id)).resolves.not.toBeNull();
  });
});

describe("retention", () => {
  it("deletes only conversations idle past the limit", async () => {
    const old = await conversation(owner);
    const fresh = await conversation(owner);
    const now = new Date();
    // `updatedAt` is set by Prisma, so backdate it directly.
    await prisma.$executeRaw`UPDATE ai_conversations SET "updatedAt" = ${new Date(
      now.getTime() - 40 * 86_400_000
    )} WHERE id = ${old.id}`;

    await purgeExpiredTutorConversations(30, now);

    await expect(getTutorTranscript(owner, old.id)).resolves.toBeNull();
    await expect(getTutorTranscript(owner, fresh.id)).resolves.not.toBeNull();
  });
});
