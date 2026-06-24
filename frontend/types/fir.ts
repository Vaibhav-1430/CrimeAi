export type FIRStatus =
  | "Open"
  | "Under Investigation"
  | "Chargesheet Filed"
  | "Closed";

export interface FIRPayload {
  fir_number: string;
  crime_type: string;
  description: string;
  district_id: number;
  police_station_id: number;
  incident_date: string;
  status: FIRStatus;
}

export interface FIR extends FIRPayload {
  id: number;
}

export interface PaginatedFIRs {
  items: FIR[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface FIRQuery {
  page?: number;
  page_size?: number;
  search?: string;
  status_filter?: string;
  district_id?: number;
  crime_type?: string;
}

export interface District {
  id: number;
  name: string;
}

export interface PoliceStation {
  id: number;
  name: string;
  district_id: number;
}

export type StatusFilterValue = "All" | FIRStatus;

export const firStatusOptions: FIRStatus[] = [
  "Open",
  "Under Investigation",
  "Chargesheet Filed",
  "Closed"
];
