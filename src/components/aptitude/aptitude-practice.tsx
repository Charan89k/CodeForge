import Link from "next/link";
import { Calculator } from "lucide-react";

import { AptitudeSet } from "@/components/aptitude/aptitude-set";
import { EmptyState } from "@/components/common/empty-state";
import { SectionHeading } from "@/components/common/section-heading";
import { Badge } from "@/components/ui/badge";
import { APTITUDE_TOPICS, aptitudeTopic } from "@/data/aptitude";
import { DIFFICULTIES, DIFFICULTY_LABELS } from "@/lib/catalogue/filters";
import { cn, route } from "@/lib/utils";
import {
  WEAK_TOPIC_BELOW_PERCENT,
  WEAK_TOPIC_MIN_QUESTIONS,
  getAptitudePerformance,
  getAptitudeSet,
  listRecentAptitudeSets,
} from "@/services/aptitude";

type Params = { topic?: string | string[]; difficulty?: string | string[] };

async function Performance({ userId, basePath }: { userId: string; basePath: string }) {
  const performance = await getAptitudePerformance(userId);
  if (performance.length === 0) return null;
  const recent = await listRecentAptitudeSets(userId);
  const titleOf = (key: string) => aptitudeTopic(key)?.title ?? key;

  return (
    <section aria-labelledby="performance-heading" className="mt-10">
      <SectionHeading
        id="performance-heading"
        title="Your performance"
        description={`Weak means under ${WEAK_TOPIC_BELOW_PERCENT}% correct across at least ${WEAK_TOPIC_MIN_QUESTIONS} questions. Only you see this; a college does not.`}
      />
      <ul className="mt-2 divide-y divide-border text-sm">
        {performance.map((row) => (
          <li
            key={row.topic}
            className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2"
          >
            <Link
              href={route(`${basePath}?topic=${row.topic}`)}
              className="font-medium text-info transition-colors hover:text-brand-300"
            >
              {row.title}
            </Link>
            {row.weak && <Badge variant="warning">Practise next</Badge>}
            <span className="ml-auto font-mono text-xs text-muted-foreground tabular-nums">
              {row.percent}% · {row.correct}/{row.total} · {row.sets} set
              {row.sets === 1 ? "" : "s"}
            </span>
          </li>
        ))}
      </ul>
      <SectionHeading id="recent-heading" title="Your recent sets" className="mt-8" />
      <ul className="mt-2 divide-y divide-border text-sm">
        {recent.map((attempt) => (
          <li key={attempt.id} className="flex justify-between gap-3 py-2">
            <span>
              {titleOf(attempt.topic)}
              {attempt.timed && attempt.seconds !== null
                ? ` · timed, ${attempt.seconds}s`
                : ""}
            </span>
            <span className="font-mono text-xs text-muted-foreground">
              {attempt.correct}/{attempt.total} ·{" "}
              {attempt.createdAt.toISOString().slice(0, 10)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Practice, shared by Learn's `/aptitude` and Campus's `/campus/aptitude`. */
export async function AptitudePractice({
  basePath,
  userId,
  params,
}: {
  basePath: string;
  userId: string | null;
  params: Params;
}) {
  const topic =
    (typeof params.topic === "string" ? aptitudeTopic(params.topic) : null) ??
    APTITUDE_TOPICS[0]!;
  const difficulty = DIFFICULTIES.find((known) => known === params.difficulty) ?? null;
  const questions = await getAptitudeSet({ topic: topic.key, difficulty });
  const href = (nextTopic: string, nextDifficulty: string | null) =>
    route(
      `${basePath}?topic=${nextTopic}${nextDifficulty ? `&difficulty=${nextDifficulty}` : ""}`
    );

  return (
    <>
      <nav
        aria-label="Topics"
        className="mt-5 flex overflow-x-auto border-b border-border"
      >
        {APTITUDE_TOPICS.map((t) => (
          <Link
            key={t.key}
            href={href(t.key, difficulty)}
            aria-current={t.key === topic.key ? "page" : undefined}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm whitespace-nowrap",
              t.key === topic.key
                ? "border-primary font-medium text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {t.title}
          </Link>
        ))}
      </nav>
      <p className="mt-4 text-sm text-muted-foreground">{topic.description}</p>
      <nav aria-label="Difficulty" className="mt-3 flex flex-wrap gap-2 text-xs">
        {[null, ...DIFFICULTIES].map((level) => (
          <Link
            key={level ?? "any"}
            href={href(topic.key, level)}
            aria-current={level === difficulty ? "page" : undefined}
            className={cn(
              "rounded-full border border-border px-3 py-1",
              level === difficulty
                ? "border-primary font-medium text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {level ? DIFFICULTY_LABELS[level] : "Any level"}
          </Link>
        ))}
      </nav>
      <div className="mt-5">
        {questions.length === 0 ? (
          <EmptyState
            icon={Calculator}
            title="No questions here yet"
            description="Try another level or topic. Questions appear once an admin has reviewed them."
          />
        ) : (
          // Keyed so a new topic or level starts a fresh set. No answers cross this line.
          <AptitudeSet
            key={`${topic.key}-${difficulty ?? "any"}`}
            topic={topic.key}
            difficulty={difficulty}
            questions={questions}
          />
        )}
      </div>
      {userId ? (
        <Performance userId={userId} basePath={basePath} />
      ) : (
        <p className="mt-8 text-sm text-muted-foreground">
          <Link href="/login" className="text-info hover:text-brand-300">
            Sign in
          </Link>{" "}
          to keep your scores and see your weak topics.
        </p>
      )}
    </>
  );
}
