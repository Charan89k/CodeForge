import type { Metadata } from "next";

import { SectionHeading } from "@/components/common/section-heading";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { APTITUDE_TOPICS, aptitudeTopic } from "@/data/aptitude";
import { requireAdmin } from "@/lib/auth/session";
import { DIFFICULTIES, DIFFICULTY_LABELS } from "@/lib/catalogue/filters";
import { listAptitudeForAdmin } from "@/services/aptitude";

import {
  archiveQuestionAction,
  createQuestionAction,
  publishQuestionAction,
} from "./actions";

export const metadata: Metadata = { title: "Aptitude" };

const MESSAGES: Record<string, string> = {
  created: "Draft saved. A different admin must review it.",
  invalid:
    "Check the fields: 2 to 8 different options, with * on the one correct answer.",
  published: "Published.",
  archived: "Archived.",
  refused: "A different admin must review your own question.",
};

const field = "text-sm font-medium";

export default async function AdminAptitudePage({
  searchParams,
}: PageProps<"/admin/aptitude">) {
  const admin = await requireAdmin();
  const { msg } = await searchParams;
  const message = typeof msg === "string" ? MESSAGES[msg] : undefined;
  const { drafts, counts } = await listAptitudeForAdmin();

  return (
    <div className="space-y-8 text-sm">
      {message && (
        <p role="status" className="rounded-md border border-border p-3">
          {message}
        </p>
      )}
      <section aria-labelledby="published-heading">
        <SectionHeading id="published-heading" title="Published questions" />
        <dl className="mt-3 flex flex-wrap gap-x-8 gap-y-2">
          {APTITUDE_TOPICS.map((topic) => (
            <div key={topic.key}>
              <dt className="text-xs text-muted-foreground">{topic.title}</dt>
              <dd className="font-mono text-lg tabular-nums">
                {counts[topic.key] ?? 0}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="new-question">
        <SectionHeading
          id="new-question"
          title="New question"
          description="Write it yourself or name its licence. Never copy from another site."
        />
        <form
          action={createQuestionAction}
          className="mt-3 grid max-w-2xl gap-3 sm:grid-cols-2"
        >
          <div>
            <label htmlFor="q-topic" className={field}>
              Topic
            </label>
            <NativeSelect id="q-topic" name="topic" className="mt-1">
              {APTITUDE_TOPICS.map((topic) => (
                <option key={topic.key} value={topic.key}>
                  {topic.title}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div>
            <label htmlFor="q-difficulty" className={field}>
              Difficulty
            </label>
            <NativeSelect
              id="q-difficulty"
              name="difficulty"
              defaultValue="MEDIUM"
              className="mt-1"
            >
              {DIFFICULTIES.map((level) => (
                <option key={level} value={level}>
                  {DIFFICULTY_LABELS[level]}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="q-prompt" className={field}>
              Question
            </label>
            <Textarea
              id="q-prompt"
              name="prompt"
              required
              maxLength={1000}
              rows={2}
              className="mt-1"
            />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="q-options" className={field}>
              Options, one per line, with * before the correct one
            </label>
            <Textarea
              id="q-options"
              name="optionLines"
              required
              maxLength={2000}
              rows={4}
              className="mt-1 font-mono"
            />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="q-explanation" className={field}>
              Explanation
            </label>
            <Textarea
              id="q-explanation"
              name="explanation"
              required
              maxLength={2000}
              rows={2}
              className="mt-1"
            />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="q-source" className={field}>
              Source
            </label>
            <Input
              id="q-source"
              name="source"
              required
              maxLength={200}
              defaultValue="Original"
              className="mt-1"
            />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit">Save draft</Button>
          </div>
        </form>
      </section>

      <section aria-labelledby="drafts-heading">
        <SectionHeading
          id="drafts-heading"
          title="Waiting for review"
          count={drafts.length}
        />
        {drafts.length === 0 ? (
          <p className="py-4 text-muted-foreground">No draft is waiting.</p>
        ) : (
          <ul className="divide-y divide-border">
            {drafts.map((draft) => (
              <li key={draft.id} className="space-y-2 py-4">
                <p className="text-xs text-muted-foreground">
                  {aptitudeTopic(draft.topic)?.title ?? draft.topic} ·{" "}
                  {DIFFICULTY_LABELS[draft.difficulty]} · {draft.source}
                </p>
                <p className="font-medium">{draft.prompt}</p>
                <ol className="list-[upper-alpha] pl-5">
                  {draft.options.map((option, index) => (
                    <li
                      key={option}
                      className={
                        index === draft.answer ? "font-medium text-success" : undefined
                      }
                    >
                      {option}
                    </li>
                  ))}
                </ol>
                <p className="text-muted-foreground">{draft.explanation}</p>
                <div className="flex flex-wrap items-center gap-2">
                  {draft.authorId === admin.id ? (
                    <span className="text-xs text-muted-foreground">
                      Waiting for a different admin to review your question.
                    </span>
                  ) : (
                    <form action={publishQuestionAction.bind(null, draft.id)}>
                      <Button type="submit" size="sm">
                        Publish
                      </Button>
                    </form>
                  )}
                  <form action={archiveQuestionAction.bind(null, draft.id)}>
                    <Button type="submit" size="sm" variant="outline">
                      Archive
                    </Button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
