"use client";

import { AxiosError } from "axios";
import { Loader2, Users2 } from "lucide-react";
import { useEffect, useState } from "react";
import {
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
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import AppShell from "@/components/shell/AppShell";
import CorrelationHeatmap from "@/components/sociology/CorrelationHeatmap";
import { getSociology } from "@/services/sociologyApi";
import type { SociologyData } from "@/types/sociology";

const COLORS = ["#0d9488", "#2563eb", "#dc2626", "#9333ea", "#ca8a04", "#16a34a", "#db2777", "#0891b2"];
const TOOLTIP = {
  contentStyle: { background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8, fontSize: 12 },
  labelStyle: { color: "#e4e4e7" }
};

export default function SociologyPage() {
  const [data, setData] = useState<SociologyData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    void getSociology()
      .then(setData)
      .catch((err) => setError(getErrorMessage(err, "Unable to load sociological data.")))
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <ProtectedRoute allowedRoles={["SuperAdmin", "StateAdmin", "DistrictAdmin", "Investigator", "Analyst"]}>
      <AppShell title="Sociology">
          <div className="px-4 py-6 sm:px-6 lg:px-8">
            <div className="mx-auto grid max-w-7xl gap-5">
              <header>
                <p className="flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-teal-400">
                  <Users2 className="h-4 w-4" />
                  Social Intelligence
                </p>
                <h1 className="mt-1 text-3xl font-bold">Sociological Crime Intelligence</h1>
                <p className="mt-2 text-sm text-zinc-400">
                  Demographic and socio-economic analysis of suspects across crime types.
                </p>
              </header>

              {error ? (
                <div className="rounded-md border border-red-900 bg-red-950 px-4 py-3 text-sm text-red-200">
                  {error}
                </div>
              ) : null}

              {isLoading ? (
                <div className="flex h-80 items-center justify-center rounded-lg border border-zinc-800 text-zinc-500">
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Aggregating demographics…
                </div>
              ) : data ? (
                <>
                  {/* KPIs */}
                  <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                    <Kpi label="Suspects" value={data.kpis.total_suspects.toLocaleString("en-IN")} />
                    <Kpi label="Youth share" value={`${data.kpis.youth_share_pct}%`} />
                    <Kpi label="Migrant share" value={`${data.kpis.migrant_share_pct}%`} accent />
                    <Kpi label="Unemployed" value={`${data.kpis.unemployed_share_pct}%`} accent />
                    <Kpi label="Low income" value={`${data.kpis.low_income_share_pct}%`} accent />
                  </section>

                  {/* Demographic charts */}
                  <div className="grid gap-5 lg:grid-cols-2">
                    <Card title="Age Distribution">
                      <BarChartView data={data.age_distribution} />
                    </Card>
                    <Card title="Gender">
                      <PieView data={data.gender} />
                    </Card>
                    <Card title="Education">
                      <BarChartView data={data.education} />
                    </Card>
                    <Card title="Income Band">
                      <BarChartView data={data.income_band} />
                    </Card>
                    <Card title="Occupation">
                      <BarChartView data={data.occupation} horizontal />
                    </Card>
                    <Card title="Employment Status">
                      <PieView data={data.employment} />
                    </Card>
                  </div>

                  {/* Risk factors */}
                  <Card title="Social Risk Factors — overall vs property crime">
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={data.risk_factors.factors} margin={{ left: -10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                        <XAxis dataKey="factor" tick={{ fontSize: 11, fill: "#a1a1aa" }} />
                        <YAxis tick={{ fontSize: 11, fill: "#a1a1aa" }} unit="%" />
                        <Tooltip {...TOOLTIP} />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Bar dataKey="overall_pct" name="All suspects" fill="#52525b" radius={[3, 3, 0, 0]} />
                        <Bar dataKey="property_crime_pct" name="Property crime" fill="#dc2626" radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                    <p className="mt-2 text-xs text-zinc-500">
                      Stress indicators (low income, low education) concentrate notably higher among
                      property-crime offenders — a measurable social-risk signal.
                    </p>
                  </Card>

                  {/* Youth + Migration crime trends */}
                  <div className="grid gap-5 lg:grid-cols-2">
                    <Card title="Youth Crime Trends (% under 25 by crime)">
                      <ResponsiveContainer width="100%" height={260}>
                        <BarChart data={data.youth_crime.by_crime} margin={{ left: -10 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                          <XAxis dataKey="crime_type" tick={{ fontSize: 10, fill: "#a1a1aa" }} angle={-20} textAnchor="end" height={60} />
                          <YAxis tick={{ fontSize: 11, fill: "#a1a1aa" }} unit="%" />
                          <Tooltip {...TOOLTIP} />
                          <Bar dataKey="youth_pct" name="Youth %" fill="#2563eb" radius={[3, 3, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </Card>
                    <Card title="Migration Impact (% migrant by crime)">
                      <ResponsiveContainer width="100%" height={260}>
                        <BarChart data={data.migration.by_crime} margin={{ left: -10 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                          <XAxis dataKey="crime_type" tick={{ fontSize: 10, fill: "#a1a1aa" }} angle={-20} textAnchor="end" height={60} />
                          <YAxis tick={{ fontSize: 11, fill: "#a1a1aa" }} unit="%" />
                          <Tooltip {...TOOLTIP} />
                          <Bar dataKey="migrant_pct" name="Migrant %" fill="#9333ea" radius={[3, 3, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </Card>
                  </div>

                  {/* Gender-based crime + economic stress */}
                  <div className="grid gap-5 lg:grid-cols-2">
                    <Card title="Gender-based Crime Trends">
                      <ResponsiveContainer width="100%" height={280}>
                        <BarChart data={data.gender_crime.by_crime} margin={{ left: -10 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                          <XAxis dataKey="crime_type" tick={{ fontSize: 10, fill: "#a1a1aa" }} angle={-20} textAnchor="end" height={60} />
                          <YAxis tick={{ fontSize: 11, fill: "#a1a1aa" }} />
                          <Tooltip {...TOOLTIP} />
                          <Legend wrapperStyle={{ fontSize: 12 }} />
                          <Bar dataKey="Male" stackId="g" fill="#0d9488" />
                          <Bar dataKey="Female" stackId="g" fill="#db2777" />
                          <Bar dataKey="Other" stackId="g" fill="#ca8a04" />
                        </BarChart>
                      </ResponsiveContainer>
                    </Card>
                    <Card title="Economic Stress Index by District (top 15)">
                      <div className="max-h-[280px] overflow-y-auto">
                        {data.economic_stress.districts.map((d) => (
                          <div key={d.district} className="mb-2 flex items-center gap-2 text-sm">
                            <span className="w-32 truncate text-zinc-300">{d.district}</span>
                            <div className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-800">
                              <div
                                className="h-full rounded-full bg-amber-500"
                                style={{ width: `${d.stress_index}%` }}
                              />
                            </div>
                            <span className="w-12 text-right text-xs text-amber-400">{d.stress_index}</span>
                          </div>
                        ))}
                      </div>
                    </Card>
                  </div>

                  {/* Correlation heatmap */}
                  <Card title="Age × Crime-Type Correlation">
                    <CorrelationHeatmap
                      crimeTypes={data.age_crime_correlation.crime_types}
                      matrix={data.age_crime_correlation.matrix}
                    />
                  </Card>
                </>
              ) : null}
            </div>
          </div>
      </AppShell>
    </ProtectedRoute>
  );
}

function Kpi({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
      <p className="text-sm text-zinc-400">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${accent ? "text-amber-400" : "text-zinc-100"}`}>{value}</p>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
      <h2 className="mb-3 text-sm font-semibold text-zinc-100">{title}</h2>
      {children}
    </section>
  );
}

function BarChartView({ data, horizontal }: { data: Array<{ name: string; count: number }>; horizontal?: boolean }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart
        data={data}
        layout={horizontal ? "vertical" : "horizontal"}
        margin={{ left: horizontal ? 20 : -10 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
        {horizontal ? (
          <>
            <XAxis type="number" tick={{ fontSize: 11, fill: "#a1a1aa" }} />
            <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 10, fill: "#a1a1aa" }} />
          </>
        ) : (
          <>
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#a1a1aa" }} />
            <YAxis tick={{ fontSize: 11, fill: "#a1a1aa" }} />
          </>
        )}
        <Tooltip {...TOOLTIP} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
        <Bar dataKey="count" fill="#0d9488" radius={horizontal ? [0, 3, 3, 0] : [3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function PieView({ data }: { data: Array<{ name: string; count: number }> }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <PieChart>
        <Pie data={data} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
          {data.map((_, index) => (
            <Cell key={index} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip {...TOOLTIP} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof AxiosError) {
    const detail = error.response?.data?.detail;
    if (typeof detail === "string") return detail;
  }
  return fallback;
}
