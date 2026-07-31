// components/forms/WorkLogForm.tsx
"use client";

import { useEffect, useState } from "react";
import { workLogSchema } from "@/lib/validations/worklog-schema";

type Project = { id: string; name: string };
type Task = { id: string; name: string; default_hours: number; category_name: string };

// Self-contained: fetches its own projects/tasks and posts the submission.
// Reused wherever a resource needs to log work (currently the resource
// dashboard's submit-work page). Calls onSubmitted() after a successful
// save so the parent page can refresh its own data (e.g. today's summary).
export default function WorkLogForm({ onSubmitted }: { onSubmitted?: () => void }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projectId, setProjectId] = useState("");
  const [taskId, setTaskId] = useState("");
  const [workDate, setWorkDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [unitsCompleted, setUnitsCompleted] = useState("1");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    fetch("/api/resource/projects")
      .then((res) => res.json())
      .then((data) => setProjects(data.projects ?? []))
      .catch(() => setError("Could not load your projects"));
  }, []);

  useEffect(() => {
    setTaskId("");
    setTasks([]);
    if (!projectId) return;

    fetch(`/api/resource/tasks?project_id=${projectId}`)
      .then((res) => res.json())
      .then((data) => setTasks(data.tasks ?? []))
      .catch(() => setError("Could not load tasks for this project"));
  }, [projectId]);

  const selectedTask = tasks.find((t) => t.id === taskId);
  const units = Number(unitsCompleted) || 0;
  const totalHours = selectedTask ? selectedTask.default_hours * units : 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");

    const parsed = workLogSchema.safeParse({
      project_id: projectId,
      task_id: taskId,
      work_date: workDate,
      units_completed: units,
    });

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/work-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Submission failed");
        return;
      }
      setSuccess("Work log submitted");
      setUnitsCompleted("1");
      onSubmitted?.();
    } catch {
      setError("Could not connect to server");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-4 space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Project</label>
        <select
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          className="w-full border rounded px-3 py-2 text-sm"
          required
        >
          <option value="">Select a project</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Task</label>
        <select
          value={taskId}
          onChange={(e) => setTaskId(e.target.value)}
          className="w-full border rounded px-3 py-2 text-sm"
          disabled={!projectId}
          required
        >
          <option value="">Select a task</option>
          {tasks.map((t) => (
            <option key={t.id} value={t.id}>
              {t.category_name} — {t.name} ({t.default_hours}h)
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
          <input
            type="date"
            value={workDate}
            max={new Date().toISOString().slice(0, 10)}
            onChange={(e) => setWorkDate(e.target.value)}
            className="w-full border rounded px-3 py-2 text-sm"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Units Completed</label>
          <input
            type="number"
            min="0.5"
            step="0.5"
            value={unitsCompleted}
            onChange={(e) => setUnitsCompleted(e.target.value)}
            className="w-full border rounded px-3 py-2 text-sm"
            required
          />
        </div>
      </div>

      {selectedTask && (
        <p className="text-sm text-gray-600 bg-gray-50 rounded px-3 py-2">
          {selectedTask.default_hours}h × {units || 0} = <strong>{totalHours.toFixed(1)}h total</strong>
        </p>
      )}

      {error && <p className="text-red-600 text-sm">{error}</p>}
      {success && <p className="text-green-600 text-sm">{success}</p>}

      <button
        type="submit"
        disabled={submitting || !projectId || !taskId}
        className="bg-blue-600 text-white rounded px-4 py-2 text-sm font-medium disabled:opacity-40"
      >
        {submitting ? "Submitting..." : "Submit Work Log"}
      </button>
    </form>
  );
}