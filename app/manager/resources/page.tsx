// app/manager/resources/page.tsx
"use client";

import { useEffect, useState } from "react";

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

export default function ManagerResourcesPage() {
  const [resources, setResources] = useState<Resource[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pendingProjectByResource, setPendingProjectByResource] = useState<
    Record<string, string>
  >({});
  const [busyResourceId, setBusyResourceId] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const [resResources, resProjects] = await Promise.all([
        fetch("/api/manager/resources"),
        fetch("/api/manager/projects"),
      ]);
      const dataResources = await resResources.json();
      const dataProjects = await resProjects.json();

      if (!resResources.ok) {
        setError(dataResources.error || "Failed to load resources");
        return;
      }
      if (!resProjects.ok) {
        setError(dataProjects.error || "Failed to load projects");
        return;
      }

      setResources(dataResources.resources);
      setProjects(dataProjects.projects);
    } catch {
      setError("Could not connect to server");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleAssign(resourceId: string) {
    const projectId = pendingProjectByResource[resourceId];
    if (!projectId) return;

    setBusyResourceId(resourceId);
    try {
      const res = await fetch("/api/manager/assign-project", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resourceId, projectId }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Failed to assign project");
        return;
      }
      setPendingProjectByResource((prev) => ({ ...prev, [resourceId]: "" }));
      await loadData();
    } catch {
      alert("Could not connect to server");
    } finally {
      setBusyResourceId(null);
    }
  }

  async function handleRemove(resourceId: string, assignmentId: string) {
    setBusyResourceId(resourceId);
    try {
      const res = await fetch("/api/manager/assign-project", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignmentId }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Failed to remove assignment");
        return;
      }
      await loadData();
    } catch {
      alert("Could not connect to server");
    } finally {
      setBusyResourceId(null);
    }
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

      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : error ? (
        <p className="text-red-600">{error}</p>
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
                              onClick={() => handleRemove(r.id, ap.assignmentId)}
                              disabled={busyResourceId === r.id}
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
                        disabled={
                          !pendingProjectByResource[r.id] || busyResourceId === r.id
                        }
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