import type { Metadata } from "next";
import { AdminNav } from "@/components/admin/admin-nav";

import { requireAdmin } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · Admin · Tech Epitome" },
  robots: { index: false, follow: false, nocache: true },
};

/**
 * The admin shell.
 *
 * `requireAdmin` here rather than in each page: a layout runs before every
 * page beneath it, so there is one boundary rather than five that must all
 * remember. It redirects a signed-out visitor and `forbidden()`s a
 * signed-in non-admin, which returns a real 403 rather than a 404 — the
 * route's existence is not a secret, and pretending otherwise would make a
 * genuine permissions problem look like a broken link.
 *
 * Every page below still re-checks nothing and queries nothing sensitive
 * without going through `services/admin.ts`, which is the only module that
 * writes an audit row.
 *
 * Admin is a role. It is not, and must never become, a paid plan.
 */

const TABS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/institutions", label: "Institutions" },
  { href: "/admin/content", label: "Content" },
  { href: "/admin/courses", label: "Courses" },
  { href: "/admin/contests", label: "Contests" },
  { href: "/admin/ai", label: "AI usage" },
  { href: "/admin/audit", label: "Audit log" },
  { href: "/admin/operations", label: "Operations" },
] as const;

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  await requireAdmin();

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <p className="flex items-center gap-2 label-mono tracking-wider uppercase">
        <span className="size-1.5 bg-primary" aria-hidden="true" />
        Staff only
      </p>
      <h1 className="tracking-headline mt-1.5 text-2xl font-semibold sm:text-3xl">
        Platform admin
      </h1>
      <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">
        Accounts, institutions, content and operations. Every change made here is
        written to the audit log.
      </p>

      <AdminNav tabs={TABS} />

      <div className="mt-6">{children}</div>
    </div>
  );
}
