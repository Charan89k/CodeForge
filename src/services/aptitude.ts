import "server-only";

import { z } from "zod";

import { APTITUDE_TOPICS, gradeAptitude, type AptitudeResult } from "@/data/aptitude";
import type { Difficulty } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";

const SET_SIZE = 20;
/** A topic needs this many answered questions before it can be called weak. */
export const WEAK_TOPIC_MIN_QUESTIONS = 5;
/** Below this share correct, a topic counts as weak. Shown on the page. */
export const WEAK_TOPIC_BELOW_PERCENT = 70;
const MAX_SECONDS = 4 * 60 * 60;

type Filter = { topic: string; difficulty: Difficulty | null };

const publishedIn = ({ topic, difficulty }: Filter) => ({
  topic,
  status: "PUBLISHED" as const,
  ...(difficulty ? { difficulty } : {}),
});

/** One set, without answers or explanations: this result goes to the browser. */
export async function getAptitudeSet(filter: Filter) {
  return prisma.aptitudeQuestion.findMany({
    where: publishedIn(filter),
    orderBy: { slug: "asc" },
    take: SET_SIZE,
    select: { id: true, prompt: true, options: true, difficulty: true },
  });
}

export const submissionSchema = z.object({
  // The questions the page showed, so a question published mid-set cannot shift the grading.
  ids: z.array(z.string().max(60)).min(1).max(SET_SIZE),
  answers: z.record(z.string().max(60), z.number().int().min(0).max(8)),
  seconds: z.number().int().min(0).max(MAX_SECONDS).nullable(),
});

/**
 * Grades on the server against the same set the page was shown. Only a
 * signed-in learner's result is kept, and only for them.
 */
export async function submitAptitudeSet(
  userId: string | null,
  filter: Filter,
  submission: z.infer<typeof submissionSchema>
): Promise<AptitudeResult | null> {
  if (!APTITUDE_TOPICS.some((topic) => topic.key === filter.topic)) return null;
  const questions = await prisma.aptitudeQuestion.findMany({
    where: { ...publishedIn(filter), id: { in: submission.ids } },
    orderBy: { slug: "asc" },
    select: { id: true, answer: true, explanation: true },
  });
  if (questions.length === 0) return null;

  const result = gradeAptitude(questions, submission.answers);
  if (userId) {
    await prisma.aptitudeAttempt.create({
      data: {
        userId,
        topic: filter.topic,
        correct: result.correct,
        total: result.total,
        timed: submission.seconds !== null,
        seconds: submission.seconds,
      },
    });
  }
  return result;
}

export type TopicPerformance = {
  topic: string;
  title: string;
  sets: number;
  correct: number;
  total: number;
  percent: number;
  weak: boolean;
};

/** Per-topic totals from this learner's own sets, weakest first. */
export async function getAptitudePerformance(
  userId: string
): Promise<TopicPerformance[]> {
  const rows = await prisma.aptitudeAttempt.groupBy({
    by: ["topic"],
    where: { userId },
    _count: { _all: true },
    _sum: { correct: true, total: true },
  });
  return rows
    .map((row) => {
      const correct = row._sum.correct ?? 0;
      const total = row._sum.total ?? 0;
      const percent = total > 0 ? Math.round((correct / total) * 100) : 0;
      return {
        topic: row.topic,
        title: APTITUDE_TOPICS.find((t) => t.key === row.topic)?.title ?? row.topic,
        sets: row._count._all,
        correct,
        total,
        percent,
        weak: total >= WEAK_TOPIC_MIN_QUESTIONS && percent < WEAK_TOPIC_BELOW_PERCENT,
      };
    })
    .sort((a, b) => a.percent - b.percent);
}

export async function listRecentAptitudeSets(userId: string) {
  return prisma.aptitudeAttempt.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: {
      id: true,
      topic: true,
      correct: true,
      total: true,
      timed: true,
      seconds: true,
      createdAt: true,
    },
  });
}

/* ---- Authoring: admin only, checked by the actions that call these. ---- */

type Admin = { id: string; email: string };

export class AptitudeReviewError extends Error {}

export const questionInputSchema = z
  .object({
    topic: z.enum(APTITUDE_TOPICS.map((t) => t.key) as [string, ...string[]]),
    difficulty: z.enum(["EASY", "MEDIUM", "HARD"]),
    prompt: z.string().trim().min(5).max(1000),
    /** One option per line, with a leading * on the correct one. */
    optionLines: z.string().max(2000),
    explanation: z.string().trim().min(5).max(2000),
    source: z.string().trim().min(2).max(200),
  })
  .transform(({ optionLines, ...rest }, context) => {
    const lines = optionLines
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    const marked = lines.filter((line) => line.startsWith("*"));
    const options = lines.map((line) => line.replace(/^\*\s*/, ""));
    if (
      lines.length < 2 ||
      lines.length > 8 ||
      marked.length !== 1 ||
      new Set(options).size !== options.length ||
      options.some((option) => !option)
    ) {
      context.addIssue({
        code: "custom",
        message: "Enter 2 to 8 different options, with * on the one correct answer.",
      });
      return z.NEVER;
    }
    return { ...rest, options, answer: lines.indexOf(marked[0]!) };
  });

const audit = (admin: Admin, action: string, id: string, summary: string) =>
  prisma.auditLog.create({
    data: {
      actorId: admin.id,
      actorEmail: admin.email,
      action,
      entity: "aptitude_question",
      entityId: id,
      summary,
    },
  });

export async function createAptitudeQuestion(
  admin: Admin,
  input: z.infer<typeof questionInputSchema>
): Promise<string> {
  const question = await prisma.aptitudeQuestion.create({
    data: {
      ...input,
      slug: `${input.topic}-${crypto.randomUUID()}`,
      authorId: admin.id,
    },
    select: { id: true },
  });
  await audit(admin, "aptitude.created", question.id, "Drafted an aptitude question");
  return question.id;
}

/** A second admin must review: an author can never publish their own question. */
export async function publishAptitudeQuestion(admin: Admin, id: string): Promise<void> {
  const question = await prisma.aptitudeQuestion.findUnique({
    where: { id },
    select: { authorId: true, status: true },
  });
  if (!question || question.status !== "DRAFT") {
    throw new AptitudeReviewError("That question is not waiting for review.");
  }
  if (question.authorId === admin.id) {
    throw new AptitudeReviewError("A different admin must review your own question.");
  }
  // Still a draft when written, so a concurrent archive is never undone.
  const { count } = await prisma.aptitudeQuestion.updateMany({
    where: { id, status: "DRAFT" },
    data: { status: "PUBLISHED", reviewedById: admin.id },
  });
  if (count === 0)
    throw new AptitudeReviewError("That question is not waiting for review.");
  await audit(admin, "aptitude.published", id, "Published an aptitude question");
}

export async function archiveAptitudeQuestion(admin: Admin, id: string): Promise<void> {
  await prisma.aptitudeQuestion.update({
    where: { id },
    data: { status: "ARCHIVED" },
  });
  await audit(admin, "aptitude.archived", id, "Archived an aptitude question");
}

export async function listAptitudeForAdmin() {
  const drafts = await prisma.aptitudeQuestion.findMany({
    where: { status: "DRAFT" },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      topic: true,
      difficulty: true,
      prompt: true,
      options: true,
      answer: true,
      explanation: true,
      source: true,
      authorId: true,
    },
  });
  const rows = await prisma.aptitudeQuestion.groupBy({
    by: ["topic"],
    where: { status: "PUBLISHED" },
    _count: { _all: true },
  });
  const counts = Object.fromEntries(rows.map((row) => [row.topic, row._count._all]));
  return { drafts, counts };
}
