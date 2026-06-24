import api from "@/services/api";
import type {
  FIRCaseDetail,
  Suspect,
  SuspectPayload,
  Witness,
  WitnessPayload
} from "@/types/case";

export async function getCaseDetail(firId: number): Promise<FIRCaseDetail> {
  const response = await api.get<FIRCaseDetail>(`/firs/${firId}/case`);
  return response.data;
}

export async function addWitness(
  firId: number,
  payload: WitnessPayload
): Promise<Witness> {
  const response = await api.post<Witness>(`/firs/${firId}/witnesses`, payload);
  return response.data;
}

export async function updateWitness(
  firId: number,
  witnessId: number,
  payload: WitnessPayload
): Promise<Witness> {
  const response = await api.put<Witness>(`/firs/${firId}/witnesses/${witnessId}`, payload);
  return response.data;
}

export async function addSuspect(
  firId: number,
  payload: SuspectPayload
): Promise<Suspect> {
  const response = await api.post<Suspect>(`/firs/${firId}/suspects`, {
    ...payload,
    age: payload.age ? Number(payload.age) : null,
    alias: payload.alias || null,
    notes: payload.notes || null
  });
  return response.data;
}

export async function getSuspects(): Promise<Suspect[]> {
  const response = await api.get<Suspect[]>("/suspects");
  return response.data;
}

export async function linkSuspectToFir(firId: number, suspectId: number): Promise<Suspect> {
  const response = await api.post<Suspect>(`/firs/${firId}/suspects/${suspectId}`);
  return response.data;
}
