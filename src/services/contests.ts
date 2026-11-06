import "server-only";

import { z } from "zod";

import { prisma } from "@/lib/db";

import { computeStandings, contestPhase, type ContestPhase } from "./contest-scoring";

export { computeStandings, contestPhase } from "./contest-scoring";

export async function listContests() {
  return prisma.contest.findMany({
    orderBy: { startsAt: "desc" },
    take: 100,
    select: {
      slug: true,
      title: true,
      startsAt: true,
      endsAt: true,
      _count: { select: { entries: true, problems: true } },
    },
  });
}

export async function getContest(slug: string) {
  return prisma.contest.findUnique({
    where: { slug },
    include: {
      problems: {
        orderBy: { order: "asc" },
        include: {
          problem: { select: { id: true, slug: true, title: true, difficulty: true } },
        },
      },
    },
  });
}

export async function isEntered(contestId: string, userId: string): Promise<boolean> {
  const row = await prisma.contestEntry.findUnique({
    where: { contestId_userId: { contestId, userId } },
    select: { userId: true },
  });
  return Boolean(row);
}

/** Entering twice is harmless, and entering a finished contest is refused. */
export async function enterContest(slug: string, userId: string, now = new Date()) {
  const contest = await prisma.contest.findUnique({
    where: { slug },
    select: { id: true, startsAt: true, endsAt: true },
  });
  if (!contest || contestPhase(contest, now) === "ended") return false;
  await prisma.contestEntry.createMany({
    data: [{ contestId: contest.id, userId }],
    skipDuplicates: true,
  });
  return true;
}

const STANDINGS_PAGE = 1000;

const entryPage = (contestId: string, after: string | null) =>
  prisma.contestEntry.findMany({
    where: { contestId, ...(after ? { userId: { gt: after } } : {}) },
    orderBy: { userId: "asc" },
    take: STANDINGS_PAGE,
    select: {
      userId: true,
      user: { select: { name: true, profile: { select: { username: true } } } },
    },
  });

/** Standings use only scored submissions inside the window, from entrants. */
export async function getStandings(contest: {
  id: string;
  startsAt: Date;
  endsAt: Date;
  penaltyMinutes: number;
  problems: { problemId: string; points: number }[];
}) {
  // Every entrant is ranked, read in pages so no single query grows with the contest.
  const entries: Awaited<ReturnType<typeof entryPage>> = [];
  for (let after: string | null = null; ;) {
    const page = await entryPage(contest.id, after);
    entries.push(...page);
    if (page.length < STANDINGS_PAGE) break;
    after = page[page.length - 1]!.userId;
  }
  const submissions = [];
  for (let i = 0; i < entries.length; i += STANDINGS_PAGE) {
    submissions.push(
      ...(await prisma.submission.findMany({
        where: {
          userId: { in: entries.slice(i, i + STANDINGS_PAGE).map((e) => e.userId) },
          problemId: { in: contest.problems.map((p) => p.problemId) },
          isRun: false,
          createdAt: { gte: contest.startsAt, lte: contest.endsAt },
        },
        orderBy: { createdAt: "asc" },
        select: { userId: true, problemId: true, status: true, createdAt: true },
      }))
    );
  }
  // Each entrant's submissions sit in one page, so their order is already right.
  const names = new Map(
    entries.map((e) => [e.userId, e.user.profile?.username ?? e.user.name ?? "Entrant"])
  );
  return computeStandings(
    contest,
    entries.map((e) => e.userId),
    submissions
  ).map((row) => ({
    ...row,
    name: names.get(row.userId) ?? "Entrant",
  }));
}

export type MyContest = {
  slug: string;
  title: string;
  startsAt: Date;
  phase: ContestPhase;
  rank: number | null;
  entrants: number;
  solved: number;
  score: number;
};

const MY_CONTESTS_SHOWN = 10;

/** This learner's own contests, newest first, with where they finished. */
export async function getMyContests(
  userId: string,
  now = new Date()
): Promise<MyContest[]> {
  const entries = await prisma.contestEntry.findMany({
    where: { userId },
    orderBy: { contest: { startsAt: "desc" } },
    take: MY_CONTESTS_SHOWN,
    select: {
      contest: {
        select: {
          id: true,
          slug: true,
          title: true,
          startsAt: true,
          endsAt: true,
          penaltyMinutes: true,
          problems: { select: { problemId: true, points: true } },
        },
      },
    },
  });

  // Sequential: each one reads standings, which is two queries.
  const mine: MyContest[] = [];
  for (const { contest } of entries) {
    const standings = await getStandings(contest);
    const row = standings.find((entry) => entry.userId === userId);
    mine.push({
      slug: contest.slug,
      title: contest.title,
      startsAt: contest.startsAt,
      phase: contestPhase(contest, now),
      rank: row?.rank ?? null,
      entrants: standings.length,
      solved: row?.solved ?? 0,
      score: row?.score ?? 0,
    });
  }
  return mine;
}

export type CancelContestResult = "cancelled" | "started" | "missing";

/** Only before it starts: afterwards entrants' results depend on it. */
export async function cancelContest(
  admin: { id: string; email: string },
  slug: string,
  now = new Date()
): Promise<CancelContestResult> {
  const contest = await prisma.contest.findUnique({
    where: { slug },
    select: { id: true, startsAt: true, endsAt: true },
  });
  if (!contest) return "missing";
  if (contestPhase(contest, now) !== "upcoming") return "started";
  return prisma.$transaction(async (tx) => {
    // Re-checked in the delete itself, so a contest that starts meanwhile survives.
    const { count } = await tx.contest.deleteMany({
      where: { id: contest.id, startsAt: { gt: new Date() } },
    });
    if (count === 0) return "started";
    await tx.auditLog.create({
      data: {
        actorId: admin.id,
        actorEmail: admin.email,
        action: "contest.cancelled",
        entity: "contest",
        entityId: contest.id,
        summary: `Cancelled contest ${slug}`,
      },
    });
    return "cancelled";
  });
}

export const contestInputSchema = z
  .object({
    title: z.string().trim().min(3).max(120),
    slug: z
      .string()
      .trim()
      .regex(/^[a-z0-9](?:[a-z0-9-]{1,60}[a-z0-9])$/),
    description: z.string().trim().min(1).max(2000),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
    problemNumbers: z.array(z.number().int().positive()).min(1).max(12),
  })
  .refine((v) => v.endsAt > v.startsAt, {
    message: "A contest must end after it starts.",
  })
  .refine((v) => new Set(v.problemNumbers).size === v.problemNumbers.length, {
    message: "A problem can appear only once.",
  });

export type CreateContestResult = "created" | "slug_taken" | "unknown_problem";

export async function createContest(
  admin: { id: string; email: string; role: string },
  input: z.infer<typeof contestInputSchema>
): Promise<CreateContestResult> {
  if (admin.role !== "ADMIN")
    throw new Error("Only a platform admin can create a contest.");
  const problems = await prisma.problem.findMany({
    where: { number: { in: input.problemNumbers }, status: "PUBLISHED" },
    select: { id: true, number: true },
  });
  if (problems.length !== input.problemNumbers.length) return "unknown_problem";
  const idFor = new Map(problems.map((p) => [p.number, p.id]));

  const taken = await prisma.contest.findUnique({
    where: { slug: input.slug },
    select: { id: true },
  });
  if (taken) return "slug_taken";

  await prisma.$transaction(async (tx) => {
    const contest = await tx.contest.create({
      data: {
        slug: input.slug,
        title: input.title,
        description: input.description,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        createdById: admin.id,
        problems: {
          create: input.problemNumbers.map((number, order) => ({
            problemId: idFor.get(number)!,
            order,
          })),
        },
      },
      select: { id: true },
    });
    await tx.auditLog.create({
      data: {
        actorId: admin.id,
        actorEmail: admin.email,
        action: "contest.created",
        entity: "contest",
        entityId: contest.id,
        summary: `Created contest ${input.slug}`,
      },
    });
  });
  return "created";
}
