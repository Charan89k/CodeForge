import type { Track } from "@/generated/prisma/enums";

/**
 * Tracks, and the URL segment each one lives under.
 *
 * Phase 2 shipped a single track and hard-coded `/learn/dsa` in a dozen
 * places. The curriculum *service* was always track-agnostic — `listCourses`
 * has taken a `Track` since the beginning — so adding System Design and LLD
 * is a routing problem, not a data problem.
 *
 * Every existing DSA URL is preserved exactly. This file is the one place
 * that knows a track's segment, so a fourth track is a row here rather than
 * another grep.
 */

export const TRACK_SEGMENTS = {
  DSA: "dsa",
  SYSTEM_DESIGN: "system-design",
  LLD: "lld",
  BEHAVIORAL: "behavioral",
  GENERAL: "courses",
} as const satisfies Record<Track, string>;

export type TrackSegment = (typeof TRACK_SEGMENTS)[Track];

const SEGMENT_TO_TRACK = Object.fromEntries(
  Object.entries(TRACK_SEGMENTS).map(([track, segment]) => [segment, track])
) as Record<string, Track>;

export function segmentForTrack(track: Track): TrackSegment {
  return TRACK_SEGMENTS[track];
}

/** Null for an unknown segment, so a bad URL 404s rather than throwing. */
export function trackForSegment(segment: string): Track | null {
  return SEGMENT_TO_TRACK[segment] ?? null;
}

/** Human labels, used in breadcrumbs and page headings. */
export const TRACK_LABELS: Record<Track, string> = {
  DSA: "DSA",
  SYSTEM_DESIGN: "System Design",
  LLD: "Low-Level Design",
  BEHAVIORAL: "Behavioral",
  GENERAL: "More courses",
};

/**
 * Tracks that have a `/learn/<segment>` reader.
 *
 * Behavioral is deliberately absent: it is prepared through STAR stories
 * and mock interviews, not by reading chapters, so a reader route for it
 * would be an empty promise.
 */
export const READER_TRACKS: Track[] = ["DSA", "SYSTEM_DESIGN", "LLD", "GENERAL"];

export function chapterHref(
  track: Track,
  courseSlug: string,
  sectionSlug: string,
  chapterSlug: string
): string {
  return `/learn/${segmentForTrack(track)}/${courseSlug}/${sectionSlug}/${chapterSlug}`;
}

export function courseHref(track: Track, courseSlug: string): string {
  return `/learn/${segmentForTrack(track)}/${courseSlug}`;
}

export function trackHref(track: Track): string {
  return `/learn/${segmentForTrack(track)}`;
}
