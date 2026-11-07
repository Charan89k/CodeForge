import { expect, test, type Page } from "@playwright/test";
import { finishSignup } from "./helpers";

/**
 * The critical product loop, end to end.
 *
 *   sign up → dashboard → DSA roadmap → chapter → quiz → complete
 *   → problem → hint → write code → run → submit → progress updates
 *
 * Runs against the real database and the real code executor. Mocking either
 * would defeat the point: the reason this test exists is that all of those
 * steps have to work together, and no unit test can tell you that they do.
 */

const PASSWORD = "forge-e2e-password";

function uniqueEmail(tag: string): string {
  return `e2e-${tag}-${Date.now()}-${Math.floor(Math.random() * 10_000)}@techepitome.test`;
}

async function signUp(page: Page, tag: string): Promise<string> {
  const email = uniqueEmail(tag);
  await page.goto("/signup");
  await page.getByLabel("Name").fill("Loop Learner");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await finishSignup(page);
  return email;
}

/** The problem page collapses to tabs below the `lg` breakpoint. */
function isNarrow(page: Page): boolean {
  const viewport = page.viewportSize();
  return (viewport?.width ?? 1280) < 1024;
}

/**
 * Brings a problem-page pane into view.
 *
 * On desktop the description, editor and results are a three-way split and
 * all are already visible. Below `lg` they are tabs, because a three-way
 * split at 390px is unusable — so the pane has to be selected first.
 */
async function showPane(page: Page, pane: "Problem" | "Code" | "Results") {
  if (!isNarrow(page)) return;
  await page.getByRole("tab", { name: pane }).click();
}

/**
 * Sets the editor's contents through Monaco's own API.
 *
 * Typing multi-line Python through the keyboard fights the editor's
 * auto-indent, which tests Monaco rather than Tech Epitome. A separate test
 * below covers real keystrokes; this one is for getting a known program in
 * so the execution pipeline can be exercised.
 */
async function setEditorCode(page: Page, code: string): Promise<void> {
  await expect(page.locator(".monaco-editor").first()).toBeVisible({ timeout: 60_000 });
  await expect
    .poll(
      async () =>
        page.evaluate(() => {
          const monaco = (window as unknown as { monaco?: unknown }).monaco as
            { editor: { getModels: () => unknown[] } } | undefined;
          return monaco ? monaco.editor.getModels().length : 0;
        }),
      { timeout: 60_000 }
    )
    .toBeGreaterThan(0);

  await page.evaluate((source) => {
    const monaco = (
      window as unknown as {
        monaco: {
          editor: { getModels: () => { setValue: (value: string) => void }[] };
        };
      }
    ).monaco;
    monaco.editor.getModels()[0]!.setValue(source);
  }, code);
}

const CORRECT_SOLUTION = [
  "def highestAltitude(changes):",
  "    altitude = 0",
  "    highest = 0",
  "    for change in changes:",
  "        altitude += change",
  "        if altitude > highest:",
  "            highest = altitude",
  "    return highest",
].join("\n");

test("a new learner can go from signup to a solved problem", async ({ page }) => {
  test.slow();
  await signUp(page, "loop");

  // ---- Dashboard ---------------------------------------------------------
  await expect(
    page.getByRole("heading", { name: /Good (morning|afternoon|evening)/ })
  ).toBeVisible();
  // A fresh account has no history, so the recommender falls back to the
  // start of the catalogue and says why.
  await expect(page.getByText("Next in the catalogue").first()).toBeVisible();

  // ---- Roadmap -----------------------------------------------------------
  await page.goto("/learn/dsa");
  await expect(
    page.getByRole("heading", { name: "Data Structures & Algorithms" })
  ).toBeVisible();
  await page.getByRole("link", { name: /DSA Foundations/ }).click();
  await page.waitForURL("**/learn/dsa/dsa-foundations", { timeout: 30_000 });

  // ---- Chapter -----------------------------------------------------------
  await page.getByRole("link", { name: "Why Complexity Matters" }).first().click();
  await page.waitForURL("**/why-complexity-matters", { timeout: 30_000 });

  await expect(
    page.getByRole("heading", { level: 1, name: "Why Complexity Matters" })
  ).toBeVisible();
  await expect(page.getByText("By the end of this chapter")).toBeVisible();

  // The table of contents is a sidebar on desktop and a drawer on mobile.
  if (!isNarrow(page)) {
    await expect(page.getByRole("navigation", { name: "On this page" })).toBeVisible();
  } else {
    await page.getByRole("button", { name: "On this page" }).click();
    await expect(page.getByRole("navigation", { name: "On this page" })).toBeVisible();
    await page.keyboard.press("Escape");
  }

  // ---- Quiz: answer, submit, get graded ----------------------------------
  await expect(page.getByText("Quick quiz")).toBeVisible();
  const radioGroups = page.locator('[role="radiogroup"]');
  const groupCount = await radioGroups.count();
  expect(groupCount).toBeGreaterThan(0);
  for (let i = 0; i < groupCount; i += 1) {
    await radioGroups.nth(i).locator('[role="radio"]').first().click();
  }
  await page.getByRole("button", { name: "Check answers" }).click();
  // Grading happens server-side and returns explanations either way.
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible({
    timeout: 30_000,
  });

  // ---- Completion is explicit, never automatic ---------------------------
  const completeButton = page.getByRole("button", { name: "Mark chapter complete" });
  await expect(completeButton).toBeVisible();
  await completeButton.click();
  await expect(page.getByRole("button", { name: "Mark as not complete" })).toBeVisible({
    timeout: 30_000,
  });

  // ---- The dashboard reflects it -----------------------------------------
  await page.goto("/dashboard");
  await expect(page.getByText("1 chapter", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Your year" })).toBeVisible();
  await expect(page.getByRole("img", { name: /1 active day,/ })).toBeVisible();
  const courses = page.getByRole("region", { name: "Your courses" });
  await expect(courses.getByRole("link", { name: "DSA Foundations" })).toBeVisible();
  await expect(courses.getByText(/^1 of \d+ chapters$/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Daily challenge" })).toBeVisible();

  // ---- Problem ------------------------------------------------------------
  await page.goto("/problems/running-altitude");
  await expect(
    page.getByRole("heading", { level: 1, name: "Running Altitude" })
  ).toBeVisible();

  // Hints escalate one at a time; the server decides which comes next.
  await showPane(page, "Problem");
  await page.getByRole("button", { name: /Show a hint/ }).click();
  await expect(page.getByText("Hint 1")).toBeVisible({ timeout: 30_000 });

  // ---- Run against the sample tests ---------------------------------------
  await showPane(page, "Code");
  await setEditorCode(page, CORRECT_SOLUTION);
  await page.getByRole("button", { name: "Run", exact: true }).click();
  await showPane(page, "Results");
  await expect(page.getByText("Accepted")).toBeVisible({ timeout: 180_000 });

  // ---- Submit: the full suite, recorded -----------------------------------
  await showPane(page, "Code");
  await page.getByRole("button", { name: "Submit" }).click();
  await showPane(page, "Results");
  await expect(page.getByText("8/8 tests")).toBeVisible({ timeout: 180_000 });

  // ---- Progress updated everywhere ----------------------------------------
  await page.goto("/dashboard");
  await expect(page.getByText("1E · 0M · 0H")).toBeVisible();

  await page.goto("/problems");
  // Scoped to the catalogue tables: the filter panel also has a "Solved"
  // control, and it lives in a closed drawer.
  await expect(page.getByRole("table").getByLabel("Solved").first()).toBeVisible();
});

test("typing in the editor drives the submitted code", async ({ page }) => {
  test.slow();
  await signUp(page, "typing");

  await page.goto("/problems/running-altitude");
  await showPane(page, "Code");
  await expect(page.locator(".monaco-editor").first()).toBeVisible({ timeout: 60_000 });

  // Real input through the editor, on a single line so auto-indent cannot
  // interfere. `insertText` rather than `type`, because Monaco's bracket
  // auto-close reacts to the "(" keystroke and would turn the signature
  // into `(changes))` — a syntax error, which would test nothing useful.
  await page.locator(".monaco-editor .view-lines").first().click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.insertText("def highestAltitude(changes): return 12345");

  await page.getByRole("button", { name: "Run", exact: true }).click();
  await showPane(page, "Results");
  await expect(page.getByText("Wrong answer").first()).toBeVisible({
    timeout: 180_000,
  });
  // The typed value reached the executor and came back as the actual output.
  await expect(page.getByText("12345").first()).toBeVisible();
});

test("the workspace runs by shortcut, focuses, and is dark unless light was chosen", async ({
  page,
}, testInfo) => {
  test.slow();
  test.skip(testInfo.project.name === "mobile", "Desktop layout only");

  await page.goto("/problems/running-altitude");
  const editor = page.locator(".monaco-editor").first();
  await expect(editor).toBeVisible({ timeout: 60_000 });
  await expect(editor).toHaveClass(/vs-dark/);

  await page.locator(".monaco-editor .view-lines").first().click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.insertText("def highestAltitude(changes): return 12345");
  await page.keyboard.press("Control+Enter");
  await expect(page.getByText("Wrong answer").first()).toBeVisible({
    timeout: 180_000,
  });
  // Monaco's own Ctrl+Enter would have added a line.
  await expect(page.locator(".monaco-editor .view-line")).toHaveCount(1);

  const covers = () =>
    page.evaluate(() =>
      Boolean(
        document.elementFromPoint(20, 20)?.closest('[data-testid="problem-workspace"]')
      )
    );
  expect(await covers()).toBe(false);
  await page.getByRole("button", { name: "Focus mode" }).click();
  await expect.poll(covers).toBe(true);
  await page.keyboard.press("Escape");
  await expect.poll(covers).toBe(false);

  await page.evaluate(() => window.localStorage.setItem("theme", "light"));
  await page.reload();
  await expect(editor).toBeVisible({ timeout: 60_000 });
  await expect(editor).not.toHaveClass(/vs-dark/);
});

test("hidden test inputs are never exposed in the results panel", async ({ page }) => {
  test.slow();
  await signUp(page, "hidden");

  await page.goto("/problems/running-altitude");
  await showPane(page, "Code");
  await setEditorCode(page, "def highestAltitude(changes):\n    return -999");

  await page.getByRole("button", { name: "Submit" }).click();
  await showPane(page, "Results");
  await expect(page.getByText("Wrong answer").first()).toBeVisible({
    timeout: 180_000,
  });

  // Samples show their data; hidden cases must not. "10000 10000 10000" is
  // a hidden input for this problem and must appear nowhere on the page.
  const body = await page.locator("body").innerText();
  expect(body).not.toContain("10000 10000 10000");
});

test("the visualization player steps through real algorithm frames", async ({
  page,
}) => {
  await page.goto("/visualize/binary-search");

  await expect(
    page.getByRole("heading", { level: 1, name: "Binary Search" })
  ).toBeVisible();

  const stepCounter = page.locator("footer").getByText(/^\d+\/\d+$/);
  await expect(stepCounter).toBeVisible({ timeout: 40_000 });
  const firstStep = await stepCounter.innerText();

  await page.getByRole("button", { name: "Next step" }).click();
  await expect(stepCounter).not.toHaveText(firstStep);

  // Pseudocode highlighting tracks the frame, which is what makes this a
  // teaching tool rather than an animation.
  await expect(page.getByText("lo = 0, hi = n - 1")).toBeVisible();
});

test("stepping the write-pointer visualization compacts the array on screen", async ({
  page,
}) => {
  await page.goto("/visualize/write-pointer");

  await expect(
    page.getByRole("heading", { level: 1, name: "Write Pointer" })
  ).toBeVisible();

  const stepCounter = page.locator("footer").getByText(/^\d+\/\d+$/);
  await expect(stepCounter).toBeVisible({ timeout: 40_000 });

  // The narration is the step's own description, and it is the accessible
  // representation of the frame — so asserting on it checks the same text a
  // screen reader would hear.
  const narration = page.locator('[aria-live="polite"]').first();

  await expect(narration).toContainText("write pointer starts at slot 0");
  await expect(stepCounter).toHaveText("1/13");

  // Both pointers share slot 0 on the first frame, and the row says so
  // rather than dropping one marker.
  await expect(page.getByText("W R", { exact: true })).toBeVisible();

  const next = page.getByRole("button", { name: "Next step" });

  // Walk to the end. Stepping is an array index, so this is deterministic.
  for (let i = 1; i < 13; i += 1) await next.click();
  await expect(stepCounter).toHaveText("13/13");

  // The final frame is the compacted array: zeros pushed to the back, the
  // kept values still in their original relative order.
  await expect(narration).toContainText("everything from slot 3 on is zero");
  await expect(narration).toContainText("[1, 3, 12, 0, 0]");

  // Stepping back changes the state again, so the controls are not one-way.
  await page.getByRole("button", { name: "Previous step" }).click();
  await expect(stepCounter).toHaveText("12/13");

  // Reset returns to the first frame.
  await page.getByRole("button", { name: "Reset" }).click();
  await expect(stepCounter).toHaveText("1/13");
  await expect(narration).toContainText("write pointer starts at slot 0");
});

test("the command palette searches real content", async ({ page }) => {
  await page.goto("/patterns");

  await page
    .getByRole("button", { name: /Search/ })
    .first()
    .click();
  const input = page.getByPlaceholder(/Search chapters, patterns and problems/);
  await expect(input).toBeVisible();

  await input.fill("sliding");
  await expect(
    page.getByRole("option", { name: /Sliding Window/ }).first()
  ).toBeVisible({
    timeout: 30_000,
  });
});

test("an anonymous visitor can read the curriculum but not track progress", async ({
  page,
}) => {
  // Course content is public and indexable; only progress needs an account.
  await page.goto("/learn/dsa/dsa-foundations/complexity-analysis/big-o-notation");

  await expect(
    page.getByRole("heading", { level: 1, name: "Big O Notation" })
  ).toBeVisible();
  await expect(page.getByText("Drop constants and keep only")).toBeVisible();

  await expect(
    page.getByRole("link", { name: "Sign in to track progress" })
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Mark chapter complete" })).toHaveCount(
    0
  );
});
