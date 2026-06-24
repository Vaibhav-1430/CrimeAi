export type NetworkNodeType = "fir" | "suspect" | "witness" | "evidence" | "station";

export interface NetworkNode {
  id: string;
  type: NetworkNodeType;
  label: string;
  meta: Record<string, unknown>;
}

export interface NetworkEdge {
  id: string;
  source: string;
  target: string;
  type: string;
}

export interface RepeatOffender {
  suspect_id: number;
  name: string;
  alias: string | null;
  fir_count_in_scope: number;
  fir_count_total: number;
}

export interface MostConnected {
  suspect_id: number;
  name: string;
  connections: number;
}

export interface CrimeGroup {
  size: number;
  members: { suspect_id: number; name: string }[];
}

export interface NetworkGraph {
  nodes: NetworkNode[];
  edges: NetworkEdge[];
  stats: Record<string, number>;
  repeat_offenders: RepeatOffender[];
  most_connected: MostConnected[];
  crime_groups: CrimeGroup[];
}

export interface NetworkFilters {
  crime_type?: string;
  status_filter?: string;
  district_id?: number;
  suspect_id?: number;
  fir_id?: number;
  include_witness_evidence?: boolean;
}

export interface SuspectSearchResult {
  id: number;
  name: string;
  alias: string | null;
}
