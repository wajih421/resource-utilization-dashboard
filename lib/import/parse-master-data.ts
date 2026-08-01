// lib/import/parse-master-data.ts
//
// Pure parsing/validation for the Excel master-data import (SRS section 25:
// "Excel Data Import"). Deliberately has no file-system or spreadsheet-
// library dependency — scripts/import-master-data.mjs reads the workbook
// and hands plain row objects in here, which keeps this module unit
// testable and reusable if the import is ever triggered from a web upload
// instead of a CLI script.
//
// Column layout is per SRS section 25/26 (two sheets):
//   Resources sheet: Project, Resource Name, Resource ID, Working Days,
//                    Shift, Workshop Joining Date, Huawei Joining Date
//   Tasks sheet:     Task Category, Project, Task / Task Name, NE/Batch,
//                    Default Time
//
// The SRS lists both "Task" and "Task Name" as separate columns for the
// tasks sheet without clarifying how they differ, and the live `tasks`
// table has a single `name` column. Both header spellings are accepted as
// aliases for the same logical field ("Task Name" wins if a sheet somehow
// has both) — see docs/EXCEL_IMPORT.md for how to adjust this if a real
// export uses "Task" and "Task Name" for two genuinely different things.

export type RawRow = Record<string, unknown>;

export type ParsedResourceRow = {
  rowNumber: number;
  projectName: string | null;
  resourceName: string | null;
  employeeId: string | null;
  workingDays: string | null;
  shiftStart: string | null; // HH:MM:SS
  shiftEnd: string | null; // HH:MM:SS
  workshopJoiningDate: string | null; // YYYY-MM-DD
  huaweiJoiningDate: string | null; // YYYY-MM-DD
  errors: string[];
};

export type ParsedTaskRow = {
  rowNumber: number;
  taskCategoryName: string | null;
  projectName: string | null;
  taskName: string | null;
  neBatch: string | null;
  defaultHours: number | null;
  errors: string[];
};

function normalizeHeader(header: string): string {
  return header.trim().toLowerCase().replace(/[\s/_-]+/g, " ");
}

// Finds a value in `row` matching any of `aliases`, tolerant of header
// casing/spacing/punctuation differences between real-world Excel exports.
// Aliases are tried in the given priority order (not row key order) so that
// e.g. ["Task Name", "Task"] prefers "Task Name" even if "Task" happens to
// appear first among the row's own keys.
function findValue(row: RawRow, aliases: string[]): unknown {
  const rowKeysByNormalized = new Map(Object.keys(row).map((key) => [normalizeHeader(key), key]));
  for (const alias of aliases) {
    const matchedKey = rowKeysByNormalized.get(normalizeHeader(alias));
    if (matchedKey !== undefined) return row[matchedKey];
  }
  return undefined;
}

function toTrimmedStringOrNull(value: unknown): string | null {
  if (value == null) return null;
  const str = String(value).trim();
  return str.length > 0 ? str : null;
}

// Excel date cells arrive as JS Date objects when the reader is configured
// with cellDates:true; plain strings are also accepted as a fallback for
// text-formatted date columns.
export function parseExcelDate(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (value instanceof Date) {
    if (isNaN(value.getTime())) return null;
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  const str = String(value).trim();
  if (!str) return null;
  const parsed = new Date(str);
  if (isNaN(parsed.getTime())) return null;
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const TIME_TOKEN = /(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i;

function parseTimeToken(raw: string): string | null {
  const match = raw.trim().match(new RegExp(`^${TIME_TOKEN.source}$`, "i"));
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = match[2] ? Number(match[2]) : 0;
  const meridiem = match[3]?.toLowerCase();

  if (hour > 23 || minute > 59) return null;

  if (meridiem === "pm" && hour < 12) hour += 12;
  if (meridiem === "am" && hour === 12) hour = 0;

  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00`;
}

// Accepts "11:00 AM - 8:00 PM", "11:00-20:00", "11:00:00 to 20:00:00", etc.
export function parseShiftRange(value: unknown): { start: string; end: string } | null {
  if (value == null) return null;
  const str = String(value).trim();
  if (!str) return null;

  const parts = str.split(/\s*(?:-|–|—|to)\s*/i);
  if (parts.length !== 2) return null;

  const start = parseTimeToken(parts[0]);
  const end = parseTimeToken(parts[1]);
  if (!start || !end) return null;

  return { start, end };
}

export function parseDefaultHours(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "number") return isNaN(value) ? null : value;
  const cleaned = String(value).replace(/[^0-9.]/g, "");
  if (!cleaned) return null;
  const num = Number(cleaned);
  return isNaN(num) ? null : num;
}

export function parseResourceRow(row: RawRow, rowNumber: number): ParsedResourceRow {
  const projectName = toTrimmedStringOrNull(findValue(row, ["Project"]));
  const resourceName = toTrimmedStringOrNull(findValue(row, ["Resource Name", "Name"]));
  const employeeId = toTrimmedStringOrNull(findValue(row, ["Resource ID", "Employee ID", "EmployeeID"]));
  const workingDays = toTrimmedStringOrNull(findValue(row, ["Working Days"]));
  const shiftRaw = findValue(row, ["Shift"]);
  const workshopJoiningDate = parseExcelDate(findValue(row, ["Workshop Joining Date"]));
  const huaweiJoiningDate = parseExcelDate(findValue(row, ["Huawei Joining Date"]));

  const errors: string[] = [];
  if (!projectName) errors.push("Missing Project");
  if (!resourceName) errors.push("Missing Resource Name");
  if (!employeeId) errors.push("Missing Resource ID");

  const shift = parseShiftRange(shiftRaw);
  if (shiftRaw != null && String(shiftRaw).trim() && !shift) {
    errors.push(`Could not parse Shift value "${shiftRaw}" (expected e.g. "11:00 AM - 8:00 PM")`);
  }

  return {
    rowNumber,
    projectName,
    resourceName,
    employeeId,
    workingDays,
    shiftStart: shift?.start ?? null,
    shiftEnd: shift?.end ?? null,
    workshopJoiningDate,
    huaweiJoiningDate,
    errors,
  };
}

export function parseTaskRow(row: RawRow, rowNumber: number): ParsedTaskRow {
  const taskCategoryName = toTrimmedStringOrNull(findValue(row, ["Task Category"]));
  const projectName = toTrimmedStringOrNull(findValue(row, ["Project"]));
  // "Task Name" wins over "Task" if a sheet somehow has both columns.
  const taskName = toTrimmedStringOrNull(findValue(row, ["Task Name", "Task"]));
  const neBatch = toTrimmedStringOrNull(findValue(row, ["NE/Batch", "NE Batch", "NE"]));
  const defaultHoursRaw = findValue(row, ["Default Time", "Default Hours"]);
  const defaultHours = parseDefaultHours(defaultHoursRaw);

  const errors: string[] = [];
  if (!taskCategoryName) errors.push("Missing Task Category");
  if (!projectName) errors.push("Missing Project");
  if (!taskName) errors.push("Missing Task/Task Name");
  if (defaultHoursRaw != null && String(defaultHoursRaw).trim() && defaultHours == null) {
    errors.push(`Could not parse Default Time value "${defaultHoursRaw}"`);
  } else if (defaultHours != null && defaultHours <= 0) {
    errors.push("Default Time must be greater than 0");
  } else if (defaultHours == null) {
    errors.push("Missing Default Time");
  }

  return { rowNumber, taskCategoryName, projectName, taskName, neBatch, defaultHours, errors };
}

export function parseResourceSheet(rows: RawRow[]): ParsedResourceRow[] {
  return rows.map((row, i) => parseResourceRow(row, i + 2)); // +2: header row + 1-indexing
}

export function parseTaskSheet(rows: RawRow[]): ParsedTaskRow[] {
  return rows.map((row, i) => parseTaskRow(row, i + 2));
}
