"use client";

import { motion } from "framer-motion";
import {
  Activity,
  Building2,
  FileText,
  FolderOpen,
  ShieldCheck,
  Users
} from "lucide-react";
import { useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import AppShell from "@/components/shell/AppShell";
import { GlassCard } from "@/components/ui/GlassCard";
import { KpiCard } from "@/components/ui/KpiCard";
import { RiskBadge, riskLevelFromScore } from "@/components/ui/RiskBadge";
import { SkeletonCard, Skeleton } from "@/components/ui/Skeleton";
import { staggerContainer, fadeUp } from "@/lib/motion";
import api from "@/services/api";
import { getAnalyticsSummary } from "@/services/firApi";
import { getRecentAuditLogs } from "@/services/auditApi";
import type { AnalyticsSummary } from "@/types/analytics";
import type { AuditLogEntry } from "@/types/audit";

interface Stats {
  total_firs: number;
  open_cases: number;
  closed_cases: number;
  districts: number;
  police_stations: number;
  users: number;
}

const CHART_TOOLTIP = {
  contentStyle: { background: "#0e1117", border: "1px solid #1e2530", borderRadius: 10, fontSize: 12 },
  labelStyle: { color: "#e6edf3" }
};

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [activity, setActivity] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const [statsRes, summaryRes, activityRes] = await Promise.allSettled([
          api.get<Stats>("/dashboard/stats"),
          getAnalyticsSummary(),
          getRecentAuditLogs(10)
        ]);
        if (!active) return;
        if (statsRes.status === "fulfilled") setStats(statsRes.value.data);
        if (summaryRes.status === "fulfilled") setSummary(summaryRes.value);
        if (activityRes.status === "fulfilled") setActivity(activityRes.value);
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, []);

  const resolutionRate = stats && stats.total_firs
    ? Math.round((stats.closed_cases / stats.total_firs) * 100)
    : 0;

  const trend = (summary?.monthly_stats ?? []).map((m) => ({
    month: m.month,
    total: m.total,
    open: m.open
  }));

  // District ranking by FIR volume → synthetic risk score for the badge.
  const maxDistrict = summary?.district_stats?.[0]?.count ?? 1;
  const districts = (summary?.district_stats ?? []).slice(0, 8).map((d) => ({
    name: d.name,
    count: d.count,
    score: Math.round((d.count / maxDistrict) * 100)
  }));

  return (
    <ProtectedRoute allowedRoles={["SuperAdmin", "StateAdmin", "DistrictAdmin", "StationOfficer", "Investigator", "Analyst"]}>
      <AppShell title="Command Center">
        <div className="p-6">
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="show"
            className="mx-auto grid max-w-[1600px] gap-5"
          >
            {/* Header */}
            <motion.div variants={fadeUp} className="flex items-end justify-between">
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-white">
                  Executive Intelligence Overview
                </h2>
                <p className="mt-1 text-sm text-zinc-500">
                  Statewide crime posture, casework load, and live operational activity.
                </p>
              </div>
            </motion.div>

            {/* KPI row */}
            {loading ? (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <KpiCard label="Total FIRs" value={stats?.total_firs ?? 0} icon={<FileText className="h-4 w-4" />} tone="teal" delta={4} />
                <KpiCard label="Open Cases" value={stats?.open_cases ?? 0} icon={<FolderOpen className="h-4 w-4" />} tone="amber" delta={-2} />
                <KpiCard label="Resolution Rate" value={resolutionRate} suffix="%" icon={<ShieldCheck className="h-4 w-4" />} tone="emerald" delta={3} />
                <KpiCard label="Active Officers" value={stats?.users ?? 0} icon={<Users className="h-4 w-4" />} tone="cyan" />
              </div>
            )}

            {/* Main grid: trend + district ranking */}
            <div className="grid gap-5 xl:grid-cols-3">
              {/* Crime trend */}
              <GlassCard animate className="xl:col-span-2 p-5">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-zinc-100">Crime Trend</h3>
                    <p className="text-xs text-zinc-500">Monthly FIR volume · open vs total</p>
                  </div>
                  <Activity className="h-4 w-4 text-teal-400" />
                </div>
                {loading ? (
                  <Skeleton className="h-64 w-full" />
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <AreaChart data={trend} margin={{ left: -16, right: 8, top: 8 }}>
                      <defs>
                        <linearGradient id="gTotal" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#2dd4bf" stopOpacity={0.4} />
                          <stop offset="100%" stopColor="#2dd4bf" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="gOpen" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.25} />
                          <stop offset="100%" stopColor="#22d3ee" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e2530" vertical={false} />
                      <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#5a6675" }} tickLine={false} axisLine={false} minTickGap={24} />
                      <YAxis tick={{ fontSize: 10, fill: "#5a6675" }} tickLine={false} axisLine={false} />
                      <Tooltip {...CHART_TOOLTIP} />
                      <Area type="monotone" dataKey="total" stroke="#2dd4bf" strokeWidth={2} fill="url(#gTotal)" />
                      <Area type="monotone" dataKey="open" stroke="#22d3ee" strokeWidth={2} fill="url(#gOpen)" />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </GlassCard>

              {/* District ranking */}
              <GlassCard animate className="p-5">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-zinc-100">High-Risk Districts</h3>
                  <Building2 className="h-4 w-4 text-teal-400" />
                </div>
                {loading ? (
                  <div className="grid gap-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
                ) : (
                  <div className="grid gap-2.5">
                    {districts.map((d, i) => (
                      <div key={d.name} className="flex items-center gap-3">
                        <span className="w-4 font-mono text-xs text-zinc-600">{i + 1}</span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between">
                            <span className="truncate text-sm text-zinc-300">{d.name}</span>
                            <span className="font-mono text-xs text-zinc-500">{d.count.toLocaleString("en-IN")}</span>
                          </div>
                          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/5">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${d.score}%` }}
                              transition={{ duration: 0.8, delay: i * 0.05, ease: [0.16, 1, 0.3, 1] }}
                              className="h-full rounded-full bg-gradient-to-r from-teal-500 to-cyan-400"
                            />
                          </div>
                        </div>
                        <RiskBadge level={riskLevelFromScore(d.score)} />
                      </div>
                    ))}
                  </div>
                )}
              </GlassCard>
            </div>

            {/* Activity feed + crime mix */}
            <div className="grid gap-5 xl:grid-cols-3">
              {/* Live activity feed */}
              <GlassCard animate className="xl:col-span-2 p-5">
                <div className="mb-4 flex items-center gap-2">
                  <span className="live-dot h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  <h3 className="text-sm font-semibold text-zinc-100">Live Activity Feed</h3>
                </div>
                {loading ? (
                  <div className="grid gap-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
                ) : activity.length ? (
                  <div className="grid gap-1">
                    {activity.map((log) => (
                      <div key={log.id} className="flex items-start gap-3 rounded-lg px-2 py-2 transition hover:bg-white/5">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-teal-400" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-zinc-300">
                            <span className="font-medium text-zinc-100">{log.user_name ?? "System"}</span>{" "}
                            <span className="text-zinc-600">·</span> {log.action}
                          </p>
                          <p className="truncate text-xs text-zinc-600">{log.description}</p>
                        </div>
                        <span className="shrink-0 font-mono text-[10px] text-zinc-600">
                          {new Date(log.created_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="py-8 text-center text-sm text-zinc-600">No recent activity.</p>
                )}
              </GlassCard>

              {/* Crime mix */}
              <GlassCard animate className="p-5">
                <h3 className="mb-4 text-sm font-semibold text-zinc-100">Crime Type Mix</h3>
                {loading ? (
                  <div className="grid gap-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-7 w-full" />)}</div>
                ) : (
                  <div className="grid gap-2.5">
                    {(summary?.crime_type_stats ?? []).slice(0, 7).map((c, i) => {
                      const max = summary?.crime_type_stats?.[0]?.count ?? 1;
                      return (
                        <div key={c.name}>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-zinc-400">{c.name}</span>
                            <span className="font-mono text-zinc-500">{c.count.toLocaleString("en-IN")}</span>
                          </div>
                          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/5">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${(c.count / max) * 100}%` }}
                              transition={{ duration: 0.8, delay: i * 0.04 }}
                              className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-teal-400"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </GlassCard>
            </div>
          </motion.div>
        </div>
      </AppShell>
    </ProtectedRoute>
  );
}
