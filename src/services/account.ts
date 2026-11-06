import "server-only";

import { verifyPassword } from "@/lib/auth/password";
import { prisma } from "@/lib/db";

/**
 * A learner's own data: taking a copy, and deleting the account.
 *
 * Deleting cascades through every per-user table, which is right for private
 * learning data and wrong for a college's records. A student's grades and
 * placement history also belong to the institution, so an account that has any
 * is refused and the person is told who to ask. No approved privacy policy
 * exists yet; this is the conservative default until one does.
 */

/**
 * Tables exported as they are, by the name of their Prisma model. A test
 * compares this list with the schema, so a new table cannot be left out.
 */
const OWN_ROWS = {
  Profile: (args: FindArgs) => prisma.profile.findMany(args),
  Submission: (args: FindArgs) => prisma.submission.findMany(args),
  QuizAttempt: (args: FindArgs) => prisma.quizAttempt.findMany(args),
  UserChapterProgress: (args: FindArgs) => prisma.userChapterProgress.findMany(args),
  UserProblemProgress: (args: FindArgs) => prisma.userProblemProgress.findMany(args),
  UserPatternMastery: (args: FindArgs) => prisma.userPatternMastery.findMany(args),
  ReviewItem: (args: FindArgs) => prisma.reviewItem.findMany(args),
  Bookmark: (args: FindArgs) => prisma.bookmark.findMany(args),
  Note: (args: FindArgs) => prisma.note.findMany(args),
  Highlight: (args: FindArgs) => prisma.highlight.findMany(args),
  ActivityEvent: (args: FindArgs) => prisma.activityEvent.findMany(args),
  StudyDay: (args: FindArgs) => prisma.studyDay.findMany(args),
  UserAchievement: (args: FindArgs) => prisma.userAchievement.findMany(args),
  AIUsageRecord: (args: FindArgs) => prisma.aIUsageRecord.findMany(args),
  SystemDesignSubmission: (args: FindArgs) =>
    prisma.systemDesignSubmission.findMany(args),
  LLDSubmission: (args: FindArgs) => prisma.lLDSubmission.findMany(args),
  BehavioralStory: (args: FindArgs) => prisma.behavioralStory.findMany(args),
  Notification: (args: FindArgs) => prisma.notification.findMany(args),
  EmailDelivery: (args: FindArgs) => prisma.emailDelivery.findMany(args),
  ContestEntry: (args: FindArgs) => prisma.contestEntry.findMany(args),
  AptitudeAttempt: (args: FindArgs) => prisma.aptitudeAttempt.findMany(args),
  ShareLink: (args: FindArgs) => prisma.shareLink.findMany(args),
  InstitutionMembership: (args: FindArgs) =>
    prisma.institutionMembership.findMany(args),
  CohortMember: (args: FindArgs) => prisma.cohortMember.findMany(args),
  PlacementRecord: (args: FindArgs) => prisma.placementRecord.findMany(args),
  PlacementApplication: (args: FindArgs) => prisma.placementApplication.findMany(args),
};

type FindArgs = { where: { userId: string }; take: number };

export const EXPORTED_MODELS = Object.keys(OWN_ROWS);

/** Models read another way, or deliberately left out, with the reason. */
export const EXPORT_HANDLED_SEPARATELY = {
  Account: "Provider name only; the tokens are credentials",
  Session: "Holds session credentials, and the app uses JWT sessions",
  AIConversation: "Exported with its messages",
  InterviewSession: "Exported with its messages and evaluation",
  AssessmentAttempt: "Exported without scores, which may not be released yet",
} as const;

const SECRET_KEY = /hash|token|secret|password/i;
const EXPORT_ROW_LIMIT = 50_000;

/** Drops credential-like fields at any depth: a second line behind the selects. */
function withoutSecrets(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutSecrets);
  if (value instanceof Date || value === null || typeof value !== "object")
    return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !SECRET_KEY.test(key))
      .map(([key, entry]) => [key, withoutSecrets(entry)])
  );
}

export async function exportAccountData(
  userId: string
): Promise<Record<string, unknown>> {
  const account = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      image: true,
      role: true,
      status: true,
      createdAt: true,
    },
  });

  const tables: Record<string, unknown> = {};
  for (const [model, read] of Object.entries(OWN_ROWS)) {
    tables[model] = await read({ where: { userId }, take: EXPORT_ROW_LIMIT });
  }

  const linkedAccounts = await prisma.account.findMany({
    where: { userId },
    select: { provider: true },
  });
  const tutorConversations = await prisma.aIConversation.findMany({
    where: { userId },
    include: { messages: true },
  });
  const interviews = await prisma.interviewSession.findMany({
    where: { userId },
    include: { messages: true, evaluation: true },
  });
  const examAttempts = await prisma.assessmentAttempt.findMany({
    where: { userId },
    select: {
      id: true,
      assessmentId: true,
      number: true,
      status: true,
      startedAt: true,
      submittedAt: true,
      late: true,
      answers: { select: { questionKey: true, value: true, savedAt: true } },
    },
  });

  return withoutSecrets({
    exportedAt: new Date().toISOString(),
    about:
      "Your Tech Epitome data. Exam scores are left out because a college may not have released them; ask your college for your results.",
    account,
    linkedAccounts,
    tables,
    tutorConversations,
    interviews,
    examAttempts,
  }) as Record<string, unknown>;
}

export type DeletionBlocker = "platform-admin" | "college-records" | "authored-content";

/** Why this account cannot delete itself, if anything. */
export async function accountDeletionBlockers(
  userId: string
): Promise<DeletionBlocker[]> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { role: true },
  });
  const [memberships, classes, attempts, records, applications, revisions, contests] = [
    await prisma.institutionMembership.count({ where: { userId } }),
    await prisma.cohortMember.count({ where: { userId } }),
    await prisma.assessmentAttempt.count({ where: { userId } }),
    await prisma.placementRecord.count({ where: { userId } }),
    await prisma.placementApplication.count({ where: { userId } }),
    await prisma.chapterRevision.count({ where: { authorId: userId } }),
    await prisma.contest.count({ where: { createdById: userId } }),
  ];

  const blockers: DeletionBlocker[] = [];
  if (user.role === "ADMIN") blockers.push("platform-admin");
  if (memberships + classes + attempts + records + applications > 0) {
    blockers.push("college-records");
  }
  if (revisions + contests > 0) blockers.push("authored-content");
  return blockers;
}

export const DELETE_PHRASE = "delete my account";

export type DeleteResult =
  { ok: true } | { ok: false; reason: "phrase" | "credentials" | "blocked" };

/**
 * Permanently deletes the account after re-checking who is asking. An account
 * with no password (signed up through a provider) confirms with its email.
 */
export async function deleteAccount(
  userId: string,
  input: { phrase: string; password?: string; email?: string }
): Promise<DeleteResult> {
  if (input.phrase.trim().toLowerCase() !== DELETE_PHRASE) {
    return { ok: false, reason: "phrase" };
  }
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { email: true, passwordHash: true },
  });
  const confirmed = user.passwordHash
    ? await verifyPassword(user.passwordHash, input.password ?? "")
    : Boolean(user.email) &&
      input.email?.trim().toLowerCase() === user.email?.toLowerCase();
  if (!confirmed) return { ok: false, reason: "credentials" };

  if ((await accountDeletionBlockers(userId)).length > 0) {
    return { ok: false, reason: "blocked" };
  }

  await prisma.$transaction(async (tx) => {
    // Records that a deletion happened, without keeping who it was.
    await tx.auditLog.create({
      data: {
        actorId: userId,
        actorEmail: "deleted-account",
        action: "account.deleted",
        entity: "user",
        entityId: userId,
        summary: "Self-service account deletion",
      },
    });
    await tx.user.delete({ where: { id: userId } });
  });
  return { ok: true };
}
