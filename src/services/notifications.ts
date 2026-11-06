import "server-only";

import type { NotificationKind } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";

/**
 * In-app notifications.
 *
 * Every row is about something that already happened to this learner's own
 * work — a review fell due, an interview was graded, a milestone was
 * reached. There is no broadcast, no marketing kind, and nothing here is
 * ever a prompt to buy anything, because there is nothing to buy.
 *
 * Two rules enforced here rather than at the call site:
 *
 *   1. **Preferences are checked on write, not on read.** A learner who
 *      turned a kind off should not accumulate a backlog of hidden rows
 *      that all appear if they turn it back on.
 *   2. **`href` must be relative.** A notification is rendered as a link;
 *      one carrying an absolute URL would be an open redirect with a
 *      friendly label on it.
 */

export type NotificationView = {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  href: string | null;
  read: boolean;
  createdAt: Date;
};

/** Which preference column gates which kind. ACCOUNT is never gated. */
const PREFERENCE_FOR: Record<NotificationKind, string | null> = {
  REVIEW_DUE: "notifyReviewDue",
  INTERVIEW_GRADED: "notifyInterviewGraded",
  MILESTONE: "notifyMilestones",
  COMMUNITY: "notifyCommunity",
  // Security and account events are not a preference. A learner who turned
  // these off would stop hearing that their password changed.
  ACCOUNT: null,
};

/**
 * Rejects anything that is not a path on this site.
 *
 * `//evil.example` and `https://evil.example` are both absolute despite
 * the first looking relative, and a backslash is treated as a slash by
 * some parsers — so the check is a positive one against a narrow shape
 * rather than a blocklist.
 */
function safeHref(href: string | undefined): string | null {
  if (!href) return null;
  if (!/^\/[A-Za-z0-9\-._~!$&'()*+,;=:@%/?#[\]]*$/.test(href)) return null;
  if (href.startsWith("//")) return null;
  return href;
}

/**
 * Records a notification, if the learner wants that kind.
 *
 * Returns the id, or null when it was suppressed by a preference or by an
 * unsafe href. Callers treat a null as ordinary: failing to notify must
 * never fail the thing being notified about.
 */
export async function notify(params: {
  userId: string;
  kind: NotificationKind;
  title: string;
  body: string;
  href?: string;
}): Promise<string | null> {
  const preference = PREFERENCE_FOR[params.kind];

  if (preference) {
    const profile = await prisma.profile.findUnique({
      where: { userId: params.userId },
      select: {
        notifyReviewDue: true,
        notifyInterviewGraded: true,
        notifyMilestones: true,
        notifyCommunity: true,
      },
    });
    // No profile means no preferences have been expressed; the defaults
    // are opt-in, so a missing profile does not suppress anything.
    if (profile && profile[preference as keyof typeof profile] === false) {
      return null;
    }
  }

  const href = safeHref(params.href);
  if (params.href && !href) {
    console.error("[notifications] refused a non-relative href", {
      kind: params.kind,
    });
    return null;
  }

  const row = await prisma.notification.create({
    data: {
      userId: params.userId,
      kind: params.kind,
      title: params.title.slice(0, 200),
      body: params.body.slice(0, 1_000),
      href,
    },
    select: { id: true },
  });
  return row.id;
}

/**
 * Records a notification without ever throwing.
 *
 * Used from paths where the notification is a side effect of something
 * that matters more — grading an interview, say. A notification failure
 * must not roll back the thing it was announcing.
 */
export async function notifyQuietly(
  params: Parameters<typeof notify>[0]
): Promise<void> {
  try {
    await notify(params);
  } catch (error) {
    console.error("[notifications] write failed", error);
  }
}

export async function listNotifications(
  userId: string,
  limit = 30
): Promise<NotificationView[]> {
  const rows = await prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      kind: true,
      title: true,
      body: true,
      href: true,
      readAt: true,
      createdAt: true,
    },
  });

  return rows.map((row) => ({
    id: row.id,
    kind: row.kind,
    title: row.title,
    body: row.body,
    href: row.href,
    read: row.readAt !== null,
    createdAt: row.createdAt,
  }));
}

export async function unreadCount(userId: string): Promise<number> {
  return prisma.notification.count({ where: { userId, readAt: null } });
}

/**
 * Marks one notification read. Scoped, so naming another learner's id
 * updates nothing rather than erroring — which would confirm it exists.
 */
export async function markRead(id: string, userId: string): Promise<boolean> {
  const result = await prisma.notification.updateMany({
    where: { id, userId, readAt: null },
    data: { readAt: new Date() },
  });
  return result.count > 0;
}

export async function markAllRead(userId: string): Promise<number> {
  const result = await prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
  return result.count;
}

export async function deleteNotification(
  id: string,
  userId: string
): Promise<boolean> {
  const result = await prisma.notification.deleteMany({ where: { id, userId } });
  return result.count > 0;
}

// ---------------------------------------------------------------------------
// The producers
// ---------------------------------------------------------------------------

/**
 * Milestones worth interrupting somebody for.
 *
 * Deliberately sparse and deliberately fixed. A milestone at every tenth
 * problem becomes noise, and noise trains people to dismiss the bell
 * without reading it — at which point the account notifications stop
 * working too.
 */
const SOLVED_MILESTONES = [1, 10, 25, 50, 100, 250] as const;

/**
 * Fires when a solve count crosses a milestone.
 *
 * Takes the count *after* the solve and only fires on the exact number,
 * so a backfill or a recount cannot replay the whole ladder. Quiet: a
 * failed notification must never fail the submission that earned it.
 */
export async function notifySolveMilestone(
  userId: string,
  solvedAfter: number
): Promise<void> {
  if (!SOLVED_MILESTONES.includes(solvedAfter as (typeof SOLVED_MILESTONES)[number])) {
    return;
  }

  await notifyQuietly({
    userId,
    kind: "MILESTONE",
    title:
      solvedAfter === 1
        ? "First problem solved"
        : `${solvedAfter} problems solved`,
    body:
      solvedAfter === 1
        ? "One down. The next one is easier because you now know what solving one feels like."
        : "Your pattern mastery on the dashboard is computed from these.",
    href: "/dashboard",
  });
}

/** Fires when an interview's written feedback has been generated. */
export async function notifyInterviewGraded(params: {
  userId: string;
  sessionId: string;
  label: string;
}): Promise<void> {
  await notifyQuietly({
    userId: params.userId,
    kind: "INTERVIEW_GRADED",
    title: "Your interview feedback is ready",
    body: `${params.label} — assessed by dimension, with evidence from your own transcript.`,
    href: `/interviews/${params.sessionId}`,
  });
}

/**
 * Fires when reviews have fallen due.
 *
 * Called by the scheduled job in `/api/cron/notifications`, never from a
 * page render — a write on every page load would be both wasteful and
 * wrong, since being in the app is not the moment you need reminding to
 * come back to it. **Without a scheduler pointed at that route, no review
 * reminders are sent**; see the README.
 *
 * Returns false when one was sent recently, so a scheduler running every
 * hour does not produce twenty-four reminders a day.
 */
export async function notifyReviewsDue(params: {
  userId: string;
  dueCount: number;
  since: Date;
}): Promise<boolean> {
  const recent = await prisma.notification.findFirst({
    where: {
      userId: params.userId,
      kind: "REVIEW_DUE",
      createdAt: { gte: params.since },
    },
    select: { id: true },
  });
  if (recent) return false;

  const id = await notify({
    userId: params.userId,
    kind: "REVIEW_DUE",
    title:
      params.dueCount === 1
        ? "1 item is due for review"
        : `${params.dueCount} items are due for review`,
    body: "Recalling something just before you forget it is what makes it stick.",
    href: "/review",
  });

  return id !== null;
}
