import { execFileSync } from "node:child_process";

import { expect, test } from "@playwright/test";

import { DATABASE_FOUNDATIONS } from "../src/data/courses/database-foundations";
import { closeDb, makeAdmin } from "./db";
import { signUp } from "./helpers";

/**
 * The first original courses, from authoring to a learner's saved progress.
 * The courses go through the CMS by the same script an operator runs, as a
 * platform admin, and then a learner finds and works through one.
 */
const unique = () => `${Date.now()}-${Math.floor(Math.random() * 1e5)}`;

test.afterAll(async () => {
  await closeDb();
});

const author = (email: string, ...flags: string[]) =>
  execFileSync(
    "npx",
    [
      "tsx",
      "--conditions=react-server",
      "scripts/author-courses.ts",
      "--admin",
      email,
      ...flags,
    ],
    { encoding: "utf8", stdio: "pipe" }
  );

test("a learner finds an authored course, works a lesson and keeps their progress", async ({
  browser,
  page,
  isMobile,
}) => {
  test.skip(
    isMobile,
    "One full journey is enough; the library's phone layout has its own test."
  );
  test.setTimeout(240_000);

  // Someone who is not a platform admin cannot author anything.
  const learnerEmail = `e2e-course-learner-${unique()}@techepitome.test`;
  await signUp(page, learnerEmail);
  expect(() => author(learnerEmail)).toThrow(/platform admin/);

  const adminContext = await browser.newContext();
  const adminEmail = `e2e-course-admin-${unique()}@techepitome.test`;
  await signUp(await adminContext.newPage(), adminEmail);
  await makeAdmin(adminEmail);
  const reviewerEmail = `e2e-course-reviewer-${unique()}@techepitome.test`;
  const reviewerContext = await browser.newContext();
  await signUp(await reviewerContext.newPage(), reviewerEmail);
  await makeAdmin(reviewerEmail);
  await adminContext.close();
  await reviewerContext.close();

  // Publishing takes a second person.
  expect(() => author(adminEmail, "--publish")).toThrow(/--reviewer/);
  expect(() => author(adminEmail, "--publish", "--reviewer", adminEmail)).toThrow(
    /different/
  );
  author(adminEmail, "--publish", "--reviewer", reviewerEmail);

  // Running it again changes nothing that is already published.
  expect(author(adminEmail, "--publish", "--reviewer", reviewerEmail)).toContain(
    '"unchanged":9'
  );

  // Search, then two filters.
  await page.goto("/learn");
  await page.getByLabel("Search courses and chapters").fill("SQL");
  await page.getByRole("search").getByRole("button", { name: "Search" }).click();
  await expect(page).toHaveURL(/q=SQL/);
  const filters = page.getByRole("complementary", { name: "Filters" });
  await filters.getByRole("link", { name: "Databases" }).click();
  await expect(page).toHaveURL(/subject=Databases/);
  await filters.getByRole("link", { name: "Beginner" }).click();
  await expect(page).toHaveURL(/level=BEGINNER/);

  const results = page.getByRole("region", { name: "Matching courses" });
  await results.getByRole("link", { name: "Database Foundations" }).click();
  await expect(page).toHaveURL(/\/learn\/courses\/database-foundations$/);
  await expect(
    page.getByRole("heading", { name: "Database Foundations", level: 1 })
  ).toBeVisible();
  // Written for Tech Epitome, so it carries no licence line.
  await expect(page.getByText("Used under")).toHaveCount(0);

  // Open the first lesson, and answer its knowledge check.
  const lesson = DATABASE_FOUNDATIONS.sections[0]!.lessons[0]!;
  await page.getByRole("link", { name: lesson.title }).first().click();
  await expect(
    page.getByRole("heading", { name: lesson.title, level: 1 })
  ).toBeVisible();
  const lessonUrl = page.url();

  for (const question of lesson.questions) {
    const right = question.options.find((o) => o.id === question.answer)!;
    await page.getByRole("radio", { name: right.text, exact: true }).first().check();
  }
  await page.getByRole("button", { name: "Check answers" }).click();
  await expect(page.getByText(/^Passed\./)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(lesson.questions[0]!.explanation)).toBeVisible();

  await page.getByRole("button", { name: "Mark chapter complete" }).click();
  await expect(page.getByRole("button", { name: "Mark as not complete" })).toBeVisible({
    timeout: 30_000,
  });

  // On to the next lesson, in reading order.
  const nextLesson = DATABASE_FOUNDATIONS.sections[0]!.lessons[1]!;
  await page.getByRole("link", { name: `Continue: ${nextLesson.title}` }).click();
  await expect(
    page.getByRole("heading", { name: nextLesson.title, level: 1 })
  ).toBeVisible();

  // The library now reports it, and the state survives a reload.
  await page.goto("/learn?status=IN_PROGRESS&subject=Databases");
  const row = page.getByRole("region", { name: "Matching courses" });
  await expect(row.getByRole("link", { name: "Database Foundations" })).toBeVisible();
  await expect(row.getByText("In progress")).toBeVisible();
  await expect(row.getByText("1 of 9")).toBeVisible();
  await page.reload();
  await expect(row.getByText("1 of 9")).toBeVisible();

  await page.goto(lessonUrl);
  await expect(
    page.getByRole("button", { name: "Mark as not complete" })
  ).toBeVisible();

  await page.goto("/learn?status=COMPLETED&subject=Databases");
  await expect(page.getByText("No courses match")).toBeVisible();
});
