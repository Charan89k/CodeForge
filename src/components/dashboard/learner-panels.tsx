import Link from "next/link";
import { ArrowRight, BookOpen, CalendarCheck, Trophy } from "lucide-react";

import { DifficultyBadge } from "@/components/common/difficulty-badge";
import { EmptyState } from "@/components/common/empty-state";
import { Bar, Panel } from "@/components/dashboard/panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { route } from "@/lib/utils";
import type {
  ContestPreview,
  CourseProgress,
  getDailyForLearner,
} from "@/services/learner-activity";

function PanelLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={route(href)}
      className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-brand-300"
    >
      {children}
      <ArrowRight className="size-3.5" aria-hidden="true" />
    </Link>
  );
}

export function DailyChallengePanel({
  daily,
}: {
  daily: Awaited<ReturnType<typeof getDailyForLearner>>;
}) {
  return (
    <Panel title="Daily challenge">
      {!daily ? (
        <EmptyState
          icon={CalendarCheck}
          title="No daily problem yet"
          description="The daily challenge starts once the catalogue has problems in it."
          size="sm"
        />
      ) : (
        <div className="p-4 sm:px-5">
          <Link
            href={route("/daily")}
            className="font-medium text-info transition-colors hover:text-brand-300"
          >
            {daily.problem.title}
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <DifficultyBadge difficulty={daily.problem.difficulty} />
            {daily.solvedToday && <Badge variant="success">Solved today</Badge>}
          </div>
          <p className="mt-2 text-xs text-muted-foreground tabular-nums">
            Daily streak: {daily.streak} day{daily.streak === 1 ? "" : "s"}
          </p>
        </div>
      )}
    </Panel>
  );
}

export function OpenContestsPanel({ contests }: { contests: ContestPreview[] }) {
  return (
    <Panel
      title="Contests"
      action={<PanelLink href="/contests">All contests</PanelLink>}
    >
      {contests.length === 0 ? (
        <EmptyState
          icon={Trophy}
          title="None scheduled"
          description="Upcoming contests appear here when an organiser schedules one."
          size="sm"
        />
      ) : (
        <ul className="divide-y divide-border">
          {contests.map((contest) => (
            <li key={contest.slug}>
              <Link
                href={route(`/contests/${contest.slug}`)}
                className="block px-4 py-3 transition-colors hover:bg-accent/30 sm:px-5"
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate text-sm font-medium">
                    {contest.title}
                  </span>
                  {contest.phase === "live" && <Badge variant="success">Live</Badge>}
                </span>
                <span className="mt-0.5 block font-mono text-xs text-muted-foreground">
                  {contest.startsAt.toISOString().slice(0, 16).replace("T", " ")} UTC
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

export function CourseProgressPanel({ courses }: { courses: CourseProgress[] }) {
  return (
    <Panel
      id="your-courses"
      title="Your courses"
      action={<PanelLink href="/learn">Courses</PanelLink>}
    >
      {courses.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No course started"
          description="Open a lesson in any course and your progress is tracked here."
          size="sm"
          action={
            <Button asChild size="sm" variant="outline">
              <Link href={route("/learn")}>Browse courses</Link>
            </Button>
          }
        />
      ) : (
        <ul className="divide-y divide-border">
          {courses.map((course) => (
            <li key={course.id} className="px-4 py-3 sm:px-5">
              <div className="flex items-baseline justify-between gap-3">
                <Link
                  href={route(course.href)}
                  className="min-w-0 truncate text-sm font-medium transition-colors hover:text-brand-300"
                >
                  {course.title}
                </Link>
                <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                  {course.completed} of {course.total} chapters
                </span>
              </div>
              <Bar
                percent={course.total ? (course.completed / course.total) * 100 : 0}
                label={`${course.title} progress`}
                className="mt-2"
              />
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
