import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3100);

/**
 * The cron secret the test server runs with.
 *
 * Long enough to satisfy the env schema's minimum, and shared with the
 * specs through `process.env` below so they can call the endpoint. It
 * authenticates a local test server to a local test suite and is not a
 * credential for anything.
 */
const E2E_CRON_SECRET = "e2e-cron-secret-not-a-real-credential";
process.env.CRON_SECRET ??= E2E_CRON_SECRET;
const baseURL = `http://127.0.0.1:${PORT}`;

/**
 * OAuth client credentials are deliberately NOT set here.
 *
 * The test server inherits whatever the developer's environment already
 * provides, and nothing else: no placeholder, no stand-in, no invented
 * value. `e2e/oauth.spec.ts` asks the running server which providers it
 * actually registered and skips the provider-dependent cases when the answer
 * is "none", rather than manufacturing credentials so they appear to pass.
 *
 * The callback-boundary and redirect checks in that spec need no provider at
 * all and always run.
 */

/**
 * End-to-end tests.
 *
 * Runs against a real dev server on its own port so it never collides with
 * a server the developer already has open on 3000. The suite talks to the
 * real database - these tests exist to prove the flows work end to end, and
 * mocking the database would defeat that. Every test creates its own user
 * with a unique email so runs stay independent.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  /**
   * One local retry, for one specific and well-understood cause.
   *
   * Under parallel load the Next **dev server** sometimes leaves a hidden
   * prerender copy of a page in the DOM, so a locator that should match
   * once matches twice and Playwright's strict mode fails the test. It is
   * a dev-server artefact — the production build does not do it, and the
   * production CSP test renders the same pages once — but it cannot be
   * fixed from the test side everywhere: the tutor panel renders in a
   * Radix portal outside `main`, so the usual "scope to main" fix does
   * not apply to it.
   *
   * A retry is not hiding a product bug here, and Playwright reports a
   * test that needed one as *flaky* rather than passed, so it stays
   * visible. CI keeps two, because a cold CI machine is slower still.
   */
  retries: process.env.CI ? 2 : 1,
  // Capped deliberately: these tests run real code through the executor,
  // so unlimited workers means several Python and JVM processes competing
  // for the same cores and timing out on contention rather than on a bug.
  workers: process.env.CI ? 1 : 3,
  reporter: process.env.CI ? "github" : "list",

  // The default 30s is for a page test. These are journeys: each one
  // registers an account, and several stream from a model or run code in
  // a sandbox. Under three workers competing for the same dev server, a
  // slow-but-correct run was failing on the clock rather than on a bug.
  timeout: 60_000,

  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  // The capture spec drives the real app and saves screenshots and a
  // recording for the README. It is not a test, so the two test projects
  // ignore it and it gets a project of its own with a fixed, generous
  // viewport so the media is consistent.
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      testIgnore: /capture-media\.spec\.ts/,
    },
    {
      name: "mobile",
      use: { ...devices["Pixel 7"] },
      testIgnore: /capture-media\.spec\.ts/,
    },
    {
      name: "capture",
      testMatch: /capture-media\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
        deviceScaleFactor: 2,
        video: { mode: "on", size: { width: 1440, height: 900 } },
      },
    },
  ],

  webServer: {
    // RATE_LIMIT_DISABLED is honoured only outside production (see
    // src/lib/rate-limit.ts). The suite registers many throwaway accounts
    // from a single IP, which the signup policy exists to prevent.
    command: `npx next dev --port ${PORT}`,
    env: {
      RATE_LIMIT_DISABLED: "true",
      // The daily AI quotas are unit-tested in src/lib/ai/quota; here they
      // would only stop specs that start many interviews with one account.
      AI_DAILY_INTERVIEW_LIMIT: process.env.AI_DAILY_INTERVIEW_LIMIT ?? "1000",
      AI_DAILY_TURN_LIMIT: process.env.AI_DAILY_TURN_LIMIT ?? "10000",
      // See src/lib/db/prisma.ts. Harmless against real Postgres.
      DATABASE_POOL_MAX: process.env.DATABASE_POOL_MAX ?? "1",
      // The tutor streams from a deterministic double, so the suite needs
      // neither an API key nor a local model, and assertions about what
      // the context builder sent are stable. `src/lib/ai/mock.ts` refuses
      // to load in production, and `src/lib/env.ts` rejects this value
      // there, so it cannot escape the test environment.
      AI_PROVIDER: process.env.AI_PROVIDER ?? "mock",
      // The console provider logs and delivers nothing; it refuses to
      // construct in production, so this cannot escape the test run.
      EMAIL_PROVIDER: process.env.EMAIL_PROVIDER ?? "console",
      // A throwaway secret so the cron route's happy path is exercised
      // over real HTTP. Not a credential: it authenticates a local test
      // server against the local test suite.
      CRON_SECRET: process.env.CRON_SECRET ?? E2E_CRON_SECRET,
    },
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    stdout: "pipe",
    stderr: "pipe",
  },
});
