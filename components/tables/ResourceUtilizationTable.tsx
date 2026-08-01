// components/tables/ResourceUtilizationTable.tsx
import { Users } from "lucide-react";
import { getStatusColor, type UtilizationStatus } from "@/lib/utils/utilization";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/layout/EmptyState";

export type ResourceUtilizationRow = {
  resourceId: string;
  name: string;
  employeeId: string;
  hours: number;
  utilizationPercent: number;
  status: UtilizationStatus | "Weekend";
};

// Purely presentational — takes data via props so it can be reused on the
// manager dashboard AND the manager resources page without duplicating
// fetch logic. Sorting/filtering can be handled by the parent if needed.
export default function ResourceUtilizationTable({
  rows,
}: {
  rows: ResourceUtilizationRow[];
}) {
  if (rows.length === 0) {
    return (
      <Card>
        <EmptyState icon={Users} title="No resources to display" />
      </Card>
    );
  }

  return (
    <Card className="p-0">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="pl-4">Name</TableHead>
            <TableHead>Employee ID</TableHead>
            <TableHead>Hours</TableHead>
            <TableHead>Utilization %</TableHead>
            <TableHead className="pr-4">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, i) => (
            <TableRow
              key={row.resourceId}
              className="animate-in fade-in-0 duration-300"
              style={{ animationDelay: `${Math.min(i, 20) * 25}ms`, animationFillMode: "backwards" }}
            >
              <TableCell className="pl-4 font-medium">{row.name}</TableCell>
              <TableCell className="text-muted-foreground">{row.employeeId}</TableCell>
              <TableCell className="tabular-nums">{row.hours.toFixed(1)}h</TableCell>
              <TableCell className="tabular-nums">{row.utilizationPercent.toFixed(0)}%</TableCell>
              <TableCell className="pr-4">
                <Badge
                  variant="outline"
                  className={
                    row.status === "Weekend"
                      ? "text-purple-600 bg-purple-50 border-purple-200 dark:text-purple-400 dark:bg-purple-950/40 dark:border-purple-900"
                      : getStatusColor(row.status as UtilizationStatus)
                  }
                >
                  {row.status}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}
