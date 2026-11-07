import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { prisma } from "@/lib/db";
import { utcDayStart } from "@/lib/dates";
import { quizSubmissionSchema } from "@/lib/validation/quiz";
import {
  CHAPTER_XP,
  completeChapter,
  startChapter,
  uncompleteChapter,
} from "./learning-progress";
import { listNotes, NOTES_PER_PAGE } from "./library";
import { gradeQuiz } from "./quiz";
import { touchStudyDay } from "./study-days";

/**
 * Phase 3 learning rules, against the real database: completion is credited
 * exactly once (including under concurrent requests), quizzes are graded on
 * the server and earn XP once, streaks follow UTC days, and personal lists
 * are paginated and private.
 */

const SUFFIX = `${Date.now()}-${Math.floor(Math.random() * 100_000)}`;
const users: string[] = [];
let chapterIds: string[] = [];
let draftChapterId = "";

async function newUser(label: string): Promise<string> {
  const user = await prisma.user.create({
    data: { email: `lp-${label}-${SUFFIX}@techepitome.test`, name: label },
    select: { id: true },
  });
  users.push(user.id);
  return user.id;
}

async function counters(userId: string) {
  const [day, profile] = await Promise.all([
    prisma.studyDay.findUnique({
      where: { userId_day: { userId, day: utcDayStart(new Date()) } },
      select: { chapters: true, xp: true },
    }),
    prisma.profile.findUnique({ where: { userId }, select: { totalXp: true } }),
  ]);
  return {
    chapters: day?.chapters ?? 0,
    xp: day?.xp ?? 0,
    totalXp: profile?.totalXp ?? 0,
  };
}

beforeAll(async () => {
  const chapters = await prisma.chapter.findMany({
    where: { status: "PUBLISHED", section: { status: "PUBLISHED" } },
    orderBy: { id: "asc" },
    take: 3,
    select: { id: true, sectionId: true },
  });
  chapterIds = chapters.map((c) => c.id);
  const draft = await prisma.chapter.create({
    data: {
      sectionId: chapters[0]!.sectionId,
      slug: `draft-${SUFFIX}`,
      title: `Zzdraft secret chapter ${SUFFIX}`,
      status: "DRAFT",
    },
    select: { id: true },
  });
  draftChapterId = draft.id;
});

afterEach(() => {
  vi.useRealTimers();
});

afterAll(async () => {
  await prisma.chapter.deleteMany({ where: { id: draftChapterId } });
  await prisma.user.deleteMany({ where: { id: { in: users } } });
});

describe("chapter progress", () => {
  it("refuses to start or complete an unpublished or unknown chapter", async () => {
    const user = await newUser("draft");
    expect(await startChapter(user, draftChapterId)).toBe(false);
    expect(await startChapter(user, "does-not-exist")).toBe(false);
    expect(await completeChapter(user, draftChapterId)).toEqual({
      ok: false,
      error: "not_found",
    });
    expect(await prisma.userChapterProgress.count({ where: { userId: user } })).toBe(0);
  });

  it("starts once and never downgrades a completed chapter", async () => {
    const user = await newUser("start");
    const chapterId = chapterIds[0]!;
    await startChapter(user, chapterId);
    await startChapter(user, chapterId);
    await completeChapter(user, chapterId);
    await startChapter(user, chapterId);

    const rows = await prisma.userChapterProgress.findMany({ where: { userId: user } });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.status).toBe("COMPLETED");
  });

  it("credits a completion once, even after un-marking and re-marking", async () => {
    const user = await newUser("credit");
    const chapterId = chapterIds[1]!;

    expect(await completeChapter(user, chapterId, 120)).toEqual({
      ok: true,
      firstCompletion: true,
    });
    const once = await counters(user);
    expect(once).toEqual({ chapters: 1, xp: CHAPTER_XP, totalXp: CHAPTER_XP });

    expect(await completeChapter(user, chapterId)).toEqual({
      ok: true,
      firstCompletion: false,
    });
    await uncompleteChapter(user, chapterId);
    const reopened = await prisma.userChapterProgress.findFirstOrThrow({
      where: { userId: user, chapterId },
    });
    expect(reopened.status).toBe("IN_PROGRESS");
    expect(reopened.completedAt).not.toBeNull();

    await completeChapter(user, chapterId);
    expect(await counters(user)).toEqual(once);
  });

  it("credits exactly one of many concurrent completions", async () => {
    const user = await newUser("race");
    const chapterId = chapterIds[2]!;

    const results = await Promise.all(
      Array.from({ length: 6 }, () => completeChapter(user, chapterId, 30))
    );
    const firsts = results.filter((r) => r.ok && r.firstCompletion);
    expect(firsts).toHaveLength(1);
    expect(await prisma.userChapterProgress.count({ where: { userId: user } })).toBe(1);
    expect((await counters(user)).chapters).toBe(1);
  });
});

describe("quiz grading", () => {
  let quiz: { slug: string; questions: { id: string; answer: unknown }[] };

  beforeAll(async () => {
    quiz = await prisma.quiz.findFirstOrThrow({
      where: { status: "PUBLISHED", questions: { some: {} } },
      select: { slug: true, questions: { select: { id: true, answer: true } } },
    });
  });

  const correct = () =>
    Object.fromEntries(
      quiz.questions.map((q) => [q.id, q.answer as string | string[]])
    );

  it("scores on the server and stores only this quiz's answers", async () => {
    const user = await newUser("quiz");
    const submitted = { ...correct(), "not-a-question": "x" };

    const result = await gradeQuiz(user, quiz.slug, submitted);
    expect(result?.percent).toBe(100);
    expect(result?.passed).toBe(true);

    const attempt = await prisma.quizAttempt.findFirstOrThrow({
      where: { userId: user },
    });
    expect(Object.keys(attempt.answers as object).sort()).toEqual(
      quiz.questions.map((q) => q.id).sort()
    );
  });

  it("marks wrong and missing answers wrong", async () => {
    const user = await newUser("quiz-wrong");
    const result = await gradeQuiz(user, quiz.slug, {});
    expect(result?.score).toBe(0);
    expect(result?.passed).toBe(false);
    expect(result?.firstPass).toBe(false);
    expect(result?.graded.every((g) => !g.correct)).toBe(true);
  });

  it("returns null for an unknown quiz and rejects oversized submissions", async () => {
    const user = await newUser("quiz-none");
    expect(await gradeQuiz(user, `nope-${SUFFIX}`, {})).toBeNull();

    const tooMany = Object.fromEntries(
      Array.from({ length: 101 }, (_, i) => [`q${i}`, "a"])
    );
    expect(
      quizSubmissionSchema.safeParse({ quizSlug: quiz.slug, answers: tooMany }).success
    ).toBe(false);
    // A client-sent score is not part of the input at all.
    expect(
      quizSubmissionSchema.safeParse({ quizSlug: quiz.slug, answers: {}, score: 100 })
        .data
    ).not.toHaveProperty("score");
  });

  it("flags exactly one first pass across concurrent passing attempts", async () => {
    const user = await newUser("quiz-race");
    const results = await Promise.all(
      Array.from({ length: 4 }, () => gradeQuiz(user, quiz.slug, correct()))
    );
    expect(results.filter((r) => r?.firstPass)).toHaveLength(1);
    expect(await prisma.quizAttempt.count({ where: { userId: user } })).toBe(4);

    const later = await gradeQuiz(user, quiz.slug, correct());
    expect(later?.firstPass).toBe(false);
  });
});

describe("streaks", () => {
  it("counts consecutive UTC days, holds within a day and resets after a gap", async () => {
    const user = await newUser("streak");
    const streak = () =>
      prisma.profile.findUniqueOrThrow({
        where: { userId: user },
        select: { currentStreak: true, longestStreak: true },
      });
    const on = async (iso: string) => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date(iso));
      await touchStudyDay(user, { seconds: 0, chapters: 0, xp: 0 });
      vi.useRealTimers();
    };

    await on("2026-03-01T23:00:00Z");
    expect(await streak()).toEqual({ currentStreak: 1, longestStreak: 1 });
    await on("2026-03-02T00:30:00Z");
    await on("2026-03-02T22:00:00Z");
    expect(await streak()).toEqual({ currentStreak: 2, longestStreak: 2 });
    await on("2026-03-05T10:00:00Z");
    expect(await streak()).toEqual({ currentStreak: 1, longestStreak: 2 });
    expect(await prisma.studyDay.count({ where: { userId: user } })).toBe(3);
  });
});

describe("notes pagination and privacy", () => {
  it("pages a user's own notes without overlap and shows nobody else's", async () => {
    const owner = await newUser("notes");
    const other = await newUser("notes-other");
    await prisma.note.createMany({
      data: Array.from({ length: NOTES_PER_PAGE + 5 }, (_, i) => ({
        userId: owner,
        entityType: "CHAPTER" as const,
        entityId: chapterIds[0]!,
        body: `note ${i}`,
      })),
    });

    const first = await listNotes(owner, undefined, 1);
    const second = await listNotes(owner, undefined, 2);
    expect(first).toHaveLength(NOTES_PER_PAGE + 1);
    expect(second).toHaveLength(5);
    const shown = [...first.slice(0, NOTES_PER_PAGE), ...second].map((n) => n.id);
    expect(new Set(shown).size).toBe(NOTES_PER_PAGE + 5);
    expect(await listNotes(other)).toHaveLength(0);
  });
});
