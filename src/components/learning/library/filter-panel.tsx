import Link from "next/link";
import { Check, X } from "lucide-react";

import {
  activeFilterCount,
  clearedHref,
  DIFFICULTIES,
  DIFFICULTY_LABELS,
  LENGTH_LABELS,
  LENGTHS,
  LEVEL_LABELS,
  LEVELS,
  libraryHref,
  STATUS_LABELS,
  STATUSES,
  toggleFilterHref,
  type LibraryFilterKey,
  type LibraryQuery,
} from "@/lib/catalogue/filters";
import { cn, route } from "@/lib/utils";

/**
 * Every filter is a link to the state it produces. That makes filtering work
 * before hydration, keeps the back button honest, and sends nothing to the
 * server until someone chooses. `prefetch={false}` matters: a panel of links
 * would otherwise request every combination it can see.
 */
function FilterGroup({
  title,
  query,
  filter,
  options,
}: {
  title: string;
  query: LibraryQuery;
  filter: LibraryFilterKey;
  options: { value: string; label: string }[];
}) {
  const current: string[] = query[filter];
  return (
    <section aria-label={title}>
      <h3 className="font-mono text-[11px] tracking-wider text-subtle-foreground uppercase">
        {title}
      </h3>
      <ul className="mt-1.5">
        {options.map(({ value, label }) => {
          const on = current.includes(value);
          return (
            <li key={value}>
              <Link
                prefetch={false}
                scroll={false}
                href={route(toggleFilterHref(query, filter, value))}
                aria-current={on ? "true" : undefined}
                className={cn(
                  "flex min-h-11 items-center gap-2.5 rounded-sm text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50 lg:min-h-8",
                  on
                    ? "font-medium text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "grid size-4 shrink-0 place-items-center rounded-[3px] border",
                    on
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-input"
                  )}
                >
                  {on && <Check className="size-3" strokeWidth={3} />}
                </span>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function FilterPanel({
  query,
  subjects,
  signedIn,
}: {
  query: LibraryQuery;
  subjects: string[];
  signedIn: boolean;
}) {
  // A value from an old link stays listed so it can still be switched off.
  const subjectOptions = [...new Set([...subjects, ...query.subject])].map((value) => ({
    value,
    label: value,
  }));
  const labelled = <T extends string>(
    values: readonly T[],
    labels: Record<T, string>
  ) => values.map((value) => ({ value, label: labels[value] }));

  return (
    <div className="space-y-6">
      {subjectOptions.length > 0 && (
        <FilterGroup
          title="Subject"
          query={query}
          filter="subject"
          options={subjectOptions}
        />
      )}
      <FilterGroup
        title="Level"
        query={query}
        filter="level"
        options={labelled(LEVELS, LEVEL_LABELS)}
      />
      <FilterGroup
        title="Chapter difficulty"
        query={query}
        filter="difficulty"
        options={labelled(DIFFICULTIES, DIFFICULTY_LABELS)}
      />
      <FilterGroup
        title="Course length"
        query={query}
        filter="length"
        options={labelled(LENGTHS, LENGTH_LABELS)}
      />
      {signedIn ? (
        <FilterGroup
          title="Your progress"
          query={query}
          filter="status"
          options={labelled(STATUSES, STATUS_LABELS)}
        />
      ) : (
        <p className="text-xs leading-relaxed text-muted-foreground">
          <Link
            href="/login"
            className="underline underline-offset-4 hover:text-foreground"
          >
            Sign in
          </Link>{" "}
          to filter by your progress.
        </p>
      )}
    </div>
  );
}

/** What is on right now, each removable by itself. Wraps rather than clips. */
export function ActiveFilters({ query }: { query: LibraryQuery }) {
  if (activeFilterCount(query) === 0 && !query.q) return null;

  const chips: { key: string; label: string; href: string }[] = [
    ...(query.q
      ? [{ key: "q", label: `"${query.q}"`, href: libraryHref(query, { q: "" }) }]
      : []),
    ...query.subject.map((value) => ({
      key: `subject-${value}`,
      label: value,
      href: toggleFilterHref(query, "subject", value),
    })),
    ...query.level.map((value) => ({
      key: value,
      label: LEVEL_LABELS[value],
      href: toggleFilterHref(query, "level", value),
    })),
    ...query.difficulty.map((value) => ({
      key: value,
      label: DIFFICULTY_LABELS[value],
      href: toggleFilterHref(query, "difficulty", value),
    })),
    ...query.length.map((value) => ({
      key: value,
      label: LENGTH_LABELS[value],
      href: toggleFilterHref(query, "length", value),
    })),
    ...query.status.map((value) => ({
      key: value,
      label: STATUS_LABELS[value],
      href: toggleFilterHref(query, "status", value),
    })),
  ];

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2" aria-label="Active filters">
      {chips.map((chip) => (
        <Link
          key={chip.key}
          prefetch={false}
          scroll={false}
          href={route(chip.href)}
          aria-label={`Remove filter ${chip.label}`}
          className="inline-flex min-h-9 max-w-full items-center gap-1.5 rounded-sm border border-border bg-card px-2.5 text-xs outline-none hover:border-brand-500/50 focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <span className="truncate">{chip.label}</span>
          <X className="size-3 shrink-0 text-muted-foreground" aria-hidden="true" />
        </Link>
      ))}
      <Link
        prefetch={false}
        scroll={false}
        href={route(clearedHref(query))}
        className="inline-flex min-h-9 items-center px-1 text-xs font-medium text-brand-300 underline-offset-4 hover:underline"
      >
        Clear all
      </Link>
    </div>
  );
}
