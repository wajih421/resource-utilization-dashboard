// lib/reports/build-report.ts
//
// Pure aggregation for the manager Reports page (SRS sections 19, 22, 29:
// historical utilization, date-range filtering, multi-dimension filters).
// Deliberately has no knowledge of Supabase — the route handler fetches
// rows and passes plain objects in here, which keeps this function unit
// testable without mocking a database.
import {
  getUtilizationStatus,
  getUtilizationPercent,
  type UtilizationStatus,
  type UtilizationThresholds,
} from "@/lib/utils/utilization";
import { isWorkingDay } from "@/lib/utils/working-days";
import { enumerateDates } from "@/lib/utils/date-range";

export type ReportWorkLogEntry = {
  id: string;
  resourceId: string;
  resourceName: string;
  employeeId: string | null;
  projectId: string;
  projectName: string;
  taskId: string;
  taskName: string;
  taskCategoryId: string | null;
  taskCategoryName: string | null;
  neBatch: string | null;
  workDate: string;
  workDayType: "regular" | "weekend";
  unitsCompleted: number;
  appliedTaskHours: number;
  totalHours: number;
};

export type ReportResource = {
  id: string;
  name: string;
  employeeId: string | null;
  workingDays: string | null;
};

export type ReportProject = {
  id: string;
  name: string;
};

export type ReportAssignment = {
  resourceId: string;
  projectId: string;
};

export type ReportStatus = UtilizationStatus | "Weekend";

export type ReportFilters = {
  status?: ReportStatus;
};

export type BuildReportInput = {
  from: string;
  to: string;
  today: string; // caller's "current date" — caps status computation so future days aren't reported as Not Filled
  resources: ReportResource[];
  projects: ReportProject[];
  assignments: ReportAssignment[];
  entries: ReportWorkLogEntry[]; // already filtered by project/resource/taskCategory/neBatch/workDayType at the query layer
  dailyCapacityHours: number;
  thresholds: UtilizationThresholds;
  filters?: ReportFilters;
};

export type BuildReportResult = {
  from: string;
  to: string;
  totals: { hours: number; entries: number; uniqueResources: number };
  statusCounts: Record<ReportStatus, number>;
  dailyTrend: { date: string; hours: number; averageUtilizationPercent: number }[];
  perProject: {
    projectId: string;
    projectName: string;
    hours: number;
    capacity: number;
    utilizationPercent: number;
  }[];
  perResource: {
    resourceId: string;
    name: string;
    employeeId: string | null;
    hours: number;
    entryCount: number;
    averageUtilizationPercent: number;
    statusCounts: Record<ReportStatus, number>;
  }[];
  entries: ReportWorkLogEntry[];
  entriesTruncated: boolean;
};

const EMPTY_STATUS_COUNTS = (): Record<ReportStatus, number> => ({
  "Highly Utilized": 0,
  "Fully Utilized": 0,
  "Less Utilized": 0,
  "Abnormally Utilized": 0,
  "Not Filled": 0,
  Weekend: 0,
});

const MAX_ENTRIES = 5000;

export function buildReport(input: BuildReportInput): BuildReportResult {
  const { from, to, today, resources, projects, assignments, entries, dailyCapacityHours, thresholds, filters } = input;

  // Never compute/report status for days that haven't happened yet.
  const effectiveTo = to > today ? today : to;
  const dates = from > effectiveTo ? [] : enumerateDates(from, effectiveTo);

  // hours logged per (resourceId, date), and whether any entry that day was
  // an explicit weekend submission.
  const hoursByResourceDate = new Map<string, number>();
  const weekendFlagByResourceDate = new Set<string>();
  for (const e of entries) {
    if (e.workDate < from || e.workDate > effectiveTo) continue;
    const key = `${e.resourceId}|${e.workDate}`;
    hoursByResourceDate.set(key, (hoursByResourceDate.get(key) ?? 0) + e.totalHours);
    if (e.workDayType === "weekend") weekendFlagByResourceDate.add(key);
  }

  // Per-(resource,date) status, used for statusCounts, dailyTrend,
  // perResource averages, and the status filter on `entries`.
  const statusByResourceDate = new Map<string, ReportStatus>();
  const statusCounts = EMPTY_STATUS_COUNTS();
  const dailyHours = new Map<string, number>();
  const dailyPercentSum = new Map<string, number>();
  const dailyPercentCount = new Map<string, number>();

  for (const date of dates) {
    for (const r of resources) {
      const key = `${r.id}|${date}`;
      const hours = hoursByResourceDate.get(key) ?? 0;
      dailyHours.set(date, (dailyHours.get(date) ?? 0) + hours);

      const isWeekend = !isWorkingDay(r.workingDays, date) || weekendFlagByResourceDate.has(key);
      const percent = getUtilizationPercent(hours, dailyCapacityHours);

      let status: ReportStatus;
      if (isWeekend) {
        status = "Weekend";
      } else {
        status = getUtilizationStatus(hours, thresholds);
        dailyPercentSum.set(date, (dailyPercentSum.get(date) ?? 0) + percent);
        dailyPercentCount.set(date, (dailyPercentCount.get(date) ?? 0) + 1);
      }

      statusByResourceDate.set(key, status);
      statusCounts[status]++;
    }
  }

  const dailyTrend = dates.map((date) => {
    const count = dailyPercentCount.get(date) ?? 0;
    return {
      date,
      hours: dailyHours.get(date) ?? 0,
      averageUtilizationPercent: count > 0 ? (dailyPercentSum.get(date) ?? 0) / count : 0,
    };
  });

  // ---- Apply the status filter (if any) to the raw entries -------------
  const statusFilter = filters?.status;
  const filteredEntries = statusFilter
    ? entries.filter((e) => statusByResourceDate.get(`${e.resourceId}|${e.workDate}`) === statusFilter)
    : entries;

  // ---- Per-project aggregation -------------------------------------------
  const assignedCountByProject = new Map<string, number>();
  for (const a of assignments) {
    assignedCountByProject.set(a.projectId, (assignedCountByProject.get(a.projectId) ?? 0) + 1);
  }
  const hoursByProject = new Map<string, number>();
  for (const e of filteredEntries) {
    hoursByProject.set(e.projectId, (hoursByProject.get(e.projectId) ?? 0) + e.totalHours);
  }
  const numDays = dates.length;
  const perProject = projects.map((p) => {
    const assignedResources = assignedCountByProject.get(p.id) ?? 0;
    // Approximation: capacity assumes every assigned resource is scheduled
    // every day in range. Per-resource working-day calendars are already
    // reflected in the status/statusCounts breakdown, just not folded into
    // this capacity figure.
    const capacity = assignedResources * dailyCapacityHours * numDays;
    const hours = hoursByProject.get(p.id) ?? 0;
    return {
      projectId: p.id,
      projectName: p.name,
      hours,
      capacity,
      utilizationPercent: capacity > 0 ? (hours / capacity) * 100 : 0,
    };
  });

  // ---- Per-resource aggregation ------------------------------------------
  const hoursByResource = new Map<string, number>();
  const entryCountByResource = new Map<string, number>();
  for (const e of filteredEntries) {
    hoursByResource.set(e.resourceId, (hoursByResource.get(e.resourceId) ?? 0) + e.totalHours);
    entryCountByResource.set(e.resourceId, (entryCountByResource.get(e.resourceId) ?? 0) + 1);
  }

  const perResource = resources
    .map((r) => {
      let percentSum = 0;
      let percentCount = 0;
      const rStatusCounts = EMPTY_STATUS_COUNTS();
      for (const date of dates) {
        const key = `${r.id}|${date}`;
        const status = statusByResourceDate.get(key);
        if (!status) continue;
        rStatusCounts[status]++;
        if (status !== "Weekend") {
          percentSum += getUtilizationPercent(hoursByResourceDate.get(key) ?? 0, dailyCapacityHours);
          percentCount++;
        }
      }
      return {
        resourceId: r.id,
        name: r.name,
        employeeId: r.employeeId,
        hours: hoursByResource.get(r.id) ?? 0,
        entryCount: entryCountByResource.get(r.id) ?? 0,
        averageUtilizationPercent: percentCount > 0 ? percentSum / percentCount : 0,
        statusCounts: rStatusCounts,
      };
    })
    .filter((r) => r.entryCount > 0 || !statusFilter);

  const totalHours = filteredEntries.reduce((sum, e) => sum + e.totalHours, 0);
  const uniqueResources = new Set(filteredEntries.map((e) => e.resourceId)).size;

  const sortedEntries = [...filteredEntries].sort((a, b) => (a.workDate < b.workDate ? 1 : -1));
  const entriesTruncated = sortedEntries.length > MAX_ENTRIES;

  return {
    from,
    to,
    totals: { hours: totalHours, entries: filteredEntries.length, uniqueResources },
    statusCounts,
    dailyTrend,
    perProject,
    perResource,
    entries: entriesTruncated ? sortedEntries.slice(0, MAX_ENTRIES) : sortedEntries,
    entriesTruncated,
  };
}
