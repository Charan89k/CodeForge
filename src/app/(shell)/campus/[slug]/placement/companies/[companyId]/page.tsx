import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CmsForm } from "@/components/admin/cms-forms";
import { CampusTrail } from "@/components/campus/campus-trail";
import { When } from "@/components/campus/when";
import { PageHeader } from "@/components/common/page-header";
import { SectionHeading } from "@/components/common/section-heading";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { requireMember } from "@/lib/tenancy/context";
import { route } from "@/lib/utils";
import { getCompany } from "@/services/placement";

import { addContactAction, addNoteAction } from "../../actions";

export const metadata: Metadata = { title: "Recruiter" };

const label = "text-sm font-medium";

export default async function PlacementCompanyPage({
  params,
}: PageProps<"/campus/[slug]/placement/companies/[companyId]">) {
  const { slug, companyId } = await params;
  const ctx = await requireMember(slug, "placement.manage");
  const company = await getCompany(ctx, companyId);
  if (!company) notFound();

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 text-sm sm:px-6 sm:py-8">
      <PageHeader
        eyebrow={
          <CampusTrail
            items={[
              { label: ctx.institution.name, href: `/campus/${slug}` },
              { label: "Placement", href: `/campus/${slug}/placement` },
              { label: "Recruiters", href: `/campus/${slug}/placement/companies` },
              { label: company.name },
            ]}
          />
        }
        title={company.name}
        description={company.industry ?? undefined}
      />
      {company.website && (
        <a
          href={company.website}
          rel="noreferrer noopener"
          className="mt-2 inline-block text-info underline"
        >
          {company.website}
        </a>
      )}

      <div className="mt-6 grid gap-8 lg:grid-cols-2">
        <section aria-labelledby="contacts">
          <SectionHeading
            id="contacts"
            title="Contacts"
            count={company.contacts.length}
          />
          <ul className="mt-2 divide-y divide-border">
            {company.contacts.map((c) => (
              <li key={c.id} className="py-2">
                <span className="font-medium">{c.name}</span>
                {c.title && <span className="text-muted-foreground">, {c.title}</span>}
                <span className="block font-mono text-xs text-subtle-foreground">
                  {[c.email, c.phone].filter(Boolean).join(" · ")}
                </span>
              </li>
            ))}
          </ul>
          <CmsForm
            action={addContactAction.bind(null, slug, company.id)}
            submitLabel="Add contact"
            size="sm"
            variant="outline"
            className="mt-3"
          >
            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <label htmlFor="ct-name" className={label}>
                  Name
                </label>
                <Input
                  id="ct-name"
                  name="name"
                  required
                  maxLength={120}
                  className="mt-1"
                />
              </div>
              <div>
                <label htmlFor="ct-title" className={label}>
                  Job title
                </label>
                <Input id="ct-title" name="title" maxLength={120} className="mt-1" />
              </div>
              <div>
                <label htmlFor="ct-email" className={label}>
                  Email
                </label>
                <Input
                  id="ct-email"
                  name="email"
                  type="email"
                  maxLength={254}
                  className="mt-1"
                />
              </div>
              <div>
                <label htmlFor="ct-phone" className={label}>
                  Phone
                </label>
                <Input id="ct-phone" name="phone" maxLength={40} className="mt-1" />
              </div>
            </div>
          </CmsForm>
        </section>

        <section aria-labelledby="notes">
          <SectionHeading
            id="notes"
            title="Communication history"
            count={company.notes.length}
          />
          <CmsForm
            action={addNoteAction.bind(null, slug, company.id)}
            submitLabel="Add note"
            size="sm"
            variant="outline"
            className="mt-3"
          >
            <label htmlFor="note-body" className="sr-only">
              Note
            </label>
            <Textarea id="note-body" name="body" required maxLength={5000} />
          </CmsForm>
          <ul className="mt-3 divide-y divide-border">
            {company.notes.map((n) => (
              <li key={n.id} className="py-2">
                <p className="whitespace-pre-line">{n.body}</p>
                <p className="mt-0.5 font-mono text-xs text-subtle-foreground">
                  {n.authorEmail} · <When date={n.createdAt} />
                </p>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section aria-labelledby="company-drives" className="mt-8">
        <SectionHeading
          id="company-drives"
          title="Drives"
          count={company.drives.length}
        />
        <ul className="mt-2 divide-y divide-border">
          {company.drives.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-2 py-2">
              <Link
                href={route(`/campus/${slug}/placement/drives/${d.id}`)}
                className="text-info hover:underline"
              >
                {d.title}
              </Link>
              <Badge variant="outline">{d.status.toLowerCase()}</Badge>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
