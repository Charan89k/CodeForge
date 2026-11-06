/**
 * Environment configuration, validated once at module load.
 *
 * Two exports, deliberately separate:
 *   - `env`       server-only. Importing it from a client component is a
 *                 build error, which is the point: secrets cannot leak by
 *                 accident.
 *   - `clientEnv` the small, explicitly public subset.
 *
 * Next.js inlines `process.env.NEXT_PUBLIC_*` at build time only for literal
 * member accesses, so those are written out longhand below rather than looked
 * up dynamically.
 */
import { z } from "zod";

const emptyToUndefined = (v: unknown) => (v === "" ? undefined : v);

const serverSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  DATABASE_URL: z
    .string()
    .min(1, "DATABASE_URL is required. See .env.example.")
    .refine(
      (v) => v.startsWith("postgres://") || v.startsWith("postgresql://"),
      "DATABASE_URL must be a PostgreSQL connection string."
    ),

  AUTH_SECRET: z
    .string()
    .min(
      32,
      "AUTH_SECRET must be at least 32 characters. Generate one with `npx auth secret`."
    ),

  AUTH_GOOGLE_ID: z.preprocess(emptyToUndefined, z.string().optional()),
  AUTH_GOOGLE_SECRET: z.preprocess(emptyToUndefined, z.string().optional()),

  AUTH_GITHUB_ID: z.preprocess(emptyToUndefined, z.string().optional()),
  AUTH_GITHUB_SECRET: z.preprocess(emptyToUndefined, z.string().optional()),

  // "mock" is the deterministic test double the end-to-end suite runs
  // against, so CI needs neither an API key nor a local model. It is
  // rejected outright in production by the cross-field rules in `getEnv`,
  // and `MockProvider` refuses to construct there as well.
  AI_PROVIDER: z.enum(["ollama", "anthropic", "mock"]).default("ollama"),
  AI_API_KEY: z.preprocess(emptyToUndefined, z.string().optional()),
  AI_MODEL: z.string().default("claude-sonnet-5"),
  OLLAMA_BASE_URL: z.string().url().default("http://127.0.0.1:11434"),
  OLLAMA_MODEL: z.string().default("qwen2.5:14b"),

  /**
   * AI spend controls (src/lib/ai/quota.ts). Tech Epitome is free, so these
   * are what keep one enthusiastic learner — or one script — from running
   * up the provider bill for everyone. Per-user caps are a rolling 24 hours;
   * the site budget is per UTC day and unset means no site-wide cap.
   */
  AI_DAILY_TURN_LIMIT: z.coerce.number().int().positive().default(80),
  AI_DAILY_INTERVIEW_LIMIT: z.coerce.number().int().positive().default(4),
  AI_DAILY_BUDGET_CENTS: z.preprocess(
    emptyToUndefined,
    z.coerce.number().int().positive().optional()
  ),

  /**
   * Who runs learner code. In production only `remote` (Judge0) and `worker`
   * (our execution worker on its own host) are accepted: `local` has no
   * isolation, and `docker` would hand the web process a root-equivalent
   * Docker socket. See docs/EXECUTION.md.
   */
  CODE_EXECUTION_DRIVER: z.enum(["local", "docker", "remote", "worker"]).default("docker"),
  /**
   * Master switch for running learner code. Unset means on in development
   * and OFF in production, so a deploy never starts executing untrusted code
   * until an operator has verified the isolation and set this to "true".
   */
  CODE_EXECUTION_ENABLED: z.preprocess(
    emptyToUndefined,
    z.enum(["true", "false"]).optional()
  ),
  CODE_EXECUTION_API_URL: z.preprocess(emptyToUndefined, z.string().url().optional()),
  CODE_EXECUTION_API_KEY: z.preprocess(emptyToUndefined, z.string().optional()),
  /**
   * Judge0 language ids, as "PYTHON:71,JAVASCRIPT:63,JAVA:62,CPP:54". They
   * differ per Judge0 installation; unset means the public server's ids.
   * Parsed (and refused if malformed) by the Judge0 adapter.
   */
  JUDGE0_LANGUAGE_IDS: z.preprocess(emptyToUndefined, z.string().optional()),


  /**
   * Shared secret for `/api/cron/notifications`. Unset means the route
   * refuses every request — an unauthenticated endpoint that enumerates
   * users is worse than a switched-off feature — so review reminders are
   * simply not sent until a scheduler and this secret are configured.
   */
  // --- Email ---------------------------------------------------------------
  // `console` writes to the log and is rejected in production, exactly like
  // the mock AI provider. `resend` needs both of the values below.
  EMAIL_PROVIDER: z.enum(["resend", "console"]).default("console"),
  RESEND_API_KEY: z.preprocess(emptyToUndefined, z.string().optional()),
  /** The verified sender. `Tech Epitome <noreply@example.com>` is fine. */
  EMAIL_FROM: z.string().default("Tech Epitome <noreply@techepitome.local>"),

  /**
   * Set on any deployment running more than one instance. When true and
   * no distributed store has been installed, `rateLimit` refuses every
   * request rather than quietly falling back to the per-process counter.
   */
  REQUIRE_DISTRIBUTED_RATE_LIMIT: z
    .enum(["true", "false"])
    .optional()
    .default("false"),

  CRON_SECRET: z.preprocess(emptyToUndefined, z.string().min(24).optional()),
  /**
   * Days after an interview ends before the retention job (POST
   * /api/cron/retention) deletes its transcript and code. Feedback stays.
   */
  INTERVIEW_TRANSCRIPT_RETENTION_DAYS: z.coerce.number().int().min(7).max(3650).default(180),
  // Unset means tutor conversations are kept until the learner deletes them.
  TUTOR_CONVERSATION_RETENTION_DAYS: z.preprocess(
    emptyToUndefined,
    z.coerce.number().int().min(7).max(3650).optional()
  ),

  SEED_ADMIN_EMAIL: z.string().email().default("admin@techepitome.local"),
  SEED_ADMIN_PASSWORD: z.string().min(8).default("forge-admin-dev"),
  SEED_DEMO_EMAIL: z.string().email().default("demo@techepitome.local"),
  SEED_DEMO_PASSWORD: z.string().min(8).default("forge-demo-dev"),
});

const clientSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
});

function format(error: z.ZodError): string {
  return error.issues
    .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
    .join("\n");
}

/** Public values. Safe in any runtime. */
export const clientEnv = (() => {
  const parsed = clientSchema.safeParse({
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  });
  if (!parsed.success) {
    throw new Error(`Invalid public environment:\n${format(parsed.error)}`);
  }
  return parsed.data;
})();

type ServerEnv = z.infer<typeof serverSchema> & z.infer<typeof clientSchema>;

let cached: ServerEnv | null = null;

/**
 * Server-side configuration. Throws on first access if anything required is
 * missing, so a misconfigured deploy fails at boot rather than mid-request.
 *
 * Skipped during `next build` when the build is only collecting page data and
 * no real secrets are present, which is what SKIP_ENV_VALIDATION is for.
 */
/**
 * Clears the memoised environment.
 *
 * Only for tests that change a variable and need the next `getEnv` to
 * see it. Nothing in the application calls this: a configuration that
 * can change mid-process is one that can be wrong mid-process.
 */
export function resetEnvForTests(): void {
  cached = null;
}

export function getEnv(): ServerEnv {
  if (cached) return cached;

  if (process.env.SKIP_ENV_VALIDATION === "true") {
    cached = {
      ...(process.env as unknown as z.infer<typeof serverSchema>),
      ...clientEnv,
    };
    return cached;
  }

  const parsed = serverSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(
      `Invalid server environment:\n${format(parsed.error)}\n\n` +
        `Copy .env.example to .env and fill in the missing values.`
    );
  }

  const data = { ...parsed.data, ...clientEnv };

  // Cross-field rules that a per-field schema cannot express.
  if (data.AI_PROVIDER === "anthropic" && !data.AI_API_KEY) {
    throw new Error(
      "AI_PROVIDER is 'anthropic' but AI_API_KEY is empty. Set the key, or " +
        "switch AI_PROVIDER to 'ollama' to use a local model."
    );
  }
  if (data.AI_PROVIDER === "mock" && data.NODE_ENV === "production") {
    throw new Error(
      "AI_PROVIDER is 'mock', which serves canned responses and exists only " +
        "for the test suite. Set it to 'ollama' or 'anthropic' in production."
    );
  }
  if (
    (data.CODE_EXECUTION_DRIVER === "remote" || data.CODE_EXECUTION_DRIVER === "worker") &&
    !data.CODE_EXECUTION_API_URL
  ) {
    throw new Error(
      `CODE_EXECUTION_DRIVER is '${data.CODE_EXECUTION_DRIVER}' but CODE_EXECUTION_API_URL is empty.`
    );
  }
  if (data.CODE_EXECUTION_DRIVER === "worker" && (data.CODE_EXECUTION_API_KEY ?? "").length < 32) {
    throw new Error(
      "CODE_EXECUTION_DRIVER is 'worker' but CODE_EXECUTION_API_KEY is missing or shorter than 32 characters."
    );
  }

  cached = data;
  return cached;
}

/** True when Google OAuth is fully configured; the login UI hides the button otherwise. */
export function isGoogleAuthEnabled(): boolean {
  const e = getEnv();
  return Boolean(e.AUTH_GOOGLE_ID && e.AUTH_GOOGLE_SECRET);
}

/** True when GitHub OAuth is fully configured; the login UI hides the button otherwise. */
export function isGitHubAuthEnabled(): boolean {
  const e = getEnv();
  return Boolean(e.AUTH_GITHUB_ID && e.AUTH_GITHUB_SECRET);
}
