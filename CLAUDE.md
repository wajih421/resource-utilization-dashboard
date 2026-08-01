# ROT Workshop Resource Utilization Dashboard — Session Context

See also: `docs/SRS.md` (full requirements spec), `docs/DATABASE.md` (schema
reference), `docs/API.md` (endpoint reference), `docs/EXCEL_IMPORT.md`
(master-data import).

## Stack

- Next.js 16 (App Router, TypeScript), React 19
- Supabase (auth + Postgres) — role-based access via `profiles.role` ("manager" | "resource")
- TanStack React Query for all client-side data fetching/mutation (see "Why React Query" below)
- Tailwind (plain utility classes, no shadcn imports used in built components)
- Zod for validation, ExcelJS for the master-data importer
- Vitest for unit tests (69 tests across 6 files, all pure logic — no DB/network mocking needed)

## Business Rules Locked In

- Utilization thresholds are **configurable**, stored in `utilization_settings`
  (single-row table: `daily_capacity_hours`, `less_utilized_max`,
  `fully_utilized_max`, `highly_utilized_max`) and edited via
  `/manager/settings`. Classification is by **absolute hours**, not percentage
  — see `lib/utils/utilization.ts` and docs/DATABASE.md for why this was
  chosen over the percentage-based scheme the SRS sketches.
- WorkLogs store `applied_task_hours` at submission time — never recompute
  historical hours from current Task.default_hours.
- Tasks and Projects are NEVER hard-deleted — only soft-deleted via
  `active = false`, because WorkLogs/resource_projects FK-reference them and
  historical rows must stay queryable.
- Every manager mutation that changes something meaningful writes to
  `audit_logs` (manager_id, action, entity_type, entity_id, old_value,
  new_value) via `lib/supabase/audit-log.ts`.
- RBAC pattern: `lib/supabase/require-manager.ts` exports `requireManager()`
  and `requireAuth()`, used by every `app/api/**` route instead of the
  duplicated inline checks that used to exist per-file.
- **Manager writes to another resource's row need the service-role client**,
  not the session client. RLS on tables with a natural "owner" (currently
  `attendance_logs`) restricts writes to the owning resource; a manager
  overriding another resource's attendance therefore authenticates with the
  session client (`requireManager`) but performs the actual read/write with
  `createServiceRoleClient()`. `resource_projects` and the global tables
  (`tasks`, `projects`, `task_categories`) do NOT have this restriction —
  confirmed via real end-to-end HTTP testing, not assumed.

## Why React Query

Every client-fetching page used to be raw `useEffect` + `fetch` + `useState`,
which the project's own ESLint config (`react-hooks/set-state-in-effect`,
part of the React Compiler ruleset already configured in `eslint.config.mjs`)
flags as an error. `@tanstack/react-query` was already an installed
dependency, unused. Next.js's own bundled docs
(`node_modules/next/dist/docs/01-app/02-guides/single-page-applications.md`)
name it explicitly as the recommended pattern for this kind of client-side
fetching. All pages now use `useQuery`/`useMutation` (provider wired up in
`app/providers.tsx` / `app/layout.tsx`); `npm run lint` and `npx tsc --noEmit`
are both clean (0 errors, 0 warnings).

## Project Structure (current)

- `app/(auth)/login`, `set-password` — done
- `app/api/auth/login`, `set-password` — done (set-password uses the shared `createServiceRoleClient()`)
- `app/api/settings` — GET (any authenticated user), PATCH (manager only) — done
- `app/api/manager/tasks`, `task-categories` — full CRUD — done
- `app/api/manager/projects` — full CRUD + `?includeInactive=true` for the management view — done
- `app/api/manager/resources`, `assign-project` — done
- `app/api/manager/dashboard-summary` — done, reads configurable thresholds/capacity from `utilization_settings`
- `app/api/manager/attendance` — GET (list + computed status) / POST (mark on_leave) — done, uses service-role for the actual DB ops
- `app/api/manager/reports` — historical analytics with date-range presets + 6 filter dimensions — done
- `app/api/manager/audit-log` — paginated audit trail — done
- `app/api/resource/projects`, `tasks`, `attendance`, `today-summary` — done (today-summary was previously misplaced under `app/manager/resources/today-summary/`, now fixed)
- `app/api/work-logs` — done (pre-existing)
- `app/manager/{dashboard,tasks,resources,attendance,projects,reports,audit-log,settings}` — all built, all React Query
- `app/resource/{dashboard,submit-work}` — done, React Query
- `components/attendance/AttendanceWidget.tsx` — done, React Query
- `components/tables/ResourceUtilizationTable.tsx` — done (only surviving pre-built component; the other 4 — WorkLogForm, AssignProjectControl, SummaryTable, ProjectUtilizationChart — were dead/unused with real bugs and were deleted)
- `lib/utils/utilization.ts`, `attendance.ts`, `date-range.ts`, `working-days.ts` — pure, unit-tested
- `lib/reports/build-report.ts` — pure aggregation for Reports, unit-tested
- `lib/import/parse-master-data.ts` — pure Excel row parsing/validation, unit-tested
- `lib/supabase/require-manager.ts`, `audit-log.ts`, `utilization-settings.ts` — shared server helpers
- `scripts/import-master-data.mjs` — Excel master-data import (dry-run tested against `docs/sample-master-data.xlsx`; never run in write mode against the live DB — see docs/EXCEL_IMPORT.md)
- `scripts/seed-auth-users.mjs` — pre-existing, updated to use `scripts/lib/load-env.mjs`
- `types/database-types.ts` — hand-written from real schema introspection (was empty before)

## Environment note

The project's env file is `.env.local` (not `.env`) — Next.js loads this
automatically, but standalone Node scripts need `scripts/lib/load-env.mjs`
(handles both names, prefers `.env.local`).

## Verification done this session

- `npx tsc --noEmit` — 0 errors
- `npx eslint .` — 0 errors, 0 warnings
- `npx vitest run` — 69/69 tests passing (utilization thresholds, attendance
  status derivation, date-range presets incl. a timezone bug caught by the
  tests themselves, working-days parsing, report aggregation, Excel row
  parsing)
- Full end-to-end run against the live dev server with real, synthetic
  QA manager + resource accounts (created, exercised every new/changed route
  and page over real HTTP with real sessions, then fully deleted) — 40/40
  checks passed. This is what caught the `attendance_logs` RLS gap; a
  same-shape test for `resource_projects` confirmed that table has no
  equivalent issue.

## Known limitations / deliberately out of scope

- Excel import script is built and dry-run verified against a synthetic
  sample workbook (`docs/sample-master-data.xlsx`), but has never been run
  in write mode against the real Excel file, because no real file has been
  shared yet. Column-header aliases may need adjusting once a real file is
  available — see docs/EXCEL_IMPORT.md.
- Attendance status derivation assumes same-day shifts (no overnight
  wraparound) and a fixed 10-minute late-grace-period; see
  `lib/utils/attendance.ts`.
- Reports' per-project "capacity" figure is an approximation
  (`assignedResources × dailyCapacityHours × daysInRange`) — it doesn't
  account for individual resources' `working_days` calendars the way the
  daily dashboard's status classification does. Documented in
  `lib/reports/build-report.ts`.
