import type { Metadata } from "next";
import Link from "next/link";
import {
  BriefcaseBusiness,
  ChevronRight,
  Download,
  Library,
  LineChart,
  ScrollText,
  Upload,
} from "lucide-react";

import { CampusNotice } from "@/components/campus/notice";
import { CampusTrail } from "@/components/campus/campus-trail";
import { PageHeader } from "@/components/common/page-header";
import { SectionHeading } from "@/components/common/section-heading";
import { Badge } from "@/components/ui/badge";
import { InviteForm } from "@/components/campus/invite-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { requireMember } from "@/lib/tenancy/context";
import { can, canInviteRole } from "@/lib/tenancy/permissions";
import { cn, route } from "@/lib/utils";
import { listClasses } from "@/services/campus-classes";
import {
  listMembers,
  listPendingInvitations,
  type MemberRow,
} from "@/services/institutions";
import type { InstitutionRole } from "@/generated/prisma/enums";

import {
  changeRoleAction,
  inviteAction,
  leaveAction,
  revokeInvitationAction,
  setStatusAction,
} from "../actions";
import { createClassAction } from "../learning-actions";

export const metadata: Metadata = { title: "College" };

const ROLES: { value: InstitutionRole; label: string }[] = [
  { value: "STUDENT", label: "Student" },
  { value: "FACULTY", label: "Faculty" },
  { value: "PLACEMENT_OFFICER", label: "Placement officer" },
  { value: "INSTITUTION_ADMIN", label: "Admin" },
];
const roleLabel = (role: InstitutionRole) =>
  ROLES.find((r) => r.value === role)?.label ?? role;

/**
 * One college workspace. What renders depends on the caller's permissions,
 * but nothing here is the security boundary: every action re-resolves the
 * member from the session and the service checks the permission again.
 */
export default async function InstitutionPage({
  params,
  searchParams,
}: PageProps<"/campus/[slug]">) {
  const { slug } = await params;
  const { msg } = await searchParams;
  const ctx = await requireMember(slug);

  const [members, invitations, classes] = await Promise.all([
    can(ctx, "members.list") ? listMembers(ctx) : Promise.resolve(null),
    can(ctx, "members.invite") ? listPendingInvitations(ctx) : Promise.resolve(null),
    listClasses(ctx),
  ]);
  const invitableRoles = ROLES.filter((r) => canInviteRole(ctx, r.value));
  const manage = can(ctx, "members.manage");

  const activeMembers = members?.filter((m) => m.status === "ACTIVE").length;
  const summary = [
    { label: "Classes", value: classes.length },
    ...(activeMembers !== undefined
      ? [{ label: "Active members", value: activeMembers }]
      : []),
    ...(invitations
      ? [{ label: "Pending invitations", value: invitations.length }]
      : []),
    { label: "Your role", value: ctx.role ? roleLabel(ctx.role) : "Operator" },
  ];
  // Each tool shows only for the roles allowed to use it; the pages enforce
  // the same permissions on the server.
  const tools = (
    [
      ["analytics.view", "analytics", "Analytics", LineChart],
      ["members.invite", "import", "Import roster", Upload],
      ["banks.manage", "banks", "Question banks", Library],
      ["placement.manage", "placement", "Placement office", BriefcaseBusiness],
      ["audit.view", "audit", "Audit log", ScrollText],
    ] as const
  ).filter(([permission]) => can(ctx, permission));

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <PageHeader
        eyebrow={<CampusTrail items={[{ label: ctx.institution.name }]} />}
        title={ctx.institution.name}
        description={
          ctx.role
            ? `Your role here is ${roleLabel(ctx.role).toLowerCase()}.`
            : "Platform operator view."
        }
        actions={
          can(ctx, "members.export") && (
            <Button asChild variant="outline" size="sm">
              <a href={`/campus/${ctx.institution.slug}/members.csv`}>
                <Download className="size-4" aria-hidden="true" />
                Export roster
              </a>
            </Button>
          )
        }
      />

      <dl className="mt-6 grid grid-cols-2 border-y border-border sm:grid-cols-4">
        {summary.map((item, index) => (
          <div
            key={item.label}
            className={cn(
              "flex flex-col-reverse gap-0.5 py-3 pr-4",
              index % 2 === 1 && "pl-4 max-sm:border-l max-sm:border-border",
              index > 0 && "sm:border-l sm:border-border sm:pl-4",
              index > 1 && "max-sm:border-t max-sm:border-border"
            )}
          >
            <dt className="label-mono">{item.label}</dt>
            <dd className="font-mono text-xl font-medium tabular-nums">{item.value}</dd>
          </div>
        ))}
      </dl>

      {tools.length > 0 && (
        <nav aria-label="Workspace tools" className="mt-4 flex flex-wrap gap-2">
          {tools.map(([, path, label, Icon]) => (
            <Link
              key={path}
              href={route(`/campus/${ctx.institution.slug}/${path}`)}
              className="inline-flex h-9 items-center gap-2 rounded-md border border-border px-3 text-sm font-medium text-muted-foreground transition-colors outline-none hover:border-brand-500/50 hover:bg-accent/50 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <Icon className="size-4 text-brand-300" aria-hidden="true" />
              {label}
            </Link>
          ))}
        </nav>
      )}
      <div className="mt-6">
        <CampusNotice code={msg} />
      </div>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section aria-labelledby="classes-heading" className="min-w-0">
          <SectionHeading
            id="classes-heading"
            title="Classes"
            count={classes.length}
            description="Assignments, assessments and progress live inside each class."
          />
          {classes.length === 0 ? (
            <p className="py-6 text-sm text-muted-foreground">
              {can(ctx, "classes.create")
                ? "No classes yet. Create one to assign content and run assessments."
                : "You are not in any class here yet. Your instructor adds you."}
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {classes.map((c) => (
                <li key={c.id}>
                  <Link
                    href={route(`/campus/${ctx.institution.slug}/classes/${c.id}`)}
                    className="group flex items-center justify-between gap-3 py-3.5 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    <div className="min-w-0">
                      <span className="font-medium group-hover:text-brand-300">
                        {c.name}
                      </span>
                      {c.description && (
                        <p className="truncate text-xs text-muted-foreground">
                          {c.description}
                        </p>
                      )}
                    </div>
                    <span className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
                      {c.teaching && (
                        <span>
                          Teaching ·{" "}
                          <span className="font-mono tabular-nums">{c.students}</span>{" "}
                          {c.students === 1 ? "student" : "students"}
                        </span>
                      )}
                      <ChevronRight
                        className="size-4 transition-transform group-hover:translate-x-0.5"
                        aria-hidden="true"
                      />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {can(ctx, "classes.create") && (
            <form
              action={createClassAction.bind(null, ctx.institution.slug)}
              className="mt-2 flex flex-col gap-3 rounded-lg border border-dashed border-border p-4 sm:flex-row sm:items-end"
            >
              <div className="flex-1">
                <label htmlFor="class-name" className="text-sm font-medium">
                  New class name
                </label>
                <Input
                  id="class-name"
                  name="name"
                  required
                  maxLength={120}
                  className="mt-1"
                />
              </div>
              <Button type="submit">Create class</Button>
            </form>
          )}
        </section>

        <aside className="space-y-8">
          {invitations && invitableRoles.length > 0 && (
            <section aria-labelledby="invite-heading">
              <SectionHeading
                id="invite-heading"
                title="Invite someone"
                description="They join with the role you choose."
              />
              <div className="mt-3">
                <InviteForm
                  action={inviteAction.bind(null, ctx.institution.slug)}
                  className="space-y-3"
                  submitLabel="Send invitation"
                  submitClassName="w-full"
                >
                  <div>
                    <label htmlFor="invite-email" className="text-sm font-medium">
                      Email
                    </label>
                    <Input
                      id="invite-email"
                      name="email"
                      type="email"
                      required
                      maxLength={254}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <label htmlFor="invite-role" className="text-sm font-medium">
                      Role
                    </label>
                    <NativeSelect id="invite-role" name="role" className="mt-1 w-full">
                      {invitableRoles.map((r) => (
                        <option key={r.value} value={r.value}>
                          {r.label}
                        </option>
                      ))}
                    </NativeSelect>
                  </div>
                </InviteForm>
              </div>

              {invitations.length > 0 && (
                <>
                  <h3 className="mt-6 label-mono tracking-wider uppercase">
                    Pending · {invitations.length}
                  </h3>
                  <ul className="mt-2 divide-y divide-border border-y border-border text-sm">
                    {invitations.map((inv) => (
                      <li
                        key={inv.id}
                        className="flex items-start justify-between gap-3 py-2"
                      >
                        <span className="min-w-0">
                          <span className="block truncate">{inv.email}</span>
                          <span className="text-xs text-muted-foreground">
                            {roleLabel(inv.role)}
                          </span>
                          {inv.emailStatus && inv.emailStatus !== "accepted" && (
                            <Badge variant="warning" className="mt-1">
                              Email not delivered: invite again to resend
                            </Badge>
                          )}
                        </span>
                        {canInviteRole(ctx, inv.role) && (
                          <form
                            action={revokeInvitationAction.bind(
                              null,
                              ctx.institution.slug,
                              inv.id
                            )}
                          >
                            <Button type="submit" variant="ghost" size="sm">
                              Revoke
                            </Button>
                          </form>
                        )}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </section>
          )}

          {ctx.membershipId && (
            <section aria-labelledby="leave-heading">
              <SectionHeading id="leave-heading" title="Leave this college" />
              <p className="mt-3 text-xs text-muted-foreground">
                Your own learning stays with your account after you leave.
              </p>
              <form
                action={leaveAction.bind(null, ctx.institution.slug)}
                className="mt-3"
              >
                <Button type="submit" variant="destructive" size="sm">
                  Leave {ctx.institution.name}
                </Button>
              </form>
            </section>
          )}
        </aside>
      </div>

      {members && (
        <section aria-labelledby="members-heading" className="mt-10">
          <SectionHeading id="members-heading" title="Members" count={members.length} />
          {manage && (
            <details className="mt-3 text-xs text-muted-foreground">
              <summary className="cursor-pointer">
                What suspending and revoking do
              </summary>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>
                  <strong>Suspend</strong>: access to this college ends on their next
                  request, and their pending invitations are cancelled. Class places,
                  attempts and grades are kept. Reactivate restores everything.
                </li>
                <li>
                  <strong>Revoke</strong>: the same, and final. Only a new invitation
                  from an admin brings them back. Their own learning outside this
                  college is never touched.
                </li>
                <li>
                  An institution always keeps one active admin, and every change is in
                  the audit log.
                </li>
              </ul>
            </details>
          )}
          <div className="mt-3 overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-[40rem] text-sm">
              <caption className="sr-only">Members of {ctx.institution.name}</caption>
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left [&>th]:label-mono [&>th]:font-normal">
                  <th scope="col" className="px-4 py-2.5">
                    Member
                  </th>
                  <th scope="col" className="px-2 py-2.5">
                    Role
                  </th>
                  <th scope="col" className="px-2 py-2.5">
                    Status
                  </th>
                  {manage && (
                    <th scope="col" className="px-4 py-2.5 text-right">
                      Actions
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {members.map((m) => (
                  <MemberTableRow
                    key={m.id}
                    member={m}
                    slug={ctx.institution.slug}
                    manage={manage && m.user.id !== ctx.user.id}
                    showActionsColumn={manage}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

function MemberTableRow({
  member,
  slug,
  manage,
  showActionsColumn,
}: {
  member: MemberRow;
  slug: string;
  manage: boolean;
  showActionsColumn: boolean;
}) {
  const statusVariant =
    member.status === "ACTIVE"
      ? "success"
      : member.status === "SUSPENDED"
        ? "warning"
        : "outline";
  const editable = manage && member.status !== "REVOKED";
  return (
    <tr>
      <td className="px-4 py-3">
        <span className="block font-medium">
          {member.user.name ?? member.user.email}
        </span>
        <span className="block text-xs text-muted-foreground">{member.user.email}</span>
      </td>
      <td className="px-2 py-3">
        {editable ? (
          <form
            action={changeRoleAction.bind(null, slug, member.id)}
            className="flex items-center gap-1.5"
          >
            <label htmlFor={`role-${member.id}`} className="sr-only">
              Role for {member.user.email}
            </label>
            <NativeSelect
              id={`role-${member.id}`}
              name="role"
              defaultValue={member.role}
              size="sm"
            >
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </NativeSelect>
            <Button type="submit" variant="ghost" size="xs">
              Save
            </Button>
          </form>
        ) : (
          roleLabel(member.role)
        )}
      </td>
      <td className="px-2 py-3">
        <Badge variant={statusVariant}>{member.status.toLowerCase()}</Badge>
      </td>
      {showActionsColumn && (
        <td className="px-4 py-3">
          {editable && (
            <div className="flex justify-end gap-1">
              <form
                action={setStatusAction.bind(
                  null,
                  slug,
                  member.id,
                  member.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE"
                )}
              >
                <Button type="submit" variant="outline" size="xs">
                  {member.status === "ACTIVE" ? "Suspend" : "Reactivate"}
                </Button>
              </form>
              <details className="relative">
                <summary className="cursor-pointer list-none rounded-md border border-destructive/40 px-2 py-0.5 text-xs text-destructive">
                  Revoke…
                </summary>
                <form
                  action={setStatusAction.bind(null, slug, member.id, "REVOKED")}
                  className="absolute right-0 z-10 mt-1 w-56 rounded-md border border-border bg-popover p-2 text-left text-xs shadow"
                >
                  <p>Final: only a new invitation brings {member.user.email} back.</p>
                  <Button
                    type="submit"
                    variant="destructive"
                    size="xs"
                    className="mt-2"
                  >
                    Revoke membership
                  </Button>
                </form>
              </details>
            </div>
          )}
        </td>
      )}
    </tr>
  );
}
