// app/resource/dashboard/page.tsx
"use client";

import { useQuery } from "@tanstack/react-query";
import { getUtilizationStatus, getStatusColor } from "@/lib/utils/utilization";
import AttendanceWidget from "../../../components/attendance/AttendanceWidget";

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
      <h1 className="text-2xl font-semibold mb-1">My Dashboard</h1>
      <p className="text-gray-500 mb-6">{today}</p>

      {isLoading ? (
        <p className="text-gray-500">Loading...</p>
      ) : error ? (
        <p className="text-red-600">{error instanceof Error ? error.message : "Failed to load dashboard"}</p>
      ) : (
        <>
          <div className="mb-6">
            <AttendanceWidget />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-sm text-gray-500">Productive Hours Today</p>
              <p className="text-2xl font-semibold">{totalHours.toFixed(2)}h</p>
            </div>

            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-sm text-gray-500">Tasks Submitted</p>
              <p className="text-2xl font-semibold">{logs.length}</p>
            </div>

            <div className={`rounded-lg shadow p-4 border ${statusColor}`}>
              <p className="text-sm opacity-80">Status</p>
              <p className="text-lg font-semibold">{status}</p>
            </div>
          </div>

          <h2 className="text-lg font-semibold mb-2">Today&apos;s Submitted Work</h2>

          {logs.length === 0 ? (
            <p className="text-gray-500">Abhi tak koi work submit nahi kiya aaj.</p>
          ) : (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-100 text-left">
                  <tr>
                    <th className="p-3">Project</th>
                    <th className="p-3">Task</th>
                    <th className="p-3">Units</th>
                    <th className="p-3">Hours</th>
                    <th className="p-3">Day Type</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id} className="border-t">
                      <td className="p-3">{log.projects?.name ?? "-"}</td>
                      <td className="p-3">{log.tasks?.name ?? "-"}</td>
                      <td className="p-3">{log.units_completed}</td>
                      <td className="p-3">{log.total_hours}h</td>
                      <td className="p-3 capitalize">{log.work_day_type}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
