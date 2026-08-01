// app/manager/audit-log/page.tsx
"use client";

import { Fragment, useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";

type AuditEntry = {
  id: string;
  managerEmail: string;
  action: string;
  entityType: string;
  entityId: string | null;
  oldValue: unknown;
  newValue: unknown;
  createdAt: string;
};

type AuditLogResponse = { entries: AuditEntry[]; total: number };

const ENTITY_TYPES = ["tasks", "task_categories", "projects", "resource", "attendance", "utilization_settings"];
const PAGE_SIZE = 50;

async function fetchAuditLog(params: { offset: number; entityType: string; action: string }): Promise<AuditLogResponse> {
  const search = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(params.offset) });
  if (params.entityType) search.set("entityType", params.entityType);
  if (params.action) search.set("action", params.action);
  const res = await fetch(`/api/manager/audit-log?${search.toString()}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to load audit log");
  return data;
}

export default function ManagerAuditLogPage() {
  const [offset, setOffset] = useState(0);
  const [entityType, setEntityType] = useState("");
  const [action, setAction] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["audit-log", offset, entityType, action],
    queryFn: () => fetchAuditLog({ offset, entityType, action }),
    placeholderData: keepPreviousData,
  });

  const entries = data?.entries ?? [];
  const total = data?.total ?? 0;

  function changeFilter(setter: (v: string) => void, value: string) {
    setter(value);
    setOffset(0);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Audit Log</h1>
      <p className="text-gray-600 text-sm">
        Every manager change that affects tasks, projects, assignments, attendance overrides, or utilization
        settings is recorded here — who changed what, and the before/after values.
      </p>

      <div className="bg-white rounded-lg shadow p-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Entity Type</label>
          <select
            value={entityType}
            onChange={(e) => changeFilter(setEntityType, e.target.value)}
            className="border rounded px-2 py-1.5 text-sm"
          >
            <option value="">All</option>
            {ENTITY_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Action contains</label>
          <input
            type="text"
            value={action}
            onChange={(e) => changeFilter(setAction, e.target.value)}
            placeholder="e.g. update_task"
            className="border rounded px-2 py-1.5 text-sm"
          />
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded px-3 py-2">
          {error instanceof Error ? error.message : "Failed to load audit log"}
        </div>
      )}

      {isLoading ? (
        <p className="text-gray-500">Loading audit log...</p>
      ) : (
        <>
          <div className="bg-white rounded-lg shadow overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-gray-500">
                <tr>
                  <th className="px-4 py-2">When</th>
                  <th className="px-4 py-2">Manager</th>
                  <th className="px-4 py-2">Action</th>
                  <th className="px-4 py-2">Entity</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {entries.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400">No audit entries match these filters.</td></tr>
                ) : (
                  entries.map((entry) => (
                    <Fragment key={entry.id}>
                      <tr className="border-t">
                        <td className="px-4 py-2 text-gray-500">{new Date(entry.createdAt).toLocaleString()}</td>
                        <td className="px-4 py-2">{entry.managerEmail}</td>
                        <td className="px-4 py-2 font-medium">{entry.action}</td>
                        <td className="px-4 py-2 text-gray-500">{entry.entityType}</td>
                        <td className="px-4 py-2">
                          <button
                            onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                            className="text-blue-600 text-xs font-medium"
                          >
                            {expandedId === entry.id ? "Hide" : "Details"}
                          </button>
                        </td>
                      </tr>
                      {expandedId === entry.id && (
                        <tr className="border-t bg-gray-50">
                          <td colSpan={5} className="px-4 py-3">
                            <div className="grid grid-cols-2 gap-4 text-xs">
                              <div>
                                <p className="font-medium text-gray-500 mb-1">Old Value</p>
                                <pre className="bg-white border rounded p-2 overflow-x-auto">
                                  {JSON.stringify(entry.oldValue, null, 2) ?? "null"}
                                </pre>
                              </div>
                              <div>
                                <p className="font-medium text-gray-500 mb-1">New Value</p>
                                <pre className="bg-white border rounded p-2 overflow-x-auto">
                                  {JSON.stringify(entry.newValue, null, 2) ?? "null"}
                                </pre>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between text-sm text-gray-500">
            <span>
              Showing {entries.length === 0 ? 0 : offset + 1}-{offset + entries.length} of {total}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
                disabled={offset === 0}
                className="px-3 py-1 border rounded disabled:opacity-40"
              >
                Previous
              </button>
              <button
                onClick={() => setOffset((o) => o + PAGE_SIZE)}
                disabled={offset + PAGE_SIZE >= total}
                className="px-3 py-1 border rounded disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
