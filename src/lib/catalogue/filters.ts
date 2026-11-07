import type { CourseLevel, Difficulty } from "@/generated/prisma/enums";

/**
 * The library's filter state, which lives entirely in the URL.
 *
 * Everything from the URL is untrusted: unknown values are dropped rather than
 * reported, so a stale or edited link still shows a sensible page.
 */

export const LEVELS = [
  "BEGINNER",
  "INTERMEDIATE",
  "ADVANCED",
] as const satisfies readonly CourseLevel[];
export const DIFFICULTIES = [
  "EASY",
  "MEDIUM",
  "HARD",
] as const satisfies readonly Difficulty[];
export const LENGTHS = ["short", "medium", "long"] as const;
export const STATUSES = ["NOT_STARTED", "IN_PROGRESS", "COMPLETED"] as const;
export const SORTS = ["best", "updated", "title", "shortest", "easiest"] as const;
export const VIEWS = ["courses", "chapters"] as const;

export type LibraryLength = (typeof LENGTHS)[number];
export type LibraryStatus = (typeof STATUSES)[number];
export type LibrarySort = (typeof SORTS)[number];
export type LibraryView = (typeof VIEWS)[number];

export const LEVEL_LABELS: Record<CourseLevel, string> = {
  BEGINNER: "Beginner",
  INTERMEDIATE: "Intermediate",
  ADVANCED: "Advanced",
};
export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  EASY: "Easy",
  MEDIUM: "Medium",
  HARD: "Hard",
};
export const LENGTH_LABELS: Record<LibraryLength, string> = {
  short: "Under 5 hours",
  medium: "5 to 12 hours",
  long: "Over 12 hours",
};
export const STATUS_LABELS: Record<LibraryStatus, string> = {
  NOT_STARTED: "Not started",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
};
export const SORT_LABELS: Record<LibrarySort, string> = {
  best: "Recommended",
  updated: "Recently updated",
  title: "A to Z",
  shortest: "Shortest",
  easiest: "Easiest first",
};

export type LibraryQuery = {
  view: LibraryView;
  q: string;
  subject: string[];
  level: CourseLevel[];
  difficulty: Difficulty[];
  length: LibraryLength[];
  status: LibraryStatus[];
  sort: LibrarySort;
  page: number;
};

export type LibraryFilterKey = "subject" | "level" | "difficulty" | "length" | "status";

const MAX_SEARCH = 100;
const MAX_SUBJECT = 60;
const MAX_SUBJECTS = 10;

type RawParams = Record<string, string | string[] | undefined>;

const all = (value: string | string[] | undefined) =>
  value === undefined ? [] : Array.isArray(value) ? value : [value];

function allowed<T extends string>(
  value: string | string[] | undefined,
  known: readonly T[]
) {
  const values = new Set(all(value));
  return known.filter((option) => values.has(option));
}

export function parseLibraryQuery(params: RawParams, signedIn: boolean): LibraryQuery {
  const page = Number.parseInt(all(params.page)[0] ?? "1", 10);
  const subject = [
    ...new Set(all(params.subject).map((s) => s.trim().slice(0, MAX_SUBJECT))),
  ].filter(Boolean);
  return {
    view: allowed(params.view, VIEWS)[0] ?? "courses",
    q: (all(params.q)[0] ?? "").trim().slice(0, MAX_SEARCH),
    subject: subject.slice(0, MAX_SUBJECTS),
    level: allowed(params.level, LEVELS),
    difficulty: allowed(params.difficulty, DIFFICULTIES),
    length: allowed(params.length, LENGTHS),
    // Progress belongs to an account, so without one this filter means nothing.
    status: signedIn ? allowed(params.status, STATUSES) : [],
    sort: allowed(params.sort, SORTS)[0] ?? "best",
    page: Number.isSafeInteger(page) && page > 0 ? page : 1,
  };
}

/** The query string for a state, leaving out defaults so links stay short. */
export function librarySearchParams(query: LibraryQuery): URLSearchParams {
  const params = new URLSearchParams();
  if (query.view !== "courses") params.set("view", query.view);
  if (query.q) params.set("q", query.q);
  for (const key of ["subject", "level", "difficulty", "length", "status"] as const) {
    for (const value of query[key]) params.append(key, value);
  }
  if (query.sort !== "best") params.set("sort", query.sort);
  if (query.page > 1) params.set("page", String(query.page));
  return params;
}

/** A link to `query` with `change` applied. Any change returns to page one. */
export function libraryHref(
  query: LibraryQuery,
  change: Partial<LibraryQuery> = {}
): string {
  const search = librarySearchParams({ ...query, page: 1, ...change }).toString();
  return search ? `/learn?${search}` : "/learn";
}

/** A link that adds `value` to a filter, or removes it if it is already on. */
export function toggleFilterHref(
  query: LibraryQuery,
  key: LibraryFilterKey,
  value: string
): string {
  const current: string[] = query[key];
  const next = current.includes(value)
    ? current.filter((v) => v !== value)
    : [...current, value];
  return libraryHref(query, { [key]: next });
}

export function activeFilterCount(query: LibraryQuery): number {
  return (
    query.subject.length +
    query.level.length +
    query.difficulty.length +
    query.length.length +
    query.status.length
  );
}

/** What "clear all" keeps: which list you are on, and nothing else. */
export const clearedHref = (query: LibraryQuery) =>
  query.view === "courses" ? "/learn" : "/learn?view=chapters";
