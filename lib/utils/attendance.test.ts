import { describe, it, expect } from "vitest";
import { computeAttendanceStatus, LATE_GRACE_PERIOD_MINUTES } from "./attendance";

const WORK_DATE = "2026-08-03"; // a Monday
const SHIFT_START = "11:00:00";
const SHIFT_END = "20:00:00";

describe("computeAttendanceStatus", () => {
  it("returns on_leave when manually overridden, regardless of sign-in state", () => {
    const status = computeAttendanceStatus({
      workDate: WORK_DATE,
      shiftStart: SHIFT_START,
      shiftEnd: SHIFT_END,
      signInTime: `${WORK_DATE}T11:00:00Z`,
      signOutTime: `${WORK_DATE}T20:00:00Z`,
      manuallyOnLeave: true,
    });
    expect(status).toBe("on_leave");
  });

  it("returns present for an on-time sign-in with no sign-out yet", () => {
    const status = computeAttendanceStatus({
      workDate: WORK_DATE,
      shiftStart: SHIFT_START,
      shiftEnd: SHIFT_END,
      signInTime: `${WORK_DATE}T11:00:00`,
      signOutTime: null,
      manuallyOnLeave: false,
    });
    expect(status).toBe("present");
  });

  it("stays present within the grace period after shift start", () => {
    const status = computeAttendanceStatus({
      workDate: WORK_DATE,
      shiftStart: SHIFT_START,
      shiftEnd: SHIFT_END,
      signInTime: `${WORK_DATE}T11:${String(LATE_GRACE_PERIOD_MINUTES).padStart(2, "0")}:00`,
      signOutTime: null,
      manuallyOnLeave: false,
    });
    expect(status).toBe("present");
  });

  it("becomes late one minute past the grace period", () => {
    const lateMinute = LATE_GRACE_PERIOD_MINUTES + 1;
    const status = computeAttendanceStatus({
      workDate: WORK_DATE,
      shiftStart: SHIFT_START,
      shiftEnd: SHIFT_END,
      signInTime: `${WORK_DATE}T11:${String(lateMinute).padStart(2, "0")}:00`,
      signOutTime: null,
      manuallyOnLeave: false,
    });
    expect(status).toBe("late");
  });

  it("returns left_early when signing out before shift end (and on time otherwise)", () => {
    const status = computeAttendanceStatus({
      workDate: WORK_DATE,
      shiftStart: SHIFT_START,
      shiftEnd: SHIFT_END,
      signInTime: `${WORK_DATE}T11:00:00`,
      signOutTime: `${WORK_DATE}T18:00:00`,
      manuallyOnLeave: false,
    });
    expect(status).toBe("left_early");
  });

  it("prioritizes late over left_early when both apply", () => {
    const status = computeAttendanceStatus({
      workDate: WORK_DATE,
      shiftStart: SHIFT_START,
      shiftEnd: SHIFT_END,
      signInTime: `${WORK_DATE}T13:00:00`,
      signOutTime: `${WORK_DATE}T18:00:00`,
      manuallyOnLeave: false,
    });
    expect(status).toBe("late");
  });

  it("returns present when signing out exactly at or after shift end", () => {
    const status = computeAttendanceStatus({
      workDate: WORK_DATE,
      shiftStart: SHIFT_START,
      shiftEnd: SHIFT_END,
      signInTime: `${WORK_DATE}T11:00:00`,
      signOutTime: `${WORK_DATE}T20:00:00`,
      manuallyOnLeave: false,
    });
    expect(status).toBe("present");
  });

  it("returns pending when no sign-in yet and the shift hasn't ended", () => {
    const status = computeAttendanceStatus({
      workDate: WORK_DATE,
      shiftStart: SHIFT_START,
      shiftEnd: SHIFT_END,
      signInTime: null,
      signOutTime: null,
      manuallyOnLeave: false,
      now: new Date(`${WORK_DATE}T15:00:00`),
    });
    expect(status).toBe("pending");
  });

  it("returns absent when no sign-in and the shift has ended", () => {
    const status = computeAttendanceStatus({
      workDate: WORK_DATE,
      shiftStart: SHIFT_START,
      shiftEnd: SHIFT_END,
      signInTime: null,
      signOutTime: null,
      manuallyOnLeave: false,
      now: new Date(`${WORK_DATE}T21:00:00`),
    });
    expect(status).toBe("absent");
  });

  it("returns absent for a past date with no sign-in, even without known shift times", () => {
    const status = computeAttendanceStatus({
      workDate: "2026-01-01",
      shiftStart: null,
      shiftEnd: null,
      signInTime: null,
      signOutTime: null,
      manuallyOnLeave: false,
      now: new Date("2026-08-01T12:00:00"),
    });
    expect(status).toBe("absent");
  });

  it("returns pending for today with no sign-in and unknown shift times", () => {
    const now = new Date(`${WORK_DATE}T12:00:00`);
    const status = computeAttendanceStatus({
      workDate: WORK_DATE,
      shiftStart: null,
      shiftEnd: null,
      signInTime: null,
      signOutTime: null,
      manuallyOnLeave: false,
      now,
    });
    expect(status).toBe("pending");
  });
});
