import { describe, it, expect } from "vitest";
import { buildReport, type ReportWorkLogEntry, type ReportResource, type ReportProject, type ReportAssignment } from "./build-report";
import { DEFAULT_UTILIZATION_THRESHOLDS } from "@/lib/utils/utilization";

const RESOURCES: ReportResource[] = [
  { id: "r1", name: "Ali", employeeId: "E1", workingDays: "Mon to Fri" },
  { id: "r2", name: "Sara", employeeId: "E2", workingDays: "Mon to Sat" },
];

const PROJECTS: ReportProject[] = [{ id: "p1", name: "Project Alpha" }];

const ASSIGNMENTS: ReportAssignment[] = [
  { resourceId: "r1", projectId: "p1" },
  { resourceId: "r2", projectId: "p1" },
];

function entry(overrides: Partial<ReportWorkLogEntry>): ReportWorkLogEntry {
  return {
    id: "e1",
    resourceId: "r1",
    resourceName: "Ali",
    employeeId: "E1",
    projectId: "p1",
    projectName: "Project Alpha",
    taskId: "t1",
    taskName: "Cluster Analysis 2G",
    taskCategoryId: "c1",
    taskCategoryName: "ROT:Cluster Analysis",
    neBatch: "Madagascar",
    workDate: "2026-08-17",
    workDayType: "regular",
    unitsCompleted: 4,
    appliedTaskHours: 2,
    totalHours: 8,
    ...overrides,
  };
}

const BASE_INPUT = {
  from: "2026-08-17",
  to: "2026-08-17", // Monday, both resources' working day
  today: "2026-08-17",
  resources: RESOURCES,
  projects: PROJECTS,
  assignments: ASSIGNMENTS,
  dailyCapacityHours: 8,
  thresholds: DEFAULT_UTILIZATION_THRESHOLDS,
};

describe("buildReport", () => {
  it("classifies a resource who logged exactly full capacity as Fully Utilized", () => {
    const result = buildReport({
      ...BASE_INPUT,
      entries: [entry({ resourceId: "r1", totalHours: 8, workDate: "2026-08-17" })],
    });
    expect(result.statusCounts["Fully Utilized"]).toBe(1);
    // r2 logged nothing that day -> Not Filled
    expect(result.statusCounts["Not Filled"]).toBe(1);
  });

  it("sums total hours and entry counts correctly", () => {
    const result = buildReport({
      ...BASE_INPUT,
      entries: [
        entry({ id: "e1", resourceId: "r1", totalHours: 4 }),
        entry({ id: "e2", resourceId: "r1", totalHours: 4, taskId: "t2" }),
      ],
    });
    expect(result.totals.hours).toBe(8);
    expect(result.totals.entries).toBe(2);
    expect(result.totals.uniqueResources).toBe(1);
  });

  it("reports Weekend for a resource whose working_days excludes the date", () => {
    // 2026-08-22 is a Saturday; r1 (Mon-Fri) has it off, r2 (Mon-Sat) does not
    const result = buildReport({
      ...BASE_INPUT,
      from: "2026-08-22",
      to: "2026-08-22",
      today: "2026-08-22",
      entries: [],
    });
    expect(result.statusCounts.Weekend).toBe(1); // r1 only
    expect(result.statusCounts["Not Filled"]).toBe(1); // r2 (working day, no log)
  });

  it("reports Weekend for an explicit weekend work_day_type submission even on a working day", () => {
    const result = buildReport({
      ...BASE_INPUT,
      entries: [entry({ resourceId: "r1", workDayType: "weekend", totalHours: 3 })],
    });
    const r1Status = result.perResource.find((r) => r.resourceId === "r1")?.statusCounts;
    expect(r1Status?.Weekend).toBe(1);
  });

  it("never reports a future date's status as Not Filled", () => {
    const result = buildReport({
      ...BASE_INPUT,
      from: "2026-08-17",
      to: "2026-08-20", // 3 days after "today"
      today: "2026-08-17",
      entries: [],
    });
    // Only 2026-08-17 should be evaluated; the range is capped at `today`.
    expect(result.dailyTrend).toHaveLength(1);
    expect(result.dailyTrend[0].date).toBe("2026-08-17");
  });

  it("computes per-project hours and an approximate capacity", () => {
    const result = buildReport({
      ...BASE_INPUT,
      entries: [
        entry({ resourceId: "r1", totalHours: 8 }),
        entry({ id: "e2", resourceId: "r2", totalHours: 8, taskId: "t2" }),
      ],
    });
    const project = result.perProject.find((p) => p.projectId === "p1")!;
    expect(project.hours).toBe(16);
    // 2 assigned resources * 8h capacity * 1 day in range = 16h capacity
    expect(project.capacity).toBe(16);
    expect(project.utilizationPercent).toBe(100);
  });

  it("filters entries and aggregates by the requested status", () => {
    const result = buildReport({
      ...BASE_INPUT,
      entries: [
        entry({ id: "e1", resourceId: "r1", totalHours: 8 }), // Fully Utilized
        entry({ id: "e2", resourceId: "r2", totalHours: 2, taskId: "t2" }), // Less Utilized
      ],
      filters: { status: "Less Utilized" },
    });
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].resourceId).toBe("r2");
    expect(result.totals.entries).toBe(1);
  });

  it("caps returned entries and flags truncation for very large result sets", () => {
    const manyEntries = Array.from({ length: 5001 }, (_, i) =>
      entry({ id: `e${i}`, resourceId: "r1", totalHours: 0.001 })
    );
    const result = buildReport({ ...BASE_INPUT, entries: manyEntries });
    expect(result.entriesTruncated).toBe(true);
    expect(result.entries).toHaveLength(5000);
  });
});
