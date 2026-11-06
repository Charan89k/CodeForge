import type { Metadata } from "next";
import Link from "next/link";

import { CmsForm } from "@/components/admin/cms-forms";
import { PageHeader } from "@/components/common/page-header";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { requireUser } from "@/lib/auth/session";
import { BODY_MAX, LINKS_MAX, TITLE_MAX, TITLE_MIN } from "@/lib/community/content";
import { prisma } from "@/lib/db";
import { listCategories } from "@/services/community";

import { createThreadAction } from "../actions";

export const metadata: Metadata = {
  title: "Start a thread",
  robots: { index: false, follow: false },
};

export default async function NewThreadPage({
  searchParams,
}: PageProps<"/community/new">) {
  const user = await requireUser("/community/new");
  const { category } = await searchParams;
  const [categories, profile] = await Promise.all([
    listCategories(),
    prisma.profile.findUnique({
      where: { userId: user.id },
      select: { username: true },
    }),
  ]);

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6 sm:py-8">
      <PageHeader
        title="Start a thread"
        description="Be specific: what you tried, what happened, what you expected. Write in your own words, and never paste someone else's paid content."
      />
      {!profile?.username ? (
        <p className="mt-6 rounded-md border border-border p-4 text-sm">
          Posts show your username, never your name or email.{" "}
          <Link href="/settings" className="text-info underline">
            Choose a username in Settings
          </Link>{" "}
          to post.
        </p>
      ) : (
        <CmsForm
          action={createThreadAction}
          submitLabel="Post thread"
          className="mt-6 space-y-4"
        >
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">What is it?</legend>
            <div className="flex gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input type="radio" name="kind" value="QUESTION" defaultChecked /> A
                question
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" name="kind" value="DISCUSSION" /> A discussion
              </label>
            </div>
          </fieldset>
          <div className="space-y-1.5">
            <label htmlFor="category" className="text-sm font-medium">
              Category
            </label>
            <select
              id="category"
              name="category"
              required
              defaultValue={typeof category === "string" ? category : ""}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="" disabled>
                Choose one
              </option>
              {categories.map((c) => (
                <option key={c.id} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="title" className="text-sm font-medium">
              Title
            </label>
            <Input
              id="title"
              name="title"
              required
              minLength={TITLE_MIN}
              maxLength={TITLE_MAX}
              aria-describedby="title-hint"
            />
            <p id="title-hint" className="text-xs text-muted-foreground">
              {TITLE_MIN} to {TITLE_MAX} characters.
            </p>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="body" className="text-sm font-medium">
              Details
            </label>
            <Textarea
              id="body"
              name="body"
              required
              rows={10}
              maxLength={BODY_MAX}
              aria-describedby="body-hint"
            />
            <p id="body-hint" className="text-xs text-muted-foreground">
              Blank lines separate paragraphs. Wrap code in ``` fences. Use **bold**,
              *italic*, `code`, [links](https://example.com) (at most {LINKS_MAX}) and
              @username to mention someone.
            </p>
          </div>
        </CmsForm>
      )}
    </div>
  );
}
