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

export interface AnalyticsSummary {
  total_firs: number;
  open_cases: number;
  closed_cases: number;
  crime_type_count: number;
  district_stats: NamedCount[];
  crime_type_stats: NamedCount[];
  status_stats: NamedCount[];
  monthly_stats: MonthlyStat[];
}
