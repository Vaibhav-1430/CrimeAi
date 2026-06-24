import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";
import { clearAccessToken, getAccessToken, setAccessToken } from "@/services/tokenStorage";
import type { AuthResponse } from "@/types/auth";

// Use the same hostname the browser loaded the app from so the httpOnly
// refresh cookie is same-origin (localhost page -> 127.0.0.1 API would make
// the cookie cross-site and silently break session refresh). Override with
// NEXT_PUBLIC_API_BASE_URL when the API lives elsewhere.
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true
});

// Requests that must NOT carry an Authorization header (auth + public reads).
const publicPaths = [
  "/auth/login",
  "/login",
  "/signup",
  "/auth/refresh",
  "/public/districts",
  "/public/police-stations"
];

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getAccessToken();

  if (token && config.headers && !publicPaths.includes(config.url ?? "")) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as
      | (InternalAxiosRequestConfig & { _retry?: boolean })
      | undefined;

    const isAuthEndpoint =
      originalRequest &&
      publicPaths.includes(originalRequest.url ?? "");

    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !isAuthEndpoint
    ) {
      originalRequest._retry = true;

      try {
        const refreshResponse = await axios.post<AuthResponse>(
          `${API_BASE_URL}/auth/refresh`,
          {},
          { withCredentials: true }
        );

        setAccessToken(refreshResponse.data.access_token);
        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${refreshResponse.data.access_token}`;
        }
        return api(originalRequest);
      } catch {
        clearAccessToken();
      }
    }

    return Promise.reject(error);
  }
);

export default api;
