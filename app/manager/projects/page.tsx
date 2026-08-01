// app/manager/projects/page.tsx
"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

type Project = {
  id: string;
  name: string;
  active: boolean;
  created_at: string;
  assignedResourceCount: number;
};

type ProjectUtilization = {
  projectId: string;
  hours: number;
  capacity: number;
  utilizationPercent: number;
};

async function fetchProjectsWithUtilization(today: string) {
  const [projectsRes, summaryRes] = await Promise.all([
    fetch("/api/manager/projects?includeInactive=true"),
    fetch(`/api/manager/dashboard-summary?date=${today}`),
  ]);
  const [projectsData, summaryData] = await Promise.all([projectsRes.json(), summaryRes.json()]);

  if (!projectsRes.ok) throw new Error(projectsData.error || "Failed to load projects");

  const utilizationByProject: Record<string, ProjectUtilization> = {};
  if (summaryRes.ok) {
    for (const p of summaryData.projectUtilization ?? []) {
      utilizationByProject[p.projectId] = p;
    }
  }

  return { projects: (projectsData.projects ?? []) as Project[], utilizationByProject };
}

export default function ManagerProjectsPage() {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["manager-projects", today],
    queryFn: () => fetchProjectsWithUtilization(today),
  });
  const utilizationByProject = data?.utilizationByProject ?? {};

  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("active");
  const [search, setSearch] = useState("");

  const [showAddForm, setShowAddForm] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [createError, setCreateError] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [mutationError, setMutationError] = useState("");

  function invalidate() {
    return queryClient.invalidateQueries({ queryKey: ["manager-projects", today] });
  }

  const createMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await fetch("/api/manager/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create project");
      return data.project;
    },
    onSuccess: async () => {
      await invalidate();
      setNewProjectName("");
      setShowAddForm(false);
      setCreateError("");
    },
    onError: (err) => setCreateError(err instanceof Error ? err.message : "Failed to create project"),
  });

  const renameMutation = useMutation({
    mutationFn: async ({ projectId, name }: { projectId: string; name: string }) => {
      const res = await fetch("/api/manager/projects", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update project");
      return data.project;
    },
    onSuccess: async () => {
      await invalidate();
      setEditingId(null);
      setEditName("");
      setMutationError("");
    },
    onError: (err) => setMutationError(err instanceof Error ? err.message : "Failed to update project"),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async (project: Project) => {
      if (project.active) {
        const res = await fetch(`/api/manager/projects?projectId=${project.id}`, { method: "DELETE" });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to deactivate project");
      } else {
        const res = await fetch("/api/manager/projects", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId: project.id, active: true }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to reactivate project");
      }
    },
    onSuccess: async () => {
      await invalidate();
      setMutationError("");
    },
    onError: (err) => setMutationError(err instanceof Error ? err.message : "Failed to update project"),
  });

  const filteredProjects = useMemo(() => {
    return (data?.projects ?? []).filter((p) => {
      if (statusFilter === "active" && !p.active) return false;
      if (statusFilter === "inactive" && p.active) return false;
      if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [data, statusFilter, search]);

  function handleCreateProject(e: React.FormEvent) {
    e.preventDefault();
    if (!newProjectName.trim()) {
      setCreateError("Project name is required");
      return;
    }
    createMutation.mutate(newProjectName.trim());
  }

  function startEdit(project: Project) {
    setEditingId(project.id);
    setEditName(project.name);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditName("");
  }

  function saveEdit(projectId: string) {
    if (!editName.trim()) {
      setMutationError("Project name cannot be empty");
      return;
    }
    renameMutation.mutate({ projectId, name: editName.trim() });
  }

  if (isLoading) {
    return <div className="text-gray-500">Loading projects...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Projects</h1>
        <button
          onClick={() => setShowAddForm((s) => !s)}
          className="bg-blue-600 text-white rounded px-4 py-2 text-sm font-medium"
        >
          {showAddForm ? "Cancel" : "+ Add Project"}
        </button>
      </div>

      {(error || mutationError) && (
        <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded px-3 py-2">
          {error instanceof Error ? error.message : mutationError}
        </div>
      )}

      {showAddForm && (
        <form onSubmit={handleCreateProject} className="bg-white rounded-lg shadow p-4 space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Project Name</label>
            <input
              type="text"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              className="w-full max-w-sm border rounded px-3 py-2 text-sm"
              placeholder="e.g. Ghana MTN Project"
              required
            />
          </div>
          {createError && <p className="text-red-600 text-sm">{createError}</p>}
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="bg-blue-600 text-white rounded px-4 py-2 text-sm font-medium disabled:opacity-40"
          >
            {createMutation.isPending ? "Creating..." : "Create Project"}
          </button>
        </form>
      )}

      <div className="bg-white rounded-lg shadow p-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as "all" | "active" | "inactive")}
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
            placeholder="Search project name..."
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
              <th className="px-4 py-2">Assigned Resources</th>
              <th className="px-4 py-2">Today&apos;s Utilization</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredProjects.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-gray-400">
                  No projects match the current filters.
                </td>
              </tr>
            )}
            {filteredProjects.map((project) => {
              const util = utilizationByProject[project.id];
              const isEditing = editingId === project.id;
              const isBusy =
                (renameMutation.isPending && renameMutation.variables?.projectId === project.id) ||
                (toggleActiveMutation.isPending && toggleActiveMutation.variables?.id === project.id);
              return (
                <tr key={project.id} className={`border-t ${!project.active ? "opacity-50" : ""}`}>
                  <td className="px-4 py-2 font-medium">
                    {isEditing ? (
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="border rounded px-2 py-1 text-sm w-full max-w-xs"
                      />
                    ) : (
                      project.name
                    )}
                  </td>
                  <td className="px-4 py-2">{project.assignedResourceCount}</td>
                  <td className="px-4 py-2">
                    {util ? (
                      <span>
                        {util.hours.toFixed(1)}h / {util.capacity}h ({util.utilizationPercent.toFixed(0)}%)
                      </span>
                    ) : (
                      <span className="text-gray-400">No data</span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-xs font-medium border ${
                        project.active
                          ? "text-green-600 bg-green-50 border-green-200"
                          : "text-gray-500 bg-gray-50 border-gray-200"
                      }`}
                    >
                      {project.active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex gap-2">
                      {isEditing ? (
                        <>
                          <button
                            onClick={() => saveEdit(project.id)}
                            disabled={isBusy}
                            className="text-blue-600 text-xs font-medium disabled:opacity-40"
                          >
                            Save
                          </button>
                          <button onClick={cancelEdit} className="text-gray-500 text-xs font-medium">
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button onClick={() => startEdit(project)} className="text-blue-600 text-xs font-medium">
                          Rename
                        </button>
                      )}
                      <button
                        onClick={() => toggleActiveMutation.mutate(project)}
                        disabled={isBusy}
                        className={`text-xs font-medium disabled:opacity-40 ${
                          project.active ? "text-red-600" : "text-green-600"
                        }`}
                      >
                        {project.active ? "Deactivate" : "Reactivate"}
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
