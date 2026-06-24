"use client";

import { Loader2 } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect } from "react";
import { canAccessRole } from "@/lib/rbac";
import type { UserRole } from "@/types/auth";
import { useAuth } from "@/components/auth/AuthProvider";

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles?: UserRole[];
}

export default function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
    }
  }, [isAuthenticated, isLoading, pathname, router]);

  if (isLoading || !isAuthenticated) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-50 text-zinc-600 dark:bg-zinc-950 dark:text-zinc-300">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Checking access
      </main>
    );
  }

  if (!canAccessRole(user?.role, allowedRoles)) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 text-center dark:bg-zinc-950">
        <div>
          <h1 className="text-2xl font-bold text-zinc-950 dark:text-zinc-50">
            Access denied
          </h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Your role does not have permission to view this page.
          </p>
        </div>
      </main>
    );
  }

  return children;
}
