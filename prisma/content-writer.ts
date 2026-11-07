import type { PrismaClient } from "../src/generated/prisma/client";
import type { CourseSeed } from "../src/data/curriculum/types";
import type { LLDExerciseSeed } from "../src/data/lld/exercises";
import type { ExerciseSeed } from "../src/data/system-design/exercises";
import type { Track } from "../src/generated/prisma/enums";

/**
 * Writes courses and design exercises.
 *
 * Shared by the seed and by scripts/content-sync.ts, so content published
 * to production is written exactly as a fresh database writes it.
 *
 * Idempotent: everything upserts on its natural key (course slug, section
 * slug within a course, chapter slug within a section, exercise slug), and
 * ordering comes from position, so appending a section or an exercise never
 * renumbers the ones before it. Learner progress and submissions reference
 * these rows by id and are untouched.
 */

/**
 * How a write treats rows that already exist.
 *
 * `onlyNew` creates what is missing and leaves every existing row exactly as
 * it is — title, content, order and status included. That is the safe
 * default for production, where an admin may have unpublished a chapter:
 * rewriting it from source would quietly publish it again. `created`
 * collects a label for every row actually created, for reporting.
 */
export type WriteOptions = { onlyNew?: boolean; created?: string[] };

/** Upserts a course with its sections and chapters. Returns chapter ids by slug. */
export async function upsertCourse(
  db: PrismaClient,
  seed: CourseSeed,
  track: Track,
  order: number,
  patternIds: Map<string, string>,
  problemIds: Map<string, string>,
  options: WriteOptions = {}
): Promise<Map<string, string>> {
  const chapterIds = new Map<string, string>();
  const onlyNew = options.onlyNew ?? false;

  const course = await db.course.upsert({
    where: { slug: seed.slug },
    create: {
      slug: seed.slug,
      title: seed.title,
      subtitle: seed.subtitle,
      description: seed.description,
      track,
      icon: seed.icon,
      category: seed.category,
      status: "PUBLISHED",
      order,
      estimatedHours: seed.estimatedHours,
    },
    update: onlyNew
      ? {}
      : {
          title: seed.title,
          subtitle: seed.subtitle,
          description: seed.description,
          icon: seed.icon,
          category: seed.category,
          status: "PUBLISHED",
          order,
          estimatedHours: seed.estimatedHours,
        },
    select: { id: true },
  });

  for (const [sectionIndex, section] of seed.sections.entries()) {
    const sectionExisted = await db.courseSection.findUnique({
      where: { courseId_slug: { courseId: course.id, slug: section.slug } },
      select: { id: true },
    });
    if (!sectionExisted) options.created?.push(`section ${seed.slug}/${section.slug}`);
    const sectionRow = await db.courseSection.upsert({
      where: { courseId_slug: { courseId: course.id, slug: section.slug } },
      create: {
        courseId: course.id,
        slug: section.slug,
        title: section.title,
        summary: section.summary,
        order: sectionIndex * 10,
        status: "PUBLISHED",
      },
      update: onlyNew
        ? {}
        : {
            title: section.title,
            summary: section.summary,
            order: sectionIndex * 10,
            status: "PUBLISHED",
          },
      select: { id: true },
    });

    for (const [chapterIndex, chapter] of section.chapters.entries()) {
      const chapterExisted = await db.chapter.findUnique({
        where: { sectionId_slug: { sectionId: sectionRow.id, slug: chapter.slug } },
        select: { id: true },
      });
      if (chapterExisted && onlyNew) {
        chapterIds.set(chapter.slug, chapterExisted.id);
        continue;
      }
      if (!chapterExisted)
        options.created?.push(`chapter ${section.slug}/${chapter.slug}`);
      const chapterRow = await db.chapter.upsert({
        where: {
          sectionId_slug: { sectionId: sectionRow.id, slug: chapter.slug },
        },
        create: {
          sectionId: sectionRow.id,
          slug: chapter.slug,
          title: chapter.title,
          summary: chapter.summary,
          content: chapter.content as object,
          objectives: chapter.objectives,
          keyTakeaways: chapter.keyTakeaways,
          readingMinutes: chapter.readingMinutes,
          difficulty: chapter.difficulty,
          order: chapterIndex * 10,
          status: "PUBLISHED",
        },
        update: {
          title: chapter.title,
          summary: chapter.summary,
          content: chapter.content as object,
          objectives: chapter.objectives,
          keyTakeaways: chapter.keyTakeaways,
          readingMinutes: chapter.readingMinutes,
          difficulty: chapter.difficulty,
          order: chapterIndex * 10,
          status: "PUBLISHED",
        },
        select: { id: true },
      });

      chapterIds.set(chapter.slug, chapterRow.id);

      await db.chapterPattern.deleteMany({
        where: { chapterId: chapterRow.id },
      });
      for (const slug of chapter.patterns ?? []) {
        const patternId = patternIds.get(slug);
        if (!patternId) {
          throw new Error(`Chapter ${chapter.slug} references unknown pattern ${slug}`);
        }
        await db.chapterPattern.create({
          data: { chapterId: chapterRow.id, patternId },
        });
      }

      await db.chapterProblem.deleteMany({
        where: { chapterId: chapterRow.id },
      });
      for (const [order, slug] of (chapter.problems ?? []).entries()) {
        const problemId = problemIds.get(slug);
        if (!problemId) {
          throw new Error(`Chapter ${chapter.slug} references unknown problem ${slug}`);
        }
        await db.chapterProblem.create({
          data: { chapterId: chapterRow.id, problemId, order },
        });
      }
    }
  }

  return chapterIds;
}

export async function upsertSystemDesignExercises(
  db: PrismaClient,
  exercises: ExerciseSeed[],
  options: WriteOptions = {}
): Promise<void> {
  for (const [index, exercise] of exercises.entries()) {
    const payload = {
      title: exercise.title,
      tagline: exercise.tagline,
      difficulty: exercise.difficulty,
      status: "PUBLISHED" as const,
      order: index * 10,
      functionalRequirements: exercise.functionalRequirements,
      nonFunctionalRequirements: exercise.nonFunctionalRequirements,
      scaleEstimate: exercise.scaleEstimate as object,
      apiDesign: exercise.apiDesign as object,
      dataModel: exercise.dataModel as object,
      architecture: exercise.architecture as object,
      bottlenecks: exercise.bottlenecks,
      scalingNotes: exercise.scalingNotes as object,
      tradeoffs: exercise.tradeoffs as object,
    };

    const existed = await db.systemDesignProblem.findUnique({
      where: { slug: exercise.slug },
      select: { id: true },
    });
    if (existed && options.onlyNew) continue;
    if (!existed) options.created?.push(`system-design exercise ${exercise.slug}`);
    await db.systemDesignProblem.upsert({
      where: { slug: exercise.slug },
      create: { slug: exercise.slug, ...payload },
      update: payload,
    });
  }
}

export async function upsertLLDExercises(
  db: PrismaClient,
  exercises: LLDExerciseSeed[],
  options: WriteOptions = {}
): Promise<void> {
  for (const [index, exercise] of exercises.entries()) {
    const payload = {
      title: exercise.title,
      tagline: exercise.tagline,
      difficulty: exercise.difficulty,
      status: "PUBLISHED" as const,
      order: index * 10,
      requirements: exercise.requirements,
      constraints: exercise.constraints,
      objectives: exercise.objectives,
      principles: exercise.principles,
      designPatterns: exercise.designPatterns,
      extensions: exercise.extensions,
      entities: exercise.entities as object,
      hints: exercise.hints,
      classDiagram: exercise.classDiagram as object,
      code: exercise.code as object,
      tradeoffs: exercise.tradeoffs as object,
    };

    const existed = await db.lLDProblem.findUnique({
      where: { slug: exercise.slug },
      select: { id: true },
    });
    if (existed && options.onlyNew) continue;
    if (!existed) options.created?.push(`lld exercise ${exercise.slug}`);
    await db.lLDProblem.upsert({
      where: { slug: exercise.slug },
      create: { slug: exercise.slug, ...payload },
      update: payload,
    });
  }
}
