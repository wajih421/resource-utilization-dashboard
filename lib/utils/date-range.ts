// lib/utils/date-range.ts
// Pure date-range resolution for the Reports page presets (SRS section 22:
// Today / Yesterday / This Week / This Month / Custom Date Range).

export type DateRangePreset = "today" | "yesterday" | "this_week" | "this_month" | "custom";

// Deliberately NOT d.toISOString().slice(0, 10): that converts to UTC first,
// which silently shifts the calendar date backward by a day for any positive
// UTC offset (e.g. Pakistan, UTC+5) since `d` here is always local midnight.
// Reading the local y/m/d components directly keeps "today" actually today.
function toDateStr(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function resolveDateRange(
  preset: DateRangePreset,
  custom?: { from?: string; to?: string },
  now: Date = new Date()
): { from: string; to: string } {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (preset) {
    case "today":
      return { from: toDateStr(today), to: toDateStr(today) };

    case "yesterday": {
      const y = new Date(today);
      y.setDate(y.getDate() - 1);
      return { from: toDateStr(y), to: toDateStr(y) };
    }

    case "this_week": {
      // Week starts Monday. getDay(): 0=Sun..6=Sat.
      const day = today.getDay();
      const diffToMonday = (day + 6) % 7;
      const monday = new Date(today);
      monday.setDate(monday.getDate() - diffToMonday);
      return { from: toDateStr(monday), to: toDateStr(today) };
    }

    case "this_month": {
      const first = new Date(today.getFullYear(), today.getMonth(), 1);
      return { from: toDateStr(first), to: toDateStr(today) };
    }

    case "custom": {
      if (!custom?.from || !custom?.to) {
        throw new Error("Custom date range requires both 'from' and 'to'");
      }
      if (custom.from > custom.to) {
        throw new Error("'from' date must not be after 'to' date");
      }
      return { from: custom.from, to: custom.to };
    }
  }
}

// Inclusive list of YYYY-MM-DD strings between from and to.
export function enumerateDates(from: string, to: string): string[] {
  const dates: string[] = [];
  const cursor = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  while (cursor <= end) {
    dates.push(toDateStr(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}
