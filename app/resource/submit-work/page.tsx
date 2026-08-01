// app/resource/submit-work/page.tsx
"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, TriangleAlert, Calculator, FolderX } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/layout/EmptyState";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
      toast.success("Submit ho gaya!", { description: `Total Hours: ${data.totalHours}h` });
      setTaskId("");
      setUnitsCompleted("1");
      queryClient.invalidateQueries({ queryKey: ["resource-today-summary"] });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Submit nahi ho paya");
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
    if (!projectId || !taskId) return;
    submitMutation.mutate();
  }

  const error = projectsError || tasksError || submitMutation.error;

  return (
    <div className="max-w-lg">
      <PageHeader title="Submit Work" description="Log today's completed task units against a project" />

      {loadingProjects ? (
        <Card>
          <CardContent className="space-y-3 p-6">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </CardContent>
        </Card>
      ) : projects.length === 0 ? (
        <Card>
          <EmptyState
            icon={FolderX}
            title="Tumhe koi project assign nahi hai abhi tak."
            description="Manager se contact karo taake project assign ho sake."
          />
        </Card>
      ) : (
        <Card className="animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="workDate">Date</Label>
                  <Input
                    id="workDate"
                    type="date"
                    value={workDate}
                    onChange={(e) => setWorkDate(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Work Day Type</Label>
                  <Select value={workDayType} onValueChange={(v) => setWorkDayType(v as "regular" | "weekend")}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="regular">Regular Working Day</SelectItem>
                      <SelectItem value="weekend">Weekend</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Project</Label>
                <Select value={projectId} onValueChange={(v) => handleProjectChange(v as string)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="-- Select Project --" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Task</Label>
                <Select value={taskId} onValueChange={(v) => setTaskId(v as string)} disabled={!projectId || loadingTasks}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={loadingTasks ? "Loading tasks..." : "-- Select Task --"} />
                  </SelectTrigger>
                  <SelectContent>
                    {tasks.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.task_categories?.name ? `${t.task_categories.name} - ` : ""}
                        {t.name} ({t.default_hours}h)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="units">Units Completed</Label>
                <Input
                  id="units"
                  type="number"
                  min="0"
                  step="0.5"
                  value={unitsCompleted}
                  onChange={(e) => setUnitsCompleted(e.target.value)}
                  required
                />
              </div>

              {selectedTask && (
                <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm animate-in fade-in-0 slide-in-from-top-1">
                  <Calculator className="size-4 shrink-0 text-primary" />
                  <span>
                    Default Hours: <strong>{selectedTask.default_hours}h</strong> × Units:{" "}
                    <strong>{unitsCompleted || 0}</strong> = Total: <strong>{calculatedHours}h</strong>
                  </span>
                </div>
              )}

              {error && (
                <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive animate-in fade-in-0 slide-in-from-top-1">
                  <TriangleAlert className="size-4 shrink-0" />
                  {error instanceof Error ? error.message : "Something went wrong"}
                </div>
              )}

              <Button type="submit" disabled={submitMutation.isPending} className="w-full" size="lg">
                {submitMutation.isPending && <Loader2 className="size-4 animate-spin" />}
                {submitMutation.isPending ? "Submitting..." : "Submit Work"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
