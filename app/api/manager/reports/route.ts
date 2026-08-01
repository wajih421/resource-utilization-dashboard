// app/api/manager/reports/route.ts
// Historical analytics for the manager Reports page (SRS 19, 22, 29).
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireManager } from "@/lib/supabase/require-manager";
import { getUtilizationSettings } from "@/lib/supabase/utilization-settings";
import { resolveDateRange, type DateRangePreset } from "@/lib/utils/date-range";
import { buildReport, type ReportWorkLogEntry, type ReportStatus } from "@/lib/reports/build-report";

const VALID_PRESETS: DateRangePreset[] = ["today", "yesterday", "this_week", "this_month", "custom"];
const VALID_STATUSES: ReportStatus[] = [
  "Highly Utilized",
  "Fully Utilized",
  "Less Utilized",
  "Abnormally Utilized",
  "Not Filled",
  "Weekend",
];

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const auth = await requireManager(supabase);
    if ("error" in auth) return auth.error;

    const { searchParams } = new URL(request.url);
    const presetParam = (searchParams.get("preset") ?? "today") as DateRangePreset;
    const preset = VALID_PRESETS.includes(presetParam) ? presetParam : "today";
    const customFrom = searchParams.get("from") ?? undefined;
    const customTo = searchParams.get("to") ?? undefined;

    let range: { from: string; to: string };
    try {
      range = resolveDateRange(preset, { from: customFrom, to: customTo });
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : "Invalid date range" }, { status: 400 });
    }

    const projectId = searchParams.get("projectId") || undefined;
    const resourceId = searchParams.get("resourceId") || undefined;
    const taskCategoryId = searchParams.get("taskCategoryId") || undefined;
    const workDayType = searchParams.get("workDayType") || undefined;
    const neBatch = searchParams.get("neBatch") || undefined;
    const statusParam = searchParams.get("status") || undefined;
    const status = statusParam && VALID_STATUSES.includes(statusParam as ReportStatus) ? (statusParam as ReportStatus) : undefined;

    const { dailyCapacityHours, thresholds } = await getUtilizationSettings(supabase);

    const [{ data: resources, error: resErr }, { data: projects, error: projErr }, { data: assignments, error: assignErr }] =
      await Promise.all([
        supabase.from("resources").select("id, name, employee_id, working_days").eq("active", true),
        supabase.from("projects").select("id, name").eq("active", true),
        supabase.from("resource_projects").select("resource_id, project_id").eq("active", true),
      ]);

    if (resErr || projErr || assignErr) {
      console.error("Failed to load report base data:", resErr?.message, projErr?.message, assignErr?.message);
      return NextResponse.json({ error: "Failed to load report data" }, { status: 500 });
    }

    let query = supabase
      .from("work_logs")
      .select(
        "id, resource_id, project_id, task_id, work_date, work_day_type, units_completed, applied_task_hours, total_hours, resources(name, employee_id), projects(name), tasks(name, ne_batch, task_category_id, task_categories(id, name))"
      )
      .gte("work_date", range.from)
      .lte("work_date", range.to);

    if (projectId) query = query.eq("project_id", projectId);
    if (resourceId) query = query.eq("resource_id", resourceId);
    if (workDayType === "regular" || workDayType === "weekend") {
      query = query.eq("work_day_type", workDayType);
    }

    const { data: rawLogs, error: logsErr } = await query;

    if (logsErr) {
      console.error("Failed to load work logs for report:", logsErr.message);
      return NextResponse.json({ error: "Failed to load work logs" }, { status: 500 });
    }

    type RawLog = NonNullable<typeof rawLogs>[number];
    let entries: ReportWorkLogEntry[] = (rawLogs ?? []).map((log: RawLog) => {
      const resource = log.resources as { name: string; employee_id: string | null } | null;
      const project = log.projects as { name: string } | null;
      const task = log.tasks as
        | { name: string; ne_batch: string | null; task_category_id: string | null; task_categories: { id: string; name: string } | null }
        | null;
      return {
        id: log.id,
        resourceId: log.resource_id,
        resourceName: resource?.name ?? "Unknown",
        employeeId: resource?.employee_id ?? null,
        projectId: log.project_id,
        projectName: project?.name ?? "Unknown",
        taskId: log.task_id,
        taskName: task?.name ?? "Unknown",
        taskCategoryId: task?.task_category_id ?? null,
        taskCategoryName: task?.task_categories?.name ?? null,
        neBatch: task?.ne_batch ?? null,
        workDate: log.work_date,
        workDayType: log.work_day_type as "regular" | "weekend",
        unitsCompleted: Number(log.units_completed),
        appliedTaskHours: Number(log.applied_task_hours),
        totalHours: Number(log.total_hours),
      };
    });

    // taskCategoryId / neBatch require the joined `tasks` row, so they're
    // applied here rather than as a DB-level filter.
    if (taskCategoryId) entries = entries.filter((e) => e.taskCategoryId === taskCategoryId);
    if (neBatch) entries = entries.filter((e) => e.neBatch === neBatch);

    const report = buildReport({
      from: range.from,
      to: range.to,
      today: new Date().toISOString().slice(0, 10),
      resources: (resources ?? []).map((r) => ({
        id: r.id,
        name: r.name,
        employeeId: r.employee_id,
        workingDays: r.working_days,
      })),
      projects: projects ?? [],
      assignments: (assignments ?? []).map((a) => ({ resourceId: a.resource_id, projectId: a.project_id })),
      entries,
      dailyCapacityHours,
      thresholds,
      filters: { status },
    });

    return NextResponse.json(report);
  } catch (err) {
    console.error("manager/reports route error:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
