// components/attendance/AttendanceWidget.tsx
"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { LogIn, LogOut, Loader2, CalendarClock } from "lucide-react";
import { getAttendanceStatusColor, getAttendanceStatusLabel, type AttendanceStatus } from "@/lib/utils/attendance";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

type Attendance = {
  sign_in_time: string | null;
  sign_out_time: string | null;
  status: string | null;
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
    onSuccess: (updated, action) => {
      queryClient.setQueryData(["resource-attendance"], updated);
      toast.success(action === "sign-in" ? "Signed in successfully" : "Signed out successfully");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Action failed");
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center gap-3 p-4">
          <Skeleton className="h-9 w-24 rounded-lg" />
          <Skeleton className="h-9 w-24 rounded-lg" />
        </CardContent>
      </Card>
    );
  }

  const status = attendance?.status as AttendanceStatus | null | undefined;

  return (
    <Card className="transition-shadow duration-200 hover:shadow-md">
      <CardContent className="flex flex-wrap items-center gap-3 p-4">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <CalendarClock className="size-4.5" />
        </div>
        <div className="mr-auto">
          <p className="text-xs font-medium text-muted-foreground">Attendance</p>
          {status ? (
            <Badge variant="outline" className={`mt-0.5 ${getAttendanceStatusColor(status)}`}>
              {getAttendanceStatusLabel(status)}
            </Badge>
          ) : (
            <p className="text-sm text-muted-foreground">Not signed in yet</p>
          )}
        </div>

        <div className="flex gap-2">
          <Button
            onClick={() => mutation.mutate("sign-in")}
            disabled={mutation.isPending || !!attendance?.sign_in_time}
            variant={attendance?.sign_in_time ? "secondary" : "default"}
          >
            {mutation.isPending && mutation.variables === "sign-in" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <LogIn className="size-4" />
            )}
            {attendance?.sign_in_time
              ? `Signed In · ${new Date(attendance.sign_in_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
              : "Sign In"}
          </Button>
          <Button
            onClick={() => mutation.mutate("sign-out")}
            disabled={mutation.isPending || !attendance?.sign_in_time || !!attendance?.sign_out_time}
            variant="outline"
          >
            {mutation.isPending && mutation.variables === "sign-out" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <LogOut className="size-4" />
            )}
            {attendance?.sign_out_time
              ? `Signed Out · ${new Date(attendance.sign_out_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
              : "Sign Out"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
