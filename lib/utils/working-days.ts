// lib/utils/working-days.ts
// resources.working_days is a free-text field like "Mon to Fri" or
// "Mon to Sat". Parsed here so we can tell whether a given date falls on
// that resource's day off — used to report "Weekend" instead of a
// hours-based status (which would otherwise show as "Not Filled" and look
// like a missed day rather than an expected day off). Shared between the
// daily dashboard-summary route and the multi-day reports builder.

const DAY_ORDER = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function isWorkingDay(workingDays: string | null, dateStr: string): boolean {
  if (!workingDays) return true; // unknown -> assume it's a working day

  const match = workingDays.match(/(\w{3})\w*\s*to\s*(\w{3})/i);
  if (!match) return true; // unparseable format -> don't guess, assume working day

  const startIdx = DAY_ORDER.findIndex(
    (d) => d.toLowerCase() === match[1].slice(0, 3).toLowerCase()
  );
  const endIdx = DAY_ORDER.findIndex(
    (d) => d.toLowerCase() === match[2].slice(0, 3).toLowerCase()
  );
  if (startIdx === -1 || endIdx === -1) return true;

  const targetIdx = new Date(dateStr + "T00:00:00").getDay();

  if (startIdx <= endIdx) {
    return targetIdx >= startIdx && targetIdx <= endIdx;
  }
  // range wraps around the week (e.g. Fri to Tue)
  return targetIdx >= startIdx || targetIdx <= endIdx;
}
