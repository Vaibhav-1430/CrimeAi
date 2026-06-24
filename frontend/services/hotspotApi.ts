import api from "@/services/api";
import type { ForecastData, HotspotData } from "@/types/hotspot";

export async function getHotspots(): Promise<HotspotData> {
  const response = await api.get<HotspotData>("/hotspots");
  return response.data;
}

export async function getPredictions(
  options: { district?: string; horizon?: number; model?: "xgboost" | "random_forest" } = {}
): Promise<ForecastData> {
  const params: Record<string, string | number> = {
    horizon: options.horizon ?? 6,
    model: options.model ?? "xgboost"
  };
  if (options.district) params.district = options.district;

  const response = await api.get<ForecastData>("/predictions", { params });
  return response.data;
}
