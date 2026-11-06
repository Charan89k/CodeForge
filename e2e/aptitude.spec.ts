import { expect, test } from "@playwright/test";

import { closeDb, execSql } from "./db";
import { signUp } from "./helpers";

const unique = () => `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

test.afterAll(async () => {
  await closeDb();
});

async function makeAdmin(email: string) {
  await execSql(`UPDATE users SET role = 'ADMIN' WHERE email = $1`, [email]);
}

test("anyone can practise and see explanations, without a record being kept", async ({
  page,
}) => {
  await page.goto("/aptitude?topic=programming&difficulty=EASY");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Aptitude practice");
  await page.getByRole("radio", { name: "11", exact: true }).check();
  await page.getByRole("button", { name: "Check my answers" }).click();
  await expect(page.getByText(/You got 1 of 3/)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("5 × 2 = 10, then 10 + 1 = 11.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Your performance" })).toHaveCount(0);
});

test("answers are not in the page before the set is checked", async ({ page }) => {
  const response = await page.goto("/aptitude?topic=programming&difficulty=EASY");
  expect(await response!.text()).not.toContain("5 × 2 = 10, then 10 + 1 = 11.");
});

test("a signed-in learner's timed set shows up in their performance", async ({
  page,
}) => {
  await signUp(page, `apt-${unique()}@techepitome.test`);
  await page.goto("/aptitude?topic=data-interpretation&difficulty=HARD");
  await page.getByRole("button", { name: /Start timed/ }).click();
  await expect(page.getByRole("timer")).toBeVisible();
  await page.getByRole("button", { name: "Check my answers" }).click();
  await expect(page.getByText(/You got 0 of 2/)).toBeVisible({ timeout: 30_000 });

  await page.reload();
  await expect(page.getByRole("heading", { name: "Your performance" })).toBeVisible();
  await expect(page.getByText(/timed, \d+s/)).toBeVisible();
});

test("a timer that runs out checks the set by itself", async ({ page }) => {
  await page.goto("/aptitude?topic=programming&difficulty=HARD");
  await page.clock.install();
  await page.getByRole("button", { name: /Start timed/ }).click();
  await expect(page.getByRole("timer")).toBeVisible();
  // One second at a time: each tick is armed only after the last one renders.
  for (let elapsed = 0; elapsed < 70; elapsed++) {
    await page.clock.runFor(1_000);
  }
  await expect(page.getByText(/You got 0 of \d+/)).toBeVisible({ timeout: 30_000 });
});

test("a new question needs a second admin, and only then reaches learners", async ({
  browser,
}) => {
  test.slow();
  const prompt = `What is 2 plus 2, version ${unique()}?`;
  const author = await (await browser.newContext()).newPage();
  const authorEmail = `apt-author-${unique()}@techepitome.test`;
  await signUp(author, authorEmail);
  await makeAdmin(authorEmail);

  await author.goto("/admin/aptitude");
  await author.getByLabel("Topic", { exact: true }).selectOption("programming");
  await author.getByLabel("Difficulty", { exact: true }).selectOption("HARD");
  await author.getByLabel("Question", { exact: true }).fill(prompt);
  await author.getByLabel(/^Options/).fill("3\n*4\n5");
  await author
    .getByLabel("Explanation", { exact: true })
    .fill("Two and two make four.");
  await author.getByRole("button", { name: "Save draft" }).click();
  await expect(author.getByText("Draft saved.")).toBeVisible({ timeout: 30_000 });
  const item = author.getByRole("listitem").filter({ hasText: prompt });
  await expect(item.getByText("Waiting for a different admin")).toBeVisible();
  await expect(item.getByRole("button", { name: "Publish" })).toHaveCount(0);

  const learner = await (await browser.newContext()).newPage();
  await learner.goto("/aptitude?topic=programming&difficulty=HARD");
  await expect(learner.getByText(prompt)).toHaveCount(0);

  const reviewer = await (await browser.newContext()).newPage();
  const reviewerEmail = `apt-reviewer-${unique()}@techepitome.test`;
  await signUp(reviewer, reviewerEmail);
  await makeAdmin(reviewerEmail);
  await reviewer.goto("/admin/aptitude");
  await reviewer
    .getByRole("listitem")
    .filter({ hasText: prompt })
    .getByRole("button", { name: "Publish" })
    .click();
  await expect(reviewer.getByText("Published.", { exact: true })).toBeVisible({
    timeout: 30_000,
  });

  await learner.reload();
  await expect(learner.getByText(prompt)).toBeVisible();

  await execSql(`DELETE FROM aptitude_questions WHERE prompt = $1`, [prompt]);
});

test("the admin screen is closed to ordinary accounts", async ({ page }) => {
  await signUp(page, `apt-user-${unique()}@techepitome.test`);
  await page.goto("/admin/aptitude");
  await expect(page.getByRole("button", { name: "Save draft" })).toHaveCount(0);
});
