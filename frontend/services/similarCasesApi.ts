import api from "@/services/api";
import type { SimilarCasesResult } from "@/types/similar";

export async function getSimilarCases(
  firId: number,
  limit = 10
): Promise<SimilarCasesResult> {
  const response = await api.get<SimilarCasesResult>(`/similar-cases/${firId}`, {
    params: { limit }
  });
  return response.data;
}
