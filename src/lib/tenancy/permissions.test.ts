import { describe, expect, it } from "vitest";

import { can, canInviteRole, INSTITUTION_PERMISSIONS, type Actor } from "./permissions";

/**
 * The authorization matrix, asserted cell by cell rather than derived from
 * the table it is testing. A change here is a change to who can do what in
 * every college, so it should be a deliberate, visible diff.
 */
const student: Actor = { role: "STUDENT", platformAdmin: false };
const faculty: Actor = { role: "FACULTY", platformAdmin: false };
const admin: Actor = { role: "INSTITUTION_ADMIN", platformAdmin: false };
const platform: Actor = { role: null, platformAdmin: true };
const outsider: Actor = { role: null, platformAdmin: false };

describe("institution permissions", () => {
  it.each([
    ["institution.view", [true, true, true, true, false]],
    ["members.list", [false, true, true, true, false]],
    ["members.invite", [false, true, true, true, false]],
    ["members.manage", [false, false, true, true, false]],
    ["members.export", [false, false, true, true, false]],
    ["audit.view", [false, false, true, true, false]],
    ["classes.create", [false, true, true, true, false]],
    ["banks.manage", [false, true, true, true, false]],
    ["analytics.view", [false, true, true, true, false]],
    ["placement.manage", [false, false, true, true, false]],
  ] as const)(
    "%s: student, faculty, inst admin, platform, outsider",
    (permission, expected) => {
      expect(
        [student, faculty, admin, platform, outsider].map((a) => can(a, permission))
      ).toEqual(expected);
    }
  );

  it("covers every permission in the table", () => {
    expect(Object.keys(INSTITUTION_PERMISSIONS).sort()).toEqual([
      "analytics.view",
      "audit.view",
      "banks.manage",
      "classes.create",
      "institution.view",
      "members.export",
      "members.invite",
      "members.list",
      "members.manage",
      "placement.manage",
    ]);
  });

  it("gives a placement officer the placement office and nothing else of note", () => {
    const officer: Actor = { role: "PLACEMENT_OFFICER", platformAdmin: false };
    expect(can(officer, "placement.manage")).toBe(true);
    expect(can(officer, "institution.view")).toBe(true);
    for (const permission of [
      "members.manage",
      "members.export",
      "audit.view",
      "banks.manage",
    ] as const) {
      expect(can(officer, permission)).toBe(false);
    }
  });

  it("denies everything to a user with no membership", () => {
    for (const permission of Object.keys(INSTITUTION_PERMISSIONS)) {
      expect(can(outsider, permission as keyof typeof INSTITUTION_PERMISSIONS)).toBe(
        false
      );
    }
  });
});

describe("who may invite to which role", () => {
  it("lets faculty invite students only", () => {
    expect(canInviteRole(faculty, "STUDENT")).toBe(true);
    expect(canInviteRole(faculty, "FACULTY")).toBe(false);
    expect(canInviteRole(faculty, "INSTITUTION_ADMIN")).toBe(false);
  });

  it("lets institution and platform admins invite any role", () => {
    for (const actor of [admin, platform]) {
      expect(canInviteRole(actor, "STUDENT")).toBe(true);
      expect(canInviteRole(actor, "FACULTY")).toBe(true);
      expect(canInviteRole(actor, "INSTITUTION_ADMIN")).toBe(true);
    }
  });

  it("lets students and outsiders invite no one", () => {
    for (const actor of [student, outsider]) {
      expect(canInviteRole(actor, "STUDENT")).toBe(false);
    }
  });
});
