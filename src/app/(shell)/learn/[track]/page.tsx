import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, BookOpen, Clock, Layers } from "lucide-react";

import { EmptyState } from "@/components/common/empty-state";
import { diagramFor } from "@/components/learning/diagram-for";
import { MiniDiagram } from "@/components/marketing/mini-diagrams";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth/session";
import { READER_TRACKS, trackForSegment } from "@/lib/tracks";
import { route } from "@/lib/utils";
import { getCourse, listCourses } from "@/services/curriculum";

/**
 * Per-track copy.
 *
 * The page itself is track-agnostic — `listCourses` has taken a `Track`
 * since Phase 1 — so the only thing that differs is what the track is
 * called and why it is ordered the way it is.
 */
const TRACK_COPY: Record<
  string,
  { heading: string; description: string; metaTitle: string; metaDescription: string }
> = {
  DSA: {
    heading: "Data Structures & Algorithms",
    description:
      "Ordered by dependency, not by topic popularity. Each chapter states what you should be able to do afterwards, then checks it.",
    metaTitle: "DSA curriculum",
    metaDescription:
      "A structured data structures and algorithms curriculum, ordered by dependency: complexity analysis, arrays, strings, hashing, two pointers, sliding windows, binary search, linked lists, stacks and queues, and recursion.",
  },
  SYSTEM_DESIGN: {
    heading: "System Design",
    description:
      "Vocabulary first, then components, then arrangements. Every diagram is data you can also read as text.",
    metaTitle: "System design curriculum",
    metaDescription:
      "Reason about large systems: scale, latency, replication, partitioning, consistency and the trade-offs between them.",
  },
  GENERAL: {
    heading: "More courses",
    description:
      "Programming, computer science and career courses, written for Tech Epitome.",
    metaTitle: "Courses",
    metaDescription:
      "Original courses in programming, computer science and career skills.",
  },
  LLD: {
    heading: "Low-Level Design",
    description:
      "Designing the objects inside a service: responsibilities, relationships, and the patterns worth knowing by name.",
    metaTitle: "Low-level design curriculum",
    metaDescription:
      "Object-oriented design, SOLID and the design patterns that actually come up, with their costs stated.",
  },
};

export async function generateMetadata({
  params,
}: PageProps<"/learn/[track]">): Promise<Metadata> {
  const { track: segment } = await params;
  const track = trackForSegment(segment);
  if (!track || !READER_TRACKS.includes(track)) return { title: "Not found" };

  const copy = TRACK_COPY[track]!;
  return {
    title: copy.metaTitle,
    description: copy.metaDescription,
    alternates: { canonical: `/learn/${segment}` },
  };
}

export default async function TrackRoadmapPage({
  params,
}: PageProps<"/learn/[track]">) {
  const { track: segment } = await params;
  const track = trackForSegment(segment);
  // An unknown or non-reader track 404s rather than rendering an empty
  // roadmap, so /learn/nonsense is not a valid-looking page.
  if (!track || !READER_TRACKS.includes(track)) notFound();

  const copy = TRACK_COPY[track]!;
  const user = await getCurrentUser();
  const courses = await listCourses(track, user?.id);

  // The section breakdown for each course, for the "what's inside" grid.
  // Tracks have one or two courses, so this is a handful of reads.
  const details = await Promise.all(
    courses.map((course) => getCourse(course.slug, user?.id))
  );

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <header className="max-w-3xl">
        <p className="text-[0.68rem] font-medium tracking-wider text-brand-400 uppercase">
          Learn
        </p>
        <h1 className="tracking-headline mt-2 text-2xl font-bold sm:text-3xl">
          {copy.heading}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-pretty text-muted-foreground sm:text-base">
          {copy.description}
        </p>
      </header>

      {courses.length === 0 ? (
        <div className="mt-8 rounded-xl border border-border bg-card">
          <EmptyState
            icon={BookOpen}
            title="No published courses yet"
            description="Courses appear here once they are published. If you are running this locally, seed the database with npm run db:seed."
          />
        </div>
      ) : (
        <div className="mt-8 space-y-12">
          {courses.map((course, courseIndex) => {
            const percent =
              course.totalChapters > 0
                ? Math.round((course.completedChapters / course.totalChapters) * 100)
                : 0;
            const sections = details[courseIndex]?.sections ?? [];

            return (
              <section key={course.id} aria-label={course.title}>
                <Link
                  href={route(`/learn/${segment}/${course.slug}`)}
                  className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-colors hover:border-brand-500/40 sm:flex-row"
                >
                  <MiniDiagram
                    kind={diagramFor(course.slug, courseIndex)}
                    className="h-32 shrink-0 border-b border-border sm:h-auto sm:w-56 sm:border-r sm:border-b-0"
                  />
                  <div className="min-w-0 flex-1 p-5 sm:p-6">
                    <h2 className="tracking-headline text-lg font-semibold transition-colors group-hover:text-brand-200 sm:text-xl">
                      {course.title}
                    </h2>
                    {course.subtitle && (
                      <p className="mt-1 text-sm text-muted-foreground">
                        {course.subtitle}
                      </p>
                    )}

                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span className="tabular-nums">
                        {course.completedChapters}/{course.totalChapters} chapters
                      </span>
                      {sections.length > 0 && (
                        <span className="flex items-center gap-1">
                          <Layers className="size-3" aria-hidden="true" />
                          {sections.length} sections
                        </span>
                      )}
                      {course.estimatedHours > 0 && (
                        <span className="flex items-center gap-1">
                          <Clock className="size-3" aria-hidden="true" />~
                          {course.estimatedHours}h
                        </span>
                      )}
                    </div>

                    <div className="mt-4 flex items-center gap-3">
                      <div
                        className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"
                        role="progressbar"
                        aria-valuenow={percent}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={`${course.completedChapters} of ${course.totalChapters} chapters complete`}
                      >
                        <div
                          className="h-full rounded-full bg-brand-500"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                      <span className="font-mono text-xs text-muted-foreground tabular-nums">
                        {percent}%
                      </span>
                      <span className="flex shrink-0 items-center gap-1 text-sm font-medium text-brand-300">
                        {course.completedChapters > 0 ? "Continue" : "Open course"}
                        <ArrowRight
                          className="size-4 transition-transform group-hover:translate-x-0.5"
                          aria-hidden="true"
                        />
                      </span>
                    </div>
                  </div>
                </Link>

                {sections.length > 0 && (
                  <>
                    <h3 className="tracking-headline mt-8 text-lg font-semibold">
                      What&rsquo;s inside
                    </h3>
                    <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {sections.map((section, sectionIndex) => {
                        const sectionPercent = section.totalChapters
                          ? Math.round(
                              (section.completedChapters / section.totalChapters) * 100
                            )
                          : 0;
                        return (
                          <li key={section.id}>
                            <Link
                              href={route(
                                `/learn/${segment}/${course.slug}#section-${section.slug}`
                              )}
                              className="group flex h-full overflow-hidden rounded-xl border border-border bg-card transition-colors hover:border-brand-500/40 sm:flex-col"
                            >
                              <MiniDiagram
                                kind={diagramFor(section.slug, sectionIndex)}
                                className="w-24 shrink-0 border-r border-border sm:h-28 sm:w-full sm:border-r-0 sm:border-b"
                              />
                              <div className="flex min-w-0 flex-1 flex-col p-4">
                                <p className="font-mono text-[0.65rem] text-muted-foreground tabular-nums">
                                  {String(sectionIndex + 1).padStart(2, "0")}
                                </p>
                                <p className="mt-0.5 truncate text-sm font-semibold transition-colors group-hover:text-brand-200">
                                  {section.title}
                                </p>
                                {section.summary && (
                                  <p className="mt-1 line-clamp-2 text-xs leading-snug text-muted-foreground">
                                    {section.summary}
                                  </p>
                                )}
                                <div className="mt-auto flex items-center gap-2 pt-3">
                                  <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
                                    <div
                                      className="h-full rounded-full bg-brand-500"
                                      style={{ width: `${sectionPercent}%` }}
                                    />
                                  </div>
                                  <span className="font-mono text-[0.65rem] text-muted-foreground tabular-nums">
                                    {section.completedChapters}/{section.totalChapters}
                                  </span>
                                </div>
                              </div>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </>
                )}
              </section>
            );
          })}
        </div>
      )}

      {!user && courses.length > 0 && (
        <div className="mt-10 flex flex-col items-start gap-3 rounded-xl border border-border bg-card p-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Create an account to track progress, save notes and get revision scheduled
            for you.
          </p>
          <Button asChild size="sm">
            <Link href="/signup">Create account</Link>
          </Button>
        </div>
      )}
    </div>
  );
}
