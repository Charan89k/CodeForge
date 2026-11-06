/**
 * Placement eligibility. Pure, so every decision can be explained and tested:
 * each rule a drive sets produces one line saying what it needed and what the
 * student has. The result is stored with the application, so it stays auditable
 * if the student's record or the drive changes later.
 */
export type EligibilityCriteria = {
  minCgpa: number | null;
  maxBacklogs: number | null;
  minAttendance: number | null;
  departments: readonly string[];
  batchYears: readonly number[];
  requiredSkills: readonly string[];
  excludePlaced: boolean;
};

export type StudentRecord = {
  department: string;
  batchYear: number;
  cgpa: number;
  backlogs: number;
  attendancePercent: number | null;
  skills: readonly string[];
};

export type EligibilityCheck = { rule: string; passed: boolean; detail: string };
export type EligibilityResult = { eligible: boolean; checks: EligibilityCheck[] };

const normal = (value: string) => value.trim().toLowerCase();

export function evaluateEligibility(
  criteria: EligibilityCriteria,
  record: StudentRecord | null,
  alreadyPlaced: boolean
): EligibilityResult {
  if (!record) {
    return {
      eligible: false,
      checks: [
        {
          rule: "Placement record",
          passed: false,
          detail: "The placement office has not entered your record yet.",
        },
      ],
    };
  }

  const checks: EligibilityCheck[] = [];
  if (criteria.minCgpa !== null) {
    checks.push({
      rule: "CGPA",
      passed: record.cgpa >= criteria.minCgpa,
      detail: `Needs at least ${criteria.minCgpa}; yours is ${record.cgpa}.`,
    });
  }
  if (criteria.maxBacklogs !== null) {
    checks.push({
      rule: "Backlogs",
      passed: record.backlogs <= criteria.maxBacklogs,
      detail: `Allows at most ${criteria.maxBacklogs}; you have ${record.backlogs}.`,
    });
  }
  if (criteria.minAttendance !== null) {
    checks.push({
      rule: "Attendance",
      // An unknown figure is not a pass: the office should enter it.
      passed:
        record.attendancePercent !== null &&
        record.attendancePercent >= criteria.minAttendance,
      detail:
        record.attendancePercent === null
          ? `Needs at least ${criteria.minAttendance}%; yours is not on record.`
          : `Needs at least ${criteria.minAttendance}%; yours is ${record.attendancePercent}%.`,
    });
  }
  if (criteria.departments.length > 0) {
    checks.push({
      rule: "Department",
      passed: criteria.departments.some((d) => normal(d) === normal(record.department)),
      detail: `Open to ${criteria.departments.join(", ")}; yours is ${record.department}.`,
    });
  }
  if (criteria.batchYears.length > 0) {
    checks.push({
      rule: "Graduation year",
      passed: criteria.batchYears.includes(record.batchYear),
      detail: `Open to ${criteria.batchYears.join(", ")}; yours is ${record.batchYear}.`,
    });
  }
  if (criteria.requiredSkills.length > 0) {
    const have = new Set(record.skills.map(normal));
    const missing = criteria.requiredSkills.filter((s) => !have.has(normal(s)));
    checks.push({
      rule: "Skills",
      passed: missing.length === 0,
      detail:
        missing.length === 0
          ? `You have all of: ${criteria.requiredSkills.join(", ")}.`
          : `Missing: ${missing.join(", ")}.`,
    });
  }
  if (criteria.excludePlaced) {
    checks.push({
      rule: "Previous offers",
      passed: !alreadyPlaced,
      detail: alreadyPlaced
        ? "You have accepted an offer, and this drive is for students who have not."
        : "You have not accepted an offer.",
    });
  }
  return { eligible: checks.every((c) => c.passed), checks };
}

export type PlacementStage =
  | "APPLIED"
  | "SHORTLISTED"
  | "INTERVIEWING"
  | "OFFERED"
  | "ACCEPTED"
  | "DECLINED"
  | "REJECTED"
  | "WITHDRAWN";

/** Moves the placement office may make. Accepting belongs to the student alone. */
const OFFICE_MOVES: Record<PlacementStage, readonly PlacementStage[]> = {
  APPLIED: ["SHORTLISTED", "REJECTED"],
  SHORTLISTED: ["INTERVIEWING", "OFFERED", "REJECTED"],
  INTERVIEWING: ["OFFERED", "REJECTED"],
  OFFERED: [],
  ACCEPTED: [],
  DECLINED: [],
  REJECTED: [],
  WITHDRAWN: [],
};

export const officeMovesFrom = (stage: PlacementStage) => OFFICE_MOVES[stage];
export const canOfficeMove = (from: PlacementStage, to: PlacementStage) =>
  OFFICE_MOVES[from].includes(to);
export const canWithdraw = (stage: PlacementStage) =>
  stage === "APPLIED" || stage === "SHORTLISTED" || stage === "INTERVIEWING";

/** Median of a list, or null when there is nothing to measure. */
export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}
