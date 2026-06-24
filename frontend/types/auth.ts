export type UserRole =
  | "SuperAdmin"
  | "StateAdmin"
  | "DistrictAdmin"
  | "StationOfficer"
  | "Investigator"
  | "Analyst";

export type UserStatus = "Pending" | "Approved" | "Rejected" | "Suspended";

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  employee_id?: string | null;
  mobile_number?: string | null;
  rank?: string | null;
  role: UserRole;
  role_id?: number | null;
  district_id?: number | null;
  station_id?: number | null;
  status: UserStatus;
  created_at?: string | null;
}

export interface AuthResponse {
  access_token: string;
  token_type: "bearer";
  user: AuthUser;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface OfficerSignupPayload {
  name: string;
  email: string;
  employee_id: string;
  mobile_number: string;
  rank: string;
  district_id: number;
  station_id: number;
  password: string;
  confirm_password: string;
}

export interface OfficerSignupResponse {
  message: string;
  status: UserStatus;
}

export interface Role {
  id: number;
  name: UserRole;
}
