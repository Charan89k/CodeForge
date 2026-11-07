import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { Difficulty } from "@/generated/prisma/enums";

import { DATABASE_FOUNDATIONS } from "./database-foundations";
import { PROGRAMMING_FOUNDATIONS } from "./programming-foundations";

/**
 * Courses written for Tech Epitome and published through the CMS, by
 * `npm run courses:author`. Nothing here is seeded straight onto the chapter
 * tables: each lesson travels draft, review, publish like any other edit.
 *
 * A lesson's words live in `<course>/<lesson>.md`, in the CMS's Markdown
 * dialect. The checks in courses.integration.test.ts run every example, so the
 * outputs printed in a lesson are known to be what the code really does.
 */
export type QuizQuestionSource = {
  type: "MULTIPLE_CHOICE" | "TRUE_FALSE" | "CODE_OUTPUT";
  prompt: string;
  code?: string;
  options: { id: string; text: string }[];
  answer: string;
  explanation: string;
};

export type LessonSource = {
  slug: string;
  title: string;
  summary: string;
  difficulty: Difficulty;
  objectives: string[];
  keyTakeaways: string[];
  questions: QuizQuestionSource[];
};

export type SectionSource = {
  slug: string;
  title: string;
  summary: string;
  lessons: LessonSource[];
};

export type CourseSource = {
  slug: string;
  /** Prefix for quiz slugs, so a lesson's check is `<prefix>-<lesson>`. */
  quizPrefix: string;
  title: string;
  subtitle: string;
  description: string;
  category: string;
  level: "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
  outcomes: string[];
  prerequisites: string[];
  sections: SectionSource[];
};

export const AUTHORED_COURSES: CourseSource[] = [
  PROGRAMMING_FOUNDATIONS,
  DATABASE_FOUNDATIONS,
];

export const lessonPath = (course: CourseSource, lesson: LessonSource) =>
  join(process.cwd(), "src/data/courses", course.slug, `${lesson.slug}.md`);

export const lessonMarkdown = (course: CourseSource, lesson: LessonSource) =>
  readFileSync(lessonPath(course, lesson), "utf8");

export const quizSlug = (course: CourseSource, lesson: LessonSource) =>
  `${course.quizPrefix}-${lesson.slug}`;

const WORDS_PER_MINUTE = 180;
/** Working the "Try it" and the knowledge check, beyond reading the words. */
const PRACTICE_MINUTES = 5;

/** Reading time from the lesson's real length, including its code. */
export function lessonMinutes(markdown: string): number {
  const words = markdown.split(/\s+/).filter(Boolean).length;
  return Math.ceil(words / WORDS_PER_MINUTE) + PRACTICE_MINUTES;
}

export function courseHours(course: CourseSource): number {
  const minutes = course.sections
    .flatMap((section) => section.lessons)
    .reduce((sum, lesson) => sum + lessonMinutes(lessonMarkdown(course, lesson)), 0);
  return Math.ceil(minutes / 60);
}
