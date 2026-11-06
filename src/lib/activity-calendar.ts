import { addDays, utcDayStart } from "@/lib/dates";

/**
 * The learner's year as a grid of UTC days, from `StudyDay` rows.
 *
 * Pure so the definitions below can be tested, and so the page and any later
 * surface cannot disagree about what counts.
 */

export const ACTIVITY_WEEKS = 53;

export type StudyDayCounts = {
  day: Date;
  seconds: number;
  solved: number;
  chapters: number;
};

export type ActivityLevel = 0 | 1 | 2 | 3 | 4;

export type ActivityCell = StudyDayCounts & { level: ActivityLevel };

export type ActivityCalendar = {
  /** Oldest first. Each week runs Monday to Sunday; the last stops at today. */
  weeks: ActivityCell[][];
  activeDays: number;
  solved: number;
  chapters: number;
};

/**
 * 0 is no recorded activity. 1 is studying with nothing finished. Above that,
 * the level follows the problems solved plus chapters completed that day.
 */
export function activityLevel(counts: Omit<StudyDayCounts, "day">): ActivityLevel {
  const finished = counts.solved + counts.chapters;
  if (finished >= 4) return 4;
  if (finished >= 2) return 3;
  if (finished === 1) return 2;
  return counts.seconds > 0 ? 1 : 0;
}

export function firstActivityDay(now: Date): Date {
  const today = utcDayStart(now);
  const sinceMonday = (today.getUTCDay() + 6) % 7;
  return addDays(today, -sinceMonday - (ACTIVITY_WEEKS - 1) * 7);
}

export function buildActivityCalendar(
  rows: readonly StudyDayCounts[],
  now: Date
): ActivityCalendar {
  const byDay = new Map(rows.map((row) => [utcDayStart(row.day).getTime(), row]));
  const today = utcDayStart(now).getTime();
  const first = firstActivityDay(now);

  const weeks: ActivityCell[][] = [];
  let activeDays = 0;
  let solved = 0;
  let chapters = 0;

  for (let week = 0; week < ACTIVITY_WEEKS; week++) {
    const cells: ActivityCell[] = [];
    for (let weekday = 0; weekday < 7; weekday++) {
      const day = addDays(first, week * 7 + weekday);
      if (day.getTime() > today) break;

      const row = byDay.get(day.getTime());
      const counts = {
        seconds: row?.seconds ?? 0,
        solved: row?.solved ?? 0,
        chapters: row?.chapters ?? 0,
      };
      const level = activityLevel(counts);
      if (level > 0) activeDays += 1;
      solved += counts.solved;
      chapters += counts.chapters;
      cells.push({ day, ...counts, level });
    }
    weeks.push(cells);
  }

  return { weeks, activeDays, solved, chapters };
}
