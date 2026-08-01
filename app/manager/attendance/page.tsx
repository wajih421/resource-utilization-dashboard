// app/manager/attendance/page.tsx
"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

type AttendanceRow = {
  id: string;
  name: string;
  employee_id: string;
  shift_start: string | null;
  shift_end: string | null;
  sign_in_time: string | null;
  sign_out_time: string | null;
  status: string;
};

const statusLabel: Record<string, string> = {
  present: "Present",
  late: "Late",
  left_early: "Left Early",
  absent: "Absent",
  on_leave: "On Leave",
  pending: "Pending",
};

const statusColor: Record<string, string> = {
  present: "text-green-600 bg-green-50",
  late: "text-orange-600 bg-orange-50",
  left_early: "text-orange-600 bg-orange-50",
  absent: "text-red-600 bg-red-50",
  on_leave: "text-blue-600 bg-blue-50",
  pending: "text-gray-500 bg-gray-50",
};

async function fetchAttendance(date: string): Promise<AttendanceRow[]> {
  const res = await fetch(`/api/manager/attendance?date=${date}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to load attendance");
  return data.attendance;
}

export default function ManagerAttendancePage() {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const queryClient = useQueryClient();

  const { data: rows = [], isLoading, error } = useQuery({
    queryKey: ["manager-attendance", date],
    queryFn: () => fetchAttendance(date),
  });

  const markLeaveMutation = useMutation({
    mutationFn: async (resourceId: string) => {
      const res = await fetch("/api/manager/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resourceId, date, status: "on_leave" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to mark leave");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["manager-attendance", date] });
    },
  });

  const counts = rows.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">Attendance</h1>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="border rounded px-3 py-2"
        />
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        {Object.entries(counts).map(([status, count]) => (
          <span
            key={status}
            className={`px-3 py-1 rounded text-sm font-medium ${
              statusColor[status] ?? "text-gray-600 bg-gray-50"
            }`}
          >
            {statusLabel[status] ?? status}: {count}
          </span>
        ))}
      </div>

      {markLeaveMutation.isError && (
        <p className="text-red-600 text-sm mb-3">
          {markLeaveMutation.error instanceof Error ? markLeaveMutation.error.message : "Failed to mark leave"}
        </p>
      )}

      {isLoading ? (
        <p className="text-gray-500">Loading...</p>
      ) : error ? (
        <p className="text-red-600">{error instanceof Error ? error.message : "Failed to load attendance"}</p>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 text-left">
              <tr>
                <th className="p-3">Name</th>
                <th className="p-3">Employee ID</th>
                <th className="p-3">Shift</th>
                <th className="p-3">Sign In</th>
                <th className="p-3">Sign Out</th>
                <th className="p-3">Status</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="p-3 font-medium">{r.name}</td>
                  <td className="p-3 text-gray-500">{r.employee_id}</td>
                  <td className="p-3 text-gray-500">
                    {r.shift_start && r.shift_end
                      ? `${r.shift_start.slice(0, 5)} - ${r.shift_end.slice(0, 5)}`
                      : "-"}
                  </td>
                  <td className="p-3">
                    {r.sign_in_time
                      ? new Date(r.sign_in_time).toLocaleTimeString()
                      : "-"}
                  </td>
                  <td className="p-3">
                    {r.sign_out_time
                      ? new Date(r.sign_out_time).toLocaleTimeString()
                      : "-"}
                  </td>
                  <td className="p-3">
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-medium ${
                        statusColor[r.status] ?? "text-gray-600 bg-gray-50"
                      }`}
                    >
                      {statusLabel[r.status] ?? r.status}
                    </span>
                  </td>
                  <td className="p-3">
                    {r.status !== "on_leave" && (
                      <button
                        onClick={() => markLeaveMutation.mutate(r.id)}
                        disabled={markLeaveMutation.isPending}
                        className="text-xs text-blue-600 hover:underline disabled:opacity-40"
                      >
                        Mark On Leave
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
