"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, Check, Loader2 } from "lucide-react";

import {
  updateSettingsAction,
  type SettingsFormState,
} from "@/app/(shell)/settings/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { Language } from "@/generated/prisma/enums";

const LANGUAGE_LABELS: Record<Language, string> = {
  PYTHON: "Python",
  JAVASCRIPT: "JavaScript",
  TYPESCRIPT: "TypeScript",
  JAVA: "Java",
  CPP: "C++",
  GO: "Go",
};

export type SettingsFormValues = {
  name: string;
  targetRole: string;
  preferredLanguage: Language;
  reducedMotion: boolean;
  notifyReviewDue: boolean;
  notifyInterviewGraded: boolean;
  notifyMilestones: boolean;
  notifyCommunity: boolean;
  emailReviewReminders: boolean;
};

const INITIAL: SettingsFormState = { status: "idle" };

export function SettingsForm({
  values,
  emailConfigured,
}: {
  values: SettingsFormValues;
  /** False when no provider is set up, so the copy can say so. */
  emailConfigured: boolean;
}) {
  const [state, formAction] = useActionState(updateSettingsAction, INITIAL);
  const fieldErrors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-6">
      {state.status === "saved" && (
        <Alert className="border-success/30 bg-success/8">
          <Check className="size-4 text-success" />
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      )}
      {state.status === "error" && state.message && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      )}

      <SettingsSection
        title="Account"
        description="Your name as it appears on your profile and in the header."
      >
        <div className="space-y-2">
          <Label htmlFor="name">Display name</Label>
          <Input
            id="name"
            name="name"
            defaultValue={values.name}
            maxLength={80}
            required
            aria-invalid={fieldErrors.name ? true : undefined}
            aria-describedby={fieldErrors.name ? "name-error" : undefined}
          />
          {fieldErrors.name && (
            <p id="name-error" role="alert" className="text-xs text-destructive">
              {fieldErrors.name}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="targetRole">Target role</Label>
          <Input
            id="targetRole"
            name="targetRole"
            defaultValue={values.targetRole}
            maxLength={80}
            placeholder="Backend engineer, mid-level"
          />
          <p className="text-xs text-muted-foreground">
            Shown on your profile. Optional.
          </p>
        </div>
      </SettingsSection>

      <SettingsSection
        title="Preferences"
        description="How the editor and the visualizations behave for you."
      >
        <div className="space-y-2">
          <Label htmlFor="preferredLanguage">Default language</Label>
          <Select name="preferredLanguage" defaultValue={values.preferredLanguage}>
            <SelectTrigger id="preferredLanguage" className="w-full sm:w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(LANGUAGE_LABELS) as Language[]).map((lang) => (
                <SelectItem key={lang} value={lang}>
                  {LANGUAGE_LABELS[lang]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Preselected in the code editor.
          </p>
        </div>

        <ToggleRow
          name="reducedMotion"
          label="Reduce motion"
          description="Visualizations step instantly instead of animating, and transitions are removed across the site. Your operating system setting is honoured on top of this and always wins."
          defaultChecked={values.reducedMotion}
        />
      </SettingsSection>

      <SettingsSection
        title="Notifications"
        description="What appears in the bell in the top bar."
      >
        <p className="text-xs leading-relaxed text-muted-foreground">
          These appear in the bell in the top bar. Account and security notices cannot
          be turned off.
        </p>

        <ToggleRow
          name="notifyReviewDue"
          label="Reviews falling due"
          description="Sent by a scheduled job. If this deployment has no scheduler pointed at the notifications job, no reminders are sent at all."
          defaultChecked={values.notifyReviewDue}
        />

        <ToggleRow
          name="notifyInterviewGraded"
          label="Interview feedback ready"
          description="When the written feedback for a mock interview has been generated."
          defaultChecked={values.notifyInterviewGraded}
        />

        <ToggleRow
          name="notifyMilestones"
          label="Milestones"
          description="The occasional note when you pass a round number of solved problems. Deliberately rare."
          defaultChecked={values.notifyMilestones}
        />

        <ToggleRow
          name="notifyCommunity"
          label="Community mentions and replies"
          description="When someone mentions your username or replies to your thread. Nobody you have blocked can trigger one."
          defaultChecked={values.notifyCommunity}
        />
      </SettingsSection>

      <SettingsSection
        title="Email"
        description="Opt-in only. Off unless you turn it on."
      >
        <p className="text-xs leading-relaxed text-muted-foreground">
          One email, and only if you ask for it. Tech Epitome sends no marketing of any
          kind — it is free, and there is nothing to sell you.
          {!emailConfigured && (
            <>
              {" "}
              <strong className="text-warning">
                This deployment has no email provider configured, so nothing will be
                sent whatever you choose here.
              </strong>
            </>
          )}
        </p>

        <ToggleRow
          name="emailReviewReminders"
          label="Review reminders by email"
          description="A note when you have items due, sent at most once a day. Off by default — this is the only email Tech Epitome sends."
          defaultChecked={values.emailReviewReminders}
        />
      </SettingsSection>

      <div className="sticky bottom-4 z-10 flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 lg:ml-[17rem]">
        <p className="text-xs text-muted-foreground">Changes apply once saved.</p>
        <SaveButton />
      </div>
    </form>
  );
}

/**
 * One settings section: heading and a line of context on the left at
 * desktop widths, the controls in a bordered panel on the right.
 */
function SettingsSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="grid gap-3 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-8">
      <div className="lg:pt-4">
        <h2 className="text-base font-semibold">{title}</h2>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          {description}
        </p>
      </div>
      <div className="space-y-5 rounded-xl border border-border bg-card p-4 sm:p-5">
        {children}
      </div>
    </section>
  );
}

function ToggleRow({
  name,
  label,
  description,
  defaultChecked,
}: {
  name: string;
  label: string;
  description: string;
  defaultChecked: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-6 border-t border-border pt-5 first:border-t-0 first:pt-0">
      <div className="space-y-1">
        <Label htmlFor={name}>{label}</Label>
        <p className="max-w-md text-xs leading-relaxed text-muted-foreground">
          {description}
        </p>
      </div>
      <Switch id={name} name={name} defaultChecked={defaultChecked} />
    </div>
  );
}

function SaveButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending}>
      {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
      {pending ? "Saving…" : "Save changes"}
    </Button>
  );
}
