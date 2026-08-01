"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, X, Check, Pencil, Ban, RotateCcw, ListChecks, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/layout/EmptyState";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

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

const ALL = "__all__";

async function fetchAll() {
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

  return {
    tasks: (tasksData.tasks ?? []) as Task[],
    projects: (projectsData.projects ?? []) as Project[],
    categories: (categoriesData.categories ?? []) as Category[],
  };
}

export default function ManagerTasksPage() {
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery({ queryKey: ["manager-tasks"], queryFn: fetchAll });
  const projects = data?.projects ?? [];
  const categories = data?.categories ?? [];

  const [projectFilter, setProjectFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("active");
  const [search, setSearch] = useState("");

  const [editValues, setEditValues] = useState<Record<string, string>>({});

  const [showAddForm, setShowAddForm] = useState(false);
  const [newTask, setNewTask] = useState({
    project_id: "",
    task_category_id: "",
    name: "",
    ne_batch: "",
    default_hours: "2",
  });
  const [createError, setCreateError] = useState("");

  const [newCategoryName, setNewCategoryName] = useState("");

  function invalidate() {
    return queryClient.invalidateQueries({ queryKey: ["manager-tasks"] });
  }

  const saveHoursMutation = useMutation({
    mutationFn: async ({ taskId, value }: { taskId: string; value: number }) => {
      const res = await fetch("/api/manager/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, default_hours: value }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update task");
      return data;
    },
    onSuccess: async (_data, variables) => {
      await invalidate();
      cancelEdit(variables.taskId);
      toast.success("Default hours updated");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to update task"),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async (task: Task) => {
      if (task.active) {
        const res = await fetch(`/api/manager/tasks?taskId=${task.id}`, { method: "DELETE" });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to deactivate task");
      } else {
        const res = await fetch("/api/manager/tasks", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ taskId: task.id, active: true }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to reactivate task");
      }
    },
    onSuccess: async (_data, task) => {
      await invalidate();
      toast.success(task.active ? `"${task.name}" deactivated` : `"${task.name}" reactivated`);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to update task"),
  });

  const createTaskMutation = useMutation({
    mutationFn: async (payload: typeof newTask) => {
      const res = await fetch("/api/manager/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: payload.project_id,
          task_category_id: payload.task_category_id,
          name: payload.name.trim(),
          ne_batch: payload.ne_batch.trim() || null,
          default_hours: Number(payload.default_hours),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create task");
      return data;
    },
    onSuccess: async () => {
      await invalidate();
      setNewTask({ project_id: "", task_category_id: "", name: "", ne_batch: "", default_hours: "2" });
      setShowAddForm(false);
      setCreateError("");
      toast.success("Task created");
    },
    onError: (err) => setCreateError(err instanceof Error ? err.message : "Failed to create task"),
  });

  const createCategoryMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await fetch("/api/manager/task-categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create category");
      return data.category as Category;
    },
    onSuccess: async (category) => {
      await invalidate();
      setNewTask((prev) => ({ ...prev, task_category_id: category.id }));
      setNewCategoryName("");
      toast.success(`Category "${category.name}" created`);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to create category"),
  });

  const filteredTasks = useMemo(() => {
    return (data?.tasks ?? []).filter((t) => {
      if (projectFilter && t.projects?.id !== projectFilter) return false;
      if (categoryFilter && t.task_categories?.id !== categoryFilter) return false;
      if (statusFilter === "active" && !t.active) return false;
      if (statusFilter === "inactive" && t.active) return false;
      if (search && !t.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [data, projectFilter, categoryFilter, statusFilter, search]);

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

  function saveDefaultHours(taskId: string) {
    const raw = editValues[taskId];
    const value = Number(raw);
    if (!raw || isNaN(value) || value <= 0) {
      toast.error("Default hours must be a positive number");
      return;
    }
    saveHoursMutation.mutate({ taskId, value });
  }

  function handleCreateTask(e: React.FormEvent) {
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
    createTaskMutation.mutate(newTask);
  }

  function handleCreateCategory() {
    if (!newCategoryName.trim()) return;
    createCategoryMutation.mutate(newCategoryName.trim());
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Task Management"
        description="Define tasks, categories and their default productivity hours"
        action={
          <Button onClick={() => setShowAddForm((s) => !s)}>
            {showAddForm ? <X className="size-4" /> : <Plus className="size-4" />}
            {showAddForm ? "Cancel" : "Add Task"}
          </Button>
        }
      />

      {error && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error instanceof Error ? error.message : "Failed to load tasks"}
        </div>
      )}

      {showAddForm && (
        <Card className="animate-in fade-in-0 slide-in-from-top-2 duration-200">
          <CardContent className="space-y-4 p-4">
            <form onSubmit={handleCreateTask} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Project</Label>
                  <Select
                    value={newTask.project_id}
                    onValueChange={(v) => setNewTask((p) => ({ ...p, project_id: v as string }))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select a project" />
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
                  <Label>Task Category</Label>
                  <Select
                    value={newTask.task_category_id}
                    onValueChange={(v) => setNewTask((p) => ({ ...p, task_category_id: v as string }))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select a category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex gap-2 pt-1">
                    <Input
                      type="text"
                      placeholder="New category name"
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      className="h-7 flex-1 text-xs"
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      size="xs"
                      onClick={handleCreateCategory}
                      disabled={createCategoryMutation.isPending || !newCategoryName.trim()}
                    >
                      {createCategoryMutation.isPending && <Loader2 className="size-3 animate-spin" />}
                      {createCategoryMutation.isPending ? "Adding..." : "Add Category"}
                    </Button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label>Task Name</Label>
                  <Input
                    type="text"
                    value={newTask.name}
                    onChange={(e) => setNewTask((p) => ({ ...p, name: e.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>NE/Batch</Label>
                  <Input
                    type="text"
                    value={newTask.ne_batch}
                    onChange={(e) => setNewTask((p) => ({ ...p, ne_batch: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Default Hours</Label>
                  <Input
                    type="number"
                    step="0.5"
                    min="0.5"
                    value={newTask.default_hours}
                    onChange={(e) => setNewTask((p) => ({ ...p, default_hours: e.target.value }))}
                    required
                  />
                </div>
              </div>

              {createError && <p className="text-sm text-destructive">{createError}</p>}

              <Button type="submit" disabled={createTaskMutation.isPending}>
                {createTaskMutation.isPending && <Loader2 className="size-4 animate-spin" />}
                {createTaskMutation.isPending ? "Creating..." : "Create Task"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Project</Label>
            <Select value={projectFilter || ALL} onValueChange={(v) => setProjectFilter(v === ALL ? "" : (v as string))}>
              <SelectTrigger size="sm" className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All projects</SelectItem>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Category</Label>
            <Select value={categoryFilter || ALL} onValueChange={(v) => setCategoryFilter(v === ALL ? "" : (v as string))}>
              <SelectTrigger size="sm" className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All categories</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Status</Label>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
              <SelectTrigger size="sm" className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active only</SelectItem>
                <SelectItem value="inactive">Inactive only</SelectItem>
                <SelectItem value="all">All</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-[160px] flex-1 space-y-1.5">
            <Label className="text-xs text-muted-foreground">Search</Label>
            <Input
              type="text"
              placeholder="Search task name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <Skeleton className="h-96 rounded-lg" />
      ) : (
        <Card className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-4">Project</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Task</TableHead>
                <TableHead>NE/Batch</TableHead>
                <TableHead>Default Hours</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="pr-4">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTasks.length === 0 && (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={7} className="p-0">
                    <EmptyState icon={ListChecks} title="No tasks match the current filters." />
                  </TableCell>
                </TableRow>
              )}
              {filteredTasks.map((task, i) => {
                const isEditing = task.id in editValues;
                const isBusy =
                  (saveHoursMutation.isPending && saveHoursMutation.variables?.taskId === task.id) ||
                  (toggleActiveMutation.isPending && toggleActiveMutation.variables?.id === task.id);
                return (
                  <TableRow
                    key={task.id}
                    className={`animate-in fade-in-0 duration-300 ${!task.active ? "opacity-60" : ""}`}
                    style={{ animationDelay: `${Math.min(i, 20) * 15}ms`, animationFillMode: "backwards" }}
                  >
                    <TableCell className="pl-4">{task.projects?.name ?? "—"}</TableCell>
                    <TableCell>{task.task_categories?.name ?? "—"}</TableCell>
                    <TableCell className="font-medium">{task.name}</TableCell>
                    <TableCell className="text-muted-foreground">{task.ne_batch ?? "—"}</TableCell>
                    <TableCell>
                      {isEditing ? (
                        <Input
                          type="number"
                          step="0.5"
                          min="0.5"
                          value={editValues[task.id]}
                          onChange={(e) => setEditValues((prev) => ({ ...prev, [task.id]: e.target.value }))}
                          className="h-8 w-20"
                          autoFocus
                        />
                      ) : (
                        <span className="tabular-nums">{task.default_hours}h</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          task.active
                            ? "text-emerald-600 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-950/40 dark:border-emerald-900"
                            : "text-muted-foreground"
                        }
                      >
                        {task.active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="pr-4">
                      <div className="flex items-center gap-1">
                        {isEditing ? (
                          <>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => saveDefaultHours(task.id)}
                              disabled={isBusy}
                              aria-label="Save"
                            >
                              <Check className="size-4 text-emerald-600" />
                            </Button>
                            <Button variant="ghost" size="icon-sm" onClick={() => cancelEdit(task.id)} aria-label="Cancel">
                              <X className="size-4" />
                            </Button>
                          </>
                        ) : (
                          <Button variant="ghost" size="icon-sm" onClick={() => startEdit(task)} aria-label="Edit hours">
                            <Pencil className="size-4" />
                          </Button>
                        )}

                        {task.active ? (
                          <AlertDialog>
                            <AlertDialogTrigger
                              render={<Button variant="ghost" size="icon-sm" disabled={isBusy} aria-label="Deactivate" />}
                            >
                              <Ban className="size-4 text-destructive" />
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Deactivate {task.name}?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Resources will no longer be able to log new work against this task. Existing
                                  work-log history stays intact.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction variant="destructive" onClick={() => toggleActiveMutation.mutate(task)}>
                                  Deactivate
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        ) : (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => toggleActiveMutation.mutate(task)}
                            disabled={isBusy}
                            aria-label="Reactivate"
                          >
                            <RotateCcw className="size-4 text-emerald-600" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
