// components/charts/ProjectUtilizationChart.tsx
"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from "recharts";

export type ProjectUtilizationRow = {
  projectId: string;
  projectName: string;
  assignedResources: number;
  hours: number;
  capacity: number;
  utilizationPercent: number;
};

// Takes the same `projectUtilization` array the dashboard-summary route
// returns. Purely presentational (props in, chart out) so it can replace
// or sit alongside the inline progress-bar list on the dashboard page.
export default function ProjectUtilizationChart({
  data,
}: {
  data: ProjectUtilizationRow[];
}) {
  if (data.length === 0) {
    return <p className="text-gray-500 text-sm p-4">No project data for this date.</p>;
  }

  const chartData = data.map((p) => ({
    name: p.projectName,
    percent: Math.round(p.utilizationPercent),
    hours: p.hours,
    capacity: p.capacity,
  }));

  function barColor(percent: number) {
    if (percent >= 100) return "#dc2626"; // red - abnormal/over capacity
    if (percent >= 80) return "#16a34a"; // green - healthy
    if (percent >= 60) return "#ea580c"; // orange - moderate
    return "#ca8a04"; // yellow - under-utilized
  }

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <p className="text-sm font-medium text-gray-600 mb-3">Project Utilization %</p>
      <ResponsiveContainer width="100%" height={Math.max(200, chartData.length * 40)}>
        <BarChart data={chartData} layout="vertical" margin={{ left: 20 }}>
          <XAxis type="number" domain={[0, 120]} tick={{ fontSize: 11 }} />
          <YAxis
            type="category"
            dataKey="name"
            width={160}
            tick={{ fontSize: 11 }}
          />
          <Tooltip
            formatter={(value, name) => [
              `${value ?? 0}%`,
              name === "percent" ? "Utilization" : String(name),
            ]}
          />
          <ReferenceLine x={100} stroke="#9ca3af" strokeDasharray="3 3" />
          <Bar dataKey="percent" radius={[0, 4, 4, 0]}>
            {chartData.map((entry) => (
              <Cell key={entry.name} fill={barColor(entry.percent)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}