import type { Metadata } from "next";

import { CmsForm } from "@/components/admin/cms-forms";
import { CampusTrail } from "@/components/campus/campus-trail";
import { PageHeader } from "@/components/common/page-header";
import { SectionHeading } from "@/components/common/section-heading";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { requireMember } from "@/lib/tenancy/context";
import { listPlacementStudents } from "@/services/placement";

import { importRecordsAction, saveRecordAction } from "../actions";

export const metadata: Metadata = { title: "Student records" };

const label = "text-xs font-medium";

export default async function PlacementStudentsPage({
  params,
}: PageProps<"/campus/[slug]/placement/students">) {
  const { slug } = await params;
  const ctx = await requireMember(slug, "placement.manage");
  const students = await listPlacementStudents(ctx);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 text-sm sm:px-6 sm:py-8">
      <PageHeader
        eyebrow={
          <CampusTrail
            items={[
              { label: ctx.institution.name, href: `/campus/${slug}` },
              { label: "Placement", href: `/campus/${slug}/placement` },
              { label: "Student records" },
            ]}
          />
        }
        title="Student records"
        description="The figures eligibility is decided on. Students can read theirs but not change them."
      />

      <section aria-labelledby="records" className="mt-6">
        <SectionHeading id="records" title="Students" count={students.length} />
        {students.length === 0 ? (
          <p className="mt-3 text-muted-foreground">
            No students have joined yet. Invite them from your college page.
          </p>
        ) : (
          <ul className="mt-2 divide-y divide-border">
            {students.map((s) => (
              <li key={s.userId}>
                <details className="py-3">
                  <summary className="flex cursor-pointer flex-wrap items-center gap-2">
                    <span className="font-medium">{s.name ?? s.email}</span>
                    <span className="text-muted-foreground">{s.email}</span>
                    {s.record ? (
                      <span className="ml-auto font-mono text-xs text-subtle-foreground">
                        {s.record.department} · {s.record.batchYear} · CGPA{" "}
                        {s.record.cgpa}
                      </span>
                    ) : (
                      <Badge variant="warning" className="ml-auto">
                        No record
                      </Badge>
                    )}
                  </summary>
                  <CmsForm
                    action={saveRecordAction.bind(null, slug, s.userId)}
                    submitLabel="Save record"
                    size="sm"
                    className="mt-3"
                  >
                    <div className="grid gap-2 sm:grid-cols-3">
                      <div>
                        <label htmlFor={`dep-${s.userId}`} className={label}>
                          Department
                        </label>
                        <Input
                          id={`dep-${s.userId}`}
                          name="department"
                          required
                          maxLength={60}
                          defaultValue={s.record?.department}
                        />
                      </div>
                      <div>
                        <label htmlFor={`batch-${s.userId}`} className={label}>
                          Graduation year
                        </label>
                        <Input
                          id={`batch-${s.userId}`}
                          name="batchYear"
                          type="number"
                          required
                          defaultValue={s.record?.batchYear}
                        />
                      </div>
                      <div>
                        <label htmlFor={`cgpa-${s.userId}`} className={label}>
                          CGPA
                        </label>
                        <Input
                          id={`cgpa-${s.userId}`}
                          name="cgpa"
                          type="number"
                          min={0}
                          max={10}
                          step="0.01"
                          required
                          defaultValue={s.record?.cgpa}
                        />
                      </div>
                      <div>
                        <label htmlFor={`back-${s.userId}`} className={label}>
                          Backlogs
                        </label>
                        <Input
                          id={`back-${s.userId}`}
                          name="backlogs"
                          type="number"
                          min={0}
                          defaultValue={s.record?.backlogs ?? 0}
                        />
                      </div>
                      <div>
                        <label htmlFor={`att-${s.userId}`} className={label}>
                          Attendance %
                        </label>
                        <Input
                          id={`att-${s.userId}`}
                          name="attendancePercent"
                          type="number"
                          min={0}
                          max={100}
                          defaultValue={s.record?.attendancePercent ?? ""}
                        />
                      </div>
                      <div>
                        <label htmlFor={`skills-${s.userId}`} className={label}>
                          Skills, comma separated
                        </label>
                        <Input
                          id={`skills-${s.userId}`}
                          name="skills"
                          defaultValue={s.record?.skills.join(", ")}
                        />
                      </div>
                    </div>
                  </CmsForm>
                </details>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="import" className="mt-10">
        <SectionHeading
          id="import"
          title="Import records"
          description="One comma-separated line per student, in this order: email, department, graduation year, CGPA, backlogs, attendance, skills. Separate skills with semicolons. If any line is wrong, nothing is imported."
        />
        <CmsForm
          action={importRecordsAction.bind(null, slug)}
          submitLabel="Import"
          savedLabel="Imported."
          variant="outline"
          className="mt-3 max-w-3xl"
        >
          <label htmlFor="records-csv" className="sr-only">
            Records as CSV
          </label>
          <Textarea
            id="records-csv"
            name="csv"
            rows={6}
            required
            className="font-mono text-xs"
            placeholder="student@college.edu,CSE,2027,8.2,0,88,Python;SQL"
          />
        </CmsForm>
      </section>
    </div>
  );
}
