// app/manager/settings/page.tsx
"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Settings2 } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

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

  return (
    <div className="max-w-xl space-y-6">
      <PageHeader
        title="Utilization Settings"
        description="These values control how the dashboard classifies resources as Less / Fully / Highly / Abnormally Utilized, and the daily hour capacity used for utilization percentages. Changes apply immediately and are recorded in the audit log."
      />

      {isLoading ? (
        <Skeleton className="h-80 rounded-xl" />
      ) : loadError || !settings ? (
        <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {loadError instanceof Error ? loadError.message : "Failed to load settings"}
        </div>
      ) : (
        <SettingsForm key={settings.id} initialSettings={settings} />
      )}
    </div>
  );
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
      toast.success("Settings saved");
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Failed to save settings"),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

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
    <Card className="animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
      <CardContent className="p-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Settings2 className="size-4" />
            Thresholds (absolute hours)
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="dailyCapacity">Daily Working Capacity (hours)</Label>
            <Input
              id="dailyCapacity"
              type="number"
              step="0.5"
              min="0.5"
              value={form.daily_capacity_hours}
              onChange={(e) => setForm((f) => ({ ...f, daily_capacity_hours: e.target.value }))}
              required
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="lessMax">Less Utilized Max (h)</Label>
              <Input
                id="lessMax"
                type="number"
                step="0.5"
                min="0"
                value={form.less_utilized_max}
                onChange={(e) => setForm((f) => ({ ...f, less_utilized_max: e.target.value }))}
                required
              />
              <p className="text-xs text-muted-foreground">Below this = Less Utilized</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fullyMax">Fully Utilized Max (h)</Label>
              <Input
                id="fullyMax"
                type="number"
                step="0.5"
                min="0"
                value={form.fully_utilized_max}
                onChange={(e) => setForm((f) => ({ ...f, fully_utilized_max: e.target.value }))}
                required
              />
              <p className="text-xs text-muted-foreground">Up to this = Fully Utilized</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="highlyMax">Highly Utilized Max (h)</Label>
              <Input
                id="highlyMax"
                type="number"
                step="0.5"
                min="0"
                value={form.highly_utilized_max}
                onChange={(e) => setForm((f) => ({ ...f, highly_utilized_max: e.target.value }))}
                required
              />
              <p className="text-xs text-muted-foreground">Above this = Abnormally Utilized</p>
            </div>
          </div>

          {error && (
            <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive animate-in fade-in-0 slide-in-from-top-1">
              {error}
            </div>
          )}

          <div className="flex items-center justify-between border-t pt-4">
            <span className="text-xs text-muted-foreground">Settings row id: {initialSettings.id}</span>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
              {mutation.isPending ? "Saving..." : "Save Settings"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
