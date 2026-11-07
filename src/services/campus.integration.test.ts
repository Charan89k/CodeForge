import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// context.ts reaches Auth.js through the session helpers; contexts here are
// built from known users and never decode a cookie.
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));

import { bankQuestionSchema } from "@/lib/campus/schemas";
import { prisma } from "@/lib/db";
import { resolveMemberContext, type MemberContext } from "@/lib/tenancy/context";
import { withTenantScope, type TenantTx } from "@/lib/tenancy/scope";

import {
  addItem,
  closeAssessment,
  createAssessment,
  getStaffAssessment,
  gradeAnswer,
  listSubmissions,
  previewAssessment,
  publishAssessment,
  releaseResults,
  unpublishAssessment,
  updateAssessment,
} from "./campus-assessments";
import {
  getAttemptPaper,
  getAttemptReview,
  getStudentAssessment,
  saveAnswer,
  startAttempt,
  submitAttempt,
} from "./campus-attempts";
import { addQuestion, createBank, getBank, listBanks } from "./campus-banks";
import {
  addClassMember,
  assignContent,
  classProgress,
  createClass,
  getClass,
  listClasses,
  removeClassMember,
} from "./campus-classes";
import { getTeachingQueue } from "./campus-overview";
import { createInstitution } from "./institutions-platform";

/**
 * Campus learning end to end at the service layer, against the real
 * database and its row-level security: faculty build a class, a bank and
 * an exam; students take it; staff grade it. Every "cannot" is asserted
 * with a real id from the wrong side of the boundary, and the database
 * rules are probed directly under the te_tenant role so they hold even
 * where a service check is skipped.
 */

const S = `${Date.now()}-${Math.floor(Math.random() * 100_000)}`;
const minutes = (n: number) => new Date(Date.now() + n * 60_000);

type U = { id: string; email: string; name: string | null; role: "USER" | "ADMIN" };
const users: Record<string, U> = {};
let instA = { id: "", slug: "" };
let instB = { id: "", slug: "" };
let problemId = "";
const problemSlug = `campus-problem-${S}`;

async function makeUser(key: string, role: "USER" | "ADMIN" = "USER") {
  users[key] = await prisma.user.create({
    data: { email: `${key.toLowerCase()}-${S}@campus.test`, name: key, role },
    select: { id: true, email: true, name: true, role: true },
  });
}

async function join(
  key: string,
  institutionId: string,
  role: "STUDENT" | "FACULTY" | "INSTITUTION_ADMIN"
) {
  await prisma.institutionMembership.create({
    data: { institutionId, userId: users[key]!.id, role, source: "PLATFORM" },
  });
}

async function ctx(key: string, slug = instA.slug): Promise<MemberContext> {
  const c = await resolveMemberContext(users[key]!, slug);
  if (!c) throw new Error(`${key} has no context in ${slug}`);
  return c;
}

/** Raw access as te_tenant for `key`, to probe the policies directly. */
function asTenant<T>(key: string, fn: (tx: TenantTx) => Promise<T>): Promise<T> {
  return withTenantScope({ institutionId: instA.id, userId: users[key]!.id }, fn);
}

const rejects = (p: Promise<unknown>, code: string) =>
  expect(p).rejects.toMatchObject({ code });

const choice = (over: Record<string, unknown> = {}) =>
  bankQuestionSchema.parse({
    kind: "CHOICE",
    type: "MULTIPLE_CHOICE",
    category: "Aptitude",
    prompt: "2 + 2 = ?",
    optionLines: "3\n*4\n5",
    points: "2",
    explanation: "Arithmetic.",
    ...over,
  });

beforeAll(async () => {
  process.env.RATE_LIMIT_DISABLED = "true";
  await makeUser("platform", "ADMIN");
  for (const k of [
    "adminA",
    "facultyA",
    "faculty2A",
    "s1",
    "s2",
    "s3",
    "facultyB",
    "studentB",
  ]) {
    await makeUser(k);
  }
  instA = await createInstitution(users.platform!, {
    name: "Campus A",
    slug: `campus-a-${S}`,
  });
  instB = await createInstitution(users.platform!, {
    name: "Campus B",
    slug: `campus-b-${S}`,
  });
  await join("adminA", instA.id, "INSTITUTION_ADMIN");
  await join("facultyA", instA.id, "FACULTY");
  await join("faculty2A", instA.id, "FACULTY");
  for (const s of ["s1", "s2", "s3"]) await join(s, instA.id, "STUDENT");
  await join("facultyB", instB.id, "FACULTY");
  await join("studentB", instB.id, "STUDENT");

  const problem = await prisma.problem.create({
    data: {
      slug: problemSlug,
      // Far above the seeded catalogue, whose numbers are set explicitly.
      number: 800_000 + Math.floor(Math.random() * 90_000),
      title: "Campus Double",
      difficulty: "EASY",
      status: "PUBLISHED",
      testCases: { create: [{ input: "2", expected: "4", isSample: true }] },
    },
    select: { id: true },
  });
  problemId = problem.id;
});

afterAll(async () => {
  await prisma.user.deleteMany({
    where: { id: { in: Object.values(users).map((u) => u.id) } },
  });
  // Bank questions keep the problem (Restrict); they go with their institution's banks.
  await prisma.bankQuestion.deleteMany({ where: { problemId } });
  await prisma.problem.deleteMany({ where: { id: problemId } });
});

let classId = "";
let bankId = "";
let examId = "";
let attemptS1 = "";

describe("classes", () => {
  it("lets faculty create a class and become its instructor; students cannot", async () => {
    ({ id: classId } = await createClass(await ctx("facultyA"), {
      name: "CS101",
      description: null,
    }));
    await rejects(
      createClass(await ctx("s1"), { name: "x", description: null }),
      "forbidden"
    );
    const mine = await listClasses(await ctx("facultyA"));
    expect(mine.find((c) => c.id === classId)?.teaching).toBe(true);
  });

  it("enrols only active members in matching roles", async () => {
    const f = await ctx("facultyA");
    await addClassMember(f, classId, { email: users.s1!.email, role: "STUDENT" });
    await addClassMember(f, classId, { email: users.s2!.email, role: "STUDENT" });
    await rejects(
      addClassMember(f, classId, { email: users.faculty2A!.email, role: "STUDENT" }),
      "invalid"
    );
    await rejects(
      addClassMember(f, classId, { email: users.studentB!.email, role: "STUDENT" }),
      "invalid"
    );
    await rejects(
      addClassMember(f, classId, { email: users.s3!.email, role: "INSTRUCTOR" }),
      "invalid"
    );
  });

  it("lets only the class's instructors or an admin manage it", async () => {
    await rejects(
      addClassMember(await ctx("faculty2A"), classId, {
        email: users.s3!.email,
        role: "STUDENT",
      }),
      "forbidden"
    );
    await rejects(
      addClassMember(await ctx("s1"), classId, {
        email: users.s3!.email,
        role: "STUDENT",
      }),
      "forbidden"
    );
    // The admin can, so a class is never stranded without its instructor.
    await addClassMember(await ctx("adminA"), classId, {
      email: users.s3!.email,
      role: "STUDENT",
    });
    const detail = await getClass(await ctx("facultyA"), classId);
    const s3 = detail.members!.find((m) => m.user.id === users.s3!.id)!;
    await removeClassMember(await ctx("adminA"), classId, s3.id);
  });

  it("hides the class from other tenants and from students outside it", async () => {
    await rejects(getClass(await ctx("facultyB", instB.slug), classId), "not_found");
    await rejects(getClass(await ctx("s3"), classId), "not_found");
    await rejects(getClass(await ctx("faculty2A"), classId), "forbidden");
  });

  it("assigns published content and shows students no roster", async () => {
    await assignContent(await ctx("facultyA"), classId, {
      target: `problem:${problemId}`,
      instructions: "Solve before Friday.",
      dueAt: minutes(60 * 24),
    });
    const student = await getClass(await ctx("s1"), classId);
    expect(student.members).toBeNull();
    expect(student.assignments.map((a) => a.title)).toContain("Campus Double");
    expect(student.assignments[0]!.href).toBe(`/problems/${problemSlug}`);

    const grid = await classProgress(await ctx("facultyA"), classId);
    expect(grid.students.map((s) => s.id).sort()).toEqual(
      [users.s1!.id, users.s2!.id].sort()
    );
    await rejects(classProgress(await ctx("s1"), classId), "forbidden");
  });
});

describe("question banks", () => {
  it("are staff-only, in the service and in the database", async () => {
    ({ id: bankId } = await createBank(await ctx("facultyA"), {
      name: "Midterm",
      description: null,
    }));
    const f = await ctx("facultyA");
    await addQuestion(f, bankId, choice());
    await addQuestion(
      f,
      bankId,
      choice({
        type: "MULTI_SELECT",
        prompt: "Primes?",
        optionLines: "*2\n*3\n4",
        points: "3",
      })
    );
    await addQuestion(
      f,
      bankId,
      bankQuestionSchema.parse({
        kind: "CODING",
        problemSlug,
        category: "DSA",
        prompt: "Double the input.",
        points: "5",
      })
    );
    expect((await getBank(f, bankId)).questions).toHaveLength(3);
    await rejects(listBanks(await ctx("s1")), "forbidden");
    expect(await asTenant("s1", (tx) => tx.bankQuestion.count())).toBe(0);
    expect(await asTenant("s1", (tx) => tx.questionBank.count())).toBe(0);
  });

  it("can be edited only by the owner or an admin", async () => {
    await rejects(addQuestion(await ctx("faculty2A"), bankId, choice()), "forbidden");
    expect((await getBank(await ctx("faculty2A"), bankId)).editable).toBe(false);
  });
});

describe("assessment lifecycle", () => {
  it("keeps a draft invisible to students", async () => {
    ({ id: examId } = await createAssessment(await ctx("facultyA"), classId, {
      title: "Quiz 1",
      instructions: "No notes.",
      opensAt: minutes(60),
      closesAt: minutes(120),
      lateUntil: null,
      latePenaltyPercent: 0,
      durationMinutes: 30,
      maxAttempts: 1,
      scorePolicy: "BEST",
      showScoreOnSubmit: false,
    }));
    const f = await ctx("facultyA");
    const bank = await getBank(f, bankId);
    for (const q of bank.questions) await addItem(f, examId, { questionId: q.id });
    await rejects(getStudentAssessment(await ctx("s1"), examId), "not_found");
    expect(
      await asTenant("s1", (tx) => tx.assessment.count({ where: { id: examId } }))
    ).toBe(0);

    const preview = await previewAssessment(f, examId);
    expect(preview.questions).toHaveLength(3);
    expect(preview.maxScore).toBe(10);
    expect(JSON.stringify(preview.questions)).not.toContain('"answer"');
  });

  it("freezes the paper on publish, in the service and the database", async () => {
    const f = await ctx("facultyA");
    await publishAssessment(f, examId);
    const staff = await getStaffAssessment(f, examId);
    expect(staff.phase).toBe("scheduled");

    await rejects(
      addItem(f, examId, { questionId: staff.items[0]!.questionId }),
      "conflict"
    );
    await rejects(
      updateAssessment(f, examId, { ...staff.settings, durationMinutes: 90 }),
      "conflict"
    );
    // Editing a bank question afterwards does not reach the published paper.
    await prisma.bankQuestion.updateMany({
      where: { bankId },
      data: { prompt: "EDITED" },
    });
    const paper = await previewAssessment(f, examId);
    expect(paper.frozen).toBe(true);
    expect(paper.questions.map((q) => q.prompt)).not.toContain("EDITED");

    // Even the owner connection cannot rewrite a version or swap the items.
    await expect(
      prisma.assessmentVersion.updateMany({
        where: { assessmentId: examId },
        data: { maxScore: 99 },
      })
    ).rejects.toThrow(/immutable/);
    await expect(
      prisma.assessment.update({ where: { id: examId }, data: { items: [] } })
    ).rejects.toThrow(/frozen/);
  });

  it("refuses to start before it opens and seals the paper until then", async () => {
    const s1 = await ctx("s1");
    expect((await getStudentAssessment(s1, examId)).phase).toBe("scheduled");
    await rejects(startAttempt(s1, examId), "conflict");
    // A scheduled exam's questions are not readable by a student at all.
    expect(await asTenant("s1", (tx) => tx.assessmentVersion.count())).toBe(0);
    // Nor can a student slip an attempt in past the policy.
    const a = await prisma.assessment.findUniqueOrThrow({ where: { id: examId } });
    await expect(
      asTenant("s1", (tx) =>
        tx.assessmentAttempt.create({
          data: {
            institutionId: instA.id,
            cohortId: classId,
            assessmentId: examId,
            versionId: a.currentVersionId!,
            userId: users.s1!.id,
            number: 1,
            deadlineAt: minutes(10),
            maxScore: 0,
          },
        })
      )
    ).rejects.toThrow();

    await prisma.assessment.update({
      where: { id: examId },
      data: { opensAt: minutes(-1) },
    });
  });

  it("starts exactly one attempt under concurrent clicks", async () => {
    const s1 = await ctx("s1");
    const ids = await Promise.all([startAttempt(s1, examId), startAttempt(s1, examId)]);
    expect(ids[0]).toBe(ids[1]);
    attemptS1 = ids[0];
    expect(
      await prisma.assessmentAttempt.count({
        where: { assessmentId: examId, userId: users.s1!.id },
      })
    ).toBe(1);

    const paper = await getAttemptPaper(s1, attemptS1);
    expect(paper.questions).toHaveLength(3);
    expect(paper.deadlineAt.getTime()).toBeLessThanOrEqual(minutes(31).getTime());
    expect(JSON.stringify(paper)).not.toMatch(/"answer"|Arithmetic/);
    // The key stays unreadable even with an attempt open.
    expect(await asTenant("s1", (tx) => tx.assessmentAnswerKey.count())).toBe(0);
  });

  it("autosaves idempotently and in order", async () => {
    const s1 = await ctx("s1");
    const save = (questionKey: string, value: unknown, seq: number) =>
      saveAnswer(s1, { attemptId: attemptS1, questionKey, value, seq });

    expect(await save("q1", "a", 1)).toEqual({ status: "saved", seq: 1 });
    expect(await save("q1", "a", 1)).toEqual({ status: "stale", seq: 1 });
    expect(await save("q1", "b", 3)).toEqual({ status: "saved", seq: 3 });
    expect(await save("q1", "c", 2)).toEqual({ status: "stale", seq: 3 });
    await Promise.all([save("q2", ["a"], 1), save("q2", ["a", "b"], 2)]);
    await save("q3", { language: "PYTHON", code: "print(int(input())*2)" }, 1);

    await rejects(save("q1", "z", 4), "invalid");
    await rejects(save("q2", "a", 5), "invalid");
    await rejects(save("q9", "a", 6), "invalid");

    const saved = await prisma.attemptAnswer.findMany({
      where: { attemptId: attemptS1 },
    });
    expect(saved.find((a) => a.questionKey === "q1")?.value).toBe("b");
    expect(saved.find((a) => a.questionKey === "q2")?.value).toEqual(["a", "b"]);
  });

  it("keeps one student out of another's attempt, everywhere", async () => {
    const s2 = await ctx("s2");
    await rejects(
      saveAnswer(s2, { attemptId: attemptS1, questionKey: "q1", value: "a", seq: 99 }),
      "not_found"
    );
    await rejects(getAttemptPaper(s2, attemptS1), "not_found");
    await rejects(getAttemptReview(s2, attemptS1), "not_found");
    expect(
      await asTenant("s2", (tx) =>
        tx.attemptAnswer.count({ where: { attemptId: attemptS1 } })
      )
    ).toBe(0);
    await rejects(
      getAttemptReview(await ctx("facultyB", instB.slug), attemptS1),
      "not_found"
    );
    await rejects(getAttemptReview(await ctx("faculty2A"), attemptS1), "not_found");
  });

  it("finalises once under double submit and stops further saves", async () => {
    const s1 = await ctx("s1");
    await Promise.all([submitAttempt(s1, attemptS1), submitAttempt(s1, attemptS1)]);
    const attempt = await prisma.assessmentAttempt.findUniqueOrThrow({
      where: { id: attemptS1 },
    });
    expect(attempt.status).toBe("SUBMITTED");
    expect(attempt.finish).toBe("SUBMITTED");
    expect(attempt.late).toBe(false);
    // q1 right (b = "4"), q2 right (a,b), q3 coding waits for grading.
    expect(attempt.score).toBe(5);
    expect(attempt.maxScore).toBe(10);
    expect(attempt.needsGrading).toBe(true);

    expect(
      await saveAnswer(s1, {
        attemptId: attemptS1,
        questionKey: "q1",
        value: "b",
        seq: 50,
      })
    ).toEqual({ status: "closed" });
    await rejects(startAttempt(s1, examId), "conflict");
  });

  it("hides scores and answers from the student until release", async () => {
    const s1 = await ctx("s1");
    const view = await getStudentAssessment(s1, examId);
    expect(view.attempts[0]!.score).toBeNull();
    const review = await getAttemptReview(s1, attemptS1);
    expect(review.showKey).toBe(false);
    expect(review.score).toBeNull();
    expect(
      review.questions.every((q) => q.answer === null && q.explanation === null)
    ).toBe(true);
  });

  it("closes a timed-out attempt with what was saved, even if the student vanished", async () => {
    const s2 = await ctx("s2");
    const attemptS2 = await startAttempt(s2, examId);
    await saveAnswer(s2, {
      attemptId: attemptS2,
      questionKey: "q1",
      value: "b",
      seq: 1,
    });
    // The time limit passes while the student is disconnected.
    await prisma.assessmentAttempt.update({
      where: { id: attemptS2 },
      data: { deadlineAt: minutes(-1) },
    });
    expect(
      await saveAnswer(s2, {
        attemptId: attemptS2,
        questionKey: "q1",
        value: "a",
        seq: 2,
      })
    ).toEqual({ status: "closed" });
    // The database refuses the write by its own clock too.
    await expect(
      asTenant("s2", (tx) =>
        tx.attemptAnswer.update({
          where: { attemptId_questionKey: { attemptId: attemptS2, questionKey: "q1" } },
          data: { value: "a", seq: 3 },
        })
      )
    ).rejects.toThrow();

    const rows = await listSubmissions(await ctx("facultyA"), examId);
    expect(rows.find((r) => r.attemptId === attemptS2)?.status).toBe("SUBMITTED");
    const after = await prisma.assessmentAttempt.findUniqueOrThrow({
      where: { id: attemptS2 },
    });
    expect(after.finish).toBe("TIME_EXPIRED");
    expect(after.score).toBe(2);
  });

  it("does not let a student change their own score", async () => {
    await expect(
      asTenant("s1", (tx) =>
        tx.assessmentAttempt.update({ where: { id: attemptS1 }, data: { score: 10 } })
      )
    ).rejects.toThrow(/not allowed/);
  });

  it("queues an exam for marking only for those who teach it", async () => {
    const queued = async (key: string, slug?: string) =>
      (await getTeachingQueue(await ctx(key, slug))).find((e) => e.id === examId);

    expect((await queued("facultyA"))?.toGrade).toBeGreaterThan(0);
    expect((await queued("adminA"))?.toGrade).toBeGreaterThan(0);
    expect(await queued("faculty2A")).toBeUndefined();
    expect(await queued("facultyB", instB.slug)).toBeUndefined();
    await rejects(getTeachingQueue(await ctx("s1")), "forbidden");
  });

  it("grades by instructors only, with an audit trail", async () => {
    await rejects(
      gradeAnswer(await ctx("s1"), attemptS1, "q3", { points: 5, feedback: null }),
      "forbidden"
    );
    await rejects(
      gradeAnswer(await ctx("faculty2A"), attemptS1, "q3", {
        points: 5,
        feedback: null,
      }),
      "not_found"
    );
    await rejects(
      gradeAnswer(await ctx("facultyA"), attemptS1, "q3", {
        points: 6,
        feedback: null,
      }),
      "invalid"
    );
    await gradeAnswer(await ctx("facultyA"), attemptS1, "q3", {
      points: 4,
      feedback: "Good.",
    });
    await gradeAnswer(await ctx("facultyA"), attemptS1, "q1", {
      points: 1,
      feedback: "Partly.",
    });

    const attempt = await prisma.assessmentAttempt.findUniqueOrThrow({
      where: { id: attemptS1 },
    });
    expect(attempt.score).toBe(8);
    expect(attempt.needsGrading).toBe(false);

    const log = await prisma.institutionAuditLog.findMany({
      where: { institutionId: instA.id, action: "grade.change", targetId: attemptS1 },
      orderBy: { createdAt: "asc" },
    });
    expect(log).toHaveLength(2);
    expect(log[0]!.metadata).toMatchObject({
      questionKey: "q3",
      newPoints: 4,
      oldScore: 5,
      newScore: 9,
    });
    // Staff can override an automatic mark too; the old value is recorded.
    expect(log[1]!.metadata).toMatchObject({
      questionKey: "q1",
      oldPoints: 2,
      newPoints: 1,
    });
  });

  it("releases results only after closing, then shows the student the key", async () => {
    const f = await ctx("facultyA");
    await rejects(releaseResults(f, examId), "conflict");
    await rejects(unpublishAssessment(f, examId), "conflict");
    await closeAssessment(f, examId);
    await releaseResults(f, examId);

    const review = await getAttemptReview(await ctx("s1"), attemptS1);
    expect(review.showKey).toBe(true);
    expect(review.score).toBe(8);
    expect(review.questions.find((q) => q.key === "q1")).toMatchObject({
      answer: "b",
      explanation: "Arithmetic.",
      awarded: 1,
      feedback: "Partly.",
    });
    expect((await getStudentAssessment(await ctx("s1"), examId)).finalScore).toBe(8);

    const actions = (
      await prisma.institutionAuditLog.findMany({
        where: { institutionId: instA.id, targetId: examId },
        select: { action: true },
      })
    ).map((r) => r.action);
    expect(actions).toEqual(
      expect.arrayContaining([
        "assessment.create",
        "assessment.publish",
        "assessment.close",
        "assessment.release_results",
      ])
    );
  });
});

describe("late window and attempt limits", () => {
  it("accepts late work inside the grace window and applies the penalty", async () => {
    const f = await ctx("facultyA");
    const { id } = await createAssessment(f, classId, {
      title: "Homework",
      instructions: "",
      opensAt: null,
      closesAt: minutes(60),
      lateUntil: minutes(120),
      latePenaltyPercent: 50,
      durationMinutes: null,
      maxAttempts: 2,
      scorePolicy: "LATEST",
      showScoreOnSubmit: true,
    });
    const bank = await getBank(f, bankId);
    const mcq = bank.questions.find((q) => q.type === "MULTIPLE_CHOICE")!;
    await addItem(f, id, { questionId: mcq.id, points: 4 });
    await publishAssessment(f, id);

    // Moving the deadline after publishing is allowed, audited, and reaches
    // attempts already in progress.
    const s1 = await ctx("s1");
    const first = await startAttempt(s1, id);
    const staff = await getStaffAssessment(f, id);
    await updateAssessment(f, id, {
      ...staff.settings,
      closesAt: minutes(-5),
      lateUntil: minutes(90),
    });
    const moved = await prisma.assessmentAttempt.findUniqueOrThrow({
      where: { id: first },
    });
    expect(moved.deadlineAt.getTime()).toBeGreaterThan(minutes(89).getTime());
    expect(
      await prisma.institutionAuditLog.count({
        where: { targetId: id, action: "assessment.deadline_change" },
      })
    ).toBe(1);

    await saveAnswer(s1, { attemptId: first, questionKey: "q1", value: "b", seq: 1 });
    await submitAttempt(s1, first);
    const graded = await prisma.assessmentAttempt.findUniqueOrThrow({
      where: { id: first },
    });
    expect(graded.late).toBe(true);
    expect(graded.score).toBe(2);
    expect((await getStudentAssessment(s1, id)).attempts[0]!.score).toBe(2);

    const second = await startAttempt(s1, id);
    expect(second).not.toBe(first);
    await submitAttempt(s1, second);
    await rejects(startAttempt(s1, id), "conflict");
    expect(
      await prisma.assessmentAttempt.count({
        where: { assessmentId: id, userId: users.s1!.id },
      })
    ).toBe(2);
    // LATEST counts the second, empty attempt.
    expect((await getStudentAssessment(s1, id)).finalScore).toBe(0);
  });
});
