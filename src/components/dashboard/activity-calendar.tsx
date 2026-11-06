import { Panel } from "@/components/dashboard/panel";
import type { ActivityCalendar, ActivityLevel } from "@/lib/activity-calendar";
import { cn } from "@/lib/utils";

const LEVEL_CLASS: Record<ActivityLevel, string> = {
  0: "bg-muted",
  1: "bg-brand-500/25",
  2: "bg-brand-500/50",
  3: "bg-brand-500/75",
  4: "bg-brand-500",
};

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

function describeDay(cell: ActivityCalendar["weeks"][number][number]): string {
  const date = cell.day.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
  if (cell.level === 0) return `${date}: no activity`;
  const minutes = Math.round(cell.seconds / 60);
  return `${date}: ${plural(cell.solved, "problem")} solved, ${plural(cell.chapters, "chapter")} completed, ${minutes} min`;
}

/**
 * Newest weeks at the right. On a narrow screen the oldest are clipped rather
 * than scrolled, because the recent ones are the point. The totals above it
 * carry the same facts in text, since colour alone would hide them.
 */
export function ActivityCalendarPanel({ calendar }: { calendar: ActivityCalendar }) {
  const summary = `${plural(calendar.activeDays, "active day")}, ${plural(calendar.solved, "problem")} solved, ${plural(calendar.chapters, "chapter")} completed in the last year`;

  return (
    <Panel
      title="Your year"
      description={
        calendar.activeDays === 0
          ? "Nothing recorded yet. Finish a chapter or solve a problem and it shows here."
          : `${summary}.`
      }
      bodyClassName="p-4 sm:px-5"
    >
      <div
        role="img"
        aria-label={summary}
        className="flex justify-end gap-[3px] overflow-hidden"
      >
        {calendar.weeks.map((week) => (
          <div
            key={week[0]?.day.toISOString()}
            className="grid shrink-0 grid-rows-7 gap-[3px] self-start"
          >
            {week.map((cell) => (
              <span
                key={cell.day.toISOString()}
                title={describeDay(cell)}
                data-level={cell.level}
                className={cn(
                  "size-[11px] rounded-[2px] xl:size-4",
                  LEVEL_CLASS[cell.level]
                )}
              />
            ))}
          </div>
        ))}
      </div>
      <div
        aria-hidden="true"
        className="mt-3 flex items-center justify-end gap-[3px] text-xs text-muted-foreground"
      >
        <span className="mr-1">Less</span>
        {([0, 1, 2, 3, 4] as const).map((level) => (
          <span
            key={level}
            className={cn("size-[11px] rounded-[2px] xl:size-4", LEVEL_CLASS[level])}
          />
        ))}
        <span className="ml-1">More</span>
      </div>
      <p className="mt-2 text-xs text-muted-foreground/80">
        Days are UTC. Darker means more problems solved and chapters completed that day.
      </p>
    </Panel>
  );
}
