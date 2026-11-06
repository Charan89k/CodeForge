import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));

import { prisma } from "@/lib/db";

import {
  CmsError,
  createChapter,
  createCourse,
  createSection,
  getChapterForEditing,
  publishRevision,
  rejectRevision,
  restoreRevision,
  saveChapterQuiz,
  saveDraft,
  setCoursePublished,
  submitForReview,
  updateCourse,
  type CmsActor,
  type DraftInput,
} from "./cms";
import { getQuiz } from "./quiz";

const tag = `cms-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
let admin: CmsActor;
let reviewer: CmsActor;
let courseId = "";
let sectionId = "";
let chapterId = "";

const draft = (markdown: string): DraftInput => ({
  title: "Variables",
  summary: "Names for values",
  markdown,
  objectives: ["Name things"],
  keyTakeaways: ["Names matter"],
  readingMinutes: 6,
  difficulty: "EASY",
});
const latest = async () => (await getChapterForEditing(chapterId))!.revisions[0]!;
const chapter = () => prisma.chapter.findUniqueOrThrow({ where: { id: chapterId } });

describe("the course CMS", () => {
  beforeAll(async () => {
    const user = await prisma.user.create({
      data: { email: `${tag}@techepitome.test`, role: "ADMIN" },
      select: { id: true, email: true, role: true },
    });
    admin = user;
    reviewer = await prisma.user.create({
      data: { email: `${tag}-reviewer@techepitome.test`, role: "ADMIN" },
      select: { id: true, email: true, role: true },
    });
    courseId = await createCourse(admin, {
      title: "Python Basics",
      slug: tag,
      description: "An original course for testing the CMS.",
      category: "Programming",
      level: "BEGINNER",
      estimatedHours: 3,
      outcomes: ["Write a script"],
      prerequisites: [],
      featured: false,
    });
    await createSection(admin, courseId, { title: "Start", slug: "start" });
    const section = await prisma.courseSection.findFirstOrThrow({
      where: { courseId },
    });
    sectionId = section.id;
    chapterId = await createChapter(admin, sectionId, {
      title: "Variables",
      slug: "variables",
    });
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany({
      where: { actorId: { in: [admin.id, reviewer.id] } },
    });
    await prisma.course.deleteMany({ where: { id: courseId } });
    await prisma.user.deleteMany({ where: { id: { in: [admin.id, reviewer.id] } } });
  });

  it("refuses anyone who is not a platform admin", async () => {
    const learner = { ...admin, role: "USER" };
    await expect(saveDraft(learner, chapterId, draft("text"))).rejects.toThrow(
      /platform admin/
    );
    await expect(setCoursePublished(learner, courseId, true)).rejects.toThrow(
      /platform admin/
    );
  });

  it("clears optional course fields left empty on edit", async () => {
    const base = {
      title: "Python Basics",
      slug: tag,
      description: "An original course for testing the CMS.",
      category: "Programming",
      level: "BEGINNER" as const,
      estimatedHours: 3,
      outcomes: ["Write a script"],
      prerequisites: [],
      featured: false,
    };
    await updateCourse(admin, courseId, {
      ...base,
      subtitle: "Old",
      license: "CC-BY-4.0",
      attribution: "Someone",
    });
    await updateCourse(admin, courseId, base);
    expect(
      await prisma.course.findUniqueOrThrow({
        where: { id: courseId },
        select: { subtitle: true, license: true, attribution: true },
      })
    ).toEqual({ subtitle: null, license: null, attribution: null });
  });

  it("will not publish a course with nothing in it", async () => {
    await expect(setCoursePublished(admin, courseId, true)).rejects.toBeInstanceOf(
      CmsError
    );
  });

  it("explains bad source and saves nothing", async () => {
    await expect(saveDraft(admin, chapterId, draft("# Title"))).rejects.toThrow(
      /Line 1/
    );
    expect((await getChapterForEditing(chapterId))!.revisions).toHaveLength(0);
  });

  it("keeps a draft away from learners until it is published", async () => {
    await saveDraft(admin, chapterId, draft("## First\n\nHello"));
    expect((await chapter()).status).toBe("DRAFT");
    expect((await chapter()).content).toEqual([]);

    await saveDraft(admin, chapterId, draft("## First\n\nHello again"));
    expect((await getChapterForEditing(chapterId))!.revisions).toHaveLength(1);

    const revision = await latest();
    await expect(publishRevision(reviewer, revision.id)).rejects.toThrow(/in review/);
    await submitForReview(admin, revision.id);
    await publishRevision(reviewer, revision.id);

    const live = await chapter();
    expect(live.status).toBe("PUBLISHED");
    expect(JSON.stringify(live.content)).toContain("Hello again");
    await setCoursePublished(admin, courseId, true);
  });

  it("keeps the published version while the next draft is edited", async () => {
    await saveDraft(admin, chapterId, draft("## Second\n\nChanged"));
    expect((await latest()).number).toBe(2);
    expect(JSON.stringify((await chapter()).content)).toContain("Hello again");
  });

  it("records a rejection with its note and leaves the chapter alone", async () => {
    const revision = await latest();
    await submitForReview(admin, revision.id);
    await expect(rejectRevision(admin, revision.id, "Mine")).rejects.toThrow(
      /different admin/
    );
    await expect(publishRevision(admin, revision.id)).rejects.toThrow(
      /different admin/
    );
    await rejectRevision(reviewer, revision.id, "Needs an example");
    expect(await latest()).toMatchObject({
      status: "REJECTED",
      reviewNote: "Needs an example",
    });
    expect(JSON.stringify((await chapter()).content)).toContain("Hello again");
  });

  it("restores an old version as a new draft without rewriting history", async () => {
    const versions = (await getChapterForEditing(chapterId))!.revisions;
    await restoreRevision(admin, versions.find((v) => v.number === 1)!.id);
    const restored = await latest();
    expect(restored).toMatchObject({ number: 3, status: "DRAFT" });
    expect(restored.markdown).toContain("Hello again");
    await expect(restoreRevision(admin, restored.id)).rejects.toThrow(/open version/);
  });

  it("lets only one of two simultaneous publishes win", async () => {
    const revision = await latest();
    await submitForReview(admin, revision.id);
    const results = await Promise.allSettled([
      publishRevision(reviewer, revision.id),
      publishRevision(reviewer, revision.id),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  });

  describe("knowledge checks", () => {
    const quiz = {
      slug: `${tag}-check`,
      title: "Check",
      questions: [
        {
          type: "MULTIPLE_CHOICE" as const,
          prompt: "Which name is a value bound to?",
          options: [
            { id: "a", text: "A variable" },
            { id: "b", text: "A loop" },
          ],
          answer: "a",
          explanation: "A variable names a value.",
        },
      ],
    };
    let draftChapter = "";

    beforeAll(async () => {
      draftChapter = await createChapter(admin, sectionId, {
        title: "With a check",
        slug: "with-a-check",
      });
    });

    it("refuses an answer that is not an option, and a non-admin", async () => {
      await expect(
        saveChapterQuiz(admin, draftChapter, {
          ...quiz,
          questions: [{ ...quiz.questions[0]!, answer: "z" }],
        })
      ).rejects.toThrow(/answer must be one of them/);
      await expect(
        saveChapterQuiz({ ...admin, role: "USER" }, draftChapter, quiz)
      ).rejects.toThrow(/platform admin/);
    });

    it("stays hidden until its chapter is published, and is then fixed", async () => {
      await saveChapterQuiz(admin, draftChapter, quiz);
      expect(await getQuiz(quiz.slug)).toBeNull();

      await saveDraft(admin, draftChapter, draft(`## Check\n\n:::quiz ${quiz.slug}`));
      const revision = (await getChapterForEditing(draftChapter))!.revisions[0]!;
      await submitForReview(admin, revision.id);
      expect(await getQuiz(quiz.slug)).toBeNull();
      await publishRevision(reviewer, revision.id);

      const live = await getQuiz(quiz.slug);
      expect(live?.questions).toHaveLength(1);
      expect(JSON.stringify(live)).not.toContain("explanation");
      await expect(saveChapterQuiz(admin, draftChapter, quiz)).rejects.toThrow(/live/);
      await expect(saveChapterQuiz(admin, chapterId, quiz)).rejects.toThrow(
        /another chapter/
      );
    });
  });

  it("keeps lessons and sections in the order they were added", async () => {
    await createSection(admin, courseId, { title: "Second", slug: "second" });
    const second = await prisma.courseSection.findFirstOrThrow({
      where: { courseId, slug: "second" },
    });
    const first = await prisma.courseSection.findUniqueOrThrow({
      where: { id: sectionId },
    });
    expect(second.order).toBeGreaterThan(first.order);

    for (const slug of ["one", "two", "three"]) {
      await createChapter(admin, second.id, { title: slug, slug });
    }
    const orders = await prisma.chapter.findMany({
      where: { sectionId: second.id },
      orderBy: { order: "asc" },
      select: { slug: true },
    });
    expect(orders.map((c) => c.slug)).toEqual(["one", "two", "three"]);
  });

  it("marks the course updated when a chapter is published", async () => {
    const before = await prisma.course.findUniqueOrThrow({
      where: { id: courseId },
      select: { updatedAt: true },
    });
    const chapterWithDraft = await createChapter(admin, sectionId, {
      title: "Later",
      slug: "later",
    });
    await saveDraft(admin, chapterWithDraft, draft("## Later\n\nText"));
    const revision = (await getChapterForEditing(chapterWithDraft))!.revisions[0]!;
    await submitForReview(admin, revision.id);
    await publishRevision(reviewer, revision.id);
    const after = await prisma.course.findUniqueOrThrow({
      where: { id: courseId },
      select: { updatedAt: true },
    });
    expect(after.updatedAt.getTime()).toBeGreaterThan(before.updatedAt.getTime());
  });

  it("audits publishing", async () => {
    expect(
      await prisma.auditLog.count({
        where: { entityId: chapterId, action: "revision.published" },
      })
    ).toBeGreaterThanOrEqual(2);
  });

  it("keeps the author when another admin edits, and bars both from reviewing", async () => {
    const third = await prisma.user.create({
      data: { email: `${tag}-third@techepitome.test`, role: "ADMIN" },
      select: { id: true, email: true, role: true },
    });
    try {
      const shared = await createChapter(admin, sectionId, {
        title: "Shared",
        slug: "shared",
      });
      await saveDraft(admin, shared, draft("## Shared\n\nFirst words"));
      await saveDraft(reviewer, shared, draft("## Shared\n\nA small edit"));
      await saveDraft(reviewer, shared, draft("## Shared\n\nAnother edit"));
      const revision = (await getChapterForEditing(shared))!.revisions[0]!;

      expect(revision).toMatchObject({
        authorId: admin.id,
        editorIds: [admin.id, reviewer.id],
        author: { email: admin.email },
        lastEditor: { email: reviewer.email },
      });

      await submitForReview(admin, revision.id);
      for (const contributor of [admin, reviewer]) {
        await expect(publishRevision(contributor, revision.id)).rejects.toThrow(
          /different admin/
        );
        await expect(rejectRevision(contributor, revision.id, "No")).rejects.toThrow(
          /different admin/
        );
      }
      await publishRevision(third, revision.id);

      await expect(
        prisma.chapterRevision.findUniqueOrThrow({ where: { id: revision.id } })
      ).resolves.toMatchObject({
        status: "PUBLISHED",
        authorId: admin.id,
        lastEditedById: reviewer.id,
        reviewerId: third.id,
      });
    } finally {
      await prisma.auditLog.deleteMany({ where: { actorId: third.id } });
      await prisma.chapterRevision.updateMany({
        where: { reviewerId: third.id },
        data: { reviewerId: null },
      });
      await prisma.user.delete({ where: { id: third.id } });
    }
  });
});
