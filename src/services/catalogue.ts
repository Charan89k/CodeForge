import "server-only";

import { cache } from "react";

import type { Prisma } from "@/generated/prisma/client";
import type { CourseLevel, Difficulty, Track } from "@/generated/prisma/enums";
import type {
  LibraryLength,
  LibraryQuery,
  LibraryStatus,
} from "@/lib/catalogue/filters";
import { prisma } from "@/lib/db";
import { chapterHref, courseHref } from "@/lib/tracks";

/**
 * The Learn library: courses and chapters, filtered, sorted and paged in the
 * database. Only published rows are ever selected; `visibleCourse` and
 * `visibleChapter` are the single place that says so.
 */

export const COURSES_PER_PAGE = 12;
export const CHAPTERS_PER_PAGE = 20;

export type LibraryCourse = {
  id: string;
  title: string;
  subtitle: string | null;
  category: string | null;
  level: CourseLevel;
  estimatedHours: number;
  updatedAt: Date;
  href: string;
  totalChapters: number;
  completedChapters: number;
  status: LibraryStatus;
};

export type LibraryChapter = {
  id: string;
  title: string;
  summary: string | null;
  difficulty: Difficulty;
  readingMinutes: number;
  track: Track;
  courseTitle: string;
  sectionTitle: string;
  href: string;
  status: LibraryStatus;
};

type Paged = { total: number; page: number; totalPages: number };
export type LibraryResult = {
  /** How many of each match, so switching lists never comes as a surprise. */
  counts: { courses: number; chapters: number };
} & (
  | ({ view: "courses"; items: LibraryCourse[] } & Paged)
  | ({ view: "chapters"; items: LibraryChapter[] } & Paged)
);

const visibleChapter = {
  status: "PUBLISHED",
  section: { status: "PUBLISHED" },
} satisfies Prisma.ChapterWhereInput;

const visibleCourse = {
  status: "PUBLISHED",
  // A course whose chapters were all retired has nothing to open.
  sections: {
    some: { status: "PUBLISHED", chapters: { some: { status: "PUBLISHED" } } },
  },
} satisfies Prisma.CourseWhereInput;

const insensitive = (search: string) => ({
  contains: search,
  mode: "insensitive" as const,
});

const LENGTH_HOURS: Record<LibraryLength, Prisma.IntFilter> = {
  // Zero means nobody estimated it, not that it takes no time.
  short: { gt: 0, lt: 5 },
  medium: { gte: 5, lte: 12 },
  long: { gt: 12 },
};

/** Subjects that exist among published courses. Filters offer nothing else. */
export const listSubjects = cache(async (): Promise<string[]> => {
  const rows = await prisma.course.findMany({
    where: { ...visibleCourse, category: { not: null } },
    distinct: ["category"],
    orderBy: { category: "asc" },
    select: { category: true },
  });
  return rows.flatMap((row) => (row.category ? [row.category] : []));
});

/** The course-level filters, which narrow both lists the same way. */
function courseFilters(query: LibraryQuery): Prisma.CourseWhereInput[] {
  return [
    ...(query.subject.length ? [{ category: { in: query.subject } }] : []),
    ...(query.level.length ? [{ level: { in: query.level } }] : []),
    ...(query.length.length
      ? [{ OR: query.length.map((l) => ({ estimatedHours: LENGTH_HOURS[l] })) }]
      : []),
  ];
}

/** Course ids in the wanted states, worked out from the learner's chapters. */
async function courseIdsByStatus(
  userId: string,
  statuses: LibraryStatus[]
): Promise<string[]> {
  const rows = await prisma.$queryRaw<
    { id: string; total: bigint; completed: bigint; started: bigint }[]
  >`
    SELECT c.id,
           COUNT(ch.id) AS total,
           COUNT(p.id) FILTER (WHERE p.status = 'COMPLETED') AS completed,
           COUNT(p.id) FILTER (WHERE p.status IN ('IN_PROGRESS', 'COMPLETED')) AS started
    FROM courses c
    JOIN course_sections s ON s."courseId" = c.id AND s.status = 'PUBLISHED'
    JOIN chapters ch ON ch."sectionId" = s.id AND ch.status = 'PUBLISHED'
    LEFT JOIN user_chapter_progress p ON p."chapterId" = ch.id AND p."userId" = ${userId}
    WHERE c.status = 'PUBLISHED'
    GROUP BY c.id`;
  return rows
    .filter((row) => statuses.includes(statusOf(row.total, row.completed, row.started)))
    .map((row) => row.id);
}

function statusOf(
  total: bigint | number,
  completed: bigint | number,
  started: bigint | number
): LibraryStatus {
  if (Number(started) === 0) return "NOT_STARTED";
  return Number(completed) === Number(total) ? "COMPLETED" : "IN_PROGRESS";
}

async function courseWhere(
  query: LibraryQuery,
  userId?: string
): Promise<Prisma.CourseWhereInput> {
  const search = query.q;
  return {
    AND: [
      visibleCourse,
      ...courseFilters(query),
      ...(query.difficulty.length
        ? [
            {
              sections: {
                some: {
                  status: "PUBLISHED" as const,
                  chapters: {
                    some: {
                      status: "PUBLISHED" as const,
                      difficulty: { in: query.difficulty },
                    },
                  },
                },
              },
            },
          ]
        : []),
      ...(search
        ? [
            {
              OR: [
                { title: insensitive(search) },
                { subtitle: insensitive(search) },
                { description: insensitive(search) },
                { category: insensitive(search) },
                {
                  sections: {
                    some: {
                      status: "PUBLISHED" as const,
                      chapters: {
                        some: {
                          status: "PUBLISHED" as const,
                          OR: [
                            { title: insensitive(search) },
                            { summary: insensitive(search) },
                          ],
                        },
                      },
                    },
                  },
                },
              ],
            },
          ]
        : []),
      ...(userId && query.status.length
        ? [{ id: { in: await courseIdsByStatus(userId, query.status) } }]
        : []),
    ],
  };
}

function chapterWhere(query: LibraryQuery, userId?: string): Prisma.ChapterWhereInput {
  const search = query.q;
  const wanted = query.status;
  return {
    AND: [
      visibleChapter,
      {
        section: {
          status: "PUBLISHED",
          course: { AND: [{ status: "PUBLISHED" }, ...courseFilters(query)] },
        },
      },
      ...(query.difficulty.length ? [{ difficulty: { in: query.difficulty } }] : []),
      ...(search
        ? [{ OR: [{ title: insensitive(search) }, { summary: insensitive(search) }] }]
        : []),
      ...(userId && wanted.length
        ? [
            {
              OR: wanted.map((status) =>
                status === "NOT_STARTED"
                  ? {
                      progress: {
                        none: { userId, status: { in: ["IN_PROGRESS", "COMPLETED"] } },
                      },
                    }
                  : { progress: { some: { userId, status } } }
              ) as Prisma.ChapterWhereInput[],
            },
          ]
        : []),
    ],
  };
}

const COURSE_ORDER = {
  best: [{ featured: "desc" }, { order: "asc" }],
  updated: [{ updatedAt: "desc" }],
  title: [{ title: "asc" }],
  shortest: [{ estimatedHours: "asc" }],
  easiest: [{ level: "asc" }, { order: "asc" }],
} satisfies Record<LibraryQuery["sort"], Prisma.CourseOrderByWithRelationInput[]>;

const READING_ORDER = [
  { section: { course: { order: "asc" } } },
  { section: { order: "asc" } },
  { order: "asc" },
] satisfies Prisma.ChapterOrderByWithRelationInput[];

const CHAPTER_ORDER = {
  best: READING_ORDER,
  updated: [{ updatedAt: "desc" }],
  title: [{ title: "asc" }],
  shortest: [{ readingMinutes: "asc" }],
  easiest: [{ difficulty: "asc" }, ...READING_ORDER],
} satisfies Record<LibraryQuery["sort"], Prisma.ChapterOrderByWithRelationInput[]>;

function pageWindow(requested: number, total: number, perPage: number) {
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const page = Math.min(requested, totalPages);
  return { page, totalPages, skip: (page - 1) * perPage, take: perPage };
}

/**
 * Fetches one page ordered "title matches first", without SQL ranking: rows
 * whose title matches come from one query and the rest from another, and the
 * page is cut across the two. `skip` and `take` apply to the combined list.
 */
async function bestMatchPage<Row>(
  skip: number,
  take: number,
  titleMatchCount: () => Promise<number>,
  fetch: (matchesTitle: boolean, skip: number, take: number) => Promise<Row[]>
): Promise<Row[]> {
  const inTitle = await titleMatchCount();
  const fromTitle = skip < inTitle ? await fetch(true, skip, take) : [];
  const remaining = take - fromTitle.length;
  if (remaining === 0) return fromTitle;
  const rest = await fetch(false, Math.max(0, skip - inTitle), remaining);
  return [...fromTitle, ...rest];
}

const courseSelect = {
  id: true,
  slug: true,
  title: true,
  subtitle: true,
  category: true,
  level: true,
  track: true,
  estimatedHours: true,
  updatedAt: true,
  sections: {
    where: { status: "PUBLISHED" },
    select: {
      chapters: { where: { status: "PUBLISHED" }, select: { id: true } },
    },
  },
} satisfies Prisma.CourseSelect;

async function courseItems(
  where: Prisma.CourseWhereInput,
  query: LibraryQuery,
  userId: string | undefined,
  skip: number,
  take: number
): Promise<LibraryCourse[]> {
  const orderBy = [...COURSE_ORDER[query.sort], { id: "asc" as const }];
  const titleIs = (matches: boolean): Prisma.CourseWhereInput =>
    matches
      ? { title: insensitive(query.q) }
      : { NOT: { title: insensitive(query.q) } };

  const rows =
    query.q && query.sort === "best"
      ? await bestMatchPage(
          skip,
          take,
          () => prisma.course.count({ where: { AND: [where, titleIs(true)] } }),
          (matches, s, t) =>
            prisma.course.findMany({
              where: { AND: [where, titleIs(matches)] },
              orderBy,
              skip: s,
              take: t,
              select: courseSelect,
            })
        )
      : await prisma.course.findMany({
          where,
          orderBy,
          skip,
          take,
          select: courseSelect,
        });

  const chapterIds = rows.flatMap((c) =>
    c.sections.flatMap((s) => s.chapters.map((x) => x.id))
  );
  const progress = userId
    ? await prisma.userChapterProgress.findMany({
        where: {
          userId,
          chapterId: { in: chapterIds },
          status: { in: ["IN_PROGRESS", "COMPLETED"] },
        },
        select: { chapterId: true, status: true },
      })
    : [];
  const statusByChapter = new Map(progress.map((p) => [p.chapterId, p.status]));

  return rows.map((course) => {
    const ids = course.sections.flatMap((s) => s.chapters.map((c) => c.id));
    const started = ids.filter((id) => statusByChapter.has(id)).length;
    const completed = ids.filter(
      (id) => statusByChapter.get(id) === "COMPLETED"
    ).length;
    return {
      id: course.id,
      title: course.title,
      subtitle: course.subtitle,
      category: course.category,
      level: course.level,
      estimatedHours: course.estimatedHours,
      updatedAt: course.updatedAt,
      href: courseHref(course.track, course.slug),
      totalChapters: ids.length,
      completedChapters: completed,
      status: statusOf(ids.length, completed, started),
    };
  });
}

async function chapterItems(
  where: Prisma.ChapterWhereInput,
  query: LibraryQuery,
  userId: string | undefined,
  skip: number,
  take: number
): Promise<LibraryChapter[]> {
  const orderBy = [...CHAPTER_ORDER[query.sort], { id: "asc" as const }];
  const select = {
    id: true,
    slug: true,
    title: true,
    summary: true,
    difficulty: true,
    readingMinutes: true,
    section: {
      select: {
        slug: true,
        title: true,
        course: { select: { slug: true, title: true, track: true } },
      },
    },
    ...(userId
      ? { progress: { where: { userId }, select: { status: true }, take: 1 } }
      : {}),
  } satisfies Prisma.ChapterSelect;
  const titleIs = (matches: boolean): Prisma.ChapterWhereInput =>
    matches
      ? { title: insensitive(query.q) }
      : { NOT: { title: insensitive(query.q) } };

  const rows =
    query.q && query.sort === "best"
      ? await bestMatchPage(
          skip,
          take,
          () => prisma.chapter.count({ where: { AND: [where, titleIs(true)] } }),
          (matches, s, t) =>
            prisma.chapter.findMany({
              where: { AND: [where, titleIs(matches)] },
              orderBy,
              skip: s,
              take: t,
              select,
            })
        )
      : await prisma.chapter.findMany({ where, orderBy, skip, take, select });

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    summary: row.summary,
    difficulty: row.difficulty,
    readingMinutes: row.readingMinutes,
    track: row.section.course.track,
    courseTitle: row.section.course.title,
    sectionTitle: row.section.title,
    href: chapterHref(
      row.section.course.track,
      row.section.course.slug,
      row.section.slug,
      row.slug
    ),
    status:
      ((row as { progress?: { status: LibraryStatus }[] }).progress?.[0]?.status as
        LibraryStatus | undefined) ?? "NOT_STARTED",
  }));
}

export async function queryLibrary(
  query: LibraryQuery,
  userId?: string
): Promise<LibraryResult> {
  const [coursesWhere, chaptersWhere] = [
    await courseWhere(query, userId),
    chapterWhere(query, userId),
  ];
  const courses = await prisma.course.count({ where: coursesWhere });
  const chapters = await prisma.chapter.count({ where: chaptersWhere });
  const counts = { courses, chapters };

  if (query.view === "chapters") {
    const { page, totalPages, skip, take } = pageWindow(
      query.page,
      chapters,
      CHAPTERS_PER_PAGE
    );
    return {
      view: "chapters",
      counts,
      total: chapters,
      page,
      totalPages,
      items: await chapterItems(chaptersWhere, query, userId, skip, take),
    };
  }

  const { page, totalPages, skip, take } = pageWindow(
    query.page,
    courses,
    COURSES_PER_PAGE
  );
  return {
    view: "courses",
    counts,
    total: courses,
    page,
    totalPages,
    items: await courseItems(coursesWhere, query, userId, skip, take),
  };
}
