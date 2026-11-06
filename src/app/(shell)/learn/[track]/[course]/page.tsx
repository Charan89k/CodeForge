import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Circle,
  CircleDot,
  Clock,
  Layers,
} from "lucide-react";

import { EmptyState } from "@/components/common/empty-state";
import { diagramFor } from "@/components/learning/diagram-for";
import { MiniDiagram } from "@/components/marketing/mini-diagrams";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { getCurrentUser } from "@/lib/auth/session";
import { TRACK_LABELS } from "@/lib/tracks";
import { cn, route } from "@/lib/utils";
import { findNextIncompleteChapter, getCourse } from "@/services/curriculum";

export async function generateMetadata({
  params,
}: PageProps<"/learn/[track]/[course]">): Promise<Metadata> {
  const { track: segment, course: slug } = await params;
  const course = await getCourse(slug);
  if (!course) return { title: "Course not found" };

  return {
    title: course.title,
    description: course.description,
    alternates: { canonical: `/learn/${segment}/${course.slug}` },
  };
}

export default async function CoursePage({
  params,
}: PageProps<"/learn/[track]/[course]">) {
  const { track: segment, course: slug } = await params;
  const user = await getCurrentUser();
  const course = await getCourse(slug, user?.id);

  if (!course) notFound();

  const nextChapter = await findNextIncompleteChapter(
    course.slug,
    user?.id,
    course.track
  );

  const percent = course.totalChapters
    ? Math.round((course.completedChapters / course.totalChapters) * 100)
    : 0;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <Breadcrumb className="mb-5">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href={route(`/learn/${segment}`)}>
                {TRACK_LABELS[course.track]}
              </Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{course.title}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <header className="flex flex-col overflow-hidden rounded-xl border border-border bg-card md:flex-row">
        <MiniDiagram
          kind={diagramFor(course.slug)}
          className="h-32 shrink-0 border-b border-border md:h-auto md:w-60 md:border-r md:border-b-0"
        />
        <div className="min-w-0 flex-1 p-5 sm:p-6">
          <h1 className="tracking-headline text-2xl font-bold sm:text-3xl">
            {course.title}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-pretty text-muted-foreground">
            {course.description}
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="inline-flex h-7 items-center gap-1.5 rounded-md border border-border bg-muted/50 px-2.5 text-xs text-muted-foreground">
              <BookOpen className="size-3.5" aria-hidden="true" />
              <span className="tabular-nums">
                {course.completedChapters}/{course.totalChapters} chapters
              </span>
            </span>
            {course.sections.length > 0 && (
              <span className="inline-flex h-7 items-center gap-1.5 rounded-md border border-border bg-muted/50 px-2.5 text-xs text-muted-foreground">
                <Layers className="size-3.5" aria-hidden="true" />
                {course.sections.length} sections
              </span>
            )}
            {course.estimatedHours > 0 && (
              <span className="inline-flex h-7 items-center gap-1.5 rounded-md border border-border bg-muted/50 px-2.5 text-xs text-muted-foreground">
                <Clock className="size-3.5" aria-hidden="true" />~
                {course.estimatedHours}h
              </span>
            )}
            <span className="inline-flex h-7 items-center rounded-md border border-border bg-muted/50 px-2.5 text-xs text-muted-foreground capitalize">
              {course.level.toLowerCase()}
            </span>
          </div>

          {(course.outcomes.length > 0 || course.prerequisites.length > 0) && (
            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              {course.outcomes.length > 0 && (
                <div>
                  <h2 className="text-sm font-semibold">What you will be able to do</h2>
                  <ul className="mt-1.5 list-disc space-y-1 pl-4 text-sm text-muted-foreground">
                    {course.outcomes.map((outcome) => (
                      <li key={outcome}>{outcome}</li>
                    ))}
                  </ul>
                </div>
              )}
              {course.prerequisites.length > 0 && (
                <div>
                  <h2 className="text-sm font-semibold">Before you start</h2>
                  <ul className="mt-1.5 list-disc space-y-1 pl-4 text-sm text-muted-foreground">
                    {course.prerequisites.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {course.license && (
            <p className="mt-4 text-xs text-subtle-foreground">
              Used under {course.license}. {course.attribution}
            </p>
          )}

          <div className="mt-5 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-4">
            {nextChapter ? (
              <Button asChild>
                <Link href={route(nextChapter.href)}>
                  {course.completedChapters > 0 ? "Continue" : "Start course"}
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            ) : course.totalChapters > 0 ? (
              <Badge className="border border-success/30 bg-success/15 text-success">
                Course complete
              </Badge>
            ) : null}
            {nextChapter && (
              <p className="min-w-0 truncate text-xs text-muted-foreground">
                Up next: <span className="text-foreground">{nextChapter.title}</span>
              </p>
            )}
          </div>
        </div>
      </header>

      {course.sections.length === 0 ? (
        <div className="mt-8 rounded-xl border border-border bg-card">
          <EmptyState
            title="No published sections in this course yet"
            description="Sections appear here once they are published."
          />
        </div>
      ) : (
        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_17rem]">
          <div className="min-w-0 space-y-4">
            {course.sections.map((section, index) => {
              const sectionPercent = section.totalChapters
                ? Math.round((section.completedChapters / section.totalChapters) * 100)
                : 0;
              return (
                <section
                  key={section.id}
                  id={`section-${section.slug}`}
                  aria-labelledby={`section-${section.slug}-title`}
                  className="scroll-mt-20 overflow-hidden rounded-xl border border-border bg-card"
                >
                  <div className="flex items-start gap-3 px-4 py-4 sm:px-5">
                    <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-muted font-mono text-xs text-muted-foreground tabular-nums">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <div className="min-w-0 flex-1">
                      <h2
                        id={`section-${section.slug}-title`}
                        className="tracking-headline text-base font-semibold sm:text-lg"
                      >
                        <Link
                          href={route(
                            `/learn/${segment}/${course.slug}/${section.slug}`
                          )}
                          className="transition-colors hover:text-brand-300"
                        >
                          {section.title}
                        </Link>
                      </h2>
                      {section.summary && (
                        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground sm:text-sm">
                          {section.summary}
                        </p>
                      )}
                    </div>
                    <div className="hidden w-32 shrink-0 items-center gap-2 pt-1.5 sm:flex">
                      <span className="font-mono text-xs text-muted-foreground tabular-nums">
                        {section.completedChapters}/{section.totalChapters}
                      </span>
                      <div
                        className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"
                        role="progressbar"
                        aria-valuenow={sectionPercent}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={`${section.title} progress`}
                      >
                        <div
                          className="h-full rounded-full bg-brand-500"
                          style={{ width: `${sectionPercent}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <ul className="divide-y divide-border border-t border-border">
                    {section.chapters.map((chapter) => (
                      <li key={chapter.id}>
                        <Link
                          href={route(
                            `/learn/${segment}/${course.slug}/${section.slug}/${chapter.slug}`
                          )}
                          className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-accent/30 sm:px-5"
                        >
                          <ChapterStatusIcon status={chapter.status} />

                          <div className="min-w-0 flex-1">
                            <span
                              className={cn(
                                "block truncate text-sm font-medium transition-colors group-hover:text-brand-300",
                                chapter.status === "COMPLETED"
                                  ? "text-muted-foreground"
                                  : "text-info"
                              )}
                            >
                              {chapter.title}
                            </span>
                            {chapter.summary && (
                              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                                {chapter.summary}
                              </p>
                            )}
                          </div>

                          <div className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
                            {chapter.problemCount > 0 && (
                              <span className="hidden tabular-nums sm:inline">
                                {chapter.problemCount} problem
                                {chapter.problemCount === 1 ? "" : "s"}
                              </span>
                            )}
                            <span className="flex items-center gap-1 tabular-nums">
                              <Clock className="size-3" aria-hidden="true" />
                              {chapter.readingMinutes}m
                            </span>
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>

          <aside
            aria-label="Course progress"
            className="sticky top-[4.5rem] hidden h-fit rounded-xl border border-border bg-card p-4 lg:block"
          >
            <div className="flex items-baseline justify-between">
              <h2 className="text-sm font-semibold">Progress</h2>
              <span className="text-xs text-muted-foreground tabular-nums">
                {course.completedChapters} / {course.totalChapters} chapters
              </span>
            </div>
            <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-brand-500"
                style={{ width: `${percent}%` }}
              />
            </div>

            <ol className="mt-4 space-y-0.5 border-t border-border pt-3">
              {course.sections.map((section, index) => (
                <li key={section.id}>
                  <a
                    href={`#section-${section.slug}`}
                    className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent/40 hover:text-foreground"
                  >
                    <span className="font-mono text-[0.65rem] text-muted-foreground/70 tabular-nums">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{section.title}</span>
                    <span className="font-mono text-[0.65rem] tabular-nums">
                      {section.completedChapters}/{section.totalChapters}
                    </span>
                  </a>
                </li>
              ))}
            </ol>
          </aside>
        </div>
      )}
    </div>
  );
}

function ChapterStatusIcon({
  status,
}: {
  status: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";
}) {
  if (status === "COMPLETED") {
    return (
      <CheckCircle2 className="size-4 shrink-0 text-success" aria-label="Completed" />
    );
  }
  if (status === "IN_PROGRESS") {
    return (
      <CircleDot className="size-4 shrink-0 text-brand-500" aria-label="In progress" />
    );
  }
  return (
    <Circle
      className="size-4 shrink-0 text-muted-foreground/40"
      aria-label="Not started"
    />
  );
}
