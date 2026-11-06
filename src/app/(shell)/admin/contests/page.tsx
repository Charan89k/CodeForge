import type { Metadata } from "next";
import Link from "next/link";

import { SectionHeading } from "@/components/common/section-heading";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { requireAdmin } from "@/lib/auth/session";
import { route } from "@/lib/utils";
import { contestPhase, listContests } from "@/services/contests";

import { cancelContestAction, createContestAction } from "./actions";

export const metadata: Metadata = { title: "Contests" };

const MESSAGES: Record<string, string> = {
  created: "Contest created.",
  cancelled: "Contest cancelled.",
  started: "That contest has started, so it can no longer be cancelled.",
  missing: "That contest no longer exists.",
  invalid:
    "Check the fields: dates must be in order, with 1 to 12 different problem numbers.",
  slug_taken: "That slug is taken.",
  unknown_problem: "One of those problem numbers is not a published problem.",
};

const field = "text-sm font-medium";

export default async function AdminContestsPage({
  searchParams,
}: PageProps<"/admin/contests">) {
  await requireAdmin();
  const { msg } = await searchParams;
  const message = typeof msg === "string" ? MESSAGES[msg] : undefined;
  const contests = await listContests();
  const now = new Date();

  return (
    <div className="space-y-8 text-sm">
      {message && (
        <p role="status" className="rounded-md border border-border p-3">
          {message}
        </p>
      )}
      <section aria-labelledby="new-contest">
        <SectionHeading
          id="new-contest"
          title="New contest"
          description="Times are UTC."
        />
        <form
          action={createContestAction}
          className="mt-3 grid max-w-2xl gap-3 sm:grid-cols-2"
        >
          <div>
            <label htmlFor="c-title" className={field}>
              Title
            </label>
            <Input
              id="c-title"
              name="title"
              required
              maxLength={120}
              className="mt-1"
            />
          </div>
          <div>
            <label htmlFor="c-slug" className={field}>
              Slug
            </label>
            <Input id="c-slug" name="slug" required maxLength={64} className="mt-1" />
          </div>
          <div>
            <label htmlFor="c-start" className={field}>
              Starts
            </label>
            <Input
              id="c-start"
              name="startsAt"
              type="datetime-local"
              required
              className="mt-1"
            />
          </div>
          <div>
            <label htmlFor="c-end" className={field}>
              Ends
            </label>
            <Input
              id="c-end"
              name="endsAt"
              type="datetime-local"
              required
              className="mt-1"
            />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="c-problems" className={field}>
              Problem numbers, in order
            </label>
            <Input
              id="c-problems"
              name="problems"
              required
              placeholder="1, 5, 12"
              className="mt-1"
            />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="c-desc" className={field}>
              Description
            </label>
            <Textarea
              id="c-desc"
              name="description"
              required
              maxLength={2000}
              className="mt-1"
            />
          </div>
          <div>
            <Button type="submit">Create contest</Button>
          </div>
        </form>
      </section>
      <section aria-labelledby="all-contests">
        <SectionHeading
          id="all-contests"
          title="All contests"
          count={contests.length}
        />
        <ul className="mt-2 divide-y divide-border">
          {contests.map((c) => (
            <li key={c.slug} className="flex items-center justify-between gap-3 py-2.5">
              <Link
                href={route(`/contests/${c.slug}`)}
                className="text-info hover:underline"
              >
                {c.title}
              </Link>
              <span className="font-mono text-xs text-subtle-foreground">
                {contestPhase(c, now)} · {c._count.entries} entered
              </span>
              {contestPhase(c, now) === "upcoming" && (
                <form action={cancelContestAction.bind(null, c.slug)}>
                  <Button type="submit" size="sm" variant="outline">
                    Cancel {c.title}
                  </Button>
                </form>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
