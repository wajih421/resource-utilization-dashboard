# API Reference

All routes live under `app/api/**/route.ts`. Auth is cookie-based (Supabase
session via `lib/supabase/server.ts`'s `createClient()`), enforced per-route
with `requireManager()` / `requireAuth()` from
`lib/supabase/require-manager.ts` — there is no API key/bearer-token auth for
these endpoints, they're only meant to be called from the app's own
browser session. `middleware.ts` additionally gates whole page sections
(`/manager/*`, `/resource/*`) by role at the routing level.

Every response is JSON. Errors are `{ "error": string }` with a 4xx/5xx
status; the message shown to the client is deliberately generic for 500s
(the real cause is `console.error`'d server-side) but specific for 4xx
validation errors.

## Auth

### `POST /api/auth/login`
Body: `{ employeeId, password }`. Maps to the synthetic
`{employeeId}@rot-internal.local` and calls
`supabase.auth.signInWithPassword`. Returns
`{ success, role, needsPasswordSetup }`.

### `POST /api/auth/set-password`
Body: `{ employeeId, newPassword }`. Service-role only (bypasses RLS) —
looks up the resource by `employee_id`, refuses if
`profiles.has_custom_password` is already true, otherwise sets the password
via `auth.admin.updateUserById` and flips the flag. This is how a resource
sets their password for the first time, without ever needing to know the
random password `scripts/seed-auth-users.mjs` assigned them.

## Settings

### `GET /api/settings`
Any authenticated user. Returns the single `utilization_settings` row.

### `PATCH /api/settings`
Manager only. Body: any subset of
`{ daily_capacity_hours, less_utilized_max, fully_utilized_max, highly_utilized_max }`.
Validates all values are positive and that
`less_utilized_max < fully_utilized_max < highly_utilized_max` holds after
merging with existing values. Audit-logs the diff (`entity_id: null` — see
docs/DATABASE.md for why).

## Manager

### `GET /api/manager/tasks`
All tasks (active and inactive) with joined project/category names.

### `POST /api/manager/tasks`
Body: `{ project_id, task_category_id, name, ne_batch?, default_hours }`.

### `PATCH /api/manager/tasks`
Body: `{ taskId, ...fields }` — allowed fields:
`name, ne_batch, default_hours, project_id, task_category_id, active`.
Audit-logs only the fields that actually changed.

### `DELETE /api/manager/tasks?taskId=`
Soft-delete (`active = false`) — tasks are never hard-deleted (work_logs
FK-reference them).

### `GET /api/manager/task-categories` / `POST /api/manager/task-categories`
List / create. No PATCH/DELETE — categories aren't expected to be renamed or
removed once tasks reference them; the Excel importer treats the category
name as the stable key.

### `GET /api/manager/projects[?includeInactive=true]`
Without the flag: active projects only (used by dropdowns elsewhere in the
app). With it: every project plus `assignedResourceCount`, used by the
Projects management page.

### `POST /api/manager/projects` / `PATCH /api/manager/projects` / `DELETE /api/manager/projects?projectId=`
Create / update (`name`, `active`) / soft-delete. Same pattern as tasks.

### `GET /api/manager/resources`
All resources with their active project assignments
(`assignedProjects: [{ assignmentId, projectId, projectName }]`).

### `POST /api/manager/assign-project`
Body: `{ resourceId, projectId }`. Reactivates a previously-removed
assignment instead of duplicating it if one already exists (soft-deleted).
409 if already actively assigned.

### `DELETE /api/manager/assign-project`
Body: `{ assignmentId }`. Soft-deletes the assignment (`active = false`).

### `GET /api/manager/dashboard-summary?date=YYYY-MM-DD`
The daily dashboard's data source. Reads `utilization_settings` for capacity
+ thresholds, computes per-resource and per-project utilization for the
given date, including Weekend detection (via `working_days` parsing AND/OR
an explicit `work_day_type: "weekend"` log that day).

### `GET /api/manager/attendance?date=YYYY-MM-DD`
Every active resource's attendance status for the date (computed via
`lib/utils/attendance.ts` for resources with no log yet). Uses the
service-role client internally — see docs/DATABASE.md's RLS note.

### `POST /api/manager/attendance`
Body: `{ resourceId, date, status: "on_leave" }`. Manager override,
regardless of any existing sign-in/out. Service-role internally.

### `GET /api/manager/reports`
Historical analytics. Query params:
- `preset`: `today | yesterday | this_week | this_month | custom` (default `today`)
- `from`, `to`: required when `preset=custom` (YYYY-MM-DD)
- `projectId`, `resourceId`, `taskCategoryId`, `workDayType` (`regular`/`weekend`), `neBatch`, `status` (a `ReportStatus`) — all optional filters

Returns totals, a status breakdown, a daily trend, per-project and
per-resource aggregates, and up to 5000 matching raw work-log entries
(`entriesTruncated: true` if capped). See `lib/reports/build-report.ts` for
the aggregation logic (pure, unit-tested, DB-agnostic).

### `GET /api/manager/audit-log`
Query params: `entityType` (exact match), `action` (case-insensitive
substring match, e.g. `action=task` matches `create_task`, `update_task`,
`deactivate_task`), `from`, `to` (date range on `created_at`), `limit`
(default 50, max 200), `offset`. Returns `{ entries, total, limit, offset }`.

## Resource

### `GET /api/resource/projects`
The calling resource's actively-assigned projects.

### `GET /api/resource/tasks?projectId=`
Active tasks under that project (any resource can see any project's tasks
once assigned — task lists aren't per-resource).

### `GET /api/resource/attendance`
The calling resource's own attendance row for today, or `null`.

### `POST /api/resource/attendance`
Body: `{ action: "sign-in" | "sign-out" }`. Computes status via
`lib/utils/attendance.ts`. 409 if already signed in/out, or if a manager has
marked the resource `on_leave` for today.

### `GET /api/resource/today-summary?date=YYYY-MM-DD`
The calling resource's work-log entries and total hours for the date.
(Previously misplaced at `app/manager/resources/today-summary/route.ts` —
now correctly at `app/api/resource/today-summary/route.ts`.)

## Shared

### `POST /api/work-logs`
Body: `{ projectId, taskId, workDate, workDayType, unitsCompleted }`. Snapshots
the task's *current* `default_hours` into `applied_task_hours` at submission
time, computes `total_hours = applied_task_hours × unitsCompleted`. This is
the one rule the whole app is built around — see SRS section 27 / CLAUDE.md.
