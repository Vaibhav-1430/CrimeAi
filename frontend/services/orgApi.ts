import api from "@/services/api";
import type { District, PoliceStation } from "@/types/fir";

export async function getPublicDistricts(): Promise<District[]> {
  const response = await api.get<District[]>("/public/districts");
  return response.data;
}

export async function getPublicPoliceStations(): Promise<PoliceStation[]> {
  const response = await api.get<PoliceStation[]>("/public/police-stations");
  return response.data;
}
