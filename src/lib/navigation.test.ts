import { describe, expect, it } from "vitest";

import { navForViewer, productForPath, surfaceForPath } from "./navigation";

describe("surfaceForPath", () => {
  it.each([
    ["/learn", "learn"],
    ["/learn/dsa/foundations/arrays/traversal", "learn"],
    ["/dashboard", "learn"],
    ["/problems", "learn"],
    ["/system-design", "learn"],
    ["/problems/two-pointers", "workspace"],
    ["/system-design/chat", "workspace"],
    ["/lld/parking", "workspace"],
    ["/visualize", "lab"],
    ["/visualize/binary-search", "lab"],
    ["/campus/x/placement", "campus"],
    ["/interviews", "campus"],
    ["/admin/courses", "admin"],
    ["/administrator", "learn"],
  ])("%s is %s", (path, surface) => {
    expect(surfaceForPath(path)).toBe(surface);
  });
});

/**
 * The header menus, mobile sheet, rail and command palette all list
 * navigation from `navForViewer`. Hiding a link is not access control (admin
 * pages call `requireAdmin`), but a learner should never be shown one.
 */
const hrefs = (viewer: Parameters<typeof navForViewer>[0]) =>
  navForViewer(viewer).flatMap((group) => group.items.map((item) => item.href));

describe("navForViewer", () => {
  it("hides admin links from signed-out visitors", () => {
    expect(hrefs(null)).not.toContain("/admin");
  });

  it("hides admin links from learners", () => {
    expect(hrefs({ role: "USER" })).not.toContain("/admin");
  });

  it("shows admin links to admins", () => {
    expect(hrefs({ role: "ADMIN" })).toContain("/admin");
  });

  it("drops a group that has nothing left to show", () => {
    expect(navForViewer({ role: "USER" }).map((group) => group.label)).not.toContain(
      "Staff"
    );
  });

  it("keeps the learner destinations for everyone", () => {
    for (const viewer of [null, { role: "USER" as const }]) {
      expect(hrefs(viewer)).toEqual(
        expect.arrayContaining(["/learn/dsa", "/patterns", "/problems", "/visualize"])
      );
    }
  });

  it("gives Learn a competitive Practice section", () => {
    const practice = navForViewer({ role: "USER" }).find((g) => g.label === "Practice");
    expect(practice?.items.map((item) => item.href)).toEqual(
      expect.arrayContaining([
        "/problems",
        "/daily",
        "/contests",
        "/leaderboard",
        "/visualize",
      ])
    );
  });

  it("decides the product from the path", () => {
    expect(productForPath("/campus/college")).toBe("campus");
    expect(productForPath("/interviews/abc")).toBe("campus");
    expect(productForPath("/problems")).toBe("learn");
    expect(productForPath("/campuses")).toBe("learn");
  });

  it("shows teaching tools only to staff of that college", () => {
    const labels = (role: "STUDENT" | "FACULTY" | "INSTITUTION_ADMIN") =>
      navForViewer(
        { role: "USER", campusMember: true, campus: { slug: "c", role } },
        "campus"
      ).map((g) => g.label);
    expect(labels("STUDENT")).not.toContain("Teaching");
    expect(labels("FACULTY")).toContain("Teaching");
    expect(labels("INSTITUTION_ADMIN")).toContain("Teaching");
  });

  it("keeps Campus-only links out of an individual learner's navigation", () => {
    for (const viewer of [
      null,
      { role: "USER" as const },
      { role: "USER" as const, campusMember: false },
    ]) {
      const links = hrefs(viewer);
      for (const href of ["/interviews", "/prepare", "/roadmaps"]) {
        expect(links).not.toContain(href);
      }
    }
  });

  it("shows the Campus offering to college members and admins, under Campus", () => {
    for (const viewer of [
      { role: "USER" as const, campusMember: true },
      { role: "ADMIN" as const },
    ]) {
      const campus = navForViewer(viewer, "campus").flatMap((g) =>
        g.items.map((i) => i.href)
      );
      expect(campus).toEqual(
        expect.arrayContaining([
          "/campus",
          "/interviews",
          "/prepare",
          "/roadmaps",
          "/campus/exams",
          "/campus/aptitude",
        ])
      );
    }
    const outsider = navForViewer({ role: "USER" }, "campus").flatMap((g) =>
      g.items.map((i) => i.href)
    );
    expect(outsider).toEqual(["/campus"]);
    const learn = navForViewer({ role: "USER", campusMember: true }).find(
      (g) => g.label === "Learn"
    );
    expect(learn?.items.map((item) => item.href)).not.toContain("/interviews");
  });
});
