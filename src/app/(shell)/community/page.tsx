import type { Metadata } from "next";
import Link from "next/link";
import { MessagesSquare } from "lucide-react";

import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getCurrentUser } from "@/lib/auth/session";
import { cn, route } from "@/lib/utils";
import {
  SORTS,
  listCategories,
  listThreads,
  type ThreadSort,
} from "@/services/community";

export const metadata: Metadata = {
  title: "Community",
  description: "Ask questions and talk through problems with other learners.",
};

const SORT_LABEL: Record<ThreadSort, string> = {
  active: "Active",
  new: "New",
  top: "Top",
  unanswered: "Unanswered",
};

const one = (value: string | string[] | undefined) =>
  typeof value === "string" ? value : undefined;

export default async function CommunityPage({ searchParams }: PageProps<"/community">) {
  const params = await searchParams;
  const sort = SORTS.find((s) => s === one(params.sort)) ?? "active";
  const category = one(params.category);
  const q = one(params.q)?.slice(0, 100);
  const page = Number(one(params.page) ?? 1);

  const user = await getCurrentUser();
  const [categories, result] = await Promise.all([
    listCategories(),
    listThreads({ category, sort, q, page }, user),
  ]);
  const current = categories.find((c) => c.slug === category);
  const href = (change: Record<string, string | number | undefined>) => {
    const next = new URLSearchParams();
    const merged = { category, sort, q, ...change };
    for (const [key, value] of Object.entries(merged)) {
      if (
        value !== undefined &&
        value !== "" &&
        !(key === "sort" && value === "active")
      ) {
        next.set(key, String(value));
      }
    }
    const query = next.toString();
    return route(query ? `/community?${query}` : "/community");
  };

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
      <PageHeader
        title={current?.name ?? "Community"}
        description={
          current?.description ??
          "Ask about an approach, compare designs, or help someone stuck where you were. Posts show your username only."
        }
        actions={
          <Button asChild>
            <Link
              href={route(
                category ? `/community/new?category=${category}` : "/community/new"
              )}
            >
              Start a thread
            </Link>
          </Button>
        }
      />

      <div className="mt-6 grid gap-6 lg:grid-cols-[13rem_1fr]">
        {/* min-w-0: a grid item otherwise grows to its scrolling row and widens the page. */}
        <nav aria-label="Categories" className="min-w-0 text-sm">
          <ul className="flex gap-1 overflow-x-auto lg:flex-col">
            <li>
              <Link
                href={href({ category: undefined, page: undefined })}
                aria-current={!category ? "page" : undefined}
                className={cn(
                  "block shrink-0 rounded-md px-3 py-1.5 hover:bg-muted",
                  !category && "bg-muted font-medium"
                )}
              >
                Everything
              </Link>
            </li>
            {categories.map((c) => (
              <li key={c.id}>
                <Link
                  href={href({ category: c.slug, page: undefined })}
                  aria-current={category === c.slug ? "page" : undefined}
                  className={cn(
                    "flex shrink-0 items-center justify-between gap-2 rounded-md px-3 py-1.5 hover:bg-muted",
                    category === c.slug && "bg-muted font-medium"
                  )}
                >
                  <span className="whitespace-nowrap lg:whitespace-normal">
                    {c.name}
                  </span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {c._count.threads}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <section aria-labelledby="threads-heading" className="min-w-0">
          <h2 id="threads-heading" className="sr-only">
            Threads
          </h2>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <nav
              aria-label="Sort threads"
              className="flex gap-1 overflow-x-auto text-sm"
            >
              {SORTS.map((s) => (
                <Link
                  key={s}
                  href={href({ sort: s, page: undefined })}
                  aria-current={sort === s ? "page" : undefined}
                  className={cn(
                    "shrink-0 rounded-md px-3 py-1.5 hover:bg-muted",
                    sort === s && "bg-muted font-medium"
                  )}
                >
                  {SORT_LABEL[s]}
                </Link>
              ))}
            </nav>
            <form role="search" action="/community" className="flex gap-2">
              {category && <input type="hidden" name="category" value={category} />}
              {sort !== "active" && <input type="hidden" name="sort" value={sort} />}
              <label htmlFor="community-search" className="sr-only">
                Search thread titles
              </label>
              <Input
                id="community-search"
                name="q"
                type="search"
                defaultValue={q}
                placeholder="Search titles"
                className="h-9 w-full sm:w-56"
                maxLength={100}
              />
              <Button type="submit" size="sm" variant="outline">
                Search
              </Button>
            </form>
          </div>

          {result.threads.length === 0 ? (
            <div className="mt-6">
              <EmptyState
                icon={MessagesSquare}
                title={q ? "No threads match that search" : "Nothing here yet"}
                description={
                  q
                    ? "Try fewer words, or look in every category."
                    : "Be the first to start a thread in this category."
                }
                action={
                  q ? (
                    <Button asChild size="sm" variant="outline">
                      <Link href={href({ q: undefined, page: undefined })}>
                        Clear the search
                      </Link>
                    </Button>
                  ) : undefined
                }
              />
            </div>
          ) : (
            <ul className="mt-4 divide-y divide-border border-y border-border">
              {result.threads.map((t) => (
                <li key={t.id} className="flex gap-4 py-3">
                  <div className="w-14 shrink-0 text-center font-mono text-xs text-muted-foreground">
                    <div className="text-base text-foreground">{t.voteCount}</div>
                    votes
                  </div>
                  <div className="min-w-0 flex-1">
                    <Link
                      href={route(`/community/t/${t.id}`)}
                      className="font-medium break-words text-info hover:text-brand-300"
                    >
                      {t.title}
                    </Link>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                      {t.kind === "QUESTION" && (
                        <Badge variant={t.acceptedPostId ? "default" : "outline"}>
                          {t.acceptedPostId ? "Answered" : "Question"}
                        </Badge>
                      )}
                      {t.locked && <Badge variant="outline">Locked</Badge>}
                      <span>{t.category.name}</span>
                      <span aria-hidden="true">·</span>
                      <span>{t.authorName}</span>
                      <span aria-hidden="true">·</span>
                      <span>
                        {t.replyCount} {t.replyCount === 1 ? "reply" : "replies"}
                      </span>
                      <span aria-hidden="true">·</span>
                      <time dateTime={t.lastActivityAt.toISOString()}>
                        {t.lastActivityAt.toISOString().slice(0, 10)}
                      </time>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {(result.page > 1 || result.hasMore) && (
            <nav aria-label="Pages" className="mt-4 flex justify-between text-sm">
              {result.page > 1 ? (
                <Link href={href({ page: result.page - 1 })} className="text-info">
                  Previous page
                </Link>
              ) : (
                <span />
              )}
              {result.hasMore && (
                <Link href={href({ page: result.page + 1 })} className="text-info">
                  Next page
                </Link>
              )}
            </nav>
          )}
        </section>
      </div>
    </div>
  );
}
