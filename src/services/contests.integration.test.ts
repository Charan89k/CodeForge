import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));

import { prisma } from "@/lib/db";

import { cancelContest, enterContest, getMyContests, getStandings } from "./contests";

const tag = `con${Date.now()}x${Math.floor(Math.random() * 1e6)}`;
const HOUR = 3_600_000;
let admin: { id: string; email: string };
let learner: string;
let rival: string;
let problemId = "";
const slugs = {
  ended: `${tag}-ended`,
  soon: `${tag}-soon`,
  cancel: `${tag}-cancel`,
};

const user = (name: string) =>
  prisma.user.create({
    data: { email: `${name}-${tag}@techepitome.test` },
    select: { id: true, email: true },
  });

async function contest(slug: string, startOffset: number, endOffset: number) {
  await prisma.contest.create({
    data: {
      slug,
      title: slug,
      description: "Fixture",
      startsAt: new Date(Date.now() + startOffset),
      endsAt: new Date(Date.now() + endOffset),
      createdById: admin.id,
      problems: { create: [{ problemId, order: 1, points: 100 }] },
    },
  });
}

beforeAll(async () => {
  admin = await user("admin");
  learner = (await user("learner")).id;
  rival = (await user("rival")).id;
  problemId = (
    await prisma.problem.findFirstOrThrow({
      where: { status: "PUBLISHED" },
      select: { id: true },
    })
  ).id;

  await contest(slugs.ended, -3 * HOUR, -HOUR);
  await contest(slugs.soon, HOUR, 2 * HOUR);
  await contest(slugs.cancel, 3 * HOUR, 4 * HOUR);

  const ended = await prisma.contest.findUniqueOrThrow({
    where: { slug: slugs.ended },
  });
  await prisma.contestEntry.createMany({
    data: [
      { contestId: ended.id, userId: learner },
      { contestId: ended.id, userId: rival },
    ],
  });
  await prisma.submission.create({
    data: {
      userId: learner,
      problemId,
      language: "PYTHON",
      code: "fixture",
      status: "ACCEPTED",
      isRun: false,
      createdAt: new Date(Date.now() - 2 * HOUR),
    },
  });
});

afterAll(async () => {
  await prisma.auditLog.deleteMany({ where: { actorId: admin.id } });
  await prisma.contest.deleteMany({ where: { slug: { startsWith: tag } } });
  await prisma.submission.deleteMany({ where: { userId: learner } });
  await prisma.user.deleteMany({ where: { id: { in: [admin.id, learner, rival] } } });
});

describe("getStandings", () => {
  it("ranks every entrant of a large contest, including the last one read", async () => {
    const crowd = Array.from(
      { length: 2050 },
      (_, i) => `${tag}-u${String(i).padStart(4, "0")}`
    );
    await prisma.user.createMany({
      data: crowd.map((id) => ({ id, email: `${id}@techepitome.test` })),
    });
    try {
      const ended = await prisma.contest.findUniqueOrThrow({
        where: { slug: slugs.ended },
        include: { problems: true },
      });
      await prisma.contestEntry.createMany({
        data: crowd.map((userId) => ({ contestId: ended.id, userId })),
      });
      const last = crowd[crowd.length - 1]!;
      await prisma.submission.create({
        data: {
          userId: last,
          problemId,
          language: "PYTHON",
          code: "fixture",
          status: "ACCEPTED",
          isRun: false,
          createdAt: new Date(ended.startsAt.getTime() + 60_000),
        },
      });

      const standings = await getStandings(ended);

      expect(standings).toHaveLength(crowd.length + 2);
      expect(standings[0]).toMatchObject({ userId: last, rank: 1, solved: 1 });
    } finally {
      await prisma.user.deleteMany({ where: { id: { in: crowd } } });
    }
  });
});

describe("getMyContests", () => {
  it("shows a finished contest's result and an upcoming one, for this learner only", async () => {
    await enterContest(slugs.soon, learner);

    const mine = await getMyContests(learner);

    expect(mine.map((c) => [c.slug, c.phase])).toEqual([
      [slugs.soon, "upcoming"],
      [slugs.ended, "ended"],
    ]);
    expect(mine[1]).toMatchObject({ rank: 1, entrants: 2, solved: 1, score: 100 });
    const theirs = await getMyContests(rival);
    expect(theirs).toEqual([
      expect.objectContaining({ slug: slugs.ended, rank: 2, solved: 0 }),
    ]);
    await expect(getMyContests(admin.id)).resolves.toEqual([]);
  });
});

describe("cancelContest", () => {
  it("removes an upcoming contest, with its entries, and records who did it", async () => {
    await enterContest(slugs.cancel, rival);

    await expect(cancelContest(admin, slugs.cancel)).resolves.toBe("cancelled");

    await expect(
      prisma.contest.findUnique({ where: { slug: slugs.cancel } })
    ).resolves.toBeNull();
    await expect(
      prisma.auditLog.count({
        where: { actorId: admin.id, action: "contest.cancelled" },
      })
    ).resolves.toBe(1);
  });

  it("refuses once a contest has started, and reports a missing one", async () => {
    await expect(cancelContest(admin, slugs.ended)).resolves.toBe("started");
    await expect(
      prisma.contest.findUnique({ where: { slug: slugs.ended } })
    ).resolves.not.toBeNull();
    await expect(cancelContest(admin, `${tag}-nope`)).resolves.toBe("missing");
  });
});
