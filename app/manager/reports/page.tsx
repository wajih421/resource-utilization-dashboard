// app/manager/reports/page.tsx
"use client";

import { useMemo, useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { getStatusColor, type UtilizationStatus } from "@/lib/utils/utilization";

type Preset = "today" | "yesterday" | "this_week" | "this_month" | "custom";
type ReportStatus = UtilizationStatus | "Weekend";

type Project = { id: string; name: string };
type Resource = { id: string; name: string; employee_id: string };
type Category = { id: string; name: string };

type ReportData = {
  from: string;
  to: string;
  totals: { hours: number; entries: number; uniqueResources: number };
  statusCounts: Record<ReportStatus, number>;
  dailyTrend: { date: string; hours: number; averageUtilizationPercent: number }[];
  perProject: { projectId: string; projectName: string; hours: number; capacity: number; utilizationPercent: number }[];
  perResource: {
    resourceId: string;
    name: string;
    employeeId: string | null;
    hours: number;
    entryCount: number;
    averageUtilizationPercent: number;
  }[];
  entries: {
    id: string;
    resourceName: string;
    employeeId: string | null;
    projectName: string;
    taskName: string;
    taskCategoryName: string | null;
    neBatch: string | null;
    workDate: string;
    workDayType: "regular" | "weekend";
    unitsCompleted: number;
    totalHours: number;
  }[];
  entriesTruncated: boolean;
};

const STATUS_LIST: ReportStatus[] = [
  "Highly Utilized",
  "Fully Utilized",
  "Less Utilized",
  "Abnormally Utilized",
  "Not Filled",
  "Weekend",
];

async function fetchFilterOptions() {
  const [projRes, resRes, catRes, taskRes] = await Promise.all([
    fetch("/api/manager/projects"),
    fetch("/api/manager/resources"),
    fetch("/api/manager/task-categories"),
    fetch("/api/manager/tasks"),
  ]);
  const [projData, resData, catData, taskData] = await Promise.all([
    projRes.json(),
    resRes.json(),
    catRes.json(),
    taskRes.json(),
  ]);

  const batches = new Set<string>();
  for (const t of taskData.tasks ?? []) {
    if (t.ne_batch) batches.add(t.ne_batch);
  }

  return {
    projects: (projData.projects ?? []) as Project[],
    resources: (resData.resources ?? []) as Resource[],
    categories: (catData.categories ?? []) as Category[],
    neBatches: [...batches].sort(),
  };
}

type ReportQueryParams = {
  preset: Preset;
  customFrom: string;
  customTo: string;
  projectId: string;
  resourceId: string;
  taskCategoryId: string;
  workDayType: string;
  neBatch: string;
  status: string;
};

async function fetchReport(params: ReportQueryParams): Promise<ReportData> {
  const search = new URLSearchParams({ preset: params.preset });
  if (params.preset === "custom") {
    search.set("from", params.customFrom);
    search.set("to", params.customTo);
  }
  if (params.projectId) search.set("projectId", params.projectId);
  if (params.resourceId) search.set("resourceId", params.resourceId);
  if (params.taskCategoryId) search.set("taskCategoryId", params.taskCategoryId);
  if (params.workDayType) search.set("workDayType", params.workDayType);
  if (params.neBatch) search.set("neBatch", params.neBatch);
  if (params.status) search.set("status", params.status);

  const res = await fetch(`/api/manager/reports?${search.toString()}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to load report");
  return data;
}

export default function ManagerReportsPage() {
  const [preset, setPreset] = useState<Preset>("today");
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [customFrom, setCustomFrom] = useState(today);
  const [customTo, setCustomTo] = useState(today);

  const [projectId, setProjectId] = useState("");
  const [resourceId, setResourceId] = useState("");
  const [taskCategoryId, setTaskCategoryId] = useState("");
  const [workDayType, setWorkDayType] = useState("");
  const [neBatch, setNeBatch] = useState("");
  const [status, setStatus] = useState("");

  // Filter dropdown source data — fetched once, cached by react-query.
  const { data: filterOptions } = useQuery({
    queryKey: ["manager-reports-filter-options"],
    queryFn: fetchFilterOptions,
  });
  const projects = filterOptions?.projects ?? [];
  const resources = filterOptions?.resources ?? [];
  const categories = filterOptions?.categories ?? [];
  const neBatches = filterOptions?.neBatches ?? [];

  const reportParams: ReportQueryParams = {
    preset,
    customFrom,
    customTo,
    projectId,
    resourceId,
    taskCategoryId,
    workDayType,
    neBatch,
    status,
  };

  const { data: report, isLoading: loading, error } = useQuery({
    queryKey: ["manager-reports", reportParams],
    queryFn: () => fetchReport(reportParams),
    placeholderData: keepPreviousData,
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Reports &amp; Historical Analytics</h1>

      <div className="bg-white rounded-lg shadow p-4 space-y-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Date Range</label>
            <select
              value={preset}
              onChange={(e) => setPreset(e.target.value as Preset)}
              className="border rounded px-2 py-1.5 text-sm"
            >
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="this_week">This Week</option>
              <option value="this_month">This Month</option>
              <option value="custom">Custom Range</option>
            </select>
          </div>
          {preset === "custom" && (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">From</label>
                <input
                  type="date"
                  value={customFrom}
                  max={customTo}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="border rounded px-2 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">To</label>
                <input
                  type="date"
                  value={customTo}
                  min={customFrom}
                  max={today}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="border rounded px-2 py-1.5 text-sm"
                />
              </div>
            </>
          )}
        </div>

        <div className="flex flex-wrap gap-3 items-end border-t pt-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Project</label>
            <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="border rounded px-2 py-1.5 text-sm">
              <option value="">All projects</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Resource</label>
            <select value={resourceId} onChange={(e) => setResourceId(e.target.value)} className="border rounded px-2 py-1.5 text-sm">
              <option value="">All resources</option>
              {resources.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Task Category</label>
            <select value={taskCategoryId} onChange={(e) => setTaskCategoryId(e.target.value)} className="border rounded px-2 py-1.5 text-sm">
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Work Type</label>
            <select value={workDayType} onChange={(e) => setWorkDayType(e.target.value)} className="border rounded px-2 py-1.5 text-sm">
              <option value="">All</option>
              <option value="regular">Regular</option>
              <option value="weekend">Weekend</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">NE/Batch</label>
            <select value={neBatch} onChange={(e) => setNeBatch(e.target.value)} className="border rounded px-2 py-1.5 text-sm">
              <option value="">All</option>
              {neBatches.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Utilization Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="border rounded px-2 py-1.5 text-sm">
              <option value="">All statuses</option>
              {STATUS_LIST.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded px-3 py-2">
          {error instanceof Error ? error.message : "Failed to load report"}
        </div>
      )}

      {loading ? (
        <p className="text-gray-500">Loading report...</p>
      ) : report ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            <StatCard label="Total Hours" value={`${report.totals.hours.toFixed(1)}h`} />
            <StatCard label="Work Log Entries" value={report.totals.entries} />
            <StatCard label="Resources Active" value={report.totals.uniqueResources} />
            <StatCard label="Date Range" value={report.from === report.to ? report.from : `${report.from} → ${report.to}`} small />
          </div>

          <div>
            <h2 className="text-lg font-semibold mb-3">Status Breakdown</h2>
            <div className="flex flex-wrap gap-3">
              {STATUS_LIST.map((s) => (
                <span
                  key={s}
                  className={`px-3 py-1 rounded text-sm font-medium border ${
                    s === "Weekend" ? "text-purple-600 bg-purple-50 border-purple-200" : getStatusColor(s as UtilizationStatus)
                  }`}
                >
                  {s}: {report.statusCounts[s]}
                </span>
              ))}
            </div>
          </div>

          {report.dailyTrend.length > 1 && (
            <div>
              <h2 className="text-lg font-semibold mb-3">Daily Trend</h2>
              <div className="bg-white rounded-lg shadow overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-left text-gray-500">
                    <tr>
                      <th className="px-4 py-2">Date</th>
                      <th className="px-4 py-2">Total Hours</th>
                      <th className="px-4 py-2">Avg Utilization</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.dailyTrend.map((d) => (
                      <tr key={d.date} className="border-t">
                        <td className="px-4 py-2">{d.date}</td>
                        <td className="px-4 py-2">{d.hours.toFixed(1)}h</td>
                        <td className="px-4 py-2">{d.averageUtilizationPercent.toFixed(0)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div>
            <h2 className="text-lg font-semibold mb-3">Project Utilization</h2>
            <div className="bg-white rounded-lg shadow overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left text-gray-500">
                  <tr>
                    <th className="px-4 py-2">Project</th>
                    <th className="px-4 py-2">Hours</th>
                    <th className="px-4 py-2">Capacity</th>
                    <th className="px-4 py-2">Utilization</th>
                  </tr>
                </thead>
                <tbody>
                  {report.perProject.filter((p) => p.hours > 0 || !projectId).map((p) => (
                    <tr key={p.projectId} className="border-t">
                      <td className="px-4 py-2 font-medium">{p.projectName}</td>
                      <td className="px-4 py-2">{p.hours.toFixed(1)}h</td>
                      <td className="px-4 py-2">{p.capacity.toFixed(0)}h</td>
                      <td className="px-4 py-2">{p.utilizationPercent.toFixed(0)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h2 className="text-lg font-semibold mb-3">Resource Utilization</h2>
            <div className="bg-white rounded-lg shadow overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left text-gray-500">
                  <tr>
                    <th className="px-4 py-2">Resource</th>
                    <th className="px-4 py-2">Employee ID</th>
                    <th className="px-4 py-2">Hours</th>
                    <th className="px-4 py-2">Entries</th>
                    <th className="px-4 py-2">Avg Utilization</th>
                  </tr>
                </thead>
                <tbody>
                  {report.perResource.length === 0 ? (
                    <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400">No data for this range/filters.</td></tr>
                  ) : (
                    report.perResource.map((r) => (
                      <tr key={r.resourceId} className="border-t">
                        <td className="px-4 py-2 font-medium">{r.name}</td>
                        <td className="px-4 py-2 text-gray-500">{r.employeeId ?? "-"}</td>
                        <td className="px-4 py-2">{r.hours.toFixed(1)}h</td>
                        <td className="px-4 py-2">{r.entryCount}</td>
                        <td className="px-4 py-2">{r.averageUtilizationPercent.toFixed(0)}%</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h2 className="text-lg font-semibold mb-3">
              Work Log Entries
              {report.entriesTruncated && (
                <span className="text-xs font-normal text-orange-600 ml-2">
                  (showing first 5000 — narrow your filters for a full view)
                </span>
              )}
            </h2>
            <div className="bg-white rounded-lg shadow overflow-x-auto max-h-[500px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left text-gray-500 sticky top-0">
                  <tr>
                    <th className="px-4 py-2">Date</th>
                    <th className="px-4 py-2">Resource</th>
                    <th className="px-4 py-2">Project</th>
                    <th className="px-4 py-2">Task</th>
                    <th className="px-4 py-2">Category</th>
                    <th className="px-4 py-2">NE/Batch</th>
                    <th className="px-4 py-2">Units</th>
                    <th className="px-4 py-2">Hours</th>
                    <th className="px-4 py-2">Type</th>
                  </tr>
                </thead>
                <tbody>
                  {report.entries.length === 0 ? (
                    <tr><td colSpan={9} className="px-4 py-6 text-center text-gray-400">No entries for this range/filters.</td></tr>
                  ) : (
                    report.entries.map((e) => (
                      <tr key={e.id} className="border-t">
                        <td className="px-4 py-2">{e.workDate}</td>
                        <td className="px-4 py-2">{e.resourceName}</td>
                        <td className="px-4 py-2">{e.projectName}</td>
                        <td className="px-4 py-2">{e.taskName}</td>
                        <td className="px-4 py-2 text-gray-500">{e.taskCategoryName ?? "-"}</td>
                        <td className="px-4 py-2 text-gray-500">{e.neBatch ?? "-"}</td>
                        <td className="px-4 py-2">{e.unitsCompleted}</td>
                        <td className="px-4 py-2">{e.totalHours}h</td>
                        <td className="px-4 py-2 capitalize">{e.workDayType}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

function StatCard({ label, value, small }: { label: string; value: string | number; small?: boolean }) {
  return (
    <div className="bg-white rounded-lg shadow p-4">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={small ? "text-sm font-semibold" : "text-xl font-semibold"}>{value}</p>
    </div>
  );
}
