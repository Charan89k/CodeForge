"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { signOut } from "@/lib/auth";
import { requireUserOrThrow } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { RATE_LIMITS, rateLimit } from "@/lib/rate-limit";
import { deleteAccount } from "@/services/account";
import { profileSettingsSchema } from "@/lib/validation/settings";
import { publicProfileSchema, savePublicProfile } from "@/services/leaderboard";

export type SettingsFormState = {
  status: "idle" | "saved" | "error";
  message?: string;
  fieldErrors?: Record<string, string>;
};

export type DeleteAccountState = { error?: string };

const DELETE_ERRORS = {
  phrase: "Type the phrase exactly to confirm.",
  credentials: "That does not match this account.",
  blocked: "This account cannot be deleted yet. See the reason above.",
} as const;

export async function deleteAccountAction(
  _prev: DeleteAccountState,
  form: FormData
): Promise<DeleteAccountState> {
  const user = await requireUserOrThrow();
  // Tight: this checks a password, so it must not be a guessing oracle.
  const limited = await rateLimit(`account-delete:${user.id}`, RATE_LIMITS.AUTH_SIGNIN);
  if (!limited.success) return { error: "Too many attempts. Try again later." };

  const result = await deleteAccount(user.id, {
    phrase: String(form.get("phrase") ?? ""),
    password: String(form.get("password") ?? ""),
    email: String(form.get("email") ?? ""),
  });
  if (!result.ok) return { error: DELETE_ERRORS[result.reason] };
  await signOut({ redirectTo: "/account-deleted" });
  return {};
}

export async function savePublicProfileAction(form: FormData): Promise<void> {
  const user = await requireUserOrThrow();
  const parsed = publicProfileSchema.safeParse({
    username: form.get("username"),
    publicProfile: form.get("publicProfile") === "on",
  });
  if (!parsed.success) redirect("/settings?profile=invalid");
  const result = await savePublicProfile(user.id, parsed.data);
  revalidatePath("/leaderboard");
  redirect(`/settings?profile=${result}`);
}

export async function updateSettingsAction(
  _prev: SettingsFormState,
  formData: FormData
): Promise<SettingsFormState> {
  // Authorization first, before anything touches the request body.
  const user = await requireUserOrThrow();

  const parsed = profileSettingsSchema.safeParse({
    name: formData.get("name"),
    targetRole: formData.get("targetRole") ?? "",
    preferredLanguage: formData.get("preferredLanguage"),
    // Unchecked checkboxes are absent from FormData entirely.
    reducedMotion: formData.get("reducedMotion") === "on",
    notifyReviewDue: formData.get("notifyReviewDue") === "on",
    notifyInterviewGraded: formData.get("notifyInterviewGraded") === "on",
    notifyMilestones: formData.get("notifyMilestones") === "on",
    emailReviewReminders: formData.get("emailReviewReminders") === "on",
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "");
      if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { status: "error", fieldErrors };
  }

  const {
    name,
    targetRole,
    preferredLanguage,
    reducedMotion,
    notifyReviewDue,
    notifyInterviewGraded,
    notifyMilestones,
    emailReviewReminders,
  } = parsed.data;

  const preferences = {
    targetRole: targetRole || null,
    preferredLanguage,
    reducedMotion,
    notifyReviewDue,
    notifyInterviewGraded,
    notifyMilestones,
    emailReviewReminders,
  };

  try {
    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { name },
      }),
      prisma.profile.upsert({
        where: { userId: user.id },
        create: { userId: user.id, ...preferences },
        update: preferences,
      }),
    ]);
  } catch {
    return {
      status: "error",
      message: "Could not save your settings. Please try again.",
    };
  }

  revalidatePath("/settings");
  revalidatePath("/profile");
  // The reduced-motion attribute is rendered by the root layout, so the
  // whole tree has to re-render for the change to be visible without a
  // manual reload.
  revalidatePath("/", "layout");

  return { status: "saved", message: "Settings saved." };
}
