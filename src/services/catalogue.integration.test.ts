import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));

import { parseLibraryQuery } from "@/lib/catalogue/filters";
import { prisma } from "@/lib/db";

import { CHAPTERS_PER_PAGE, listSubjects, queryLibrary } from "./catalogue";

const tag = `lib${Date.now()}x${Math.floor(Math.random() * 1e6)}`;
const subject = `Subject ${tag}`;
let userId = "";
let otherId = "";
const ids: Record<string, string> = {};

type Params = Parameters<typeof parseLibraryQuery>[0];
const run = (params: Params, user?: string) =>
  queryLibrary(parseLibraryQuery({ subject, ...params }, Boolean(user)), user);
const titles = async (params: Params, user?: string) => {
  const result = await run(params, user);
  return result.items.map((i) => i.title);
};

async function course(
  key: string,
  data: {
    level?: "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
    estimatedHours?: number;
    status?: "PUBLISHED" | "DRAFT";
    description?: string;
    chapters: {
      title: string;
      difficulty?: "EASY" | "MEDIUM" | "HARD";
      draft?: boolean;
    }[];
  }
) {
  const row = await prisma.course.create({
    data: {
      slug: `${tag}-${key}`,
      title: `${key} course`,
      description: data.description ?? "A course used by the library tests.",
      track: "GENERAL",
      category: subject,
      status: data.status ?? "PUBLISHED",
      level: data.level ?? "BEGINNER",
      estimatedHours: data.estimatedHours ?? 3,
      sections: {
        create: {
          slug: "only",
          title: "Only",
          status: "PUBLISHED",
          chapters: {
            create: data.chapters.map((c, order) => ({
              slug: `c${order}`,
              title: c.title,
              order,
              readingMinutes: 5 + order,
              difficulty: c.difficulty ?? "EASY",
              status: c.draft ? ("DRAFT" as const) : ("PUBLISHED" as const),
            })),
          },
        },
      },
    },
    select: {
      id: true,
      sections: { select: { chapters: { select: { id: true, title: true } } } },
    },
  });
  ids[key] = row.id;
  for (const chapter of row.sections[0]!.chapters) ids[chapter.title] = chapter.id;
}

beforeAll(async () => {
  const [u, o] = await Promise.all([
    prisma.user.create({
      data: { email: `${tag}-a@techepitome.test` },
      select: { id: true },
    }),
    prisma.user.create({
      data: { email: `${tag}-b@techepitome.test` },
      select: { id: true },
    }),
  ]);
  userId = u.id;
  otherId = o.id;

  await course("Alpha", {
    estimatedHours: 2,
    chapters: [
      { title: `Variables ${tag}` },
      { title: `Loops ${tag}`, difficulty: "HARD" },
    ],
  });
  await course("Bravo", {
    level: "INTERMEDIATE",
    estimatedHours: 8,
    description: `Mentions variables ${tag} only in its description.`,
    chapters: [{ title: `Joins ${tag}`, difficulty: "MEDIUM" }],
  });
  await course("Charlie", {
    level: "ADVANCED",
    estimatedHours: 20,
    chapters: [
      { title: `Indexes ${tag}`, difficulty: "HARD" },
      { title: `Hidden ${tag}`, draft: true },
    ],
  });
  await course("Secret", {
    status: "DRAFT",
    chapters: [{ title: `Draft course lesson ${tag}` }],
  });

  await prisma.userChapterProgress.createMany({
    data: [
      {
        userId,
        chapterId: ids[`Variables ${tag}`]!,
        status: "COMPLETED",
        percent: 100,
      },
      { userId, chapterId: ids[`Joins ${tag}`]!, status: "COMPLETED", percent: 100 },
    ],
  });
});

afterAll(async () => {
  await prisma.course.deleteMany({ where: { slug: { startsWith: tag } } });
  await prisma.user.deleteMany({ where: { id: { in: [userId, otherId] } } });
});

describe("the library", () => {
  it("never shows a draft course or chapter", async () => {
    expect(await titles({})).toEqual([
      "Alpha course",
      "Bravo course",
      "Charlie course",
    ]);
    const chapters = await titles({ view: "chapters" });
    expect(chapters).not.toContain(`Hidden ${tag}`);
    expect(chapters).not.toContain(`Draft course lesson ${tag}`);
    expect((await run({ q: "Draft course lesson" })).total).toBe(0);
    expect((await run({ q: `Hidden ${tag}` })).total).toBe(0);
    expect(await listSubjects()).toContain(subject);
  });

  it("hides a course with no published chapter left", async () => {
    await course("Empty", { chapters: [{ title: `Only draft ${tag}`, draft: true }] });
    expect(await titles({})).not.toContain("Empty course");
    await prisma.course.delete({ where: { id: ids.Empty! } });
  });

  it("filters by each dimension", async () => {
    expect(await titles({ level: "ADVANCED" })).toEqual(["Charlie course"]);
    expect(await titles({ length: "short" })).toEqual(["Alpha course"]);
    expect(await titles({ length: "long" })).toEqual(["Charlie course"]);
    expect(await titles({ difficulty: "MEDIUM" })).toEqual(["Bravo course"]);
    expect(await titles({ subject: `No such ${tag}` })).toEqual([]);
  });

  it("does not call an unestimated course short", async () => {
    await course("Unknown", { estimatedHours: 0, chapters: [{ title: `Est ${tag}` }] });
    expect(await titles({ length: "short" })).not.toContain("Unknown course");
    await prisma.course.delete({ where: { id: ids.Unknown! } });
  });

  it("offers several values of a filter as either, and different filters as both", async () => {
    expect(await titles({ level: ["BEGINNER", "ADVANCED"] })).toEqual([
      "Alpha course",
      "Charlie course",
    ]);
    expect(
      await titles({ level: ["BEGINNER", "ADVANCED"], difficulty: "EASY" })
    ).toEqual(["Alpha course"]);
    expect(await titles({ level: "BEGINNER", length: "long" })).toEqual([]);
  });

  it("searches together with filters, and treats search text as data", async () => {
    expect(await titles({ q: `Joins ${tag}` })).toEqual(["Bravo course"]);
    expect(await titles({ q: `Variables ${tag}`, level: "BEGINNER" })).toEqual([
      "Alpha course",
    ]);
    expect(await titles({ q: `Variables ${tag}`, level: "ADVANCED" })).toEqual([]);
    expect((await run({ q: "'; DROP TABLE courses; --" })).total).toBe(0);
  });

  it("counts both lists under the same filters", async () => {
    const result = await run({ difficulty: "HARD" });
    expect(result.counts).toEqual({ courses: 2, chapters: 2 });
    expect((await run({ difficulty: "HARD", view: "chapters" })).counts).toEqual(
      result.counts
    );
  });

  it("sorts on real fields", async () => {
    expect(await titles({ sort: "title" })).toEqual([
      "Alpha course",
      "Bravo course",
      "Charlie course",
    ]);
    expect((await titles({ sort: "shortest" }))[0]).toBe("Alpha course");
    expect(await titles({ sort: "easiest" })).toEqual([
      "Alpha course",
      "Bravo course",
      "Charlie course",
    ]);
    await prisma.course.update({
      where: { id: ids.Charlie! },
      data: { subtitle: "touched" },
    });
    expect((await titles({ sort: "updated" }))[0]).toBe("Charlie course");
    expect(
      (await titles({ view: "chapters", sort: "easiest", level: "BEGINNER" }))[0]
    ).toBe(`Variables ${tag}`);
  });

  it("puts title matches first when ranking a search", async () => {
    // Bravo matches on its description, Alpha on a chapter; only Charlie's title does.
    await prisma.course.update({
      where: { id: ids.Charlie! },
      data: { title: `Charlie variables ${tag}` },
    });
    const ranked = await titles({ q: `variables ${tag}` });
    expect(ranked[0]).toBe(`Charlie variables ${tag}`);
    expect(ranked).toHaveLength(3);
    await prisma.course.update({
      where: { id: ids.Charlie! },
      data: { title: "Charlie course" },
    });
  });

  it("works out course status from chapters, for this learner only", async () => {
    expect(await titles({ status: "COMPLETED" }, userId)).toEqual(["Bravo course"]);
    expect(await titles({ status: "IN_PROGRESS" }, userId)).toEqual(["Alpha course"]);
    expect(await titles({ status: "NOT_STARTED" }, userId)).toEqual(["Charlie course"]);
    expect(await titles({ status: ["COMPLETED", "NOT_STARTED"] }, userId)).toEqual([
      "Bravo course",
      "Charlie course",
    ]);
    expect(await titles({ status: "COMPLETED" }, otherId)).toEqual([]);

    const result = await run({ status: "IN_PROGRESS" }, userId);
    expect(result.items[0]).toMatchObject({
      status: "IN_PROGRESS",
      completedChapters: 1,
      totalChapters: 2,
    });
    const anonymous = await run({ status: "COMPLETED" });
    expect(anonymous.total).toBe(3);
    expect(anonymous.items.every((i) => i.status === "NOT_STARTED")).toBe(true);
  });

  it("filters chapters by status too", async () => {
    const sorted = async (status: string) =>
      (await titles({ view: "chapters", status }, userId)).sort();
    expect(await sorted("COMPLETED")).toEqual([`Joins ${tag}`, `Variables ${tag}`]);
    expect(await sorted("NOT_STARTED")).toEqual([`Indexes ${tag}`, `Loops ${tag}`]);
  });

  it("pages through results under active filters without repeats", async () => {
    // Across the seeded catalogue, not just this test's courses.
    const all = { subject: undefined, view: "chapters", difficulty: "EASY" };
    const first = await run(all);
    expect(first.items.length).toBeLessThanOrEqual(CHAPTERS_PER_PAGE);
    expect(first.items.every((c) => "difficulty" in c && c.difficulty === "EASY")).toBe(
      true
    );
    if (first.totalPages > 1) {
      const second = await run({ ...all, page: "2" });
      const seen = new Set(first.items.map((i) => i.id));
      expect(second.items.some((i) => seen.has(i.id))).toBe(false);
    }
    const beyond = await run({ ...all, page: "9999" });
    expect(beyond.page).toBe(first.totalPages);
    expect(beyond.items.length).toBeGreaterThan(0);
  });

  it("pages a ranked search across title and non-title matches", async () => {
    const q = "the";
    const base = { subject: undefined, view: "chapters", q };
    const first = await run(base);
    if (first.totalPages < 2) return;
    const seen = new Set(first.items.map((i) => i.id));
    for (let page = 2; page <= first.totalPages; page += 1) {
      const next = await run({ ...base, page: String(page) });
      for (const item of next.items) {
        expect(seen.has(item.id)).toBe(false);
        seen.add(item.id);
      }
    }
    expect(seen.size).toBe(first.total);
  });
});
