// components/manager/AssignProjectControl.tsx
"use client";

import { useEffect, useState } from "react";

type Project = { id: string; name: string };

// Drop this into any row of a resources table. It's self-contained: loads
// the project list once, lets the manager pick a new one, and calls
// /api/manager/assign-project on confirm. `onAssigned` lets the parent
// refresh its own data after a successful move.
export default function AssignProjectControl({
  resourceId,
  currentProjectId,
  onAssigned,
}: {
  resourceId: string;
  currentProjectId?: string | null;
  onAssigned?: (newProjectId: string) => void;
}) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selected, setSelected] = useState(currentProjectId ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/manager/projects")
      .then((res) => res.json())
      .then((data) => setProjects(data.projects ?? []))
      .catch(() => setError("Could not load projects"));
  }, []);

  async function handleAssign() {
    if (!selected || selected === currentProjectId) return;

    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/manager/assign-project", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resource_id: resourceId, project_id: selected }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Reassignment failed");
        return;
      }
      onAssigned?.(selected);
    } catch {
      setError("Could not connect to server");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        className="border rounded px-2 py-1 text-sm"
      >
        <option value="">Select project</option>
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <button
        onClick={handleAssign}
        disabled={saving || !selected || selected === currentProjectId}
        className="bg-blue-600 text-white rounded px-3 py-1 text-xs font-medium disabled:opacity-40"
      >
        {saving ? "Saving..." : "Assign"}
      </button>
      {error && <span className="text-red-600 text-xs">{error}</span>}
    </div>
  );
}