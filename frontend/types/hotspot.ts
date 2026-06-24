export interface HeatmapPoint {
  district: string;
  lat: number;
  lng: number;
  risk_score: number;
  x: number; // 0-100 normalized for SVG
  y: number;
}

export type RiskLevel = "High" | "Medium" | "Low";

export interface DistrictRisk {
  district: string;
  risk_score: number;
  predicted_next_month: number;
  total_firs: number;
  recent_3m: number;
  trend_pct: number;
  risk_level: RiskLevel;
  lat: number | null;
  lng: number | null;
}

export interface MonthlyPoint {
  month: string;
  count: number;
}

export interface HotspotData {
  heatmap: HeatmapPoint[];
  risk_ranking: DistrictRisk[];
  monthly: MonthlyPoint[];
  kpis: {
    total_firs: number;
    districts_tracked: number;
    high_risk_districts: number;
    top_district: string | null;
    months_of_data: number;
  };
}

export interface ForecastPoint {
  month: string;
  count: number;
  forecast?: boolean;
}

export interface ForecastData {
  history: ForecastPoint[];
  forecast: ForecastPoint[];
  model: string;
  district: string | null;
}
