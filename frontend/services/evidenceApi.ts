import api, { API_BASE_URL } from "@/services/api";
import { getAccessToken } from "@/services/tokenStorage";
import type {
  Evidence,
  EvidenceCount,
  EvidenceFilters
} from "@/types/case";

export interface UploadOptions {
  description?: string;
  /** 0-100 progress callback for the whole batch. */
  onProgress?: (percent: number) => void;
}

/** Upload one or more evidence files for an FIR (type auto-classified server-side). */
export async function uploadEvidence(
  firId: number,
  files: File[],
  options: UploadOptions = {}
): Promise<Evidence[]> {
  const formData = new FormData();
  formData.append("media_type", "auto");
  if (options.description) {
    formData.append("description", options.description);
  }
  files.forEach((file) => formData.append("files", file));

  const response = await api.post<Evidence[]>(`/firs/${firId}/evidence`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
    onUploadProgress: (event) => {
      if (options.onProgress && event.total) {
        options.onProgress(Math.round((event.loaded / event.total) * 100));
      }
    }
  });

  return response.data;
}

/** List evidence for an FIR with optional search / type / date-range filters. */
export async function listEvidence(
  firId: number,
  filters: EvidenceFilters = {}
): Promise<Evidence[]> {
  const params: Record<string, string> = {};
  if (filters.search) params.search = filters.search;
  if (filters.media_type && filters.media_type !== "all") {
    params.media_type = filters.media_type;
  }
  if (filters.date_from) params.date_from = filters.date_from;
  if (filters.date_to) params.date_to = filters.date_to;

  const response = await api.get<Evidence[]>(`/firs/${firId}/evidence`, { params });
  return response.data;
}

/** Evidence count + per-type breakdown for an FIR. */
export async function getEvidenceCount(firId: number): Promise<EvidenceCount> {
  const response = await api.get<EvidenceCount>(`/firs/${firId}/evidence/count`);
  return response.data;
}

/** Delete an evidence record (and its underlying file). */
export async function deleteEvidence(evidenceId: number): Promise<void> {
  await api.delete(`/evidence/${evidenceId}`);
}

/** Absolute URL to stream/preview an evidence file inline. */
export function evidenceFileUrl(evidence: Evidence): string {
  return evidence.file_url ? `${API_BASE_URL}${evidence.file_url}` : "";
}

/**
 * Download an evidence file as an attachment. Uses fetch with the auth header so
 * the protected /download endpoint receives the bearer token, then triggers a
 * browser save via an object URL.
 */
export async function downloadEvidence(evidence: Evidence): Promise<void> {
  const token = getAccessToken();
  const response = await fetch(`${API_BASE_URL}/evidence/${evidence.id}/download`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    credentials: "include"
  });

  if (!response.ok) {
    throw new Error("Unable to download evidence file.");
  }

  const blob = await response.blob();
  const objectUrl = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = evidence.file_name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(objectUrl);
}
