import { execFileSync } from "node:child_process";

import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));

import { getVisualization } from "@/components/visualization/registry";
import { markdownToBlocks } from "@/lib/cms/markdown";
import { prisma } from "@/lib/db";
import { contentDocumentSchema } from "@/lib/validation/content";
import { PROBLEMS } from "@/data/problems";
import { chapterQuizSchema } from "@/services/cms";

import {
  AUTHORED_COURSES,
  courseHours,
  lessonMarkdown,
  lessonMinutes,
  quizSlug,
  type CourseSource,
} from "./index";

/**
 * A course is only worth publishing if what it says is true, so everything
 * checkable is checked: the source compiles in the CMS dialect, its references
 * exist, and every example produces the output the lesson claims.
 */
const lessons = (course: CourseSource) => course.sections.flatMap((s) => s.lessons);
const allLessons = AUTHORED_COURSES.flatMap((course) =>
  lessons(course).map((lesson) => ({ course, lesson }))
);

describe.each(AUTHORED_COURSES.map((c) => [c.slug, c] as const))(
  "%s",
  (_slug, course) => {
    it("has a complete description", () => {
      expect(course.outcomes.length).toBeGreaterThanOrEqual(3);
      expect(course.prerequisites.length).toBeGreaterThan(0);
      expect(courseHours(course)).toBeGreaterThan(0);
      const slugs = lessons(course).map((l) => l.slug);
      expect(new Set(slugs).size).toBe(slugs.length);
    });
  }
);

describe.each(
  allLessons.map(
    ({ course, lesson }) => [`${course.slug}/${lesson.slug}`, course, lesson] as const
  )
)("%s", (_name, course, lesson) => {
  const markdown = lessonMarkdown(course, lesson);
  const blocks = markdownToBlocks(markdown);

  it("compiles to valid content, with substance and a summary", () => {
    expect(contentDocumentSchema.safeParse(blocks).error?.issues).toBeUndefined();
    expect(markdown.split(/\s+/).length).toBeGreaterThan(250);
    expect(blocks.some((b) => b.type === "heading" && b.text === "Summary")).toBe(true);
    expect(lessonMinutes(markdown)).toBeGreaterThan(5);
  });

  it("embeds its own knowledge check, and it is well formed", () => {
    expect(blocks.filter((b) => b.type === "quiz")).toEqual([
      { type: "quiz", quizSlug: quizSlug(course, lesson) },
    ]);
    const parsed = chapterQuizSchema.safeParse({
      slug: quizSlug(course, lesson),
      title: lesson.title,
      questions: lesson.questions,
    });
    expect(parsed.error?.issues).toBeUndefined();
  });

  it("embeds only visualizations that exist", () => {
    for (const block of blocks) {
      if (block.type === "visualization") {
        const key = block.visualizationKey;
        expect(getVisualization(key), key).not.toBeNull();
      }
    }
  });

  it("links only to problems that exist", () => {
    const known = new Set(PROBLEMS.map((p) => p.slug));
    for (const block of blocks) {
      if (block.type === "problems") {
        for (const slug of block.slugs) expect(known.has(slug), slug).toBe(true);
      }
    }
  });
});

it("does not give answers away by always putting them in one place", () => {
  const answers = allLessons.flatMap(({ lesson }) =>
    lesson.questions.map((question) => question.answer)
  );
  const mostCommon = Math.max(
    ...["a", "b", "c", "d"].map((id) => answers.filter((a) => a === id).length)
  );
  expect(mostCommon / answers.length).toBeLessThan(0.5);
});

describe("the examples are true", () => {
  const PY_WITH_OUTPUT = /```python\n([\s\S]*?)\n```(?:\n\n```text\n([\s\S]*?)\n```)?/g;

  it.each(
    allLessons.map(({ course, lesson }) => [lesson.slug, course, lesson] as const)
  )("%s: Python prints what the lesson says", (_name, course, lesson) => {
    for (const [, code, expected] of lessonMarkdown(course, lesson).matchAll(
      PY_WITH_OUTPUT
    )) {
      const stdout = execFileSync("python3", ["-I", "-c", code!], {
        encoding: "utf8",
        timeout: 20_000,
      });
      expect(expected, `no output shown for:\n${code}`).toBeDefined();
      expect(stdout.trim(), code).toBe(expected!.trim());
    }
  });

  /** A ```sql fence, and the results table that follows it if there is one. */
  const SQL_WITH_RESULT = /```sql\n([\s\S]*?)\n```(?:\n\n((?:\|.*\n)+))?/g;
  const cells = (row: string) =>
    row
      .trim()
      .replace(/^\||\|$/g, "")
      .split("|")
      .map((c) => c.trim());
  const shown = (value: unknown) => (value === null ? "NULL" : String(value));
  // The whole check is one transaction, so a lesson's own run as savepoints.
  const NESTED: Record<string, string> = {
    BEGIN: "SAVEPOINT lesson",
    COMMIT: "RELEASE SAVEPOINT lesson",
    ROLLBACK: "ROLLBACK TO SAVEPOINT lesson",
  };

  it("Database Foundations: every query runs in order and returns what it shows", async () => {
    const course = AUTHORED_COURSES.find((c) => c.slug === "database-foundations")!;
    const schema = `course_check_${Date.now()}`;
    const ROLLED_BACK = "course check finished";

    await expect(
      prisma.$transaction(
        async (tx) => {
          await tx.$executeRawUnsafe(`CREATE SCHEMA ${schema}`);
          await tx.$executeRawUnsafe(`SET LOCAL search_path TO ${schema}`);

          for (const lesson of lessons(course)) {
            const markdown = lessonMarkdown(course, lesson);
            for (const [, sql, table] of markdown.matchAll(SQL_WITH_RESULT)) {
              let rows: Record<string, unknown>[] = [];
              for (const raw of sql!.split(";")) {
                const statement = raw.trim();
                if (statement) {
                  rows = await tx.$queryRawUnsafe(NESTED[statement] ?? statement);
                }
              }
              if (!table) continue;
              const [header, , ...body] = table.trim().split("\n");
              const columns = cells(header!);
              expect(
                rows.map((row) => columns.map((column) => shown(row[column]))),
                `${lesson.slug}:\n${sql}`
              ).toEqual(body.map(cells));
            }
          }
          throw new Error(ROLLED_BACK);
        },
        { timeout: 60_000 }
      )
    ).rejects.toThrow(ROLLED_BACK);
  });
});
