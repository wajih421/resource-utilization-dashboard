// app/api/manager/dashboard-summary/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireManager } from "@/lib/supabase/require-manager";
import { getUtilizationSettings } from "@/lib/supabase/utilization-settings";
import { getUtilizationStatus, getUtilizationPercent, type UtilizationStatus } from "@/lib/utils/utilization";
import { isWorkingDay } from "@/lib/utils/working-days";

export async function GET(request: Request) {
  const supabase = await createClient();

  const auth = await requireManager(supabase);
  if ("error" in auth) return auth.error;

  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date") ?? new Date().toISOString().slice(0, 10);

  const { dailyCapacityHours, thresholds } = await getUtilizationSettings(supabase);

  const { data: resources, error: resourcesErr } = await supabase
    .from("resources")
    .select("id, name, employee_id, working_days")
    .eq("active", true);

  if (resourcesErr) {
    console.error("Failed to load resources:", resourcesErr);
    return NextResponse.json({ error: "Could not load resources" }, { status: 500 });
  }

  const { data: projects, error: projectsErr } = await supabase
    .from("projects")
    .select("id, name")
    .eq("active", true);

  if (projectsErr) {
    console.error("Failed to load projects:", projectsErr);
    return NextResponse.json({ error: "Could not load projects" }, { status: 500 });
  }

  const { data: resourceProjects, error: rpErr } = await supabase
    .from("resource_projects")
    .select("resource_id, project_id")
    .eq("active", true);

  if (rpErr) {
    console.error("Failed to load resource_projects:", rpErr);
    return NextResponse.json({ error: "Could not load resource assignments" }, { status: 500 });
  }

  const { data: workLogs, error: workLogsErr } = await supabase
    .from("work_logs")
    .select("resource_id, project_id, total_hours, work_day_type")
    .eq("work_date", date);

  if (workLogsErr) {
    console.error("Failed to load work_logs:", workLogsErr);
    return NextResponse.json({ error: "Could not load work logs" }, { status: 500 });
  }

  // ---- Per-resource totals (across all their projects, for the date) ----
  const hoursByResource = new Map<string, number>();
  const hasWeekendLog = new Set<string>();
  for (const log of workLogs ?? []) {
    const prev = hoursByResource.get(log.resource_id) ?? 0;
    hoursByResource.set(log.resource_id, prev + Number(log.total_hours ?? 0));
    if (log.work_day_type === "weekend") {
      hasWeekendLog.add(log.resource_id);
    }
  }

  const statusCounts: Record<UtilizationStatus | "Weekend", number> = {
    "Highly Utilized": 0,
    "Fully Utilized": 0,
    "Less Utilized": 0,
    "Abnormally Utilized": 0,
    "Not Filled": 0,
    Weekend: 0,
  };

  let activeResources = 0;
  let percentSum = 0;
  let percentCount = 0; // resources counted toward the average (weekend days excluded)

  // Per-resource breakdown, used by ResourceUtilizationTable on the frontend
  const resourceRows: {
    resourceId: string;
    name: string;
    employeeId: string;
    hours: number;
    utilizationPercent: number;
    status: UtilizationStatus | "Weekend";
  }[] = [];

  for (const r of resources ?? []) {
    const totalHours = hoursByResource.get(r.id) ?? 0;
    if (totalHours > 0) activeResources++;

    const utilizationPercent = getUtilizationPercent(totalHours, dailyCapacityHours);

    // A resource can either be on an explicit weekend schedule (working_days
    // doesn't cover this date) or have logged work with work_day_type =
    // "weekend" on what would otherwise be a working day. Either marks the
    // day as Weekend rather than a hours-based status.
    if (!isWorkingDay(r.working_days, date) || hasWeekendLog.has(r.id)) {
      statusCounts.Weekend++;
      resourceRows.push({
        resourceId: r.id,
        name: r.name,
        employeeId: r.employee_id ?? "",
        hours: totalHours,
        utilizationPercent,
        status: "Weekend",
      });
      continue; // weekend days don't count toward the average
    }

    const status = getUtilizationStatus(totalHours, thresholds);
    statusCounts[status]++;
    resourceRows.push({
      resourceId: r.id,
      name: r.name,
      employeeId: r.employee_id ?? "",
      hours: totalHours,
      utilizationPercent,
      status,
    });

    percentSum += utilizationPercent;
    percentCount++;
  }

  const averageUtilization = percentCount > 0 ? percentSum / percentCount : 0;

  // ---- Per-project totals ----
  const assignedCountByProject = new Map<string, number>();
  for (const rp of resourceProjects ?? []) {
    assignedCountByProject.set(
      rp.project_id,
      (assignedCountByProject.get(rp.project_id) ?? 0) + 1
    );
  }

  const hoursByProject = new Map<string, number>();
  for (const log of workLogs ?? []) {
    hoursByProject.set(
      log.project_id,
      (hoursByProject.get(log.project_id) ?? 0) + Number(log.total_hours ?? 0)
    );
  }

  const projectUtilization = (projects ?? []).map((p) => {
    const assignedResourcesCount = assignedCountByProject.get(p.id) ?? 0;
    const hours = hoursByProject.get(p.id) ?? 0;
    const capacity = assignedResourcesCount * dailyCapacityHours;
    const utilizationPercent = capacity > 0 ? (hours / capacity) * 100 : 0;

    return {
      projectId: p.id,
      projectName: p.name,
      assignedResources: assignedResourcesCount,
      hours,
      capacity,
      utilizationPercent,
    };
  });

  return NextResponse.json({
    date,
    totalResources: resources?.length ?? 0,
    activeResources,
    statusCounts,
    averageUtilization,
    projectUtilization,
    resources: resourceRows,
  });
}
