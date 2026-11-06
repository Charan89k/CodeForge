import { z } from "zod";

import { Language } from "@/generated/prisma/enums";

export const profileSettingsSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Enter your name.")
    .max(80, "That name is too long."),
  targetRole: z
    .string()
    .trim()
    .max(80, "Keep this under 80 characters.")
    .optional()
    .or(z.literal("")),
  preferredLanguage: z.nativeEnum(Language),
  reducedMotion: z.boolean(),

  // In-app notification preferences. There is no email of any kind — no
  // mailer is configured and none is planned — so there is deliberately
  // no toggle here that promises one.
  notifyReviewDue: z.boolean(),
  notifyInterviewGraded: z.boolean(),
  notifyMilestones: z.boolean(),
  notifyCommunity: z.boolean(),

  /** Email. Separate from the in-app preference above; opt-in. */
  emailReviewReminders: z.boolean(),
});

export type ProfileSettingsInput = z.infer<typeof profileSettingsSchema>;
