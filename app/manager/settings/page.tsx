// app/manager/settings/page.tsx
"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

type Settings = {
  id: number;
  daily_capacity_hours: number;
  less_utilized_max: number;
  fully_utilized_max: number;
  highly_utilized_max: number;
};

async function fetchSettings(): Promise<Settings> {
  const res = await fetch("/api/settings");
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to load settings");
  return data.settings;
}

// SRS section 9 & 14: daily capacity and utilization-status boundaries
// should be configurable, not hard-coded. This page edits the single
// utilization_settings row that every dashboard/status calculation reads.
export default function ManagerSettingsPage() {
  const { data: settings, isLoading, error: loadError } = useQuery({
    queryKey: ["settings"],
    queryFn: fetchSettings,
  });

  if (isLoading) {
    return <div className="text-gray-500">Loading settings...</div>;
  }
  if (loadError || !settings) {
    return <p className="text-red-600">{loadError instanceof Error ? loadError.message : "Failed to load settings"}</p>;
  }

  return <SettingsForm key={settings.id} initialSettings={settings} />;
}

function SettingsForm({ initialSettings }: { initialSettings: Settings }) {
  const queryClient = useQueryClient();
  // Lazy initializer captures the loaded settings once at mount — no effect
  // needed to "sync" server data into local form state.
  const [form, setForm] = useState({
    daily_capacity_hours: String(initialSettings.daily_capacity_hours),
    less_utilized_max: String(initialSettings.less_utilized_max),
    fully_utilized_max: String(initialSettings.fully_utilized_max),
    highly_utilized_max: String(initialSettings.highly_utilized_max),
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const mutation = useMutation({
    mutationFn: async (values: Record<string, number>) => {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save settings");
      return data.settings as Settings;
    },
    onSuccess: (settings) => {
      queryClient.setQueryData(["settings"], settings);
      setSuccess(true);
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Failed to save settings"),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess(false);

    const values = {
      daily_capacity_hours: Number(form.daily_capacity_hours),
      less_utilized_max: Number(form.less_utilized_max),
      fully_utilized_max: Number(form.fully_utilized_max),
      highly_utilized_max: Number(form.highly_utilized_max),
    };

    for (const [key, value] of Object.entries(values)) {
      if (isNaN(value) || value <= 0) {
        setError(`${key.replace(/_/g, " ")} must be a positive number`);
        return;
      }
    }
    if (!(values.less_utilized_max < values.fully_utilized_max && values.fully_utilized_max < values.highly_utilized_max)) {
      setError("Thresholds must increase: Less Utilized Max < Fully Utilized Max < Highly Utilized Max");
      return;
    }

    mutation.mutate(values);
  }

  return (
    <div className="max-w-xl space-y-6">
      <h1 className="text-2xl font-semibold">Utilization Settings</h1>
      <p className="text-gray-600 text-sm">
        These values control how the dashboard classifies resources as Less / Fully / Highly /
        Abnormally Utilized, and the daily hour capacity used for utilization percentages.
        Changes apply immediately and are recorded in the audit log.
      </p>

      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Daily Working Capacity (hours)
          </label>
          <input
            type="number"
            step="0.5"
            min="0.5"
            value={form.daily_capacity_hours}
            onChange={(e) => setForm((f) => ({ ...f, daily_capacity_hours: e.target.value }))}
            className="w-full border rounded px-3 py-2 text-sm"
            required
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Less Utilized Max (h)
            </label>
            <input
              type="number"
              step="0.5"
              min="0"
              value={form.less_utilized_max}
              onChange={(e) => setForm((f) => ({ ...f, less_utilized_max: e.target.value }))}
              className="w-full border rounded px-3 py-2 text-sm"
              required
            />
            <p className="text-xs text-gray-400 mt-1">Below this = Less Utilized</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fully Utilized Max (h)
            </label>
            <input
              type="number"
              step="0.5"
              min="0"
              value={form.fully_utilized_max}
              onChange={(e) => setForm((f) => ({ ...f, fully_utilized_max: e.target.value }))}
              className="w-full border rounded px-3 py-2 text-sm"
              required
            />
            <p className="text-xs text-gray-400 mt-1">Up to this = Fully Utilized</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Highly Utilized Max (h)
            </label>
            <input
              type="number"
              step="0.5"
              min="0"
              value={form.highly_utilized_max}
              onChange={(e) => setForm((f) => ({ ...f, highly_utilized_max: e.target.value }))}
              className="w-full border rounded px-3 py-2 text-sm"
              required
            />
            <p className="text-xs text-gray-400 mt-1">Up to this = Highly Utilized, above = Abnormally Utilized</p>
          </div>
        </div>

        {error && <p className="text-red-600 text-sm">{error}</p>}
        {success && <p className="text-green-600 text-sm">Settings saved</p>}

        <button
          type="submit"
          disabled={mutation.isPending}
          className="bg-blue-600 text-white rounded px-4 py-2 text-sm font-medium disabled:opacity-40"
        >
          {mutation.isPending ? "Saving..." : "Save Settings"}
        </button>
      </form>

      <div className="text-xs text-gray-400">Settings row id: {initialSettings.id}</div>
    </div>
  );
}
