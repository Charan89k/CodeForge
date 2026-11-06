import { randomBytes } from "node:crypto";

import { expect, test, type Browser, type Page } from "@playwright/test";

import { closeDb, execSql, userIdFor } from "./db";
import { signUp } from "./helpers";

/**
 * The community through the running app. The service suite
 * (src/services/community.integration.test.ts) proves the rules; this proves
 * the pages offer them: reading signed out, the username requirement, a
 * question answered and voted on, and a report hidden by a moderator with the
 * reason shown only to its author.
 */
test.afterAll(async () => closeDb());

const unique = () => `${Date.now().toString(36)}${randomBytes(3).toString("hex")}`;

async function person(
  browser: Browser,
  key: string,
  opts: { username?: boolean } = {}
) {
  const page = await (await browser.newContext()).newPage();
  const name = `cm-${key}-${unique()}`;
  const email = await signUp(page, `${name}@techepitome.test`, key);
  if (opts.username !== false) {
    await execSql(
      `INSERT INTO profiles (id, "userId", username, "updatedAt") VALUES ($1, $2, $3, now())
       ON CONFLICT ("userId") DO UPDATE SET username = EXCLUDED.username`,
      [`prof_${unique()}`, await userIdFor(email), name]
    );
  }
  return { page, email, username: name };
}

async function startThread(page: Page, title: string, body: string) {
  await page.goto("/community/new");
  await page.getByLabel("Category").selectOption("algorithms");
  await page.getByLabel("Title").fill(title);
  await page.getByLabel("Details").fill(body);
  await page.getByRole("button", { name: "Post thread" }).click();
  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible({
    timeout: 20_000,
  });
  return page.url();
}

test("a visitor can read the community, but must sign in to post", async ({ page }) => {
  await page.goto("/community");
  await expect(
    page.getByRole("heading", { level: 1, name: "Community" })
  ).toBeVisible();
  await expect(
    page
      .getByRole("navigation", { name: "Categories" })
      .getByText("Algorithms and data structures")
  ).toBeVisible();

  await page.getByRole("link", { name: "Start a thread" }).click();
  await expect(page).toHaveURL(/\/login/);
});

test("posting needs a username, so no name or email is ever shown", async ({
  browser,
}) => {
  const { page } = await person(browser, "nameless", { username: false });
  await page.goto("/community/new");
  await expect(
    page.getByRole("link", { name: "Choose a username in Settings" })
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Post thread" })).toHaveCount(0);
});

test("a question is answered, voted on and marked as the answer", async ({
  browser,
}) => {
  test.slow();
  const asker = await person(browser, "asker");
  const helper = await person(browser, "helper");
  const title = `Why is my binary search off by one? ${unique()}`;
  const url = await startThread(
    asker.page,
    title,
    "I use `while lo < hi` and miss the last element.\n\n```python\nprint(1)\n```"
  );
  await expect(asker.page.getByText("print(1)")).toBeVisible();

  await helper.page.goto(url);
  await helper.page
    .getByLabel("Your reply")
    .fill(`@${asker.username} use a half-open range and move lo to mid + 1.`);
  await helper.page.getByRole("button", { name: "Post reply" }).click();
  await expect(helper.page.getByText("use a half-open range")).toBeVisible({
    timeout: 20_000,
  });

  // Votes: one per person, never on your own post.
  await helper.page.getByRole("button", { name: /^Vote for this thread/ }).click();
  await expect(
    helper.page.getByRole("button", {
      name: /^Remove your vote from this thread\. 1 votes/,
    })
  ).toBeVisible({ timeout: 20_000 });
  await asker.page.reload();
  await expect(asker.page.getByRole("button", { name: /this thread/ })).toBeDisabled();

  await asker.page.getByRole("button", { name: "Mark as the answer" }).click();
  await expect(asker.page.getByText("Accepted answer")).toBeVisible({
    timeout: 20_000,
  });

  const [{ count }] = await execSql<{ count: string }>(
    `SELECT count(*) FROM notifications WHERE "userId" = $1 AND kind = 'COMMUNITY'`,
    [await userIdFor(asker.email)]
  );
  // The reply and the mention are about the same thread: one notification, not two.
  expect(Number(count)).toBe(1);
});

test("a reported reply is hidden with a reason only its author sees", async ({
  browser,
}) => {
  test.slow();
  const asker = await person(browser, "owner");
  const spammer = await person(browser, "spam");
  const moderator = await person(browser, "mod");
  await execSql(`UPDATE users SET role = 'ADMIN' WHERE email = $1`, [moderator.email]);

  const url = await startThread(
    asker.page,
    `Graph question ${unique()}`,
    "Is BFS enough here?"
  );
  await spammer.page.goto(url);
  await spammer.page.getByLabel("Your reply").fill("Cheap followers at a great price");
  await spammer.page.getByRole("button", { name: "Post reply" }).click();
  await expect(spammer.page.getByText("Cheap followers")).toBeVisible({
    timeout: 20_000,
  });

  await asker.page.reload();
  const reply = asker.page.getByRole("listitem").filter({ hasText: "Cheap followers" });
  await reply.getByText("Report", { exact: true }).click();
  await reply.getByLabel("Spam or advertising").check();
  await reply.getByRole("button", { name: "Send report" }).click();
  await expect(reply.getByText("Thanks. A moderator will look at it.")).toBeVisible({
    timeout: 20_000,
  });

  await moderator.page.goto("/community/moderation");
  const group = moderator.page
    .getByRole("listitem")
    .filter({ hasText: "Cheap followers" });
  await expect(group.getByText(/1 report: spam 1/)).toBeVisible();
  await group
    .getByLabel("Reason, shown to the author")
    .first()
    .fill("Advertising is not allowed.");
  await group.getByRole("button", { name: "Hide" }).click();
  // Acting closes its reports, so the item leaves the queue.
  await expect(group).toHaveCount(0, { timeout: 20_000 });

  await asker.page.reload();
  await expect(asker.page.getByText("Cheap followers")).toHaveCount(0);
  await expect(asker.page.getByText("Hidden by a moderator.")).toBeVisible();

  await spammer.page.reload();
  await expect(spammer.page.getByText("Cheap followers")).toBeVisible();
  await expect(spammer.page.getByText(/Advertising is not allowed/)).toBeVisible();
  await expect(spammer.page.getByText("Appeal", { exact: true })).toBeVisible();
});

test("the community page fits a phone", async ({ page, isMobile }) => {
  test.skip(!isMobile, "Layout check for the phone project.");
  await page.goto("/community");
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  expect(overflow).toBeLessThanOrEqual(1);
});
