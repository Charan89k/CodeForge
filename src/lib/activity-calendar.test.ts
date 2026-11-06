import { describe, expect, it } from "vitest";

import {
  ACTIVITY_WEEKS,
  activityLevel,
  buildActivityCalendar,
  firstActivityDay,
} from "./activity-calendar";

const NOW = new Date("2026-11-04T23:30:00Z"); // A Wednesday.
const counts = { seconds: 0, solved: 0, chapters: 0 };

describe("activityLevel", () => {
  it.each([
    [{ ...counts }, 0],
    [{ ...counts, seconds: 60 }, 1],
    [{ ...counts, solved: 1 }, 2],
    [{ ...counts, chapters: 1 }, 2],
    [{ ...counts, solved: 1, chapters: 1 }, 3],
    [{ ...counts, solved: 3 }, 3],
    [{ ...counts, solved: 2, chapters: 2 }, 4],
  ])("scores %o as %i", (input, level) => {
    expect(activityLevel(input)).toBe(level);
  });
});

describe("buildActivityCalendar", () => {
  it("starts on a Monday and stops at today", () => {
    const { weeks } = buildActivityCalendar([], NOW);

    expect(weeks).toHaveLength(ACTIVITY_WEEKS);
    expect(weeks[0]![0]!.day.getUTCDay()).toBe(1);
    expect(weeks[0]).toHaveLength(7);
    expect(weeks.at(-1)).toHaveLength(3);
    expect(weeks.at(-1)!.at(-1)!.day.toISOString()).toBe("2026-11-04T00:00:00.000Z");
  });

  it("has a full last week on a Sunday", () => {
    const { weeks } = buildActivityCalendar([], new Date("2026-11-08T12:00:00Z"));

    expect(weeks.at(-1)).toHaveLength(7);
  });

  it("reports nothing when there is no activity", () => {
    const calendar = buildActivityCalendar([], NOW);

    expect(calendar).toMatchObject({ activeDays: 0, solved: 0, chapters: 0 });
    expect(calendar.weeks.flat().every((cell) => cell.level === 0)).toBe(true);
  });

  it("places rows on their day and totals them", () => {
    const calendar = buildActivityCalendar(
      [
        { day: new Date("2026-11-02T00:00:00Z"), seconds: 90, solved: 1, chapters: 1 },
        { day: new Date("2026-10-20T00:00:00Z"), seconds: 30, solved: 0, chapters: 0 },
      ],
      NOW
    );

    const monday = calendar.weeks.at(-1)![0]!;
    expect(monday).toMatchObject({ seconds: 90, solved: 1, chapters: 1, level: 3 });
    expect(calendar).toMatchObject({ activeDays: 2, solved: 1, chapters: 1 });
  });

  it("does not count rows outside the window", () => {
    const before = new Date(firstActivityDay(NOW).getTime() - 86_400_000);

    const calendar = buildActivityCalendar(
      [{ day: before, seconds: 90, solved: 5, chapters: 5 }],
      NOW
    );

    expect(calendar).toMatchObject({ activeDays: 0, solved: 0, chapters: 0 });
  });
});
