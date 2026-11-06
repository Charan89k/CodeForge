import { hash } from "@node-rs/argon2";
import { PrismaPg } from "@prisma/adapter-pg";

import { loadEnv } from "./load-env";

import { PrismaClient } from "../src/generated/prisma/client";
import { ACHIEVEMENTS } from "../src/data/achievements";
import { APTITUDE_TOPICS } from "../src/data/aptitude";
import {
  BEHAVIORAL_CATEGORIES,
  BEHAVIORAL_QUESTION_COUNT,
} from "../src/data/behavioral/questions";
import { DSA_COURSE } from "../src/data/curriculum";
import { ARGON2_OPTIONS } from "../src/lib/auth/argon2";
import type { CourseSeed } from "../src/data/curriculum/types";
import { SYSTEM_DESIGN_COURSE } from "../src/data/system-design";
import { SYSTEM_DESIGN_EXERCISES } from "../src/data/system-design/exercises";
import { LLD_COURSE } from "../src/data/lld";
import { LLD_EXERCISES } from "../src/data/lld/exercises";
import type { Track } from "../src/generated/prisma/enums";
import { PATTERNS } from "../src/data/patterns";
import { PREP_SOURCE, PREP_TRACKS } from "../src/data/prep/tracks";
import { PROBLEMS } from "../src/data/problems";
import { QUIZZES } from "../src/data/quizzes";
import { databaseConnection } from "../src/lib/db/ssl";
import {
  upsertCourse,
  upsertLLDExercises,
  upsertSystemDesignExercises,
} from "./content-writer";
import { upsertProblem, upsertTopics } from "./problem-writer";

// Before anything reads DATABASE_URL. Mirrors Next.js' own file order, so
// `NODE_ENV=production npm run db:seed` seeds the hosted database and a bare
// `npm run db:seed` seeds docker-compose.
loadEnv();

/**
 * Database seed.
 *
 * Idempotent by construction: every write is an upsert keyed on a natural
 * unique column (slug, email), so running it repeatedly converges on the
 * same state rather than accumulating duplicates. That matters because it
 * runs on every fresh checkout and after every `migrate reset`.
 *
 * Content lives in src/data/*, not inline here, so the same definitions can
 * be reused by tests and, later, by an admin importer.
 *
 * Ordering is deliberate: patterns and topics first, because chapters and
 * problems reference them by slug; problems before chapters, because a
 * chapter links to its practice problems.
 */

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set. Copy .env.example to .env first.");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    // Same TLS handling as the application's own client: a Supabase host
    // needs the pinned root CA. See src/lib/db/ssl.ts.
    ...databaseConnection(connectionString),
    // The local `prisma dev` stand-in is PGlite-backed and cannot service
    // concurrent connections; the seed is sequential anyway.
    max: Number.parseInt(process.env.DATABASE_POOL_MAX ?? "5", 10) || 5,
  }),
});

/** Same parameters as the application's password hasher. */
const ARGON2 = ARGON2_OPTIONS;

/** Turns a slug into a display name: "two-pointers" -> "Two Pointers". */
async function seedUsers() {
  const accounts = [
    {
      email: (process.env.SEED_ADMIN_EMAIL ?? "admin@techepitome.local").toLowerCase(),
      password: process.env.SEED_ADMIN_PASSWORD ?? "forge-admin-dev",
      name: "Tech Epitome Admin",
      role: "ADMIN" as const,
    },
    {
      email: (process.env.SEED_DEMO_EMAIL ?? "demo@techepitome.local").toLowerCase(),
      password: process.env.SEED_DEMO_PASSWORD ?? "forge-demo-dev",
      name: "Demo Learner",
      role: "USER" as const,
    },
  ];

  for (const account of accounts) {
    const passwordHash = await hash(account.password, ARGON2);

    const user = await prisma.user.upsert({
      where: { email: account.email },
      create: {
        email: account.email,
        name: account.name,
        role: account.role,
        passwordHash,
        emailVerified: new Date(),
      },
      // Re-running must not reset a password that has since been rotated,
      // so only the identifying fields are refreshed.
      update: { name: account.name, role: account.role },
      select: { id: true, email: true },
    });

    await prisma.profile.upsert({
      where: { userId: user.id },
      create: { userId: user.id },
      update: {},
    });
  }

  console.log(`  users          ${accounts.length}`);
}

async function seedAchievements() {
  for (const achievement of ACHIEVEMENTS) {
    await prisma.achievement.upsert({
      where: { slug: achievement.slug },
      create: achievement,
      update: achievement,
    });
  }
  console.log(`  achievements   ${ACHIEVEMENTS.length}`);
}

async function seedPatterns(): Promise<Map<string, string>> {
  const bySlug = new Map<string, string>();

  for (const pattern of PATTERNS) {
    const row = await prisma.pattern.upsert({
      where: { slug: pattern.slug },
      create: { ...pattern, status: "PUBLISHED" },
      update: { ...pattern, status: "PUBLISHED" },
      select: { id: true },
    });
    bySlug.set(pattern.slug, row.id);
  }

  console.log(`  patterns       ${PATTERNS.length}`);
  return bySlug;
}

/** Topics are created on demand from whatever the problems reference. */
async function seedTopics(): Promise<Map<string, string>> {
  const bySlug = await upsertTopics(prisma, PROBLEMS);
  console.log(`  topics         ${bySlug.size}`);
  return bySlug;
}

async function seedProblems(
  patternIds: Map<string, string>,
  topicIds: Map<string, string>
): Promise<Map<string, string>> {
  const bySlug = new Map<string, string>();
  for (const [index, problem] of PROBLEMS.entries()) {
    // Problem numbers follow catalogue order, which is why appending to a
    // topic file is safe but reordering one is not.
    bySlug.set(
      problem.slug,
      await upsertProblem(prisma, problem, index + 1, patternIds, topicIds)
    );
  }
  console.log(`  problems       ${PROBLEMS.length}`);
  return bySlug;
}

/**
 * Seeds one course.
 *
 * Track-parameterised since Phase 7: the Course/Section/Chapter models
 * were always track-agnostic, so System Design reuses this wholesale
 * rather than getting a second, divergent seeder.
 */
async function seedCourse(
  seed: CourseSeed,
  track: Track,
  order: number,
  patternIds: Map<string, string>,
  problemIds: Map<string, string>
): Promise<Map<string, string>> {
  const chapterIds = await upsertCourse(
    prisma,
    seed,
    track,
    order,
    patternIds,
    problemIds
  );
  console.log(
    `  ${seed.title.padEnd(14)} ${seed.sections.length} sections, ${chapterIds.size} chapters`
  );
  return chapterIds;
}

async function seedQuizzes(chapterIds: Map<string, string>) {
  for (const quiz of QUIZZES) {
    const chapterId = chapterIds.get(quiz.chapterSlug);
    if (!chapterId) {
      throw new Error(
        `Quiz ${quiz.slug} references unknown chapter ${quiz.chapterSlug}`
      );
    }

    const row = await prisma.quiz.upsert({
      where: { slug: quiz.slug },
      create: {
        slug: quiz.slug,
        title: quiz.title,
        description: quiz.description ?? null,
        chapterId,
        passScore: quiz.passScore ?? 70,
        status: "PUBLISHED",
      },
      update: {
        title: quiz.title,
        description: quiz.description ?? null,
        chapterId,
        passScore: quiz.passScore ?? 70,
        status: "PUBLISHED",
      },
      select: { id: true },
    });

    // Questions are replaced wholesale. Attempts store the submitted answers
    // as a snapshot rather than by foreign key, so this cannot orphan them.
    await prisma.quizQuestion.deleteMany({ where: { quizId: row.id } });
    await prisma.quizQuestion.createMany({
      data: quiz.questions.map((question, order) => ({
        quizId: row.id,
        type: question.type,
        order,
        prompt: question.prompt,
        code: question.code ?? null,
        options: question.options as object,
        answer: question.answer as object,
        explanation: question.explanation,
        points: question.points ?? 1,
      })),
    });
  }

  const questionCount = QUIZZES.reduce((n, q) => n + q.questions.length, 0);
  console.log(`  quizzes        ${QUIZZES.length} (${questionCount} questions)`);
}

/**
 * System-design exercises.
 *
 * Upserted on slug like everything else here, so re-running the seed
 * updates content in place and never duplicates it. Learner submissions
 * reference these by id and are untouched.
 */
async function seedSystemDesignExercises() {
  await upsertSystemDesignExercises(prisma, SYSTEM_DESIGN_EXERCISES);
  console.log(`  system design  ${SYSTEM_DESIGN_EXERCISES.length} exercises`);
}

/**
 * LLD exercises.
 *
 * Upserted on slug, so re-running updates content in place and never
 * duplicates it. Learner submissions reference these by id and are
 * untouched.
 */
async function seedLLDExercises() {
  await upsertLLDExercises(prisma, LLD_EXERCISES);
  console.log(`  lld            ${LLD_EXERCISES.length} exercises`);
}

/** Updates a seeded question in place, and never touches admin-authored ones. */
async function seedAptitude() {
  for (const topic of APTITUDE_TOPICS) {
    for (const { id, ...question } of topic.questions) {
      const data = { ...question, options: [...question.options], topic: topic.key };
      await prisma.aptitudeQuestion.upsert({
        where: { slug: `${topic.key}-${id}` },
        create: { slug: `${topic.key}-${id}`, ...data, status: "PUBLISHED" },
        // Status is left alone, so a re-seed never republishes a question an admin archived.
        update: data,
      });
    }
  }
}

async function main() {
  /**
   * Behavioural interview questions.
   *
   * `lookingFor` is written to the database because the feedback pass reads
   * it after an interview ends. It is never selected by the paths that build
   * the interviewer's context — see `BRIEF_SELECT` in services/interview.ts.
   */
  async function seedBehavioral() {
    for (const category of BEHAVIORAL_CATEGORIES) {
      const categoryPayload = {
        name: category.name,
        description: category.description,
        order: category.order,
      };

      const row = await prisma.behavioralCategory.upsert({
        where: { slug: category.slug },
        create: { slug: category.slug, ...categoryPayload },
        update: categoryPayload,
        select: { id: true },
      });

      for (const question of category.questions) {
        const payload = {
          categoryId: row.id,
          prompt: question.prompt,
          lookingFor: question.lookingFor,
          followUps: question.followUps,
          order: question.order,
          status: "PUBLISHED" as const,
        };
        await prisma.behavioralQuestion.upsert({
          where: { slug: question.slug },
          create: { slug: question.slug, ...payload },
          update: payload,
        });
      }
    }

    console.log(
      `  behavioral     ${BEHAVIORAL_CATEGORIES.length} categories, ${BEHAVIORAL_QUESTION_COUNT} questions`
    );
  }

  /**
   * Interview preparation tracks.
   *
   * Every association is written with its provenance and its reason, because
   * the columns are NOT NULL and the UI prints them. `reportedAt` is the seed
   * run's own date: these are Tech Epitome's current editorial judgements, and
   * dating them is how they become reviewable rather than permanent.
   */
  async function seedPrepTracks() {
    const reportedAt = new Date();
    let problemLinks = 0;
    let designLinks = 0;

    for (const track of PREP_TRACKS) {
      const payload = {
        name: track.name,
        blurb: track.blurb,
        status: "PUBLISHED" as const,
        order: track.order,
        interviewStages: track.interviewStages as object,
        focusAreas: track.focusAreas,
        roadmap: track.roadmap as object,
      };

      const row = await prisma.prepTrack.upsert({
        where: { slug: track.slug },
        create: { slug: track.slug, ...payload },
        update: payload,
        select: { id: true },
      });

      for (const entry of track.problems) {
        const problem = await prisma.problem.findUnique({
          where: { slug: entry.slug },
          select: { id: true },
        });
        // A track referencing a problem that does not exist is a content
        // bug, and a silent skip would hide it.
        if (!problem) {
          throw new Error(
            `Prep track ${track.slug} references unknown problem ${entry.slug}`
          );
        }

        const link = {
          source: PREP_SOURCE,
          sourceUrl: null,
          reportedAt,
          confidence: entry.confidence,
          rationale: entry.rationale,
        };
        await prisma.prepTrackProblem.upsert({
          where: { trackId_problemId: { trackId: row.id, problemId: problem.id } },
          create: { trackId: row.id, problemId: problem.id, ...link },
          update: link,
        });
        problemLinks += 1;
      }

      for (const entry of track.systemDesign) {
        const design = await prisma.systemDesignProblem.findUnique({
          where: { slug: entry.slug },
          select: { id: true },
        });
        if (!design) {
          throw new Error(
            `Prep track ${track.slug} references unknown design exercise ${entry.slug}`
          );
        }

        const link = {
          source: PREP_SOURCE,
          sourceUrl: null,
          reportedAt,
          confidence: entry.confidence,
          rationale: entry.rationale,
        };
        await prisma.prepTrackSystemDesignTopic.upsert({
          where: {
            trackId_systemDesignProblemId: {
              trackId: row.id,
              systemDesignProblemId: design.id,
            },
          },
          create: {
            trackId: row.id,
            systemDesignProblemId: design.id,
            ...link,
          },
          update: link,
        });
        designLinks += 1;
      }
    }

    console.log(
      `  prep tracks    ${PREP_TRACKS.length} (${problemLinks} problems, ${designLinks} design)`
    );
  }

  console.log("Seeding Tech Epitome…");

  // The admin and demo accounts have public default passwords, so they never
  // reach production; the first admin is promoted by hand.
  if (process.env.NODE_ENV === "production") {
    console.log("  users          skipped (production)");
  } else {
    await seedUsers();
  }
  await seedAchievements();

  const patternIds = await seedPatterns();
  const topicIds = await seedTopics();
  const problemIds = await seedProblems(patternIds, topicIds);
  const chapterIds = await seedCourse(DSA_COURSE, "DSA", 0, patternIds, problemIds);
  await seedCourse(SYSTEM_DESIGN_COURSE, "SYSTEM_DESIGN", 10, patternIds, problemIds);
  await seedCourse(LLD_COURSE, "LLD", 20, patternIds, problemIds);
  await seedQuizzes(chapterIds);
  await seedSystemDesignExercises();
  await seedLLDExercises();
  await seedBehavioral();
  await seedPrepTracks();
  await seedAptitude();

  console.log("Seed complete.");
}

main()
  .catch((error) => {
    console.error("Seed failed:");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
