import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/common/page-header";
import { TutorMarkdown } from "@/components/tutor/tutor-markdown";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/session";
import { getTutorTranscript } from "@/services/tutor-history";

import { deleteConversationAction, rateAnswerAction } from "../actions";

export const metadata: Metadata = {
  title: "Tutor conversation",
  robots: { index: false, follow: false },
};

export default async function TutorTranscriptPage({
  params,
}: PageProps<"/ai-tutor/history/[id]">) {
  const { id } = await params;
  const user = await requireUser(`/ai-tutor/history/${id}`);
  const conversation = await getTutorTranscript(user.id, id);
  if (!conversation) notFound();

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
      <PageHeader
        eyebrow={
          <Link href="/ai-tutor/history" className="hover:text-foreground">
            Tutor conversations
          </Link>
        }
        title={conversation.title}
        actions={
          <form action={deleteConversationAction.bind(null, conversation.id)}>
            <Button type="submit" size="sm" variant="outline">
              Delete this conversation
            </Button>
          </form>
        }
      />
      <ol className="mt-6 space-y-5">
        {conversation.messages.map((message) => (
          <li key={message.id}>
            {message.role === "USER" ? (
              <div className="ml-auto max-w-[85%] rounded-lg bg-muted px-3 py-2 text-sm whitespace-pre-wrap">
                {message.content}
              </div>
            ) : (
              <div>
                <TutorMarkdown content={message.content} />
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>Was this useful?</span>
                  {[true, false].map((helpful) => (
                    <form
                      key={String(helpful)}
                      action={rateAnswerAction.bind(
                        null,
                        conversation.id,
                        message.id,
                        helpful
                      )}
                    >
                      <Button
                        type="submit"
                        size="sm"
                        variant={message.helpful === helpful ? "default" : "outline"}
                        aria-pressed={message.helpful === helpful}
                        className="h-7"
                      >
                        {helpful ? "Yes" : "No"}
                      </Button>
                    </form>
                  ))}
                </div>
              </div>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
