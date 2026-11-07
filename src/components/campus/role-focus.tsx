import Link from "next/link";

import { When } from "@/components/campus/when";
import { SectionHeading } from "@/components/common/section-heading";
import { Badge } from "@/components/ui/badge";
import type { MemberContext } from "@/lib/tenancy/context";
import { route } from "@/lib/utils";
import { listMyExams } from "@/services/campus-exams";
import { getTeachingQueue } from "@/services/campus-overview";
import { listInstitutionAudit, type MemberRow } from "@/services/institutions";
import {
  getPlacementReport,
  getStudentPlacement,
  listOfficeDrives,
} from "@/services/placement";

const ROW = "flex flex-wrap items-center gap-x-4 gap-y-1 py-2.5 text-sm";
const LINK = "font-medium text-info transition-colors hover:text-brand-300";
const META = "font-mono text-xs text-muted-foreground";
const EMPTY = "py-4 text-sm text-muted-foreground";

function Stats({ items }: { items: { label: string; value: number }[] }) {
  return (
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-border bg-border sm:grid-cols-4">
      {items.map((item) => (
        <div
          key={item.label}
          className="flex flex-col-reverse gap-0.5 bg-card px-3 py-2"
        >
          <dt className="label-mono">{item.label}</dt>
          <dd className="font-mono text-lg font-medium tabular-nums">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

async function StudentFocus({ ctx }: { ctx: MemberContext }) {
  const slug = ctx.institution.slug;
  const now = new Date();
  const [exams, placement] = await Promise.all([
    listMyExams(ctx.user),
    getStudentPlacement(ctx),
  ]);
  const openExams = exams.filter(
    (exam) =>
      exam.collegeSlug === slug && exam.status === "PUBLISHED" && exam.closesAt >= now
  );
  const applications = placement.drives.filter((drive) => drive.application);
  const canApply = placement.drives.filter(
    (drive) =>
      !drive.application &&
      drive.status === "OPEN" &&
      drive.deadline >= now &&
      drive.eligibility.eligible
  );

  return (
    <section aria-labelledby="focus-heading" className="mt-6">
      <SectionHeading id="focus-heading" title="Your next steps" />
      <Stats
        items={[
          { label: "Open exams", value: openExams.length },
          { label: "Drives open to you", value: canApply.length },
          { label: "Your applications", value: applications.length },
        ]}
      />
      {openExams.length === 0 && canApply.length === 0 ? (
        <p className={EMPTY}>Nothing is waiting on you right now.</p>
      ) : (
        <ul className="mt-2 divide-y divide-border">
          {openExams.map((exam) => (
            <li key={exam.id} className={ROW}>
              <Link
                href={route(`/campus/${slug}/assessments/${exam.id}`)}
                className={LINK}
              >
                {exam.title}
              </Link>
              <span className="text-xs text-muted-foreground">{exam.className}</span>
              <span className={`${META} sm:ml-auto`}>
                Closes <When date={exam.closesAt} />
              </span>
            </li>
          ))}
          {canApply.map((drive) => (
            <li key={drive.id} className={ROW}>
              <Link href={route(`/campus/${slug}/placement`)} className={LINK}>
                {drive.title}
              </Link>
              <span className="text-xs text-muted-foreground">{drive.companyName}</span>
              <span className={`${META} sm:ml-auto`}>
                Apply by <When date={drive.deadline} />
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

async function TeachingFocus({ ctx }: { ctx: MemberContext }) {
  const slug = ctx.institution.slug;
  const exams = await getTeachingQueue(ctx);
  const toGrade = exams.reduce((total, exam) => total + exam.toGrade, 0);

  return (
    <section aria-labelledby="teaching-heading" className="mt-6">
      <SectionHeading
        id="teaching-heading"
        title="Your teaching"
        description={`${toGrade} attempt${toGrade === 1 ? "" : "s"} waiting for marks.`}
      />
      {exams.length === 0 ? (
        <p className={EMPTY}>No exam of yours is running or waiting for marks.</p>
      ) : (
        <ul className="divide-y divide-border">
          {exams.map((exam) => (
            <li key={exam.id} className={ROW}>
              <Link
                href={route(`/campus/${slug}/assessments/${exam.id}`)}
                className={LINK}
              >
                {exam.title}
              </Link>
              <span className="text-xs text-muted-foreground">{exam.className}</span>
              {exam.toGrade > 0 && (
                <Badge variant="warning">{exam.toGrade} to mark</Badge>
              )}
              <span className={`${META} sm:ml-auto`}>
                {exam.status === "CLOSED" ? "Closed " : "Closes "}
                <When date={exam.closesAt} />
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

async function PlacementFocus({ ctx }: { ctx: MemberContext }) {
  const slug = ctx.institution.slug;
  const [report, drives] = await Promise.all([
    getPlacementReport(ctx),
    listOfficeDrives(ctx),
  ]);
  const open = drives
    .filter((drive) => drive.status === "OPEN")
    .sort((a, b) => a.deadline.getTime() - b.deadline.getTime());

  return (
    <section aria-labelledby="placement-heading" className="mt-6">
      <SectionHeading
        id="placement-heading"
        title="Placement office"
        actions={
          <Link href={route(`/campus/${slug}/placement`)} className={LINK}>
            Open the office
          </Link>
        }
      />
      <Stats
        items={[
          { label: "Open drives", value: report.activeDrives },
          { label: "Applications", value: report.applications },
          { label: "Offers", value: report.offers },
          { label: "Placed", value: report.placed },
        ]}
      />
      {open.length === 0 ? (
        <p className={EMPTY}>No drive is open. Create one from the placement office.</p>
      ) : (
        <ul className="mt-2 divide-y divide-border">
          {open.map((drive) => (
            <li key={drive.id} className={ROW}>
              <Link
                href={route(`/campus/${slug}/placement/drives/${drive.id}`)}
                className={LINK}
              >
                {drive.title}
              </Link>
              <span className="text-xs text-muted-foreground">
                {drive.companyName} · {drive._count.applications} applied
              </span>
              <span className={`${META} sm:ml-auto`}>
                Closes <When date={drive.deadline} />
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const AUDIT_SHOWN = 5;

async function AdminFocus({
  ctx,
  members,
}: {
  ctx: MemberContext;
  members: MemberRow[];
}) {
  const slug = ctx.institution.slug;
  const audit = await listInstitutionAudit(ctx, AUDIT_SHOWN);
  const active = members.filter((member) => member.status === "ACTIVE");
  const count = (role: MemberRow["role"]) =>
    active.filter((member) => member.role === role).length;

  return (
    <section aria-labelledby="admin-heading" className="mt-6">
      <SectionHeading
        id="admin-heading"
        title="Your college"
        actions={
          <Link href={route(`/campus/${slug}/audit`)} className={LINK}>
            Full audit log
          </Link>
        }
      />
      <Stats
        items={[
          { label: "Students", value: count("STUDENT") },
          { label: "Faculty", value: count("FACULTY") },
          { label: "Placement officers", value: count("PLACEMENT_OFFICER") },
          { label: "Not active", value: members.length - active.length },
        ]}
      />
      {audit.length === 0 ? (
        <p className={EMPTY}>No administrative activity is recorded yet.</p>
      ) : (
        <ul className="mt-2 divide-y divide-border">
          {audit.map((entry) => (
            <li key={entry.id} className={ROW}>
              <span className="min-w-0">{entry.summary}</span>
              <span className={`${META} sm:ml-auto`}>
                <When date={entry.createdAt} />
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * The first thing each role came to the college page to do. Permissions are
 * checked again inside each service, so choosing a view grants nothing.
 */
export function RoleFocus({
  ctx,
  members,
}: {
  ctx: MemberContext;
  members: MemberRow[] | null;
}) {
  if (ctx.role === "STUDENT") return <StudentFocus ctx={ctx} />;
  if (ctx.role === "FACULTY") return <TeachingFocus ctx={ctx} />;
  if (ctx.role === "PLACEMENT_OFFICER") return <PlacementFocus ctx={ctx} />;
  return (
    <>
      {members && <AdminFocus ctx={ctx} members={members} />}
      <TeachingFocus ctx={ctx} />
    </>
  );
}
