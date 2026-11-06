import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CmsForm } from "@/components/admin/cms-forms";
import { SectionHeading } from "@/components/common/section-heading";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { requireAdmin } from "@/lib/auth/session";
import { route } from "@/lib/utils";
import { getChapterForEditing } from "@/services/cms";

import {
  publishRevisionAction,
  rejectRevisionAction,
  restoreRevisionAction,
  saveDraftAction,
  submitForReviewAction,
} from "../../../actions";

export const metadata: Metadata = { title: "Edit chapter" };

const label = "text-sm font-medium";
const STATUS_VARIANT = {
  DRAFT: "outline",
  IN_REVIEW: "info",
  PUBLISHED: "success",
  REJECTED: "destructive",
} as const;

export default async function AdminChapterPage({
  params,
}: PageProps<"/admin/courses/[courseId]/chapters/[chapterId]">) {
  await requireAdmin();
  const { courseId, chapterId } = await params;
  const chapter = await getChapterForEditing(chapterId);
  if (!chapter || chapter.section.course.id !== courseId) notFound();

  const latest = chapter.revisions[0];
  const source = latest ?? chapter;
  // A chapter seeded before the CMS has blocks but no Markdown, so it edits as
  // blocks. Converting it would silently drop its richer block types.
  const hasBlocksOnly =
    latest?.markdown == null &&
    Array.isArray(source.content) &&
    source.content.length > 0;
  const format = hasBlocksOnly ? "blocks" : "markdown";
  const sourceText = hasBlocksOnly
    ? JSON.stringify(source.content, null, 2)
    : (latest?.markdown ?? "");

  return (
    <div className="space-y-8 text-sm">
      <div>
        <Link
          href={route(`/admin/courses/${courseId}`)}
          className="text-muted-foreground hover:text-foreground"
        >
          {chapter.section.course.title} / {chapter.section.title}
        </Link>
        <h2 className="mt-1 flex items-center gap-2 text-lg font-semibold">
          {chapter.title}
          <Badge variant={chapter.status === "PUBLISHED" ? "success" : "outline"}>
            {chapter.status.toLowerCase()}
          </Badge>
        </h2>
        <p className="mt-1 text-muted-foreground">
          Saving never changes what learners read. A version goes live when it is
          submitted and published.
        </p>
      </div>

      <section aria-labelledby="editor">
        <SectionHeading
          id="editor"
          title={latest?.status === "DRAFT" ? `Draft v${latest.number}` : "New draft"}
        />
        <CmsForm
          action={saveDraftAction.bind(null, chapter.id, format)}
          submitLabel="Save draft"
          savedLabel="Draft saved."
          className="mt-3 max-w-4xl"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor="draft-title" className={label}>
                Title
              </label>
              <Input
                id="draft-title"
                name="title"
                required
                maxLength={160}
                defaultValue={source.title}
                className="mt-1"
              />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="draft-summary" className={label}>
                Summary
              </label>
              <Input
                id="draft-summary"
                name="summary"
                maxLength={500}
                defaultValue={source.summary ?? ""}
                className="mt-1"
              />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="draft-source" className={label}>
                {format === "markdown" ? "Lesson" : "Lesson blocks (JSON)"}
              </label>
              {format === "markdown" && (
                <p id="draft-help" className="mt-0.5 text-xs text-subtle-foreground">
                  ## and ### headings, lists, ``` code, | tables, &gt; [!tip] callouts,
                  :::visualization key, :::problems slug slug, :::quiz slug
                </p>
              )}
              <Textarea
                id="draft-source"
                name="source"
                rows={20}
                aria-describedby={format === "markdown" ? "draft-help" : undefined}
                defaultValue={sourceText}
                className="mt-1 font-mono text-xs"
              />
            </div>
            <div>
              <label htmlFor="draft-objectives" className={label}>
                Objectives, one per line
              </label>
              <Textarea
                id="draft-objectives"
                name="objectives"
                defaultValue={source.objectives.join("\n")}
                className="mt-1"
              />
            </div>
            <div>
              <label htmlFor="draft-takeaways" className={label}>
                Key takeaways, one per line
              </label>
              <Textarea
                id="draft-takeaways"
                name="keyTakeaways"
                defaultValue={source.keyTakeaways.join("\n")}
                className="mt-1"
              />
            </div>
            <div>
              <label htmlFor="draft-minutes" className={label}>
                Reading minutes
              </label>
              <Input
                id="draft-minutes"
                name="readingMinutes"
                type="number"
                min={1}
                max={240}
                defaultValue={source.readingMinutes}
                className="mt-1"
              />
            </div>
            <div>
              <label htmlFor="draft-difficulty" className={label}>
                Difficulty
              </label>
              <NativeSelect
                id="draft-difficulty"
                name="difficulty"
                defaultValue={source.difficulty}
                className="mt-1 w-full"
              >
                <option value="EASY">Easy</option>
                <option value="MEDIUM">Medium</option>
                <option value="HARD">Hard</option>
              </NativeSelect>
            </div>
          </div>
        </CmsForm>
      </section>

      <section aria-labelledby="versions">
        <SectionHeading
          id="versions"
          title="Versions"
          count={chapter.revisions.length}
        />
        {chapter.revisions.length === 0 ? (
          <p className="mt-3 text-muted-foreground">
            Save a draft to start the history.
          </p>
        ) : (
          <ul className="mt-2 divide-y divide-border">
            {chapter.revisions.map((revision) => (
              <li key={revision.id} className="py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs">v{revision.number}</span>
                  <Badge variant={STATUS_VARIANT[revision.status]}>
                    {revision.status.toLowerCase().replace("_", " ")}
                  </Badge>
                  <span className="text-muted-foreground">{revision.title}</span>
                  <span className="ml-auto font-mono text-xs text-subtle-foreground">
                    {revision.author.email} ·{" "}
                    {revision.updatedAt.toISOString().slice(0, 16).replace("T", " ")}{" "}
                    UTC
                  </span>
                </div>
                {revision.reviewNote && (
                  <p className="mt-1 text-muted-foreground">
                    Review note: {revision.reviewNote}
                  </p>
                )}
                <div className="mt-2 flex flex-wrap items-start gap-3">
                  <Link
                    href={route(
                      `/admin/courses/${courseId}/chapters/${chapterId}/preview/${revision.id}`
                    )}
                    className="pt-1.5 text-info hover:underline"
                  >
                    Preview
                  </Link>
                  {revision.status === "DRAFT" && (
                    <CmsForm
                      action={submitForReviewAction.bind(null, revision.id)}
                      submitLabel="Submit for review"
                      savedLabel="Submitted."
                      size="sm"
                      variant="outline"
                      className="[&>div]:mt-0"
                    />
                  )}
                  {revision.status === "IN_REVIEW" && (
                    <>
                      <CmsForm
                        action={publishRevisionAction.bind(null, revision.id)}
                        submitLabel="Publish"
                        savedLabel="Published."
                        size="sm"
                        className="[&>div]:mt-0"
                      />
                      <CmsForm
                        action={rejectRevisionAction.bind(null, revision.id)}
                        submitLabel="Send back"
                        savedLabel="Sent back."
                        size="sm"
                        variant="outline"
                      >
                        <label htmlFor={`note-${revision.id}`} className="sr-only">
                          What needs to change
                        </label>
                        <Input
                          id={`note-${revision.id}`}
                          name="note"
                          placeholder="What needs to change"
                          maxLength={2000}
                        />
                      </CmsForm>
                    </>
                  )}
                  {(revision.status === "PUBLISHED" ||
                    revision.status === "REJECTED") && (
                    <CmsForm
                      action={restoreRevisionAction.bind(null, revision.id)}
                      submitLabel="Start a draft from this"
                      savedLabel="Draft started."
                      size="sm"
                      variant="ghost"
                      className="[&>div]:mt-0"
                    />
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
