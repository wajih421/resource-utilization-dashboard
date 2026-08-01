// app/manager/attendance/page.tsx
"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarOff, Loader2, Users } from "lucide-react";
import { getAttendanceStatusColor, getAttendanceStatusLabel, type AttendanceStatus } from "@/lib/utils/attendance";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/layout/EmptyState";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

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
    onSuccess: (_data, resourceId) => {
      queryClient.invalidateQueries({ queryKey: ["manager-attendance", date] });
      const name = rows.find((r) => r.id === resourceId)?.name;
      toast.success(name ? `${name} marked on leave` : "Marked on leave");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to mark leave"),
  });

  const counts = rows.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div>
      <PageHeader
        title="Attendance"
        description="Daily sign-in/out status across all resources"
        action={<Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-auto" />}
      />

      {Object.keys(counts).length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {Object.entries(counts).map(([status, count]) => (
            <Badge
              key={status}
              variant="outline"
              className={getAttendanceStatusColor(status as AttendanceStatus)}
            >
              {getAttendanceStatusLabel(status as AttendanceStatus)}: {count}
            </Badge>
          ))}
        </div>
      )}

      {isLoading ? (
        <Skeleton className="h-96 rounded-lg" />
      ) : error ? (
        <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error instanceof Error ? error.message : "Failed to load attendance"}
        </div>
      ) : (
        <Card className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-4">Name</TableHead>
                <TableHead>Employee ID</TableHead>
                <TableHead>Shift</TableHead>
                <TableHead>Sign In</TableHead>
                <TableHead>Sign Out</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="pr-4"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={7} className="p-0">
                    <EmptyState icon={Users} title="No resources to display for this date." />
                  </TableCell>
                </TableRow>
              )}
              {rows.map((r, i) => (
                <TableRow
                  key={r.id}
                  className="animate-in fade-in-0 duration-300"
                  style={{ animationDelay: `${Math.min(i, 20) * 20}ms`, animationFillMode: "backwards" }}
                >
                  <TableCell className="pl-4 font-medium">{r.name}</TableCell>
                  <TableCell className="text-muted-foreground">{r.employee_id}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {r.shift_start && r.shift_end ? `${r.shift_start.slice(0, 5)} - ${r.shift_end.slice(0, 5)}` : "-"}
                  </TableCell>
                  <TableCell>
                    {r.sign_in_time
                      ? new Date(r.sign_in_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                      : "-"}
                  </TableCell>
                  <TableCell>
                    {r.sign_out_time
                      ? new Date(r.sign_out_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                      : "-"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={getAttendanceStatusColor(r.status as AttendanceStatus)}>
                      {getAttendanceStatusLabel(r.status as AttendanceStatus)}
                    </Badge>
                  </TableCell>
                  <TableCell className="pr-4">
                    {r.status !== "on_leave" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => markLeaveMutation.mutate(r.id)}
                        disabled={markLeaveMutation.isPending && markLeaveMutation.variables === r.id}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        {markLeaveMutation.isPending && markLeaveMutation.variables === r.id ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <CalendarOff className="size-3.5" />
                        )}
                        Mark On Leave
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
