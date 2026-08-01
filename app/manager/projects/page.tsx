// app/manager/projects/page.tsx
"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Search, Pencil, Check, X, Ban, RotateCcw, FolderKanban, Loader2 } from "lucide-react";
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
    onSuccess: async (project) => {
      await invalidate();
      setNewProjectName("");
      setShowAddForm(false);
      setCreateError("");
      toast.success(`Project "${project.name}" created`);
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
      toast.success("Project renamed");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to update project"),
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
    onSuccess: async (_data, project) => {
      await invalidate();
      toast.success(project.active ? `"${project.name}" deactivated` : `"${project.name}" reactivated`);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to update project"),
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
      toast.error("Project name cannot be empty");
      return;
    }
    renameMutation.mutate({ projectId, name: editName.trim() });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Projects"
        description="Manage workshop projects and view today's utilization"
        action={
          <Button onClick={() => setShowAddForm((s) => !s)}>
            {showAddForm ? <X className="size-4" /> : <Plus className="size-4" />}
            {showAddForm ? "Cancel" : "Add Project"}
          </Button>
        }
      />

      {error && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error instanceof Error ? error.message : "Failed to load projects"}
        </div>
      )}

      {showAddForm && (
        <Card className="animate-in fade-in-0 slide-in-from-top-2 duration-200">
          <CardContent className="p-4">
            <form onSubmit={handleCreateProject} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="newProjectName">Project Name</Label>
                <Input
                  id="newProjectName"
                  type="text"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  className="max-w-sm"
                  placeholder="e.g. Ghana MTN Project"
                  required
                  autoFocus
                />
              </div>
              {createError && <p className="text-sm text-destructive">{createError}</p>}
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending && <Loader2 className="size-4 animate-spin" />}
                {createMutation.isPending ? "Creating..." : "Create Project"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Status</Label>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active only</SelectItem>
                <SelectItem value="inactive">Inactive only</SelectItem>
                <SelectItem value="all">All</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-[200px] flex-1 space-y-1.5">
            <Label className="text-xs text-muted-foreground">Search</Label>
            <div className="relative">
              <Search className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search project name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-10 rounded-lg" />
          <Skeleton className="h-64 rounded-lg" />
        </div>
      ) : (
        <Card className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-4">Project</TableHead>
                <TableHead>Assigned Resources</TableHead>
                <TableHead>Today&apos;s Utilization</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="pr-4">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProjects.length === 0 && (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={5} className="p-0">
                    <EmptyState icon={FolderKanban} title="No projects match the current filters." />
                  </TableCell>
                </TableRow>
              )}
              {filteredProjects.map((project, i) => {
                const util = utilizationByProject[project.id];
                const isEditing = editingId === project.id;
                const isBusy =
                  (renameMutation.isPending && renameMutation.variables?.projectId === project.id) ||
                  (toggleActiveMutation.isPending && toggleActiveMutation.variables?.id === project.id);
                return (
                  <TableRow
                    key={project.id}
                    className={`animate-in fade-in-0 duration-300 ${!project.active ? "opacity-60" : ""}`}
                    style={{ animationDelay: `${Math.min(i, 20) * 25}ms`, animationFillMode: "backwards" }}
                  >
                    <TableCell className="pl-4 font-medium">
                      {isEditing ? (
                        <Input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="h-8 max-w-xs"
                          autoFocus
                        />
                      ) : (
                        project.name
                      )}
                    </TableCell>
                    <TableCell>{project.assignedResourceCount}</TableCell>
                    <TableCell>
                      {util ? (
                        <span className="tabular-nums">
                          {util.hours.toFixed(1)}h / {util.capacity}h ({util.utilizationPercent.toFixed(0)}%)
                        </span>
                      ) : (
                        <span className="text-muted-foreground">No data</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          project.active
                            ? "text-emerald-600 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-950/40 dark:border-emerald-900"
                            : "text-muted-foreground"
                        }
                      >
                        {project.active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="pr-4">
                      <div className="flex items-center gap-1">
                        {isEditing ? (
                          <>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => saveEdit(project.id)}
                              disabled={isBusy}
                              aria-label="Save"
                            >
                              <Check className="size-4 text-emerald-600" />
                            </Button>
                            <Button variant="ghost" size="icon-sm" onClick={cancelEdit} aria-label="Cancel">
                              <X className="size-4" />
                            </Button>
                          </>
                        ) : (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => startEdit(project)}
                            aria-label="Rename"
                          >
                            <Pencil className="size-4" />
                          </Button>
                        )}

                        {project.active ? (
                          <AlertDialog>
                            <AlertDialogTrigger render={<Button variant="ghost" size="icon-sm" disabled={isBusy} aria-label="Deactivate" />}>
                              <Ban className="size-4 text-destructive" />
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Deactivate {project.name}?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Resources will no longer see this project for new work logs. Existing history
                                  stays intact and you can reactivate it anytime.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  variant="destructive"
                                  onClick={() => toggleActiveMutation.mutate(project)}
                                >
                                  Deactivate
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        ) : (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => toggleActiveMutation.mutate(project)}
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
