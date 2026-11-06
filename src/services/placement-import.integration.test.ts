import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));

const { prisma } = await import("@/lib/db");
const { resolveMemberContext } = await import("@/lib/tenancy/context");
const placement = await import("./placement");

/**
 * The CSV import at its documented limit of 2,000 rows. Written one row at a
 * time it outlasted the 5 s transaction limit locally and saved nothing.
 */
const tag = `pli${Date.now()}${Math.floor(Math.random() * 1e6)}`;
const LIMIT = 2000;
const HEADER = "email,department,batch,cgpa,backlogs,attendance,skills";
let institutionId = "";
let officer: { id: string; email: string; name: string | null; role: "USER" };
const emails = Array.from(
  { length: LIMIT },
  (_, i) => `${tag}-s${String(i).padStart(4, "0")}@techepitome.test`
);
const office = async () => (await resolveMemberContext(officer, tag))!;
const csv = (rows: string[]) => [HEADER, ...rows].join("\n");
const row = (email: string, department = "CSE") =>
  `${email},${department},2027,8.1,0,90,Go;SQL`;

beforeAll(async () => {
  institutionId = (
    await prisma.institution.create({
      data: { name: "Import college", slug: tag },
      select: { id: true },
    })
  ).id;
  const user = await prisma.user.create({
    data: { email: `${tag}-officer@techepitome.test` },
    select: { id: true, email: true, name: true },
  });
  officer = { ...user, role: "USER" };
  await prisma.institutionMembership.create({
    data: {
      institutionId,
      userId: user.id,
      role: "PLACEMENT_OFFICER",
      source: "INVITATION",
    },
  });
  const ids = emails.map((email) => email.split("@")[0]!);
  await prisma.user.createMany({
    data: ids.map((id, i) => ({ id, email: emails[i]! })),
  });
  await prisma.institutionMembership.createMany({
    data: ids.map((userId) => ({
      institutionId,
      userId,
      role: "STUDENT" as const,
      source: "INVITATION" as const,
    })),
  });
}, 60_000);

afterAll(async () => {
  await prisma.placementRecord.deleteMany({ where: { institutionId } });
  await prisma.institutionMembership.deleteMany({ where: { institutionId } });
  await prisma.user.deleteMany({ where: { email: { startsWith: tag } } });
  await prisma.$disconnect();
});

const records = () => prisma.placementRecord.count({ where: { institutionId } });

describe("importing placement records", () => {
  it("refuses a bad file at full size and writes nothing, naming the file's line", async () => {
    const rows = emails.map((email) => row(email));
    rows[LIMIT - 1] = `${emails[LIMIT - 1]},CSE,2027,eleven,0,90,`;

    const result = await placement.importPlacementRecords(await office(), csv(rows));

    expect(result.saved).toBe(0);
    expect(result.rows.filter((r) => r.error)).toEqual([
      expect.objectContaining({
        line: LIMIT + 1,
        error: expect.stringMatching(/^cgpa/),
      }),
    ]);
    expect(await records()).toBe(0);
  });

  it("refuses a student listed twice", async () => {
    const result = await placement.importPlacementRecords(
      await office(),
      csv([row(emails[0]!), row(emails[1]!), row(emails[0]!.toUpperCase())])
    );

    expect(result.saved).toBe(0);
    expect(result.rows[2]).toMatchObject({ line: 4, error: "Already on line 2." });
  });

  it("saves 2,000 rows inside the transaction limit, with an audit entry each", async () => {
    const started = Date.now();
    const result = await placement.importPlacementRecords(
      await office(),
      csv(emails.map((email) => row(email)))
    );

    expect(result.saved).toBe(LIMIT);
    expect(Date.now() - started).toBeLessThan(5_000);
    expect(await records()).toBe(LIMIT);
    await expect(
      prisma.institutionAuditLog.count({
        where: { institutionId, action: "placement.record_saved" },
      })
    ).resolves.toBe(LIMIT);
    const saved = await prisma.placementRecord.findFirstOrThrow({
      where: { institutionId, user: { email: emails[LIMIT - 1] } },
    });
    expect(saved).toMatchObject({
      department: "CSE",
      batchYear: 2027,
      backlogs: 0,
      attendancePercent: 90,
      skills: ["Go", "SQL"],
      updatedById: officer.id,
    });
    expect(Number(saved.cgpa)).toBe(8.1);
    expect(Math.abs(saved.updatedAt.getTime() - Date.now())).toBeLessThan(60_000);
  }, 30_000);

  it("updates in place when imported again", async () => {
    const result = await placement.importPlacementRecords(
      await office(),
      csv(emails.map((email) => row(email, "ECE")))
    );

    expect(result.saved).toBe(LIMIT);
    expect(await records()).toBe(LIMIT);
    await expect(
      prisma.placementRecord.count({ where: { institutionId, department: "ECE" } })
    ).resolves.toBe(LIMIT);
  }, 30_000);

  it("refuses more than 2,000 rows", async () => {
    await expect(
      placement.importPlacementRecords(
        await office(),
        csv([...emails.map((email) => row(email)), row("extra@techepitome.test")])
      )
    ).rejects.toMatchObject({ code: "invalid" });
  });
});
