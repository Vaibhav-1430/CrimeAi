"use client";

import { Activity, Loader2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { hasPermission } from "@/lib/rbac";
import { getRecentAuditLogs } from "@/services/auditApi";
import type { AuditLogEntry } from "@/types/audit";

/** Dashboard widget showing the latest audit activity. Admin-only. */
export default function RecentActivities() {
  const { user } = useAuth();
  const canView = hasPermission(user?.role, "audit:view");

  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!canView) {
      setIsLoading(false);
      return;
    }
    let active = true;
    getRecentAuditLogs(8)
      .then((data) => {
        if (active) setLogs(data);
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [canView]);

  if (!canView) {
    return null;
  }

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-teal-600 dark:text-teal-400" />
          <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-100">
            Recent Activities
          </h2>
        </div>
        <Link
          href="/audit-logs"
          className="text-sm font-medium text-teal-700 hover:underline dark:text-teal-400"
        >
          View all
        </Link>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8 text-zinc-500">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Loading activity
        </div>
      ) : logs.length ? (
        <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {logs.map((log) => (
            <li key={log.id} className="flex items-start gap-3 py-3">
              <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-teal-500" />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-zinc-800 dark:text-zinc-200">
                  <span className="font-medium">{log.user_name ?? "System"}</span>{" "}
                  <span className="text-zinc-500">·</span> {log.action}
                </p>
                <p className="truncate text-xs text-zinc-500">{log.description}</p>
              </div>
              <span className="shrink-0 whitespace-nowrap text-xs text-zinc-400">
                {formatRelative(log.created_at)}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="py-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
          No recent activity.
        </p>
      )}
    </section>
  );
}

function formatRelative(value: string): string {
  const date = new Date(value);
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}
