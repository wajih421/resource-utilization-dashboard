// app/manager/resources/page.tsx
"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

type AssignedProject = {
  assignmentId: string;
  projectId: string;
  projectName: string;
};

type Resource = {
  id: string;
  name: string;
  employee_id: string;
  resource_category: string | null;
  active: boolean;
  assignedProjects: AssignedProject[];
};

type Project = { id: string; name: string };

const categoryColor: Record<string, string> = {
  HRO: "bg-purple-100 text-purple-700",
  BO: "bg-blue-100 text-blue-700",
  "In-Source": "bg-teal-100 text-teal-700",
};

async function fetchResourcesAndProjects() {
  const [resResources, resProjects] = await Promise.all([
    fetch("/api/manager/resources"),
    fetch("/api/manager/projects"),
  ]);
  const dataResources = await resResources.json();
  const dataProjects = await resProjects.json();

  if (!resResources.ok) throw new Error(dataResources.error || "Failed to load resources");
  if (!resProjects.ok) throw new Error(dataProjects.error || "Failed to load projects");

  return { resources: dataResources.resources as Resource[], projects: dataProjects.projects as Project[] };
}

export default function ManagerResourcesPage() {
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ["manager-resources"],
    queryFn: fetchResourcesAndProjects,
  });
  const resources = data?.resources ?? [];
  const projects = data?.projects ?? [];

  const [search, setSearch] = useState("");
  const [pendingProjectByResource, setPendingProjectByResource] = useState<Record<string, string>>({});
  const [actionError, setActionError] = useState("");

  function invalidate() {
    return queryClient.invalidateQueries({ queryKey: ["manager-resources"] });
  }

  const assignMutation = useMutation({
    mutationFn: async ({ resourceId, projectId }: { resourceId: string; projectId: string }) => {
      const res = await fetch("/api/manager/assign-project", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resourceId, projectId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to assign project");
      return data;
    },
    onSuccess: async (_data, variables) => {
      await invalidate();
      setPendingProjectByResource((prev) => ({ ...prev, [variables.resourceId]: "" }));
      setActionError("");
    },
    onError: (err) => setActionError(err instanceof Error ? err.message : "Failed to assign project"),
  });

  const removeMutation = useMutation({
    mutationFn: async ({ assignmentId }: { resourceId: string; assignmentId: string }) => {
      const res = await fetch("/api/manager/assign-project", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignmentId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to remove assignment");
      return data;
    },
    onSuccess: async () => {
      await invalidate();
      setActionError("");
    },
    onError: (err) => setActionError(err instanceof Error ? err.message : "Failed to remove assignment"),
  });

  function handleAssign(resourceId: string) {
    const projectId = pendingProjectByResource[resourceId];
    if (!projectId) return;
    assignMutation.mutate({ resourceId, projectId });
  }

  const filteredResources = resources.filter(
    (r) =>
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.employee_id.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-4">Resources</h1>

      <input
        type="text"
        placeholder="Search by name or employee ID..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="border rounded px-3 py-2 mb-4 w-full max-w-sm"
      />

      {actionError && <p className="text-red-600 text-sm mb-3">{actionError}</p>}

      {isLoading ? (
        <p className="text-gray-500">Loading...</p>
      ) : error ? (
        <p className="text-red-600">{error instanceof Error ? error.message : "Failed to load resources"}</p>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 text-left">
              <tr>
                <th className="p-3">Name</th>
                <th className="p-3">Employee ID</th>
                <th className="p-3">Category</th>
                <th className="p-3">Assigned Projects</th>
                <th className="p-3">Add Project</th>
              </tr>
            </thead>
            <tbody>
              {filteredResources.map((r) => (
                <tr key={r.id} className="border-t align-top">
                  <td className="p-3 font-medium">{r.name}</td>
                  <td className="p-3 text-gray-500">{r.employee_id}</td>
                  <td className="p-3">
                    {r.resource_category ? (
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-medium ${
                          categoryColor[r.resource_category] ?? "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {r.resource_category}
                      </span>
                    ) : (
                      <span className="text-gray-400 text-xs">-</span>
                    )}
                  </td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-1">
                      {r.assignedProjects.length === 0 ? (
                        <span className="text-gray-400 text-xs">No projects</span>
                      ) : (
                        r.assignedProjects.map((ap) => (
                          <span
                            key={ap.assignmentId}
                            className="inline-flex items-center gap-1 bg-gray-100 rounded px-2 py-0.5 text-xs"
                          >
                            {ap.projectName}
                            <button
                              onClick={() => removeMutation.mutate({ resourceId: r.id, assignmentId: ap.assignmentId })}
                              disabled={removeMutation.isPending}
                              className="text-red-500 hover:text-red-700 font-bold"
                              title="Remove"
                            >
                              ×
                            </button>
                          </span>
                        ))
                      )}
                    </div>
                  </td>
                  <td className="p-3">
                    <div className="flex gap-1">
                      <select
                        value={pendingProjectByResource[r.id] ?? ""}
                        onChange={(e) =>
                          setPendingProjectByResource((prev) => ({
                            ...prev,
                            [r.id]: e.target.value,
                          }))
                        }
                        className="border rounded px-2 py-1 text-xs"
                      >
                        <option value="">-- Project --</option>
                        {projects.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => handleAssign(r.id)}
                        disabled={!pendingProjectByResource[r.id] || assignMutation.isPending}
                        className="bg-blue-600 text-white rounded px-2 py-1 text-xs disabled:opacity-50"
                      >
                        Add
                      </button>
                    </div>
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
