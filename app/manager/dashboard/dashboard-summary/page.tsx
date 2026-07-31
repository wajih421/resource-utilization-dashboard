// app/api/manager/dashboard-summary/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUtilizationStatus } from "@/lib/utils/utilization";

const DAILY_CAPACITY = 8;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date") || new Date().toISOString().slice(0, 10);

    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "manager") {
      return NextResponse.json({ error: "Manager access only" }, { status: 403 });
    }

    // all active resources
    const { data: resources, error: resErr } = await supabase
      .from("resources")
      .select("id, name")
      .eq("active", true);

    if (resErr) {
      console.error("Failed to fetch resources:", resErr.message);
      return NextResponse.json({ error: "Failed to fetch resources" }, { status: 500 });
    }

    // active resource-project assignments (for project capacity)
    const { data: assignments, error: assignErr } = await supabase
      .from("resource_projects")
      .select("resource_id, project_id")
      .eq("active", true);

    if (assignErr) {
      console.error("Failed to fetch assignments:", assignErr.message);
      return NextResponse.json({ error: "Failed to fetch assignments" }, { status: 500 });
    }

    // all projects
    const { data: projects, error: projErr } = await supabase
      .from("projects")
      .select("id, name")
      .eq("active", true);

    if (projErr) {
      console.error("Failed to fetch projects:", projErr.message);
      return NextResponse.json({ error: "Failed to fetch projects" }, { status: 500 });
    }

    // work logs for the selected date
    const { data: logs, error: logsErr } = await supabase
      .from("work_logs")
      .select("resource_id, project_id, total_hours, work_day_type")
      .eq("work_date", date);

    if (logsErr) {
      console.error("Failed to fetch work logs:", logsErr.message);
      return NextResponse.json({ error: "Failed to fetch work logs" }, { status: 500 });
    }

    // --- per-resource aggregation ---
    const hoursByResource = new Map<string, number>();
    const hasWeekendLog = new Set<string>();

    for (const log of logs ?? []) {
      hoursByResource.set(
        log.resource_id,
        (hoursByResource.get(log.resource_id) ?? 0) + Number(log.total_hours)
      );
      if (log.work_day_type === "weekend") {
        hasWeekendLog.add(log.resource_id);
      }
    }

    const statusCounts = {
      "Highly Utilized": 0,
      "Fully Utilized": 0,
      "Less Utilized": 0,
      "Abnormally Utilized": 0,
      Weekend: 0,
      "Not Filled": 0,
    };

    let utilizationSum = 0;
    let activeCount = 0;

    for (const resource of resources ?? []) {
      const hours = hoursByResource.get(resource.id) ?? 0;

      if (hasWeekendLog.has(resource.id)) {
        statusCounts.Weekend++;
      } else if (hours <= 0) {
        statusCounts["Not Filled"]++;
      } else {
        const status = getUtilizationStatus(hours);
        statusCounts[status as keyof typeof statusCounts]++;
      }

      if (hours > 0) {
        utilizationSum += (hours / DAILY_CAPACITY) * 100;
        activeCount++;
      }
    }

    const averageUtilization = activeCount > 0 ? utilizationSum / activeCount : 0;

    // --- per-project aggregation ---
    const hoursByProject = new Map<string, number>();
    for (const log of logs ?? []) {
      hoursByProject.set(
        log.project_id,
        (hoursByProject.get(log.project_id) ?? 0) + Number(log.total_hours)
      );
    }

    const resourceCountByProject = new Map<string, number>();
    for (const a of assignments ?? []) {
      resourceCountByProject.set(
        a.project_id,
        (resourceCountByProject.get(a.project_id) ?? 0) + 1
      );
    }

    const projectUtilization = (projects ?? [])
      .map((p) => {
        const assignedCount = resourceCountByProject.get(p.id) ?? 0;
        const capacity = assignedCount * DAILY_CAPACITY;
        const hours = hoursByProject.get(p.id) ?? 0;
        const utilizationPercent = capacity > 0 ? (hours / capacity) * 100 : 0;
        return {
          projectId: p.id,
          projectName: p.name,
          assignedResources: assignedCount,
          hours,
          capacity,
          utilizationPercent,
        };
      })
      .filter((p) => p.assignedResources > 0)
      .sort((a, b) => b.utilizationPercent - a.utilizationPercent);

    return NextResponse.json({
      date,
      totalResources: (resources ?? []).length,
      activeResources: activeCount,
      statusCounts,
      averageUtilization,
      projectUtilization,
    });
  } catch (err) {
    console.error("manager/dashboard-summary route error:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}