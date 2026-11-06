"use client";

import { useActionState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";

import type { CmsFormState } from "@/app/(shell)/admin/courses/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

function Submit({
  children,
  variant,
  size,
}: {
  children: ReactNode;
  variant?: "default" | "outline" | "ghost" | "destructive";
  size?: "default" | "sm";
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} variant={variant} size={size}>
      {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
      {children}
    </Button>
  );
}

/** A server-action form that reports its own failure and success inline. */
export function CmsForm({
  action,
  children,
  submitLabel,
  savedLabel = "Saved.",
  className,
  variant,
  size,
}: {
  action: (state: CmsFormState, form: FormData) => Promise<CmsFormState>;
  children?: ReactNode;
  submitLabel: string;
  savedLabel?: string;
  className?: string;
  variant?: "default" | "outline" | "ghost" | "destructive";
  size?: "default" | "sm";
}) {
  const [state, formAction] = useActionState(action, {});
  return (
    <form action={formAction} className={className}>
      {children}
      {state.error && (
        <Alert variant="destructive" role="alert" className="mt-3">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}
      <div className="mt-3 flex items-center gap-3">
        <Submit variant={variant} size={size}>
          {submitLabel}
        </Submit>
        {state.saved && (
          <span role="status" className="text-sm text-success">
            {savedLabel}
          </span>
        )}
      </div>
    </form>
  );
}
