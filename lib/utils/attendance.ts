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
