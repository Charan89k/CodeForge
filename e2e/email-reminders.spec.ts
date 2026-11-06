import { expect, test, type Page } from "@playwright/test";

import {
  closeDb,
  emailDeliveriesFor,
  enableEmailReminders,
  makeReviewsDue,
  reviewItemsFor,
} from "./db";
import { finishSignup } from "./helpers";

/**
 * The review reminder, through the real cron endpoint.
 *
 * The service tests already walk the pipeline a learner at a time. What
 * this adds is the HTTP boundary: the authentication on the one route
 * that enumerates users and sends mail, and the fact that hitting it
 * twice does not mail anybody twice.
 *
 * The provider under the test server is `console`, so nothing leaves
 * the machine. What is asserted is the delivery *record* — which is the
 * thing the product would rely on to answer "did we mail them?".
 */

const PASSWORD = "forge-e2e-password";
const CHAPTER_URL =
  "/learn/dsa/dsa-foundations/complexity-analysis/why-complexity-matters";

function uniqueEmail(tag: string): string {
  return `e2e-mail-${tag}-${Date.now()}-${Math.floor(Math.random() * 10_000)}@techepitome.test`;
}

async function signUp(page: Page, tag: string): Promise<string> {
  const email = uniqueEmail(tag);
  await page.goto("/signup");
  await page.getByLabel("Name").fill("Reader");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await finishSignup(page);
  return email;
}

/** Completes a chapter, which is what schedules a review. */
async function earnAReview(page: Page): Promise<void> {
  await page.goto(CHAPTER_URL);
  await page.getByRole("button", { name: "Mark chapter complete" }).click();
  await expect(page.getByRole("button", { name: "Mark as not complete" })).toBeVisible({
    timeout: 30_000,
  });
}

async function callCron(
  page: Page,
  headers: Record<string, string>
): Promise<{ status: number; body: string }> {
  // The job allows one run at a time, so a parallel worker's run answers 409.
  // That is the lock working; wait for it to finish rather than failing.
  for (let attempt = 0; ; attempt += 1) {
    const response = await page.request.post("/api/cron/notifications", {
      headers,
      failOnStatusCode: false,
    });
    if (response.status() !== 409 || attempt === 20) {
      return { status: response.status(), body: await response.text() };
    }
    await page.waitForTimeout(500);
  }
}

test.afterAll(async () => {
  await closeDb();
});

// ---------------------------------------------------------------------------

test("the cron endpoint refuses an unauthenticated caller", async ({ page }) => {
  // The route enumerates users and sends mail. It is the one place where
  // getting authorization wrong is an open mail relay.
  const anonymous = await callCron(page, {});
  expect([401, 503]).toContain(anonymous.status);

  const wrong = await callCron(page, { authorization: "Bearer not-the-secret" });
  expect([401, 503]).toContain(wrong.status);

  // And it is not reachable by GET at all.
  const get = await page.request.get("/api/cron/notifications", {
    failOnStatusCode: false,
  });
  expect(get.status()).toBe(405);
});

test("the cron endpoint never leaks the secret it checks", async ({ page }) => {
  const result = await callCron(page, { authorization: "Bearer guess" });
  expect(result.body).not.toMatch(/secret/i);
  expect(result.body.length).toBeLessThan(500);
});

test("a learner who opted in gets one reminder, however often cron runs", async ({
  page,
}) => {
  test.slow();
  const secret = process.env.CRON_SECRET;
  test.skip(
    !secret,
    "CRON_SECRET is not set for the test server; the route correctly refuses."
  );

  const email = await signUp(page, "reminder");
  await earnAReview(page);

  // The schedule puts it in the future; make it due, as a day passing would.
  await expect(async () => {
    expect((await reviewItemsFor(email)).length).toBeGreaterThan(0);
  }).toPass({ timeout: 20_000 });
  await makeReviewsDue(email);
  await enableEmailReminders(email);

  const first = await callCron(page, { authorization: `Bearer ${secret}` });
  expect(first.status).toBe(200);

  await expect(async () => {
    const rows = await emailDeliveriesFor(email);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.status).toBe("accepted");
    expect(rows[0]!.kind).toBe("review-reminder");
  }).toPass({ timeout: 20_000 });

  // Twice more. The unique constraint is the guarantee, not a timer.
  await callCron(page, { authorization: `Bearer ${secret}` });
  await callCron(page, { authorization: `Bearer ${secret}` });

  expect(await emailDeliveriesFor(email)).toHaveLength(1);
});

test("a learner who did not opt in is never mailed", async ({ page }) => {
  test.slow();
  const secret = process.env.CRON_SECRET;
  test.skip(!secret, "CRON_SECRET is not set for the test server.");

  const email = await signUp(page, "optout");
  await earnAReview(page);
  await expect(async () => {
    expect((await reviewItemsFor(email)).length).toBeGreaterThan(0);
  }).toPass({ timeout: 20_000 });
  await makeReviewsDue(email);
  // Deliberately not calling enableEmailReminders: the default is off.

  const result = await callCron(page, { authorization: `Bearer ${secret}` });
  expect(result.status).toBe(200);

  // Not "sent and suppressed" — no attempt row at all.
  expect(await emailDeliveriesFor(email)).toHaveLength(0);
});

test("the email preference is off by default and can be turned on", async ({
  page,
}) => {
  const email = await signUp(page, "settings");

  await page.goto("/settings");
  const toggle = page.getByLabel("Review reminders by email");
  await expect(toggle).toBeVisible();
  // Mail cannot be un-sent, so it is opt-in.
  await expect(toggle).not.toBeChecked();

  await toggle.check();
  await page.getByRole("button", { name: /Save/ }).click();
  await expect(page.getByText(/Settings saved/)).toBeVisible({ timeout: 20_000 });

  await page.reload();
  await expect(page.getByLabel("Review reminders by email")).toBeChecked();

  // Nothing was sent merely by opting in.
  expect(await emailDeliveriesFor(email)).toHaveLength(0);
});
