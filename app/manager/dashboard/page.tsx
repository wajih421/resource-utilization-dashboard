// app/manager/dashboard/page.tsx
"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import ResourceUtilizationTable, {
  type ResourceUtilizationRow,
} from "@/components/tables/ResourceUtilizationTable";

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
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Manager Dashboard</h1>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="border rounded px-3 py-2"
        />
      </div>

      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : error ? (
        <p className="text-red-600">{error instanceof Error ? error.message : "Failed to load dashboard"}</p>
      ) : data ? (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-8">
            <KpiCard label="Total Resources" value={data.totalResources} />
            <KpiCard label="Active Today" value={data.activeResources} />
            <KpiCard
              label="Highly Utilized"
              value={data.statusCounts["Highly Utilized"]}
              color="text-blue-600"
            />
            <KpiCard
              label="Fully Utilized"
              value={data.statusCounts["Fully Utilized"]}
              color="text-green-600"
            />
            <KpiCard
              label="Less Utilized"
              value={data.statusCounts["Less Utilized"]}
              color="text-orange-600"
            />
            <KpiCard
              label="Abnormally Utilized"
              value={data.statusCounts["Abnormally Utilized"]}
              color="text-red-600"
            />
            <KpiCard
              label="Not Filled"
              value={data.statusCounts["Not Filled"]}
              color="text-gray-500"
            />
          </div>

          <div className="bg-white rounded-lg shadow p-4 mb-6 inline-block">
            <p className="text-sm text-gray-500">Average Utilization</p>
            <p className="text-2xl font-semibold">
              {data.averageUtilization.toFixed(1)}%
            </p>
          </div>

          {/* Project Utilization */}
          <h2 className="text-lg font-semibold mb-3">Project Utilization</h2>
          <div className="bg-white rounded-lg shadow p-4 space-y-3 mb-8">
            {data.projectUtilization.length === 0 ? (
              <p className="text-gray-500 text-sm">
                Is date ke liye koi data available nahi hai.
              </p>
            ) : (
              data.projectUtilization.map((p) => (
                <div key={p.projectId}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium">{p.projectName}</span>
                    <span className="text-gray-500">
                      {p.hours.toFixed(1)}h / {p.capacity}h ({p.utilizationPercent.toFixed(0)}%)
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 rounded h-3">
                    <div
                      className={`h-3 rounded ${
                        p.utilizationPercent >= 100
                          ? "bg-red-500"
                          : p.utilizationPercent >= 80
                          ? "bg-green-500"
                          : "bg-orange-400"
                      }`}
                      style={{ width: `${Math.min(p.utilizationPercent, 100)}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Resource-wise breakdown */}
          <h2 className="text-lg font-semibold mb-3">Resource Utilization</h2>
          <ResourceUtilizationTable rows={data.resources} />
        </>
      ) : null}
    </div>
  );
}

function KpiCard({
  label,
  value,
  color = "text-gray-900",
}: {
  label: string;
  value: number;
  color?: string;
}) {
  return (
    <div className="bg-white rounded-lg shadow p-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`text-xl font-semibold ${color}`}>{value}</p>
    </div>
  );
}