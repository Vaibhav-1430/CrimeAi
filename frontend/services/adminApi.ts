import api from "@/services/api";
import type { AuthUser, Role, UserStatus } from "@/types/auth";

export interface ApprovalRequest {
  id: number;
  user_id: number;
  status: UserStatus;
  requested_role_id: number | null;
  requested_district_id: number | null;
  requested_station_id: number | null;
  reviewed_by: number | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  user: AuthUser;
}

export interface UserFilters {
  search?: string;
  role_id?: string;
  district_id?: string;
  station_id?: string;
  status_filter?: string;
}

export interface UserUpdatePayload {
  name: string;
  email: string;
  employee_id: string;
  mobile_number: string;
  rank: string;
  role_id: number;
  district_id: number | null;
  station_id: number | null;
  status: UserStatus;
}

export async function getRoles(): Promise<Role[]> {
  const response = await api.get<Role[]>("/roles");
  return response.data;
}

export async function getApprovals(): Promise<ApprovalRequest[]> {
  const response = await api.get<ApprovalRequest[]>("/admin/approvals");
  return response.data;
}

export async function approveOfficer(
  approvalId: number,
  payload: { role_id: number; district_id: number; station_id: number }
): Promise<AuthUser> {
  const response = await api.post<AuthUser>(`/admin/approvals/${approvalId}/approve`, payload);
  return response.data;
}

export async function rejectOfficer(approvalId: number, reason: string): Promise<AuthUser> {
  const response = await api.post<AuthUser>(`/admin/approvals/${approvalId}/reject`, { reason });
  return response.data;
}

export async function getAdminUsers(filters: UserFilters): Promise<AuthUser[]> {
  const response = await api.get<AuthUser[]>("/admin/users", { params: filters });
  return response.data;
}

export async function updateAdminUser(userId: number, payload: UserUpdatePayload): Promise<AuthUser> {
  const response = await api.put<AuthUser>(`/admin/users/${userId}`, payload);
  return response.data;
}

export async function suspendUser(userId: number): Promise<AuthUser> {
  const response = await api.post<AuthUser>(`/admin/users/${userId}/suspend`);
  return response.data;
}

export async function reactivateUser(userId: number): Promise<AuthUser> {
  const response = await api.post<AuthUser>(`/admin/users/${userId}/reactivate`);
  return response.data;
}

export async function resetUserPassword(userId: number, password: string): Promise<void> {
  await api.post(`/admin/users/${userId}/reset-password`, { password });
}

export async function changeUserRole(userId: number, roleId: number): Promise<AuthUser> {
  const response = await api.post<AuthUser>(`/admin/users/${userId}/change-role`, {
    role_id: roleId
  });
  return response.data;
}
