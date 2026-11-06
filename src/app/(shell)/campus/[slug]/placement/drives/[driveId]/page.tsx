import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CmsForm } from "@/components/admin/cms-forms";
import { CampusTrail } from "@/components/campus/campus-trail";
import { When } from "@/components/campus/when";
import { PageHeader } from "@/components/common/page-header";
import { SectionHeading } from "@/components/common/section-heading";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { officeMovesFrom } from "@/lib/placement/eligibility";
import { requireMember } from "@/lib/tenancy/context";
import { getOfficeDrive } from "@/services/placement";

import { moveApplicationAction, setDriveStatusAction } from "../../actions";

export const metadata: Metadata = { title: "Placement drive" };

const NEXT_STATUS = {
  DRAFT: [{ to: "OPEN", label: "Open applications" }],
  OPEN: [{ to: "CLOSED", label: "Close applications" }],
  CLOSED: [
    { to: "OPEN", label: "Reopen" },
    { to: "COMPLETED", label: "Mark completed" },
  ],
  COMPLETED: [],
} as const;

const MOVE_LABEL: Record<string, string> = {
  SHORTLISTED: "Shortlist",
  INTERVIEWING: "Move to interview",
  OFFERED: "Make offer",
  REJECTED: "Not selected",
};

export default async function PlacementDrivePage({
  params,
}: PageProps<"/campus/[slug]/placement/drives/[driveId]">) {
  const { slug, driveId } = await params;
  const ctx = await requireMember(slug, "placement.manage");
  const result = await getOfficeDrive(ctx, driveId);
  if (!result) notFound();
  const { drive, eligibleCount, studentCount } = result;

  const rules = [
    drive.minCgpa !== null && `CGPA at least ${Number(drive.minCgpa)}`,
    drive.maxBacklogs !== null && `At most ${drive.maxBacklogs} backlogs`,
    drive.minAttendance !== null && `Attendance at least ${drive.minAttendance}%`,
    drive.departments.length > 0 && `Departments: ${drive.departments.join(", ")}`,
    drive.batchYears.length > 0 && `Graduating: ${drive.batchYears.join(", ")}`,
    drive.requiredSkills.length > 0 && `Skills: ${drive.requiredSkills.join(", ")}`,
    drive.excludePlaced && "Not already placed",
  ].filter(Boolean) as string[];

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 text-sm sm:px-6 sm:py-8">
      <PageHeader
        eyebrow={
          <CampusTrail
            items={[
              { label: ctx.institution.name, href: `/campus/${slug}` },
              { label: "Placement", href: `/campus/${slug}/placement` },
              { label: drive.title },
            ]}
          />
        }
        title={drive.title}
        description={drive.companyName}
      />

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Badge variant={drive.status === "OPEN" ? "success" : "outline"}>
          {drive.status.toLowerCase()}
        </Badge>
        <span className="font-mono text-xs text-subtle-foreground">
          Deadline <When date={drive.deadline} /> · {eligibleCount} of {studentCount}{" "}
          students qualify
        </span>
        {NEXT_STATUS[drive.status].map((move) => (
          <CmsForm
            key={move.to}
            action={setDriveStatusAction.bind(null, slug, drive.id, move.to)}
            submitLabel={move.label}
            size="sm"
            variant="outline"
            className="[&>div]:mt-0"
          />
        ))}
      </div>

      <p className="mt-4 whitespace-pre-line text-muted-foreground">
        {drive.description}
      </p>
      <ul className="mt-3 list-disc space-y-0.5 pl-4">
        {rules.length === 0 ? (
          <li>No eligibility rules: open to every student.</li>
        ) : null}
        {rules.map((rule) => (
          <li key={rule}>{rule}</li>
        ))}
      </ul>

      <section aria-labelledby="applicants" className="mt-8">
        <SectionHeading
          id="applicants"
          title="Applicants"
          count={drive.applications.length}
        />
        {drive.applications.length === 0 ? (
          <p className="mt-3 text-muted-foreground">Nobody has applied yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {drive.applications.map((application) => {
              const moves = officeMovesFrom(application.stage);
              return (
                <li key={application.id} className="py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">
                      {application.user.name ?? application.user.email}
                    </span>
                    <span className="text-muted-foreground">
                      {application.user.email}
                    </span>
                    <Badge variant="info">{application.stage.toLowerCase()}</Badge>
                    {application.offerLpa !== null && (
                      <span className="font-mono text-xs">
                        {Number(application.offerLpa).toFixed(2)} LPA
                      </span>
                    )}
                  </div>
                  <div className="mt-2 flex flex-wrap items-end gap-2">
                    {moves.map((to) => (
                      <CmsForm
                        key={to}
                        action={moveApplicationAction.bind(
                          null,
                          slug,
                          application.id,
                          to
                        )}
                        submitLabel={MOVE_LABEL[to] ?? to}
                        size="sm"
                        variant={to === "REJECTED" ? "ghost" : "outline"}
                        className={
                          to === "OFFERED"
                            ? "flex items-end gap-2 [&>div]:mt-0"
                            : "[&>div]:mt-0"
                        }
                      >
                        {to === "OFFERED" && (
                          <div>
                            <label
                              htmlFor={`lpa-${application.id}`}
                              className="text-xs"
                            >
                              Offer (LPA)
                            </label>
                            <Input
                              id={`lpa-${application.id}`}
                              name="offerLpa"
                              type="number"
                              min={0}
                              step="0.01"
                              required
                              className="mt-0.5 w-28"
                            />
                          </div>
                        )}
                      </CmsForm>
                    ))}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
