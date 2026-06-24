"use client";

import { LogOut } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";

export default function Navbar() {
  const { user, logout } = useAuth();

  return (
    <header className="flex min-h-16 items-center justify-between border-b border-zinc-200 bg-white px-6 dark:border-zinc-800 dark:bg-zinc-950">
      <div>
        <h2 className="text-base font-semibold text-zinc-950 dark:text-zinc-50">
          Karnataka Crime Intelligence System
        </h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {user?.email}
        </p>
      </div>
      <button
        type="button"
        onClick={() => void logout()}
        className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-zinc-300 px-3 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
      >
        <LogOut className="h-4 w-4" />
        Logout
      </button>
    </header>
  );
}
