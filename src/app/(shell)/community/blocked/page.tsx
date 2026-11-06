import type { Metadata } from "next";

import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/session";
import { listBlocked } from "@/services/community-safety";

import { unblockAction } from "../actions";

export const metadata: Metadata = {
  title: "People you blocked",
  robots: { index: false, follow: false },
};

export default async function BlockedPage() {
  const user = await requireUser("/community/blocked");
  const blocked = await listBlocked(user);

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6 sm:py-8">
      <PageHeader
        title="People you blocked"
        description="You do not see their threads or replies, and they cannot notify you by mention or reply. They are not told."
      />
      {blocked.length === 0 ? (
        <div className="mt-6">
          <EmptyState title="You have not blocked anyone" />
        </div>
      ) : (
        <ul className="mt-6 divide-y divide-border border-y border-border text-sm">
          {blocked.map((person) => (
            <li key={person.userId} className="flex items-center gap-3 py-2.5">
              <span className="font-medium">{person.name}</span>
              <span className="font-mono text-xs text-muted-foreground">
                since {person.since.toISOString().slice(0, 10)}
              </span>
              <form
                action={unblockAction.bind(null, person.userId)}
                className="ml-auto"
              >
                <Button type="submit" size="sm" variant="outline">
                  Unblock
                </Button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
