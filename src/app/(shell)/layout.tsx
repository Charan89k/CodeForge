import { AppRail } from "@/components/layout/app-rail";
import { CommandPaletteProvider } from "@/components/layout/command-palette";
import { ShellSurface } from "@/components/layout/shell-surface";
import { SiteHeader } from "@/components/layout/site-header";
import { getCurrentUser } from "@/lib/auth/session";
import { listMyMemberships } from "@/services/institutions";
import { unreadCount } from "@/services/notifications";
import { getStreak } from "@/services/progress";

/**
 * The application shell: a full-width header with section menus, a floating
 * icon rail, and the page beside it.
 *
 * Deliberately does NOT require authentication. Course, pattern and problem
 * pages are public and indexable - a visitor should be able to walk the
 * curriculum before creating an account, and see the navigation while they do
 * it. Pages that need a session call `requireUser` themselves, and `proxy.ts`
 * redirects unauthenticated requests to protected prefixes before they ever
 * reach a render.
 */
export default async function ShellLayout({ children }: LayoutProps<"/">) {
  const user = await getCurrentUser();
  // Two small per-user reads, in parallel, only when there is a user.
  const [streak, unread, memberships] = user
    ? await Promise.all([
        getStreak(user.id),
        unreadCount(user.id),
        listMyMemberships(user),
      ])
    : [0, 0, []];
  // Staff tools link to one college, so a teaching membership comes first.
  const primary = memberships.find((m) => m.role !== "STUDENT") ?? memberships[0];
  const campusMember = user?.role === "ADMIN" || memberships.length > 0;
  const campus = primary
    ? { slug: primary.institution.slug, role: primary.role }
    : null;

  return (
    <ShellSurface>
      <CommandPaletteProvider
        viewer={user ? { role: user.role, campusMember, campus } : null}
      >
        <SiteHeader
          user={
            user
              ? {
                  name: user.name,
                  email: user.email,
                  image: user.image,
                  role: user.role,
                  campusMember,
                  campus,
                }
              : null
          }
          streak={streak}
          unreadNotifications={unread}
        />
        <div className="flex min-h-0 flex-1">
          <AppRail user={user ? { role: user.role, campusMember, campus } : null} />
          {/* The one `main` landmark in the shell, and the skip link's
            target. Pages render sections inside it rather than a
            `main` of their own — nested `main` is invalid HTML and
            leaves a screen-reader user with two landmarks to choose
            between. */}
          <main id="main" className="min-w-0 flex-1">
            {children}
          </main>
        </div>
      </CommandPaletteProvider>
    </ShellSurface>
  );
}
