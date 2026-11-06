import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Trophy } from "lucide-react";

import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { Badge } from "@/components/ui/badge";
import { route } from "@/lib/utils";
import { getCurrentUser } from "@/lib/auth/session";
import { contestPhase, getMyContests, listContests } from "@/services/contests";

export const metadata: Metadata = {
  title: "Contests",
  description: "Timed problem sets with live standings.",
  alternates: { canonical: "/contests" },
};

const PHASE = {
  upcoming: { label: "Upcoming", variant: "info" },
  live: { label: "Live", variant: "success" },
  ended: { label: "Ended", variant: "outline" },
} as const;

export default async function ContestsPage() {
  const contests = await listContests();
  const now = new Date();
  const user = await getCurrentUser();
  const mine = user ? await getMyContests(user.id, now) : [];

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
      <PageHeader
        eyebrow="Compete"
        title="Contests"
        description="A set of problems and a clock. Points for each solve; ties go to whoever got there sooner with fewer failed attempts."
      />
      {mine.length > 0 && (
        <section aria-labelledby="my-contests-heading" className="mt-6">
          <h2 id="my-contests-heading" className="text-sm font-semibold">
            Your contests
          </h2>
          <ul className="mt-2 divide-y divide-border border-y border-border text-sm">
            {mine.map((contest) => (
              <li
                key={contest.slug}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5"
              >
                <Link
                  href={route(`/contests/${contest.slug}`)}
                  className="font-medium text-info hover:text-brand-300"
                >
                  {contest.title}
                </Link>
                <Badge variant={PHASE[contest.phase].variant}>
                  {PHASE[contest.phase].label}
                </Badge>
                <span className="font-mono text-xs text-muted-foreground tabular-nums sm:ml-auto">
                  {contest.phase === "upcoming"
                    ? `Starts ${contest.startsAt.toISOString().slice(0, 16).replace("T", " ")} UTC`
                    : `Rank ${contest.rank ?? "-"} of ${contest.entrants} · ${contest.solved} solved · ${contest.score} pts`}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {contests.length === 0 ? (
        <EmptyState
          icon={Trophy}
          title="No contests are scheduled"
          description="When one is announced it will appear here with its start time and problems."
        />
      ) : (
        <ul className="mt-6 divide-y divide-border border-y border-border">
          {contests.map((c) => {
            const phase = PHASE[contestPhase(c, now)];
            return (
              <li key={c.slug}>
                <Link
                  href={route(`/contests/${c.slug}`)}
                  className="group flex items-center gap-4 py-4 outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium group-hover:text-brand-300">
                      {c.title}
                    </span>
                    <span className="mt-0.5 block font-mono text-xs text-subtle-foreground">
                      {c.startsAt.toISOString().slice(0, 16).replace("T", " ")} UTC ·{" "}
                      {c._count.problems} problems · {c._count.entries} entered
                    </span>
                  </span>
                  <Badge variant={phase.variant}>{phase.label}</Badge>
                  <ChevronRight
                    className="size-4 text-muted-foreground"
                    aria-hidden="true"
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
