import { describe, expect, it } from "vitest";

import {
  activeFilterCount,
  clearedHref,
  libraryHref,
  parseLibraryQuery,
  toggleFilterHref,
} from "./filters";

describe("parseLibraryQuery", () => {
  it("defaults an empty URL to the first page of courses", () => {
    expect(parseLibraryQuery({}, false)).toEqual({
      view: "courses",
      q: "",
      subject: [],
      level: [],
      difficulty: [],
      length: [],
      status: [],
      sort: "best",
      page: 1,
    });
  });

  it("keeps several values of one filter", () => {
    const query = parseLibraryQuery(
      { level: ["BEGINNER", "ADVANCED"], subject: ["Databases", "Programming"] },
      false
    );
    expect(query.level).toEqual(["BEGINNER", "ADVANCED"]);
    expect(query.subject).toEqual(["Databases", "Programming"]);
  });

  it("drops values nobody offered", () => {
    const query = parseLibraryQuery(
      {
        view: "drafts",
        level: ["BEGINNER", "' OR 1=1 --"],
        difficulty: "IMPOSSIBLE",
        length: "forever",
        sort: "password",
      },
      true
    );
    expect(query).toMatchObject({
      view: "courses",
      level: ["BEGINNER"],
      difficulty: [],
      length: [],
      sort: "best",
    });
  });

  it.each(["-3", "0", "abc", "1e999", "99999999999999999999"])(
    "treats page %s as page one",
    (page) => {
      expect(parseLibraryQuery({ page }, false).page).toBe(1);
    }
  );

  it("bounds search and subject text, and deduplicates", () => {
    const query = parseLibraryQuery(
      {
        q: `  ${"x".repeat(500)}  `,
        subject: [
          "a",
          "a",
          " ",
          "y".repeat(500),
          ...Array(40)
            .fill(0)
            .map((_, i) => `s${i}`),
        ],
      },
      false
    );
    expect(query.q).toHaveLength(100);
    expect(query.subject).toHaveLength(10);
    expect(query.subject[0]).toBe("a");
    expect(query.subject[1]).toHaveLength(60);
  });

  it("ignores the progress filter without an account", () => {
    expect(parseLibraryQuery({ status: "COMPLETED" }, false).status).toEqual([]);
    expect(parseLibraryQuery({ status: "COMPLETED" }, true).status).toEqual([
      "COMPLETED",
    ]);
  });
});

describe("links", () => {
  const query = parseLibraryQuery(
    {
      q: "sql joins",
      level: ["BEGINNER"],
      subject: "Data & Storage",
      sort: "title",
      page: "3",
    },
    true
  );

  it("round-trips through the URL", () => {
    const href = libraryHref(query, { page: 3 });
    const params = new URL(href, "https://x.test").searchParams;
    expect(
      parseLibraryQuery(
        {
          q: params.get("q") ?? undefined,
          level: params.getAll("level"),
          subject: params.getAll("subject"),
          sort: params.get("sort") ?? undefined,
          page: params.get("page") ?? undefined,
        },
        true
      )
    ).toEqual(query);
  });

  it("returns to page one when a filter changes", () => {
    expect(toggleFilterHref(query, "difficulty", "EASY")).not.toContain("page=");
  });

  it("adds a value and removes it again, leaving the rest", () => {
    const added = toggleFilterHref(query, "level", "ADVANCED");
    expect(added).toContain("level=BEGINNER&level=ADVANCED");
    const removed = toggleFilterHref(query, "level", "BEGINNER");
    expect(removed).not.toContain("level=");
    expect(removed).toContain("q=sql+joins");
    expect(removed).toContain("subject=Data+%26+Storage");
  });

  it("clears everything but the list being viewed", () => {
    expect(clearedHref(query)).toBe("/learn");
    expect(clearedHref({ ...query, view: "chapters" })).toBe("/learn?view=chapters");
    expect(activeFilterCount(query)).toBe(2);
  });
});
