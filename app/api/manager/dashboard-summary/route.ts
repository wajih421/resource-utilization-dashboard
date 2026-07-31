// app/api/manager/dashboard-summary/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUtilizationStatus, type UtilizationStatus } from "@/lib/utils/utilization";

// ---- Working-days helper -------------------------------------------------
// resources.working_days is a free-text field like "Mon to Fri" or
// "Mon to Sat". We parse it to decide if the selected date falls on that
// resource's day off, so we can report "Weekend" instead of a hours-based
// status (which would otherwise show as "Not Filled" and look like a
// missed day rather than an expected day off).

const DAY_ORDER = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function isWorkingDay(workingDays: string | null, dateStr: string): boolean {
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

export async function GET(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profileErr || profile?.role !== "manager") {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date") ?? new Date().toISOString().slice(0, 10);

  const { data: settings, error: settingsErr } = await supabase
    .from("utilization_settings")
    .select("daily_capacity_hours")
    .single();

  if (settingsErr || !settings) {
    console.error("Failed to load utilization_settings:", settingsErr);
    return NextResponse.json({ error: "Could not load utilization settings" }, { status: 500 });
  }
  const dailyCapacityHours = Number(settings.daily_capacity_hours);

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
    .select("resource_id, project_id, total_hours")
    .eq("work_date", date);

  if (workLogsErr) {
    console.error("Failed to load work_logs:", workLogsErr);
    return NextResponse.json({ error: "Could not load work logs" }, { status: 500 });
  }

  // ---- Per-resource totals (across all their projects, for the date) ----
  const hoursByResource = new Map<string, number>();
  for (const log of workLogs ?? []) {
    const prev = hoursByResource.get(log.resource_id) ?? 0;
    hoursByResource.set(log.resource_id, prev + Number(log.total_hours ?? 0));
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

    const utilizationPercent = (totalHours / dailyCapacityHours) * 100;

    if (!isWorkingDay(r.working_days, date)) {
      statusCounts.Weekend++;
      resourceRows.push({
        resourceId: r.id,
        name: r.name,
        employeeId: r.employee_id,
        hours: totalHours,
        utilizationPercent,
        status: "Weekend",
      });
      continue; // weekend days don't count toward the average
    }

    const status = getUtilizationStatus(totalHours);
    statusCounts[status]++;
    resourceRows.push({
      resourceId: r.id,
      name: r.name,
      employeeId: r.employee_id,
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