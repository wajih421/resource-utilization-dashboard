// app/manager/tasks/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";

type Task = {
  id: string;
  name: string;
  ne_batch: string | null;
  default_hours: number;
  active: boolean;
  projects: { id: string; name: string } | null;
  task_categories: { id: string; name: string } | null;
};

export default function ManagerTasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [projectFilter, setProjectFilter] = useState("");
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);

  async function loadTasks() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/manager/tasks");
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to load tasks");
        return;
      }
      setTasks(data.tasks);
    } catch {
      setError("Could not connect to server");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTasks();
  }, []);

  const projectOptions = useMemo(() => {
    const names = new Set<string>();
    tasks.forEach((t) => t.projects?.name && names.add(t.projects.name));
    return Array.from(names).sort();
  }, [tasks]);

  const filteredTasks = tasks.filter((t) => {
    const matchesSearch =
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.task_categories?.name?.toLowerCase().includes(search.toLowerCase());
    const matchesProject = !projectFilter || t.projects?.name === projectFilter;
    return matchesSearch && matchesProject;
  });

  async function handleSave(taskId: string) {
    const newHours = editValues[taskId];
    if (newHours === undefined || newHours === "") return;

    setSavingId(taskId);
    try {
      const res = await fetch("/api/manager/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, newHours: Number(newHours) }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Failed to save");
        return;
      }
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, default_hours: Number(newHours) } : t))
      );
      setEditValues((prev) => {
        const copy = { ...prev };
        delete copy[taskId];
        return copy;
      });
      setSavedId(taskId);
      setTimeout(() => setSavedId(null), 1500);
    } catch {
      alert("Could not connect to server");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-4">Tasks & Default Hours</h1>

      <div className="flex flex-wrap gap-3 mb-4">
        <input
          type="text"
          placeholder="Search task or category..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border rounded px-3 py-2 w-64"
        />
        <select
          value={projectFilter}
          onChange={(e) => setProjectFilter(e.target.value)}
          className="border rounded px-3 py-2"
        >
          <option value="">All Projects</option>
          {projectOptions.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
        <span className="text-sm text-gray-500 self-center">
          {filteredTasks.length} task(s)
        </span>
      </div>

      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : error ? (
        <p className="text-red-600">{error}</p>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 text-left">
              <tr>
                <th className="p-3">Project</th>
                <th className="p-3">Category</th>
                <th className="p-3">Task</th>
                <th className="p-3">NE/Batch</th>
                <th className="p-3">Default Hours</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {filteredTasks.map((t) => (
                <tr key={t.id} className="border-t">
                  <td className="p-3 text-gray-600">{t.projects?.name ?? "-"}</td>
                  <td className="p-3 text-gray-600">{t.task_categories?.name ?? "-"}</td>
                  <td className="p-3 font-medium">{t.name}</td>
                  <td className="p-3 text-gray-500">{t.ne_batch ?? "-"}</td>
                  <td className="p-3">
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      value={editValues[t.id] ?? t.default_hours}
                      onChange={(e) =>
                        setEditValues((prev) => ({ ...prev, [t.id]: e.target.value }))
                      }
                      className="border rounded px-2 py-1 w-20"
                    />
                  </td>
                  <td className="p-3">
                    {editValues[t.id] !== undefined &&
                      Number(editValues[t.id]) !== t.default_hours && (
                        <button
                          onClick={() => handleSave(t.id)}
                          disabled={savingId === t.id}
                          className="bg-blue-600 text-white rounded px-3 py-1 text-xs disabled:opacity-50"
                        >
                          {savingId === t.id ? "Saving..." : "Save"}
                        </button>
                      )}
                    {savedId === t.id && (
                      <span className="text-green-600 text-xs ml-2">Saved!</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}