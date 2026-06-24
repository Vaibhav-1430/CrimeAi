import api from "@/services/api";
import type {
  AuthResponse,
  AuthUser,
  LoginPayload,
  OfficerSignupPayload,
  OfficerSignupResponse
} from "@/types/auth";

export async function login(payload: LoginPayload): Promise<AuthResponse> {
  const response = await api.post<AuthResponse>("/auth/login", payload);
  return response.data;
}

export async function signup(payload: OfficerSignupPayload): Promise<OfficerSignupResponse> {
  const response = await api.post<OfficerSignupResponse>("/signup", payload);
  return response.data;
}

export async function refreshSession(): Promise<AuthResponse> {
  const response = await api.post<AuthResponse>("/auth/refresh", {});
  return response.data;
}

export async function logout(): Promise<void> {
  await api.post("/auth/logout");
}

export async function getCurrentUser(): Promise<AuthUser> {
  const response = await api.get<AuthUser>("/auth/me");
  return response.data;
}
