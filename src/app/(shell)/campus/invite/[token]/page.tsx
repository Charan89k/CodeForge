import type { Metadata } from "next";

import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/session";
import { describeInvitation } from "@/services/institutions";

import { acceptInvitationAction } from "../../actions";

// The token is in the path; keep it out of Referer headers and indexes.
export const metadata: Metadata = {
  title: "Invitation",
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};

const ROLE = {
  STUDENT: "a student",
  FACULTY: "faculty",
  PLACEMENT_OFFICER: "a placement officer",
  INSTITUTION_ADMIN: "an administrator",
} as const;

/**
 * Shows an invitation and asks before accepting it. Accepting is a POST,
 * so a mail scanner that follows the link cannot accept on anyone's behalf.
 */
export default async function InvitationPage({
  params,
}: PageProps<"/campus/invite/[token]">) {
  const { token } = await params;
  const user = await requireUser(`/campus/invite/${token}`);
  const invitation = /^[A-Za-z0-9_-]{16,128}$/.test(token)
    ? await describeInvitation(user, token)
    : null;

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-10 sm:px-6">
      {!invitation || !invitation.usable ? (
        <PageHeader
          title="Invitation unavailable"
          description="This invitation is invalid, expired, revoked or already used. Ask whoever invited you to send a new one."
        />
      ) : (
        <>
          <PageHeader
            title={`Join ${invitation.institutionName}`}
            description={`You have been invited as ${ROLE[invitation.role]}. Your own learning stays private to you.`}
          />
          {invitation.email !== user.email.toLowerCase() ? (
            <p className="mt-6 text-sm text-destructive">
              This invitation was sent to a different address. Sign in with the invited
              address to accept it.
            </p>
          ) : (
            <form action={acceptInvitationAction.bind(null, token)} className="mt-6">
              <Button type="submit">Accept invitation</Button>
            </form>
          )}
        </>
      )}
    </div>
  );
}
