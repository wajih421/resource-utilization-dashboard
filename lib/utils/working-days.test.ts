import { describe, it, expect } from "vitest";
import { isWorkingDay } from "./working-days";

describe("isWorkingDay", () => {
  it("assumes a working day when workingDays is null/unknown", () => {
    expect(isWorkingDay(null, "2026-08-15")).toBe(true); // a Saturday
  });

  it("assumes a working day when the format can't be parsed", () => {
    expect(isWorkingDay("whenever suits", "2026-08-15")).toBe(true);
  });

  it("Mon to Fri: weekdays are working days, weekend is not", () => {
    // 2026-08-17 is Monday, 2026-08-21 Friday, 2026-08-22 Saturday, 2026-08-23 Sunday
    expect(isWorkingDay("Mon to Fri", "2026-08-17")).toBe(true);
    expect(isWorkingDay("Mon to Fri", "2026-08-21")).toBe(true);
    expect(isWorkingDay("Mon to Fri", "2026-08-22")).toBe(false);
    expect(isWorkingDay("Mon to Fri", "2026-08-23")).toBe(false);
  });

  it("Mon to Sat: Saturday is a working day, Sunday is not", () => {
    expect(isWorkingDay("Mon to Sat", "2026-08-22")).toBe(true);
    expect(isWorkingDay("Mon to Sat", "2026-08-23")).toBe(false);
  });

  it("handles a wraparound range (e.g. Fri to Tue)", () => {
    // Friday(5) to Tuesday(2) wraps: Fri, Sat, Sun, Mon, Tue are all "working"
    expect(isWorkingDay("Fri to Tue", "2026-08-21")).toBe(true); // Friday
    expect(isWorkingDay("Fri to Tue", "2026-08-22")).toBe(true); // Saturday
    expect(isWorkingDay("Fri to Tue", "2026-08-25")).toBe(true); // Tuesday
    expect(isWorkingDay("Fri to Tue", "2026-08-20")).toBe(false); // Thursday, outside range
  });

  it("is case-insensitive and tolerates full day names", () => {
    expect(isWorkingDay("monday to friday", "2026-08-17")).toBe(true);
    expect(isWorkingDay("MONDAY TO FRIDAY", "2026-08-22")).toBe(false);
  });
});
