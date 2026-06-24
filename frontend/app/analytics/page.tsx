"use client";

import { AxiosError } from "axios";
import { motion } from "framer-motion";
import { Activity, CheckCircle2, FileText, Layers3, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import AIInsightsPanel from "@/components/ai/AIInsightsPanel";
import AnalyticsCharts from "@/components/analytics/AnalyticsCharts";
import AppShell from "@/components/shell/AppShell";
import { KpiCard } from "@/components/ui/KpiCard";
import { Skeleton } from "@/components/ui/Skeleton";
import { staggerContainer, fadeUp } from "@/lib/motion";
import { analyticsFromSummary } from "@/lib/analytics";
import { getAnalyticsSummary } from "@/services/firApi";
import type { AnalyticsSummary } from "@/types/analytics";

const KPI_META = [
  { icon: FileText, tone: "teal" as const },
  { icon: Activity, tone: "amber" as const },
  { icon: CheckCircle2, tone: "emerald" as const },
  { icon: Layers3, tone: "cyan" as const }
];

const emptySummary: AnalyticsSummary = {
  total_firs: 0,
  open_cases: 0,
  closed_cases: 0,
  crime_type_count: 0,
  district_stats: [],
  crime_type_stats: [],
  status_stats: [],
  monthly_stats: []
};

export default function AnalyticsPage() {
  const [summary, setSummary] = useState<AnalyticsSummary>(emptySummary);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const loadAnalytics = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage("");
    try {
      const data = await getAnalyticsSummary();
      setSummary(data);
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "Unable to load analytics data."));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAnalytics();
  }, [loadAnalytics]);

  const analyticsData = useMemo(() => analyticsFromSummary(summary), [summary]);

  return (
    <ProtectedRoute allowedRoles={["SuperAdmin", "StateAdmin", "DistrictAdmin", "Investigator", "Analyst"]}>
      <AppShell title="Analytics">
        <div className="p-6">
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="show"
            className="mx-auto grid max-w-[1600px] gap-5"
          >
            <motion.header variants={fadeUp} className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-400">Crime Analytics</p>
                <h2 className="mt-1 text-2xl font-bold tracking-tight text-white">Analytics Intelligence</h2>
                <p className="mt-1 max-w-2xl text-sm text-zinc-500">
                  Monitor FIR trends, compare district activity, and understand crime-type patterns.
                </p>
              </div>
              <button
                type="button"
                onClick={loadAnalytics}
                disabled={isLoading}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 text-sm font-semibold text-zinc-200 transition hover:border-teal-500/30 hover:text-teal-300 disabled:opacity-60"
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
                Refresh
              </button>
            </motion.header>

            {errorMessage ? (
              <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                {errorMessage}
              </div>
            ) : null}

            {/* KPI row */}
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {analyticsData.kpis.map((metric, index) => (
                <KpiCard
                  key={metric.label}
                  label={metric.label}
                  value={metric.value}
                  icon={(() => {
                    const Icon = KPI_META[index]?.icon ?? FileText;
                    return <Icon className="h-4 w-4" />;
                  })()}
                  tone={KPI_META[index]?.tone ?? "teal"}
                />
              ))}
            </div>

            {/* Charts */}
            {isLoading ? (
              <div className="grid gap-5 xl:grid-cols-2">
                {Array.from({ length: 4 }).map((_, index) => (
                  <Skeleton key={index} className="h-96 w-full rounded-xl" />
                ))}
              </div>
            ) : (
              <motion.div variants={fadeUp}>
                <AnalyticsCharts data={analyticsData} />
              </motion.div>
            )}

            <motion.div variants={fadeUp}>
              <AIInsightsPanel />
            </motion.div>
          </motion.div>
        </div>
      </AppShell>
    </ProtectedRoute>
  );
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof AxiosError) {
    const detail = error.response?.data?.detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail) && detail[0]?.msg) return detail[0].msg;
  }
  return fallback;
}
