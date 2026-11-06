import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CmsForm } from "@/components/admin/cms-forms";
import { SectionHeading } from "@/components/common/section-heading";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { requireAdmin } from "@/lib/auth/session";
import { courseHref } from "@/lib/tracks";
import { route } from "@/lib/utils";
import { getCmsCourse } from "@/services/cms";

import {
  createChapterAction,
  createSectionAction,
  setCoursePublishedAction,
  updateCourseAction,
} from "../actions";
import { CourseFields } from "../course-fields";

export const metadata: Metadata = { title: "Edit course" };

const label = "text-sm font-medium";

export default async function AdminCoursePage({
  params,
}: PageProps<"/admin/courses/[courseId]">) {
  await requireAdmin();
  const { courseId } = await params;
  const course = await getCmsCourse(courseId);
  if (!course) notFound();
  const published = course.status === "PUBLISHED";

  return (
    <div className="space-y-8 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            href="/admin/courses"
            className="text-muted-foreground hover:text-foreground"
          >
            All courses
          </Link>
          <h2 className="mt-1 flex items-center gap-2 text-lg font-semibold">
            {course.title}
            <Badge variant={published ? "success" : "outline"}>
              {course.status.toLowerCase()}
            </Badge>
          </h2>
        </div>
        <div className="flex items-center gap-3">
          {published && (
            <Link
              href={route(courseHref(course.track, course.slug))}
              className="text-info hover:underline"
            >
              View live
            </Link>
          )}
          <CmsForm
            action={setCoursePublishedAction.bind(null, course.id, !published)}
            submitLabel={published ? "Unpublish course" : "Publish course"}
            variant={published ? "outline" : "default"}
            size="sm"
            className="[&>div]:mt-0"
          />
        </div>
      </div>

      <section aria-labelledby="curriculum">
        <SectionHeading
          id="curriculum"
          title="Curriculum"
          count={course.sections.length}
        />
        <div className="mt-3 space-y-4">
          {course.sections.map((section) => (
            <div
              key={section.id}
              className="rounded-lg border border-border bg-card p-4"
            >
              <h3 className="font-medium">{section.title}</h3>
              <ul className="mt-2 divide-y divide-border">
                {section.chapters.map((chapter) => {
                  const revision = chapter.revisions[0];
                  return (
                    <li
                      key={chapter.id}
                      className="flex flex-wrap items-center justify-between gap-2 py-2"
                    >
                      <Link
                        href={route(
                          `/admin/courses/${course.id}/chapters/${chapter.id}`
                        )}
                        className="text-info hover:underline"
                      >
                        {chapter.title}
                      </Link>
                      <span className="flex items-center gap-2">
                        {revision && (
                          <span className="font-mono text-xs text-subtle-foreground">
                            v{revision.number}{" "}
                            {revision.status.toLowerCase().replace("_", " ")}
                          </span>
                        )}
                        <Badge
                          variant={
                            chapter.status === "PUBLISHED" ? "success" : "outline"
                          }
                        >
                          {chapter.status.toLowerCase()}
                        </Badge>
                      </span>
                    </li>
                  );
                })}
              </ul>
              <CmsForm
                action={createChapterAction.bind(null, course.id, section.id)}
                submitLabel="Add chapter"
                variant="outline"
                size="sm"
                className="mt-3 border-t border-border pt-3"
              >
                <div className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <label htmlFor={`ch-title-${section.id}`} className={label}>
                      Chapter title
                    </label>
                    <Input
                      id={`ch-title-${section.id}`}
                      name="title"
                      required
                      maxLength={160}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <label htmlFor={`ch-slug-${section.id}`} className={label}>
                      Chapter slug
                    </label>
                    <Input
                      id={`ch-slug-${section.id}`}
                      name="slug"
                      required
                      maxLength={80}
                      className="mt-1"
                    />
                  </div>
                </div>
              </CmsForm>
            </div>
          ))}
        </div>
        <CmsForm
          action={createSectionAction.bind(null, course.id)}
          submitLabel="Add section"
          variant="outline"
          className="mt-4 max-w-2xl"
        >
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <label htmlFor="section-title" className={label}>
                Section title
              </label>
              <Input
                id="section-title"
                name="title"
                required
                maxLength={160}
                className="mt-1"
              />
            </div>
            <div>
              <label htmlFor="section-slug" className={label}>
                Section slug
              </label>
              <Input
                id="section-slug"
                name="slug"
                required
                maxLength={80}
                className="mt-1"
              />
            </div>
          </div>
        </CmsForm>
      </section>

      <section aria-labelledby="details">
        <SectionHeading id="details" title="Details" />
        <CmsForm
          action={updateCourseAction.bind(null, course.id)}
          submitLabel="Save details"
          className="mt-3 max-w-3xl"
        >
          <CourseFields values={course} />
        </CmsForm>
      </section>
    </div>
  );
}
