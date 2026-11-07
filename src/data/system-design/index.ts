import type { CourseSeed } from "@/data/curriculum/types";
import { DISTRIBUTED, INFRASTRUCTURE, PATTERNS } from "./distributed-infra";
import { FOUNDATIONS } from "./foundations";
import { DATA, NETWORKING } from "./networking-data";
import { SD_RELIABILITY_CASE_SECTIONS } from "./reliability-cases";
import { SD_STORAGE_SCALING_SECTIONS } from "./storage-scaling";

/**
 * The System Design track.
 *
 * Ordered so each section can only use vocabulary the previous ones
 * established: you cannot discuss replication lag before latency, or CAP
 * before replication, or service boundaries before the cost of a network
 * call. That constraint is what stops a system-design course from becoming
 * a glossary.
 *
 * Reuses the Course/Section/Chapter models unchanged — `Track` has had
 * SYSTEM_DESIGN since Phase 1 and `listCourses` has always taken a track,
 * so this needed no schema change and no second reader.
 */
export const SYSTEM_DESIGN_COURSE: CourseSeed = {
  slug: "system-design-foundations",
  title: "System Design",
  subtitle: "Reason about systems you cannot hold in your head",
  description:
    "Large systems are not built out of clever code. They are built out of a small number of components arranged to make specific trade-offs, and the skill is being able to say which trade-off you are making and why. This track builds the vocabulary first, then the components, then the arrangements — and every lesson's diagram is data you can read as text, not a picture.",
  icon: "Network",
  category: "System Design",
  estimatedHours: 12,
  sections: [
    FOUNDATIONS,
    NETWORKING,
    DATA,
    DISTRIBUTED,
    INFRASTRUCTURE,
    PATTERNS,
    // Appended, never interleaved: section order comes from position.
    ...SD_STORAGE_SCALING_SECTIONS,
    ...SD_RELIABILITY_CASE_SECTIONS,
  ],
};
