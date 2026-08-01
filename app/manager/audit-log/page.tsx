// app/manager/audit-log/page.tsx
"use client";

import { Fragment, useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { ChevronDown, ChevronLeft, ChevronRight, History } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/layout/EmptyState";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

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
const ALL = "__all__";

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
      <PageHeader
        title="Audit Log"
        description="Every manager change that affects tasks, projects, assignments, attendance overrides, or utilization settings — who changed what, and the before/after values."
      />

      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Entity Type</Label>
            <Select
              value={entityType || ALL}
              onValueChange={(v) => changeFilter(setEntityType, v === ALL ? "" : (v as string))}
            >
              <SelectTrigger size="sm" className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All</SelectItem>
                {ENTITY_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Action contains</Label>
            <Input
              type="text"
              value={action}
              onChange={(e) => changeFilter(setAction, e.target.value)}
              placeholder="e.g. update_task"
              className="w-48"
            />
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error instanceof Error ? error.message : "Failed to load audit log"}
        </div>
      )}

      {isLoading ? (
        <Skeleton className="h-96 rounded-lg" />
      ) : (
        <>
          <Card className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-4">When</TableHead>
                  <TableHead>Manager</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead className="pr-4"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.length === 0 ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={5} className="p-0">
                      <EmptyState icon={History} title="No audit entries match these filters." />
                    </TableCell>
                  </TableRow>
                ) : (
                  entries.map((entry, i) => {
                    const isExpanded = expandedId === entry.id;
                    return (
                      <Fragment key={entry.id}>
                        <TableRow
                          className="animate-in fade-in-0 cursor-pointer duration-300"
                          style={{ animationDelay: `${Math.min(i, 20) * 15}ms`, animationFillMode: "backwards" }}
                          onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                        >
                          <TableCell className="pl-4 whitespace-normal text-muted-foreground">
                            {new Date(entry.createdAt).toLocaleString()}
                          </TableCell>
                          <TableCell>{entry.managerEmail}</TableCell>
                          <TableCell className="font-medium">{entry.action}</TableCell>
                          <TableCell className="text-muted-foreground">{entry.entityType}</TableCell>
                          <TableCell className="pr-4">
                            <Button variant="ghost" size="sm" className="text-muted-foreground">
                              {isExpanded ? "Hide" : "Details"}
                              <ChevronDown className={cn("size-3.5 transition-transform duration-200", isExpanded && "rotate-180")} />
                            </Button>
                          </TableCell>
                        </TableRow>
                        {isExpanded && (
                          <TableRow className="hover:bg-transparent">
                            <TableCell colSpan={5} className="bg-muted/30 p-0">
                              <div className="grid grid-cols-1 gap-4 p-4 text-xs animate-in fade-in-0 slide-in-from-top-1 duration-200 sm:grid-cols-2">
                                <div>
                                  <p className="mb-1 font-medium text-muted-foreground">Old Value</p>
                                  <pre className="overflow-x-auto rounded-lg border bg-card p-2 whitespace-pre-wrap">
                                    {JSON.stringify(entry.oldValue, null, 2) ?? "null"}
                                  </pre>
                                </div>
                                <div>
                                  <p className="mb-1 font-medium text-muted-foreground">New Value</p>
                                  <pre className="overflow-x-auto rounded-lg border bg-card p-2 whitespace-pre-wrap">
                                    {JSON.stringify(entry.newValue, null, 2) ?? "null"}
                                  </pre>
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </Card>

          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              Showing {entries.length === 0 ? 0 : offset + 1}-{offset + entries.length} of {total}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
                disabled={offset === 0}
              >
                <ChevronLeft className="size-4" />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setOffset((o) => o + PAGE_SIZE)}
                disabled={offset + PAGE_SIZE >= total}
              >
                Next
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
