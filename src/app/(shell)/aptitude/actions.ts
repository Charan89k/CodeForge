"use server";

import { revalidatePath } from "next/cache";

import type { AptitudeResult } from "@/data/aptitude";
import { getCurrentUser } from "@/lib/auth/session";
import { DIFFICULTIES } from "@/lib/catalogue/filters";
import { rateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request-context";
import { submissionSchema, submitAptitudeSet } from "@/services/aptitude";

const SUBMIT_LIMIT = { limit: 60, windowMs: 60 * 60 * 1000 };

/** Graded here, so the browser never holds an answer before it is submitted. */
export async function submitAptitudeAction(
  topic: string,
  difficulty: string | null,
  submission: unknown
): Promise<AptitudeResult | null> {
  const parsed = submissionSchema.safeParse(submission);
  if (!parsed.success) return null;
  const level = DIFFICULTIES.find((known) => known === difficulty) ?? null;

  const user = await getCurrentUser();
  const key = user ? `aptitude:${user.id}` : `aptitude:ip:${await getClientIp()}`;
  if (!(await rateLimit(key, SUBMIT_LIMIT)).success) return null;
  const result = await submitAptitudeSet(
    user?.id ?? null,
    { topic, difficulty: level },
    parsed.data
  );
  if (user) {
    revalidatePath("/aptitude");
    revalidatePath("/campus/aptitude");
  }
  return result;
}
