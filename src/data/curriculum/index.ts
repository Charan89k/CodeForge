import { ARRAYS_SECTION, STRINGS_SECTION } from "./arrays-strings";
import { COMPLEXITY_SECTION } from "./complexity";
import {
  LINKED_LISTS_SECTION,
  RECURSION_SECTION,
  STACKS_QUEUES_SECTION,
} from "./structures";
import {
  BINARY_SEARCH_SECTION,
  HASH_TABLES_SECTION,
  SLIDING_WINDOW_SECTION,
  TWO_POINTERS_SECTION,
} from "./techniques";
import type { CourseSeed } from "./types";

export * from "./types";

/**
 * The DSA course.
 *
 * Ordered by dependency rather than by topic popularity: complexity analysis
 * comes first because every later chapter argues in its terms, and the
 * technique sections come after the structures they operate on.
 *
 * Sections 11 onward (trees, heaps, graphs, dynamic programming and the rest)
 * are planned but not written. The roadmap page shows only what exists.
 */
export const DSA_COURSE: CourseSeed = {
  slug: "dsa-foundations",
  title: "DSA Foundations",
  subtitle: "Complexity, core structures, and the techniques that build on them",
  description:
    "The groundwork for everything else: how to reason about cost, the data structures worth knowing cold, and the handful of techniques that turn a quadratic idea into a linear one. Every chapter ends with the question an interviewer is really asking — what shape is this problem?",
  icon: "GraduationCap",
  category: "Data Structures & Algorithms",
  estimatedHours: 14,
  sections: [
    COMPLEXITY_SECTION,
    ARRAYS_SECTION,
    STRINGS_SECTION,
    HASH_TABLES_SECTION,
    TWO_POINTERS_SECTION,
    SLIDING_WINDOW_SECTION,
    BINARY_SEARCH_SECTION,
    LINKED_LISTS_SECTION,
    STACKS_QUEUES_SECTION,
    RECURSION_SECTION,
  ],
};
