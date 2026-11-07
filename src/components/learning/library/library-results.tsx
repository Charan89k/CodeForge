import Link from "next/link";
import { CheckCircle2, CircleDot, Search } from "lucide-react";

import { DifficultyBadge } from "@/components/common/difficulty-badge";
import { EmptyState } from "@/components/common/empty-state";
import { Pagination } from "@/components/problems/pagination";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  activeFilterCount,
  clearedHref,
  LEVEL_LABELS,
  libraryHref,
  librarySearchParams,
  SORT_LABELS,
  SORTS,
  type LibraryQuery,
  type LibraryStatus,
} from "@/lib/catalogue/filters";
import { TRACK_LABELS } from "@/lib/tracks";
import { cn, route } from "@/lib/utils";
import {
  queryLibrary,
  type LibraryChapter,
  type LibraryCourse,
} from "@/services/catalogue";

const plural = (count: number, noun: string) =>
  `${count.toLocaleString("en-IN")} ${noun}${count === 1 ? "" : "s"}`;

const updatedOn = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

function ListTabs({
  query,
  counts,
}: {
  query: LibraryQuery;
  counts: { courses: number; chapters: number };
}) {
  return (
    <nav aria-label="What to list" className="flex gap-5 border-b border-border">
      {(["courses", "chapters"] as const).map((view) => (
        <Link
          key={view}
          prefetch={false}
          scroll={false}
          href={route(libraryHref(query, { view }))}
          aria-current={query.view === view ? "page" : undefined}
          className={cn(
            "-mb-px inline-flex min-h-11 items-center gap-1.5 border-b-2 text-sm capitalize outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
            query.view === view
              ? "border-primary font-medium text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          {view}
          <span className="font-mono text-xs text-subtle-foreground tabular-nums">
            {counts[view].toLocaleString("en-IN")}
          </span>
        </Link>
      ))}
    </nav>
  );
}

function SortLinks({ query }: { query: LibraryQuery }) {
  return (
    <nav
      aria-label="Sort by"
      className="flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground"
    >
      <span className="text-subtle-foreground">Sort</span>
      {SORTS.map((sort) => (
        <Link
          key={sort}
          prefetch={false}
          scroll={false}
          href={route(libraryHref(query, { sort }))}
          aria-current={query.sort === sort ? "true" : undefined}
          className={cn(
            "inline-flex min-h-9 items-center underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50",
            query.sort === sort && "font-medium text-foreground"
          )}
        >
          {sort === "best" && query.q ? "Best match" : SORT_LABELS[sort]}
        </Link>
      ))}
    </nav>
  );
}

const STATUS_TEXT: Record<LibraryStatus, string> = {
  NOT_STARTED: "Not started",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
};

function StatusIcon({ status }: { status: LibraryStatus }) {
  if (status === "COMPLETED")
    return (
      <CheckCircle2 aria-hidden="true" className="size-3.5 shrink-0 text-success" />
    );
  if (status === "IN_PROGRESS")
    return <CircleDot aria-hidden="true" className="size-3.5 shrink-0 text-primary" />;
  return null;
}

/** Three steps, filled to the level. The word next to it carries the meaning. */
function LevelMark({ level }: { level: LibraryCourse["level"] }) {
  const filled = { BEGINNER: 1, INTERMEDIATE: 2, ADVANCED: 3 }[level];
  return (
    <span aria-hidden="true" className="inline-flex items-end gap-0.5">
      {[1, 2, 3].map((step) => (
        <span
          key={step}
          style={{ height: `${4 + step * 3}px` }}
          className={cn(
            "w-[3px] rounded-[1px]",
            step <= filled ? "bg-brand-400" : "bg-muted-foreground/25"
          )}
        />
      ))}
    </span>
  );
}

function CourseRow({ course }: { course: LibraryCourse }) {
  const percent =
    course.totalChapters > 0
      ? Math.round((course.completedChapters / course.totalChapters) * 100)
      : 0;
  return (
    <li className="grid gap-x-8 gap-y-3 py-5 first:pt-4 sm:grid-cols-[minmax(0,1fr)_9rem]">
      <div className="min-w-0">
        {course.category && (
          <p className="font-mono text-[11px] tracking-wider text-subtle-foreground uppercase">
            {course.category}
          </p>
        )}
        <h3 className="mt-1 text-lg leading-snug font-semibold text-balance">
          <Link
            href={route(course.href)}
            className="underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {course.title}
          </Link>
        </h3>
        {course.subtitle && (
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            {course.subtitle}
          </p>
        )}
        <p className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-subtle-foreground">
          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
            <LevelMark level={course.level} />
            {LEVEL_LABELS[course.level]}
          </span>
          <span aria-hidden="true">·</span>
          <span className="tabular-nums">
            {plural(course.totalChapters, "chapter")}
          </span>
          {course.estimatedHours > 0 && (
            <>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">about {course.estimatedHours} h</span>
            </>
          )}
          <span aria-hidden="true">·</span>
          <span>Updated {updatedOn.format(course.updatedAt)}</span>
        </p>
      </div>
      <div className="sm:pt-5">
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <StatusIcon status={course.status} />
          {STATUS_TEXT[course.status]}
        </p>
        {course.status !== "NOT_STARTED" && (
          <>
            <span
              role="progressbar"
              aria-label={`${course.title} progress`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={percent}
              className="mt-2 block h-1 overflow-hidden rounded-full bg-muted"
            >
              <span
                className="block h-full bg-primary"
                style={{ width: `${percent}%` }}
              />
            </span>
            <p className="mt-1.5 font-mono text-[11px] text-subtle-foreground tabular-nums">
              {course.completedChapters} of {course.totalChapters}
            </p>
          </>
        )}
      </div>
    </li>
  );
}

function ChapterRow({ chapter }: { chapter: LibraryChapter }) {
  return (
    <li className="flex items-start gap-3 py-4">
      <div className="min-w-0 flex-1">
        <h3 className="font-medium">
          <Link
            href={route(chapter.href)}
            className="underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {chapter.title}
          </Link>
        </h3>
        <p className="mt-0.5 text-xs text-subtle-foreground">
          {TRACK_LABELS[chapter.track]} · {chapter.courseTitle} · {chapter.sectionTitle}{" "}
          · {chapter.readingMinutes} min
        </p>
        {chapter.summary && (
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
            {chapter.summary}
          </p>
        )}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1.5">
        <DifficultyBadge difficulty={chapter.difficulty} />
        {chapter.status !== "NOT_STARTED" && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <StatusIcon status={chapter.status} />
            {STATUS_TEXT[chapter.status]}
          </span>
        )}
      </div>
    </li>
  );
}

export async function LibraryResults({
  query,
  userId,
}: {
  query: LibraryQuery;
  userId?: string;
}) {
  const result = await queryLibrary(query, userId);
  const noun = result.view === "courses" ? "course" : "chapter";
  const other = result.view === "courses" ? "chapters" : "courses";
  const narrowed = activeFilterCount(query) > 0 || Boolean(query.q);

  return (
    <>
      <ListTabs query={query} counts={result.counts} />
      {result.total === 0 ? (
        <div className="mt-6">
          <EmptyState
            icon={Search}
            title={`No ${noun}s match`}
            description={
              narrowed
                ? "Remove a filter above, or try a shorter search."
                : `No ${noun}s have been published yet.`
            }
            action={
              <div className="flex flex-wrap justify-center gap-2">
                {result.counts[other] > 0 && (
                  <Button asChild variant="outline">
                    <Link href={route(libraryHref(query, { view: other }))}>
                      See {plural(result.counts[other], other.slice(0, -1))}
                    </Link>
                  </Button>
                )}
                {narrowed && (
                  <Button asChild variant="outline">
                    <Link href={route(clearedHref(query))}>Clear filters</Link>
                  </Button>
                )}
              </div>
            }
          />
        </div>
      ) : (
        <section aria-label={`Matching ${noun}s`}>
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 py-2">
            <p
              className="text-sm text-muted-foreground tabular-nums"
              aria-live="polite"
            >
              {plural(result.total, noun)}
            </p>
            <SortLinks query={query} />
          </div>
          <ul className="divide-y divide-border border-y border-border">
            {result.view === "courses"
              ? result.items.map((course) => (
                  <CourseRow key={course.id} course={course} />
                ))
              : result.items.map((chapter) => (
                  <ChapterRow key={chapter.id} chapter={chapter} />
                ))}
          </ul>
          <Pagination
            page={result.page}
            totalPages={result.totalPages}
            total={result.total}
            baseQuery={librarySearchParams({ ...query, page: 1 }).toString()}
            pathname="/learn"
            noun={noun}
          />
        </section>
      )}
    </>
  );
}

export function ResultsSkeleton() {
  return (
    <div role="status" aria-label="Loading results">
      <Skeleton className="h-11 w-48" />
      <div className="mt-4 space-y-5">
        {Array.from({ length: 5 }, (_, index) => (
          <Skeleton key={index} className="h-24 w-full rounded-md" />
        ))}
      </div>
    </div>
  );
}
