# SRS — ROT Workshop Resource Utilization Dashboard

This is the source-of-truth requirements document, as provided by the
project owner. See `CLAUDE.md` for how each section maps to what's actually
built, and any deliberate deviations (with justification).

## 1. Project Overview

### 1.1 Project Name

ROT Workshop Resource Utilization & Productivity Dashboard

### 1.2 Project Description

The system will be a web-based resource utilization and productivity management platform for the ROT Workshop.

The system will allow resources/employees to:

- View projects assigned to them
- View tasks available under their assigned projects
- Select the task they are currently working on
- Specify how many units/times they completed the task
- Record whether the work was performed on a regular working day or weekend
- Track their daily working hours/productivity

The system will allow managers to:

- View overall resource utilization
- View project-level utilization
- View individual resource productivity
- Manage resource-project assignments
- Manage task default hours
- Monitor daily productivity
- Identify highly utilized, fully utilized, less utilized, weekend and not-filled resources
- Review historical utilization data

## 2. Problem Statement

Currently, resource utilization is being calculated/reported through spreadsheets and manually maintained data.

The organization needs a centralized system where:

- Resources can record the work they perform.
- Task completion can be quantified.
- Task duration can be automatically calculated.
- Managers can monitor resource utilization.
- Project utilization can be calculated automatically.
- Daily and historical productivity can be analyzed.

## 3. Goals & Objectives

### 3.1 Goals

- Automate resource utilization tracking.
- Replace manual spreadsheet-based daily reporting.
- Provide real-time project utilization information.
- Provide managers with a centralized monitoring dashboard.
- Track productivity at resource, project and task levels.

### 3.2 Objectives

The system should:

- Record resource activity.
- Calculate task hours automatically.
- Allow configurable task durations.
- Calculate daily utilization percentages.
- Categorize resource utilization.
- Provide project-level utilization.
- Provide manager-level reporting.

## 4. Target Users

### 4.1 Resource / Employee

A resource is an employee who performs tasks.

They can:

- Login
- View assigned projects
- Select projects
- Select tasks
- Enter completed units
- Submit work
- View their own daily productivity

### 4.2 Manager

The manager has access to the management dashboard.

They can:

- View all resources
- View all projects
- View resource utilization
- View project utilization
- Modify resource-project assignments
- Modify task default hours
- View historical records
- Monitor productivity

## 5. User Roles & Permissions

| Function | Resource | Manager |
|---|---|---|
| Login | ✅ | ✅ |
| View assigned projects | ✅ | ✅ |
| Select task | ✅ | ✅ |
| Submit task activity | ✅ | ✅ |
| View own productivity | ✅ | ✅ |
| View all resources | ❌ | ✅ |
| View all projects | ❌ | ✅ |
| Modify task hours | ❌ | ✅ |
| Assign resource to project | ❌ | ✅ |
| Remove resource from project | ❌ | ✅ |
| View utilization dashboard | ❌ | ✅ |
| View historical data | Limited | ✅ |
| Modify project/task configuration | ❌ | ✅ |

## 6. Core Concept — Task Productivity

This is the most important part of your whole application.

Suppose:

- Task A = Cluster Analysis 2G
- Default time = 2 hours

A resource performs it 3 times.

The system calculates:

`Task Hours = Default Task Hours × Units Completed`

Therefore: `2 × 3 = 6 hours`

So the resource has logged 6 productive hours for that particular task.

## 7. Task Unit System

Every task should have:

- Task, e.g. `Cluster Analysis 2G`
- Default Time, e.g. `2 hours`
- Unit `1`

The resource can enter `Units Completed = 3`.

The system calculates `2 × 3 = 6 hours`.

## 8. Adjustable Task Time

The default task duration should not be hard-coded. The manager should be
able to modify it.

For example: `Task: Cluster Analysis 2G, Default Time: 2 hours` → manager
changes it to `Default Time: 2.5 hours`. Future calculations use
`2.5 × units completed`.

The system should also ideally preserve the historical value used for old
submissions.

**Important:** If a manager changes a task from 2h → 3h today, yesterday's
submission should not suddenly become 3h. Each work log stores the actual
applied duration at the time of submission (`applied_task_hours`).

## 9. Working Day Configuration

Normal working capacity: 8 hours per resource per working day. This should
ideally be configurable rather than permanently hardcoded.

## 10. Daily Resource Utilization

For each resource: `Daily Utilization % = Total Productive Hours / Daily Capacity × 100`

Example — Ali: Task A = 2h×2=4h, Task B = 2h×1=2h, Task C = 2h×1=2h. Total 8h.
`8 / 8 × 100 = 100%` → Ali is Fully Utilized.

## 11. Utilization Above 100%

Productive Hours = 9.5, Daily Capacity = 8 → `9.5 / 8 × 100 = 118.75%`.

## 12. Project-Level Utilization

`Project Utilization = Total productive hours logged for the project / Total available capacity of resources assigned to that project × 100`

If a project has 5 assigned resources × 8h capacity = 40h total capacity, and
they collectively log 36h, project utilization is `36/40×100 = 90%`.

## 13. Important: Resources Assigned to Multiple Projects

Suppose Ali is assigned to Project A and Project B, with an 8-hour working
capacity. He works Project A = 5h, Project B = 3h. Then Ali's total
utilization is `8/8 = 100%`, Project A contribution `5/8 = 62.5%`, Project B
contribution `3/8 = 37.5%`.

The system must not count Ali as having 16 available hours just because he
is assigned to two projects — his daily capacity remains 8 hours, distributed
among multiple assigned projects.

## 14. Utilization Categories

Based on the reference screenshots, the dashboard should categorize resources
into:

- **Highly Utilized** — Utilization > 100% (e.g. `9.5/8 = 118.75%`)
- **Fully Utilized** — Utilization 80–100% (e.g. `7.5/8 = 93.75%`)
- **Less Utilized** — Utilization < 80% (e.g. `5/8 = 62.5%`)
- **Weekend** — a resource explicitly records work as a weekend activity; treated separately from normal working-day utilization.
- **Not Filled** — no work activity was submitted for that resource for the selected date.

> ⚠️ **Note from the original SRS author:** "The exact threshold between
> Highly Utilized / Fully Utilized / Less Utilized needs to be confirmed with
> whoever currently produces the Excel report. I'm inferring >100 / 80–100 /
> <80 from your screenshots. The application should make these thresholds
> configurable by the manager, rather than hard-code them."
>
> **Resolution (see CLAUDE.md and docs/DATABASE.md for detail):** the live
> database already had a `utilization_settings` table with three
> absolute-hour thresholds (`less_utilized_max=6`, `fully_utilized_max=8`,
> `highly_utilized_max=10`) seeded from an earlier, more specifically-informed
> session — i.e. an already-confirmed answer to exactly this open question.
> The app was wired to actually *read* those columns (previously they existed
> but weren't used) rather than introducing a second, conflicting
> percentage-based scheme. Both the daily dashboard and the Reports page
> still compute and display the percentage figures described throughout this
> document — only the Highly/Fully/Less/Abnormal *classification* boundary is
> hour-based. This also adds a 5th bucket, "Abnormally Utilized" (anything
> above `highly_utilized_max`), matching what was already in the codebase and
> giving extreme overwork its own visible category. All four numbers are
| editable at `/manager/settings`.

## 15. Weekend Work

When a resource starts recording activity, they select Work Day Type:
Regular Working Day or Weekend. The manager dashboard separately reports
Regular Day vs Weekend counts, so weekend work doesn't appear as an employee
being "over 100% utilized" on a normal working day.

## 16. Daily Work Entry Flow

Login → Select Date → Select Work Day Type → Select Project → Select Task
Category → Select Task → Default Hours automatically appear → Enter Units
Completed → System calculates Total Hours → Submit.

## 17. Multiple Entries Per Day

A resource can submit multiple tasks in one day; the system sums total hours
across all submitted entries for that day.

## 18. Manager Dashboard

KPI cards for the selected date: Total Resources, Active Resources, Highly
Utilized, Fully Utilized, Less Utilized, Weekend, Not Filled, Average
Utilization.

## 19. Project Utilization Chart

A per-project utilization bar chart/list that updates according to the
selected date.

## 20. Resource Utilization Table

Per-resource breakdown: Resource, Project, Hours, Capacity, Utilization %,
Status.

## 21. Summary Table

A status → resource-count breakdown (Highly Utilized, Fully Utilized, Less
Utilized, Weekend, Not Filled, Total Resources), generated dynamically for
the selected date.

## 22. Date Filtering

Manager should be able to select a specific date, and ideally: Today,
Yesterday, This Week, This Month, Custom Date Range. Historical data should
remain available.

## 23. Manager Resource Assignment

An interface to view/add/remove a resource's assigned projects.

## 24. Manager Task Management

Manager can edit a task's Default Time (e.g. `2h → 2.5h`) under a given
Project → Task Category → Task hierarchy.

## 25. Excel Data Import

The existing Excel master data should be used as initial data rather than
manually entering 100+ resources and 200+ tasks. Two sheets:

- **Sheet 1 (Resources):** Project, Resource Name, Resource ID, Working Days, Shift, Workshop Joining Date, Huawei Joining Date
- **Sheet 2 (Tasks):** Task Category, Project, Task, Task Name, NE/Batch, Default Time

See `docs/EXCEL_IMPORT.md` for exactly how this was interpreted and built
(the "Task" vs "Task Name" ambiguity in particular).

## 26. Suggested Database Structure

Users, Resources, Projects, ResourceProjects, TaskCategories, Tasks,
WorkLogs, UtilizationRecords — see `docs/DATABASE.md` for the actual live
schema (which predates this implementation phase and differs slightly in
naming, e.g. `profiles` instead of `Users`).

## 27. Critical Data Rule

Do NOT calculate historical work logs from the current task default time.
Each WorkLog saves `appliedTaskHours` at submission time — implemented as
`work_logs.applied_task_hours`.

## 28. Audit / History

Manager changes should be logged: who changed what, old value, new value,
when. Implemented as `audit_logs` + `/manager/audit-log`.

## 29. Filters

Manager dashboard/reports should filter by: Date, Project, Resource, Task
Category, Work Type, Utilization Status, NE/Batch. Implemented on the
`/manager/reports` page.

## 30. Overall System Flow

```
                     ┌──────────────┐
                     │    Manager   │
                     └──────┬───────┘
                            │
                    Manage assignments
                    Manage tasks/hours
                    View analytics
                            │
                            ▼
┌──────────────┐     ┌──────────────┐
│   Resource   │────▶│    System    │
└──────────────┘     └──────┬───────┘
                            │
                     Select Project
                            ↓
                     Select Task
                            ↓
                     Enter Units
                            ↓
                  Default Hours × Units
                            ↓
                      Work Log Saved
                            ↓
                 ┌──────────┴─────────┐
                 ↓                    ↓
          Resource Utilization   Project Utilization
                 ↓                    ↓
                 └──────────┬─────────┘
                            ↓
                    Manager Dashboard
```
