// components/attendance/AttendanceWidget.tsx
"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

type Attendance = {
  sign_in_time: string | null;
  sign_out_time: string | null;
  status: string | null;
};

const statusLabel: Record<string, string> = {
  present: "Present",
  late: "Late",
  left_early: "Left Early",
  absent: "Absent",
  on_leave: "On Leave",
};

const statusColor: Record<string, string> = {
  present: "text-green-600 bg-green-50",
  late: "text-orange-600 bg-orange-50",
  left_early: "text-orange-600 bg-orange-50",
  absent: "text-red-600 bg-red-50",
  on_leave: "text-blue-600 bg-blue-50",
};

async function fetchAttendance(): Promise<Attendance | null> {
  const res = await fetch("/api/resource/attendance");
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to load attendance");
  return data.attendance;
}

export default function AttendanceWidget() {
  const queryClient = useQueryClient();

  const { data: attendance, isLoading } = useQuery({
    queryKey: ["resource-attendance"],
    queryFn: fetchAttendance,
  });

  const mutation = useMutation({
    mutationFn: async (action: "sign-in" | "sign-out") => {
      const res = await fetch("/api/resource/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Action failed");
      return data.attendance as Attendance;
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(["resource-attendance"], updated);
    },
  });

  if (isLoading) {
    return <div className="bg-white rounded-lg shadow p-4 text-gray-500">Loading...</div>;
  }

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <p className="text-sm text-gray-500 mb-2">Attendance</p>

      {attendance?.status && (
        <span
          className={`inline-block px-2 py-0.5 rounded text-xs font-medium mb-3 ${
            statusColor[attendance.status] ?? "text-gray-600 bg-gray-50"
          }`}
        >
          {statusLabel[attendance.status] ?? attendance.status}
        </span>
      )}

      <div className="flex gap-2">
        <button
          onClick={() => mutation.mutate("sign-in")}
          disabled={mutation.isPending || !!attendance?.sign_in_time}
          className="bg-green-600 text-white rounded px-3 py-1.5 text-sm disabled:opacity-40"
        >
          {attendance?.sign_in_time
            ? `Signed In (${new Date(attendance.sign_in_time).toLocaleTimeString()})`
            : "Sign In"}
        </button>
        <button
          onClick={() => mutation.mutate("sign-out")}
          disabled={mutation.isPending || !attendance?.sign_in_time || !!attendance?.sign_out_time}
          className="bg-gray-700 text-white rounded px-3 py-1.5 text-sm disabled:opacity-40"
        >
          {attendance?.sign_out_time
            ? `Signed Out (${new Date(attendance.sign_out_time).toLocaleTimeString()})`
            : "Sign Out"}
        </button>
      </div>

      {mutation.isError && (
        <p className="text-red-600 text-xs mt-2">
          {mutation.error instanceof Error ? mutation.error.message : "Action failed"}
        </p>
      )}
    </div>
  );
}
