import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2 } from "lucide-react";

import { CmsForm } from "@/components/admin/cms-forms";
import { ItemControls } from "@/components/community/item-controls";
import { PostBody } from "@/components/community/post-body";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { getCurrentUser } from "@/lib/auth/session";
import { REPLY_MAX } from "@/lib/community/content";
import { route } from "@/lib/utils";
import { getThread } from "@/services/community";

import { acceptAction, replyAction } from "../../actions";
import { lockAction } from "../../moderation/actions";

export const metadata: Metadata = { title: "Community thread" };

const day = (d: Date) => d.toISOString().slice(0, 10);

export default async function ThreadPage({
  params,
  searchParams,
}: PageProps<"/community/t/[id]">) {
  const { id } = await params;
  const { page } = await searchParams;
  const user = await getCurrentUser();
  const thread = /^[a-z0-9]{10,40}$/i.test(id)
    ? await getThread(id, user, Number(page ?? 1))
    : null;
  if (!thread) notFound();

  const signedIn = Boolean(user);
  const asker =
    thread.mine && thread.kind === "QUESTION" && thread.status === "VISIBLE";
  const canReply = signedIn && thread.status === "VISIBLE" && !thread.locked;

  return (
    <article className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
      <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
        <Link href="/community" className="hover:text-foreground">
          Community
        </Link>{" "}
        ›{" "}
        <Link
          href={route(`/community?category=${thread.category.slug}`)}
          className="hover:text-foreground"
        >
          {thread.category.name}
        </Link>
      </nav>

      <header className="mt-3">
        <h1 className="font-serif text-2xl font-semibold break-words sm:text-3xl">
          {thread.title}
        </h1>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {thread.kind === "QUESTION" && (
            <Badge variant={thread.acceptedPostId ? "default" : "outline"}>
              {thread.acceptedPostId ? "Answered" : "Question"}
            </Badge>
          )}
          {thread.locked && <Badge variant="outline">Locked</Badge>}
          {thread.status !== "VISIBLE" && (
            <Badge variant="destructive">
              {thread.status === "HIDDEN"
                ? "Hidden by a moderator"
                : "Deleted by its author"}
            </Badge>
          )}
          <span>{thread.authorName}</span>
          <span aria-hidden="true">·</span>
          <time dateTime={thread.createdAt.toISOString()}>{day(thread.createdAt)}</time>
        </div>
      </header>

      {thread.status === "HIDDEN" && thread.hiddenReason && (
        <p
          role="note"
          className="mt-4 rounded-md border border-border bg-muted/40 p-3 text-sm"
        >
          Only {thread.mine ? "you" : "the author"} and moderators can see this thread.
          Reason: {thread.hiddenReason}
        </p>
      )}

      <div className="mt-5">
        {thread.body ? (
          <PostBody body={thread.body} />
        ) : (
          <p className="text-sm text-muted-foreground">Deleted by its author.</p>
        )}
      </div>
      <ItemControls
        threadId={thread.id}
        target={{ threadId: thread.id }}
        item={{
          status: thread.status,
          voteCount: thread.voteCount,
          voted: thread.voted,
          mine: thread.mine,
          authorId: thread.authorId,
          label: "this thread",
        }}
        signedIn={signedIn}
        moderator={thread.moderator}
        appealStatus={thread.appealStatus}
      />
      {thread.moderator && thread.status === "VISIBLE" && (
        <details className="mt-2 text-sm">
          <summary className="cursor-pointer text-muted-foreground">
            {thread.locked ? "Unlock replies" : "Lock replies"}
          </summary>
          <CmsForm
            action={lockAction.bind(null, thread.id, !thread.locked)}
            submitLabel={thread.locked ? "Unlock" : "Lock"}
            size="sm"
            variant="outline"
            className="mt-2 max-w-sm"
          >
            <label className="block text-xs">
              Reason
              <Input
                name="reason"
                required
                minLength={3}
                maxLength={300}
                className="mt-1 h-8"
              />
            </label>
          </CmsForm>
        </details>
      )}

      <section aria-labelledby="replies-heading" className="mt-8">
        <h2 id="replies-heading" className="text-lg font-semibold">
          {thread.replyCount} {thread.replyCount === 1 ? "reply" : "replies"}
        </h2>
        {thread.posts.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No replies yet.</p>
        ) : (
          <ol className="mt-3 divide-y divide-border border-y border-border">
            {thread.posts.map((post) => {
              const accepted = thread.acceptedPostId === post.id;
              return (
                <li key={post.id} id={`post-${post.id}`} className="py-4">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">
                      {post.authorName}
                    </span>
                    <span aria-hidden="true">·</span>
                    <time dateTime={post.createdAt.toISOString()}>
                      {day(post.createdAt)}
                    </time>
                    {accepted && (
                      <span className="flex items-center gap-1 text-success">
                        <CheckCircle2 className="size-3.5" aria-hidden="true" />{" "}
                        Accepted answer
                      </span>
                    )}
                  </div>
                  <div className="mt-2">
                    {post.blocked && !post.mine ? (
                      <p className="text-sm text-muted-foreground">
                        You blocked this person.{" "}
                        <Link href="/community/blocked" className="text-info underline">
                          Manage blocks
                        </Link>
                      </p>
                    ) : post.body ? (
                      <>
                        {post.status === "HIDDEN" && (
                          <p className="mb-2 text-xs text-muted-foreground">
                            Hidden by a moderator
                            {post.hiddenReason ? `: ${post.hiddenReason}` : ""}. Only{" "}
                            {post.mine ? "you" : "the author"} and moderators can see
                            it.
                          </p>
                        )}
                        <PostBody body={post.body} />
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        {post.status === "REMOVED"
                          ? "Deleted by its author."
                          : "Hidden by a moderator."}
                      </p>
                    )}
                  </div>
                  {!(post.blocked && !post.mine) && (
                    <ItemControls
                      threadId={thread.id}
                      target={{ postId: post.id }}
                      item={{
                        status: post.status,
                        voteCount: post.voteCount,
                        voted: post.voted,
                        mine: post.mine,
                        authorId: post.authorId,
                        label: `the reply by ${post.authorName}`,
                      }}
                      signedIn={signedIn}
                      moderator={thread.moderator}
                    />
                  )}
                  {asker && post.status === "VISIBLE" && (
                    <form
                      action={acceptAction.bind(
                        null,
                        thread.id,
                        accepted ? null : post.id
                      )}
                      className="mt-2"
                    >
                      <Button type="submit" size="sm" variant="outline">
                        {accepted ? "Unmark as the answer" : "Mark as the answer"}
                      </Button>
                    </form>
                  )}
                </li>
              );
            })}
          </ol>
        )}
        {(thread.postsPage > 1 || thread.morePosts) && (
          <nav aria-label="Reply pages" className="mt-3 flex justify-between text-sm">
            {thread.postsPage > 1 ? (
              <Link
                href={route(`/community/t/${thread.id}?page=${thread.postsPage - 1}`)}
                className="text-info"
              >
                Earlier replies
              </Link>
            ) : (
              <span />
            )}
            {thread.morePosts && (
              <Link
                href={route(`/community/t/${thread.id}?page=${thread.postsPage + 1}`)}
                className="text-info"
              >
                Later replies
              </Link>
            )}
          </nav>
        )}
      </section>

      <section aria-labelledby="reply-heading" className="mt-8">
        <h2 id="reply-heading" className="text-lg font-semibold">
          Reply
        </h2>
        {canReply ? (
          <CmsForm
            action={replyAction.bind(null, thread.id)}
            submitLabel="Post reply"
            savedLabel="Posted."
            className="mt-3"
          >
            <label htmlFor="reply" className="sr-only">
              Your reply
            </label>
            <Textarea id="reply" name="reply" required rows={5} maxLength={REPLY_MAX} />
          </CmsForm>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">
            {!signedIn ? (
              <>
                <Link
                  href={route(
                    `/login?next=${encodeURIComponent(`/community/t/${thread.id}`)}`
                  )}
                  className="text-info underline"
                >
                  Sign in
                </Link>{" "}
                to reply.
              </>
            ) : thread.locked ? (
              "A moderator has locked this thread, so it takes no new replies."
            ) : (
              "This thread takes no replies."
            )}
          </p>
        )}
      </section>
    </article>
  );
}
