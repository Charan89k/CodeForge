import { afterEach, describe, expect, it, vi } from "vitest";

import { getEnv, resetEnvForTests } from "./env";

describe("TUTOR_CONVERSATION_RETENTION_DAYS", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    resetEnvForTests();
  });

  const days = (value: string) => {
    vi.stubEnv("SKIP_ENV_VALIDATION", "false");
    vi.stubEnv("TUTOR_CONVERSATION_RETENTION_DAYS", value);
    resetEnvForTests();
    return getEnv().TUTOR_CONVERSATION_RETENTION_DAYS;
  };

  it("treats an empty value as unset, so retention stays off", () => {
    expect(days("")).toBeUndefined();
  });

  it("reads a number of days", () => {
    expect(days("30")).toBe(30);
  });

  it("refuses a period too short to be deliberate", () => {
    expect(() => days("3")).toThrow(/TUTOR_CONVERSATION_RETENTION_DAYS/);
  });
});
