import type { AnalyticsSummary } from "@/types/analytics";
import type { District, FIR } from "@/types/fir";

export interface KpiMetric {
  label: string;
  value: number;
  helper: string;
}

export interface NamedCount {
  name: string;
  count: number;
}

export interface MonthlyStat {
  month: string;
  total: number;
  open: number;
  closed: number;
}

export interface AnalyticsData {
  kpis: KpiMetric[];
  monthlyStats: MonthlyStat[];
  districtStats: NamedCount[];
  crimeTypeStats: NamedCount[];
  statusStats: NamedCount[];
  recentTrend: MonthlyStat[];
}

/**
 * Adapt the server-side analytics summary (computed in SQL) into the shape the
 * charts already consume. This replaces the old approach of fetching all 100k
 * FIRs and aggregating them in the browser.
 */
export function analyticsFromSummary(summary: AnalyticsSummary): AnalyticsData {
  const monthlyStats: MonthlyStat[] = summary.monthly_stats.map((stat) => ({
    month: formatMonthLabel(stat.month),
    total: stat.total,
    open: stat.open,
    closed: stat.closed
  }));

  return {
    kpis: [
      { label: "Total FIRs", value: summary.total_firs, helper: "Registered records" },
      {
        label: "Open Cases",
        value: summary.open_cases,
        helper: percentageLabel(summary.open_cases, summary.total_firs)
      },
      {
        label: "Closed Cases",
        value: summary.closed_cases,
        helper: percentageLabel(summary.closed_cases, summary.total_firs)
      },
      { label: "Crime Types", value: summary.crime_type_count, helper: "Distinct categories" }
    ],
    monthlyStats,
    districtStats: summary.district_stats,
    crimeTypeStats: summary.crime_type_stats,
    statusStats: summary.status_stats,
    recentTrend: monthlyStats.slice(-6)
  };
}

function formatMonthLabel(yyyymm: string): string {
  const [year, month] = yyyymm.split("-").map(Number);
  if (!year || !month) {
    return yyyymm;
  }
  return new Date(year, month - 1, 1).toLocaleDateString("en-IN", {
    month: "short",
    year: "numeric"
  });
}

export function buildAnalyticsData(firs: FIR[], districts: District[]): AnalyticsData {
  const districtNames = new Map(districts.map((district) => [district.id, district.name]));
  const totalFirs = firs.length;
  const openCases = firs.filter((fir) => fir.status !== "Closed").length;
  const closedCases = firs.filter((fir) => fir.status === "Closed").length;
  const uniqueCrimeTypes = new Set(firs.map((fir) => fir.crime_type.trim()).filter(Boolean));

  const districtStats = sortByCount(
    Array.from(countBy(firs, (fir) => districtNames.get(fir.district_id) ?? `District #${fir.district_id}`))
  );

  const crimeTypeStats = sortByCount(
    Array.from(countBy(firs, (fir) => fir.crime_type || "Unspecified"))
  );

  const monthlyStats = buildMonthlyStats(firs);

  return {
    kpis: [
      {
        label: "Total FIRs",
        value: totalFirs,
        helper: "Registered records"
      },
      {
        label: "Open Cases",
        value: openCases,
        helper: percentageLabel(openCases, totalFirs)
      },
      {
        label: "Closed Cases",
        value: closedCases,
        helper: percentageLabel(closedCases, totalFirs)
      },
      {
        label: "Crime Types",
        value: uniqueCrimeTypes.size,
        helper: "Distinct categories"
      }
    ],
    monthlyStats,
    districtStats,
    crimeTypeStats,
    statusStats: sortByCount(Array.from(countBy(firs, (fir) => fir.status))),
    recentTrend: monthlyStats.slice(-6)
  };
}

function countBy<T>(items: T[], getName: (item: T) => string) {
  const counts = new Map<string, number>();

  items.forEach((item) => {
    const name = getName(item).trim() || "Unspecified";
    counts.set(name, (counts.get(name) ?? 0) + 1);
  });

  return counts.entries();
}

function sortByCount(items: [string, number][]): NamedCount[] {
  return items
    .map(([name, count]) => ({ name, count }))
    .sort((first, second) => second.count - first.count || first.name.localeCompare(second.name));
}

function buildMonthlyStats(firs: FIR[]): MonthlyStat[] {
  const monthMap = new Map<string, MonthlyStat>();

  firs.forEach((fir) => {
    const date = new Date(fir.incident_date);

    if (Number.isNaN(date.getTime())) {
      return;
    }

    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const label = date.toLocaleDateString("en-IN", {
      month: "short",
      year: "numeric"
    });
    const current = monthMap.get(key) ?? {
      month: label,
      total: 0,
      open: 0,
      closed: 0
    };

    current.total += 1;

    if (fir.status !== "Closed") {
      current.open += 1;
    }

    if (fir.status === "Closed") {
      current.closed += 1;
    }

    monthMap.set(key, current);
  });

  return Array.from(monthMap.entries())
    .sort(([first], [second]) => first.localeCompare(second))
    .map(([, value]) => value);
}

function percentageLabel(value: number, total: number) {
  if (total === 0) {
    return "0% of FIRs";
  }

  return `${Math.round((value / total) * 100)}% of FIRs`;
}
