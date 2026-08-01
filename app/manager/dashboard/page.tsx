// app/manager/dashboard/page.tsx
"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Users, UserCheck, Zap, CheckCircle2, Clock, AlertTriangle, UserX, Gauge } from "lucide-react";
import ResourceUtilizationTable, {
  type ResourceUtilizationRow,
} from "@/components/tables/ResourceUtilizationTable";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatCard } from "@/components/dashboard/StatCard";
import { EmptyState } from "@/components/layout/EmptyState";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

type ProjectUtilization = {
  projectId: string;
  projectName: string;
  assignedResources: number;
  hours: number;
  capacity: number;
  utilizationPercent: number;
};

type StatusCounts = {
  "Highly Utilized": number;
  "Fully Utilized": number;
  "Less Utilized": number;
  "Abnormally Utilized": number;
  Weekend: number;
  "Not Filled": number;
};

type DashboardData = {
  date: string;
  totalResources: number;
  activeResources: number;
  statusCounts: StatusCounts;
  averageUtilization: number;
  projectUtilization: ProjectUtilization[];
  resources: ResourceUtilizationRow[];
};

async function fetchDashboardSummary(date: string): Promise<DashboardData> {
  const res = await fetch(`/api/manager/dashboard-summary?date=${date}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to load dashboard");
  return data;
}

export default function ManagerDashboardPage() {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));

  const { data, isLoading: loading, error } = useQuery({
    queryKey: ["manager-dashboard-summary", date],
    queryFn: () => fetchDashboardSummary(date),
  });

  return (
    <div>
      <PageHeader
        title="Manager Dashboard"
        description="Daily utilization snapshot across all resources and projects"
        action={
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-auto"
          />
        }
      />

      {loading ? (
        <DashboardSkeleton />
      ) : error ? (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="p-4 text-sm text-destructive">
            {error instanceof Error ? error.message : "Failed to load dashboard"}
          </CardContent>
        </Card>
      ) : data ? (
        <div className="animate-in fade-in-0 duration-300">
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
            <StatCard label="Total Resources" value={data.totalResources} icon={Users} tone="neutral" />
            <StatCard label="Active Today" value={data.activeResources} icon={UserCheck} tone="default" />
            <StatCard
              label="Highly Utilized"
              value={data.statusCounts["Highly Utilized"]}
              icon={Zap}
              tone="default"
            />
            <StatCard
              label="Fully Utilized"
              value={data.statusCounts["Fully Utilized"]}
              icon={CheckCircle2}
              tone="success"
            />
            <StatCard
              label="Less Utilized"
              value={data.statusCounts["Less Utilized"]}
              icon={Clock}
              tone="warning"
            />
            <StatCard
              label="Abnormally Utilized"
              value={data.statusCounts["Abnormally Utilized"]}
              icon={AlertTriangle}
              tone="danger"
            />
            <StatCard label="Not Filled" value={data.statusCounts["Not Filled"]} icon={UserX} tone="neutral" />
          </div>

          <Card className="mb-6 w-fit min-w-[220px]">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Gauge className="size-4.5" />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Average Utilization</p>
                <p className="text-2xl font-semibold tabular-nums">{data.averageUtilization.toFixed(1)}%</p>
              </div>
            </CardContent>
          </Card>

          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Project Utilization</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {data.projectUtilization.length === 0 ? (
                <EmptyState title="Is date ke liye koi data available nahi hai." />
              ) : (
                data.projectUtilization.map((p) => (
                  <div key={p.projectId}>
                    <div className="mb-1.5 flex justify-between text-sm">
                      <span className="font-medium">{p.projectName}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {p.hours.toFixed(1)}h / {p.capacity}h ({p.utilizationPercent.toFixed(0)}%)
                      </span>
                    </div>
                    <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className={`h-full rounded-full transition-[width] duration-700 ease-out ${
                          p.utilizationPercent >= 100
                            ? "bg-red-500"
                            : p.utilizationPercent >= 80
                            ? "bg-emerald-500"
                            : "bg-amber-400"
                        }`}
                        style={{ width: `${Math.min(p.utilizationPercent, 100)}%` }}
                      />
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <h2 className="mb-3 text-lg font-semibold">Resource Utilization</h2>
          <ResourceUtilizationTable rows={data.resources} />
        </div>
      ) : null}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="h-[68px] rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-48 rounded-xl" />
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );
}
