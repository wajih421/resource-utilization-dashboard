// app/manager/reports/page.tsx
"use client";

import { useMemo, useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { Clock, ListChecks, Users, CalendarRange } from "lucide-react";
import { getStatusColor, type UtilizationStatus } from "@/lib/utils/utilization";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/layout/EmptyState";
import { StatCard } from "@/components/dashboard/StatCard";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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

const ALL = "__all__";

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
      <PageHeader title="Reports & Historical Analytics" description="Filter and drill into historical work-log data" />

      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Date Range</Label>
              <Select value={preset} onValueChange={(v) => setPreset(v as Preset)}>
                <SelectTrigger size="sm" className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="yesterday">Yesterday</SelectItem>
                  <SelectItem value="this_week">This Week</SelectItem>
                  <SelectItem value="this_month">This Month</SelectItem>
                  <SelectItem value="custom">Custom Range</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {preset === "custom" && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">From</Label>
                  <Input
                    type="date"
                    value={customFrom}
                    max={customTo}
                    onChange={(e) => setCustomFrom(e.target.value)}
                    className="w-auto"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">To</Label>
                  <Input
                    type="date"
                    value={customTo}
                    min={customFrom}
                    max={today}
                    onChange={(e) => setCustomTo(e.target.value)}
                    className="w-auto"
                  />
                </div>
              </>
            )}
          </div>

          <div className="flex flex-wrap items-end gap-3 border-t pt-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Project</Label>
              <Select value={projectId || ALL} onValueChange={(v) => setProjectId(v === ALL ? "" : (v as string))}>
                <SelectTrigger size="sm" className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All projects</SelectItem>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Resource</Label>
              <Select value={resourceId || ALL} onValueChange={(v) => setResourceId(v === ALL ? "" : (v as string))}>
                <SelectTrigger size="sm" className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All resources</SelectItem>
                  {resources.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Task Category</Label>
              <Select value={taskCategoryId || ALL} onValueChange={(v) => setTaskCategoryId(v === ALL ? "" : (v as string))}>
                <SelectTrigger size="sm" className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All categories</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Work Type</Label>
              <Select value={workDayType || ALL} onValueChange={(v) => setWorkDayType(v === ALL ? "" : (v as string))}>
                <SelectTrigger size="sm" className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All</SelectItem>
                  <SelectItem value="regular">Regular</SelectItem>
                  <SelectItem value="weekend">Weekend</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">NE/Batch</Label>
              <Select value={neBatch || ALL} onValueChange={(v) => setNeBatch(v === ALL ? "" : (v as string))}>
                <SelectTrigger size="sm" className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All</SelectItem>
                  {neBatches.map((b) => (
                    <SelectItem key={b} value={b}>
                      {b}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Utilization Status</Label>
              <Select value={status || ALL} onValueChange={(v) => setStatus(v === ALL ? "" : (v as string))}>
                <SelectTrigger size="sm" className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All statuses</SelectItem>
                  {STATUS_LIST.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error instanceof Error ? error.message : "Failed to load report"}
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-[68px] rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-64 rounded-xl" />
        </div>
      ) : report ? (
        <div className="animate-in fade-in-0 duration-300 space-y-6">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Total Hours" value={`${report.totals.hours.toFixed(1)}h`} icon={Clock} />
            <StatCard label="Work Log Entries" value={report.totals.entries} icon={ListChecks} tone="info" />
            <StatCard label="Resources Active" value={report.totals.uniqueResources} icon={Users} tone="success" />
            <StatCard
              label="Date Range"
              value={
                <span className="text-sm">
                  {report.from === report.to ? report.from : `${report.from} → ${report.to}`}
                </span>
              }
              icon={CalendarRange}
              tone="neutral"
            />
          </div>

          <div>
            <h2 className="mb-3 text-lg font-semibold">Status Breakdown</h2>
            <div className="flex flex-wrap gap-2">
              {STATUS_LIST.map((s) => (
                <Badge
                  key={s}
                  variant="outline"
                  className={
                    s === "Weekend"
                      ? "text-purple-600 bg-purple-50 border-purple-200 dark:text-purple-400 dark:bg-purple-950/40 dark:border-purple-900"
                      : getStatusColor(s as UtilizationStatus)
                  }
                >
                  {s}: {report.statusCounts[s]}
                </Badge>
              ))}
            </div>
          </div>

          <Tabs defaultValue="trend">
            <TabsList>
              <TabsTrigger value="trend">Daily Trend</TabsTrigger>
              <TabsTrigger value="projects">Project Utilization</TabsTrigger>
              <TabsTrigger value="resources">Resource Utilization</TabsTrigger>
              <TabsTrigger value="entries">
                Work Log Entries
                {report.entriesTruncated && (
                  <Badge variant="outline" className="ml-1 text-amber-600 border-amber-200 bg-amber-50">
                    truncated
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="trend" className="mt-3">
              {report.dailyTrend.length <= 1 ? (
                <Card>
                  <EmptyState title="Not enough data points for a trend view." />
                </Card>
              ) : (
                <Card className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="pl-4">Date</TableHead>
                        <TableHead>Total Hours</TableHead>
                        <TableHead className="pr-4">Avg Utilization</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {report.dailyTrend.map((d) => (
                        <TableRow key={d.date}>
                          <TableCell className="pl-4">{d.date}</TableCell>
                          <TableCell className="tabular-nums">{d.hours.toFixed(1)}h</TableCell>
                          <TableCell className="pr-4 tabular-nums">{d.averageUtilizationPercent.toFixed(0)}%</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="projects" className="mt-3">
              <Card className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="pl-4">Project</TableHead>
                      <TableHead>Hours</TableHead>
                      <TableHead>Capacity</TableHead>
                      <TableHead className="pr-4">Utilization</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.perProject
                      .filter((p) => p.hours > 0 || !projectId)
                      .map((p) => (
                        <TableRow key={p.projectId}>
                          <TableCell className="pl-4 font-medium">{p.projectName}</TableCell>
                          <TableCell className="tabular-nums">{p.hours.toFixed(1)}h</TableCell>
                          <TableCell className="tabular-nums">{p.capacity.toFixed(0)}h</TableCell>
                          <TableCell className="pr-4 tabular-nums">{p.utilizationPercent.toFixed(0)}%</TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </Card>
            </TabsContent>

            <TabsContent value="resources" className="mt-3">
              <Card className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="pl-4">Resource</TableHead>
                      <TableHead>Employee ID</TableHead>
                      <TableHead>Hours</TableHead>
                      <TableHead>Entries</TableHead>
                      <TableHead className="pr-4">Avg Utilization</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.perResource.length === 0 ? (
                      <TableRow className="hover:bg-transparent">
                        <TableCell colSpan={5} className="p-0">
                          <EmptyState title="No data for this range/filters." />
                        </TableCell>
                      </TableRow>
                    ) : (
                      report.perResource.map((r) => (
                        <TableRow key={r.resourceId}>
                          <TableCell className="pl-4 font-medium">{r.name}</TableCell>
                          <TableCell className="text-muted-foreground">{r.employeeId ?? "-"}</TableCell>
                          <TableCell className="tabular-nums">{r.hours.toFixed(1)}h</TableCell>
                          <TableCell className="tabular-nums">{r.entryCount}</TableCell>
                          <TableCell className="pr-4 tabular-nums">{r.averageUtilizationPercent.toFixed(0)}%</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </Card>
            </TabsContent>

            <TabsContent value="entries" className="mt-3">
              {report.entriesTruncated && (
                <p className="mb-2 text-xs text-amber-600">
                  Showing first 5000 entries — narrow your filters for a full view.
                </p>
              )}
              <Card className="max-h-[500px] overflow-y-auto p-0">
                <Table>
                  <TableHeader className="sticky top-0 z-10 bg-card">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="pl-4">Date</TableHead>
                      <TableHead>Resource</TableHead>
                      <TableHead>Project</TableHead>
                      <TableHead>Task</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>NE/Batch</TableHead>
                      <TableHead>Units</TableHead>
                      <TableHead>Hours</TableHead>
                      <TableHead className="pr-4">Type</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.entries.length === 0 ? (
                      <TableRow className="hover:bg-transparent">
                        <TableCell colSpan={9} className="p-0">
                          <EmptyState title="No entries for this range/filters." />
                        </TableCell>
                      </TableRow>
                    ) : (
                      report.entries.map((e) => (
                        <TableRow key={e.id}>
                          <TableCell className="pl-4">{e.workDate}</TableCell>
                          <TableCell>{e.resourceName}</TableCell>
                          <TableCell>{e.projectName}</TableCell>
                          <TableCell>{e.taskName}</TableCell>
                          <TableCell className="text-muted-foreground">{e.taskCategoryName ?? "-"}</TableCell>
                          <TableCell className="text-muted-foreground">{e.neBatch ?? "-"}</TableCell>
                          <TableCell>{e.unitsCompleted}</TableCell>
                          <TableCell className="tabular-nums">{e.totalHours}h</TableCell>
                          <TableCell className="pr-4 capitalize">{e.workDayType}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      ) : null}
    </div>
  );
}
