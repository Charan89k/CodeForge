import type { Metadata } from "next";

import { AptitudePractice } from "@/components/aptitude/aptitude-practice";
import { CampusTrail } from "@/components/campus/campus-trail";
import { PageHeader } from "@/components/common/page-header";
import { requireCampusUser } from "@/lib/campus-access";

export const metadata: Metadata = { title: "Aptitude" };

export default async function CampusAptitudePage({
  searchParams,
}: PageProps<"/campus/aptitude">) {
  const user = await requireCampusUser("/campus/aptitude");
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
      <PageHeader
        eyebrow={<CampusTrail items={[{ label: "Aptitude" }]} />}
        title="Aptitude practice"
        description="Short sets with worked explanations. Your scores are yours; your college does not see them."
      />
      <AptitudePractice
        basePath="/campus/aptitude"
        userId={user.id}
        params={await searchParams}
      />
    </div>
  );
}
