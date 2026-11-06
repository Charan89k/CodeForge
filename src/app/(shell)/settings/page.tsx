import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { savePublicProfileAction } from "./actions";
import { AccountData } from "@/components/settings/account-data";
import { SettingsForm } from "@/components/settings/settings-form";
import { accountDeletionBlockers, DELETE_PHRASE } from "@/services/account";
import { requireUser } from "@/lib/auth/session";
import { emailIsConfigured } from "@/lib/email";
import { prisma } from "@/lib/db";

export const metadata: Metadata = {
  title: "Settings",
  robots: { index: false, follow: false },
};

const PROFILE_MESSAGES: Record<string, string> = {
  saved: "Public profile saved.",
  invalid: "A username is 3-30 lowercase letters, digits, hyphens or underscores.",
  username_taken: "That username is taken.",
};

export default async function SettingsPage({ searchParams }: PageProps<"/settings">) {
  const user = await requireUser("/settings");
  const { profile: profileMessage } = await searchParams;
  const account = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    select: { passwordHash: true },
  });

  const profile = await prisma.profile.findUnique({
    where: { userId: user.id },
    select: {
      targetRole: true,
      preferredLanguage: true,
      reducedMotion: true,
      onboardedAt: true,
      notifyReviewDue: true,
      notifyInterviewGraded: true,
      notifyMilestones: true,
      emailReviewReminders: true,
      username: true,
      publicProfile: true,
    },
  });

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <PageHeader
        title="Settings"
        description="Account details and how the product behaves for you."
      />

      <div className="mt-8">
        <SettingsForm
          // Whether this deployment can send mail at all. The form says
          // so rather than offering a toggle for a channel that does not
          // exist here.
          emailConfigured={emailIsConfigured()}
          values={{
            name: user.name ?? "",
            targetRole: profile?.targetRole ?? "",
            preferredLanguage: profile?.preferredLanguage ?? "PYTHON",
            reducedMotion: profile?.reducedMotion ?? false,
            notifyReviewDue: profile?.notifyReviewDue ?? true,
            notifyInterviewGraded: profile?.notifyInterviewGraded ?? true,
            notifyMilestones: profile?.notifyMilestones ?? true,
            emailReviewReminders: profile?.emailReviewReminders ?? false,
          }}
        />
      </div>

      {/* Onboarding is reachable afterwards on purpose: somebody who
          skipped should be able to come back, and somebody who answered
          should be able to change their mind. */}
      <section className="mt-8 grid gap-3 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-8">
        <div className="lg:pt-4">
          <h2 className="text-base font-semibold">Public profile</h2>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Off by default. Turn it on to appear on the leaderboard.
          </p>
        </div>
        <form
          action={savePublicProfileAction}
          className="space-y-3 rounded-xl border border-border bg-card p-4"
        >
          {PROFILE_MESSAGES[String(profileMessage)] && (
            <p role="status" className="text-sm">
              {PROFILE_MESSAGES[String(profileMessage)]}
            </p>
          )}
          <div>
            <label htmlFor="username" className="text-sm font-medium">
              Username
            </label>
            <Input
              id="username"
              name="username"
              required
              maxLength={30}
              defaultValue={profile?.username ?? ""}
              className="mt-1 max-w-xs"
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="publicProfile"
              defaultChecked={profile?.publicProfile ?? false}
            />
            List me on the leaderboard and show my solved counts at /u/my-username
          </label>
          <Button type="submit" size="sm" variant="outline">
            Update public profile
          </Button>
        </form>
      </section>

      <section className="mt-8 grid gap-3 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-8">
        <div className="lg:pt-4">
          <h2 className="text-base font-semibold">Your data</h2>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Take a copy, or remove your account for good.
          </p>
        </div>
        <AccountData
          hasPassword={Boolean(account.passwordHash)}
          blockers={await accountDeletionBlockers(user.id)}
          phrase={DELETE_PHRASE}
        />
      </section>

      <section className="mt-8 grid gap-3 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-8">
        <div className="lg:pt-4">
          <h2 className="text-base font-semibold">Getting started</h2>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            The questions asked when you signed up.
          </p>
        </div>
        <div className="flex flex-col items-start gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div>
            <p className="text-sm font-medium">
              {profile?.onboardedAt
                ? "Your learning preferences"
                : "You have not answered the getting-started questions"}
            </p>
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
              Experience, goal, target interview and a weekly target. All optional, and
              none of them lock anything.
            </p>
          </div>
          <Button asChild size="sm" variant="outline" className="shrink-0">
            <Link href="/onboarding">
              {profile?.onboardedAt ? "Review answers" : "Answer them"}
            </Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
