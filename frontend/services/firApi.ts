import api from "@/services/api";
import type { AnalyticsSummary } from "@/types/analytics";
import type {
  District,
  FIR,
  FIRPayload,
  FIRQuery,
  PaginatedFIRs,
  PoliceStation
} from "@/types/fir";

export async function getFirs(query: FIRQuery = {}): Promise<PaginatedFIRs> {
  const params = {
    page: query.page ?? 1,
    page_size: query.page_size ?? 25,
    ...(query.search ? { search: query.search } : {}),
    ...(query.status_filter && query.status_filter !== "All"
      ? { status_filter: query.status_filter }
      : {}),
    ...(query.district_id ? { district_id: query.district_id } : {}),
    ...(query.crime_type ? { crime_type: query.crime_type } : {})
  };

  const response = await api.get<PaginatedFIRs>("/firs", { params });
  return response.data;
}

export async function getAnalyticsSummary(): Promise<AnalyticsSummary> {
  const response = await api.get<AnalyticsSummary>("/analytics/summary");
  return response.data;
}

export async function createFir(payload: FIRPayload): Promise<void> {
  await api.post("/firs", payload);
}

export async function updateFir(id: number, payload: FIRPayload): Promise<void> {
  await api.put(`/firs/${id}`, payload);
}

export async function deleteFir(id: number): Promise<void> {
  await api.delete(`/firs/${id}`);
}

export async function updateFirStatus(id: number, status: FIRPayload["status"]): Promise<void> {
  await api.patch(`/firs/${id}/status`, { status });
}

export async function getDistricts(): Promise<District[]> {
  const response = await api.get<District[]>("/districts");
  return response.data;
}

export async function getPoliceStations(): Promise<PoliceStation[]> {
  const response = await api.get<PoliceStation[]>("/police-stations");
  return response.data;
}
