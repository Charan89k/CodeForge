import "server-only";

import { cache } from "react";

import type { Difficulty, Track } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { chapterHref } from "@/lib/tracks";

/**
 * Curriculum reads.
 *
 * Every function takes an optional `userId` and folds progress in at the
 * query level rather than making the page issue a second round of per-item
 * lookups. Unpublished content is filtered here, once, so no page can leak a
 * draft by forgetting a `where` clause.
 */

export type ChapterSummary = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  readingMinutes: number;
  order: number;
  status: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";
  percent: number;
  problemCount: number;
};

export type SectionSummary = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  order: number;
  chapters: ChapterSummary[];
  completedChapters: number;
  totalChapters: number;
};

export type CourseSummary = {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  description: string;
  track: Track;
  icon: string | null;
  estimatedHours: number;
  totalChapters: number;
  completedChapters: number;
};

export type CourseDetail = CourseSummary & {
  level: "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
  outcomes: string[];
  prerequisites: string[];
  license: string | null;
  attribution: string | null;
  sections: SectionSummary[];
};

/** Published courses for a track, with the signed-in user's progress folded in. */
export const listCourses = cache(
  async (track: Track, userId?: string): Promise<CourseSummary[]> => {
    const courses = await prisma.course.findMany({
      where: { track, status: "PUBLISHED" },
      orderBy: { order: "asc" },
      select: {
        id: true,
        slug: true,
        title: true,
        subtitle: true,
        description: true,
        track: true,
        icon: true,
        estimatedHours: true,
        sections: {
          where: { status: "PUBLISHED" },
          select: {
            chapters: {
              where: { status: "PUBLISHED" },
              select: { id: true },
            },
          },
        },
      },
    });

    const chapterIds = courses.flatMap((course) =>
      course.sections.flatMap((section) => section.chapters.map((c) => c.id))
    );

    const completed = userId
      ? await prisma.userChapterProgress.findMany({
          where: { userId, status: "COMPLETED", chapterId: { in: chapterIds } },
          select: { chapterId: true },
        })
      : [];
    const completedSet = new Set(completed.map((row) => row.chapterId));

    return courses.map((course) => {
      const ids = course.sections.flatMap((s) => s.chapters.map((c) => c.id));
      return {
        id: course.id,
        slug: course.slug,
        title: course.title,
        subtitle: course.subtitle,
        description: course.description,
        track: course.track,
        icon: course.icon,
        estimatedHours: course.estimatedHours,
        totalChapters: ids.length,
        completedChapters: ids.filter((id) => completedSet.has(id)).length,
      };
    });
  }
);

/** A course with all its sections and chapters. Null when not published. */
export const getCourse = cache(
  async (slug: string, userId?: string): Promise<CourseDetail | null> => {
    const course = await prisma.course.findFirst({
      where: { slug, status: "PUBLISHED" },
      select: {
        level: true,
        outcomes: true,
        prerequisites: true,
        license: true,
        attribution: true,
        id: true,
        slug: true,
        title: true,
        subtitle: true,
        description: true,
        track: true,
        icon: true,
        estimatedHours: true,
        sections: {
          where: { status: "PUBLISHED" },
          orderBy: { order: "asc" },
          select: {
            id: true,
            slug: true,
            title: true,
            summary: true,
            order: true,
            chapters: {
              where: { status: "PUBLISHED" },
              orderBy: { order: "asc" },
              select: {
                id: true,
                slug: true,
                title: true,
                summary: true,
                readingMinutes: true,
                order: true,
                _count: { select: { problems: true } },
              },
            },
          },
        },
      },
    });

    if (!course) return null;

    const chapterIds = course.sections.flatMap((s) => s.chapters.map((c) => c.id));

    const progressRows = userId
      ? await prisma.userChapterProgress.findMany({
          where: { userId, chapterId: { in: chapterIds } },
          select: { chapterId: true, status: true, percent: true },
        })
      : [];
    const progressByChapter = new Map(progressRows.map((row) => [row.chapterId, row]));

    const sections: SectionSummary[] = course.sections.map((section) => {
      const chapters: ChapterSummary[] = section.chapters.map((chapter) => {
        const progress = progressByChapter.get(chapter.id);
        return {
          id: chapter.id,
          slug: chapter.slug,
          title: chapter.title,
          summary: chapter.summary,
          readingMinutes: chapter.readingMinutes,
          order: chapter.order,
          status: progress?.status ?? "NOT_STARTED",
          percent: progress?.percent ?? 0,
          problemCount: chapter._count.problems,
        };
      });

      return {
        id: section.id,
        slug: section.slug,
        title: section.title,
        summary: section.summary,
        order: section.order,
        chapters,
        completedChapters: chapters.filter((c) => c.status === "COMPLETED").length,
        totalChapters: chapters.length,
      };
    });

    const allChapters = sections.flatMap((s) => s.chapters);

    return {
      id: course.id,
      slug: course.slug,
      title: course.title,
      subtitle: course.subtitle,
      description: course.description,
      track: course.track,
      icon: course.icon,
      level: course.level,
      outcomes: course.outcomes,
      prerequisites: course.prerequisites,
      license: course.license,
      attribution: course.attribution,
      estimatedHours: course.estimatedHours,
      totalChapters: allChapters.length,
      completedChapters: allChapters.filter((c) => c.status === "COMPLETED").length,
      sections,
    };
  }
);

export type ChapterNeighbour = {
  title: string;
  href: string;
} | null;

export type ChapterDetail = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  difficulty: Difficulty;
  content: unknown;
  objectives: string[];
  keyTakeaways: string[];
  readingMinutes: number;
  section: { id: string; slug: string; title: string };
  course: { id: string; slug: string; title: string; track: Track };
  patterns: { id: string; slug: string; name: string; tagline: string }[];
  problems: {
    id: string;
    number: number;
    slug: string;
    title: string;
    difficulty: "EASY" | "MEDIUM" | "HARD";
  }[];
  quizSlugs: string[];
  progress: { status: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED"; percent: number };
  previous: ChapterNeighbour;
  next: ChapterNeighbour;
};

export const getChapter = cache(
  async (
    courseSlug: string,
    sectionSlug: string,
    chapterSlug: string,
    userId?: string
  ): Promise<ChapterDetail | null> => {
    const chapter = await prisma.chapter.findFirst({
      where: {
        slug: chapterSlug,
        status: "PUBLISHED",
        section: {
          slug: sectionSlug,
          status: "PUBLISHED",
          course: { slug: courseSlug, status: "PUBLISHED" },
        },
      },
      select: {
        id: true,
        slug: true,
        title: true,
        summary: true,
        difficulty: true,
        content: true,
        objectives: true,
        keyTakeaways: true,
        readingMinutes: true,
        order: true,
        section: {
          select: {
            id: true,
            slug: true,
            title: true,
            order: true,
            course: { select: { id: true, slug: true, title: true, track: true } },
          },
        },
        patterns: {
          select: {
            pattern: {
              select: { id: true, slug: true, name: true, tagline: true },
            },
          },
        },
        problems: {
          orderBy: { order: "asc" },
          select: {
            problem: {
              select: {
                id: true,
                number: true,
                slug: true,
                title: true,
                difficulty: true,
                status: true,
              },
            },
          },
        },
        quizzes: {
          where: { status: "PUBLISHED" },
          select: { slug: true },
        },
      },
    });

    if (!chapter) return null;

    const progress = userId
      ? await prisma.userChapterProgress.findUnique({
          where: { userId_chapterId: { userId, chapterId: chapter.id } },
          select: { status: true, percent: true },
        })
      : null;

    const { previous, next } = await findNeighbours(
      chapter.section.course.id,
      chapter.section.order,
      chapter.order,
      courseSlug,
      chapter.section.course.track
    );

    return {
      id: chapter.id,
      slug: chapter.slug,
      title: chapter.title,
      summary: chapter.summary,
      difficulty: chapter.difficulty,
      content: chapter.content,
      objectives: chapter.objectives,
      keyTakeaways: chapter.keyTakeaways,
      readingMinutes: chapter.readingMinutes,
      section: {
        id: chapter.section.id,
        slug: chapter.section.slug,
        title: chapter.section.title,
      },
      course: chapter.section.course,
      patterns: chapter.patterns.map((p) => p.pattern),
      problems: chapter.problems
        .filter((p) => p.problem.status === "PUBLISHED")
        .map((p) => ({
          id: p.problem.id,
          number: p.problem.number,
          slug: p.problem.slug,
          title: p.problem.title,
          difficulty: p.problem.difficulty,
        })),
      quizSlugs: chapter.quizzes.map((q) => q.slug),
      progress: {
        status: progress?.status ?? "NOT_STARTED",
        percent: progress?.percent ?? 0,
      },
      previous,
      next,
    };
  }
);

/**
 * Previous and next chapter in reading order across the whole course.
 *
 * Ordering is (section.order, chapter.order), so this walks section
 * boundaries correctly instead of stopping at the end of a section.
 */
async function findNeighbours(
  courseId: string,
  sectionOrder: number,
  chapterOrder: number,
  courseSlug: string,
  track: Track
): Promise<{ previous: ChapterNeighbour; next: ChapterNeighbour }> {
  const all = await prisma.chapter.findMany({
    where: {
      status: "PUBLISHED",
      section: { status: "PUBLISHED", courseId },
    },
    orderBy: [{ section: { order: "asc" } }, { order: "asc" }],
    select: {
      slug: true,
      title: true,
      order: true,
      section: { select: { slug: true, order: true } },
    },
  });

  const index = all.findIndex(
    (c) => c.section.order === sectionOrder && c.order === chapterOrder
  );
  if (index === -1) return { previous: null, next: null };

  const toNeighbour = (c: (typeof all)[number] | undefined): ChapterNeighbour =>
    c
      ? {
          title: c.title,
          href: chapterHref(track, courseSlug, c.section.slug, c.slug),
        }
      : null;

  return {
    previous: toNeighbour(all[index - 1]),
    next: toNeighbour(all[index + 1]),
  };
}

/**
 * The next incomplete chapter for a user, used by the "Continue" button at
 * the end of a chapter. Falls back to the first chapter for a new account.
 */
export async function findNextIncompleteChapter(
  courseSlug: string,
  userId: string | undefined,
  track: Track = "DSA"
): Promise<ChapterNeighbour> {
  const chapters = await prisma.chapter.findMany({
    where: {
      status: "PUBLISHED",
      section: {
        status: "PUBLISHED",
        course: { slug: courseSlug, status: "PUBLISHED" },
      },
    },
    orderBy: [{ section: { order: "asc" } }, { order: "asc" }],
    select: {
      id: true,
      slug: true,
      title: true,
      section: { select: { slug: true } },
    },
  });

  if (chapters.length === 0) return null;

  if (!userId) {
    const first = chapters[0]!;
    return {
      title: first.title,
      href: chapterHref(track, courseSlug, first.section.slug, first.slug),
    };
  }

  const completed = await prisma.userChapterProgress.findMany({
    where: {
      userId,
      status: "COMPLETED",
      chapterId: { in: chapters.map((c) => c.id) },
    },
    select: { chapterId: true },
  });
  const completedSet = new Set(completed.map((row) => row.chapterId));

  const next = chapters.find((c) => !completedSet.has(c.id));
  if (!next) return null;

  return {
    title: next.title,
    href: chapterHref(track, courseSlug, next.section.slug, next.slug),
  };
}

// ---------------------------------------------------------------------------
// Content resources
// ---------------------------------------------------------------------------

/**
 * Resolves everything a chapter's content blocks reference, in one round of
 * queries rather than one per block.
 *
 * A chapter embedding a quiz, six practice problems and two recognition
 * drills would otherwise issue nine queries from inside the renderer, which
 * is both slow and impossible to do from a synchronous component.
 */
export async function resolveContentResources(
  content: unknown,
  userId?: string
): Promise<{
  quizSlugs: string[];
  problemSlugs: string[];
  patternSlugs: string[];
}> {
  const blocks = Array.isArray(content) ? content : [];

  const quizSlugs: string[] = [];
  const problemSlugs: string[] = [];
  const patternSlugs: string[] = [];

  for (const block of blocks) {
    if (!block || typeof block !== "object") continue;
    const typed = block as { type?: string } & Record<string, unknown>;

    if (typed.type === "quiz" && typeof typed.quizSlug === "string") {
      quizSlugs.push(typed.quizSlug);
    } else if (typed.type === "problems" && Array.isArray(typed.slugs)) {
      for (const slug of typed.slugs) {
        if (typeof slug === "string") problemSlugs.push(slug);
      }
    } else if (
      typed.type === "recognition" &&
      typeof typed.answerPatternSlug === "string"
    ) {
      patternSlugs.push(typed.answerPatternSlug);
    }
  }

  // userId is accepted for symmetry with the other readers; the caller uses
  // it when loading the problems themselves.
  void userId;

  return {
    quizSlugs: [...new Set(quizSlugs)],
    problemSlugs: [...new Set(problemSlugs)],
    patternSlugs: [...new Set(patternSlugs)],
  };
}

/** Problems referenced by content or attached to a chapter, with user status. */
export async function getLinkedProblems(
  slugs: string[],
  userId?: string
): Promise<
  Map<
    string,
    {
      slug: string;
      number: number;
      title: string;
      difficulty: "EASY" | "MEDIUM" | "HARD";
      status: "NOT_STARTED" | "ATTEMPTED" | "SOLVED";
    }
  >
> {
  if (slugs.length === 0) return new Map();

  const rows = await prisma.problem.findMany({
    where: { slug: { in: slugs }, status: "PUBLISHED" },
    select: {
      id: true,
      slug: true,
      number: true,
      title: true,
      difficulty: true,
      progress: userId
        ? { where: { userId }, select: { status: true }, take: 1 }
        : false,
    },
  });

  return new Map(
    rows.map((row) => [
      row.slug,
      {
        slug: row.slug,
        number: row.number,
        title: row.title,
        difficulty: row.difficulty,
        status:
          (Array.isArray(row.progress) ? row.progress[0]?.status : undefined) ??
          ("NOT_STARTED" as const),
      },
    ])
  );
}

/** Pattern display names, for recognition drills. */
export async function getPatternNames(slugs: string[]): Promise<Map<string, string>> {
  if (slugs.length === 0) return new Map();

  const rows = await prisma.pattern.findMany({
    where: { slug: { in: slugs } },
    select: { slug: true, name: true },
  });

  return new Map(rows.map((row) => [row.slug, row.name]));
}
