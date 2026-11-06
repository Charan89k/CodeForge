import type { Metadata } from "next";

import { AptitudePractice } from "@/components/aptitude/aptitude-practice";
import { PageHeader } from "@/components/common/page-header";
import { getCurrentUser } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Aptitude",
  description:
    "Quantitative, logical, verbal, data interpretation and programming aptitude practice, with an explanation for every answer.",
  alternates: { canonical: "/aptitude" },
};

export default async function AptitudePage({ searchParams }: PageProps<"/aptitude">) {
  const user = await getCurrentUser();
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
      <PageHeader
        eyebrow="Practice"
        title="Aptitude practice"
        description="Short sets with a worked explanation for every answer. Free, with or without an account."
      />
      <AptitudePractice
        basePath="/aptitude"
        userId={user?.id ?? null}
        params={await searchParams}
      />
    </div>
  );
}
