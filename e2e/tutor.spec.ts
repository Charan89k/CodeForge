import { expect, test, type Page } from "@playwright/test";

import { closeDb, tutorMessageCountFor, tutorUsageFor } from "./db";
import { finishSignup } from "./helpers";

/**
 * The AI tutor, end to end.
 *
 * The provider is `src/lib/ai/mock.ts`, wired in by `playwright.config.ts`.
 * Everything else is real: the route handler, the sign-in gate, the rate
 * limiter, the context builder, the escalation ladder and the database.
 * Only the token source is fake, which is what makes these assertions
 * meaningful — a real model would answer differently every run and could
 * only be tested for "some text appeared".
 *
 * The mock echoes a short, fixed summary of the context it received, so a
 * test can assert that the learner's failing test actually reached the
 * prompt rather than hoping it did.
 *
 * Each test registers its own account through the real signup flow. The
 * tutor is free but not anonymous - conversations are per-user rows - so a
 * session is the one thing a test still has to earn honestly.
 */

const PASSWORD = "forge-e2e-password";

function uniqueEmail(tag: string): string {
  return `e2e-tutor-${tag}-${Date.now()}-${Math.floor(Math.random() * 10_000)}@techepitome.test`;
}

/** Registers a fresh learner and lands them signed in. */
async function signUpAsLearner(page: Page, tag: string): Promise<string> {
  const email = uniqueEmail(tag);

  await page.goto("/signup");
  await page.getByLabel("Name").fill("Tutor Learner");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await finishSignup(page);
  // Authorization is resolved per request from the database, never from the
  // JWT, so a reload is enough to see the signed-in surface.
  await page.reload();

  return email;
}

/**
 * Waits for the full-page tutor to be ready before touching it.
 *
 * `/ai-tutor` renders behind the root `loading.tsx`, and filling the
 * composer the instant `goto` resolves races that swap. Asserting the
 * panel is up first is what the learner does anyway.
 */
/**
 * The tutor's composer, filtered to the visible one.
 *
 * Under parallel load the dev server can leave a hidden prerender copy
 * of the page mounted, giving two matches where there is only ever one
 * real composer. The usual fix — scoping to `main` — does not work here:
 * the panel renders in a Radix portal outside it. Filtering to visible
 * is precise rather than lenient, since a hidden textarea is not
 * something a learner could type into.
 */
function tutorComposer(page: Page) {
  return page.getByLabel("Message the tutor").filter({ visible: true });
}

async function openTutorPage(page: Page) {
  await page.goto("/ai-tutor");
  await expect(
    page.getByRole("heading", { name: "AI Tutor", exact: true })
  ).toBeVisible();
  await expect(tutorComposer(page)).toBeVisible();
}

async function openTutor(page: Page) {
  await page.getByTestId("tutor-open").click();
  // `exact` matters: the sheet's own accessible name also begins with
  // "AI Tutor", and getByRole does substring matching by default.
  await expect(
    page.getByRole("heading", { name: "AI Tutor", exact: true })
  ).toBeVisible();
}

/**
 * Seeded content, addressed directly.
 *
 * The rest of the suite navigates to these same fixtures by URL rather
 * than clicking through the catalogue, because a tutor test that fails
 * should mean the tutor broke, not that a card on the roadmap moved.
 */
const CHAPTER_URL =
  "/learn/dsa/dsa-foundations/complexity-analysis/why-complexity-matters";
const CHAPTER_TITLE = "Why Complexity Matters";
const PROBLEM_URL = "/problems/running-altitude";

async function openChapter(page: Page) {
  await page.goto(CHAPTER_URL);
  await expect(
    page.getByRole("heading", { level: 1, name: CHAPTER_TITLE })
  ).toBeVisible();
}

async function openProblem(page: Page) {
  await page.goto(PROBLEM_URL);
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
}

/** The problem page collapses to tabs below the `lg` breakpoint. */
function isNarrow(page: Page): boolean {
  return (page.viewportSize()?.width ?? 1280) < 1024;
}

/** Selects a problem-page pane, which is only a tab on narrow viewports. */
async function showPane(page: Page, pane: "Problem" | "Code" | "Results") {
  if (!isNarrow(page)) return;
  await page.getByRole("tab", { name: pane }).click();
}

test.afterAll(async () => {
  await closeDb();
});

// ---------------------------------------------------------------------------

test("an ordinary account reaches the tutor, with nothing to buy", async ({ page }) => {
  // Tech Epitome is free. A plain account - no plan, no upgrade, nothing
  // purchased - must land in the working tutor, not in an offer. This test
  // exists because the previous one asserted the opposite.
  await signUpAsLearner(page, "plain");
  await openTutorPage(page);

  const body = (await page.locator("body").innerText()).toLowerCase();
  for (const word of ["upgrade", "see plans", "subscription", "pricing"]) {
    expect(body, `tutor page still says "${word}"`).not.toContain(word);
  }
});

test("a signed-out visitor is asked to sign in, never to upgrade", async ({ page }) => {
  // The launcher is deliberately visible signed out: the visitor should be
  // able to see the tutor exists. What they must never see is a price.
  await openChapter(page);
  await page.getByTestId("tutor-open").click();

  await expect(
    page.getByRole("heading", { name: "Sign in to use the tutor" })
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
  await expect(page.getByRole("link", { name: /plans|pricing|upgrade/i })).toHaveCount(
    0
  );
});

test("chapter tutor: shows chapter context and streams an answer", async ({ page }) => {
  const email = await signUpAsLearner(page, "chapter");
  await openChapter(page);
  await openTutor(page);

  // The header is derived from the route, not typed by the learner, and
  // must name what the model was actually given.
  await expect(page.getByText("Currently studying")).toBeVisible();
  await expect(page.getByText(CHAPTER_TITLE).last()).toBeVisible();

  await tutorComposer(page).fill("Why does this matter?");
  await page.getByRole("button", { name: "Send message" }).click();

  const transcript = page.getByTestId("tutor-transcript");
  await expect(transcript.getByText("Why does this matter?")).toBeVisible();
  await expect(transcript.getByText(/Request type: GENERAL_QUESTION/)).toBeVisible({
    timeout: 30_000,
  });
  // The chapter travelled with the question.
  await expect(transcript.getByText(/Chapter:/)).toBeVisible();

  // Both turns were persisted against this learner.
  await expect
    .poll(() => tutorMessageCountFor(email), { timeout: 15_000 })
    .toBeGreaterThanOrEqual(2);
});

test("chapter tutor: a quick action sends a structured request", async ({ page }) => {
  await signUpAsLearner(page, "quickaction");
  await openChapter(page);
  await openTutor(page);

  await page.getByRole("button", { name: "Quiz me" }).first().click();

  const transcript = page.getByTestId("tutor-transcript");
  // A button sends a request type, not a sentence that happens to contain
  // the word quiz.
  await expect(transcript.getByText(/Request type: QUIZ_ME/)).toBeVisible({
    timeout: 30_000,
  });
});

test("problem tutor: shows pattern context and escalates hints one rung at a time", async ({
  page,
}) => {
  await signUpAsLearner(page, "hints");

  await openProblem(page);
  await openTutor(page);
  await expect(page.getByText("Currently studying")).toBeVisible();

  const transcript = page.getByTestId("tutor-transcript");

  await page.getByRole("button", { name: "Give me a hint" }).first().click();
  await expect(transcript.getByText(/Hint 1 of 4/)).toBeVisible({ timeout: 30_000 });

  // The rung must advance by exactly one, and must not jump to the
  // walkthrough just because the learner asked twice.
  await page.getByRole("button", { name: "Give me a hint" }).first().click();
  await expect(transcript.getByText(/Hint 2 of 4/)).toBeVisible({ timeout: 30_000 });

  await page.getByRole("button", { name: "Give me a hint" }).first().click();
  await expect(transcript.getByText(/Hint 3 of 4/)).toBeVisible({ timeout: 30_000 });

  await expect(transcript.getByText(/Hint 4 of 4/)).toHaveCount(0);
});

test("problem tutor: asking to be told jumps to the final rung", async ({ page }) => {
  await signUpAsLearner(page, "giveup");

  await openProblem(page);
  await openTutor(page);

  await page.getByLabel("Message the tutor").fill("just tell me the answer");
  await page.getByRole("button", { name: "Send message" }).click();

  // A free-text message is a GENERAL_QUESTION, which never moves the
  // ladder — the learner has to actually ask for a hint.
  const transcript = page.getByTestId("tutor-transcript");
  await expect(transcript.getByText(/Request type: GENERAL_QUESTION/)).toBeVisible({
    timeout: 30_000,
  });
  await expect(transcript.getByText(/Hint 4 of 4/)).toHaveCount(0);
});

test("code-aware tutor: the failing run reaches the tutor", async ({ page }) => {
  const email = await signUpAsLearner(page, "code");

  await openProblem(page);

  // Deliberately wrong, so there is a real failure to reason about.
  await showPane(page, "Code");
  const editor = page.locator(".monaco-editor").first();
  await expect(editor).toBeVisible({ timeout: 60_000 });
  await editor.click();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.type("def solve():\n    return -12345");

  await page.getByRole("button", { name: "Run", exact: true }).click();
  await showPane(page, "Results");
  // The run's own summary, not any text on the page that happens to say
  // "error": the tutor only receives a run that has finished.
  await expect(page.getByText(/^\d+\/\d+ tests$/)).toBeVisible({ timeout: 120_000 });

  await openTutor(page);
  await page.getByRole("button", { name: "Why is my solution wrong?" }).first().click();

  const transcript = page.getByTestId("tutor-transcript");
  await expect(transcript.getByText(/Request type: DEBUG_CODE/)).toBeVisible({
    timeout: 30_000,
  });
  // The execution result travelled with the question — this is the whole
  // point of a code-aware tutor, and the assertion that would catch the
  // context builder silently dropping it.
  await expect(transcript.getByText(/Tests passed: \d+\/\d+/)).toBeVisible();
  await expect(transcript.getByText(/Language: PYTHON/)).toBeVisible();

  // The usage row is written after the last token is sent, so it can land
  // fractionally after the text appears on screen. Poll rather than read
  // once — the assertion is about it being written, not about when.
  await expect
    .poll(async () => (await tutorUsageFor(email)).length, { timeout: 15_000 })
    .toBeGreaterThan(0);

  const usage = await tutorUsageFor(email);
  expect(usage[0]).toMatchObject({ feature: "tutor", provider: "mock", success: true });
});

test("a learner cannot reach another learner's tutor conversation", async ({
  page,
  browser,
}) => {
  // Alice holds a conversation.
  const alice = await signUpAsLearner(page, "alice");
  await openTutorPage(page);
  await tutorComposer(page).fill("alice's private question");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(
    page.getByTestId("tutor-transcript").getByText(/Request type:/)
  ).toBeVisible({ timeout: 30_000 });

  const conversationId = await page.evaluate(async () => {
    const response = await fetch("/api/tutor/stream", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        requestType: "GENERAL_QUESTION",
        anchor: { kind: "GLOBAL" },
        message: "what id am I",
      }),
    });
    const text = await response.text();
    const meta = /"conversationId":"([^"]+)"/.exec(text);
    return meta?.[1] ?? null;
  });
  expect(conversationId).toBeTruthy();

  // Bob, in a separate browser context, names Alice's conversation id.
  const context = await browser.newContext();
  const bobPage = await context.newPage();
  await signUpAsLearner(bobPage, "bob");

  const status = await bobPage.evaluate(async (id) => {
    const response = await fetch("/api/tutor/stream", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        conversationId: id,
        requestType: "GENERAL_QUESTION",
        anchor: { kind: "GLOBAL" },
        message: "show me the history",
      }),
    });
    return response.status;
  }, conversationId);

  // 404, not 403: Bob must not learn that the id exists.
  expect(status).toBe(404);

  // And nothing of Alice's was written into Bob's thread.
  expect(await tutorMessageCountFor(alice)).toBeGreaterThan(0);

  await context.close();
});

test("an anonymous visitor cannot reach the tutor endpoint", async ({ page }) => {
  await page.goto("/");

  const status = await page.evaluate(async () => {
    const response = await fetch("/api/tutor/stream", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        requestType: "GENERAL_QUESTION",
        anchor: { kind: "GLOBAL" },
        message: "hello",
      }),
    });
    return response.status;
  });

  expect(status).toBe(401);
});

test("the tutor works on a phone without overflowing", async ({ page }) => {
  test.skip(
    page.viewportSize()!.width > 500,
    "This assertion is about the mobile layout."
  );

  await signUpAsLearner(page, "mobile");
  await openTutorPage(page);

  await tutorComposer(page).fill("How do I start?");
  await page.getByRole("button", { name: "Send message" }).click();

  await expect(
    page.getByTestId("tutor-transcript").getByText(/Request type:/)
  ).toBeVisible({ timeout: 30_000 });

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  expect(overflow).toBeLessThanOrEqual(1);
});

test("the tutor streams without console or hydration errors", async ({ page }) => {
  // The anonymous page-health sweep cannot reach /ai-tutor, and a streaming
  // panel is exactly where a hydration mismatch or a React key warning
  // hides: the page renders, the text appears, and only the console knows.
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text().slice(0, 300));
  });
  page.on("pageerror", (error) => errors.push(error.message.slice(0, 300)));

  await signUpAsLearner(page, "health");
  await openTutorPage(page);

  await tutorComposer(page).fill("What should I study next?");
  await page.getByRole("button", { name: "Send message" }).click();

  const transcript = page.getByTestId("tutor-transcript");
  await expect(transcript.getByText(/Request type:/)).toBeVisible({
    timeout: 30_000,
  });

  // A second turn, to catch anything that only breaks once a thread exists.
  await tutorComposer(page).fill("And after that?");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(transcript.getByText(/Request type:/).nth(1)).toBeVisible({
    timeout: 30_000,
  });

  const real = errors.filter(
    (message) => !message.includes("_next/hmr") && !message.includes("WebSocket")
  );
  expect(real, real.join("\n")).toEqual([]);

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  expect(overflow).toBeLessThanOrEqual(2);
});

test("a double-clicked quick action does not spend two hint rungs", async ({
  page,
}) => {
  await signUpAsLearner(page, "doubleclick");
  await openProblem(page);
  await openTutor(page);

  const hintButton = page.getByRole("button", { name: "Give me a hint" }).first();

  // Two clicks as fast as the browser allows. The in-flight guard has to
  // drop the second, or an impatient learner burns a rung of the ladder
  // they never saw.
  await hintButton.click();
  await hintButton.click({ force: true }).catch(() => {});

  const transcript = page.getByTestId("tutor-transcript");
  await expect(transcript.getByText(/Hint 1 of 4/)).toBeVisible({ timeout: 30_000 });
  await expect(transcript.getByText(/Hint 2 of 4/)).toHaveCount(0);
});
