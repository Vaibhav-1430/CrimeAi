"use client";

import { AxiosError } from "axios";
import {
  AlertTriangle,
  Flame,
  Loader2,
  MapPin,
  TrendingUp
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import ForecastChart from "@/components/hotspots/ForecastChart";
import RiskMap from "@/components/hotspots/RiskMap";
import AppShell from "@/components/shell/AppShell";
import { getHotspots, getPredictions } from "@/services/hotspotApi";
import type { ForecastData, HotspotData } from "@/types/hotspot";

type ModelChoice = "xgboost" | "random_forest";

export default function HotspotsPage() {
  const [hotspots, setHotspots] = useState<HotspotData | null>(null);
  const [forecast, setForecast] = useState<ForecastData | null>(null);
  const [selectedDistrict, setSelectedDistrict] = useState<string | null>(null);
  const [model, setModel] = useState<ModelChoice>("xgboost");
  const [horizon, setHorizon] = useState(6);
  const [isLoading, setIsLoading] = useState(true);
  const [isForecastLoading, setIsForecastLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void getHotspots()
      .then(setHotspots)
      .catch((err) => setError(getErrorMessage(err, "Unable to load hotspots.")))
      .finally(() => setIsLoading(false));
  }, []);

  const loadForecast = useCallback(async () => {
    setIsForecastLoading(true);
    try {
      const data = await getPredictions({
        district: selectedDistrict ?? undefined,
        horizon,
        model
      });
      setForecast(data);
    } catch (err) {
      setError(getErrorMessage(err, "Unable to load forecast."));
    } finally {
      setIsForecastLoading(false);
    }
  }, [selectedDistrict, horizon, model]);

  useEffect(() => {
    void loadForecast();
  }, [loadForecast]);

  const kpis = hotspots?.kpis;

  return (
    <ProtectedRoute allowedRoles={["SuperAdmin", "StateAdmin", "DistrictAdmin", "Investigator", "Analyst"]}>
      <AppShell title="Hotspot Prediction">
          <div className="px-4 py-6 sm:px-6 lg:px-8">
            <div className="mx-auto grid max-w-7xl gap-5">
              <header>
                <p className="flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-teal-400">
                  <Flame className="h-4 w-4" />
                  Predictive Intelligence
                </p>
                <h1 className="mt-1 text-3xl font-bold">Crime Hotspot Prediction</h1>
                <p className="mt-2 text-sm text-zinc-400">
                  ML-driven district risk scoring (RandomForest) and crime forecasting (XGBoost).
                </p>
              </header>

              {error ? (
                <div className="rounded-md border border-red-900 bg-red-950 px-4 py-3 text-sm text-red-200">
                  {error}
                </div>
              ) : null}

              {/* KPI cards */}
              <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <KpiCard icon={<MapPin className="h-5 w-5" />} label="Total FIRs" value={kpis?.total_firs} loading={isLoading} />
                <KpiCard icon={<AlertTriangle className="h-5 w-5" />} label="High-Risk Districts" value={kpis?.high_risk_districts} loading={isLoading} accent="red" />
                <KpiCard icon={<Flame className="h-5 w-5" />} label="Top Hotspot" text={kpis?.top_district ?? "—"} loading={isLoading} />
                <KpiCard icon={<TrendingUp className="h-5 w-5" />} label="Months Tracked" value={kpis?.months_of_data} loading={isLoading} />
              </section>

              {isLoading ? (
                <div className="flex h-80 items-center justify-center rounded-lg border border-zinc-800 text-zinc-500">
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Training risk model…
                </div>
              ) : (
                <div className="grid gap-5 xl:grid-cols-[1fr_400px]">
                  {/* Map */}
                  <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
                    <h2 className="mb-3 text-sm font-semibold text-zinc-100">
                      Karnataka Crime Risk Heatmap
                    </h2>
                    <RiskMap
                      points={hotspots?.heatmap ?? []}
                      selected={selectedDistrict}
                      onSelect={(d) => setSelectedDistrict((cur) => (cur === d ? null : d))}
                    />
                  </section>

                  {/* Risk ranking */}
                  <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
                    <h2 className="mb-3 text-sm font-semibold text-zinc-100">
                      High-Risk District Ranking
                    </h2>
                    <div className="max-h-[460px] overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead className="text-left text-xs uppercase tracking-wide text-zinc-500">
                          <tr>
                            <th className="py-2">District</th>
                            <th className="py-2 text-right">Risk</th>
                            <th className="py-2 text-right">Trend</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(hotspots?.risk_ranking ?? []).map((row) => (
                            <tr
                              key={row.district}
                              onClick={() =>
                                setSelectedDistrict((cur) => (cur === row.district ? null : row.district))
                              }
                              className={`cursor-pointer border-t border-zinc-800 ${
                                selectedDistrict === row.district ? "bg-zinc-800/60" : "hover:bg-zinc-800/30"
                              }`}
                            >
                              <td className="py-2">{row.district}</td>
                              <td className="py-2 text-right">
                                <span
                                  className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${
                                    row.risk_level === "High"
                                      ? "bg-red-950 text-red-300"
                                      : row.risk_level === "Medium"
                                        ? "bg-amber-950 text-amber-300"
                                        : "bg-emerald-950 text-emerald-300"
                                  }`}
                                >
                                  {row.risk_score}
                                </span>
                              </td>
                              <td
                                className={`py-2 text-right text-xs ${
                                  row.trend_pct > 0 ? "text-red-400" : "text-emerald-400"
                                }`}
                              >
                                {row.trend_pct > 0 ? "+" : ""}
                                {row.trend_pct}%
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                </div>
              )}

              {/* Forecast */}
              <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-sm font-semibold text-zinc-100">
                    Crime Trend Forecast
                    <span className="ml-2 text-xs font-normal text-zinc-500">
                      {selectedDistrict ? selectedDistrict : "Statewide"} ·{" "}
                      {forecast?.model ?? model}
                    </span>
                  </h2>
                  <div className="flex flex-wrap items-center gap-2">
                    {selectedDistrict ? (
                      <button
                        type="button"
                        onClick={() => setSelectedDistrict(null)}
                        className="rounded-md border border-zinc-700 px-2.5 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800"
                      >
                        Clear district
                      </button>
                    ) : null}
                    <select
                      value={model}
                      onChange={(event) => setModel(event.target.value as ModelChoice)}
                      className="h-9 rounded-md border border-zinc-700 bg-zinc-950 px-2 text-sm"
                    >
                      <option value="xgboost">XGBoost</option>
                      <option value="random_forest">Random Forest</option>
                    </select>
                    <select
                      value={horizon}
                      onChange={(event) => setHorizon(Number(event.target.value))}
                      className="h-9 rounded-md border border-zinc-700 bg-zinc-950 px-2 text-sm"
                    >
                      {[3, 6, 9, 12].map((h) => (
                        <option key={h} value={h}>{h} months</option>
                      ))}
                    </select>
                  </div>
                </div>
                {isForecastLoading ? (
                  <div className="flex h-72 items-center justify-center text-zinc-500">
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Forecasting…
                  </div>
                ) : forecast ? (
                  <ForecastChart data={forecast} />
                ) : null}
              </section>

              {/* Monthly analysis */}
              <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
                <h2 className="mb-4 text-sm font-semibold text-zinc-100">Monthly Crime Analysis</h2>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={hotspots?.monthly ?? []} margin={{ left: -10, right: 12 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#a1a1aa" }} minTickGap={20} />
                    <YAxis tick={{ fontSize: 11, fill: "#a1a1aa" }} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8, fontSize: 12 }}
                      cursor={{ fill: "rgba(255,255,255,0.04)" }}
                    />
                    <Bar dataKey="count" fill="#0d9488" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </section>
            </div>
          </div>
      </AppShell>
    </ProtectedRoute>
  );
}

function KpiCard({
  icon,
  label,
  value,
  text,
  loading,
  accent
}: {
  icon: React.ReactNode;
  label: string;
  value?: number;
  text?: string;
  loading: boolean;
  accent?: "red";
}) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-400">{label}</p>
        <span className={accent === "red" ? "text-red-400" : "text-teal-400"}>{icon}</span>
      </div>
      <p className="mt-2 text-2xl font-bold text-zinc-100">
        {loading ? "…" : text ?? value?.toLocaleString("en-IN") ?? 0}
      </p>
    </div>
  );
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof AxiosError) {
    const detail = error.response?.data?.detail;
    if (typeof detail === "string") return detail;
  }
  return fallback;
}
