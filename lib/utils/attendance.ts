// lib/utils/attendance.ts
//
// Pure attendance-status derivation, kept separate from the API route so it
// can be unit tested without a database. Business rules (documented here
// since there's no separate spec for them — SRS section 15 covers weekend
// work-type on WorkLogs, not attendance sign-in/out, which is this app's
// own addition):
//
//  - A manager's explicit "on_leave" override always wins.
//  - Otherwise status is derived from sign_in_time / sign_out_time versus
//    the resource's shift_start / shift_end, with a grace period on sign-in
//    before it counts as "late".
//  - If no sign-in has happened yet: "pending" while the shift is still
//    ongoing (or shift times are unknown), "absent" once the shift/day has
//    ended with nothing recorded.
//  - Overnight shifts (shift_end earlier than shift_start) are not
//    supported — this workshop's shifts are same-day (e.g. 11:00-20:00).

export type AttendanceStatus = "present" | "late" | "left_early" | "absent" | "on_leave" | "pending";

export const LATE_GRACE_PERIOD_MINUTES = 10;

function combineDateAndTime(workDate: string, time: string): Date {
  // time is HH:MM:SS (Postgres `time` column) — safe to splice directly.
  return new Date(`${workDate}T${time}`);
}

export function computeAttendanceStatus(params: {
  workDate: string; // YYYY-MM-DD
  shiftStart: string | null; // HH:MM:SS
  shiftEnd: string | null; // HH:MM:SS
  signInTime: string | null; // ISO timestamp
  signOutTime: string | null; // ISO timestamp
  manuallyOnLeave: boolean;
  now?: Date;
}): AttendanceStatus {
  if (params.manuallyOnLeave) return "on_leave";

  const now = params.now ?? new Date();

  if (params.signInTime) {
    const signIn = new Date(params.signInTime);
    const isLate = params.shiftStart
      ? signIn.getTime() >
        combineDateAndTime(params.workDate, params.shiftStart).getTime() + LATE_GRACE_PERIOD_MINUTES * 60_000
      : false;

    if (params.signOutTime) {
      const signOut = new Date(params.signOutTime);
      const leftEarly = params.shiftEnd
        ? signOut.getTime() < combineDateAndTime(params.workDate, params.shiftEnd).getTime()
        : false;
      if (isLate) return "late";
      if (leftEarly) return "left_early";
      return "present";
    }

    return isLate ? "late" : "present";
  }

  // No sign-in recorded yet — has the window to sign in already closed?
  const shiftEndMoment = params.shiftEnd ? combineDateAndTime(params.workDate, params.shiftEnd) : null;
  const endOfWorkDate = combineDateAndTime(params.workDate, "23:59:59");

  if ((shiftEndMoment && now >= shiftEndMoment) || now > endOfWorkDate) {
    return "absent";
  }

  return "pending";
}

export function getAttendanceStatusColor(status: AttendanceStatus): string {
  switch (status) {
    case "present":
      return "text-emerald-600 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-950/40 dark:border-emerald-900";
    case "late":
      return "text-amber-600 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-950/40 dark:border-amber-900";
    case "left_early":
      return "text-orange-600 bg-orange-50 border-orange-200 dark:text-orange-400 dark:bg-orange-950/40 dark:border-orange-900";
    case "absent":
      return "text-red-600 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-950/40 dark:border-red-900";
    case "on_leave":
      return "text-purple-600 bg-purple-50 border-purple-200 dark:text-purple-400 dark:bg-purple-950/40 dark:border-purple-900";
    case "pending":
      return "text-gray-500 bg-gray-50 border-gray-200 dark:text-gray-400 dark:bg-gray-800/40 dark:border-gray-700";
  }
}

export function getAttendanceStatusLabel(status: AttendanceStatus): string {
  switch (status) {
    case "present":
      return "Present";
    case "late":
      return "Late";
    case "left_early":
      return "Left Early";
    case "absent":
      return "Absent";
    case "on_leave":
      return "On Leave";
    case "pending":
      return "Pending";
  }
}
