import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import { utcDayStart } from "@/lib/dates";
import {
  getActivityCalendar,
  getCourseProgress,
  getOpenContests,
} from "./learner-activity";

const SUFFIX = `${Date.now()}-${Math.floor(Math.random() * 100_000)}`;
const HOUR = 3_600_000;

let learner = "";
let other = "";
let courseId = "";
let chapterIds: string[] = [];
const contestSlugs = ["ended", "soon", "live"].map((name) => `la-${name}-${SUFFIX}`);

async function makeUser(name: string): Promise<string> {
  const user = await prisma.user.create({
    data: { email: `la-${name}-${SUFFIX}@techepitome.test`, name },
    select: { id: true },
  });
  return user.id;
}

beforeAll(async () => {
  learner = await makeUser("learner");
  other = await makeUser("other");

  const course = await prisma.course.create({
    data: {
      slug: `la-course-${SUFFIX}`,
      title: "Activity course",
      description: "Fixture",
      track: "DSA",
      status: "PUBLISHED",
      sections: {
        create: {
          slug: "only",
          title: "Only",
          order: 1,
          status: "PUBLISHED",
          chapters: {
            create: [
              { slug: "one", title: "One", order: 1, status: "PUBLISHED", content: [] },
              { slug: "two", title: "Two", order: 2, status: "PUBLISHED", content: [] },
              { slug: "draft", title: "Draft", order: 3, status: "DRAFT", content: [] },
            ],
          },
        },
      },
    },
    select: {
      id: true,
      sections: {
        select: { chapters: { orderBy: { order: "asc" }, select: { id: true } } },
      },
    },
  });
  courseId = course.id;
  chapterIds = course.sections[0]!.chapters.map((chapter) => chapter.id);

  const now = Date.now();
  await prisma.contest.createMany({
    data: [
      { slug: contestSlugs[0]!, startsAt: now - 3 * HOUR, endsAt: now - 2 * HOUR },
      { slug: contestSlugs[1]!, startsAt: now + 2 * HOUR, endsAt: now + 3 * HOUR },
      { slug: contestSlugs[2]!, startsAt: now - HOUR, endsAt: now + HOUR },
    ].map(({ slug, startsAt, endsAt }) => ({
      slug,
      title: slug,
      description: "Fixture",
      startsAt: new Date(startsAt),
      endsAt: new Date(endsAt),
      createdById: learner,
    })),
  });
});

afterAll(async () => {
  await prisma.contest.deleteMany({ where: { slug: { in: contestSlugs } } });
  await prisma.course.delete({ where: { id: courseId } });
  await prisma.user.deleteMany({ where: { id: { in: [learner, other] } } });
});

describe("getActivityCalendar", () => {
  it("reads only the learner's own days", async () => {
    const day = utcDayStart(new Date());
    await prisma.studyDay.create({
      data: { userId: other, day, solved: 3, chapters: 2 },
    });
    await prisma.studyDay.create({
      data: { userId: learner, day, seconds: 60, solved: 1 },
    });

    const calendar = await getActivityCalendar(learner);

    expect(calendar).toMatchObject({ activeDays: 1, solved: 1, chapters: 0 });
  });
});

describe("getCourseProgress", () => {
  it("is empty before anything is opened", async () => {
    await expect(getCourseProgress(other)).resolves.toEqual([]);
  });

  it("counts published chapters and only this learner's completions", async () => {
    await prisma.userChapterProgress.create({
      data: {
        userId: learner,
        chapterId: chapterIds[0]!,
        status: "COMPLETED",
        percent: 100,
      },
    });
    await prisma.userChapterProgress.create({
      data: {
        userId: learner,
        chapterId: chapterIds[1]!,
        status: "IN_PROGRESS",
        percent: 20,
      },
    });

    const courses = await getCourseProgress(learner);

    expect(courses).toEqual([
      expect.objectContaining({ id: courseId, completed: 1, total: 2 }),
    ]);
    await expect(getCourseProgress(other)).resolves.toEqual([]);
  });

  it("drops a course that is no longer published", async () => {
    await prisma.course.update({ where: { id: courseId }, data: { status: "DRAFT" } });

    await expect(getCourseProgress(learner)).resolves.toEqual([]);

    await prisma.course.update({
      where: { id: courseId },
      data: { status: "PUBLISHED" },
    });
  });
});

describe("getOpenContests", () => {
  it("leaves out ended contests and labels the running one", async () => {
    // Other tests' contests share this table, so read past the dashboard's three.
    const contests = await getOpenContests(new Date(), 1000);
    const mine = contests.filter((contest) => contestSlugs.includes(contest.slug));

    expect(mine.map((contest) => contest.phase)).toEqual(["live", "upcoming"]);
  });
});
