import "server-only";

import { median, rate } from "@/lib/campus/metrics";
import { countedAttempt } from "@/lib/campus/rules";
import {
  assertCan,
  InstitutionError,
  scopeOf,
  type MemberContext,
} from "@/lib/tenancy/context";
import { can } from "@/lib/tenancy/permissions";
import { withTenantScope, type TenantTx } from "@/lib/tenancy/scope";

import { teaches } from "./campus-classes";
import { csvCell, writeAudit } from "./institutions";

/**
 * Institution learning analytics, computed from stored records only:
 * memberships, class rosters, assigned-content progress (te_cohort_progress)
 * and assessment attempts. Nothing is estimated.
 *
 * - Faculty see the classes they teach; institution admins see every class
 *   plus enrolment. The class filter is checked against that set, so an id
 *   from elsewhere reads as not found.
 * - Aggregates only on the page. Student-level rows exist only in the CSV
 *   export, for one class, for someone who teaches it, and every export is
 *   audited.
 * - A rate with no denominator is null ("no data"), and scores use the
 *   median of graded attempts with the count beside it. Attempts awaiting
 *   grading are counted separately, never as zero.
 */

export type AnalyticsFilter = { from: Date; to: Date; classId?: string; page?: number };

const CLASSES_PER_PAGE = 10;
const EXPORT_MAX_ROWS = 5_000;

export type AssessmentMetrics = {
  id: string;
  title: string;
  closesAt: Date;
  students: number;
  participated: number;
  participation: number | null;
  graded: number;
  pendingGrading: number;
  medianScore: number | null;
};

export type ClassMetrics = {
  id: string;
  name: string;
  students: number;
  assignments: {
    id: string;
    title: string;
    completed: number;
    completion: number | null;
  }[];
  assessments: AssessmentMetrics[];
};

export type Analytics = {
  enrolment: {
    byRole: { role: string; active: number; suspended: number; revoked: number }[];
    joinedInRange: number;
  } | null;
  classes: ClassMetrics[];
  page: number;
  pages: number;
};

async function visibleClasses(tx: TenantTx, ctx: MemberContext) {
  const all = await tx.cohort.findMany({
    where: { institutionId: ctx.institution.id, archivedAt: null },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  const taught = [];
  for (const c of all) if (await teaches(tx, c.id)) taught.push(c);
  return taught;
}

/** Students on the roster whose institution membership is still active. */
async function activeStudents(tx: TenantTx, cohortId: string): Promise<string[]> {
  const rows = await tx.cohortMember.findMany({
    where: { cohortId, role: "STUDENT", removedAt: null },
    select: { userId: true, institutionId: true },
  });
  if (rows.length === 0) return [];
  const active = await tx.institutionMembership.findMany({
    where: {
      institutionId: rows[0]!.institutionId,
      userId: { in: rows.map((r) => r.userId) },
      status: "ACTIVE",
    },
    select: { userId: true },
  });
  return active.map((a) => a.userId);
}

async function classMetrics(
  tx: TenantTx,
  cohort: { id: string; name: string },
  filter: AnalyticsFilter
): Promise<ClassMetrics> {
  const students = await activeStudents(tx, cohort.id);
  const studentSet = new Set(students);

  const progress = await tx.$queryRaw<
    { user_id: string; assignment_id: string; done: number; total: number }[]
  >`SELECT * FROM te_cohort_progress(${cohort.id})`;
  const assignmentRows = await tx.cohortAssignment.findMany({
    where: { cohortId: cohort.id, archivedAt: null },
    select: { id: true, title: true },
  });
  const assignments = assignmentRows.map((a) => {
    const completed = progress.filter(
      (p) =>
        p.assignment_id === a.id &&
        studentSet.has(p.user_id) &&
        p.total > 0 &&
        p.done >= p.total
    ).length;
    return {
      id: a.id,
      title: a.title,
      completed,
      completion: rate(completed, students.length),
    };
  });

  const assessmentRows = await tx.assessment.findMany({
    where: {
      cohortId: cohort.id,
      status: { in: ["PUBLISHED", "CLOSED"] },
      closesAt: { gte: filter.from, lte: filter.to },
    },
    orderBy: { closesAt: "asc" },
    select: { id: true, title: true, closesAt: true, scorePolicy: true },
  });
  const assessments: AssessmentMetrics[] = [];
  for (const a of assessmentRows) {
    const attempts = await tx.assessmentAttempt.findMany({
      where: { assessmentId: a.id, status: "SUBMITTED", userId: { in: students } },
      select: {
        userId: true,
        number: true,
        score: true,
        maxScore: true,
        needsGrading: true,
      },
    });
    const byStudent = new Map<string, typeof attempts>();
    for (const t of attempts)
      byStudent.set(t.userId, [...(byStudent.get(t.userId) ?? []), t]);

    const scores: number[] = [];
    let pending = 0;
    for (const own of byStudent.values()) {
      if (own.some((t) => t.needsGrading)) {
        pending += 1;
        continue;
      }
      const counted = countedAttempt(own, a.scorePolicy);
      if (counted?.score != null && counted.maxScore > 0) {
        scores.push((counted.score / counted.maxScore) * 100);
      }
    }
    assessments.push({
      id: a.id,
      title: a.title,
      closesAt: a.closesAt,
      students: students.length,
      participated: byStudent.size,
      participation: rate(byStudent.size, students.length),
      graded: scores.length,
      pendingGrading: pending,
      medianScore: median(scores),
    });
  }

  return {
    id: cohort.id,
    name: cohort.name,
    students: students.length,
    assignments,
    assessments,
  };
}

export async function getAnalytics(
  ctx: MemberContext,
  filter: AnalyticsFilter
): Promise<Analytics> {
  assertCan(ctx, "analytics.view");
  return withTenantScope(scopeOf(ctx), async (tx) => {
    let classes = await visibleClasses(tx, ctx);
    if (filter.classId) {
      classes = classes.filter((c) => c.id === filter.classId);
      if (classes.length === 0)
        throw new InstitutionError("not_found", "Class not found.");
    }
    const pages = Math.max(1, Math.ceil(classes.length / CLASSES_PER_PAGE));
    const page = Math.min(Math.max(filter.page ?? 1, 1), pages);
    const slice = classes.slice((page - 1) * CLASSES_PER_PAGE, page * CLASSES_PER_PAGE);

    const metrics: ClassMetrics[] = [];
    for (const c of slice) metrics.push(await classMetrics(tx, c, filter));

    let enrolment: Analytics["enrolment"] = null;
    if (ctx.platformAdmin || ctx.role === "INSTITUTION_ADMIN") {
      const grouped = await tx.institutionMembership.groupBy({
        by: ["role", "status"],
        where: { institutionId: ctx.institution.id },
        _count: true,
      });
      const byRole = (
        ["STUDENT", "FACULTY", "INSTITUTION_ADMIN", "PLACEMENT_OFFICER"] as const
      ).map((role) => {
        const n = (status: string) =>
          grouped.find((g) => g.role === role && g.status === status)?._count ?? 0;
        return {
          role,
          active: n("ACTIVE"),
          suspended: n("SUSPENDED"),
          revoked: n("REVOKED"),
        };
      });
      const joinedInRange = await tx.institutionMembership.count({
        where: {
          institutionId: ctx.institution.id,
          createdAt: { gte: filter.from, lte: filter.to },
        },
      });
      enrolment = { byRole, joinedInRange };
    }
    return { enrolment, classes: metrics, page, pages };
  });
}

/** Whether the classes list is visible to this member at all. */
export function canViewAnalytics(ctx: MemberContext): boolean {
  return can(ctx, "analytics.view");
}

/**
 * One class, one row per student: assignment progress and each assessment's
 * counted score in the date range. Only for someone who teaches the class;
 * audited in the same transaction. Formula-safe cells.
 */
export async function exportClassCsv(
  ctx: MemberContext,
  classId: string,
  filter: Omit<AnalyticsFilter, "classId" | "page">
): Promise<{ filename: string; csv: string }> {
  assertCan(ctx, "analytics.view");
  return withTenantScope(scopeOf(ctx), async (tx) => {
    const cohort = await tx.cohort.findFirst({
      where: { id: classId, institutionId: ctx.institution.id, archivedAt: null },
      select: { id: true, name: true },
    });
    if (!cohort) throw new InstitutionError("not_found", "Class not found.");
    if (!(await teaches(tx, cohort.id))) {
      throw new InstitutionError(
        "forbidden",
        "Only this class's instructors can export it."
      );
    }

    const students = await activeStudents(tx, cohort.id);
    if (students.length > EXPORT_MAX_ROWS) {
      throw new InstitutionError(
        "invalid",
        "This class is too large to export at once."
      );
    }
    const people = await tx.cohortMember.findMany({
      where: { cohortId: cohort.id, userId: { in: students } },
      orderBy: { createdAt: "asc" },
      select: { user: { select: { id: true, name: true, email: true } } },
    });
    const progress = await tx.$queryRaw<
      { user_id: string; assignment_id: string; done: number; total: number }[]
    >`SELECT * FROM te_cohort_progress(${cohort.id})`;
    const assignments = await tx.cohortAssignment.findMany({
      where: { cohortId: cohort.id, archivedAt: null },
      select: { id: true, title: true },
    });
    const assessments = await tx.assessment.findMany({
      where: {
        cohortId: cohort.id,
        status: { in: ["PUBLISHED", "CLOSED"] },
        closesAt: { gte: filter.from, lte: filter.to },
      },
      orderBy: { closesAt: "asc" },
      select: { id: true, title: true, scorePolicy: true },
    });
    const attempts = await tx.assessmentAttempt.findMany({
      where: {
        assessmentId: { in: assessments.map((a) => a.id) },
        status: "SUBMITTED",
        userId: { in: students },
      },
      select: {
        assessmentId: true,
        userId: true,
        number: true,
        score: true,
        maxScore: true,
        needsGrading: true,
      },
    });

    const header = [
      "name",
      "email",
      ...assignments.map((a) => `${a.title} (done/total)`),
      ...assessments.map((a) => `${a.title} (%)`),
    ];
    const lines = people.map(({ user }) => {
      const cells = [user.name ?? "", user.email];
      for (const a of assignments) {
        const p = progress.find(
          (r) => r.user_id === user.id && r.assignment_id === a.id
        );
        cells.push(p ? `${p.done}/${p.total}` : "");
      }
      for (const a of assessments) {
        const own = attempts.filter(
          (t) => t.assessmentId === a.id && t.userId === user.id
        );
        if (own.length === 0) cells.push("not attempted");
        else if (own.some((t) => t.needsGrading)) cells.push("awaiting grading");
        else {
          const counted = countedAttempt(own, a.scorePolicy);
          cells.push(
            counted?.score != null && counted.maxScore > 0
              ? String(Math.round((counted.score / counted.maxScore) * 1000) / 10)
              : ""
          );
        }
      }
      return cells.map(csvCell).join(",");
    });

    await writeAudit(tx, ctx.institution.id, ctx.user, {
      action: "analytics.exported",
      targetType: "cohort",
      targetId: cohort.id,
      summary: `Exported results for ${people.length} students of "${cohort.name}"`,
      metadata: {
        rows: people.length,
        from: filter.from.toISOString(),
        to: filter.to.toISOString(),
      },
    });

    const safeName = cohort.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .slice(0, 40);
    return {
      filename: `${ctx.institution.slug}-${safeName || "class"}-results.csv`,
      csv: `${[header.map(csvCell).join(","), ...lines].join("\r\n")}\r\n`,
    };
  });
}
