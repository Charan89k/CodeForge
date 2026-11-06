import type { Metadata } from "next";
import Link from "next/link";
import { MessagesSquare } from "lucide-react";

import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/session";
import { route } from "@/lib/utils";
import { listTutorConversations } from "@/services/tutor-history";

import { deleteAllConversationsAction, deleteConversationAction } from "./actions";

export const metadata: Metadata = {
  title: "Tutor conversations",
  robots: { index: false, follow: false },
};

const MESSAGES: Record<string, string> = {
  deleted: "Conversation deleted.",
  "deleted-all": "All your tutor conversations were deleted.",
  confirm: "Tick the box to confirm deleting everything.",
};

export default async function TutorHistoryPage({
  searchParams,
}: PageProps<"/ai-tutor/history">) {
  const user = await requireUser("/ai-tutor/history");
  const { msg } = await searchParams;
  const message = typeof msg === "string" ? MESSAGES[msg] : undefined;
  const conversations = await listTutorConversations(user.id);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
      <PageHeader
        title="Tutor conversations"
        description="Only you can read these. Deleting one removes it for good."
      />
      {message && (
        <p role="status" className="mt-4 rounded-md border border-border p-3 text-sm">
          {message}
        </p>
      )}
      {conversations.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            icon={MessagesSquare}
            title="No conversations"
            description="Ask the tutor something and the conversation is kept here for you."
            action={
              <Button asChild size="sm" variant="outline">
                <Link href="/ai-tutor">Open the tutor</Link>
              </Button>
            }
          />
        </div>
      ) : (
        <>
          <ul className="mt-6 divide-y divide-border border-y border-border text-sm">
            {conversations.map((conversation) => (
              <li
                key={conversation.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5"
              >
                <Link
                  href={route(`/ai-tutor/history/${conversation.id}`)}
                  className="min-w-0 font-medium text-info hover:text-brand-300"
                >
                  {conversation.title}
                </Link>
                <span className="font-mono text-xs text-muted-foreground sm:ml-auto">
                  {conversation._count.messages} messages ·{" "}
                  {conversation.updatedAt.toISOString().slice(0, 10)}
                </span>
                <form action={deleteConversationAction.bind(null, conversation.id)}>
                  <Button
                    type="submit"
                    size="sm"
                    variant="outline"
                    aria-label={`Delete ${conversation.title}`}
                  >
                    Delete
                  </Button>
                </form>
              </li>
            ))}
          </ul>
          <form
            action={deleteAllConversationsAction}
            className="mt-6 flex flex-wrap items-center gap-3 text-sm"
          >
            <label className="flex items-center gap-2">
              <input type="checkbox" name="confirm" />
              Yes, delete every conversation
            </label>
            <Button type="submit" size="sm" variant="destructive">
              Delete all
            </Button>
          </form>
        </>
      )}
    </div>
  );
}
