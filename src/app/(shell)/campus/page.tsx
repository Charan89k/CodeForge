import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Building2, ChevronRight, Info } from "lucide-react";

import { CampusNotice } from "@/components/campus/notice";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { SectionHeading } from "@/components/common/section-heading";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { navForViewer } from "@/lib/navigation";
import { route } from "@/lib/utils";
import { listMyMemberships } from "@/services/institutions";

import { joinByDomainAction, requestVerificationAction } from "./actions";

export const metadata: Metadata = { title: "Campus" };

/** Placement preparation comes with a membership; same items as the nav. */
const PREPARATION =
  navForViewer({ role: "USER", campusMember: true }, "campus").find(
    (group) => group.label === "Placement"
  )?.items ?? [];

const ROLE_LABEL = {
  STUDENT: "Student",
  FACULTY: "Faculty",
  PLACEMENT_OFFICER: "Placement officer",
  INSTITUTION_ADMIN: "Admin",
} as const;

/**
 * Your colleges. Individual learning is unaffected by any of this: a
 * membership adds a college workspace, it never moves or exposes your own
 * progress, notes or submissions.
 */
export default async function CampusPage({ searchParams }: PageProps<"/campus">) {
  const user = await requireUser("/campus");
  const { msg, need } = await searchParams;
  const [memberships, account] = await Promise.all([
    listMyMemberships(user),
    prisma.user.findUnique({ where: { id: user.id }, select: { emailVerified: true } }),
  ]);
  const verified = Boolean(account?.emailVerified);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <PageHeader
        title="Campus"
        description="Your college's classes, assignments and exams, plus mock interviews, interview preparation and roadmaps. Your own learning stays yours: a college sees its roster and the work it assigns, never your notes or conversations."
      />
      <div className="mt-6 space-y-3">
        {need === "membership" && memberships.length === 0 && (
          <Alert variant="info">
            <Info aria-hidden="true" />
            <AlertTitle>That is part of Campus</AlertTitle>
            <AlertDescription>
              Mock interviews, interview preparation and roadmaps come with your
              college&apos;s Campus workspace. Join with an invitation or a verified
              college email below; courses, patterns and problems stay open to you
              either way.
            </AlertDescription>
          </Alert>
        )}
        <CampusNotice code={msg} />
      </div>

      <section aria-labelledby="colleges-heading" className="mt-2">
        <SectionHeading
          id="colleges-heading"
          title="Your colleges"
          count={memberships.length}
        />
        {memberships.length === 0 ? (
          <EmptyState
            icon={Building2}
            title="You are not part of a college yet"
            description="Join with an invitation from your college, or with a verified college email address."
          />
        ) : (
          <ul className="divide-y divide-border">
            {memberships.map((m) => (
              <li key={m.institution.slug}>
                <Link
                  href={route(`/campus/${m.institution.slug}`)}
                  className="group flex items-center justify-between gap-4 py-3.5 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <span className="font-medium group-hover:text-brand-300">
                    {m.institution.name}
                  </span>
                  <span className="flex items-center gap-3">
                    <Badge variant="outline">{ROLE_LABEL[m.role]}</Badge>
                    <ChevronRight
                      className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                      aria-hidden="true"
                    />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {memberships.length > 0 && (
        <section aria-labelledby="prep-heading" className="mt-10">
          <SectionHeading
            id="prep-heading"
            title="Placement preparation"
            description="Included with your college membership."
          />
          <ul className="grid gap-x-8 sm:grid-cols-3">
            {PREPARATION.map((item) => (
              <li key={item.href} className="border-b border-border sm:border-b-0">
                <Link
                  href={route(item.href)}
                  className="group flex h-full flex-col gap-1.5 py-4 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <span className="flex items-center gap-2 font-medium group-hover:text-brand-300">
                    <item.icon className="size-4 text-brand-300" aria-hidden="true" />
                    {item.title}
                    <ArrowRight
                      className="ml-auto size-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                      aria-hidden="true"
                    />
                  </span>
                  {item.description && (
                    <span className="text-sm text-muted-foreground">
                      {item.description}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="join-heading" className="mt-10">
        <SectionHeading id="join-heading" title="Join with your college email" />
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
          If your college has verified its email domain, a verified address at that
          domain lets you join as a student. Staff roles are only ever granted by
          invitation.
        </p>
        <p className="mt-4 text-sm">
          {user.email}{" "}
          <Badge variant={verified ? "success" : "warning"} className="ml-1">
            {verified ? "Verified" : "Not verified"}
          </Badge>
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          {verified ? (
            <form action={joinByDomainAction}>
              <Button type="submit">Join my college</Button>
            </form>
          ) : (
            <form action={requestVerificationAction}>
              <Button type="submit" variant="outline">
                Send verification email
              </Button>
            </form>
          )}
        </div>
      </section>
    </div>
  );
}
