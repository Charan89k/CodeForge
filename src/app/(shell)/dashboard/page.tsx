import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpenCheck,
  BrainCircuit,
  CircleDot,
  Clock,
  Flame,
  ListChecks,
  Repeat2,
  Shapes,
  Target,
} from "lucide-react";

import { ActivityCalendarPanel } from "@/components/dashboard/activity-calendar";
import {
  CourseProgressPanel,
  DailyChallengePanel,
  OpenContestsPanel,
} from "@/components/dashboard/learner-panels";
import { Bar, Panel } from "@/components/dashboard/panel";
import { DifficultyBadge } from "@/components/common/difficulty-badge";
import { EmptyState } from "@/components/common/empty-state";
import { StatTile } from "@/components/common/stat-tile";
import { MiniDiagram } from "@/components/marketing/mini-diagrams";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/session";
import { hasCampusAccess } from "@/lib/campus-access";
import { cn, route } from "@/lib/utils";
import { getDashboardData } from "@/services/dashboard";
import {
  getActivityCalendar,
  getCourseProgress,
  getDailyForLearner,
  getOpenContests,
} from "@/services/learner-activity";
import { getProgressSummary } from "@/services/progress";

export const metadata: Metadata = {
  title: "Dashboard",
  robots: { index: false, follow: false },
};

type Data = Awaited<ReturnType<typeof getDashboardData>>;

function greeting(date = new Date()): string {
  const hour = date.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function formatStudyTime(seconds: number): string {
  if (seconds < 60) return "0m";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

const LANGUAGE_LABEL: Record<string, string> = {
  PYTHON: "Python",
  JAVASCRIPT: "JavaScript",
  TYPESCRIPT: "TypeScript",
  JAVA: "Java",
  CPP: "C++",
  GO: "Go",
};

export default async function DashboardPage() {
  const user = await requireUser("/dashboard");
  const [data, summary, campusMember] = await Promise.all([
    getDashboardData(user.id),
    getProgressSummary(user.id),
    hasCampusAccess(user),
  ]);
  const calendar = await getActivityCalendar(user.id);
  const courses = await getCourseProgress(user.id);
  const daily = await getDailyForLearner(user.id);
  const contests = await getOpenContests();

  const firstName = user.name?.split(" ")[0] ?? null;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <div>
        <div className="min-w-0">
          <h1 className="tracking-headline text-2xl font-bold sm:text-3xl">
            {greeting()}
            {firstName ? `, ${firstName}` : ""}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {data.dueReviewCount > 0
              ? `${data.dueReviewCount} item${data.dueReviewCount === 1 ? "" : "s"} ready for review.`
              : "Here is where you left off."}
          </p>
        </div>
      </div>

      {/* ---- Feature row: what to do next --------------------------------- */}
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <ContinueLearningCard data={data.continueLearning} />
        {data.dueReviewCount > 0 ? (
          <DueForReviewCard count={data.dueReviewCount} />
        ) : (
          <FeatureLink
            href="/patterns"
            title="Pattern library"
            description="Learn a pattern on its own page, then practise the problems built on it."
            diagram="window"
          />
        )}
      </div>

      {/* ---- Stats ------------------------------------------------------- */}
      <section aria-labelledby="progress-heading" className="mt-6">
        <h2 id="progress-heading" className="sr-only">
          Your progress
        </h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile
            label="Solved"
            value={summary.problemsSolved}
            icon={ListChecks}
            hint={`${summary.easySolved}E · ${summary.mediumSolved}M · ${summary.hardSolved}H`}
          />
          <StatTile
            label="Patterns"
            value={summary.patternsMastered}
            icon={Shapes}
            hint="mastered"
          />
          <StatTile
            label="Streak"
            value={`${summary.currentStreak}d`}
            icon={Flame}
            hint={`best ${summary.longestStreak}d`}
            className={
              summary.currentStreak > 0
                ? "border-brand-500/30 bg-brand-500/6"
                : undefined
            }
          />
          <StatTile
            label="Study time"
            value={formatStudyTime(summary.studySeconds)}
            icon={Clock}
            hint={`${summary.chaptersCompleted} chapter${summary.chaptersCompleted === 1 ? "" : "s"}`}
          />
        </div>
      </section>

      <div className="mt-6">
        <ActivityCalendarPanel calendar={calendar} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        {/* ---- Primary column -------------------------------------------- */}
        <div className="min-w-0 space-y-6">
          <WeeklyTargetCard target={data.weeklyTarget} />
          <CourseProgressPanel courses={courses} />
          <TodaysPracticeCard problems={data.recommendedProblems} />
          <RecentActivityCard submissions={data.recentSubmissions} />
        </div>

        {/* ---- Right rail -------------------------------------------------- */}
        <div className="min-w-0 space-y-6">
          <DailyChallengePanel daily={daily} />
          <OpenContestsPanel contests={contests} />
          <WeakPatternsCard patterns={data.weakPatterns} />
          <QuizPerformanceCard performance={data.quizPerformance} />
          <TracksCard tracks={data.tracks} campusMember={campusMember} />
        </div>
      </div>
    </div>
  );
}

/** Link card in the feature-card shape: diagram thumbnail, title, one line. */
function FeatureLink({
  href,
  title,
  description,
  diagram,
}: {
  href: "/patterns";
  title: string;
  description: string;
  diagram: "window";
}) {
  return (
    <Link
      href={href}
      className="group flex overflow-hidden rounded-xl border border-border bg-card transition-colors hover:border-brand-500/40"
    >
      <MiniDiagram kind={diagram} className="w-32 shrink-0 border-r sm:w-40" />
      <div className="min-w-0 flex-1 p-4">
        <h2 className="flex items-center gap-1.5 font-semibold transition-colors group-hover:text-brand-200">
          {title}
          <ArrowUpRight className="size-3.5 text-muted-foreground" aria-hidden="true" />
        </h2>
        <p className="mt-1 text-sm leading-snug text-muted-foreground">{description}</p>
      </div>
    </Link>
  );
}

/**
 * Due-for-review call to action.
 *
 * Only rendered when something is actually due. A card that permanently
 * says "0 items" is noise, and worse, it trains people to ignore the one
 * place that tells them there is work waiting.
 *
 * The count comes from the same scheduler query the review queue uses, so
 * it cannot disagree with what the session then serves.
 */
function DueForReviewCard({ count }: { count: number }) {
  return (
    <Link
      href="/review"
      className="group flex overflow-hidden rounded-xl border border-brand-500/35 bg-brand-500/6 transition-colors hover:border-brand-500/60"
    >
      <MiniDiagram
        kind="stack"
        className="w-32 shrink-0 border-r border-brand-500/20 sm:w-40"
      />
      <div className="relative min-w-0 flex-1 p-4">
        <div className="flex items-center gap-2">
          <Repeat2 className="size-4 shrink-0 text-brand-400" aria-hidden="true" />
          <h2 className="font-semibold">Due for review</h2>
          <ArrowRight
            className="ml-auto size-4 shrink-0 text-brand-400 transition-transform group-hover:translate-x-0.5"
            aria-hidden="true"
          />
        </div>
        <p className="mt-1 text-sm leading-snug text-muted-foreground">
          <span className="font-medium text-brand-200">
            <span className="tabular">{count}</span> item{count === 1 ? "" : "s"}
          </span>{" "}
          ready to recall. A few minutes now is worth an hour of re-reading later.
        </p>
      </div>
    </Link>
  );
}

function ContinueLearningCard({ data }: { data: Data["continueLearning"] }) {
  if (!data) {
    return (
      <div className="flex overflow-hidden rounded-xl border border-border bg-card">
        <MiniDiagram kind="pointers" className="w-32 shrink-0 border-r sm:w-40" />
        <div className="min-w-0 flex-1 p-4">
          <h2 className="flex items-center gap-1.5 font-semibold">
            <BookOpenCheck
              className="size-4 text-muted-foreground"
              aria-hidden="true"
            />
            Continue learning
          </h2>
          <p className="mt-1 text-sm leading-snug text-muted-foreground">
            No published curriculum yet. Once a course is published it will appear here
            with your position in it.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex overflow-hidden rounded-xl border border-border bg-card">
      <MiniDiagram kind="pointers" className="w-32 shrink-0 border-r sm:w-40" />
      <div className="min-w-0 flex-1 p-4">
        <p className="text-[0.68rem] font-medium tracking-wider text-muted-foreground uppercase">
          Continue learning
        </p>
        <h2 className="mt-1 truncate font-semibold">{data.chapterTitle}</h2>
        <p className="truncate text-xs text-muted-foreground">
          {data.courseTitle} · {data.sectionTitle}
        </p>
        <div className="mt-3 flex items-center gap-3">
          <Bar
            percent={data.percent}
            label={`${data.percent}% through ${data.chapterTitle}`}
            className="flex-1"
          />
          <span className="font-mono text-xs text-muted-foreground tabular-nums">
            {data.percent}%
          </span>
          <Button asChild size="sm" className="shrink-0">
            <Link href={route(data.href)}>
              {data.percent > 0 ? "Continue" : "Start"}
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * Progress against a weekly target the learner set themselves.
 *
 * Absent entirely when they never set one — a bar reading "0 of 0" would
 * imply a goal they never chose. Over-achieving is shown as over-achieving
 * rather than clamped to 100%, because clamping hides the interesting part.
 */
function WeeklyTargetCard({ target }: { target: Data["weeklyTarget"] }) {
  if (!target) return null;

  const percent = Math.min(100, Math.round((target.done / target.target) * 100));
  const met = target.done >= target.target;

  return (
    <Panel
      title="This week"
      action={
        met ? (
          <span className="rounded-full bg-brand-500/15 px-2 py-0.5 text-[0.68rem] font-semibold text-brand-300">
            Target met
          </span>
        ) : undefined
      }
      bodyClassName="p-4 sm:px-5"
    >
      <p className="text-sm">
        <span
          className={cn("text-lg font-semibold tabular-nums", met && "text-brand-300")}
        >
          {target.done}
        </span>
        <span className="text-muted-foreground">
          {" "}
          of {target.target} chapters and problems
        </span>
      </p>

      <div
        role="progressbar"
        aria-valuenow={target.done}
        aria-valuemin={0}
        aria-valuemax={target.target}
        aria-label="Progress against your weekly target"
        className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted"
      >
        <div
          className="h-full rounded-full bg-brand-500 transition-all"
          style={{ width: `${percent}%` }}
        />
      </div>

      <p className="mt-2 text-xs text-muted-foreground/70">
        Since{" "}
        {target.since.toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
        })}
        . Nothing happens if you miss it — change it in settings.
      </p>
    </Panel>
  );
}

function ViewAll({
  href,
  children,
}: {
  href: "/problems" | "/patterns";
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-brand-300"
    >
      {children}
      <ArrowRight className="size-3.5" aria-hidden="true" />
    </Link>
  );
}

function TodaysPracticeCard({ problems }: { problems: Data["recommendedProblems"] }) {
  return (
    <Panel
      title="Today’s practice"
      description="Picked from what you have attempted so far."
      action={<ViewAll href="/problems">All problems</ViewAll>}
    >
      {problems.length === 0 ? (
        <EmptyState
          icon={Target}
          title="Nothing to recommend yet"
          description="Recommendations come from what you have attempted. Solve a problem and this fills in."
          size="sm"
          action={
            <Button asChild size="sm" variant="outline">
              <Link href="/problems">Browse problems</Link>
            </Button>
          }
        />
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th scope="col" className="w-12 px-4 py-2.5 font-medium sm:px-5">
                #
              </th>
              <th scope="col" className="px-2 py-2.5 font-medium">
                Problem
              </th>
              <th
                scope="col"
                className="w-20 px-4 py-2.5 text-right font-medium sm:w-24 sm:px-5"
              >
                Difficulty
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {problems.map((problem) => (
              <tr key={problem.id} className="transition-colors hover:bg-accent/25">
                <td className="px-4 py-3 align-top font-mono text-xs text-muted-foreground tabular-nums sm:px-5">
                  {problem.number}
                </td>
                <td className="min-w-0 px-2 py-3">
                  <Link
                    href={route(`/problems/${problem.slug}`)}
                    className="font-medium text-info transition-colors hover:text-brand-300"
                  >
                    {problem.title}
                  </Link>
                  {/* Rendered once, under the title, at every width: a second
                      copy in its own column would be read twice by a screen
                      reader and matched twice by anything looking for it. */}
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {problem.reason}
                  </span>
                </td>
                <td className="px-4 py-3 text-right align-top sm:px-5">
                  <DifficultyBadge difficulty={problem.difficulty} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Panel>
  );
}

function RecentActivityCard({
  submissions,
}: {
  submissions: Data["recentSubmissions"];
}) {
  return (
    <Panel title="Recent submissions">
      {submissions.length === 0 ? (
        <EmptyState
          icon={CircleDot}
          title="No submissions yet"
          description="Submit a solution to any problem and it is listed here."
          size="sm"
        />
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th scope="col" className="px-4 py-2.5 font-medium sm:px-5">
                Problem
              </th>
              <th
                scope="col"
                className="hidden w-28 px-2 py-2.5 font-medium sm:table-cell"
              >
                Language
              </th>
              <th
                scope="col"
                className="hidden w-24 px-2 py-2.5 font-medium sm:table-cell"
              >
                When
              </th>
              <th
                scope="col"
                className="w-20 px-4 py-2.5 text-right font-medium sm:px-5"
              >
                Result
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {submissions.map((submission) => {
              const passed = submission.status === "ACCEPTED";
              return (
                <tr
                  key={submission.id}
                  className="transition-colors hover:bg-accent/25"
                >
                  <td className="px-4 py-2.5 sm:px-5">
                    <Link
                      href={route(`/problems/${submission.problemSlug}`)}
                      className="text-info transition-colors hover:text-brand-300"
                    >
                      {submission.problemTitle}
                    </Link>
                  </td>
                  <td className="hidden px-2 py-2.5 text-xs text-muted-foreground sm:table-cell">
                    {LANGUAGE_LABEL[submission.language] ?? submission.language}
                  </td>
                  <td className="hidden px-2 py-2.5 text-xs text-muted-foreground tabular-nums sm:table-cell">
                    <time dateTime={submission.createdAt.toISOString()}>
                      {submission.createdAt.toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </time>
                  </td>
                  <td
                    className={cn(
                      "px-4 py-2.5 text-right text-xs font-medium sm:px-5",
                      passed ? "text-success" : "text-muted-foreground"
                    )}
                  >
                    {passed ? "Passed" : "Failed"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </Panel>
  );
}

function WeakPatternsCard({ patterns }: { patterns: Data["weakPatterns"] }) {
  return (
    <Panel
      title="Needs work"
      action={
        patterns.length > 0 ? <ViewAll href="/patterns">Patterns</ViewAll> : undefined
      }
    >
      {patterns.length === 0 ? (
        <EmptyState
          icon={Shapes}
          title="No weak patterns"
          description="This is measured from your attempts, so it stays empty until you have practised."
          size="sm"
          action={
            <Button asChild size="sm" variant="outline">
              <Link href="/patterns">Browse patterns</Link>
            </Button>
          }
        />
      ) : (
        <ul className="divide-y divide-border">
          {patterns.map((pattern) => (
            <li key={pattern.id}>
              <Link
                href={route(`/patterns/${pattern.slug}`)}
                className="block px-4 py-3 transition-colors hover:bg-accent/30 sm:px-5"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-sm font-medium">{pattern.name}</span>
                  <span className="shrink-0 font-mono text-xs text-muted-foreground tabular-nums">
                    {pattern.solved}/{pattern.attempts}
                  </span>
                </div>
                <div
                  className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted"
                  role="img"
                  aria-label={`Mastery ${pattern.score} out of 100`}
                >
                  <div
                    className="h-full rounded-full bg-brand-600"
                    style={{ width: `${Math.max(3, pattern.score)}%` }}
                  />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function QuizPerformanceCard({
  performance,
}: {
  performance: Data["quizPerformance"];
}) {
  return (
    <Panel title="Quiz performance">
      {!performance ? (
        <EmptyState
          icon={BrainCircuit}
          title="No quiz attempts yet"
          description="Chapters end with a short quiz. Your average shows up here once you take one."
          size="sm"
        />
      ) : (
        <div className="space-y-3 p-4 sm:px-5">
          <div className="flex items-baseline justify-between">
            <span className="text-xs text-muted-foreground">Average score</span>
            <span className="tabular text-lg font-semibold">
              {performance.averagePercent}%
            </span>
          </div>
          <div
            className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
            role="img"
            aria-label={`Average quiz score ${performance.averagePercent} percent`}
          >
            <div
              className="h-full rounded-full bg-brand-500"
              style={{ width: `${Math.max(2, performance.averagePercent)}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground tabular-nums">
            {performance.passed} passed of {performance.attempts} attempt
            {performance.attempts === 1 ? "" : "s"}
          </p>
        </div>
      )}
    </Panel>
  );
}

/**
 * The tracks beyond DSA.
 *
 * Counts of the learner's own submissions against what is published.
 * Rendered even at zero: "0 of 3 design exercises submitted" is a true
 * statement and a useful prompt, unlike a fabricated score.
 */
function TracksCard({
  tracks,
  campusMember,
}: {
  tracks: Data["tracks"];
  campusMember: boolean;
}) {
  const rows = [
    {
      label: "System design",
      href: "/system-design" as const,
      done: tracks.systemDesign.submitted,
      total: tracks.systemDesign.total,
    },
    {
      label: "Low-level design",
      href: "/lld" as const,
      done: tracks.lld.submitted,
      total: tracks.lld.total,
    },
  ];

  return (
    <Panel
      title={campusMember ? "Design and interviews" : "Design exercises"}
      bodyClassName="space-y-4 p-4 sm:px-5"
    >
      {rows.map((row) => (
        <div key={row.label}>
          <div className="flex items-baseline justify-between gap-3">
            <Link
              href={route(row.href)}
              className="text-sm transition-colors hover:text-brand-300"
            >
              {row.label}
            </Link>
            <span className="text-xs text-muted-foreground tabular-nums">
              {row.done} of {row.total} submitted
            </span>
          </div>
          <Bar
            percent={row.total ? (row.done / row.total) * 100 : 0}
            label={`${row.label} progress`}
            className="mt-2"
          />
        </div>
      ))}

      {/* Mock interviews are part of Campus. */}
      {campusMember && (
        <div className="flex items-baseline justify-between gap-3 border-t border-border pt-3">
          <Link
            href={route("/interviews")}
            className="shrink-0 text-sm whitespace-nowrap transition-colors hover:text-brand-300"
          >
            Mock interviews
          </Link>
          <span className="text-right text-xs text-muted-foreground tabular-nums">
            {tracks.interviews.completed} completed · {tracks.interviews.withFeedback}{" "}
            with feedback
          </span>
        </div>
      )}
    </Panel>
  );
}
