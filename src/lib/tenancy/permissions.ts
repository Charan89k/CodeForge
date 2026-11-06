import type { InstitutionRole } from "@/generated/prisma/enums";

/**
 * What each role may do inside ONE institution.
 *
 * Deny by default: an action not listed for a role is refused. A platform
 * admin (User.role ADMIN) operates every institution with the institution
 * admin's rights, and is the only actor who can create institutions, manage
 * domains or suspend accounts; those platform actions are checked with
 * `requireAdmin*`, not here.
 *
 * Membership grants nothing outside its institution, and nothing over a
 * member's personal learning: no permission here reads notes, submissions,
 * tutor chats or interview transcripts, and the database role these
 * actions run under has no grant on those tables at all.
 */
export const INSTITUTION_PERMISSIONS = {
  /** See the institution and your own membership. */
  "institution.view": ["STUDENT", "FACULTY", "INSTITUTION_ADMIN", "PLACEMENT_OFFICER"],
  /** Drives, recruiters, student placement records and placement reports. */
  "placement.manage": ["PLACEMENT_OFFICER", "INSTITUTION_ADMIN"],
  /** See the roster: names, emails, roles and statuses. */
  "members.list": ["FACULTY", "INSTITUTION_ADMIN"],
  /** Invite people; faculty may invite students only (see canInviteRole). */
  "members.invite": ["FACULTY", "INSTITUTION_ADMIN"],
  /** Change roles, suspend, reactivate and revoke memberships. */
  "members.manage": ["INSTITUTION_ADMIN"],
  /** Download the roster as CSV. */
  "members.export": ["INSTITUTION_ADMIN"],
  /** Read the institution's audit log. */
  "audit.view": ["INSTITUTION_ADMIN"],
  /**
   * Create classes. Managing one afterwards needs more: being its
   * instructor, or an institution admin (`teaches` in services/campus).
   */
  "classes.create": ["FACULTY", "INSTITUTION_ADMIN"],
  /** Read and edit the institution's question banks (they hold answers). */
  "banks.manage": ["FACULTY", "INSTITUTION_ADMIN"],
  /**
   * Learning analytics. Faculty see only classes they teach; admins see
   * the whole institution, including enrolment by role.
   */
  "analytics.view": ["FACULTY", "INSTITUTION_ADMIN"],
} as const satisfies Record<string, readonly InstitutionRole[]>;

export type InstitutionPermission = keyof typeof INSTITUTION_PERMISSIONS;

/** Who is acting, as far as permissions are concerned. */
export type Actor = {
  /** The caller's ACTIVE membership role here, or null if they have none. */
  role: InstitutionRole | null;
  /** User.role ADMIN: the platform operator. */
  platformAdmin: boolean;
};

export function can(actor: Actor, permission: InstitutionPermission): boolean {
  if (actor.platformAdmin) return true;
  if (!actor.role) return false;
  return (INSTITUTION_PERMISSIONS[permission] as readonly InstitutionRole[]).includes(
    actor.role
  );
}

/**
 * Which roles the actor may hand out. Nobody can grant a role above their
 * own, so a faculty member cannot mint an institution admin.
 */
export function canInviteRole(actor: Actor, role: InstitutionRole): boolean {
  if (!can(actor, "members.invite")) return false;
  if (actor.platformAdmin || actor.role === "INSTITUTION_ADMIN") return true;
  return role === "STUDENT";
}
