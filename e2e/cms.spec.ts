import { expect, test } from "@playwright/test";

import { closeDb, execSql, joinTestCollege, makeAdmin, userIdFor } from "./db";
import { signUp } from "./helpers";

/**
 * The whole authoring path: an admin writes a course, sends it through review
 * and publishes it, and a learner reads it. Nothing is seeded behind the UI
 * except the admin role itself.
 */
const unique = () => `${Date.now()}-${Math.floor(Math.random() * 1e5)}`;

test.afterAll(async () => {
  await closeDb();
});

test("a learner cannot reach the course editor", async ({ page }) => {
  await signUp(page, `e2e-cms-learner-${unique()}@techepitome.test`);
  await page.goto("/admin/courses");
  await expect(page.getByText("You do not have access to this")).toBeVisible();
  await expect(page.getByRole("button", { name: "Create course" })).toHaveCount(0);
});

test("no college role reaches the course editor", async ({ page }) => {
  const email = `e2e-cms-college-${unique()}@techepitome.test`;
  await signUp(page, email);
  await joinTestCollege(email);
  const userId = await userIdFor(email);
  // Student first, as joined; the rest are the same account promoted in place.
  for (const role of ["STUDENT", "FACULTY", "PLACEMENT_OFFICER", "INSTITUTION_ADMIN"]) {
    await execSql(`UPDATE institution_memberships SET role = $1 WHERE "userId" = $2`, [
      role,
      userId,
    ]);
    await page.goto("/admin/courses");
    await expect(page.getByText("You do not have access to this"), role).toBeVisible();
    await expect(page.getByRole("button", { name: "Create course" }), role).toHaveCount(
      0
    );
  }
});

test("an admin authors a course and a learner reads it only once published", async ({
  page,
  browser,
  isMobile,
}) => {
  test.skip(isMobile, "One full authoring run is enough; it is not layout-dependent.");
  test.setTimeout(240_000);
  const id = unique();
  const slug = `e2e-course-${id}`;
  const email = `e2e-cms-admin-${id}@techepitome.test`;
  await signUp(page, email);
  await makeAdmin(email);

  await page.goto("/admin/courses");
  await page.getByLabel("Title", { exact: true }).fill(`E2E Course ${id}`);
  await page.getByLabel("Slug").fill(slug);
  await page.getByLabel("Description").fill("A course written by the end-to-end test.");
  await page.getByLabel("Category").fill("Programming");
  await page.getByLabel("Learning outcomes, one per line").fill("Read a lesson");
  await page.getByRole("button", { name: "Create course" }).click();
  await page.waitForURL(/\/admin\/courses\/[a-z0-9]+$/, { timeout: 30_000 });
  const courseUrl = page.url();

  // Publishing an empty course is refused, with the reason.
  await page.getByRole("button", { name: "Publish course" }).click();
  await expect(page.getByText("Publish at least one chapter first.")).toBeVisible({
    timeout: 30_000,
  });

  await page.getByLabel("Section title").fill("Start here");
  await page.getByLabel("Section slug").fill("start");
  await page.getByRole("button", { name: "Add section" }).click();
  await expect(page.getByRole("heading", { name: "Start here" })).toBeVisible({
    timeout: 30_000,
  });

  await page.getByLabel("Chapter title").fill("First steps");
  await page.getByLabel("Chapter slug").fill("first-steps");
  await page.getByRole("button", { name: "Add chapter" }).click();
  await page.waitForURL(/\/chapters\/[a-z0-9]+$/, { timeout: 30_000 });
  const chapterUrl = page.url();

  // A mistake in the source is explained and saves nothing.
  await page.getByLabel("Lesson", { exact: true }).fill("# Too big a heading");
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page.getByText(/Line 1: Use ## or ###/)).toBeVisible({
    timeout: 30_000,
  });

  await page
    .getByLabel("Lesson", { exact: true })
    .fill("## Hello\n\nA **first** lesson.\n\n```python\nprint(1)\n```");
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page.getByText("Draft saved.")).toBeVisible({ timeout: 30_000 });
  await page.reload();

  await page.getByRole("link", { name: "Preview" }).click();
  await expect(page.getByRole("heading", { name: "Hello" })).toBeVisible({
    timeout: 30_000,
  });
  await page.goto(chapterUrl);

  await page.getByRole("button", { name: "Submit for review" }).click();
  // The author cannot approve their own words.
  await expect(page.getByText("Waiting for a different admin")).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByRole("button", { name: "Publish", exact: true })).toHaveCount(
    0
  );

  const reviewerContext = await browser.newContext();
  const reviewerPage = await reviewerContext.newPage();
  const reviewerEmail = `e2e-cms-reviewer-${id}@techepitome.test`;
  await signUp(reviewerPage, reviewerEmail);
  await makeAdmin(reviewerEmail);
  await reviewerPage.goto(chapterUrl);
  const publish = reviewerPage.getByRole("button", { name: "Publish", exact: true });
  await expect(publish).toBeVisible({ timeout: 30_000 });
  await publish.click();
  await expect(
    reviewerPage.getByRole("button", { name: "Start a draft from this" })
  ).toBeVisible({
    timeout: 30_000,
  });
  await reviewerContext.close();

  // The course is still a draft, so a visitor gets nothing.
  const visitor = await browser.newPage();
  const lessonPath = `/learn/courses/${slug}/start/first-steps`;
  await visitor.goto(lessonPath);
  await expect(visitor.getByRole("heading", { name: "Hello" })).toHaveCount(0);

  await page.goto(courseUrl);
  await page.getByRole("button", { name: "Publish course" }).click();
  await expect(page.getByRole("link", { name: "View live" })).toBeVisible({
    timeout: 30_000,
  });

  await visitor.goto(lessonPath);
  await expect(visitor.getByRole("heading", { name: "Hello" })).toBeVisible({
    timeout: 30_000,
  });
  await expect(visitor.getByText("print(1)")).toBeVisible();

  await visitor.goto(`/learn/courses/${slug}`);
  await expect(
    visitor.getByRole("heading", { name: `E2E Course ${id}` })
  ).toBeVisible();
  await visitor.close();

  // The audit log records it.
  await page.goto("/admin/audit");
  await expect(page.getByText("revision.published").first()).toBeVisible({
    timeout: 30_000,
  });
});
