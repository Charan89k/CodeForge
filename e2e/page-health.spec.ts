import { expect, test, type Page } from "@playwright/test";

/**
 * A health sweep across every route, on desktop and on a phone.
 *
 * Checks the things that are easy to break and easy to miss in review:
 * console errors, hydration mismatches, and horizontal overflow. Overflow
 * in particular never shows up in a unit test and is the most common way a
 * page "works" everywhere except on a real phone.
 */

const ROUTES = [
  "/",
  "/features",
  "/login",
  "/signup",
  "/learn/dsa",
  "/learn/dsa/dsa-foundations",
  "/learn/dsa/dsa-foundations/complexity-analysis/why-complexity-matters",
  "/learn/dsa/dsa-foundations/sliding-window/variable-windows",
  "/patterns",
  "/patterns/sliding-window",
  "/patterns/monotonic-stack",
  "/problems",
  "/problems/running-altitude",
  "/problems/reverse-chain",
  "/visualize",
  "/visualize/binary-search",
  "/visualize/breadth-first-search",
  "/visualize/write-pointer",
  "/sql",
  "/aptitude",
];

/** Errors a healthy page may still emit, and why they are not our problem. */
function isIgnorable(message: string): boolean {
  return (
    // Dev-only HMR socket churn when a page is closed mid-connection.
    message.includes("_next/hmr") ||
    message.includes("WebSocket") ||
    // Monaco fetches its workers from a CDN in dev; a blocked or slow
    // fetch degrades to the main thread and is not a page defect.
    message.includes("cdn.jsdelivr.net")
  );
}

async function collect(page: Page, path: string) {
  const errors: string[] = [];

  const onConsole = (message: { type: () => string; text: () => string }) => {
    if (message.type() === "error" && !isIgnorable(message.text())) {
      errors.push(`console: ${message.text().slice(0, 300)}`);
    }
  };
  const onPageError = (error: Error) => {
    if (!isIgnorable(error.message)) {
      errors.push(`pageerror: ${error.message.slice(0, 300)}`);
    }
  };

  page.on("console", onConsole);
  page.on("pageerror", onPageError);

  const response = await page.goto(path, { waitUntil: "domcontentloaded" });
  // Long enough for hydration and any lazy chunk to settle.
  await page.waitForTimeout(2500);

  page.off("console", onConsole);
  page.off("pageerror", onPageError);

  return { status: response?.status() ?? 0, errors };
}

for (const path of ROUTES) {
  test(`page health: ${path}`, async ({ page }) => {
    const { status, errors } = await collect(page, path);

    expect(status, `${path} returned ${status}`).toBeLessThan(400);
    expect(errors, `${path}:\n${errors.join("\n")}`).toEqual([]);

    // Horizontal overflow. A small tolerance absorbs sub-pixel rounding
    // and the scrollbar gutter.
    const overflow = await page.evaluate(() => {
      const doc = document.documentElement;
      return doc.scrollWidth - doc.clientWidth;
    });
    expect(overflow, `${path} overflows horizontally by ${overflow}px`).toBeLessThanOrEqual(2);
  });
}

test("no internal link on a shell page is broken", async ({ page, request }) => {
  await page.goto("/learn/dsa");

  // Every internal link on the page, not just the sidebar: the roadmap
  // links to courses, the sidebar to sections, the top bar to account
  // pages. A dead link anywhere is the same bug.
  const hrefs = await page
    .locator("a[href^='/']")
    .evaluateAll((links) =>
      [
        ...new Set(
          links
            // The fragment never reaches the server, so links to sections
            // of one page are one request, not one per section.
            .map((link) => (link.getAttribute("href") ?? "").split("#")[0]!)
            .filter((href) => href.length > 1 && !href.startsWith("//"))
        ),
      ].slice(0, 30)
    );

  expect(hrefs.length).toBeGreaterThan(4);

  for (const href of hrefs) {
    const response = await request.get(href, { maxRedirects: 0 });
    // 200 for public pages, 307 for the ones that redirect to login.
    expect([200, 307], `${href} returned ${response.status()}`).toContain(
      response.status()
    );
  }
});

test("a problem page is served in the layout it hydrates into", async ({ page }) => {
  // The server guesses the layout from the request. If the guess is wrong,
  // a phone hydrates the desktop split and swaps to tabs, remounting the
  // description and detaching any selection in it.
  const phone = (page.viewportSize()?.width ?? 1280) < 768;
  const html = await (await page.request.get("/problems/running-altitude")).text();
  expect(html.includes("tech-epitome-problem-h"), "desktop split in the HTML").toBe(!phone);
  expect(/>Results</.test(html), "mobile tabs in the HTML").toBe(phone);
});
