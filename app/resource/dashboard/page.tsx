// app/resource/dashboard/page.tsx
"use client";

import { useQuery } from "@tanstack/react-query";
import { Clock, ListChecks, Gauge, ClipboardX } from "lucide-react";
import { getUtilizationStatus, getStatusColor } from "@/lib/utils/utilization";
import AttendanceWidget from "@/components/attendance/AttendanceWidget";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatCard } from "@/components/dashboard/StatCard";
import { EmptyState } from "@/components/layout/EmptyState";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

type WorkLog = {
  id: string;
  units_completed: number;
  applied_task_hours: number;
  total_hours: number;
  work_day_type: "regular" | "weekend";
  projects: { name: string } | null;
  tasks: { name: string } | null;
};

type TodaySummary = { logs: WorkLog[]; totalHours: number; date: string };

async function fetchTodaySummary(date: string): Promise<TodaySummary> {
  const res = await fetch(`/api/resource/today-summary?date=${date}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to load dashboard");
  return data;
}

export default function ResourceDashboardPage() {
  const today = new Date().toISOString().slice(0, 10);

  const { data, isLoading, error } = useQuery({
    queryKey: ["resource-today-summary", today],
    queryFn: () => fetchTodaySummary(today),
  });

  const logs = data?.logs ?? [];
  const totalHours = data?.totalHours ?? 0;
  const status = getUtilizationStatus(totalHours);
  const statusColor = getStatusColor(status);

  return (
    <div>
      <PageHeader title="My Dashboard" description={today} />

      {isLoading ? (
        <div className="space-y-6">
          <Skeleton className="h-20 rounded-xl" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Skeleton className="h-20 rounded-xl" />
            <Skeleton className="h-20 rounded-xl" />
            <Skeleton className="h-20 rounded-xl" />
          </div>
          <Skeleton className="h-48 rounded-xl" />
        </div>
      ) : error ? (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="p-4 text-sm text-destructive">
            {error instanceof Error ? error.message : "Failed to load dashboard"}
          </CardContent>
        </Card>
      ) : (
        <div className="animate-in fade-in-0 duration-300">
          <div className="mb-6">
            <AttendanceWidget />
          </div>

          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard label="Productive Hours Today" value={`${totalHours.toFixed(2)}h`} icon={Clock} />
            <StatCard label="Tasks Submitted" value={logs.length} icon={ListChecks} tone="info" />
            <Card className="py-0">
              <CardContent className="flex items-center gap-3 p-4">
                <div className={`flex size-9 shrink-0 items-center justify-center rounded-lg border ${statusColor}`}>
                  <Gauge className="size-4.5" />
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Status</p>
                  <p className="text-lg font-semibold">{status}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Today&apos;s Submitted Work</CardTitle>
            </CardHeader>
            <CardContent className="px-0 pt-0">
              {logs.length === 0 ? (
                <EmptyState
                  icon={ClipboardX}
                  title="Abhi tak koi work submit nahi kiya aaj."
                  description="Submit Work page se apna kaam log karein."
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="pl-4">Project</TableHead>
                      <TableHead>Task</TableHead>
                      <TableHead>Units</TableHead>
                      <TableHead>Hours</TableHead>
                      <TableHead className="pr-4">Day Type</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log, i) => (
                      <TableRow
                        key={log.id}
                        className="animate-in fade-in-0 duration-300"
                        style={{ animationDelay: `${i * 40}ms`, animationFillMode: "backwards" }}
                      >
                        <TableCell className="pl-4">{log.projects?.name ?? "-"}</TableCell>
                        <TableCell>{log.tasks?.name ?? "-"}</TableCell>
                        <TableCell>{log.units_completed}</TableCell>
                        <TableCell className="tabular-nums">{log.total_hours}h</TableCell>
                        <TableCell className="pr-4">
                          <Badge variant={log.work_day_type === "weekend" ? "outline" : "secondary"} className="capitalize">
                            {log.work_day_type}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
