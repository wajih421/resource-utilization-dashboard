// app/manager/resources/page.tsx
"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Search, X, Plus, Users, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/layout/EmptyState";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
  HRO: "text-purple-600 bg-purple-50 border-purple-200 dark:text-purple-400 dark:bg-purple-950/40 dark:border-purple-900",
  BO: "text-blue-600 bg-blue-50 border-blue-200 dark:text-blue-400 dark:bg-blue-950/40 dark:border-blue-900",
  "In-Source": "text-teal-600 bg-teal-50 border-teal-200 dark:text-teal-400 dark:bg-teal-950/40 dark:border-teal-900",
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
      toast.success("Project assigned");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to assign project"),
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
      toast.success("Assignment removed");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to remove assignment"),
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
    <div className="space-y-6">
      <PageHeader title="Resources" description="Manage resource-project assignments" />

      <div className="relative max-w-sm">
        <Search className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search by name or employee ID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8"
        />
      </div>

      {error ? (
        <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error instanceof Error ? error.message : "Failed to load resources"}
        </div>
      ) : isLoading ? (
        <Skeleton className="h-96 rounded-lg" />
      ) : (
        <Card className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-4">Name</TableHead>
                <TableHead>Employee ID</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Assigned Projects</TableHead>
                <TableHead className="pr-4">Add Project</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredResources.length === 0 && (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={5} className="p-0">
                    <EmptyState icon={Users} title="No resources match your search." />
                  </TableCell>
                </TableRow>
              )}
              {filteredResources.map((r, i) => (
                <TableRow
                  key={r.id}
                  className="animate-in fade-in-0 align-top duration-300"
                  style={{ animationDelay: `${Math.min(i, 20) * 20}ms`, animationFillMode: "backwards" }}
                >
                  <TableCell className="pl-4 font-medium whitespace-normal">{r.name}</TableCell>
                  <TableCell className="text-muted-foreground">{r.employee_id}</TableCell>
                  <TableCell>
                    {r.resource_category ? (
                      <Badge
                        variant="outline"
                        className={categoryColor[r.resource_category] ?? "text-muted-foreground"}
                      >
                        {r.resource_category}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="whitespace-normal">
                    <div className="flex flex-wrap gap-1.5">
                      {r.assignedProjects.length === 0 ? (
                        <span className="text-xs text-muted-foreground">No projects</span>
                      ) : (
                        r.assignedProjects.map((ap) => (
                          <Badge key={ap.assignmentId} variant="secondary" className="gap-1 pr-1">
                            {ap.projectName}
                            <button
                              onClick={() => removeMutation.mutate({ resourceId: r.id, assignmentId: ap.assignmentId })}
                              disabled={removeMutation.isPending}
                              className="rounded-full p-0.5 transition-colors hover:bg-destructive/20 hover:text-destructive disabled:opacity-50"
                              aria-label={`Remove ${ap.projectName}`}
                            >
                              <X className="size-3" />
                            </button>
                          </Badge>
                        ))
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="pr-4">
                    <div className="flex gap-1.5">
                      <Select
                        value={pendingProjectByResource[r.id] ?? ""}
                        onValueChange={(v) =>
                          setPendingProjectByResource((prev) => ({ ...prev, [r.id]: v as string }))
                        }
                      >
                        <SelectTrigger size="sm" className="w-36">
                          <SelectValue placeholder="-- Project --" />
                        </SelectTrigger>
                        <SelectContent>
                          {projects.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        size="sm"
                        onClick={() => handleAssign(r.id)}
                        disabled={!pendingProjectByResource[r.id] || assignMutation.isPending}
                      >
                        {assignMutation.isPending && assignMutation.variables?.resourceId === r.id ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <Plus className="size-3.5" />
                        )}
                        Add
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
