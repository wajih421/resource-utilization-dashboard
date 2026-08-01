// app/resource/submit-work/page.tsx
"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

type Project = { id: string; name: string };
type Task = {
  id: string;
  name: string;
  ne_batch: string | null;
  default_hours: number;
  task_categories: { id: string; name: string } | null;
};

async function fetchProjects(): Promise<Project[]> {
  const res = await fetch("/api/resource/projects");
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to load projects");
  return data.projects;
}

async function fetchTasks(projectId: string): Promise<Task[]> {
  const res = await fetch(`/api/resource/tasks?projectId=${projectId}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to load tasks");
  return data.tasks;
}

export default function SubmitWorkPage() {
  const queryClient = useQueryClient();

  const [projectId, setProjectId] = useState("");
  const [taskId, setTaskId] = useState("");
  const [workDate, setWorkDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [workDayType, setWorkDayType] = useState<"regular" | "weekend">("regular");
  const [unitsCompleted, setUnitsCompleted] = useState("1");
  const [successMsg, setSuccessMsg] = useState("");

  const { data: projects = [], isLoading: loadingProjects, error: projectsError } = useQuery({
    queryKey: ["resource-projects"],
    queryFn: fetchProjects,
  });

  const { data: tasks = [], isLoading: loadingTasks, error: tasksError } = useQuery({
    queryKey: ["resource-tasks", projectId],
    queryFn: () => fetchTasks(projectId),
    enabled: !!projectId,
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
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
      if (!res.ok) throw new Error(data.error || "Submit nahi ho paya");
      return data;
    },
    onSuccess: (data) => {
      setSuccessMsg(`Submit ho gaya! Total Hours: ${data.totalHours}`);
      setTaskId("");
      setUnitsCompleted("1");
      queryClient.invalidateQueries({ queryKey: ["resource-today-summary"] });
    },
  });

  function handleProjectChange(value: string) {
    setProjectId(value);
    setTaskId("");
  }

  const selectedTask = tasks.find((t) => t.id === taskId);
  const calculatedHours =
    selectedTask && unitsCompleted
      ? (Number(selectedTask.default_hours) * Number(unitsCompleted)).toFixed(2)
      : "0";

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSuccessMsg("");

    if (!projectId || !taskId) {
      return;
    }
    submitMutation.mutate();
  }

  const error = projectsError || tasksError || submitMutation.error;

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
              onChange={(e) => handleProjectChange(e.target.value)}
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

          {error && (
            <p className="text-red-600 text-sm">
              {error instanceof Error ? error.message : "Something went wrong"}
            </p>
          )}
          {successMsg && <p className="text-green-600 text-sm">{successMsg}</p>}

          <button
            type="submit"
            disabled={submitMutation.isPending}
            className="w-full bg-blue-600 text-white rounded py-2 font-medium disabled:opacity-50"
          >
            {submitMutation.isPending ? "Submitting..." : "Submit Work"}
          </button>
        </form>
      )}
    </div>
  );
}
