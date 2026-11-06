"use client";

import { useEffect, useRef, useState, useTransition } from "react";

import { submitAptitudeAction } from "@/app/(shell)/aptitude/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { AptitudeResult } from "@/data/aptitude";
import { cn } from "@/lib/utils";

type Question = { id: string; prompt: string; options: readonly string[] };

const SECONDS_PER_QUESTION = 60;

function clock(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export function AptitudeSet({
  topic,
  difficulty,
  questions,
}: {
  topic: string;
  difficulty: string | null;
  questions: Question[];
}) {
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [result, setResult] = useState<AptitudeResult | null>(null);
  const [failed, setFailed] = useState(false);
  const [pending, start] = useTransition();
  const [remaining, setRemaining] = useState<number | null>(null);
  const limit = questions.length * SECONDS_PER_QUESTION;
  const latestAnswers = useRef(answers);

  const review = new Map(result?.review.map((r) => [r.id, r]));
  const timed = remaining !== null;

  function submit() {
    setFailed(false);
    const seconds = remaining === null ? null : limit - remaining;
    setRemaining(null);
    start(async () => {
      try {
        const graded = await submitAptitudeAction(topic, difficulty, {
          ids: questions.map((q) => q.id),
          answers: latestAnswers.current,
          seconds,
        });
        setResult(graded);
        setFailed(!graded);
      } catch {
        setFailed(true);
      }
    });
  }

  useEffect(() => {
    if (remaining === null) return;
    if (remaining <= 0) {
      const timeUp = setTimeout(submit, 0);
      return () => clearTimeout(timeUp);
    }
    const tick = setTimeout(() => setRemaining(remaining - 1), 1000);
    return () => clearTimeout(tick);
    // `submit` closes over `remaining`, the only value that changes this effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining]);

  function choose(id: string, index: number) {
    const next = { ...latestAnswers.current, [id]: index };
    latestAnswers.current = next;
    setAnswers(next);
  }

  function restart() {
    latestAnswers.current = {};
    setAnswers({});
    setResult(null);
    setRemaining(null);
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      {result && (
        <Alert variant="info" role="status" className="mb-4">
          <AlertDescription>
            You got <span className="font-mono">{result.correct}</span> of{" "}
            <span className="font-mono">{result.total}</span>. Explanations are below.
          </AlertDescription>
        </Alert>
      )}
      {failed && (
        <Alert variant="destructive" role="alert" className="mb-4">
          <AlertDescription>That could not be checked. Try again.</AlertDescription>
        </Alert>
      )}
      {!result && (
        <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
          {timed ? (
            <p role="timer" aria-label="Time remaining" className="font-mono text-base">
              {clock(remaining)}
            </p>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setRemaining(limit)}
            >
              Start timed: {clock(limit)}
            </Button>
          )}
          <span className="text-xs text-muted-foreground">
            {timed
              ? "The set is checked automatically when time runs out."
              : `${SECONDS_PER_QUESTION} seconds a question. For your own practice: it does not affect anything.`}
          </span>
        </div>
      )}
      <ol className="space-y-6">
        {questions.map((q, i) => {
          const r = review.get(q.id);
          return (
            <li key={q.id}>
              <fieldset disabled={Boolean(result)}>
                <legend className="text-sm font-medium">
                  <span className="mr-2 font-mono text-xs text-subtle-foreground">
                    {i + 1}
                  </span>
                  {q.prompt}
                </legend>
                <div className="mt-2 space-y-1">
                  {q.options.map((option, index) => (
                    <label
                      key={option}
                      className={cn(
                        "flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm",
                        r && index === r.answer && "border-success/60 text-success",
                        r &&
                          index === r.chosen &&
                          index !== r.answer &&
                          "border-destructive/60"
                      )}
                    >
                      <input
                        type="radio"
                        name={q.id}
                        checked={answers[q.id] === index}
                        onChange={() => choose(q.id, index)}
                      />
                      {option}
                    </label>
                  ))}
                </div>
                {r && (
                  <p className="mt-2 text-sm text-muted-foreground">{r.explanation}</p>
                )}
              </fieldset>
            </li>
          );
        })}
      </ol>
      <div className="mt-6">
        {result ? (
          <Button type="button" variant="outline" onClick={restart}>
            Try again
          </Button>
        ) : (
          <Button type="submit" disabled={pending}>
            {pending ? "Checking..." : "Check my answers"}
          </Button>
        )}
      </div>
    </form>
  );
}
