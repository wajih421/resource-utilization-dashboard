# Database Reference

The live schema was reverse-engineered from the running Supabase project via
PostgREST's OpenAPI introspection (`GET {SUPABASE_URL}/rest/v1/` with
`Accept: application/openapi+json`, service-role key) — there is no
tracked migration history covering most of these tables (only
`supabase/migrations/001_add_has_custom_password.sql` exists in-repo). This
document, plus `types/database-types.ts`, is now the source of truth for the
schema shape until real migrations are added.

To regenerate: hit that endpoint again and diff against the tables below;
update `types/database-types.ts` to match (remember: every table needs a
`Relationships` array and the `Database.public` object needs `Views` and
`Functions`, even if empty — see the comment at the top of that file for why).

## Tables

### `profiles`
| column | type | notes |
|---|---|---|
| id | uuid, PK | = `auth.users.id` |
| email | text, not null | the synthetic `{employeeId}@rot-internal.local` address |
| role | text, not null, default `resource` | `"manager"` \| `"resource"` |
| resource_id | uuid, FK → resources.id, nullable | null for managers |
| created_at | timestamptz | |
| has_custom_password | boolean, not null, default false | gates the first-login "set password" flow |

### `resources`
| column | type | notes |
|---|---|---|
| id | uuid, PK | |
| name | text, not null | |
| employee_id | text, nullable | login identifier |
| working_days | text, nullable | free text, e.g. `"Mon to Fri"` — parsed by `lib/utils/working-days.ts` |
| shift_start / shift_end | time, nullable | used by the attendance status derivation |
| workshop_joining_date / huawei_joining_date | date, nullable | |
| active | boolean, default true | soft-delete flag |
| resource_category | text, nullable | e.g. `HRO`, `BO`, `In-Source` |

### `projects`
| column | type | notes |
|---|---|---|
| id | uuid, PK | |
| name | text, not null | |
| active | boolean, default true | soft-delete flag |

### `resource_projects`
Many-to-many join between resources and projects.
| column | type | notes |
|---|---|---|
| id | uuid, PK | |
| resource_id | uuid, FK → resources.id | |
| project_id | uuid, FK → projects.id | |
| assigned_at | timestamptz | |
| active | boolean, default true | soft-delete flag — a resource removed then re-added reactivates the same row rather than duplicating |

### `task_categories`
| column | type |
|---|---|
| id | uuid, PK |
| name | text, not null |

### `tasks`
| column | type | notes |
|---|---|---|
| id | uuid, PK | |
| project_id | uuid, FK → projects.id | |
| task_category_id | uuid, FK → task_categories.id | |
| name | text, not null | |
| ne_batch | text, nullable | |
| default_hours | numeric, not null, default 2 | the "Default Time" from the SRS |
| active | boolean, default true | soft-delete — never hard-deleted, since work_logs FK-reference tasks |

### `work_logs`
| column | type | notes |
|---|---|---|
| id | uuid, PK | |
| resource_id / project_id / task_id | uuid, FK | |
| work_date | date, not null | |
| work_day_type | text, not null, default `regular` | `"regular"` \| `"weekend"` |
| units_completed | numeric, not null | |
| applied_task_hours | numeric, not null | **snapshotted** from `tasks.default_hours` at submission time — never recompute from the current value |
| total_hours | numeric, not null | `applied_task_hours × units_completed` |

### `audit_logs`
| column | type | notes |
|---|---|---|
| id | uuid, PK | |
| manager_id | uuid, FK → profiles.id, nullable | |
| action | text, not null | e.g. `"update_task"`, `"mark_on_leave"` |
| entity_type | text, not null | e.g. `"tasks"`, `"projects"`, `"attendance"` |
| entity_id | uuid, nullable | **must be a real uuid or null** — see the `utilization_settings` note below |
| old_value / new_value | jsonb, nullable | |
| created_at | timestamptz | |

### `utilization_settings`
Single-row config table (`id` is an integer, always `1` in practice — not a
uuid, so it can never be used as an `audit_logs.entity_id`).
| column | type | default |
|---|---|---|
| id | integer, PK | 1 |
| daily_capacity_hours | numeric, not null | 8 |
| less_utilized_max | numeric, not null | 6 |
| fully_utilized_max | numeric, not null | 8 |
| highly_utilized_max | numeric, not null | 10 |

**Why hour-based thresholds, not the SRS's percentage-based scheme:** the
SRS (section 14) describes >100% / 80–100% / <80% and explicitly flags this
as unconfirmed ("needs to be confirmed with whoever currently produces the
Excel report... should make these thresholds configurable"). This table
already existed with these exact hour values seeded, meaning an earlier,
more specifically-informed session had already answered that open question
for real, and the values (6/8/10 against an 8h day) are consistent with —
not contradictory to — the SRS's percentage examples. Rather than introduce
a second, conflicting classification scheme, the app was wired to actually
*read* these already-configurable columns (`lib/utils/utilization.ts`,
`lib/supabase/utilization-settings.ts`), editable at `/manager/settings`.
Percentages are still computed and shown everywhere (`getUtilizationPercent`)
— only the status label boundary is hour-based.

### `attendance_logs`
| column | type | notes |
|---|---|---|
| id | uuid, PK | |
| resource_id | uuid, FK → resources.id, not null | |
| work_date | date, not null | |
| sign_in_time / sign_out_time | timestamptz, nullable | |
| status | text, nullable | `"present" \| "late" \| "left_early" \| "absent" \| "on_leave" \| "pending"` — see `lib/utils/attendance.ts` |
| created_at / updated_at | timestamptz | |

No unique constraint on `(resource_id, work_date)` was confirmed to exist —
the API routes explicitly check-then-insert-or-update rather than relying on
`upsert(...).onConflict(...)`, which would otherwise fail with "no unique or
exclusion constraint matching the ON CONFLICT specification."

## Row-Level Security gotcha (found via end-to-end testing, not assumed)

`attendance_logs` has RLS that allows a resource to read/write only its own
row. A **manager marking another resource on_leave** — a normal, required
feature — fails under the manager's own session client with:

```
new row violates row-level security policy for table "attendance_logs"
```

Fix: `app/api/manager/attendance/route.ts` authenticates/authorizes with the
session client (`requireManager`) as usual, then performs the actual
cross-resource read/write with `createServiceRoleClient()` — the same
pattern `app/api/auth/set-password/route.ts` already used for its own
admin-only operation.

`resource_projects` does **not** have this restriction — confirmed by
actually calling `POST /api/manager/assign-project` and
`DELETE /api/manager/assign-project` over real HTTP with a real manager
session during E2E testing, rather than assuming parity with
`attendance_logs`. If a future table follows the "one resource owns this
row" shape (an attendance-like feature), check for this before assuming the
manager's session client can write to it.
