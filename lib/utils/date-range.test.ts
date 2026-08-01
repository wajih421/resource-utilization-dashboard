import { describe, it, expect } from "vitest";
import { resolveDateRange, enumerateDates } from "./date-range";

// Wednesday, 2026-08-19
const NOW = new Date(2026, 7, 19, 15, 30, 0);

describe("resolveDateRange", () => {
  it("today resolves to a single-day range of today", () => {
    expect(resolveDateRange("today", undefined, NOW)).toEqual({ from: "2026-08-19", to: "2026-08-19" });
  });

  it("yesterday resolves to a single-day range of the previous day", () => {
    expect(resolveDateRange("yesterday", undefined, NOW)).toEqual({ from: "2026-08-18", to: "2026-08-18" });
  });

  it("this_week resolves from Monday of the current week through today", () => {
    // 2026-08-19 is a Wednesday -> Monday is 2026-08-17
    expect(resolveDateRange("this_week", undefined, NOW)).toEqual({ from: "2026-08-17", to: "2026-08-19" });
  });

  it("this_week correctly handles Monday itself (no wraparound)", () => {
    const monday = new Date(2026, 7, 17, 9, 0, 0);
    expect(resolveDateRange("this_week", undefined, monday)).toEqual({ from: "2026-08-17", to: "2026-08-17" });
  });

  it("this_week correctly handles Sunday (end of week)", () => {
    const sunday = new Date(2026, 7, 23, 9, 0, 0);
    expect(resolveDateRange("this_week", undefined, sunday)).toEqual({ from: "2026-08-17", to: "2026-08-23" });
  });

  it("this_month resolves from the 1st of the current month through today", () => {
    expect(resolveDateRange("this_month", undefined, NOW)).toEqual({ from: "2026-08-01", to: "2026-08-19" });
  });

  it("custom uses the provided from/to", () => {
    expect(resolveDateRange("custom", { from: "2026-07-01", to: "2026-07-15" }, NOW)).toEqual({
      from: "2026-07-01",
      to: "2026-07-15",
    });
  });

  it("custom throws if from or to is missing", () => {
    expect(() => resolveDateRange("custom", { from: "2026-07-01" }, NOW)).toThrow();
    expect(() => resolveDateRange("custom", undefined, NOW)).toThrow();
  });

  it("custom throws if from is after to", () => {
    expect(() => resolveDateRange("custom", { from: "2026-07-15", to: "2026-07-01" }, NOW)).toThrow();
  });
});

describe("enumerateDates", () => {
  it("returns a single date when from equals to", () => {
    expect(enumerateDates("2026-08-19", "2026-08-19")).toEqual(["2026-08-19"]);
  });

  it("returns an inclusive list of dates spanning a range", () => {
    expect(enumerateDates("2026-08-17", "2026-08-20")).toEqual([
      "2026-08-17",
      "2026-08-18",
      "2026-08-19",
      "2026-08-20",
    ]);
  });

  it("correctly spans a month boundary", () => {
    expect(enumerateDates("2026-01-30", "2026-02-02")).toEqual([
      "2026-01-30",
      "2026-01-31",
      "2026-02-01",
      "2026-02-02",
    ]);
  });
});
