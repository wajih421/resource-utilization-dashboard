import { describe, it, expect } from "vitest";
import {
  getUtilizationStatus,
  getUtilizationPercent,
  getStatusColor,
  DEFAULT_UTILIZATION_THRESHOLDS,
} from "./utilization";

describe("getUtilizationStatus", () => {
  it("returns Not Filled for zero or negative hours", () => {
    expect(getUtilizationStatus(0)).toBe("Not Filled");
    expect(getUtilizationStatus(-1)).toBe("Not Filled");
  });

  it("returns Less Utilized below the less-utilized threshold", () => {
    expect(getUtilizationStatus(5.99)).toBe("Less Utilized");
    expect(getUtilizationStatus(0.01)).toBe("Less Utilized");
  });

  it("returns Fully Utilized at and between the less/fully thresholds", () => {
    expect(getUtilizationStatus(6)).toBe("Fully Utilized"); // boundary: not "less" anymore
    expect(getUtilizationStatus(7)).toBe("Fully Utilized");
    expect(getUtilizationStatus(8)).toBe("Fully Utilized"); // boundary: still "fully"
  });

  it("returns Highly Utilized between fully and highly thresholds", () => {
    expect(getUtilizationStatus(8.01)).toBe("Highly Utilized");
    expect(getUtilizationStatus(10)).toBe("Highly Utilized"); // boundary
  });

  it("returns Abnormally Utilized above the highly-utilized threshold", () => {
    expect(getUtilizationStatus(10.01)).toBe("Abnormally Utilized");
    expect(getUtilizationStatus(24)).toBe("Abnormally Utilized");
  });

  it("respects custom thresholds instead of the defaults", () => {
    const custom = { lessUtilizedMax: 4, fullyUtilizedMax: 8, highlyUtilizedMax: 12 };
    expect(getUtilizationStatus(4, custom)).toBe("Fully Utilized");
    expect(getUtilizationStatus(3.99, custom)).toBe("Less Utilized");
    expect(getUtilizationStatus(12, custom)).toBe("Highly Utilized");
    expect(getUtilizationStatus(12.01, custom)).toBe("Abnormally Utilized");
  });

  it("defaults match the live utilization_settings seed values (6/8/10)", () => {
    expect(DEFAULT_UTILIZATION_THRESHOLDS).toEqual({
      lessUtilizedMax: 6,
      fullyUtilizedMax: 8,
      highlyUtilizedMax: 10,
    });
  });
});

describe("getUtilizationPercent", () => {
  it("computes hours as a percentage of daily capacity", () => {
    expect(getUtilizationPercent(8, 8)).toBe(100);
    expect(getUtilizationPercent(4, 8)).toBe(50);
    expect(getUtilizationPercent(9.5, 8)).toBeCloseTo(118.75);
  });

  it("returns 0 rather than dividing by zero when capacity is misconfigured", () => {
    expect(getUtilizationPercent(5, 0)).toBe(0);
    expect(getUtilizationPercent(5, -1)).toBe(0);
  });
});

describe("getStatusColor", () => {
  it("returns a distinct class string for every status", () => {
    const statuses = ["Less Utilized", "Fully Utilized", "Highly Utilized", "Abnormally Utilized", "Not Filled"] as const;
    const colors = statuses.map((s) => getStatusColor(s));
    expect(new Set(colors).size).toBe(statuses.length);
  });
});
