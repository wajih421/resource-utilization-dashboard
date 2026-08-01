// scripts/import-master-data.mjs
//
// Imports the workshop's Excel master data (SRS section 25) into Supabase:
//   Sheet 1 (Resources): Project, Resource Name, Resource ID, Working Days,
//                        Shift, Workshop Joining Date, Huawei Joining Date
//   Sheet 2 (Tasks):     Task Category, Project, Task/Task Name, NE/Batch,
//                        Default Time
//
// By default the first two sheets in the workbook are treated as Resources
// then Tasks, in that order — pass --resources-sheet / --tasks-sheet to
// name them explicitly if your workbook orders them differently.
//
// Usage:
//   node scripts/import-master-data.mjs <path-to-file.xlsx> --dry-run
//   node scripts/import-master-data.mjs <path-to-file.xlsx>
//
// --dry-run parses and validates everything and prints exactly what would
// happen, without writing anything to the database. Always run with
// --dry-run first. This script is idempotent — re-running it (e.g. after
// fixing a few rows) updates existing records rather than duplicating them.
//
// After a real (non-dry-run) import creates new resources, run
// `node scripts/seed-auth-users.mjs` to create their login accounts.

import ExcelJS from "exceljs";
import { createClient } from "@supabase/supabase-js";
import "./lib/load-env.mjs";
import {
  parseResourceSheet,
  parseTaskSheet,
} from "../lib/import/parse-master-data.ts";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const filePath = args.find((a) => !a.startsWith("--"));

function getFlagValue(name) {
  const prefix = `--${name}=`;
  const found = args.find((a) => a.startsWith(prefix));
  return found ? found.slice(prefix.length) : undefined;
}

const resourcesSheetName = getFlagValue("resources-sheet");
const tasksSheetName = getFlagValue("tasks-sheet");

if (!filePath) {
  console.error("Usage: node scripts/import-master-data.mjs <path-to-file.xlsx> [--dry-run] [--resources-sheet=Name] [--tasks-sheet=Name]");
  process.exit(1);
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!dryRun && (!SUPABASE_URL || !SERVICE_ROLE_KEY)) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env.");
  process.exit(1);
}

const supabase = dryRun
  ? null
  : createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

function sheetToRows(worksheet) {
  const headerRow = worksheet.getRow(1).values; // 1-indexed, index 0 is empty
  const headers = headerRow.slice(1).map((h) => String(h ?? "").trim());

  const rows = [];
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // header
    const values = row.values.slice(1);
    const obj = {};
    headers.forEach((header, i) => {
      if (!header) return;
      const cell = values[i];
      // ExcelJS represents dates as JS Date objects already when the cell
      // is formatted as a date; formulas/rich text are unwrapped to their
      // plain value so downstream parsing only ever sees primitives/Dates.
      obj[header] = cell && typeof cell === "object" && "result" in cell ? cell.result : cell;
    });
    rows.push(obj);
  });
  return rows;
}

async function main() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  const resourcesSheet = resourcesSheetName
    ? workbook.getWorksheet(resourcesSheetName)
    : workbook.worksheets[0];
  const tasksSheet = tasksSheetName
    ? workbook.getWorksheet(tasksSheetName)
    : workbook.worksheets[1];

  if (!resourcesSheet) throw new Error(`Resources sheet not found (looked for: ${resourcesSheetName ?? "first sheet"})`);
  if (!tasksSheet) throw new Error(`Tasks sheet not found (looked for: ${tasksSheetName ?? "second sheet"})`);

  console.log(`Resources sheet: "${resourcesSheet.name}" | Tasks sheet: "${tasksSheet.name}"`);

  const parsedResources = parseResourceSheet(sheetToRows(resourcesSheet));
  const parsedTasks = parseTaskSheet(sheetToRows(tasksSheet));

  const validResources = parsedResources.filter((r) => r.errors.length === 0);
  const invalidResources = parsedResources.filter((r) => r.errors.length > 0);
  const validTasks = parsedTasks.filter((t) => t.errors.length === 0);
  const invalidTasks = parsedTasks.filter((t) => t.errors.length > 0);

  console.log(`\nResources: ${parsedResources.length} rows -> ${validResources.length} valid, ${invalidResources.length} with errors`);
  for (const r of invalidResources) {
    console.log(`  Row ${r.rowNumber}: ${r.errors.join("; ")}`);
  }
  console.log(`\nTasks: ${parsedTasks.length} rows -> ${validTasks.length} valid, ${invalidTasks.length} with errors`);
  for (const t of invalidTasks) {
    console.log(`  Row ${t.rowNumber}: ${t.errors.join("; ")}`);
  }

  const projectNames = new Set([
    ...validResources.map((r) => r.projectName),
    ...validTasks.map((t) => t.projectName),
  ]);
  const categoryNames = new Set(validTasks.map((t) => t.taskCategoryName));

  if (dryRun) {
    console.log(`\n--- DRY RUN: no changes written ---`);
    console.log(`Would ensure ${projectNames.size} project(s): ${[...projectNames].join(", ")}`);
    console.log(`Would ensure ${categoryNames.size} task categor${categoryNames.size === 1 ? "y" : "ies"}: ${[...categoryNames].join(", ")}`);
    console.log(`Would upsert ${validResources.length} resource(s) by Resource ID`);
    console.log(`Would upsert ${validTasks.length} task(s) by (project, task category, name)`);
    return;
  }

  const stats = {
    projectsCreated: 0,
    categoriesCreated: 0,
    resourcesCreated: 0,
    resourcesUpdated: 0,
    assignmentsCreated: 0,
    tasksCreated: 0,
    tasksUpdated: 0,
    failures: [],
  };

  // ---- Projects ----------------------------------------------------------
  const projectIdByName = new Map();
  {
    const { data: existing, error } = await supabase.from("projects").select("id, name");
    if (error) throw new Error(`Failed to load projects: ${error.message}`);
    for (const p of existing) projectIdByName.set(p.name.trim().toLowerCase(), p.id);
  }
  for (const name of projectNames) {
    const key = name.trim().toLowerCase();
    if (projectIdByName.has(key)) continue;
    const { data, error } = await supabase.from("projects").insert({ name, active: true }).select("id").single();
    if (error) {
      stats.failures.push(`Failed to create project "${name}": ${error.message}`);
      continue;
    }
    projectIdByName.set(key, data.id);
    stats.projectsCreated++;
  }

  // ---- Task categories -----------------------------------------------------
  const categoryIdByName = new Map();
  {
    const { data: existing, error } = await supabase.from("task_categories").select("id, name");
    if (error) throw new Error(`Failed to load task categories: ${error.message}`);
    for (const c of existing) categoryIdByName.set(c.name.trim().toLowerCase(), c.id);
  }
  for (const name of categoryNames) {
    const key = name.trim().toLowerCase();
    if (categoryIdByName.has(key)) continue;
    const { data, error } = await supabase.from("task_categories").insert({ name }).select("id").single();
    if (error) {
      stats.failures.push(`Failed to create task category "${name}": ${error.message}`);
      continue;
    }
    categoryIdByName.set(key, data.id);
    stats.categoriesCreated++;
  }

  // ---- Resources + resource_projects -------------------------------------
  const resourceIdByEmployeeId = new Map();
  {
    const { data: existing, error } = await supabase.from("resources").select("id, employee_id");
    if (error) throw new Error(`Failed to load resources: ${error.message}`);
    for (const r of existing) {
      if (r.employee_id) resourceIdByEmployeeId.set(r.employee_id.trim().toLowerCase(), r.id);
    }
  }

  for (const r of validResources) {
    const key = r.employeeId.trim().toLowerCase();
    const payload = {
      name: r.resourceName,
      employee_id: r.employeeId,
      working_days: r.workingDays,
      shift_start: r.shiftStart,
      shift_end: r.shiftEnd,
      workshop_joining_date: r.workshopJoiningDate,
      huawei_joining_date: r.huaweiJoiningDate,
      active: true,
    };

    let resourceId = resourceIdByEmployeeId.get(key);
    if (resourceId) {
      const { error } = await supabase.from("resources").update(payload).eq("id", resourceId);
      if (error) {
        stats.failures.push(`Failed to update resource "${r.employeeId}": ${error.message}`);
        continue;
      }
      stats.resourcesUpdated++;
    } else {
      const { data, error } = await supabase.from("resources").insert(payload).select("id").single();
      if (error) {
        stats.failures.push(`Failed to create resource "${r.employeeId}": ${error.message}`);
        continue;
      }
      resourceId = data.id;
      resourceIdByEmployeeId.set(key, resourceId);
      stats.resourcesCreated++;
    }

    const projectId = projectIdByName.get(r.projectName.trim().toLowerCase());
    if (!projectId) {
      stats.failures.push(`Resource "${r.employeeId}": project "${r.projectName}" was not created — skipping assignment`);
      continue;
    }

    const { data: existingAssignment, error: assignErr } = await supabase
      .from("resource_projects")
      .select("id, active")
      .eq("resource_id", resourceId)
      .eq("project_id", projectId)
      .maybeSingle();
    if (assignErr) {
      stats.failures.push(`Failed to check assignment for "${r.employeeId}": ${assignErr.message}`);
      continue;
    }
    if (!existingAssignment) {
      const { error } = await supabase
        .from("resource_projects")
        .insert({ resource_id: resourceId, project_id: projectId, active: true });
      if (error) {
        stats.failures.push(`Failed to assign "${r.employeeId}" to "${r.projectName}": ${error.message}`);
        continue;
      }
      stats.assignmentsCreated++;
    } else if (!existingAssignment.active) {
      await supabase.from("resource_projects").update({ active: true }).eq("id", existingAssignment.id);
      stats.assignmentsCreated++;
    }
  }

  // ---- Tasks --------------------------------------------------------------
  const { data: existingTasks, error: existingTasksErr } = await supabase
    .from("tasks")
    .select("id, project_id, task_category_id, name, default_hours, ne_batch");
  if (existingTasksErr) throw new Error(`Failed to load tasks: ${existingTasksErr.message}`);

  const taskByKey = new Map();
  for (const t of existingTasks) {
    taskByKey.set(`${t.project_id}|${t.task_category_id}|${t.name.trim().toLowerCase()}`, t);
  }

  for (const t of validTasks) {
    const projectId = projectIdByName.get(t.projectName.trim().toLowerCase());
    const categoryId = categoryIdByName.get(t.taskCategoryName.trim().toLowerCase());
    if (!projectId || !categoryId) {
      stats.failures.push(`Task "${t.taskName}": project or category was not resolved — skipping`);
      continue;
    }

    const key = `${projectId}|${categoryId}|${t.taskName.trim().toLowerCase()}`;
    const existing = taskByKey.get(key);

    if (existing) {
      if (existing.default_hours !== t.defaultHours || existing.ne_batch !== t.neBatch) {
        const { error } = await supabase
          .from("tasks")
          .update({ default_hours: t.defaultHours, ne_batch: t.neBatch, updated_at: new Date().toISOString() })
          .eq("id", existing.id);
        if (error) {
          stats.failures.push(`Failed to update task "${t.taskName}": ${error.message}`);
          continue;
        }
        stats.tasksUpdated++;
      }
    } else {
      const { error } = await supabase.from("tasks").insert({
        project_id: projectId,
        task_category_id: categoryId,
        name: t.taskName,
        ne_batch: t.neBatch,
        default_hours: t.defaultHours,
        active: true,
      });
      if (error) {
        stats.failures.push(`Failed to create task "${t.taskName}": ${error.message}`);
        continue;
      }
      stats.tasksCreated++;
    }
  }

  console.log(`\n--- Import complete ---`);
  console.log(`Projects created:      ${stats.projectsCreated}`);
  console.log(`Task categories created: ${stats.categoriesCreated}`);
  console.log(`Resources created:      ${stats.resourcesCreated}`);
  console.log(`Resources updated:      ${stats.resourcesUpdated}`);
  console.log(`Project assignments created/reactivated: ${stats.assignmentsCreated}`);
  console.log(`Tasks created:          ${stats.tasksCreated}`);
  console.log(`Tasks updated:          ${stats.tasksUpdated}`);
  if (stats.failures.length) {
    console.log(`\nFailures (${stats.failures.length}):`);
    for (const f of stats.failures) console.log(`  ${f}`);
  }
  if (stats.resourcesCreated > 0) {
    console.log(`\n${stats.resourcesCreated} new resource(s) were created without login accounts.`);
    console.log(`Run: node scripts/seed-auth-users.mjs`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
