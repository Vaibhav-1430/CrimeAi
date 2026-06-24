import type { FIR } from "@/types/fir";

export type EvidenceMediaType = "image" | "video" | "pdf" | "audio" | "document";

export interface Evidence {
  id: number;
  fir_id: number;
  file_name: string;
  file_type: string;
  media_type: EvidenceMediaType;
  file_path: string;
  file_url: string | null;
  file_size: number | null;
  description: string | null;
  uploaded_by: number | null;
  created_at: string;
}

export interface EvidenceCount {
  fir_id: number;
  total: number;
  by_type: Partial<Record<EvidenceMediaType, number>>;
}

export interface EvidenceFilters {
  search?: string;
  media_type?: EvidenceMediaType | "all";
  date_from?: string;
  date_to?: string;
}

export interface WitnessPayload {
  name: string;
  contact_number: string;
  statement: string;
  address: string;
}

export interface Witness extends WitnessPayload {
  id: number;
  fir_id: number;
  created_at: string;
  updated_at: string;
}

export interface SuspectPayload {
  name: string;
  alias: string;
  age: string;
  notes: string;
}

export interface Suspect {
  id: number;
  name: string;
  alias: string | null;
  age: number | null;
  notes: string | null;
  created_at: string;
}

export interface AuditLog {
  id: number;
  fir_id: number;
  action: string;
  entity_type: string;
  entity_id: number | null;
  description: string;
  performed_by: number | null;
  created_at: string;
}

export interface FIRCaseDetail {
  fir: FIR;
  evidence: Evidence[];
  witnesses: Witness[];
  suspects: Suspect[];
  audit_logs: AuditLog[];
}
