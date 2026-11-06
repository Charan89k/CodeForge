/**
 * Puts the courses in src/data/courses through the CMS, as a named admin.
 *
 *   npm run courses:author -- --admin you@example.com            up to "in review"
 *   npm run courses:author -- --admin you@example.com --publish \
 *     --reviewer colleague@example.com                           and publish
 *
 * Publishing takes a second admin, because the CMS refuses self-review.
 *
 * It calls the same service functions as the admin screens, so permissions,
 * validation, version history and the audit log all apply, and it refuses an
 * account that is not a platform admin. Running it again changes only what
 * differs: a lesson whose words are already published is left alone.
 */
import "dotenv/config";

import {
  AUTHORED_COURSES,
  courseHours,
  lessonMarkdown,
  lessonMinutes,
  quizSlug,
  type CourseSource,
  type LessonSource,
} from "../src/data/courses";
import { prisma } from "../src/lib/db";
import {
  createChapter,
  createCourse,
  createSection,
  publishRevision,
  saveChapterQuiz,
  saveDraft,
  setCoursePublished,
  submitForReview,
  updateCourse,
  type CmsActor,
} from "../src/services/cms";

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

async function authorLesson(
  admin: CmsActor,
  course: CourseSource,
  sectionId: string,
  lesson: LessonSource,
  reviewer: CmsActor | null
): Promise<string> {
  const existing = await prisma.chapter.findUnique({
    where: { sectionId_slug: { sectionId, slug: lesson.slug } },
    select: { id: true },
  });
  const chapterId =
    existing?.id ??
    (await createChapter(admin, sectionId, { title: lesson.title, slug: lesson.slug }));

  const slug = quizSlug(course, lesson);
  const quiz = await prisma.quiz.findUnique({
    where: { slug },
    select: { status: true },
  });
  if (quiz?.status !== "PUBLISHED") {
    await saveChapterQuiz(admin, chapterId, {
      slug,
      title: `Check: ${lesson.title}`,
      questions: lesson.questions,
    });
  }

  const markdown = lessonMarkdown(course, lesson);
  const latest = () =>
    prisma.chapterRevision.findFirst({
      where: { chapterId },
      orderBy: { number: "desc" },
      select: { id: true, status: true, markdown: true },
    });

  let revision = await latest();
  if (revision?.markdown !== markdown || revision.status === "REJECTED") {
    if (revision?.status === "IN_REVIEW") {
      throw new Error(`${lesson.slug}: a different version is already in review.`);
    }
    await saveDraft(admin, chapterId, {
      title: lesson.title,
      summary: lesson.summary,
      markdown,
      objectives: lesson.objectives,
      keyTakeaways: lesson.keyTakeaways,
      readingMinutes: lessonMinutes(markdown),
      difficulty: lesson.difficulty,
    });
    revision = await latest();
  }
  if (revision!.status === "DRAFT") await submitForReview(admin, revision!.id);
  if (reviewer && revision!.status !== "PUBLISHED") {
    await publishRevision(reviewer, revision!.id);
    return "published";
  }
  return revision!.status === "PUBLISHED" ? "unchanged" : "in review";
}

async function authorCourse(
  admin: CmsActor,
  course: CourseSource,
  reviewer: CmsActor | null
) {
  const publish = reviewer !== null;
  const input = {
    title: course.title,
    slug: course.slug,
    subtitle: course.subtitle,
    description: course.description,
    category: course.category,
    level: course.level,
    estimatedHours: courseHours(course),
    outcomes: course.outcomes,
    prerequisites: course.prerequisites,
    featured: false,
  };
  const existing = await prisma.course.findUnique({
    where: { slug: course.slug },
    select: { id: true, status: true },
  });
  const courseId = existing?.id ?? (await createCourse(admin, input));
  if (existing) await updateCourse(admin, courseId, input);

  const tally: Record<string, number> = {};
  for (const section of course.sections) {
    const find = () =>
      prisma.courseSection.findUnique({
        where: { courseId_slug: { courseId, slug: section.slug } },
        select: { id: true },
      });
    if (!(await find())) {
      await createSection(admin, courseId, {
        title: section.title,
        slug: section.slug,
        summary: section.summary,
      });
    }
    const { id: sectionId } = (await find())!;
    for (const lesson of section.lessons) {
      const outcome = await authorLesson(admin, course, sectionId, lesson, reviewer);
      tally[outcome] = (tally[outcome] ?? 0) + 1;
    }
  }
  if (publish && existing?.status !== "PUBLISHED") {
    await setCoursePublished(admin, courseId, true);
  }
  const status = publish ? "course published" : (existing?.status ?? "DRAFT");
  console.log(`${course.slug}: ${JSON.stringify(tally)}, ${status}`);
}

async function main() {
  const email = argument("--admin");
  if (!email) throw new Error("Pass --admin <email> of a platform admin.");
  const actor = (address: string) =>
    prisma.user.findUnique({
      where: { email: address.toLowerCase() },
      select: { id: true, email: true, role: true },
    });
  const admin = await actor(email);
  if (!admin) throw new Error("No account has that email.");

  let reviewer: CmsActor | null = null;
  if (process.argv.includes("--publish")) {
    const address = argument("--reviewer");
    if (!address)
      throw new Error("--publish needs --reviewer <email> of a second admin.");
    reviewer = await actor(address);
    if (!reviewer) throw new Error("No account has the reviewer's email.");
    if (reviewer.id === admin.id)
      throw new Error("The reviewer must be a different admin.");
  }
  for (const course of AUTHORED_COURSES) await authorCourse(admin, course, reviewer);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
