import { expect, test, type Browser, type Page } from "@playwright/test";

import { closeDb, execSql, userIdFor } from "./db";
import { signUp } from "./helpers";

/**
 * The placement office and its students through the running app. Memberships
 * are seeded directly because the invitation flow has its own coverage; every
 * placement step below goes through the real pages and server actions.
 */

const unique = () => `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

test.afterAll(async () => {
  await closeDb();
});

async function createCollege(tag: string): Promise<{ id: string; slug: string }> {
  const slug = `e2e-place-${tag}`;
  const [row] = await execSql<{ id: string }>(
    `INSERT INTO institutions (id, slug, name, "updatedAt") VALUES ($1, $2, $3, now()) RETURNING id`,
    [`inst_place_${tag}`, slug, `Placement College ${tag}`]
  );
  return { id: row!.id, slug };
}

/** A signed-in person with a role, in a browser context of their own. */
async function person(
  browser: Browser,
  institutionId: string,
  role: string,
  tag: string
): Promise<{ page: Page; email: string }> {
  const page = await (await browser.newContext()).newPage();
  const email = await signUp(page, `place-${tag}-${unique()}@techepitome.test`);
  await execSql(
    `INSERT INTO institution_memberships (id, "institutionId", "userId", role, source, "updatedAt")
     VALUES ($1, $2, $3, $4::"InstitutionRole", 'PLATFORM', now())`,
    [`mem_${unique()}`, institutionId, await userIdFor(email), role]
  );
  return { page, email };
}

test("each role opens the college page on its own work", async ({ browser }) => {
  test.slow();
  const college = await createCollege(unique());
  const expected = [
    ["STUDENT", "Your next steps", "Your teaching"],
    ["FACULTY", "Your teaching", "Placement office"],
    ["PLACEMENT_OFFICER", "Placement office", "Your teaching"],
    ["INSTITUTION_ADMIN", "Your college", "Your next steps"],
  ] as const;

  for (const [role, heading, absent] of expected) {
    const { page } = await person(browser, college.id, role, role.toLowerCase());
    await page.goto(`/campus/${college.slug}`);
    const main = page.getByRole("main");
    await expect(main.getByRole("heading", { name: heading })).toBeVisible();
    await expect(main.getByRole("heading", { name: absent })).toHaveCount(0);
  }
});

test("a drive runs from recruiter to accepted offer, and eligibility is explained", async ({
  browser,
}) => {
  test.slow();
  const college = await createCollege(unique());
  const base = `/campus/${college.slug}/placement`;
  const office = await person(browser, college.id, "PLACEMENT_OFFICER", "office");
  const strong = await person(browser, college.id, "STUDENT", "strong");
  const weak = await person(browser, college.id, "STUDENT", "weak");

  // Without a recruiter there is nothing to attach a drive to.
  await office.page.goto(base);
  await expect(
    office.page.getByRole("heading", { name: "Placement office" })
  ).toBeVisible();
  await office.page.getByRole("link", { name: "Go to recruiters" }).click();
  await expect(office.page.getByRole("heading", { name: "Recruiters" })).toBeVisible();

  await office.page.getByLabel("Name").fill("Acme Systems");
  await office.page.getByLabel("Industry").fill("Software");
  await office.page.getByRole("button", { name: "Add recruiter" }).click();
  await office.page.getByRole("link", { name: /Acme Systems/ }).click();
  await expect(
    office.page.getByRole("heading", { name: "Acme Systems" })
  ).toBeVisible();

  await office.page.getByLabel("Name").fill("Asha Rao");
  await office.page.getByRole("button", { name: "Add contact" }).click();
  await expect(office.page.getByText("Asha Rao")).toBeVisible();
  await office.page.getByLabel("Note").fill("Called about the 2027 batch.");
  await office.page.getByRole("button", { name: "Add note" }).click();
  await expect(office.page.getByText("Called about the 2027 batch.")).toBeVisible();

  await office.page.goto(`${base}/students`);
  await office.page
    .getByLabel("Records as CSV")
    .fill(
      `${strong.email},CSE,2027,8.2,0,88,Python;SQL\n${weak.email},CSE,2027,6.1,0,88,Python`
    );
  await office.page.getByRole("button", { name: "Import" }).click();
  await expect(office.page.getByText("Imported.")).toBeVisible();

  await office.page.goto(base);
  await office.page.getByLabel("Role", { exact: true }).fill("Graduate Engineer");
  await office.page.getByLabel("Description").fill("Backend engineering.");
  await office.page.getByLabel("Application deadline").fill("2035-01-01T10:00");
  await office.page.getByLabel("Minimum CGPA").fill("7");
  await office.page.getByRole("button", { name: "Create drive" }).click();
  await expect(office.page.getByText("1 of 2 students qualify")).toBeVisible();

  // A draft is invisible to students until the office opens it.
  await strong.page.goto(base);
  await expect(strong.page.getByText("No drives are open")).toBeVisible();
  await office.page.getByRole("button", { name: "Open applications" }).click();
  await expect(
    office.page.getByRole("button", { name: "Close applications" })
  ).toBeVisible();

  // The student who misses a rule is told which, and cannot apply.
  await weak.page.goto(base);
  await expect(weak.page.getByText("You do not qualify")).toBeVisible();
  await expect(weak.page.getByLabel("Not met")).toBeVisible();
  await expect(weak.page.getByText("CGPA:")).toBeVisible();
  await expect(weak.page.getByRole("button", { name: "Apply" })).toHaveCount(0);

  await strong.page.goto(base);
  await expect(strong.page.getByText("You qualify", { exact: true })).toBeVisible();
  await strong.page.getByRole("button", { name: "Apply" }).click();
  await expect(strong.page.getByRole("button", { name: "Withdraw" })).toBeVisible();

  await office.page.reload();
  await office.page.getByRole("button", { name: "Shortlist" }).click();
  await office.page.getByRole("button", { name: "Move to interview" }).click();
  await office.page.getByLabel("Offer (LPA)").fill("12.5");
  await office.page.getByRole("button", { name: "Make offer" }).click();
  await expect(office.page.getByText("12.50 LPA")).toBeVisible();

  await strong.page.reload();
  await strong.page.getByRole("button", { name: "Accept offer" }).click();
  await expect(strong.page.getByRole("button", { name: "Accept offer" })).toHaveCount(
    0
  );

  await office.page.goto(base);
  const placed = office.page.locator("dl > div", { hasText: "Placed" });
  await expect(placed.locator("dd")).toHaveText("1");

  const csv = await office.page.request.get(`${base}/export`);
  expect(csv.status()).toBe(200);
  expect(csv.headers()["content-disposition"]).toContain("attachment");
  expect(await csv.text()).toContain(strong.email);

  // A phone must not have to scroll sideways through any office page.
  const drivePath = await office.page
    .getByRole("link", { name: /Graduate Engineer/ })
    .getAttribute("href");
  for (const path of [base, `${base}/students`, `${base}/companies`, drivePath!]) {
    await office.page.goto(path);
    await expect(office.page.getByRole("heading", { level: 1 })).toBeVisible();
    const overflow = await office.page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow, `${path} overflows`).toBeLessThanOrEqual(0);
  }
});

test("only the placement office reaches its pages, and only for its own college", async ({
  browser,
}) => {
  test.slow();
  const tag = unique();
  const college = await createCollege(tag);
  const other = await createCollege(`${tag}-other`);
  const base = `/campus/${college.slug}/placement`;
  const student = await person(browser, college.id, "STUDENT", "refused");
  const faculty = await person(browser, college.id, "FACULTY", "faculty");
  const outsider = await person(browser, other.id, "PLACEMENT_OFFICER", "outsider");

  // Pages stream, so a refusal arrives after a 200 status line: assert content.
  for (const { page } of [student, faculty]) {
    for (const [path, heading] of [
      ["/students", "Student records"],
      ["/companies", "Recruiters"],
    ] as const) {
      await page.goto(`${base}${path}`);
      await expect(
        page.getByRole("heading", { name: "You do not have access to this" })
      ).toBeVisible();
      await expect(page.getByRole("heading", { name: heading })).toHaveCount(0);
    }
    expect((await page.request.get(`${base}/export`)).status()).toBe(403);
  }

  // Another college's officer learns nothing, not even that the college exists.
  await outsider.page.goto(base);
  await expect(
    outsider.page.getByRole("heading", { name: "That page does not exist" })
  ).toBeVisible();
  const csv = await outsider.page.request.get(`${base}/export`);
  expect(csv.status()).toBe(404);
});
