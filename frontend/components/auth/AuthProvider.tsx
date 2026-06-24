"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react";
import {
  getCurrentUser,
  login as loginRequest,
  logout as logoutRequest,
  refreshSession
} from "@/services/authApi";
import {
  clearAccessToken,
  clearStoredUser,
  getAccessToken,
  getStoredUser,
  setAccessToken,
  setStoredUser
} from "@/services/tokenStorage";
import type { AuthUser, LoginPayload } from "@/types/auth";

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (payload: LoginPayload) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    let active = true;

    async function restoreSession() {
      // 1. Optimistically restore the persisted user for instant UI.
      const cached = getStoredUser<AuthUser>();
      if (cached && active) {
        setUser(cached);
      }

      try {
        // 2. If we still hold an access token, validate it against the API.
        if (getAccessToken()) {
          const current = await getCurrentUser();
          if (!active) return;
          setUser(current);
          setStoredUser(current);
          return;
        }

        // 3. No token: try to mint a fresh one from the refresh cookie.
        const session = await refreshSession();
        if (!active) return;
        setAccessToken(session.access_token);
        setUser(session.user);
        setStoredUser(session.user);
      } catch {
        // 4. Token invalid AND refresh failed: try refresh once before giving up.
        try {
          const session = await refreshSession();
          if (!active) return;
          setAccessToken(session.access_token);
          setUser(session.user);
          setStoredUser(session.user);
        } catch {
          if (!active) return;
          clearAccessToken();
          clearStoredUser();
          setUser(null);
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    void restoreSession();

    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(async (payload: LoginPayload) => {
    const session = await loginRequest(payload);
    setAccessToken(session.access_token);
    setStoredUser(session.user);
    setUser(session.user);
  }, []);

  const logout = useCallback(async () => {
    try {
      await logoutRequest();
    } finally {
      clearAccessToken();
      clearStoredUser();
      setUser(null);
      router.push("/login");
    }
  }, [router]);

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      isLoading,
      login,
      logout
    }),
    [isLoading, login, logout, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
}
