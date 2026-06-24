import api from "@/services/api";
import type {
  NetworkFilters,
  NetworkGraph,
  SuspectSearchResult
} from "@/types/network";

export async function getNetworkGraph(filters: NetworkFilters = {}): Promise<NetworkGraph> {
  const params: Record<string, string | number | boolean> = {};
  if (filters.crime_type) params.crime_type = filters.crime_type;
  if (filters.status_filter) params.status_filter = filters.status_filter;
  if (filters.district_id) params.district_id = filters.district_id;
  if (filters.suspect_id) params.suspect_id = filters.suspect_id;
  if (filters.fir_id) params.fir_id = filters.fir_id;
  if (filters.include_witness_evidence !== undefined) {
    params.include_witness_evidence = filters.include_witness_evidence;
  }

  const response = await api.get<NetworkGraph>("/network-analysis", { params });
  return response.data;
}

export async function searchNetworkSuspects(query: string): Promise<SuspectSearchResult[]> {
  const response = await api.get<SuspectSearchResult[]>("/network-analysis/suspects", {
    params: { q: query }
  });
  return response.data;
}
