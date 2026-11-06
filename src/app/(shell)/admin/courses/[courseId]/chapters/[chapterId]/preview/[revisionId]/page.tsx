import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ContentRenderer } from "@/components/learning/content-renderer";
import { requireAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { route } from "@/lib/utils";
import { parseContent } from "@/lib/validation/content";

export const metadata: Metadata = {
  title: "Preview",
  robots: { index: false, follow: false },
};

/**
 * Any version's text and structure, as a learner would read it. Quizzes and
 * linked problems show as references here; they resolve once published.
 */
export default async function RevisionPreviewPage({
  params,
}: PageProps<"/admin/courses/[courseId]/chapters/[chapterId]/preview/[revisionId]">) {
  await requireAdmin();
  const { courseId, chapterId, revisionId } = await params;
  const revision = await prisma.chapterRevision.findFirst({
    where: { id: revisionId, chapterId, chapter: { section: { courseId } } },
  });
  if (!revision) notFound();

  const blocks = parseContent(revision.content, `revision ${revision.id}`);

  return (
    <div className="max-w-3xl">
      <p role="status" className="rounded-md border border-warning/40 p-3 text-sm">
        Preview of v{revision.number} ({revision.status.toLowerCase().replace("_", " ")}
        ).{" "}
        <Link
          href={route(`/admin/courses/${courseId}/chapters/${chapterId}`)}
          className="font-medium underline"
        >
          Back to the editor
        </Link>
      </p>
      <h2 className="tracking-headline mt-6 text-2xl font-semibold">
        {revision.title}
      </h2>
      {revision.summary && (
        <p className="mt-2 text-muted-foreground">{revision.summary}</p>
      )}
      <div className="reading mt-6">
        <ContentRenderer
          blocks={blocks}
          resources={{
            quizzes: new Map(),
            problems: new Map(),
            patternNames: new Map(),
            signedIn: true,
          }}
        />
      </div>
    </div>
  );
}
