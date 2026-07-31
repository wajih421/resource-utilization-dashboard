// components/tables/SummaryTable.tsx
import { getStatusColor, type UtilizationStatus } from "@/lib/utils/utilization";

export type StatusCounts = {
  "Highly Utilized": number;
  "Fully Utilized": number;
  "Less Utilized": number;
  "Abnormally Utilized": number;
  Weekend: number;
  "Not Filled": number;
};

// A compact, tabular alternative to the KPI cards - useful for printing or
// for a quick glance when the cards take up too much vertical space (e.g.
// inside a smaller widget, or a per-project breakdown further down the
// dashboard). Takes the same statusCounts shape the dashboard-summary
// route already returns, so it's a drop-in addition, not a new fetch.
export default function SummaryTable({
  totalResources,
  activeResources,
  averageUtilization,
  statusCounts,
}: {
  totalResources: number;
  activeResources: number;
  averageUtilization: number;
  statusCounts: StatusCounts;
}) {
  const rows: { label: keyof StatusCounts; count: number }[] = [
    { label: "Highly Utilized", count: statusCounts["Highly Utilized"] },
    { label: "Fully Utilized", count: statusCounts["Fully Utilized"] },
    { label: "Less Utilized", count: statusCounts["Less Utilized"] },
    { label: "Abnormally Utilized", count: statusCounts["Abnormally Utilized"] },
    { label: "Not Filled", count: statusCounts["Not Filled"] },
    { label: "Weekend", count: statusCounts["Weekend"] },
  ];

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="px-4 py-3 border-b bg-gray-50 flex justify-between text-sm">
        <span>
          <strong>{totalResources}</strong> total resources
        </span>
        <span>
          <strong>{activeResources}</strong> logged work today
        </span>
        <span>
          Avg utilization: <strong>{averageUtilization.toFixed(1)}%</strong>
        </span>
      </div>
      <table className="w-full text-sm">
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-t">
              <td className="px-4 py-2">
                <span
                  className={`inline-block px-2 py-0.5 rounded text-xs font-medium border ${
                    row.label === "Weekend"
                      ? "text-purple-600 bg-purple-50 border-purple-200"
                      : getStatusColor(row.label as UtilizationStatus)
                  }`}
                >
                  {row.label}
                </span>
              </td>
              <td className="px-4 py-2 text-right font-semibold">{row.count}</td>
              <td className="px-4 py-2 text-right text-gray-400 w-32">
                {totalResources > 0
                  ? `${((row.count / totalResources) * 100).toFixed(0)}%`
                  : "0%"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}