import { describe, it, expect } from "vitest";
import {
  parseShiftRange,
  parseExcelDate,
  parseDefaultHours,
  parseResourceRow,
  parseTaskRow,
  parseResourceSheet,
  parseTaskSheet,
} from "./parse-master-data";

describe("parseShiftRange", () => {
  it("parses 12-hour AM/PM ranges", () => {
    expect(parseShiftRange("11:00 AM - 8:00 PM")).toEqual({ start: "11:00:00", end: "20:00:00" });
  });

  it("parses 24-hour ranges with a plain dash", () => {
    expect(parseShiftRange("11:00-20:00")).toEqual({ start: "11:00:00", end: "20:00:00" });
  });

  it("parses ranges using the word 'to' as a separator", () => {
    expect(parseShiftRange("9:00 AM to 6:00 PM")).toEqual({ start: "09:00:00", end: "18:00:00" });
  });

  it("handles midnight and noon edge cases", () => {
    expect(parseShiftRange("12:00 AM - 12:00 PM")).toEqual({ start: "00:00:00", end: "12:00:00" });
  });

  it("returns null for unparseable input", () => {
    expect(parseShiftRange("whenever")).toBeNull();
    expect(parseShiftRange("")).toBeNull();
    expect(parseShiftRange(null)).toBeNull();
  });

  it("returns null for a single time with no range separator", () => {
    expect(parseShiftRange("11:00 AM")).toBeNull();
  });
});

describe("parseExcelDate", () => {
  it("formats a JS Date (as delivered by cellDates:true) as YYYY-MM-DD", () => {
    expect(parseExcelDate(new Date(2026, 2, 3))).toBe("2026-03-03");
  });

  it("parses a date string fallback", () => {
    expect(parseExcelDate("2026-03-03")).toBe("2026-03-03");
  });

  it("returns null for empty/invalid input", () => {
    expect(parseExcelDate(null)).toBeNull();
    expect(parseExcelDate("")).toBeNull();
    expect(parseExcelDate("not a date")).toBeNull();
    expect(parseExcelDate(new Date(NaN))).toBeNull();
  });
});

describe("parseDefaultHours", () => {
  it("passes through numeric values", () => {
    expect(parseDefaultHours(2)).toBe(2);
    expect(parseDefaultHours(2.5)).toBe(2.5);
  });

  it("strips units from string values", () => {
    expect(parseDefaultHours("2h")).toBe(2);
    expect(parseDefaultHours("2.5 hours")).toBe(2.5);
  });

  it("returns null for unparseable values", () => {
    expect(parseDefaultHours(null)).toBeNull();
    expect(parseDefaultHours("")).toBeNull();
    expect(parseDefaultHours("n/a")).toBeNull();
  });
});

describe("parseResourceRow", () => {
  it("parses a well-formed row with no errors", () => {
    const result = parseResourceRow(
      {
        Project: "Ghana MTN Project",
        "Resource Name": "Ali Usman Zahoor",
        "Resource ID": "WX1525427",
        "Working Days": "Mon to Fri",
        Shift: "11:00 AM - 8:00 PM",
        "Workshop Joining Date": new Date(2026, 2, 3),
        "Huawei Joining Date": null,
      },
      2
    );
    expect(result.errors).toEqual([]);
    expect(result).toMatchObject({
      rowNumber: 2,
      projectName: "Ghana MTN Project",
      resourceName: "Ali Usman Zahoor",
      employeeId: "WX1525427",
      workingDays: "Mon to Fri",
      shiftStart: "11:00:00",
      shiftEnd: "20:00:00",
      workshopJoiningDate: "2026-03-03",
      huaweiJoiningDate: null,
    });
  });

  it("collects errors for missing required fields without throwing", () => {
    const result = parseResourceRow({ Project: "", "Resource Name": "", "Resource ID": "" }, 5);
    expect(result.errors).toContain("Missing Project");
    expect(result.errors).toContain("Missing Resource Name");
    expect(result.errors).toContain("Missing Resource ID");
  });

  it("flags an unparseable shift value as an error but doesn't drop the row", () => {
    const result = parseResourceRow(
      { Project: "P", "Resource Name": "R", "Resource ID": "E1", Shift: "garbage" },
      3
    );
    expect(result.errors.some((e) => e.includes("Shift"))).toBe(true);
    expect(result.projectName).toBe("P");
  });

  it("is tolerant of header casing/spacing variance", () => {
    const result = parseResourceRow(
      { project: "P", "  resource name  ": "R", "employee_id": "E1" },
      2
    );
    expect(result.projectName).toBe("P");
    expect(result.resourceName).toBe("R");
    expect(result.employeeId).toBe("E1");
  });
});

describe("parseTaskRow", () => {
  it("parses a well-formed row with no errors", () => {
    const result = parseTaskRow(
      {
        "Task Category": "ROT:Cluster Analysis",
        Project: "Ghana MTN Project",
        "Task Name": "Cluster Analysis 2G",
        "NE/Batch": "Madagascar",
        "Default Time": 2,
      },
      2
    );
    expect(result.errors).toEqual([]);
    expect(result.taskName).toBe("Cluster Analysis 2G");
    expect(result.defaultHours).toBe(2);
  });

  it("falls back to the 'Task' column when 'Task Name' is absent", () => {
    const result = parseTaskRow(
      { "Task Category": "C", Project: "P", Task: "Cluster Analysis 2G", "Default Time": 2 },
      2
    );
    expect(result.taskName).toBe("Cluster Analysis 2G");
  });

  it("prefers 'Task Name' when both 'Task' and 'Task Name' are present", () => {
    const result = parseTaskRow(
      { "Task Category": "C", Project: "P", Task: "short-code", "Task Name": "Full Name", "Default Time": 2 },
      2
    );
    expect(result.taskName).toBe("Full Name");
  });

  it("requires a positive Default Time", () => {
    const zero = parseTaskRow({ "Task Category": "C", Project: "P", Task: "T", "Default Time": 0 }, 2);
    expect(zero.errors).toContain("Default Time must be greater than 0");

    const missing = parseTaskRow({ "Task Category": "C", Project: "P", Task: "T" }, 2);
    expect(missing.errors).toContain("Missing Default Time");
  });
});

describe("parseResourceSheet / parseTaskSheet", () => {
  it("numbers rows starting at 2 (accounting for the header row)", () => {
    const rows = parseResourceSheet([
      { Project: "P", "Resource Name": "A", "Resource ID": "E1" },
      { Project: "P", "Resource Name": "B", "Resource ID": "E2" },
    ]);
    expect(rows.map((r) => r.rowNumber)).toEqual([2, 3]);
  });

  it("processes every row independently — one bad row doesn't affect others", () => {
    const rows = parseTaskSheet([
      { "Task Category": "C", Project: "P", Task: "T1", "Default Time": 2 },
      { "Task Category": "", Project: "P", Task: "T2", "Default Time": 2 },
      { "Task Category": "C", Project: "P", Task: "T3", "Default Time": 3 },
    ]);
    expect(rows[0].errors).toEqual([]);
    expect(rows[1].errors).toContain("Missing Task Category");
    expect(rows[2].errors).toEqual([]);
  });
});
