import type { Metadata } from "next";
import Link from "next/link";

import { CmsForm } from "@/components/admin/cms-forms";
import { SectionHeading } from "@/components/common/section-heading";
import { Badge } from "@/components/ui/badge";
import { requireAdmin } from "@/lib/auth/session";
import { route } from "@/lib/utils";
import { listCmsCourses } from "@/services/cms";

import { createCourseAction } from "./actions";
import { CourseFields } from "./course-fields";

export const metadata: Metadata = { title: "Courses" };

export default async function AdminCoursesPage() {
  await requireAdmin();
  const courses = await listCmsCourses();

  return (
    <div className="space-y-8 text-sm">
      <section aria-labelledby="all-courses">
        <SectionHeading id="all-courses" title="All courses" count={courses.length} />
        <div className="mt-3 overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full min-w-[40rem]">
            <caption className="sr-only">Every course and its status</caption>
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left [&>th]:label-mono [&>th]:font-normal">
                <th scope="col" className="px-4 py-2.5">
                  Course
                </th>
                <th scope="col" className="px-4 py-2.5">
                  Category
                </th>
                <th scope="col" className="px-4 py-2.5">
                  Level
                </th>
                <th scope="col" className="px-4 py-2.5 text-right">
                  Sections
                </th>
                <th scope="col" className="px-4 py-2.5">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {courses.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-2.5">
                    <Link
                      href={route(`/admin/courses/${c.id}`)}
                      className="font-medium text-info hover:underline"
                    >
                      {c.title}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {c.category ?? c.track}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground capitalize">
                    {c.level.toLowerCase()}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono">
                    {c._count.sections}
                  </td>
                  <td className="px-4 py-2.5">
                    <Badge variant={c.status === "PUBLISHED" ? "success" : "outline"}>
                      {c.status.toLowerCase()}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="new-course">
        <SectionHeading
          id="new-course"
          title="New course"
          description="It stays a draft until you publish it. Learners see nothing before that."
        />
        <CmsForm
          action={createCourseAction}
          submitLabel="Create course"
          className="mt-3 max-w-3xl"
        >
          <CourseFields />
        </CmsForm>
      </section>
    </div>
  );
}
