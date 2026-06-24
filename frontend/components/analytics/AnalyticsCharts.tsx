"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import type { AnalyticsData } from "@/lib/analytics";
import ChartCard from "@/components/analytics/ChartCard";
import EmptyChartState from "@/components/analytics/EmptyChartState";

const chartColors = ["#0f766e", "#2563eb", "#dc2626", "#9333ea", "#ca8a04", "#16a34a"];

interface AnalyticsChartsProps {
  data: AnalyticsData;
}

export default function AnalyticsCharts({ data }: AnalyticsChartsProps) {
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <ChartCard
        title="FIR Trends"
        subtitle="Monthly FIR volume with open and closed case movement."
      >
        {data.monthlyStats.length ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data.monthlyStats} margin={{ left: -16, right: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" opacity={0.2} />
              <XAxis dataKey="month" tickLine={false} axisLine={false} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend />
              <Area
                type="monotone"
                dataKey="total"
                name="Total FIRs"
                stroke="#0f766e"
                fill="#0f766e"
                fillOpacity={0.18}
              />
              <Area
                type="monotone"
                dataKey="open"
                name="Open"
                stroke="#16a34a"
                fill="#16a34a"
                fillOpacity={0.12}
              />
              <Area
                type="monotone"
                dataKey="closed"
                name="Closed"
                stroke="#52525b"
                fill="#52525b"
                fillOpacity={0.1}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <EmptyChartState />
        )}
      </ChartCard>

      <ChartCard
        title="District-wise Crime Comparison"
        subtitle="FIR counts grouped by district."
      >
        {data.districtStats.length ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.districtStats.slice(0, 10)} margin={{ left: -16, right: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" opacity={0.2} />
              <XAxis dataKey="name" tickLine={false} axisLine={false} interval={0} angle={-20} textAnchor="end" height={70} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="count" name="FIRs" radius={[4, 4, 0, 0]} fill="#2563eb" />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <EmptyChartState />
        )}
      </ChartCard>

      <ChartCard
        title="Crime Type Distribution"
        subtitle="Share of FIRs by crime category."
      >
        {data.crimeTypeStats.length ? (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data.crimeTypeStats}
                dataKey="count"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={105}
                label
              >
                {data.crimeTypeStats.map((entry, index) => (
                  <Cell
                    key={entry.name}
                    fill={chartColors[index % chartColors.length]}
                  />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <EmptyChartState />
        )}
      </ChartCard>

      <ChartCard
        title="Monthly Statistics"
        subtitle="Recent six-month FIR comparison."
      >
        {data.recentTrend.length ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.recentTrend} margin={{ left: -16, right: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" opacity={0.2} />
              <XAxis dataKey="month" tickLine={false} axisLine={false} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend />
              <Bar dataKey="open" name="Open" stackId="cases" fill="#16a34a" radius={[4, 4, 0, 0]} />
              <Bar dataKey="closed" name="Closed" stackId="cases" fill="#71717a" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <EmptyChartState />
        )}
      </ChartCard>
    </div>
  );
}

const tooltipStyle = {
  borderRadius: "6px",
  border: "1px solid #3f3f46",
  background: "#09090b",
  color: "#fafafa"
};
