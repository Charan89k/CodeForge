import { Suspense } from "react";
import type { Metadata } from "next";
import { Search } from "lucide-react";

import { PageHeader } from "@/components/common/page-header";
import { FilterDrawer } from "@/components/learning/library/filter-drawer";
import { ActiveFilters, FilterPanel } from "@/components/learning/library/filter-panel";
import {
  LibraryResults,
  ResultsSkeleton,
} from "@/components/learning/library/library-results";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getCurrentUser } from "@/lib/auth/session";
import {
  activeFilterCount,
  libraryHref,
  librarySearchParams,
  parseLibraryQuery,
} from "@/lib/catalogue/filters";
import { listSubjects } from "@/services/catalogue";

export const metadata: Metadata = {
  title: "Courses",
  description:
    "The Tech Epitome library: programming, databases, DSA, system design and low-level design, searchable by course and by chapter.",
  alternates: { canonical: "/learn" },
};

/**
 * The library. Filter state lives in the URL and the work happens on the
 * server, so a link reproduces a view exactly and the catalogue itself never
 * travels to the browser. Only published content is reachable from here.
 */
export default async function LibraryPage({ searchParams }: PageProps<"/learn">) {
  const user = await getCurrentUser();
  const query = parseLibraryQuery(await searchParams, Boolean(user));
  const subjects = await listSubjects();

  // Searching keeps the filters and sort; they travel as hidden fields.
  const kept = [...librarySearchParams({ ...query, q: "", page: 1 }).entries()];

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <PageHeader
        title="Courses"
        description="Written to be read start to finish, or searched when you need one idea. Your progress is saved as you mark chapters complete."
      />

      <form role="search" action="/learn" className="mt-6 flex items-end gap-2">
        {kept.map(([name, value], index) => (
          <input key={`${name}-${index}`} type="hidden" name={name} value={value} />
        ))}
        <div className="min-w-0 flex-1">
          <label htmlFor="library-q" className="sr-only">
            Search courses and chapters
          </label>
          <Input
            key={query.q}
            id="library-q"
            name="q"
            type="search"
            defaultValue={query.q}
            maxLength={100}
            placeholder="Search courses and chapters"
            className="h-11"
          />
        </div>
        <Button type="submit" className="h-11">
          <Search aria-hidden="true" />
          Search
        </Button>
      </form>

      <div className="mt-6 gap-10 lg:grid lg:grid-cols-[13rem_minmax(0,1fr)]">
        <aside aria-label="Filters">
          <FilterDrawer activeCount={activeFilterCount(query)}>
            <FilterPanel query={query} subjects={subjects} signedIn={Boolean(user)} />
          </FilterDrawer>
        </aside>
        <div className="mt-6 min-w-0 lg:mt-0">
          <ActiveFilters query={query} />
          <Suspense
            key={libraryHref(query, { page: query.page })}
            fallback={<ResultsSkeleton />}
          >
            <LibraryResults query={query} userId={user?.id} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
