import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));

import { prisma } from "@/lib/db";

import {
  AptitudeReviewError,
  archiveAptitudeQuestion,
  createAptitudeQuestion,
  getAptitudePerformance,
  getAptitudeSet,
  publishAptitudeQuestion,
  questionInputSchema,
  submitAptitudeSet,
} from "./aptitude";

const tag = `apt${Date.now()}x${Math.floor(Math.random() * 1e6)}`;
const makeUser = (name: string) =>
  prisma.user.create({
    data: { email: `${name}-${tag}@techepitome.test`, role: "ADMIN" },
    select: { id: true, email: true },
  });
let author: { id: string; email: string };
let reviewer: { id: string; email: string };
let learner: { id: string; email: string };
const TOPIC = "verbal";

const input = (prompt: string) =>
  questionInputSchema.parse({
    topic: TOPIC,
    difficulty: "HARD",
    prompt,
    optionLines: "wrong\n* right\nalso wrong",
    explanation: "Because it is right.",
    source: "Original",
  });

beforeAll(async () => {
  [author, reviewer, learner] = await Promise.all([
    makeUser("author"),
    makeUser("reviewer"),
    makeUser("learner"),
  ]);
});

afterAll(async () => {
  await prisma.aptitudeQuestion.deleteMany({ where: { prompt: { contains: tag } } });
  await prisma.auditLog.deleteMany({
    where: { actorId: { in: [author.id, reviewer.id] } },
  });
  await prisma.user.deleteMany({
    where: { id: { in: [author.id, reviewer.id, learner.id] } },
  });
});

describe("the question form", () => {
  it("reads the marked option as the answer", () => {
    expect(input("Which is right?")).toMatchObject({
      options: ["wrong", "right", "also wrong"],
      answer: 1,
    });
  });

  it.each([
    ["no answer marked", "a\nb"],
    ["two answers marked", "*a\n*b"],
    ["one option", "*a"],
    ["duplicates", "*a\na"],
  ])("refuses %s", (_name, optionLines) => {
    expect(
      questionInputSchema.safeParse({
        topic: TOPIC,
        difficulty: "EASY",
        prompt: "A fair question",
        optionLines,
        explanation: "An explanation.",
        source: "Original",
      }).success
    ).toBe(false);
  });
});

describe("review and visibility", () => {
  it("keeps a draft from learners until a different admin publishes it", async () => {
    const prompt = `Draft ${tag}?`;
    const id = await createAptitudeQuestion(author, input(prompt));
    const shown = async () =>
      (await getAptitudeSet({ topic: TOPIC, difficulty: "HARD" })).some(
        (question) => question.id === id
      );

    expect(await shown()).toBe(false);
    await expect(publishAptitudeQuestion(author, id)).rejects.toBeInstanceOf(
      AptitudeReviewError
    );
    expect(await shown()).toBe(false);

    await publishAptitudeQuestion(reviewer, id);
    expect(await shown()).toBe(true);
    await expect(publishAptitudeQuestion(reviewer, id)).rejects.toBeInstanceOf(
      AptitudeReviewError
    );

    await archiveAptitudeQuestion(reviewer, id);
    expect(await shown()).toBe(false);
  });

  it("never sends the answer in a set", async () => {
    const [question] = await getAptitudeSet({ topic: TOPIC, difficulty: null });
    expect(Object.keys(question!).sort()).toEqual([
      "difficulty",
      "id",
      "options",
      "prompt",
    ]);
  });
});

describe("grading and performance", () => {
  const seeded = async (topic: string) =>
    prisma.aptitudeQuestion.findMany({
      where: { topic, status: "PUBLISHED" },
      orderBy: { slug: "asc" },
      select: { id: true, answer: true },
    });

  const shownIds = async (topic: string) =>
    (await getAptitudeSet({ topic, difficulty: null })).map((q) => q.id);

  it("refuses an unknown topic and keeps nothing for a visitor", async () => {
    expect(
      await submitAptitudeSet(
        null,
        { topic: "nope", difficulty: null },
        { ids: ["x"], answers: {}, seconds: null }
      )
    ).toBeNull();
    const result = await submitAptitudeSet(
      null,
      { topic: "logical", difficulty: null },
      { ids: await shownIds("logical"), answers: {}, seconds: null }
    );
    expect(result?.correct).toBe(0);
    await expect(
      prisma.aptitudeAttempt.count({ where: { userId: learner.id } })
    ).resolves.toBe(0);
  });

  it("marks a topic weak only with enough questions, for this learner alone", async () => {
    const questions = await seeded("logical");
    const right = Object.fromEntries(questions.map((q) => [q.id, q.answer]));
    await submitAptitudeSet(
      learner.id,
      { topic: "logical", difficulty: null },
      { ids: await shownIds("logical"), answers: right, seconds: 42 }
    );
    await submitAptitudeSet(
      learner.id,
      { topic: "quantitative", difficulty: null },
      { ids: await shownIds("quantitative"), answers: {}, seconds: null }
    );

    const performance = await getAptitudePerformance(learner.id);

    expect(performance.map((row) => [row.topic, row.percent, row.weak])).toEqual([
      ["quantitative", 0, true],
      ["logical", 100, false],
    ]);
    await expect(getAptitudePerformance(reviewer.id)).resolves.toEqual([]);
    const timed = await prisma.aptitudeAttempt.findFirstOrThrow({
      where: { userId: learner.id, topic: "logical" },
    });
    expect(timed).toMatchObject({ timed: true, seconds: 42 });
  });

  it("grades the questions shown, even if one is published mid-set", async () => {
    const ids = await shownIds(TOPIC);
    const late = await createAptitudeQuestion(author, input(`Late ${tag}?`));
    await publishAptitudeQuestion(reviewer, late);

    const result = await submitAptitudeSet(
      null,
      { topic: TOPIC, difficulty: null },
      { ids: [...ids, "not-a-question"], answers: {}, seconds: null }
    );

    expect(result?.total).toBe(ids.length);
    expect(result?.review.map((r) => r.id)).not.toContain(late);
  });
});
