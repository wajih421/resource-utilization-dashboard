# Excel Master-Data Import

SRS section 25 asks for the existing Excel master data (100+ resources,
200+ tasks) to be imported rather than entered by hand. This is implemented
as `scripts/import-master-data.mjs`, backed by the pure, unit-tested parsing
logic in `lib/import/parse-master-data.ts`.

**No real Excel file has been shared yet.** Everything below was built and
verified against a synthetic sample workbook (`docs/sample-master-data.xlsx`,
generated to match this exact column layout) in `--dry-run` mode, which
parses and validates without writing anything to the database. The importer
has never been run in write mode against the live database. Once a real
file is available:

```
node scripts/import-master-data.mjs path/to/real-file.xlsx --dry-run
```

Read the row-by-row error report it prints. Fix any rows it flags (or adjust
the header aliases below if the real file uses different column names), and
only then drop `--dry-run` to actually write. The import is idempotent —
re-running it after fixing a few rows updates/creates rather than
duplicating.

## Expected layout

By default the **first** worksheet in the workbook is treated as Resources
and the **second** as Tasks. Pass `--resources-sheet=Name` /
`--tasks-sheet=Name` if your workbook orders or names them differently.

**Resources sheet** — one row per resource:

| Column | Required | Notes |
|---|---|---|
| Project | yes | matched by name (case-insensitive); created if it doesn't exist yet |
| Resource Name | yes | |
| Resource ID | yes | the unique login/employee identifier — resources are upserted by this |
| Working Days | no | free text, e.g. `"Mon to Fri"` |
| Shift | no | e.g. `"11:00 AM - 8:00 PM"`, `"11:00-20:00"`, `"9:00 AM to 6:00 PM"` — parsed into `shift_start`/`shift_end` |
| Workshop Joining Date | no | any Excel date cell, or a parseable date string |
| Huawei Joining Date | no | same |

**Tasks sheet** — one row per task:

| Column | Required | Notes |
|---|---|---|
| Task Category | yes | matched/created by name |
| Project | yes | must resolve to a project from either sheet |
| Task Name (or Task) | yes | see note below |
| NE/Batch | no | |
| Default Time | yes | numeric, or a string like `"2h"` / `"2.5 hours"` — must be > 0 |

### The "Task" vs "Task Name" ambiguity

The SRS lists the Tasks sheet columns as: *"Task Category, Project, Task,
Task Name, NE/Batch, Default Time"* — naming **both** "Task" and "Task Name"
as separate columns, without explaining how they differ. The live `tasks`
table has a single `name` column, so this needed an interpretation:

- If only one of "Task" / "Task Name" is present, it's used as the name.
- If both are present, **"Task Name" wins** (assumed to be the fuller,
  descriptive name; "Task" assumed to be a shorter code/legacy label).

If a real file turns out to use these two columns for genuinely different
purposes (e.g. "Task" as a stable code that should itself be stored
somewhere), that's a schema conversation, not a parsing tweak — flag it
rather than silently reinterpreting. The alias list is a single array in
`lib/import/parse-master-data.ts` (`findValue(row, ["Task Name", "Task"])`)
if it does just need adjusting.

## What the import does

1. Parses both sheets, validates every row independently (one bad row
   doesn't block the rest — see the printed per-row error list).
2. Ensures every distinct Project name and Task Category name referenced by
   valid rows exists (creates missing ones).
3. Upserts each valid resource by **Resource ID** (creates or updates name /
   working days / shift / joining dates), then ensures an active
   `resource_projects` link to their Project (reactivating a soft-deleted
   link rather than duplicating).
4. Upserts each valid task by `(project, task category, name)` — creates if
   new, updates `default_hours`/`ne_batch` if changed.
5. Prints a summary: counts created/updated per entity, plus any per-row
   failures.

New resources are created **without** a login account — run
`node scripts/seed-auth-users.mjs` afterward to create one per new resource
(random password; the resource sets their own via the "first time login" /
set-password flow, same as existing resources).

## Why ExcelJS, not the `xlsx` package

The obvious first choice (`xlsx` / SheetJS on npm) has two unpatched
high-severity advisories with no fix available
(prototype pollution — GHSA-4r6h-8v6p-xvw6; ReDoS — GHSA-5pgg-2g8v-p4x9).
`exceljs` was used instead — its only flagged transitive dependency
(`uuid`, moderate severity, a buffer-bounds issue that only matters when a
caller passes a custom buffer, which nothing in this import path does) is a
meaningfully smaller risk.
