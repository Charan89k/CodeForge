import { expect, test } from "@playwright/test";

import { closeDb, joinTestCollege } from "./db";
import { PASSWORD, signUp } from "./helpers";

/** Taking a copy of your data, and deleting your account, from /settings. */
const unique = () => `${Date.now()}-${Math.floor(Math.random() * 1e5)}`;

test.afterAll(async () => {
  await closeDb();
});

test("a learner downloads their data, then deletes their account", async ({ page }) => {
  const email = `e2e-account-${unique()}@techepitome.test`;
  await signUp(page, email);
  await page.goto("/settings");
  await expect(
    page.getByRole("heading", { name: "Your data", exact: true })
  ).toBeVisible();

  const response = await page.request.get("/settings/export");
  expect(response.status()).toBe(200);
  expect(response.headers()["content-disposition"]).toContain("attachment");
  const body = await response.text();
  expect(body).toContain(email);
  expect(body).not.toContain("passwordHash");

  // Refused with a reason, and the account stays.
  await page.getByLabel("Your password").fill("not my password");
  await page.getByLabel(/Type "delete my account"/).fill("delete my account");
  await page.getByRole("button", { name: "Delete my account permanently" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "does not match" })
  ).toBeVisible({ timeout: 30_000 });

  await page.getByLabel("Your password").fill(PASSWORD);
  await page.getByLabel(/Type "delete my account"/).fill("delete my account");
  await page.getByRole("button", { name: "Delete my account permanently" }).click();
  await expect(page).toHaveURL(/\/account-deleted$/, { timeout: 30_000 });
  await expect(
    page.getByRole("heading", { name: "Your account has been deleted" })
  ).toBeVisible();

  // Signed out, and the credentials no longer work.
  await page.goto("/settings");
  await expect(page).toHaveURL(/\/login/);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForTimeout(2_000);
  await expect(page).toHaveURL(/\/login/);
});

test("a college member is told why they cannot delete, and can still export", async ({
  page,
}) => {
  const email = `e2e-account-college-${unique()}@techepitome.test`;
  await signUp(page, email);
  await joinTestCollege(email);
  await page.goto("/settings");
  await expect(page.getByText(/college records/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Delete my account permanently" })
  ).toHaveCount(0);
  expect((await page.request.get("/settings/export")).status()).toBe(200);
});

test("nobody signed out can export", async ({ request }) => {
  const response = await request.get("/settings/export", { maxRedirects: 0 });
  expect([307, 401]).toContain(response.status());
  expect(await response.text()).not.toContain("account");
});
