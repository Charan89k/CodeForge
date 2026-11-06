import { describe, expect, it } from "vitest";

import {
  canOfficeMove,
  canWithdraw,
  evaluateEligibility,
  median,
  type EligibilityCriteria,
  type StudentRecord,
} from "./eligibility";

const open: EligibilityCriteria = {
  minCgpa: null,
  maxBacklogs: null,
  minAttendance: null,
  departments: [],
  batchYears: [],
  requiredSkills: [],
  excludePlaced: false,
};
const student: StudentRecord = {
  department: "CSE",
  batchYear: 2027,
  cgpa: 8,
  backlogs: 1,
  attendancePercent: 80,
  skills: ["Python", "SQL"],
};
const failed = (
  criteria: Partial<EligibilityCriteria>,
  record = student,
  placed = false
) =>
  evaluateEligibility({ ...open, ...criteria }, record, placed)
    .checks.filter((c) => !c.passed)
    .map((c) => c.rule);

describe("evaluateEligibility", () => {
  it("passes a drive with no rules", () => {
    expect(evaluateEligibility(open, student, false)).toEqual({
      eligible: true,
      checks: [],
    });
  });

  it("refuses without a record, and says why", () => {
    const result = evaluateEligibility(open, null, false);
    expect(result.eligible).toBe(false);
    expect(result.checks[0]?.rule).toBe("Placement record");
  });

  it("treats each threshold as inclusive", () => {
    expect(failed({ minCgpa: 8 })).toEqual([]);
    expect(failed({ minCgpa: 8.01 })).toEqual(["CGPA"]);
    expect(failed({ maxBacklogs: 1 })).toEqual([]);
    expect(failed({ maxBacklogs: 0 })).toEqual(["Backlogs"]);
    expect(failed({ minAttendance: 80 })).toEqual([]);
    expect(failed({ minAttendance: 81 })).toEqual(["Attendance"]);
  });

  it("does not pass an attendance rule on a missing figure", () => {
    expect(
      failed({ minAttendance: 1 }, { ...student, attendancePercent: null })
    ).toEqual(["Attendance"]);
  });

  it("matches department and skills regardless of case", () => {
    expect(failed({ departments: ["cse", "ECE"] })).toEqual([]);
    expect(failed({ departments: ["ECE"] })).toEqual(["Department"]);
    expect(failed({ requiredSkills: ["python"] })).toEqual([]);
    expect(failed({ requiredSkills: ["python", "Go"] })).toEqual(["Skills"]);
  });

  it("checks the graduation year", () => {
    expect(failed({ batchYears: [2027] })).toEqual([]);
    expect(failed({ batchYears: [2026] })).toEqual(["Graduation year"]);
  });

  it("excludes the already placed only when the drive says so", () => {
    expect(failed({ excludePlaced: true }, student, true)).toEqual(["Previous offers"]);
    expect(failed({ excludePlaced: false }, student, true)).toEqual([]);
  });

  it("explains a failure with what was needed and what the student has", () => {
    const { checks } = evaluateEligibility({ ...open, minCgpa: 9 }, student, false);
    expect(checks[0]?.detail).toBe("Needs at least 9; yours is 8.");
  });
});

describe("stage rules", () => {
  it("lets the office advance but never accept for the student", () => {
    expect(canOfficeMove("APPLIED", "SHORTLISTED")).toBe(true);
    expect(canOfficeMove("SHORTLISTED", "OFFERED")).toBe(true);
    expect(canOfficeMove("OFFERED", "ACCEPTED")).toBe(false);
    expect(canOfficeMove("APPLIED", "OFFERED")).toBe(false);
    expect(canOfficeMove("REJECTED", "SHORTLISTED")).toBe(false);
  });

  it("allows withdrawing only before an offer", () => {
    expect(canWithdraw("INTERVIEWING")).toBe(true);
    expect(canWithdraw("OFFERED")).toBe(false);
    expect(canWithdraw("ACCEPTED")).toBe(false);
  });
});

describe("median", () => {
  it("handles odd, even and empty lists", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
    expect(median([])).toBeNull();
  });
});
