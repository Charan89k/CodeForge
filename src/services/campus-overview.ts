import "server-only";

import type { MemberContext } from "@/lib/tenancy/context";
import { assertCan, scopeOf } from "@/lib/tenancy/context";
import { withTenantScope } from "@/lib/tenancy/scope";

import { teaches } from "./campus-classes";

export type TeachingExam = {
  id: string;
  title: string;
  className: string;
  status: string;
  closesAt: Date;
  toGrade: number;
};

const EXAMS_READ = 100;

/**
 * Exams this person teaches that are still running or still need marks, the
 * ones waiting on marks first. An admin teaches every class, as in `te_teaches`.
 */
export async function getTeachingQueue(ctx: MemberContext): Promise<TeachingExam[]> {
  assertCan(ctx, "classes.create");
  return withTenantScope(scopeOf(ctx), async (tx) => {
    const rows = await tx.assessment.findMany({
      where: {
        institutionId: ctx.institution.id,
        status: { in: ["PUBLISHED", "CLOSED"] },
      },
      orderBy: { closesAt: "desc" },
      take: EXAMS_READ,
      select: {
        id: true,
        title: true,
        status: true,
        closesAt: true,
        cohortId: true,
        cohort: { select: { name: true } },
        _count: { select: { attempts: { where: { needsGrading: true } } } },
      },
    });

    // Sequential: one transaction runs one query at a time.
    const taught = new Map<string, boolean>();
    for (const cohortId of new Set(rows.map((row) => row.cohortId))) {
      taught.set(cohortId, await teaches(tx, cohortId));
    }

    return rows
      .filter((row) => taught.get(row.cohortId))
      .filter((row) => row.status === "PUBLISHED" || row._count.attempts > 0)
      .map((row) => ({
        id: row.id,
        title: row.title,
        className: row.cohort.name,
        status: row.status,
        closesAt: row.closesAt,
        toGrade: row._count.attempts,
      }))
      .sort((a, b) => b.toGrade - a.toGrade);
  });
}
