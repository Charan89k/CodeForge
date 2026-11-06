import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));

// Races only appear with parallel connections; the suite default is a pool of 1.
process.env.DATABASE_POOL_MAX = "8";

const { prisma } = await import("@/lib/db");
const { resolveMemberContext } = await import("@/lib/tenancy/context");
const { withTenantScope } = await import("@/lib/tenancy/scope");
const placement = await import("./placement");

type Ctx = NonNullable<Awaited<ReturnType<typeof resolveMemberContext>>>;

const tag = `plc${Date.now()}${Math.floor(Math.random() * 1e6)}`;
const FUTURE = new Date("2099-01-01T00:00:00Z");
const users: Record<
  string,
  { id: string; email: string; name: string | null; role: "USER" }
> = {};
const institutions: Record<string, string> = {};
const ctx = async (who: string, college: string): Promise<Ctx> =>
  (await resolveMemberContext(users[who]!, `${tag}-${college}`))!;

const student = {
  department: "CSE",
  batchYear: 2027,
  cgpa: 8,
  backlogs: 0,
  attendancePercent: 90,
  skills: ["Python"],
};
const driveInput = (companyId: string, title: string) => ({
  companyId,
  title,
  description: "A role.",
  packageLpa: 12,
  isInternship: false,
  deadline: FUTURE,
  minCgpa: 7,
  maxBacklogs: 0,
  minAttendance: null,
  departments: ["CSE"],
  batchYears: [2027],
  requiredSkills: [],
  excludePlaced: true,
});

describe("the placement cell", () => {
  beforeAll(async () => {
    for (const college of ["a", "b"]) {
      const row = await prisma.institution.create({
        data: { name: `Test ${college}`, slug: `${tag}-${college}` },
        select: { id: true },
      });
      institutions[college] = row.id;
    }
    const people: [string, string, "STUDENT" | "FACULTY" | "PLACEMENT_OFFICER"][] = [
      ["officer", "a", "PLACEMENT_OFFICER"],
      ["faculty", "a", "FACULTY"],
      ["alice", "a", "STUDENT"],
      ["weak", "a", "STUDENT"],
      ["outsider", "b", "PLACEMENT_OFFICER"],
    ];
    for (const [who, college, role] of people) {
      const user = await prisma.user.create({
        data: { email: `${tag}-${who}@techepitome.test`, profile: { create: {} } },
        select: { id: true, email: true, name: true },
      });
      users[who] = { ...user, role: "USER" };
      await prisma.institutionMembership.create({
        data: {
          institutionId: institutions[college]!,
          userId: user.id,
          role,
          source: "INVITATION",
        },
      });
    }
  });

  afterAll(async () => {
    const where = { institutionId: { in: Object.values(institutions) } };
    await prisma.placementApplication.deleteMany({ where });
    await prisma.placementDrive.deleteMany({ where });
    await prisma.recruiterCompany.deleteMany({ where });
    await prisma.placementRecord.deleteMany({ where });
    await prisma.institutionMembership.deleteMany({ where });
    await prisma.user.deleteMany({ where: { email: { startsWith: tag } } });
    await prisma.$disconnect();
  });

  it("refuses faculty and students everything in the office", async () => {
    for (const who of ["faculty", "alice"]) {
      const c = await ctx(who, "a");
      await expect(placement.listCompanies(c)).rejects.toMatchObject({
        code: "forbidden",
      });
      await expect(
        placement.createCompany(c, { name: "X Corp" })
      ).rejects.toMatchObject({
        code: "forbidden",
      });
      await expect(placement.getPlacementReport(c)).rejects.toMatchObject({
        code: "forbidden",
      });
    }
  });

  it("runs the whole flow, and stores why a student was eligible", async () => {
    const office = await ctx("officer", "a");
    const alice = await ctx("alice", "a");
    await placement.upsertPlacementRecord(office, users.alice!.id, student);
    const { id: companyId } = await placement.createCompany(office, { name: "Acme" });
    await placement.addContact(office, companyId, { name: "Recruiter One" });
    await placement.addCompanyNote(office, companyId, "Called about the 2027 batch.");
    const { id: driveId } = await placement.createDrive(
      office,
      driveInput(companyId, "SDE")
    );

    // A draft is invisible, and cannot be applied to.
    expect((await placement.getStudentPlacement(alice)).drives).toHaveLength(0);
    await expect(placement.applyToDrive(alice, driveId)).rejects.toMatchObject({
      code: "not_found",
    });

    await placement.setDriveStatus(office, driveId, "OPEN");
    await placement.applyToDrive(alice, driveId);
    await expect(placement.applyToDrive(alice, driveId)).rejects.toMatchObject({
      code: "conflict",
    });

    const detail = await placement.getOfficeDrive(office, driveId);
    const application = detail!.drive.applications[0]!;
    expect(detail!.eligibleCount).toBe(1);
    expect(application.eligibility).toMatchObject({ eligible: true });

    await expect(
      placement.moveApplication(office, application.id, "OFFERED", { offerLpa: 12 })
    ).rejects.toMatchObject({ code: "conflict" });
    await placement.moveApplication(office, application.id, "SHORTLISTED");
    await expect(
      placement.moveApplication(office, application.id, "OFFERED")
    ).rejects.toMatchObject({ code: "invalid" });
    for (const offerLpa of [Number.NaN, -1, 100000]) {
      await expect(
        placement.moveApplication(office, application.id, "OFFERED", { offerLpa })
      ).rejects.toMatchObject({ code: "invalid" });
    }
    await placement.moveApplication(office, application.id, "OFFERED", {
      offerLpa: 12,
    });

    // The office can never accept for the student.
    await expect(
      placement.moveApplication(office, application.id, "ACCEPTED")
    ).rejects.toMatchObject({ code: "conflict" });
    await placement.respondToOffer(alice, application.id, true);

    const report = await placement.getPlacementReport(office);
    expect(report).toMatchObject({
      placed: 1,
      highestLpa: 12,
      medianLpa: 12,
      students: 2,
    });
    expect(report.byDepartment).toEqual([
      { department: "CSE", students: 1, placed: 1 },
    ]);
    expect(await placement.exportPlacementCsv(office)).toContain("Acme");

    // Placed now, so a drive excluding the placed refuses them, with the reason.
    const second = await placement.createDrive(office, driveInput(companyId, "SDE 2"));
    await placement.setDriveStatus(office, second.id, "OPEN");
    await expect(placement.applyToDrive(alice, second.id)).rejects.toMatchObject({
      code: "forbidden",
    });
  });

  it("refuses an ineligible student, a passed deadline and a non-student on the server", async () => {
    const office = await ctx("officer", "a");
    const weak = await ctx("weak", "a");
    await placement.upsertPlacementRecord(office, users.weak!.id, {
      ...student,
      cgpa: 5,
    });
    const { id: companyId } = await placement.createCompany(office, { name: "Beta" });
    const { id } = await placement.createDrive(
      office,
      driveInput(companyId, "Analyst")
    );
    await placement.setDriveStatus(office, id, "OPEN");

    await expect(placement.applyToDrive(weak, id)).rejects.toMatchObject({
      code: "forbidden",
    });
    await placement.upsertPlacementRecord(office, users.weak!.id, student);
    await expect(
      placement.applyToDrive(weak, id, new Date("2100-01-01"))
    ).rejects.toMatchObject({
      code: "conflict",
    });
    await expect(placement.applyToDrive(office, id)).rejects.toMatchObject({
      code: "forbidden",
    });
  });

  it("refuses a recruiter website that is not http or https", async () => {
    const office = await ctx("officer", "a");
    await expect(
      placement.createCompany(office, {
        name: "Bad Link",
        website: "javascript:alert(1)",
      })
    ).rejects.toMatchObject({ code: "invalid" });
  });

  it("refuses a record for someone who is not a student here", async () => {
    const office = await ctx("officer", "a");
    await expect(
      placement.upsertPlacementRecord(office, users.outsider!.id, student)
    ).rejects.toMatchObject({ code: "not_found" });
  });

  it("imports nothing when any row is bad", async () => {
    const office = await ctx("officer", "a");
    const before = await prisma.placementRecord.count({
      where: { institutionId: institutions.a! },
    });
    const result = await placement.importPlacementRecords(
      office,
      `email,department,batch,cgpa,backlogs,attendance,skills\n${users.alice!.email},ECE,2027,8.5,0,90,Go;SQL\nnobody@x.test,ECE,2027,8,0,90,`
    );
    expect(result.saved).toBe(0);
    expect(result.rows[1]?.error).toMatch(/Not an active student/);
    expect(
      await prisma.placementRecord.count({ where: { institutionId: institutions.a! } })
    ).toBe(before);
  });

  describe("across colleges", () => {
    it("shows another college's office nothing, by id or by listing", async () => {
      const office = await ctx("officer", "a");
      const other = await ctx("outsider", "b");
      const companies = await placement.listCompanies(office);
      const drives = await placement.listOfficeDrives(office);
      expect(companies.length).toBeGreaterThan(0);

      expect(await placement.listCompanies(other)).toEqual([]);
      expect(await placement.listOfficeDrives(other)).toEqual([]);
      expect(await placement.getCompany(other, companies[0]!.id)).toBeNull();
      expect(await placement.getOfficeDrive(other, drives[0]!.id)).toBeNull();
      await expect(
        placement.addCompanyNote(other, companies[0]!.id, "Snooping")
      ).rejects.toMatchObject({ code: "not_found" });
    });

    it("has row-level security refuse even a query with no college filter", async () => {
      const other = await ctx("outsider", "b");
      const rows = await withTenantScope(
        { institutionId: other.institution.id, userId: users.outsider!.id },
        (tx) =>
          Promise.all([
            tx.recruiterCompany.count(),
            tx.placementDrive.count(),
            tx.placementRecord.count(),
            tx.placementApplication.count(),
          ])
      );
      expect(rows).toEqual([0, 0, 0, 0]);
    });

    it("hides the recruiter CRM and others' records from a student at the database", async () => {
      const rows = await withTenantScope(
        { institutionId: institutions.a!, userId: users.weak!.id },
        (tx) =>
          Promise.all([
            tx.recruiterCompany.count(),
            tx.recruiterContact.count(),
            tx.recruiterNote.count(),
            tx.placementRecord.count(),
          ])
      );
      expect(rows.slice(0, 3)).toEqual([0, 0, 0]);
      expect(rows[3]).toBe(1);
    });

    it("stops a student writing their own record at the database", async () => {
      await expect(
        withTenantScope(
          { institutionId: institutions.a!, userId: users.weak!.id },
          (tx) =>
            tx.placementRecord.updateMany({
              where: { userId: users.weak!.id },
              data: { cgpa: 10 },
            })
        )
      ).resolves.toMatchObject({ count: 0 });
    });
  });

  describe("under concurrency", () => {
    it("records one application from many simultaneous requests", async () => {
      const office = await ctx("officer", "a");
      const weak = await ctx("weak", "a");
      const { id: companyId } = await placement.createCompany(office, {
        name: "Gamma",
      });
      const { id } = await placement.createDrive(office, driveInput(companyId, "Race"));
      await placement.setDriveStatus(office, id, "OPEN");

      const results = await Promise.allSettled(
        Array.from({ length: 8 }, () => placement.applyToDrive(weak, id))
      );
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      expect(await prisma.placementApplication.count({ where: { driveId: id } })).toBe(
        1
      );
    });

    it("lets a student accept only one of two offers, however they race", async () => {
      const office = await ctx("officer", "a");
      const weak = await ctx("weak", "a");
      const { id: companyId } = await placement.createCompany(office, {
        name: "Delta",
      });
      const ids: string[] = [];
      for (const title of ["One", "Two"]) {
        const { id } = await placement.createDrive(office, {
          ...driveInput(companyId, title),
          excludePlaced: false,
        });
        await placement.setDriveStatus(office, id, "OPEN");
        await placement.applyToDrive(weak, id);
        const application = await prisma.placementApplication.findFirstOrThrow({
          where: { driveId: id },
        });
        await placement.moveApplication(office, application.id, "SHORTLISTED");
        await placement.moveApplication(office, application.id, "OFFERED", {
          offerLpa: 10,
        });
        ids.push(application.id);
      }
      const results = await Promise.allSettled(
        ids.map((id) => placement.respondToOffer(weak, id, true))
      );
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      expect(
        await prisma.placementApplication.count({
          where: { userId: users.weak!.id, stage: "ACCEPTED" },
        })
      ).toBe(1);
    });
  });
});
