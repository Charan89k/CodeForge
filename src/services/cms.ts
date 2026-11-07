import "server-only";

import { z } from "zod";

import { Prisma } from "@/generated/prisma/client";
import { Difficulty, CourseLevel } from "@/generated/prisma/enums";
import { markdownToBlocks, MarkdownError } from "@/lib/cms/markdown";
import { prisma } from "@/lib/db";
import { contentDocumentSchema } from "@/lib/validation/content";

/**
 * Authoring courses. The chapter row only ever holds published content; every
 * edit is a `ChapterRevision`, so a draft is never visible to learners and any
 * earlier version can be restored. Status changes claim the row with a guarded
 * update, so two people pressing Publish cannot both win.
 */
export type CmsActor = { id: string; email: string; role: string };

export class CmsError extends Error {
  constructor(
    readonly code: "invalid" | "conflict" | "not_found",
    message: string
  ) {
    super(message);
    this.name = "CmsError";
  }
}

function assertAdmin(actor: CmsActor): void {
  if (actor.role !== "ADMIN")
    throw new Error("Only a platform admin can edit content.");
}

async function audit(
  tx: Prisma.TransactionClient,
  actor: CmsActor,
  action: string,
  entity: string,
  entityId: string,
  summary: string
) {
  await tx.auditLog.create({
    data: {
      actorId: actor.id,
      actorEmail: actor.email,
      action,
      entity,
      entityId,
      summary,
    },
  });
}

const slugSchema = z
  .string()
  .trim()
  .regex(
    /^[a-z0-9](?:[a-z0-9-]{0,78}[a-z0-9])?$/,
    "Use lowercase letters, digits and hyphens."
  );
const lines = (value: unknown) =>
  String(value ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

export const courseInputSchema = z.object({
  title: z.string().trim().min(3).max(120),
  slug: slugSchema,
  subtitle: z.string().trim().max(200).optional(),
  description: z.string().trim().min(10).max(4000),
  category: z.string().trim().min(2).max(60),
  level: z.nativeEnum(CourseLevel),
  estimatedHours: z.number().int().min(0).max(1000),
  outcomes: z.array(z.string().max(300)).max(20),
  prerequisites: z.array(z.string().max(300)).max(20),
  featured: z.boolean(),
  license: z.string().trim().max(120).optional(),
  attribution: z.string().trim().max(2000).optional(),
});
export type CourseInput = z.infer<typeof courseInputSchema>;

export function parseCourseForm(form: FormData) {
  const text = (name: string) => {
    const value = String(form.get(name) ?? "").trim();
    return value || undefined;
  };
  return courseInputSchema.safeParse({
    title: text("title"),
    slug: text("slug"),
    subtitle: text("subtitle"),
    description: text("description"),
    category: text("category"),
    level: text("level"),
    estimatedHours: Number(form.get("estimatedHours") ?? 0),
    outcomes: lines(form.get("outcomes")),
    prerequisites: lines(form.get("prerequisites")),
    featured: form.get("featured") === "on",
    license: text("license"),
    attribution: text("attribution"),
  });
}

export async function listCmsCourses() {
  return prisma.course.findMany({
    orderBy: [{ track: "asc" }, { order: "asc" }, { createdAt: "asc" }],
    take: 200,
    select: {
      id: true,
      slug: true,
      title: true,
      status: true,
      track: true,
      category: true,
      level: true,
      _count: { select: { sections: true } },
    },
  });
}

export async function getCmsCourse(id: string) {
  return prisma.course.findUnique({
    where: { id },
    include: {
      sections: {
        orderBy: { order: "asc" },
        include: {
          chapters: {
            orderBy: { order: "asc" },
            select: {
              id: true,
              slug: true,
              title: true,
              status: true,
              revisions: {
                orderBy: { number: "desc" },
                take: 1,
                select: { number: true, status: true },
              },
            },
          },
        },
      },
    },
  });
}

export async function createCourse(
  actor: CmsActor,
  input: CourseInput
): Promise<string> {
  assertAdmin(actor);
  try {
    return await prisma.$transaction(async (tx) => {
      const top = await tx.course.aggregate({
        where: { track: "GENERAL" },
        _max: { order: true },
      });
      const course = await tx.course.create({
        data: { ...input, track: "GENERAL", order: (top._max.order ?? 0) + 1 },
        select: { id: true },
      });
      await audit(
        tx,
        actor,
        "course.created",
        "course",
        course.id,
        `Created ${input.slug}`
      );
      return course.id;
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new CmsError("conflict", "That slug is taken.");
    }
    throw error;
  }
}

export async function updateCourse(
  actor: CmsActor,
  id: string,
  input: CourseInput
): Promise<void> {
  assertAdmin(actor);
  try {
    await prisma.$transaction(async (tx) => {
      await tx.course.update({
        where: { id },
        data: {
          ...input,
          // The form sends an emptied field as undefined, which Prisma would skip.
          subtitle: input.subtitle ?? null,
          license: input.license ?? null,
          attribution: input.attribution ?? null,
        },
      });
      await audit(tx, actor, "course.updated", "course", id, `Updated ${input.slug}`);
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new CmsError("conflict", "That slug is taken.");
    }
    throw error;
  }
}

/** A course can go live only with something in it to read. */
export async function setCoursePublished(
  actor: CmsActor,
  id: string,
  published: boolean
): Promise<void> {
  assertAdmin(actor);
  await prisma.$transaction(async (tx) => {
    if (published) {
      const live = await tx.chapter.count({
        where: { status: "PUBLISHED", section: { courseId: id } },
      });
      if (live === 0)
        throw new CmsError("invalid", "Publish at least one chapter first.");
    }
    await tx.course.update({
      where: { id },
      data: { status: published ? "PUBLISHED" : "DRAFT" },
    });
    await audit(
      tx,
      actor,
      published ? "course.published" : "course.unpublished",
      "course",
      id,
      id
    );
  });
}

export async function createSection(
  actor: CmsActor,
  courseId: string,
  input: { title: string; slug: string; summary?: string }
): Promise<void> {
  assertAdmin(actor);
  const slug = slugSchema.safeParse(input.slug);
  const title = input.title.trim();
  if (!slug.success || title.length < 2) {
    throw new CmsError("invalid", "A section needs a title and a slug.");
  }
  try {
    await prisma.$transaction(async (tx) => {
      const top = await tx.courseSection.aggregate({
        where: { courseId },
        _max: { order: true },
      });
      const section = await tx.courseSection.create({
        data: {
          courseId,
          title,
          slug: slug.data,
          summary: input.summary?.trim() || null,
          order: (top._max.order ?? 0) + 1,
          // Visible once it has a published chapter; the reader filters on both.
          status: "PUBLISHED",
        },
        select: { id: true },
      });
      await audit(
        tx,
        actor,
        "section.created",
        "section",
        section.id,
        `Created ${slug.data}`
      );
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new CmsError("conflict", "That slug is taken in this course.");
    }
    throw error;
  }
}

export async function createChapter(
  actor: CmsActor,
  sectionId: string,
  input: { title: string; slug: string }
): Promise<string> {
  assertAdmin(actor);
  const slug = slugSchema.safeParse(input.slug);
  const title = input.title.trim();
  if (!slug.success || title.length < 2) {
    throw new CmsError("invalid", "A chapter needs a title and a slug.");
  }
  try {
    return await prisma.$transaction(async (tx) => {
      const top = await tx.chapter.aggregate({
        where: { sectionId },
        _max: { order: true },
      });
      const chapter = await tx.chapter.create({
        data: {
          sectionId,
          title,
          slug: slug.data,
          status: "DRAFT",
          order: (top._max.order ?? 0) + 1,
        },
        select: { id: true },
      });
      await audit(
        tx,
        actor,
        "chapter.created",
        "chapter",
        chapter.id,
        `Created ${slug.data}`
      );
      return chapter.id;
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new CmsError("conflict", "That slug is taken in this section.");
    }
    throw error;
  }
}

export async function getChapterForEditing(chapterId: string) {
  return prisma.chapter.findUnique({
    where: { id: chapterId },
    include: {
      section: {
        select: {
          title: true,
          slug: true,
          course: { select: { id: true, title: true, slug: true, track: true } },
        },
      },
      revisions: {
        orderBy: { number: "desc" },
        take: 50,
        select: {
          id: true,
          number: true,
          status: true,
          title: true,
          summary: true,
          markdown: true,
          content: true,
          objectives: true,
          keyTakeaways: true,
          readingMinutes: true,
          difficulty: true,
          reviewNote: true,
          publishedAt: true,
          updatedAt: true,
          author: { select: { email: true } },
        },
      },
    },
  });
}

export type DraftInput = {
  title: string;
  summary?: string;
  /** Exactly one of these: Markdown, or blocks as JSON for existing chapters. */
  markdown?: string;
  blocksJson?: string;
  objectives: string[];
  keyTakeaways: string[];
  readingMinutes: number;
  difficulty: Difficulty;
};

/** Parses and validates the source, or explains what is wrong with it. */
export function compileDraft(input: Pick<DraftInput, "markdown" | "blocksJson">) {
  let blocks: unknown;
  try {
    if (input.markdown !== undefined) blocks = markdownToBlocks(input.markdown);
    else blocks = JSON.parse(input.blocksJson ?? "[]");
  } catch (error) {
    throw new CmsError(
      "invalid",
      error instanceof MarkdownError ? error.message : "That is not valid JSON."
    );
  }
  const parsed = contentDocumentSchema.safeParse(blocks);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new CmsError(
      "invalid",
      `Block ${issue?.path.join(".") ?? ""}: ${issue?.message ?? "invalid content"}`
    );
  }
  return parsed.data;
}

/** Saving edits the open draft, or starts a new one after the previous was submitted. */
export async function saveDraft(
  actor: CmsActor,
  chapterId: string,
  input: DraftInput
): Promise<void> {
  assertAdmin(actor);
  const title = input.title.trim();
  if (title.length < 2 || title.length > 160) {
    throw new CmsError("invalid", "A chapter title is 2 to 160 characters.");
  }
  const content = compileDraft(input) as unknown as Prisma.InputJsonValue;
  const data = {
    title,
    summary: input.summary?.trim() || null,
    markdown: input.markdown ?? null,
    content,
    objectives: input.objectives,
    keyTakeaways: input.keyTakeaways,
    readingMinutes: Math.min(Math.max(1, Math.round(input.readingMinutes) || 5), 240),
    difficulty: input.difficulty,
  };

  await prisma.$transaction(async (tx) => {
    const latest = await tx.chapterRevision.findFirst({
      where: { chapterId },
      orderBy: { number: "desc" },
      select: { id: true, number: true, status: true },
    });
    if (latest?.status === "DRAFT") {
      await tx.chapterRevision.update({
        where: { id: latest.id },
        data: { ...data, authorId: actor.id },
      });
      return;
    }
    await tx.chapterRevision.create({
      data: {
        ...data,
        chapterId,
        authorId: actor.id,
        number: (latest?.number ?? 0) + 1,
      },
    });
  });
}

async function moveRevision(
  actor: CmsActor,
  revisionId: string,
  from: "DRAFT" | "IN_REVIEW",
  to: "IN_REVIEW" | "REJECTED",
  action: string,
  extra: { reviewNote?: string } = {}
): Promise<void> {
  assertAdmin(actor);
  await prisma.$transaction(async (tx) => {
    const claimed = await tx.chapterRevision.updateMany({
      where: { id: revisionId, status: from },
      data: {
        status: to,
        ...(to === "REJECTED"
          ? { reviewerId: actor.id, reviewNote: extra.reviewNote ?? null }
          : {}),
      },
    });
    if (claimed.count !== 1)
      throw new CmsError("conflict", "That version has already moved on.");
    await audit(tx, actor, action, "chapter_revision", revisionId, `${from} to ${to}`);
  });
}

export const submitForReview = (actor: CmsActor, revisionId: string) =>
  moveRevision(actor, revisionId, "DRAFT", "IN_REVIEW", "revision.submitted");

export const rejectRevision = (
  actor: CmsActor,
  revisionId: string,
  reviewNote: string
) =>
  moveRevision(actor, revisionId, "IN_REVIEW", "REJECTED", "revision.rejected", {
    reviewNote,
  });

/** Copies a reviewed revision onto the chapter learners read. */
export async function publishRevision(
  actor: CmsActor,
  revisionId: string
): Promise<void> {
  assertAdmin(actor);
  await prisma.$transaction(async (tx) => {
    const claimed = await tx.chapterRevision.updateMany({
      where: { id: revisionId, status: "IN_REVIEW" },
      data: { status: "PUBLISHED", reviewerId: actor.id, publishedAt: new Date() },
    });
    if (claimed.count !== 1) {
      throw new CmsError("conflict", "Only a version in review can be published.");
    }

    const revision = await tx.chapterRevision.findUniqueOrThrow({
      where: { id: revisionId },
    });
    // Validated again: the schema may have tightened since it was saved.
    const content = contentDocumentSchema.parse(
      revision.content
    ) as unknown as Prisma.InputJsonValue;
    await tx.chapter.update({
      where: { id: revision.chapterId },
      data: {
        title: revision.title,
        summary: revision.summary,
        content,
        objectives: revision.objectives,
        keyTakeaways: revision.keyTakeaways,
        readingMinutes: revision.readingMinutes,
        difficulty: revision.difficulty,
        status: "PUBLISHED",
        // The library's "recently updated" means the course's reading changed.
        section: { update: { course: { update: { updatedAt: new Date() } } } },
      },
    });
    // A chapter's knowledge check goes live with it, never ahead of it.
    await tx.quiz.updateMany({
      where: { chapterId: revision.chapterId, status: "DRAFT" },
      data: { status: "PUBLISHED" },
    });
    await audit(
      tx,
      actor,
      "revision.published",
      "chapter",
      revision.chapterId,
      `Published v${revision.number}`
    );
  });
}

export const chapterQuizSchema = z
  .object({
    slug: slugSchema,
    title: z.string().trim().min(2).max(160),
    passScore: z.number().int().min(1).max(100).default(70),
    questions: z
      .array(
        z.object({
          type: z.enum(["MULTIPLE_CHOICE", "TRUE_FALSE", "CODE_OUTPUT"]),
          prompt: z.string().trim().min(5).max(2000),
          code: z.string().max(4000).optional(),
          options: z
            .array(
              z.object({
                id: z.string().min(1).max(8),
                text: z.string().min(1).max(500),
              })
            )
            .min(2)
            .max(6),
          answer: z.string().min(1).max(8),
          explanation: z.string().trim().min(10).max(2000),
        })
      )
      .min(1)
      .max(20),
  })
  .superRefine((quiz, ctx) => {
    quiz.questions.forEach((question, index) => {
      const ids = question.options.map((o) => o.id);
      if (new Set(ids).size !== ids.length || !ids.includes(question.answer)) {
        ctx.addIssue({
          code: "custom",
          path: ["questions", index, "answer"],
          message: "Option ids must be unique and the answer must be one of them.",
        });
      }
    });
  });
export type ChapterQuizInput = z.input<typeof chapterQuizSchema>;

/**
 * Writes a chapter's knowledge check as a draft; publishing a revision of the
 * chapter takes it live. A quiz already live is left alone, because replacing
 * it would skip review.
 */
export async function saveChapterQuiz(
  actor: CmsActor,
  chapterId: string,
  input: ChapterQuizInput
): Promise<void> {
  assertAdmin(actor);
  const parsed = chapterQuizSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new CmsError(
      "invalid",
      `Quiz ${issue?.path.join(".") ?? ""}: ${issue?.message ?? "invalid"}`
    );
  }
  const quiz = parsed.data;
  await prisma.$transaction(async (tx) => {
    const existing = await tx.quiz.findUnique({
      where: { slug: quiz.slug },
      select: { id: true, chapterId: true, status: true },
    });
    if (existing && existing.chapterId !== chapterId) {
      throw new CmsError("conflict", "That quiz slug belongs to another chapter.");
    }
    if (existing && existing.status !== "DRAFT") {
      throw new CmsError("conflict", "That quiz is live and cannot be replaced.");
    }
    const row = await tx.quiz.upsert({
      where: { slug: quiz.slug },
      create: {
        slug: quiz.slug,
        title: quiz.title,
        passScore: quiz.passScore,
        chapterId,
        status: "DRAFT",
      },
      update: { title: quiz.title, passScore: quiz.passScore },
      select: { id: true },
    });
    await tx.quizQuestion.deleteMany({ where: { quizId: row.id } });
    await tx.quizQuestion.createMany({
      data: quiz.questions.map((question, order) => ({
        quizId: row.id,
        type: question.type,
        order,
        prompt: question.prompt,
        code: question.code ?? null,
        options: question.options,
        answer: question.answer,
        explanation: question.explanation,
      })),
    });
    await audit(tx, actor, "quiz.saved", "quiz", row.id, `Saved ${quiz.slug}`);
  });
}

/** Restoring never rewrites history: it starts a new draft from the old version. */
export async function restoreRevision(
  actor: CmsActor,
  revisionId: string
): Promise<void> {
  assertAdmin(actor);
  await prisma.$transaction(async (tx) => {
    const old = await tx.chapterRevision.findUnique({ where: { id: revisionId } });
    if (!old) throw new CmsError("not_found", "That version does not exist.");
    const latest = await tx.chapterRevision.findFirstOrThrow({
      where: { chapterId: old.chapterId },
      orderBy: { number: "desc" },
      select: { id: true, number: true, status: true },
    });
    if (latest.status === "DRAFT" || latest.status === "IN_REVIEW") {
      throw new CmsError("conflict", "Finish or reject the open version first.");
    }
    await tx.chapterRevision.create({
      data: {
        chapterId: old.chapterId,
        number: latest.number + 1,
        title: old.title,
        summary: old.summary,
        markdown: old.markdown,
        content: old.content as Prisma.InputJsonValue,
        objectives: old.objectives,
        keyTakeaways: old.keyTakeaways,
        readingMinutes: old.readingMinutes,
        difficulty: old.difficulty,
        authorId: actor.id,
      },
    });
    await audit(
      tx,
      actor,
      "revision.restored",
      "chapter",
      old.chapterId,
      `Draft from v${old.number}`
    );
  });
}
