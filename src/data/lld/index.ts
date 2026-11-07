import type { CourseSeed } from "@/data/curriculum/types";
import { LLD_FOUNDATIONS, LLD_OOP } from "./foundations";
import { LLD_PATTERNS, LLD_PRINCIPLES, LLD_SOLID } from "./solid-patterns";
import { LLD_WORKFLOW } from "./workflow";
import { LLD_MORE_SECTIONS } from "./concurrency-cases";

/**
 * The Low-Level Design track.
 *
 * Ordered so no section uses an idea an earlier one has not established:
 * responsibility and coupling first, because SOLID is those two wearing
 * hats; composition before patterns, because most patterns are
 * composition applied to a recurring problem; and the workflow last,
 * because it is the procedure that ties the rest together.
 *
 * Reuses Course/Section/Chapter unchanged — `Track` has had LLD since
 * Phase 1 and the reader became track-generic in Phase 7, so this needed
 * no schema change and no second reader.
 */
export const LLD_COURSE: CourseSeed = {
  slug: "low-level-design",
  title: "Low-Level Design",
  subtitle: "Decide what each class is the only thing that knows",
  description:
    "Low-level design is the layer between 'which services exist' and 'which line runs': what types live inside one service, what each is responsible for, and how they reach each other. This track builds the vocabulary — responsibility, coupling, cohesion — then SOLID as special cases of it, then the patterns that are recurring answers to recurring problems. Every pattern is taught with the situation where it is the wrong choice.",
  icon: "Boxes",
  category: "Software Design",
  estimatedHours: 10,
  sections: [
    LLD_FOUNDATIONS,
    LLD_OOP,
    LLD_SOLID,
    LLD_PRINCIPLES,
    LLD_PATTERNS,
    LLD_WORKFLOW,
    // Appended, never interleaved: section order comes from position.
    ...LLD_MORE_SECTIONS,
  ],
};
