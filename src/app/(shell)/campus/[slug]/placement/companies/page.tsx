import type { Metadata } from "next";
import Link from "next/link";

import { CmsForm } from "@/components/admin/cms-forms";
import { CampusTrail } from "@/components/campus/campus-trail";
import { PageHeader } from "@/components/common/page-header";
import { SectionHeading } from "@/components/common/section-heading";
import { Input } from "@/components/ui/input";
import { requireMember } from "@/lib/tenancy/context";
import { route } from "@/lib/utils";
import { listCompanies } from "@/services/placement";

import { createCompanyAction } from "../actions";

export const metadata: Metadata = { title: "Recruiters" };

const label = "text-sm font-medium";

export default async function PlacementCompaniesPage({
  params,
}: PageProps<"/campus/[slug]/placement/companies">) {
  const { slug } = await params;
  const ctx = await requireMember(slug, "placement.manage");
  const companies = await listCompanies(ctx);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 text-sm sm:px-6 sm:py-8">
      <PageHeader
        eyebrow={
          <CampusTrail
            items={[
              { label: ctx.institution.name, href: `/campus/${slug}` },
              { label: "Placement", href: `/campus/${slug}/placement` },
              { label: "Recruiters" },
            ]}
          />
        }
        title="Recruiters"
        description="Companies your college works with. Students never see contacts or notes."
      />

      <section aria-labelledby="companies" className="mt-6">
        <SectionHeading id="companies" title="Companies" count={companies.length} />
        {companies.length === 0 ? (
          <p className="mt-3 text-muted-foreground">
            No recruiters yet. Add the first below.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {companies.map((c) => (
              <li key={c.id}>
                <Link
                  href={route(`/campus/${slug}/placement/companies/${c.id}`)}
                  className="group flex flex-wrap items-center justify-between gap-2 py-3"
                >
                  <span>
                    <span className="block font-medium group-hover:text-brand-300">
                      {c.name}
                    </span>
                    {c.industry && (
                      <span className="text-muted-foreground">{c.industry}</span>
                    )}
                  </span>
                  <span className="font-mono text-xs text-subtle-foreground">
                    {c._count.contacts} contacts · {c._count.drives} drives
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="new-company" className="mt-8">
        <SectionHeading id="new-company" title="Add a recruiter" />
        <CmsForm
          action={createCompanyAction.bind(null, slug)}
          submitLabel="Add recruiter"
          className="mt-3 max-w-2xl"
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label htmlFor="c-name" className={label}>
                Name
              </label>
              <Input
                id="c-name"
                name="name"
                required
                maxLength={120}
                className="mt-1"
              />
            </div>
            <div>
              <label htmlFor="c-industry" className={label}>
                Industry
              </label>
              <Input id="c-industry" name="industry" maxLength={80} className="mt-1" />
            </div>
            <div>
              <label htmlFor="c-website" className={label}>
                Website
              </label>
              <Input
                id="c-website"
                name="website"
                type="url"
                maxLength={200}
                className="mt-1"
              />
            </div>
          </div>
        </CmsForm>
      </section>
    </div>
  );
}
