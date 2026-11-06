import "server-only";

import {
  buildActivityCalendar,
  firstActivityDay,
  type ActivityCalendar,
} from "@/lib/activity-calendar";
import { prisma } from "@/lib/db";
import { courseHref } from "@/lib/tracks";
import { contestPhase, type ContestPhase } from "@/services/contest-scoring";
import { getDailyChallenge, getDailyProgress } from "@/services/daily";

export type CourseProgress = {
  id: string;
  title: string;
  href: string;
  completed: number;
  total: number;
};

export type ContestPreview = {
  slug: string;
  title: string;
  startsAt: Date;
  phase: ContestPhase;
};

const COURSES_SHOWN = 4;
const CONTESTS_SHOWN = 3;

/** The year of `StudyDay` rows belonging to this learner. */
export async function getActivityCalendar(
  userId: string,
  now = new Date()
): Promise<ActivityCalendar> {
  const rows = await prisma.studyDay.findMany({
    where: { userId, day: { gte: firstActivityDay(now) } },
    select: { day: true, seconds: true, solved: true, chapters: true },
  });
  return buildActivityCalendar(rows, now);
}

/**
 * Courses this learner has opened, latest first. Totals count published
 * chapters only, so a draft never changes anybody's percentage.
 */
export async function getCourseProgress(userId: string): Promise<CourseProgress[]> {
  const touched = await prisma.userChapterProgress.findMany({
    where: { userId, chapter: { status: "PUBLISHED" } },
    orderBy: { updatedAt: "desc" },
    select: {
      chapterId: true,
      status: true,
      chapter: { select: { section: { select: { courseId: true } } } },
    },
  });
  const courseIds = [...new Set(touched.map((row) => row.chapter.section.courseId))];
  if (courseIds.length === 0) return [];

  const courses = await prisma.course.findMany({
    where: { id: { in: courseIds }, status: "PUBLISHED" },
    select: {
      id: true,
      slug: true,
      title: true,
      track: true,
      sections: {
        where: { status: "PUBLISHED" },
        select: { chapters: { where: { status: "PUBLISHED" }, select: { id: true } } },
      },
    },
  });
  const done = new Set(
    touched.filter((row) => row.status === "COMPLETED").map((row) => row.chapterId)
  );
  const byId = new Map(courses.map((course) => [course.id, course]));

  return courseIds
    .flatMap((id) => byId.get(id) ?? [])
    .slice(0, COURSES_SHOWN)
    .map((course) => {
      const chapterIds = course.sections.flatMap((s) => s.chapters.map((c) => c.id));
      return {
        id: course.id,
        title: course.title,
        href: courseHref(course.track, course.slug),
        completed: chapterIds.filter((id) => done.has(id)).length,
        total: chapterIds.length,
      };
    });
}

/** Contests still to come or running now, soonest first. */
export async function getOpenContests(now = new Date()): Promise<ContestPreview[]> {
  const contests = await prisma.contest.findMany({
    where: { endsAt: { gte: now } },
    orderBy: { startsAt: "asc" },
    take: CONTESTS_SHOWN,
    select: { slug: true, title: true, startsAt: true, endsAt: true },
  });
  return contests.map((contest) => ({
    slug: contest.slug,
    title: contest.title,
    startsAt: contest.startsAt,
    phase: contestPhase(contest, now),
  }));
}

export async function getDailyForLearner(userId: string, now = new Date()) {
  const challenge = await getDailyChallenge(now);
  if (!challenge) return null;
  const progress = await getDailyProgress(userId, now);
  return { problem: challenge.problem, ...progress };
}
