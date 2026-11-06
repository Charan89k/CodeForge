"use client";

import { useActionState } from "react";
import { Download } from "lucide-react";

import {
  deleteAccountAction,
  type DeleteAccountState,
} from "@/app/(shell)/settings/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const BLOCKER_TEXT = {
  "platform-admin":
    "This is a platform administrator account. Another administrator must remove the role first.",
  "college-records":
    "This account has college records, such as a membership, exam attempts or placement history. They also belong to your college, so ask your college to remove you. You can still download your data here.",
  "authored-content":
    "This account authored courses or contests. Another administrator must take them over first.",
} as const;

export function AccountData({
  hasPassword,
  blockers,
  phrase,
}: {
  hasPassword: boolean;
  blockers: (keyof typeof BLOCKER_TEXT)[];
  phrase: string;
}) {
  const [state, action, pending] = useActionState<DeleteAccountState, FormData>(
    deleteAccountAction,
    {}
  );

  return (
    <div className="space-y-6 rounded-xl border border-border bg-card p-4">
      <div>
        <h3 className="text-sm font-medium">Download your data</h3>
        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
          A JSON file with your profile, progress, submissions, notes, highlights, tutor
          conversations and interviews. Passwords and sign-in tokens are never included.
        </p>
        <Button asChild size="sm" variant="outline" className="mt-3">
          <a href="/settings/export" download>
            <Download aria-hidden="true" />
            Download my data
          </a>
        </Button>
      </div>

      <div className="border-t border-border pt-5">
        <h3 className="text-sm font-medium">Delete your account</h3>
        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
          This permanently removes your account and everything above. It cannot be
          undone, so download your data first if you want a copy.
        </p>

        {blockers.length > 0 ? (
          <ul className="mt-3 space-y-2">
            {blockers.map((blocker) => (
              <li key={blocker}>
                <Alert>
                  <AlertDescription>{BLOCKER_TEXT[blocker]}</AlertDescription>
                </Alert>
              </li>
            ))}
          </ul>
        ) : (
          <form action={action} className="mt-3 max-w-sm space-y-3">
            {state.error && (
              <Alert variant="destructive" role="alert">
                <AlertDescription>{state.error}</AlertDescription>
              </Alert>
            )}
            {hasPassword ? (
              <div className="space-y-1.5">
                <Label htmlFor="delete-password">Your password</Label>
                <Input
                  id="delete-password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                />
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label htmlFor="delete-email">Your email address</Label>
                <Input id="delete-email" name="email" type="email" required />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="delete-phrase">
                Type &quot;{phrase}&quot; to confirm
              </Label>
              <Input id="delete-phrase" name="phrase" autoComplete="off" required />
            </div>
            <Button type="submit" variant="destructive" size="sm" disabled={pending}>
              {pending ? "Deleting…" : "Delete my account permanently"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
