// components/tables/ResourceUtilizationTable.tsx
import { getStatusColor, type UtilizationStatus } from "@/lib/utils/utilization";

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
      <p className="text-gray-500 text-sm p-4">No resources to display.</p>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-left text-gray-500">
          <tr>
            <th className="px-4 py-2">Name</th>
            <th className="px-4 py-2">Employee ID</th>
            <th className="px-4 py-2">Hours</th>
            <th className="px-4 py-2">Utilization %</th>
            <th className="px-4 py-2">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.resourceId} className="border-t">
              <td className="px-4 py-2 font-medium">{row.name}</td>
              <td className="px-4 py-2 text-gray-500">{row.employeeId}</td>
              <td className="px-4 py-2">{row.hours.toFixed(1)}h</td>
              <td className="px-4 py-2">{row.utilizationPercent.toFixed(0)}%</td>
              <td className="px-4 py-2">
                <span
                  className={`inline-block px-2 py-0.5 rounded text-xs font-medium border ${
                    row.status === "Weekend"
                      ? "text-purple-600 bg-purple-50 border-purple-200"
                      : getStatusColor(row.status as UtilizationStatus)
                  }`}
                >
                  {row.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}