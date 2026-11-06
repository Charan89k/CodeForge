import { expect, test } from "@playwright/test";

import { closeDb, execSql, userIdFor } from "./db";
import { signUp } from "./helpers";

/**
 * A contest through the running app. Contests are inserted directly so that one
 * can already be live; entering, submitting and the standings use the real pages.
 */
const unique = () => `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

test.afterAll(async () => {
  await closeDb();
});

async function createContest(
  slug: string,
  ownerEmail: string,
  startMinutes: number,
  endMinutes: number
) {
  const [problem] = await execSql<{ id: string }>(
    `SELECT id FROM problems WHERE slug = 'running-altitude'`
  );
  await execSql(
    `INSERT INTO contests (id, slug, title, description, "startsAt", "endsAt", "createdById", "updatedAt")
     VALUES ($1, $1, $2, 'A test contest.',
             now() + make_interval(mins => $3), now() + make_interval(mins => $4), $5, now())`,
    [slug, `Contest ${slug}`, startMinutes, endMinutes, await userIdFor(ownerEmail)]
  );
  await execSql(
    `INSERT INTO contest_problems ("contestId", "problemId", "order", points)
     VALUES ($1, $2, 1, 100)`,
    [slug, problem!.id]
  );
}

test("a learner enters a live contest, solves a problem, and sees their rank", async ({
  page,
}, testInfo) => {
  test.slow();
  test.skip(testInfo.project.name === "mobile", "The desktop editor layout");
  const slug = `e2e-live-${unique()}`;
  const email = `contest-${unique()}@techepitome.test`;
  await signUp(page, email);
  await createContest(slug, email, -5, 60);

  await page.goto(`/contests/${slug}`);
  await expect(page.getByText("Live now")).toBeVisible();
  await page.getByRole("button", { name: "Enter this contest" }).click();
  await expect(page.getByText("You are entered.")).toBeVisible({ timeout: 30_000 });

  await page.getByRole("link", { name: "Running Altitude" }).click();
  await expect(page.locator(".monaco-editor").first()).toBeVisible({ timeout: 60_000 });
  await page.locator(".monaco-editor .view-lines").first().click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.insertText(
    "def highestAltitude(changes): return max([0] + [sum(changes[:i + 1]) for i in range(len(changes))])"
  );
  await page.getByRole("button", { name: "Submit" }).click();
  await expect(page.getByText("8/8 tests")).toBeVisible({ timeout: 180_000 });

  await page.goto(`/contests/${slug}`);
  const standings = page.getByRole("table", { name: "Contest standings" });
  await expect(standings.getByRole("cell", { name: "100", exact: true })).toBeVisible();

  await page.goto("/contests");
  const mine = page.getByRole("region", { name: "Your contests" });
  await expect(mine.getByText(/Rank 1 of 1 · 1 solved · 100 pts/)).toBeVisible();
});

test("an upcoming contest hides its problems and shows in Your contests", async ({
  page,
}) => {
  const slug = `e2e-soon-${unique()}`;
  const email = `contest-${unique()}@techepitome.test`;
  await signUp(page, email);
  await createContest(slug, email, 60, 120);

  await page.goto(`/contests/${slug}`);
  await expect(page.getByText("Problems appear when it starts.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Running Altitude" })).toHaveCount(0);
  await page.getByRole("button", { name: "Enter this contest" }).click();
  await expect(page.getByText("You are entered.")).toBeVisible({ timeout: 30_000 });

  await page.goto("/contests");
  await expect(
    page.getByRole("region", { name: "Your contests" }).getByText(/^Starts /)
  ).toBeVisible();
});

test("a signed-out visitor is asked to sign in before entering", async ({
  browser,
  page,
}) => {
  const slug = `e2e-out-${unique()}`;
  const email = `contest-${unique()}@techepitome.test`;
  await signUp(page, email);
  await createContest(slug, email, 60, 120);

  const visitor = await (await browser.newContext()).newPage();
  await visitor.goto(`/contests/${slug}`);
  await expect(visitor.getByRole("link", { name: "Sign in to enter" })).toBeVisible();
  await expect(visitor.getByRole("button", { name: "Enter this contest" })).toHaveCount(
    0
  );
});

test("an admin can cancel a contest only before it starts", async ({ page }) => {
  const email = `contest-admin-${unique()}@techepitome.test`;
  await signUp(page, email);
  await execSql(`UPDATE users SET role = 'ADMIN' WHERE email = $1`, [email]);
  const soon = `e2e-cancel-${unique()}`;
  const live = `e2e-running-${unique()}`;
  await createContest(soon, email, 60, 120);
  await createContest(live, email, -5, 60);

  await page.goto("/admin/contests");
  await expect(
    page.getByRole("button", { name: `Cancel Contest ${live}` })
  ).toHaveCount(0);
  await page.getByRole("button", { name: `Cancel Contest ${soon}` }).click();
  await expect(page.getByText("Contest cancelled.")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("link", { name: `Contest ${soon}` })).toHaveCount(0);
});
