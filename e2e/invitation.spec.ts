import { createHash, randomBytes } from "node:crypto";

import { expect, test, type Browser, type Page } from "@playwright/test";

import { closeDb, execSql, userIdFor } from "./db";
import { signUp } from "./helpers";

/**
 * The invitation link page through the running app. The service suite
 * (src/services/institutions.integration.test.ts) proves the rules; this
 * proves the page shows and enforces them: signed out, unusable links, the
 * wrong account, one use only, and no access to any other college.
 */
test.afterAll(async () => closeDb());

const tag = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const email = (who: string) => `inv-${who}-${tag}@techepitome.test`;
const UNAVAILABLE = "Invitation unavailable";

async function college(key: string) {
  const id = `inst_inv_${key}_${tag}`;
  const slug = `e2e-inv-${key}-${tag}`;
  await execSql(
    `INSERT INTO institutions (id, slug, name, "updatedAt") VALUES ($1, $2, $3, now())`,
    [id, slug, `Invite College ${key} ${tag}`]
  );
  return { id, slug, name: `Invite College ${key} ${tag}` };
}

/** An invitation as `inviteMember` leaves it: only the token's hash is stored. */
async function invite(
  institutionId: string,
  to: string,
  { expired = false, revoked = false } = {}
): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await execSql(
    `INSERT INTO institution_invitations
       (id, "institutionId", email, role, "tokenHash", "expiresAt", "invitedById", "revokedAt")
     VALUES ($1, $2, $3, 'STUDENT', $4, now() + $5::interval, 'e2e-inviter', $6)`,
    [
      `inv_${randomBytes(6).toString("hex")}`,
      institutionId,
      to,
      createHash("sha256").update(token).digest("hex"),
      expired ? "-1 hour" : "7 days",
      revoked ? new Date() : null,
    ]
  );
  return token;
}

async function person(browser: Browser, who: string): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await signUp(page, email(who), who);
  return page;
}

const membershipsOf = async (who: string) =>
  execSql<{ institutionId: string; role: string }>(
    `SELECT "institutionId", role FROM institution_memberships WHERE "userId" = $1`,
    [await userIdFor(email(who))]
  );

test("a signed-out visitor is sent to sign in, and comes back to the link", async ({
  page,
}) => {
  const { id } = await college("out");
  const token = await invite(id, email("nobody"));

  await page.goto(`/campus/invite/${token}`);

  await expect(page).toHaveURL(/\/login/);
  expect(decodeURIComponent(page.url())).toContain(`/campus/invite/${token}`);
});

test("the invited account joins only that college, once", async ({ browser }) => {
  test.slow();
  const target = await college("target");
  const other = await college("other");
  const token = await invite(target.id, email("joiner"));
  const page = await person(browser, "joiner");

  await page.goto(`/campus/invite/${token}`);
  await expect(
    page.getByRole("heading", { name: `Join ${target.name}` })
  ).toBeVisible();
  await expect(page.getByText("You have been invited as a student.")).toBeVisible();
  await page.getByRole("button", { name: "Accept invitation" }).click();

  await expect(page).toHaveURL(new RegExp(`/campus/${target.slug}`));
  expect(await membershipsOf("joiner")).toEqual([
    { institutionId: target.id, role: "STUDENT" },
  ]);
  expect(
    (await membershipsOf("joiner")).some((m) => m.institutionId === other.id)
  ).toBe(false);

  // The same link again: already used.
  await page.goto(`/campus/invite/${token}`);
  await expect(page.getByRole("heading", { name: UNAVAILABLE })).toBeVisible();
  await expect(page.getByRole("button", { name: "Accept invitation" })).toHaveCount(0);
});

test("another account cannot accept a link sent to someone else", async ({
  browser,
}) => {
  const { id } = await college("wrong");
  const token = await invite(id, email("intended"));
  const page = await person(browser, "forwarded");

  await page.goto(`/campus/invite/${token}`);

  await expect(
    page.getByText("This invitation was sent to a different address.")
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Accept invitation" })).toHaveCount(0);
  // The page never shows the invited address.
  await expect(page.getByText(email("intended"))).toHaveCount(0);
  expect(await membershipsOf("forwarded")).toEqual([]);
});

test("expired, revoked and malformed links all read as unavailable", async ({
  browser,
}) => {
  const { id } = await college("dead");
  const page = await person(browser, "late");
  const tokens = [
    await invite(id, email("late"), { expired: true }),
    await invite(id, email("late"), { revoked: true }),
    "not-a-real-token-at-all-0000",
    "<script>",
  ];

  for (const token of tokens) {
    await page.goto(`/campus/invite/${encodeURIComponent(token)}`);
    await expect(page.getByRole("heading", { name: UNAVAILABLE })).toBeVisible();
    await expect(page.getByRole("button", { name: "Accept invitation" })).toHaveCount(
      0
    );
  }
  expect(await membershipsOf("late")).toEqual([]);
});
