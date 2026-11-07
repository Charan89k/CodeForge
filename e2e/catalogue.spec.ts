import { expect, test, type Page } from "@playwright/test";

import { signUp } from "./helpers";

/**
 * The /learn library: filters, search, sorting and paging, all held in the URL.
 * Anonymous browsing is allowed, so most of this runs signed out.
 */
const unique = () => `${Date.now()}-${Math.floor(Math.random() * 1e5)}`;

const filter = (page: Page, name: string) =>
  page.getByRole("complementary", { name: "Filters" }).getByRole("link", { name });

/** On a phone the filters fold away; opening them is part of using them. */
async function openFilters(page: Page) {
  const toggle = page.getByRole("button", { name: /^Filters/ });
  if (
    (await toggle.isVisible()) &&
    (await toggle.getAttribute("aria-expanded")) === "false"
  ) {
    await toggle.click();
  }
}

async function choose(page: Page, name: string) {
  await openFilters(page);
  await filter(page, name).click();
}

test("filters combine, are removable one at a time, and clear together", async ({
  page,
}) => {
  await page.goto("/learn");
  await expect(page.getByRole("heading", { name: "Courses", level: 1 })).toBeVisible();
  const results = page.getByRole("region", { name: "Matching courses" });
  await expect(results.getByRole("heading", { name: "DSA Foundations" })).toBeVisible();

  await choose(page, "Data Structures & Algorithms");
  await expect(page).toHaveURL(/subject=Data\+Structures\+%26\+Algorithms/);
  await expect(results.getByRole("heading", { level: 3 })).toHaveCount(1);
  await expect(results.getByRole("heading", { name: "DSA Foundations" })).toBeVisible();

  await choose(page, "Medium");
  await expect(page).toHaveURL(/difficulty=MEDIUM/);
  await expect(page).toHaveURL(/subject=/);
  await expect(page.getByRole("link", { name: "Remove filter Medium" })).toBeVisible();

  // A reload restores the same state from the URL.
  await page.reload();
  await expect(page.getByRole("link", { name: "Remove filter Medium" })).toBeVisible();
  await expect(results.getByRole("heading", { name: "DSA Foundations" })).toBeVisible();

  await page.getByRole("link", { name: "Remove filter Medium" }).click();
  await expect(page).not.toHaveURL(/difficulty=/);
  await expect(page).toHaveURL(/subject=/);

  await page.goBack();
  await expect(page).toHaveURL(/difficulty=MEDIUM/);

  await page.getByRole("link", { name: "Clear all" }).click();
  await expect(page).toHaveURL(/\/learn$/);
  await expect(page.getByRole("link", { name: "Clear all" })).toHaveCount(0);
});

test("search works with filters, and a chapter opens from the results", async ({
  page,
}) => {
  await page.goto("/learn?subject=Data+Structures+%26+Algorithms");
  await page.getByLabel("Search courses and chapters").fill("binary");
  await page.getByRole("search").getByRole("button", { name: "Search" }).click();

  await expect(page).toHaveURL(/q=binary/);
  await expect(page).toHaveURL(/subject=/);
  await page.getByRole("link", { name: /^chapters/i }).click();
  await expect(page).toHaveURL(/view=chapters/);
  await expect(page).toHaveURL(/q=binary/);

  const results = page.getByRole("region", { name: "Matching chapters" });
  await expect(results.getByRole("listitem").first()).toBeVisible();
  await results.getByRole("listitem").first().getByRole("link").click();
  await expect(page).toHaveURL(/\/learn\/dsa\/.+\/.+\/.+/);
});

test("sorting and paging keep the filters", async ({ page }) => {
  await page.goto("/learn?view=chapters&difficulty=EASY");
  const results = page.getByRole("region", { name: "Matching chapters" });
  const firstTitle = results.getByRole("listitem").first().getByRole("heading");
  const before = await firstTitle.textContent();
  const sortBy = page.getByRole("navigation", { name: "Sort by" });

  await sortBy.getByRole("link", { name: "A to Z" }).click();
  await expect(page).toHaveURL(/sort=title/);
  await expect(page).toHaveURL(/difficulty=EASY/);
  await expect(firstTitle).not.toHaveText(before!);

  await page
    .getByRole("navigation", { name: "Pagination" })
    .getByRole("link", { name: /next/i })
    .click();
  await expect(page).toHaveURL(/page=2/);
  await expect(page).toHaveURL(/sort=title/);
  await expect(page).toHaveURL(/difficulty=EASY/);
  await expect(results.getByRole("listitem").first()).toBeVisible();

  // Changing anything returns to the first page.
  await sortBy.getByRole("link", { name: "Shortest" }).click();
  await expect(page).not.toHaveURL(/page=/);
});

test("an empty result explains itself and offers a way out", async ({ page }) => {
  await page.goto("/learn?q=zzzz-no-such-chapter");
  await expect(page.getByText("No courses match")).toBeVisible();
  await page.getByRole("link", { name: "Clear filters" }).click();
  await expect(page).toHaveURL(/\/learn$/);
  await expect(
    page.getByRole("region", { name: "Matching courses" }).getByRole("listitem").first()
  ).toBeVisible();
});

test("a manipulated URL shows a normal page", async ({ page }) => {
  const response = await page.goto(
    "/learn?level=NOPE&view=secret&sort=';DROP&page=-4&status=COMPLETED&difficulty[]=x"
  );
  expect(response?.status()).toBe(200);
  await expect(
    page.getByRole("region", { name: "Matching courses" }).getByRole("listitem").first()
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Clear all" })).toHaveCount(0);
});

test("progress is offered only to someone signed in", async ({ page }) => {
  await page.goto("/learn");
  await openFilters(page);
  await expect(filter(page, "Completed")).toHaveCount(0);
  await expect(filter(page, "Sign in")).toBeVisible();

  await signUp(page, `e2e-library-${unique()}@techepitome.test`);
  await page.goto("/learn?status=COMPLETED");
  await expect(page.getByText("No courses match")).toBeVisible();
  await page.goto("/learn?status=NOT_STARTED");
  await expect(
    page.getByRole("region", { name: "Matching courses" }).getByRole("listitem").first()
  ).toBeVisible();
});

test("the page fits a phone, with filters folded away", async ({ page, isMobile }) => {
  test.skip(!isMobile, "Layout check for the phone project.");
  await page.goto("/learn?level=BEGINNER");
  await expect(filter(page, "Beginner")).toBeHidden();
  await openFilters(page);
  await expect(filter(page, "Beginner")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    )
  ).toBeLessThanOrEqual(0);
});
