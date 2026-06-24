import api from "@/services/api";
import type { SociologyData } from "@/types/sociology";

export async function getSociology(): Promise<SociologyData> {
  const response = await api.get<SociologyData>("/sociology");
  return response.data;
}
