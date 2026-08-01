// app/manager/tasks/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";

type Project = { id: string; name: string };
type Category = { id: string; name: string };
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
  const [projects, setProjects] = useState<Project[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [projectFilter, setProjectFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("active");
  const [search, setSearch] = useState("");

  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [savingTaskId, setSavingTaskId] = useState<string | null>(null);

  const [showAddForm, setShowAddForm] = useState(false);
  const [newTask, setNewTask] = useState({
    project_id: "",
    task_category_id: "",
    name: "",
    ne_batch: "",
    default_hours: "2",
  });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  const [newCategoryName, setNewCategoryName] = useState("");
  const [creatingCategory, setCreatingCategory] = useState(false);

  async function loadAll() {
    setLoading(true);
    setError("");
    try {
      const [tasksRes, projectsRes, categoriesRes] = await Promise.all([
        fetch("/api/manager/tasks"),
        fetch("/api/manager/projects"),
        fetch("/api/manager/task-categories"),
      ]);
      const [tasksData, projectsData, categoriesData] = await Promise.all([
        tasksRes.json(),
        projectsRes.json(),
        categoriesRes.json(),
      ]);

      if (!tasksRes.ok) throw new Error(tasksData.error || "Failed to load tasks");
      if (!projectsRes.ok) throw new Error(projectsData.error || "Failed to load projects");
      if (!categoriesRes.ok) throw new Error(categoriesData.error || "Failed to load categories");

      setTasks(tasksData.tasks ?? []);
      setProjects(projectsData.projects ?? []);
      setCategories(categoriesData.categories ?? []);
    } catch (err: any) {
      setError(err.message || "Could not load data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (projectFilter && t.projects?.id !== projectFilter) return false;
      if (categoryFilter && t.task_categories?.id !== categoryFilter) return false;
      if (statusFilter === "active" && !t.active) return false;
      if (statusFilter === "inactive" && t.active) return false;
      if (search && !t.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [tasks, projectFilter, categoryFilter, statusFilter, search]);

  function startEdit(task: Task) {
    setEditValues((prev) => ({ ...prev, [task.id]: String(task.default_hours) }));
  }

  function cancelEdit(taskId: string) {
    setEditValues((prev) => {
      const next = { ...prev };
      delete next[taskId];
      return next;
    });
  }

  async function saveDefaultHours(taskId: string) {
    const raw = editValues[taskId];
    const value = Number(raw);
    if (!raw || isNaN(value) || value <= 0) {
      setError("Default hours must be a positive number");
      return;
    }

    setSavingTaskId(taskId);
    setError("");
    try {
      const res = await fetch("/api/manager/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, default_hours: value }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to update task");
        return;
      }
      setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, default_hours: value } : t)));
      cancelEdit(taskId);
    } catch {
      setError("Could not connect to server");
    } finally {
      setSavingTaskId(null);
    }
  }

  async function toggleActive(task: Task) {
    setSavingTaskId(task.id);
    setError("");
    try {
      if (task.active) {
        const res = await fetch(`/api/manager/tasks?taskId=${task.id}`, { method: "DELETE" });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Failed to deactivate task");
          return;
        }
      } else {
        const res = await fetch("/api/manager/tasks", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ taskId: task.id, active: true }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Failed to reactivate task");
          return;
        }
      }
      setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, active: !t.active } : t)));
    } catch {
      setError("Could not connect to server");
    } finally {
      setSavingTaskId(null);
    }
  }

  async function handleCreateTask(e: React.FormEvent) {
    e.preventDefault();
    setCreateError("");

    if (!newTask.project_id || !newTask.task_category_id || !newTask.name.trim()) {
      setCreateError("Project, category and task name are required");
      return;
    }
    const hours = Number(newTask.default_hours);
    if (!hours || hours <= 0) {
      setCreateError("Default hours must be greater than 0");
      return;
    }

    setCreating(true);
    try {
      const res = await fetch("/api/manager/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: newTask.project_id,
          task_category_id: newTask.task_category_id,
          name: newTask.name.trim(),
          ne_batch: newTask.ne_batch.trim() || null,
          default_hours: hours,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCreateError(data.error || "Failed to create task");
        return;
      }
      await loadAll();
      setNewTask({ project_id: "", task_category_id: "", name: "", ne_batch: "", default_hours: "2" });
      setShowAddForm(false);
    } catch {
      setCreateError("Could not connect to server");
    } finally {
      setCreating(false);
    }
  }

  async function handleCreateCategory() {
    if (!newCategoryName.trim()) return;
    setCreatingCategory(true);
    try {
      const res = await fetch("/api/manager/task-categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newCategoryName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCreateError(data.error || "Failed to create category");
        return;
      }
      setCategories((prev) => [...prev, data.category].sort((a, b) => a.name.localeCompare(b.name)));
      setNewTask((prev) => ({ ...prev, task_category_id: data.category.id }));
      setNewCategoryName("");
    } catch {
      setCreateError("Could not connect to server");
    } finally {
      setCreatingCategory(false);
    }
  }

  if (loading) {
    return <div className="p-6 text-gray-500">Loading tasks...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-800">Task Management</h1>
        <button
          onClick={() => setShowAddForm((s) => !s)}
          className="bg-blue-600 text-white rounded px-4 py-2 text-sm font-medium"
        >
          {showAddForm ? "Cancel" : "+ Add Task"}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded px-3 py-2">
          {error}
        </div>
      )}

      {showAddForm && (
        <form onSubmit={handleCreateTask} className="bg-white rounded-lg shadow p-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Project</label>
              <select
                value={newTask.project_id}
                onChange={(e) => setNewTask((p) => ({ ...p, project_id: e.target.value }))}
                className="w-full border rounded px-3 py-2 text-sm"
                required
              >
                <option value="">Select a project</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Task Category</label>
              <select
                value={newTask.task_category_id}
                onChange={(e) => setNewTask((p) => ({ ...p, task_category_id: e.target.value }))}
                className="w-full border rounded px-3 py-2 text-sm"
                required
              >
                <option value="">Select a category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <div className="flex gap-2 mt-2">
                <input
                  type="text"
                  placeholder="New category name"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  className="flex-1 border rounded px-2 py-1 text-xs"
                />
                <button
                  type="button"
                  onClick={handleCreateCategory}
                  disabled={creatingCategory || !newCategoryName.trim()}
                  className="bg-gray-700 text-white rounded px-2 py-1 text-xs disabled:opacity-40"
                >
                  {creatingCategory ? "Adding..." : "Add Category"}
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Task Name</label>
              <input
                type="text"
                value={newTask.name}
                onChange={(e) => setNewTask((p) => ({ ...p, name: e.target.value }))}
                className="w-full border rounded px-3 py-2 text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">NE/Batch</label>
              <input
                type="text"
                value={newTask.ne_batch}
                onChange={(e) => setNewTask((p) => ({ ...p, ne_batch: e.target.value }))}
                className="w-full border rounded px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Default Hours</label>
              <input
                type="number"
                step="0.5"
                min="0.5"
                value={newTask.default_hours}
                onChange={(e) => setNewTask((p) => ({ ...p, default_hours: e.target.value }))}
                className="w-full border rounded px-3 py-2 text-sm"
                required
              />
            </div>
          </div>

          {createError && <p className="text-red-600 text-sm">{createError}</p>}

          <button
            type="submit"
            disabled={creating}
            className="bg-blue-600 text-white rounded px-4 py-2 text-sm font-medium disabled:opacity-40"
          >
            {creating ? "Creating..." : "Create Task"}
          </button>
        </form>
      )}

      <div className="bg-white rounded-lg shadow p-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Project</label>
          <select
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className="border rounded px-2 py-1.5 text-sm"
          >
            <option value="">All projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Category</label>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="border rounded px-2 py-1.5 text-sm"
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="border rounded px-2 py-1.5 text-sm"
          >
            <option value="active">Active only</option>
            <option value="inactive">Inactive only</option>
            <option value="all">All</option>
          </select>
        </div>
        <div className="flex-1 min-w-[160px]">
          <label className="block text-xs font-medium text-gray-500 mb-1">Search</label>
          <input
            type="text"
            placeholder="Search task name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full border rounded px-2 py-1.5 text-sm"
          />
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-500">
            <tr>
              <th className="px-4 py-2">Project</th>
              <th className="px-4 py-2">Category</th>
              <th className="px-4 py-2">Task</th>
              <th className="px-4 py-2">NE/Batch</th>
              <th className="px-4 py-2">Default Hours</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredTasks.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-gray-400">
                  No tasks match the current filters.
                </td>
              </tr>
            )}
            {filteredTasks.map((task) => {
              const isEditing = task.id in editValues;
              return (
                <tr key={task.id} className={`border-t ${!task.active ? "opacity-50" : ""}`}>
                  <td className="px-4 py-2">{task.projects?.name ?? "—"}</td>
                  <td className="px-4 py-2">{task.task_categories?.name ?? "—"}</td>
                  <td className="px-4 py-2 font-medium">{task.name}</td>
                  <td className="px-4 py-2 text-gray-500">{task.ne_batch ?? "—"}</td>
                  <td className="px-4 py-2">
                    {isEditing ? (
                      <input
                        type="number"
                        step="0.5"
                        min="0.5"
                        value={editValues[task.id]}
                        onChange={(e) =>
                          setEditValues((prev) => ({ ...prev, [task.id]: e.target.value }))
                        }
                        className="w-20 border rounded px-2 py-1 text-sm"
                      />
                    ) : (
                      <span>{task.default_hours}h</span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-xs font-medium border ${
                        task.active
                          ? "text-green-600 bg-green-50 border-green-200"
                          : "text-gray-500 bg-gray-50 border-gray-200"
                      }`}
                    >
                      {task.active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex gap-2">
                      {isEditing ? (
                        <>
                          <button
                            onClick={() => saveDefaultHours(task.id)}
                            disabled={savingTaskId === task.id}
                            className="text-blue-600 text-xs font-medium disabled:opacity-40"
                          >
                            Save
                          </button>
                          <button onClick={() => cancelEdit(task.id)} className="text-gray-500 text-xs font-medium">
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button onClick={() => startEdit(task)} className="text-blue-600 text-xs font-medium">
                          Edit Hours
                        </button>
                      )}
                      <button
                        onClick={() => toggleActive(task)}
                        disabled={savingTaskId === task.id}
                        className={`text-xs font-medium disabled:opacity-40 ${
                          task.active ? "text-red-600" : "text-green-600"
                        }`}
                      >
                        {task.active ? "Deactivate" : "Reactivate"}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}