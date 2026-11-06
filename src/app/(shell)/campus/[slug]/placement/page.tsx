import type { Metadata } from "next";
import Link from "next/link";
import { BriefcaseBusiness, Check, X } from "lucide-react";

import { CmsForm } from "@/components/admin/cms-forms";
import { CampusTrail } from "@/components/campus/campus-trail";
import { When } from "@/components/campus/when";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { SectionHeading } from "@/components/common/section-heading";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { can } from "@/lib/tenancy/permissions";
import { requireMember, type MemberContext } from "@/lib/tenancy/context";
import { route } from "@/lib/utils";
import {
  getPlacementReport,
  getStudentPlacement,
  listCompanies,
  listOfficeDrives,
} from "@/services/placement";

import {
  applyAction,
  createDriveAction,
  respondToOfferAction,
  withdrawAction,
} from "./actions";

export const metadata: Metadata = { title: "Placement" };

const label = "text-sm font-medium";
const lpa = (value: number | null) =>
  value === null ? "—" : `${value.toFixed(2)} LPA`;
const STAGE_LABEL: Record<string, string> = {
  APPLIED: "Applied",
  SHORTLISTED: "Shortlisted",
  INTERVIEWING: "Interviewing",
  OFFERED: "Offer made",
  ACCEPTED: "Accepted",
  DECLINED: "Declined",
  REJECTED: "Not selected",
  WITHDRAWN: "Withdrawn",
};

async function OfficeView({ ctx }: { ctx: MemberContext }) {
  const slug = ctx.institution.slug;
  const [report, drives, companies] = await Promise.all([
    getPlacementReport(ctx),
    listOfficeDrives(ctx),
    listCompanies(ctx),
  ]);
  const stats = [
    { label: "Students", value: report.students },
    { label: "Records entered", value: report.recordsEntered },
    { label: "Open drives", value: report.activeDrives },
    { label: "Applications", value: report.applications },
    { label: "Offers", value: report.offers },
    { label: "Placed", value: report.placed },
    {
      label: "Placement rate",
      value:
        report.placementPercent === null
          ? "—"
          : `${report.placementPercent.toFixed(1)}%`,
    },
    { label: "Median package", value: lpa(report.medianLpa) },
    { label: "Highest package", value: lpa(report.highestLpa) },
    { label: "Average package", value: lpa(report.averageLpa) },
  ];

  return (
    <div className="mt-6 space-y-10 text-sm">
      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-5">
        {stats.map((s) => (
          <div key={s.label} className="bg-card p-3">
            <dd className="font-mono text-lg">{s.value}</dd>
            <dt className="mt-1 label-mono">{s.label}</dt>
          </div>
        ))}
      </dl>

      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline" size="sm">
          <Link href={route(`/campus/${slug}/placement/students`)}>
            Student records
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href={route(`/campus/${slug}/placement/companies`)}>Recruiters</Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <a href={`/campus/${slug}/placement/export`}>Export applications (CSV)</a>
        </Button>
      </div>

      <section aria-labelledby="drives-heading">
        <SectionHeading id="drives-heading" title="Drives" count={drives.length} />
        {drives.length === 0 ? (
          <p className="mt-3 text-muted-foreground">
            No drives yet. Create the first one below.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {drives.map((d) => (
              <li key={d.id}>
                <Link
                  href={route(`/campus/${slug}/placement/drives/${d.id}`)}
                  className="group flex flex-wrap items-center gap-x-4 gap-y-1 py-3"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium group-hover:text-brand-300">
                      {d.title}
                    </span>
                    <span className="block text-muted-foreground">{d.companyName}</span>
                  </span>
                  <span className="font-mono text-xs text-subtle-foreground">
                    {d._count.applications} applied
                  </span>
                  <Badge variant={d.status === "OPEN" ? "success" : "outline"}>
                    {d.status.toLowerCase()}
                  </Badge>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {report.byDepartment.length > 0 && (
        <section aria-labelledby="departments-heading">
          <SectionHeading id="departments-heading" title="By department" />
          <div className="mt-3 overflow-x-auto rounded-lg border border-border bg-card">
            <table className="w-full min-w-[24rem]">
              <caption className="sr-only">Placed students by department</caption>
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left [&>th]:label-mono [&>th]:font-normal">
                  <th scope="col" className="px-4 py-2.5">
                    Department
                  </th>
                  <th scope="col" className="px-4 py-2.5 text-right">
                    Students
                  </th>
                  <th scope="col" className="px-4 py-2.5 text-right">
                    Placed
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {report.byDepartment.map((row) => (
                  <tr key={row.department}>
                    <td className="px-4 py-2.5">{row.department}</td>
                    <td className="px-4 py-2.5 text-right font-mono">{row.students}</td>
                    <td className="px-4 py-2.5 text-right font-mono">{row.placed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section aria-labelledby="new-drive">
        <SectionHeading
          id="new-drive"
          title="New drive"
          description="It stays a draft until you open it. Leave a rule blank to not apply it. Times are UTC."
        />
        {companies.length === 0 ? (
          <p className="mt-3 text-muted-foreground">
            Add a recruiter first.{" "}
            <Link
              href={route(`/campus/${slug}/placement/companies`)}
              className="text-info underline"
            >
              Go to recruiters
            </Link>
          </p>
        ) : (
          <CmsForm
            action={createDriveAction.bind(null, slug)}
            submitLabel="Create drive"
            className="mt-3 max-w-3xl"
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="d-company" className={label}>
                  Recruiter
                </label>
                <NativeSelect id="d-company" name="companyId" className="mt-1 w-full">
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <div>
                <label htmlFor="d-title" className={label}>
                  Role
                </label>
                <Input
                  id="d-title"
                  name="title"
                  required
                  maxLength={160}
                  className="mt-1"
                />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="d-description" className={label}>
                  Description
                </label>
                <Textarea
                  id="d-description"
                  name="description"
                  required
                  maxLength={5000}
                  className="mt-1"
                />
              </div>
              <div>
                <label htmlFor="d-deadline" className={label}>
                  Application deadline
                </label>
                <Input
                  id="d-deadline"
                  name="deadline"
                  type="datetime-local"
                  required
                  className="mt-1"
                />
              </div>
              <div>
                <label htmlFor="d-package" className={label}>
                  Package (LPA)
                </label>
                <Input
                  id="d-package"
                  name="packageLpa"
                  type="number"
                  min={0}
                  step="0.01"
                  className="mt-1"
                />
              </div>
              <div>
                <label htmlFor="d-cgpa" className={label}>
                  Minimum CGPA
                </label>
                <Input
                  id="d-cgpa"
                  name="minCgpa"
                  type="number"
                  min={0}
                  max={10}
                  step="0.01"
                  className="mt-1"
                />
              </div>
              <div>
                <label htmlFor="d-backlogs" className={label}>
                  Maximum backlogs
                </label>
                <Input
                  id="d-backlogs"
                  name="maxBacklogs"
                  type="number"
                  min={0}
                  className="mt-1"
                />
              </div>
              <div>
                <label htmlFor="d-attendance" className={label}>
                  Minimum attendance %
                </label>
                <Input
                  id="d-attendance"
                  name="minAttendance"
                  type="number"
                  min={0}
                  max={100}
                  className="mt-1"
                />
              </div>
              <div>
                <label htmlFor="d-departments" className={label}>
                  Departments, comma separated
                </label>
                <Input id="d-departments" name="departments" className="mt-1" />
              </div>
              <div>
                <label htmlFor="d-batches" className={label}>
                  Graduation years, comma separated
                </label>
                <Input id="d-batches" name="batchYears" className="mt-1" />
              </div>
              <div>
                <label htmlFor="d-skills" className={label}>
                  Required skills, comma separated
                </label>
                <Input id="d-skills" name="requiredSkills" className="mt-1" />
              </div>
              <label className="flex items-center gap-2">
                <input type="checkbox" name="isInternship" />
                This is an internship
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" name="excludePlaced" defaultChecked />
                Exclude students who have accepted an offer
              </label>
            </div>
          </CmsForm>
        )}
      </section>
    </div>
  );
}

async function StudentView({ ctx }: { ctx: MemberContext }) {
  const slug = ctx.institution.slug;
  const { record, drives } = await getStudentPlacement(ctx);
  return (
    <div className="mt-6 space-y-8 text-sm">
      <section aria-labelledby="record-heading">
        <SectionHeading
          id="record-heading"
          title="Your record"
          description="Entered by your placement office. Ask them to correct anything that is wrong."
        />
        {record ? (
          <p className="mt-3">
            {record.department}, graduating {record.batchYear}. CGPA{" "}
            <span className="font-mono">{record.cgpa}</span>, backlogs{" "}
            <span className="font-mono">{record.backlogs}</span>
            {record.attendancePercent !== null && (
              <>
                , attendance{" "}
                <span className="font-mono">{record.attendancePercent}%</span>
              </>
            )}
            .
          </p>
        ) : (
          <p className="mt-3 text-muted-foreground">
            Your placement office has not entered your record yet, so you cannot apply
            to drives.
          </p>
        )}
      </section>

      <section aria-labelledby="student-drives">
        <SectionHeading id="student-drives" title="Drives" count={drives.length} />
        {drives.length === 0 ? (
          <EmptyState
            icon={BriefcaseBusiness}
            title="No drives are open"
            description="When your placement office opens a drive, it appears here with whether you qualify."
          />
        ) : (
          <ul className="mt-3 space-y-3">
            {drives.map((d) => (
              <li key={d.id} className="rounded-lg border border-border bg-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="font-medium">{d.title}</h3>
                    <p className="text-muted-foreground">
                      {d.companyName}
                      {d.isInternship ? ", internship" : ""}
                      {d.packageLpa !== null ? ` · ${lpa(d.packageLpa)}` : ""}
                    </p>
                  </div>
                  {d.application ? (
                    <Badge variant="info">{STAGE_LABEL[d.application.stage]}</Badge>
                  ) : (
                    <Badge variant={d.eligibility.eligible ? "success" : "outline"}>
                      {d.eligibility.eligible ? "You qualify" : "You do not qualify"}
                    </Badge>
                  )}
                </div>
                <p className="mt-2 whitespace-pre-line text-muted-foreground">
                  {d.description}
                </p>
                <p className="mt-2 font-mono text-xs text-subtle-foreground">
                  Apply by <When date={d.deadline} />
                </p>

                {!d.application && d.eligibility.checks.length > 0 && (
                  <ul className="mt-3 space-y-1">
                    {d.eligibility.checks.map((check) => (
                      <li key={check.rule} className="flex items-start gap-2">
                        {check.passed ? (
                          <Check
                            className="mt-0.5 size-3.5 shrink-0 text-success"
                            aria-label="Met"
                          />
                        ) : (
                          <X
                            className="mt-0.5 size-3.5 shrink-0 text-destructive"
                            aria-label="Not met"
                          />
                        )}
                        <span>
                          <span className="font-medium">{check.rule}:</span>{" "}
                          {check.detail}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}

                {d.application?.offerLpa != null && (
                  <p className="mt-3 font-medium">
                    Offer: {lpa(d.application.offerLpa)}
                  </p>
                )}

                <div className="mt-3 flex flex-wrap gap-2">
                  {!d.application && d.status === "OPEN" && d.eligibility.eligible && (
                    <CmsForm
                      action={applyAction.bind(null, slug, d.id)}
                      submitLabel="Apply"
                      size="sm"
                      className="[&>div]:mt-0"
                    />
                  )}
                  {d.application?.stage === "OFFERED" && (
                    <>
                      <CmsForm
                        action={respondToOfferAction.bind(
                          null,
                          slug,
                          d.application.id,
                          true
                        )}
                        submitLabel="Accept offer"
                        size="sm"
                        className="[&>div]:mt-0"
                      />
                      <CmsForm
                        action={respondToOfferAction.bind(
                          null,
                          slug,
                          d.application.id,
                          false
                        )}
                        submitLabel="Decline offer"
                        size="sm"
                        variant="outline"
                        className="[&>div]:mt-0"
                      />
                    </>
                  )}
                  {d.application &&
                    ["APPLIED", "SHORTLISTED", "INTERVIEWING"].includes(
                      d.application.stage
                    ) && (
                      <CmsForm
                        action={withdrawAction.bind(null, slug, d.application.id)}
                        submitLabel="Withdraw"
                        size="sm"
                        variant="ghost"
                        className="[&>div]:mt-0"
                      />
                    )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export default async function PlacementPage({
  params,
}: PageProps<"/campus/[slug]/placement">) {
  const { slug } = await params;
  const ctx = await requireMember(slug);
  const isOffice = can(ctx, "placement.manage");

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
      <PageHeader
        eyebrow={
          <CampusTrail
            items={[
              { label: ctx.institution.name, href: `/campus/${slug}` },
              { label: "Placement" },
            ]}
          />
        }
        title={isOffice ? "Placement office" : "Placement drives"}
        description={
          isOffice
            ? "Drives, recruiters, applications and offers for this college."
            : "See where you qualify and why, apply, and follow your applications."
        }
      />
      {isOffice ? <OfficeView ctx={ctx} /> : <StudentView ctx={ctx} />}
    </div>
  );
}
