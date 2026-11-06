"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAdminOrThrow } from "@/lib/auth/session";
import { cancelContest, contestInputSchema, createContest } from "@/services/contests";

/** datetime-local has no zone; the form says UTC, so read it as UTC. */
const asUtc = (value: FormDataEntryValue | null) => `${String(value ?? "")}:00Z`;

export async function createContestAction(form: FormData): Promise<void> {
  const admin = await requireAdminOrThrow();
  const parsed = contestInputSchema.safeParse({
    title: form.get("title"),
    slug: form.get("slug"),
    description: form.get("description"),
    startsAt: asUtc(form.get("startsAt")),
    endsAt: asUtc(form.get("endsAt")),
    problemNumbers: String(form.get("problems") ?? "")
      .split(/[\s,]+/)
      .filter(Boolean)
      .map(Number),
  });
  if (!parsed.success) redirect("/admin/contests?msg=invalid");
  const result = await createContest(admin, parsed.data);
  revalidatePath("/admin/contests");
  revalidatePath("/contests");
  redirect(`/admin/contests?msg=${result}`);
}

export async function cancelContestAction(slug: string): Promise<void> {
  const admin = await requireAdminOrThrow();
  const result = await cancelContest(admin, slug);
  revalidatePath("/admin/contests");
  revalidatePath("/contests");
  redirect(`/admin/contests?msg=${result}`);
}
