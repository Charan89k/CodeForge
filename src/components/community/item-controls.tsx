import { ArrowBigUp } from "lucide-react";

import {
  appealAction,
  blockAction,
  removeAction,
  reportAction,
  voteAction,
} from "@/app/(shell)/community/actions";
import {
  dismissAction,
  hideAction,
  restoreAction,
} from "@/app/(shell)/community/moderation/actions";
import { CmsForm } from "@/components/admin/cms-forms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { CommunityTarget } from "@/services/community";

const REASONS = [
  ["SPAM", "Spam or advertising"],
  ["HARASSMENT", "Harassment or abuse"],
  ["OFF_TOPIC", "Off topic"],
  ["UNSAFE_LINK", "Unsafe or misleading link"],
  ["COPIED_CONTENT", "Copied from paid or private material"],
  ["OTHER", "Something else"],
] as const;

function ReasonInput({ label }: { label: string }) {
  return (
    <label className="block text-xs">
      {label}
      <Input
        name="reason"
        required
        minLength={3}
        maxLength={300}
        className="mt-1 h-8"
      />
    </label>
  );
}

export type ItemState = {
  status: "VISIBLE" | "HIDDEN" | "REMOVED";
  voteCount: number;
  voted: boolean;
  mine: boolean;
  authorId: string | null;
  label: string;
};

/**
 * Everything a reader can do to one thread or reply. Each control is a form
 * posting to a server action, so it works before scripts load, and the
 * service decides again whether it is allowed.
 */
export function ItemControls({
  threadId,
  target,
  item,
  signedIn,
  moderator,
  appealStatus,
}: {
  threadId: string;
  target: CommunityTarget;
  item: ItemState;
  signedIn: boolean;
  moderator: boolean;
  appealStatus?: string | null;
}) {
  const live = item.status === "VISIBLE";
  const canVote = signedIn && live && !item.mine;

  return (
    <div className="mt-3 flex flex-wrap items-start gap-2 text-sm">
      <form action={voteAction.bind(null, threadId, target)}>
        <Button
          type="submit"
          size="sm"
          variant={item.voted ? "default" : "outline"}
          disabled={!canVote}
          aria-pressed={item.voted}
          aria-label={`${item.voted ? "Remove your vote from" : "Vote for"} ${item.label}. ${item.voteCount} votes`}
          title={item.mine ? "You cannot vote on your own post" : undefined}
        >
          <ArrowBigUp className="size-4" aria-hidden="true" />
          {item.voteCount}
        </Button>
      </form>

      {signedIn && live && !item.mine && (
        <details className="group">
          <summary className="cursor-pointer rounded-md px-2 py-1 text-muted-foreground hover:bg-muted">
            Report
          </summary>
          <CmsForm
            action={reportAction.bind(null, target)}
            submitLabel="Send report"
            savedLabel="Thanks. A moderator will look at it."
            size="sm"
            className="mt-2 w-full max-w-sm space-y-2 rounded-md border border-border p-3"
          >
            <fieldset className="space-y-1">
              <legend className="text-xs font-medium">Why?</legend>
              {REASONS.map(([value, label]) => (
                <label key={value} className="flex items-center gap-2 text-xs">
                  <input type="radio" name="reason" value={value} required /> {label}
                </label>
              ))}
            </fieldset>
            <label className="block text-xs">
              Anything a moderator should know (optional)
              <Input name="note" maxLength={500} className="mt-1 h-8" />
            </label>
          </CmsForm>
        </details>
      )}

      {signedIn && !item.mine && item.authorId && (
        <form action={blockAction.bind(null, threadId, item.authorId)}>
          <Button
            type="submit"
            size="sm"
            variant="ghost"
            className="text-muted-foreground"
          >
            Block this person
          </Button>
        </form>
      )}

      {item.mine && item.status !== "REMOVED" && (
        <form action={removeAction.bind(null, threadId, target)}>
          <Button
            type="submit"
            size="sm"
            variant="ghost"
            className="text-muted-foreground"
          >
            Delete
          </Button>
        </form>
      )}

      {item.mine && item.status === "HIDDEN" && !appealStatus && (
        <details>
          <summary className="cursor-pointer rounded-md px-2 py-1 text-info hover:bg-muted">
            Appeal
          </summary>
          <CmsForm
            action={appealAction.bind(null, threadId, target)}
            submitLabel="Send appeal"
            savedLabel="Sent. A different moderator will decide."
            size="sm"
            className="mt-2 w-full max-w-sm rounded-md border border-border p-3"
          >
            <label className="block text-xs">
              Why should it be shown again? You can appeal once.
              <Textarea
                name="appeal"
                minLength={10}
                maxLength={1000}
                rows={3}
                className="mt-1"
              />
            </label>
          </CmsForm>
        </details>
      )}
      {item.mine && appealStatus && (
        <span className="rounded-md px-2 py-1 text-xs text-muted-foreground">
          Appeal {appealStatus.toLowerCase()}
        </span>
      )}

      {moderator && item.status !== "REMOVED" && (
        <details>
          <summary
            className={cn(
              "cursor-pointer rounded-md px-2 py-1 hover:bg-muted",
              "font-medium text-warning"
            )}
          >
            Moderate
          </summary>
          <div className="mt-2 w-full max-w-sm space-y-3 rounded-md border border-border p-3">
            <CmsForm
              action={(live ? hideAction : restoreAction).bind(null, threadId, target)}
              submitLabel={live ? "Hide" : "Restore"}
              savedLabel={live ? "Hidden. The author can see why." : "Restored."}
              size="sm"
              variant="outline"
            >
              <ReasonInput label={live ? "Reason, shown to the author" : "Reason"} />
            </CmsForm>
            <CmsForm
              action={dismissAction.bind(null, threadId, target)}
              submitLabel="Dismiss reports"
              savedLabel="Reports dismissed."
              size="sm"
              variant="outline"
            >
              <ReasonInput label="Reason" />
            </CmsForm>
          </div>
        </details>
      )}
    </div>
  );
}
