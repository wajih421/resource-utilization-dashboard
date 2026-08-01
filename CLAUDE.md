# ROT Workshop Resource Utilization Dashboard — Session Context

## Stack
- Next.js (App Router, TypeScript)
- Supabase (auth + Postgres) — role-based access via `profiles.role` ("manager" | "resource")
- Tailwind (plain utility classes, no shadcn imports used in built components so far)
- Zod for shared client+server validation

## Business Rules Locked In
- Utilization thresholds (lib/utils/utilization.ts):
  - Not Filled: totalHours <= 0
  - Less Utilized: < 6h
  - Fully Utilized: 6h–8h
  - Highly Utilized: 8h–10h
  - Abnormally Utilized: > 10h
  - Weekend handled separately (flagged via work_day_type, not a threshold)
- WorkLogs store `applied_task_hours` at submission time — never recompute historical hours from current Task.default_hours.
- Tasks are NEVER hard-deleted — only soft-deleted via `active = false`, because WorkLogs FK-reference task_id and historical rows must stay queryable.
- Every manager mutation that changes something meaningful writes to `audit_logs` (manager_id, action, entity_type, entity_id, old_value, new_value).
- RBAC pattern: every manager API route calls a local `requireManager(supabase)` helper that checks `profiles.role === 'manager'`. (Currently duplicated per-route — candidate for extraction into `lib/supabase/require-manager.ts` later if it gets noisy.)

## Existing Project Structure (as of this session)
- app/(auth)/login, set-password — done
- app/api/auth/login, set-password — done
- app/api/manager/assign-project, dashboard-summary, projects, resources — done (pre-existing)
- app/api/manager/tasks — DONE THIS SESSION (GET existed, added POST/PATCH extended/DELETE)
- app/api/manager/task-categories — NEW THIS SESSION (GET, POST)
- app/api/resource/projects, tasks — done (pre-existing)
- app/api/work-logs — done (pre-existing)
- app/manager/attendance, dashboard, projects, resources, tasks — pages exist in tree
- app/manager/tasks/page.tsx — BUILT THIS SESSION (full CRUD UI: filters, inline default-hours edit, add task, add category, activate/deactivate)
- app/resource/dashboard, submit-work — pages exist in tree (not yet reviewed this session)
- components/attendance/AttendanceWidget.tsx — done, reviewed
- components/charts/ProjectUtilizationChart.tsx — done, reviewed (recharts horizontal bar, color-coded by %)
- components/forms/WorkLogForm.tsx — done, reviewed (fetches own projects/tasks, calculates total hours client-side, server validates via workLogSchema)
- components/manager/AssignProjectControl.tsx — done, reviewed
- components/tables/ResourceUtilizationTable.tsx, SummaryTable.tsx — done, reviewed
- lib/utils/utilization.ts — reviewed (see thresholds above)
- lib/validations/worklog-schema.ts — reviewed (zod schema: project_id, task_id as uuid; work_date can't be future; units_completed positive, max 100)
- lib/supabase/client.ts, middleware.ts, server.ts — exist, not reviewed
- types/database-types.ts — EMPTY, not yet generated/filled
- supabase/migrations/001_add_has_custom_password.sql — exists, only migration seen so far; full schema SQL not yet shared

## Open Assumptions (unverified — flag if wrong)
- `tasks` table columns: id, project_id, task_category_id, name, ne_batch, default_hours, active, created_at, updated_at
- `task_categories` table: id, name (name assumed UNIQUE — needed for "already exists" error path)
- `projects` table has at least id, name (used via existing /api/manager/projects)
- `audit_logs` table: manager_id, action, entity_type, entity_id, old_value (jsonb), new_value (jsonb), created_at (default now())

## Files NOT yet reviewed/needed
- Full DB schema/migrations (only saw 001_add_has_custom_password.sql)
- lib/supabase/client.ts, middleware.ts, server.ts
- Existing content of app/manager/dashboard/page.tsx, app/manager/projects/page.tsx, app/manager/resources/page.tsx, app/manager/attendance/page.tsx, app/resource/dashboard/page.tsx, app/resource/submit-work/page.tsx
- Excel master data file (for import/seed script)

## Progress Against Phase Plan (from SRS section 28)
- Phase 1 (Auth + roles): appears done (login, set-password, RBAC via profiles.role)
- Phase 2 (Resource/project/task data): tasks CRUD done this session; projects/resources CRUD status unconfirmed
- Phase 3 (Resource task submission): WorkLogForm + work-logs API exist, not yet reviewed for correctness this session
- Phase 4 (Utilization calculations): thresholds defined in utilization.ts; dashboard-summary route exists but not reviewed
- Phase 5 (Manager dashboard): page exists, not reviewed
- Phase 6 (Assignment management): AssignProjectControl.tsx + assign-project route exist, not reviewed
- Phase 7 (Task/default-hour management): ✅ DONE THIS SESSION
- Phase 8 (Historical analytics): not started
- Phase 9 (Audit logs + exports): audit logging pattern established and used; exports not started

## Next Steps (pending user choice — options given were)
1. Dashboard Summary API + charts wiring (utilization calc)
2. Resource side: Submit Work + Dashboard pages
3. Excel import/seed script for master data

User said: do all steps one by one, confirm before each, update this context.md after every step.