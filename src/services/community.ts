import "server-only";

import { z } from "zod";

import { Prisma } from "@/generated/prisma/client";
import type { CommunityStatus } from "@/generated/prisma/enums";
import {
  BODY_MAX,
  LINKS_MAX,
  MENTIONS_MAX,
  REPLY_MAX,
  TITLE_MAX,
  TITLE_MIN,
  countLinks,
  mentionsIn,
} from "@/lib/community/content";
import { prisma } from "@/lib/db";
import { RATE_LIMITS, rateLimit } from "@/lib/rate-limit";

import { notifyQuietly } from "./notifications";

/**
 * The community: platform-wide, part of Learn, owned by no college. Reads are
 * open; every write needs an account with a username, honours moderator
 * restrictions and rate limits, and is checked here, never only in a page.
 */

export class CommunityError extends Error {
  constructor(
    public readonly code:
      | "not_found"
      | "forbidden"
      | "invalid"
      | "duplicate"
      | "limited"
      | "restricted"
      | "username"
      | "locked",
    message: string
  ) {
    super(message);
  }
}

export type CommunityActor = { id: string; role: "USER" | "ADMIN" };
export type CommunityViewer = CommunityActor | null;

const PAGE = 20;
const POSTS_PAGE = 50;
const MAX_PAGE = 100;
const DUPLICATE_WINDOW_MS = 10 * 60_000;
const TITLE_REPEAT_WINDOW_MS = 24 * 60 * 60_000;

export const SORTS = ["active", "new", "top", "unanswered"] as const;
export type ThreadSort = (typeof SORTS)[number];

// --- Who may do what ---------------------------------------------------------

export async function canModerate(viewer: CommunityViewer): Promise<boolean> {
  if (!viewer) return false;
  if (viewer.role === "ADMIN") return true;
  return Boolean(
    await prisma.communityModerator.findUnique({ where: { userId: viewer.id } })
  );
}

/** People this viewer has blocked: their posts are folded away for them. */
export async function blockedBy(viewer: CommunityViewer): Promise<Set<string>> {
  if (!viewer) return new Set();
  const rows = await prisma.communityBlock.findMany({
    where: { blockerId: viewer.id },
    select: { blockedId: true },
    take: 1000,
  });
  return new Set(rows.map((r) => r.blockedId));
}

async function assertCanPost(actor: CommunityActor): Promise<void> {
  const [restriction, profile] = await Promise.all([
    prisma.communityRestriction.findUnique({ where: { userId: actor.id } }),
    prisma.profile.findUnique({
      where: { userId: actor.id },
      select: { username: true },
    }),
  ]);
  if (restriction && restriction.until > new Date()) {
    throw new CommunityError(
      "restricted",
      `A moderator has paused your posting until ${restriction.until.toISOString().slice(0, 10)}: ${restriction.reason}`
    );
  }
  if (!profile?.username) {
    throw new CommunityError(
      "username",
      "Choose a username in Settings first. Posts show your username, never your name or email."
    );
  }
}

async function limit(key: string, preset: { limit: number; windowMs: number }) {
  if (!(await rateLimit(key, preset)).success) {
    throw new CommunityError("limited", "That is a lot at once. Try again in a while.");
  }
}

function assertBodyRules(body: string): void {
  if (countLinks(body) > LINKS_MAX) {
    throw new CommunityError("invalid", `At most ${LINKS_MAX} links in one post.`);
  }
  if (mentionsIn(body).length > MENTIONS_MAX) {
    throw new CommunityError(
      "invalid",
      `At most ${MENTIONS_MAX} mentions in one post.`
    );
  }
}

// --- How people appear -----------------------------------------------------

const AUTHOR = { select: { profile: { select: { username: true } } } } as const;
type AuthorRow = { profile: { username: string | null } | null } | null;

/** A username, or a neutral label. Never a name or an email. */
export function displayName(author: AuthorRow): string {
  if (!author) return "Deleted account";
  return author.profile?.username ?? "A learner";
}

// --- Reading -----------------------------------------------------------------

export async function listCategories() {
  return prisma.communityCategory.findMany({
    orderBy: { order: "asc" },
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
      _count: { select: { threads: { where: { status: "VISIBLE" } } } },
    },
  });
}

export type ThreadFilter = {
  category?: string;
  sort: ThreadSort;
  q?: string;
  page: number;
};

export async function listThreads(filter: ThreadFilter, viewer: CommunityViewer) {
  const page = Math.min(Math.max(1, Math.floor(filter.page) || 1), MAX_PAGE);
  const blocked = [...(await blockedBy(viewer))];
  const q = filter.q?.trim().slice(0, 100);
  const where: Prisma.CommunityThreadWhereInput = {
    status: "VISIBLE",
    ...(filter.category ? { category: { slug: filter.category } } : {}),
    ...(q ? { title: { contains: q, mode: "insensitive" } } : {}),
    ...(filter.sort === "unanswered"
      ? { kind: "QUESTION", acceptedPostId: null, replyCount: 0 }
      : {}),
    // NOT IN drops rows whose author is null, so deleted accounts are kept explicitly.
    ...(blocked.length
      ? { OR: [{ authorId: null }, { authorId: { notIn: blocked } }] }
      : {}),
  };
  const orderBy: Prisma.CommunityThreadOrderByWithRelationInput[] =
    filter.sort === "active"
      ? [{ lastActivityAt: "desc" }]
      : filter.sort === "top"
        ? [{ voteCount: "desc" }, { createdAt: "desc" }]
        : [{ createdAt: "desc" }];

  const rows = await prisma.communityThread.findMany({
    where,
    orderBy,
    skip: (page - 1) * PAGE,
    take: PAGE + 1,
    select: {
      id: true,
      title: true,
      kind: true,
      locked: true,
      voteCount: true,
      replyCount: true,
      acceptedPostId: true,
      lastActivityAt: true,
      createdAt: true,
      category: { select: { slug: true, name: true } },
      author: AUTHOR,
    },
  });
  return {
    page,
    hasMore: rows.length > PAGE,
    threads: rows.slice(0, PAGE).map(({ author, ...thread }) => ({
      ...thread,
      authorName: displayName(author),
    })),
  };
}

/** What a viewer may read of one item's body. */
function visibleBody(
  item: { status: CommunityStatus; body: string; authorId: string | null },
  viewer: CommunityViewer,
  moderator: boolean
): string | null {
  if (item.status === "VISIBLE") return item.body;
  if (item.status === "HIDDEN" && (moderator || item.authorId === viewer?.id)) {
    return item.body;
  }
  return null;
}

export async function getThread(id: string, viewer: CommunityViewer, postsPage = 1) {
  const thread = await prisma.communityThread.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      body: true,
      kind: true,
      status: true,
      hiddenReason: true,
      locked: true,
      voteCount: true,
      replyCount: true,
      acceptedPostId: true,
      createdAt: true,
      authorId: true,
      author: AUTHOR,
      category: { select: { slug: true, name: true } },
    },
  });
  if (!thread) return null;
  const moderator = await canModerate(viewer);
  const mine = Boolean(viewer && thread.authorId === viewer.id);
  // A hidden or removed thread exists only for its author and moderators.
  if (thread.status !== "VISIBLE" && !mine && !moderator) return null;

  const page = Math.min(Math.max(1, Math.floor(postsPage) || 1), MAX_PAGE);
  const [posts, blocked, votes, appeal] = await Promise.all([
    prisma.communityPost.findMany({
      where: { threadId: id },
      orderBy: { createdAt: "asc" },
      skip: (page - 1) * POSTS_PAGE,
      take: POSTS_PAGE + 1,
      select: {
        id: true,
        body: true,
        status: true,
        hiddenReason: true,
        voteCount: true,
        createdAt: true,
        authorId: true,
        author: AUTHOR,
      },
    }),
    blockedBy(viewer),
    viewer
      ? prisma.communityVote.findMany({
          where: {
            userId: viewer.id,
            OR: [{ threadId: id }, { post: { threadId: id } }],
          },
          select: { threadId: true, postId: true },
        })
      : Promise.resolve([]),
    viewer && mine && thread.status === "HIDDEN"
      ? prisma.communityAppeal.findUnique({
          where: { authorId_threadId: { authorId: viewer.id, threadId: id } },
          select: { status: true },
        })
      : Promise.resolve(null),
  ]);

  return {
    id: thread.id,
    title: thread.title,
    kind: thread.kind,
    status: thread.status,
    hiddenReason: mine || moderator ? thread.hiddenReason : null,
    locked: thread.locked,
    voteCount: thread.voteCount,
    replyCount: thread.replyCount,
    acceptedPostId: thread.acceptedPostId,
    createdAt: thread.createdAt,
    category: thread.category,
    authorName: displayName(thread.author),
    authorId: thread.authorId,
    body: visibleBody(thread, viewer, moderator),
    mine,
    moderator,
    voted: votes.some((v) => v.threadId === id),
    appealStatus: appeal?.status ?? null,
    postsPage: page,
    morePosts: posts.length > POSTS_PAGE,
    posts: posts.slice(0, POSTS_PAGE).map((post) => ({
      id: post.id,
      status: post.status,
      hiddenReason:
        moderator || post.authorId === viewer?.id ? post.hiddenReason : null,
      voteCount: post.voteCount,
      createdAt: post.createdAt,
      authorId: post.authorId,
      authorName: displayName(post.author),
      mine: Boolean(viewer && post.authorId === viewer.id),
      blocked: Boolean(post.authorId && blocked.has(post.authorId)),
      body: visibleBody(post, viewer, moderator),
      voted: votes.some((v) => v.postId === post.id),
    })),
  };
}

export type ThreadView = NonNullable<Awaited<ReturnType<typeof getThread>>>;

// --- Writing -----------------------------------------------------------------

export const threadInputSchema = z.object({
  category: z.string().min(1).max(60),
  kind: z.enum(["DISCUSSION", "QUESTION"]),
  title: z.string().trim().min(TITLE_MIN).max(TITLE_MAX),
  body: z.string().trim().min(1).max(BODY_MAX),
});

export async function createThread(
  actor: CommunityActor,
  input: z.infer<typeof threadInputSchema>
): Promise<string> {
  const data = threadInputSchema.parse(input);
  await assertCanPost(actor);
  await limit(`community-thread:${actor.id}`, RATE_LIMITS.COMMUNITY_THREAD);
  assertBodyRules(data.body);

  const category = await prisma.communityCategory.findUnique({
    where: { slug: data.category },
    select: { id: true },
  });
  if (!category) throw new CommunityError("invalid", "Choose a category.");

  const now = Date.now();
  const repeat = await prisma.communityThread.findFirst({
    where: {
      authorId: actor.id,
      OR: [
        {
          title: { equals: data.title, mode: "insensitive" },
          createdAt: { gt: new Date(now - TITLE_REPEAT_WINDOW_MS) },
        },
        { body: data.body, createdAt: { gt: new Date(now - DUPLICATE_WINDOW_MS) } },
      ],
    },
    select: { id: true },
  });
  if (repeat) {
    throw new CommunityError(
      "duplicate",
      "You already posted this. It is linked below."
    );
  }

  const thread = await prisma.communityThread.create({
    data: {
      categoryId: category.id,
      authorId: actor.id,
      kind: data.kind,
      title: data.title,
      body: data.body,
    },
    select: { id: true },
  });
  await notifyMentions(actor, data.body, thread.id, new Set());
  return thread.id;
}

export const replySchema = z.string().trim().min(1).max(REPLY_MAX);

export async function replyToThread(
  actor: CommunityActor,
  threadId: string,
  input: string
): Promise<string> {
  const body = replySchema.parse(input);
  await assertCanPost(actor);
  await limit(`community-reply:${actor.id}`, RATE_LIMITS.COMMUNITY_REPLY);
  assertBodyRules(body);

  const thread = await prisma.communityThread.findUnique({
    where: { id: threadId },
    select: { status: true, locked: true, authorId: true, title: true },
  });
  if (!thread || thread.status !== "VISIBLE") {
    throw new CommunityError("not_found", "That thread is not available.");
  }
  if (thread.locked) {
    throw new CommunityError("locked", "A moderator has locked this thread.");
  }
  const repeat = await prisma.communityPost.findFirst({
    where: {
      threadId,
      authorId: actor.id,
      body,
      createdAt: { gt: new Date(Date.now() - DUPLICATE_WINDOW_MS) },
    },
    select: { id: true },
  });
  if (repeat) throw new CommunityError("duplicate", "You already posted that reply.");

  const post = await prisma.$transaction(async (tx) => {
    const created = await tx.communityPost.create({
      data: { threadId, authorId: actor.id, body },
      select: { id: true },
    });
    await tx.communityThread.update({
      where: { id: threadId },
      data: { replyCount: { increment: 1 }, lastActivityAt: new Date() },
    });
    return created;
  });

  const notified = new Set<string>();
  if (thread.authorId && thread.authorId !== actor.id) {
    if (!(await isBlocking(thread.authorId, actor.id))) {
      await notifyQuietly({
        userId: thread.authorId,
        kind: "COMMUNITY",
        title: "New reply to your thread",
        body: thread.title,
        href: `/community/t/${threadId}`,
      });
    }
    notified.add(thread.authorId);
  }
  await notifyMentions(actor, body, threadId, notified);
  return post.id;
}

async function isBlocking(blockerId: string, blockedId: string): Promise<boolean> {
  return Boolean(
    await prisma.communityBlock.findUnique({
      where: { blockerId_blockedId: { blockerId, blockedId } },
    })
  );
}

/** Mentioned people hear about it, unless they blocked the writer. */
async function notifyMentions(
  actor: CommunityActor,
  body: string,
  threadId: string,
  already: Set<string>
): Promise<void> {
  const names = mentionsIn(body);
  if (names.length === 0) return;
  const [people, writer] = await Promise.all([
    prisma.profile.findMany({
      where: { username: { in: names } },
      select: { userId: true },
    }),
    prisma.profile.findUnique({
      where: { userId: actor.id },
      select: { username: true },
    }),
  ]);
  for (const { userId } of people) {
    if (userId === actor.id || already.has(userId)) continue;
    if (await isBlocking(userId, actor.id)) continue;
    await notifyQuietly({
      userId,
      kind: "COMMUNITY",
      title: `@${writer?.username ?? "someone"} mentioned you`,
      body: "In a community thread.",
      href: `/community/t/${threadId}`,
    });
  }
}

export type CommunityTarget = { threadId: string } | { postId: string };

async function targetRow(target: CommunityTarget) {
  if ("threadId" in target) {
    const thread = await prisma.communityThread.findUnique({
      where: { id: target.threadId },
      select: { authorId: true, status: true },
    });
    return (
      thread && { ...thread, threadId: target.threadId, threadStatus: thread.status }
    );
  }
  const post = await prisma.communityPost.findUnique({
    where: { id: target.postId },
    select: {
      authorId: true,
      status: true,
      threadId: true,
      thread: { select: { status: true } },
    },
  });
  return post && { ...post, threadStatus: post.thread.status };
}

/** Exported for the safety service: the item, if it exists and is live. */
export async function liveTarget(target: CommunityTarget) {
  const row = await targetRow(target);
  if (!row || row.status !== "VISIBLE" || row.threadStatus !== "VISIBLE") {
    throw new CommunityError("not_found", "That post is not available.");
  }
  return row;
}

/** Toggles this person's vote. Returns whether they now have a vote on it. */
export async function toggleVote(
  actor: CommunityActor,
  target: CommunityTarget
): Promise<boolean> {
  const row = await liveTarget(target);
  if (row.authorId === actor.id) {
    throw new CommunityError("forbidden", "You cannot vote on your own post.");
  }
  await limit(`community-vote:${actor.id}`, RATE_LIMITS.COMMUNITY_VOTE);

  const where =
    "threadId" in target
      ? { userId: actor.id, threadId: target.threadId }
      : { userId: actor.id, postId: target.postId };
  const bump = (tx: Prisma.TransactionClient, by: 1 | -1) =>
    "threadId" in target
      ? tx.communityThread.update({
          where: { id: target.threadId },
          data: { voteCount: { increment: by } },
        })
      : tx.communityPost.update({
          where: { id: target.postId },
          data: { voteCount: { increment: by } },
        });

  try {
    return await prisma.$transaction(async (tx) => {
      const removed = await tx.communityVote.deleteMany({ where });
      if (removed.count > 0) {
        await bump(tx, -1);
        return false;
      }
      await tx.communityVote.create({ data: where });
      await bump(tx, 1);
      return true;
    });
  } catch (error) {
    // A simultaneous click already added this vote; the unique key kept one.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return true;
    }
    throw error;
  }
}

/** The asker marks one reply as the answer, or clears it with null. */
export async function acceptAnswer(
  actor: CommunityActor,
  threadId: string,
  postId: string | null
): Promise<void> {
  const thread = await prisma.communityThread.findUnique({
    where: { id: threadId },
    select: { authorId: true, kind: true, status: true },
  });
  if (!thread || thread.status !== "VISIBLE") {
    throw new CommunityError("not_found", "That thread is not available.");
  }
  if (thread.authorId !== actor.id || thread.kind !== "QUESTION") {
    throw new CommunityError(
      "forbidden",
      "Only the person who asked can mark an answer."
    );
  }
  if (postId) {
    const post = await prisma.communityPost.findUnique({
      where: { id: postId },
      select: { threadId: true, status: true },
    });
    if (!post || post.threadId !== threadId || post.status !== "VISIBLE") {
      throw new CommunityError("not_found", "That reply is not available.");
    }
  }
  await prisma.communityThread.update({
    where: { id: threadId },
    data: { acceptedPostId: postId },
  });
}

/** The author takes down their own thread or reply. It cannot be undone. */
export async function removeOwn(
  actor: CommunityActor,
  target: CommunityTarget
): Promise<void> {
  const row = await targetRow(target);
  if (!row || row.authorId !== actor.id || row.status === "REMOVED") {
    throw new CommunityError("not_found", "That post is not available.");
  }
  await prisma.$transaction(async (tx) => {
    if ("threadId" in target) {
      await tx.communityThread.update({
        where: { id: target.threadId },
        data: { status: "REMOVED" },
      });
      return;
    }
    await tx.communityPost.update({
      where: { id: target.postId },
      data: { status: "REMOVED" },
    });
    if (row.status === "VISIBLE") {
      await tx.communityThread.update({
        where: { id: row.threadId },
        data: { replyCount: { decrement: 1 } },
      });
    }
    await tx.communityThread.updateMany({
      where: { id: row.threadId, acceptedPostId: target.postId },
      data: { acceptedPostId: null },
    });
  });
}
