import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";

import { CmsForm } from "@/components/admin/cms-forms";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { Input } from "@/components/ui/input";
import { requireUser } from "@/lib/auth/session";
import { route } from "@/lib/utils";
import { canModerate } from "@/services/community";
import {
  appealQueue,
  listModerators,
  listRestrictions,
  moderationLog,
  reportQueue,
} from "@/services/community-moderation";

import {
  decideAppealAction,
  dismissAction,
  hideAction,
  liftAction,
  moderatorAction,
  restrictAction,
} from "./actions";

export const metadata: Metadata = {
  title: "Community moderation",
  robots: { index: false, follow: false },
};

const REASON_LABEL: Record<string, string> = {
  SPAM: "spam",
  HARASSMENT: "harassment",
  OFF_TOPIC: "off topic",
  UNSAFE_LINK: "unsafe link",
  COPIED_CONTENT: "copied content",
  OTHER: "other",
};

function ReasonField({ label = "Reason" }: { label?: string }) {
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

export default async function ModerationPage() {
  const user = await requireUser("/community/moderation");
  if (!(await canModerate(user))) {
    return (
      <div className="mx-auto w-full max-w-xl px-4 py-10 sm:px-6">
        <PageHeader
          title="Moderators only"
          description="Community moderation is open to platform admins and the moderators they choose."
        />
      </div>
    );
  }
  const actor = { id: user.id, role: user.role, email: user.email };
  const [reports, appeals, restrictions, moderators, log] = await Promise.all([
    reportQueue(actor),
    appealQueue(actor),
    listRestrictions(actor),
    listModerators(actor),
    moderationLog(actor),
  ]);

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
      <PageHeader
        title="Community moderation"
        description="Act with a reason: the author sees it, every action is logged, and an appeal goes to a different moderator."
      />

      <section aria-labelledby="reports-heading" className="mt-8">
        <h2 id="reports-heading" className="text-lg font-semibold">
          Reports ({reports.length})
        </h2>
        {reports.length === 0 ? (
          <EmptyState icon={ShieldCheck} title="No open reports" size="sm" />
        ) : (
          <ul className="mt-3 space-y-4">
            {reports.map((group) => {
              const key =
                "threadId" in group.target
                  ? group.target.threadId
                  : group.target.postId;
              return (
                <li key={key} className="rounded-md border border-border p-4 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={route(`/community/t/${group.threadId}`)}
                      className="font-medium text-info"
                    >
                      {group.title}
                    </Link>
                    <span className="text-xs text-muted-foreground">
                      {"threadId" in group.target ? "Thread" : "Reply"} by{" "}
                      {group.authorName} · {group.count}{" "}
                      {group.count === 1 ? "report" : "reports"}:{" "}
                      {Object.entries(group.reasons)
                        .map(([r, n]) => `${REASON_LABEL[r] ?? r} ${n}`)
                        .join(", ")}
                    </span>
                  </div>
                  <p className="mt-2 break-words whitespace-pre-wrap text-muted-foreground">
                    {group.excerpt}
                  </p>
                  {group.notes.length > 0 && (
                    <ul className="mt-2 list-disc pl-5 text-xs">
                      {group.notes.map((note, i) => (
                        <li key={i}>{note}</li>
                      ))}
                    </ul>
                  )}
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    {group.status === "VISIBLE" && (
                      <CmsForm
                        action={hideAction.bind(null, group.threadId, group.target)}
                        submitLabel="Hide"
                        savedLabel="Hidden."
                        size="sm"
                      >
                        <ReasonField label="Reason, shown to the author" />
                      </CmsForm>
                    )}
                    <CmsForm
                      action={dismissAction.bind(null, group.threadId, group.target)}
                      submitLabel="Dismiss reports"
                      savedLabel="Dismissed."
                      size="sm"
                      variant="outline"
                    >
                      <ReasonField />
                    </CmsForm>
                    {group.authorId && (
                      <CmsForm
                        action={restrictAction.bind(null, group.authorId)}
                        submitLabel={`Pause ${group.authorName}'s posting`}
                        savedLabel="Paused."
                        size="sm"
                        variant="outline"
                      >
                        <label className="block text-xs">
                          Days, 1 to 90
                          <Input
                            name="days"
                            type="number"
                            min={1}
                            max={90}
                            defaultValue={3}
                            required
                            className="mt-1 h-8 w-24"
                          />
                        </label>
                        <ReasonField label="Reason, shown to them" />
                      </CmsForm>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="appeals-heading" className="mt-10">
        <h2 id="appeals-heading" className="text-lg font-semibold">
          Appeals ({appeals.length})
        </h2>
        {appeals.length === 0 ? (
          <EmptyState title="No open appeals" size="sm" />
        ) : (
          <ul className="mt-3 space-y-4">
            {appeals.map((appeal) => (
              <li
                key={appeal.id}
                className="rounded-md border border-border p-4 text-sm"
              >
                <Link
                  href={route(`/community/t/${appeal.threadId}`)}
                  className="font-medium text-info"
                >
                  {appeal.title}
                </Link>
                <p className="mt-1 text-xs text-muted-foreground">
                  Hidden because: {appeal.hiddenReason ?? "no reason recorded"}
                </p>
                <p className="mt-2 break-words whitespace-pre-wrap">{appeal.excerpt}</p>
                <p className="mt-2 border-l-2 border-border pl-3 text-muted-foreground">
                  {appeal.message}
                </p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <CmsForm
                    action={decideAppealAction.bind(null, appeal.id, true)}
                    submitLabel="Accept appeal and restore"
                    savedLabel="Restored."
                    size="sm"
                  >
                    <ReasonField label="Note to the author" />
                  </CmsForm>
                  <CmsForm
                    action={decideAppealAction.bind(null, appeal.id, false)}
                    submitLabel="Keep it hidden"
                    savedLabel="Decided."
                    size="sm"
                    variant="outline"
                  >
                    <ReasonField label="Note to the author" />
                  </CmsForm>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="restrictions-heading" className="mt-10">
        <h2 id="restrictions-heading" className="text-lg font-semibold">
          Paused posters ({restrictions.length})
        </h2>
        {restrictions.length === 0 ? (
          <EmptyState title="Nobody is paused" size="sm" />
        ) : (
          <ul className="mt-3 divide-y divide-border border-y border-border text-sm">
            {restrictions.map((r) => (
              <li key={r.userId} className="py-3">
                <span className="font-medium">{r.name}</span>{" "}
                <span className="text-xs text-muted-foreground">
                  until {r.until.toISOString().slice(0, 10)}: {r.reason}
                </span>
                <CmsForm
                  action={liftAction.bind(null, r.userId)}
                  submitLabel="End the pause"
                  savedLabel="Ended."
                  size="sm"
                  variant="outline"
                  className="mt-2 max-w-sm"
                >
                  <ReasonField />
                </CmsForm>
              </li>
            ))}
          </ul>
        )}
      </section>

      {user.role === "ADMIN" && (
        <section aria-labelledby="moderators-heading" className="mt-10">
          <h2 id="moderators-heading" className="text-lg font-semibold">
            Moderators
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Platform admins always moderate. These people moderate too.
          </p>
          <ul className="mt-3 text-sm">
            {moderators.length === 0 && (
              <li className="text-muted-foreground">None yet.</li>
            )}
            {moderators.map((m) => (
              <li key={m.userId}>
                {m.name}{" "}
                <span className="text-xs text-muted-foreground">
                  since {m.since.toISOString().slice(0, 10)}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {([true, false] as const).map((grant) => (
              <CmsForm
                key={String(grant)}
                action={moderatorAction.bind(null, grant)}
                submitLabel={grant ? "Make moderator" : "Remove moderator"}
                size="sm"
                variant={grant ? "default" : "outline"}
              >
                <label className="block text-xs">
                  Username
                  <Input name="username" required maxLength={30} className="mt-1 h-8" />
                </label>
              </CmsForm>
            ))}
          </div>
        </section>
      )}

      <section aria-labelledby="log-heading" className="mt-10">
        <h2 id="log-heading" className="text-lg font-semibold">
          Recent actions
        </h2>
        {log.length === 0 ? (
          <EmptyState title="No actions yet" size="sm" />
        ) : (
          <ul className="mt-3 divide-y divide-border border-y border-border font-mono text-xs">
            {log.map((entry) => (
              <li key={entry.id} className="flex flex-wrap gap-x-3 py-2">
                <span>
                  {entry.createdAt.toISOString().slice(0, 16).replace("T", " ")}
                </span>
                <span className="font-semibold">{entry.action}</span>
                {user.role === "ADMIN" && (
                  <span className="text-muted-foreground">{entry.moderatorEmail}</span>
                )}
                <span className="min-w-0 font-sans break-words">{entry.reason}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
