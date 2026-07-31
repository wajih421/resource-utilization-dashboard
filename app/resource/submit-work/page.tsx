// app/resource/submit-work/page.tsx
"use client";

import { useEffect, useState } from "react";

type Project = { id: string; name: string };
type Task = {
  id: string;
  name: string;
  ne_batch: string | null;
  default_hours: number;
  task_categories: { id: string; name: string } | null;
};

export default function SubmitWorkPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);

  const [projectId, setProjectId] = useState("");
  const [taskId, setTaskId] = useState("");
  const [workDate, setWorkDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [workDayType, setWorkDayType] = useState<"regular" | "weekend">("regular");
  const [unitsCompleted, setUnitsCompleted] = useState("1");

  const [loadingProjects, setLoadingProjects] = useState(true);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // load assigned projects on mount
  useEffect(() => {
    async function loadProjects() {
      try {
        const res = await fetch("/api/resource/projects");
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Failed to load projects");
          return;
        }
        setProjects(data.projects);
      } catch {
        setError("Could not connect to server");
      } finally {
        setLoadingProjects(false);
      }
    }
    loadProjects();
  }, []);

  // load tasks whenever project changes
  useEffect(() => {
    if (!projectId) {
      setTasks([]);
      setTaskId("");
      return;
    }

    async function loadTasks() {
      setLoadingTasks(true);
      setTaskId("");
      try {
        const res = await fetch(`/api/resource/tasks?projectId=${projectId}`);
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Failed to load tasks");
          return;
        }
        setTasks(data.tasks);
      } catch {
        setError("Could not connect to server");
      } finally {
        setLoadingTasks(false);
      }
    }
    loadTasks();
  }, [projectId]);

  const selectedTask = tasks.find((t) => t.id === taskId);
  const calculatedHours =
    selectedTask && unitsCompleted
      ? (Number(selectedTask.default_hours) * Number(unitsCompleted)).toFixed(2)
      : "0";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccessMsg("");

    if (!projectId || !taskId) {
      setError("Project aur Task select karo");
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch("/api/work-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          taskId,
          workDate,
          workDayType,
          unitsCompleted: Number(unitsCompleted),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Submit nahi ho paya");
        setSubmitting(false);
        return;
      }

      setSuccessMsg(`Submit ho gaya! Total Hours: ${data.totalHours}`);
      setTaskId("");
      setUnitsCompleted("1");
    } catch {
      setError("Server se connect nahi ho paya");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-semibold mb-4">Submit Work</h1>

      {loadingProjects ? (
        <p className="text-gray-500">Loading projects...</p>
      ) : projects.length === 0 ? (
        <p className="text-red-600">
          Tumhe koi project assign nahi hai abhi tak. Manager se contact karo.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Date</label>
            <input
              type="date"
              value={workDate}
              onChange={(e) => setWorkDate(e.target.value)}
              className="w-full border rounded px-3 py-2"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Work Day Type</label>
            <select
              value={workDayType}
              onChange={(e) => setWorkDayType(e.target.value as "regular" | "weekend")}
              className="w-full border rounded px-3 py-2"
            >
              <option value="regular">Regular Working Day</option>
              <option value="weekend">Weekend</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Project</label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="w-full border rounded px-3 py-2"
              required
            >
              <option value="">-- Select Project --</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Task</label>
            <select
              value={taskId}
              onChange={(e) => setTaskId(e.target.value)}
              className="w-full border rounded px-3 py-2"
              disabled={!projectId || loadingTasks}
              required
            >
              <option value="">
                {loadingTasks ? "Loading tasks..." : "-- Select Task --"}
              </option>
              {tasks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.task_categories?.name ? `${t.task_categories.name} - ` : ""}
                  {t.name} ({t.default_hours}h)
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Units Completed</label>
            <input
              type="number"
              min="0"
              step="0.5"
              value={unitsCompleted}
              onChange={(e) => setUnitsCompleted(e.target.value)}
              className="w-full border rounded px-3 py-2"
              required
            />
          </div>

          {selectedTask && (
            <div className="bg-blue-50 border border-blue-200 rounded px-3 py-2 text-sm">
              Default Hours: <strong>{selectedTask.default_hours}h</strong> × Units:{" "}
              <strong>{unitsCompleted || 0}</strong> = Total:{" "}
              <strong>{calculatedHours}h</strong>
            </div>
          )}

          {error && <p className="text-red-600 text-sm">{error}</p>}
          {successMsg && <p className="text-green-600 text-sm">{successMsg}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-blue-600 text-white rounded py-2 font-medium disabled:opacity-50"
          >
            {submitting ? "Submitting..." : "Submit Work"}
          </button>
        </form>
      )}
    </div>
  );
}