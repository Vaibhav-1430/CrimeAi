"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import type { ForecastData } from "@/types/hotspot";

interface ForecastChartProps {
  data: ForecastData;
}

/** History + forecast in one series, split at the last historical month. */
export default function ForecastChart({ data }: ForecastChartProps) {
  const merged = [
    ...data.history.map((p) => ({ month: p.month, history: p.count, forecast: null as number | null })),
    ...data.forecast.map((p, index) => ({
      month: p.month,
      // bridge the gap: first forecast point also carries the last history value
      history: index === 0 && data.history.length ? data.history[data.history.length - 1].count : null,
      forecast: p.count
    }))
  ];
  const splitMonth = data.history.length ? data.history[data.history.length - 1].month : undefined;

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={merged} margin={{ left: -10, right: 12, top: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
        <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#a1a1aa" }} minTickGap={20} />
        <YAxis tick={{ fontSize: 11, fill: "#a1a1aa" }} allowDecimals={false} />
        <Tooltip
          contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8, fontSize: 12 }}
          labelStyle={{ color: "#e4e4e7" }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {splitMonth ? <ReferenceLine x={splitMonth} stroke="#52525b" strokeDasharray="4 4" /> : null}
        <Line type="monotone" dataKey="history" name="Actual" stroke="#0d9488" strokeWidth={2} dot={false} />
        <Line
          type="monotone"
          dataKey="forecast"
          name="Forecast"
          stroke="#f59e0b"
          strokeWidth={2}
          strokeDasharray="5 4"
          dot={{ r: 2 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
