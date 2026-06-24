"use client";

import { AxiosError } from "axios";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import AppShell from "@/components/shell/AppShell";
import { TableSkeleton } from "@/components/Skeleton";
import { exportAuditCsv, exportAuditPdf } from "@/lib/auditExport";
import {
  getAllAuditLogsForExport,
  getAuditFilterOptions,
  getAuditLogs
} from "@/services/auditApi";
import type { AuditFilterOptions, AuditLogEntry } from "@/types/audit";

const PAGE_SIZE = 25;

interface Filters {
  search: string;
  role: string;
  action: string;
  entity_type: string;
  date_from: string;
  date_to: string;
}

const emptyFilters: Filters = {
  search: "",
  role: "",
  action: "",
  entity_type: "",
  date_from: "",
  date_to: ""
};

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [options, setOptions] = useState<AuditFilterOptions>({
    actions: [],
    entity_types: [],
    roles: []
  });
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const loadLogs = useCallback(
    async (targetPage: number, activeFilters: Filters) => {
      setIsLoading(true);
      setErrorMessage("");
      try {
        const result = await getAuditLogs({
          page: targetPage,
          page_size: PAGE_SIZE,
          search: activeFilters.search.trim() || undefined,
          role: activeFilters.role || undefined,
          action: activeFilters.action || undefined,
          entity_type: activeFilters.entity_type || undefined,
          date_from: activeFilters.date_from || undefined,
          date_to: activeFilters.date_to || undefined
        });
        setLogs(result.items);
        setTotal(result.total);
        setTotalPages(result.total_pages);
        setPage(result.page);
      } catch (error) {
        setErrorMessage(getErrorMessage(error, "Unable to load audit logs."));
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    void getAuditFilterOptions()
      .then(setOptions)
      .catch(() => undefined);
  }, []);

  // Debounce filter changes; reset to page 1.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadLogs(1, filters);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [loadLogs, filters]);

  const goToPage = (targetPage: number) => {
    const clamped = Math.min(Math.max(targetPage, 1), Math.max(totalPages, 1));
    void loadLogs(clamped, filters);
  };

  const handleExport = async (format: "csv" | "pdf") => {
    setIsExporting(true);
    setErrorMessage("");
    try {
      const rows = await getAllAuditLogsForExport({
        search: filters.search.trim() || undefined,
        role: filters.role || undefined,
        action: filters.action || undefined,
        entity_type: filters.entity_type || undefined,
        date_from: filters.date_from || undefined,
        date_to: filters.date_to || undefined
      });
      if (format === "csv") {
        exportAuditCsv(rows);
      } else {
        exportAuditPdf(rows);
      }
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "Unable to export audit logs."));
    } finally {
      setIsExporting(false);
    }
  };

  const update = (patch: Partial<Filters>) => setFilters((current) => ({ ...current, ...patch }));

  return (
    <ProtectedRoute allowedRoles={["SuperAdmin", "StateAdmin", "DistrictAdmin"]}>
      <AppShell title="Audit Logs">
          <div className="px-4 py-6 sm:px-6 lg:px-8">
            <div className="mx-auto grid max-w-7xl gap-6">
              <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div>
                  <p className="flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-teal-700 dark:text-teal-400">
                    <ShieldCheck className="h-4 w-4" />
                    Security
                  </p>
                  <h1 className="mt-1 text-3xl font-bold">Audit Logs</h1>
                  <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                    Immutable, read-only record of every action across CrimeAI.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void handleExport("csv")}
                    disabled={isExporting || total === 0}
                    className="inline-flex h-10 items-center gap-2 rounded-md border border-zinc-300 bg-white px-3 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                  >
                    {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                    Export CSV
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleExport("pdf")}
                    disabled={isExporting || total === 0}
                    className="inline-flex h-10 items-center gap-2 rounded-md border border-zinc-300 bg-white px-3 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                  >
                    <FileText className="h-4 w-4" />
                    Export PDF
                  </button>
                  <button
                    type="button"
                    onClick={() => void loadLogs(page, filters)}
                    className="inline-flex h-10 items-center gap-2 rounded-md border border-zinc-300 bg-white px-3 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Refresh
                  </button>
                </div>
              </header>

              {errorMessage ? (
                <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
                  {errorMessage}
                </div>
              ) : null}

              {/* Filters */}
              <section className="grid gap-3 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 lg:grid-cols-12">
                <div className="relative lg:col-span-4">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                  <input
                    value={filters.search}
                    onChange={(event) => update({ search: event.target.value })}
                    placeholder="Search user, action, or description"
                    className="h-10 w-full rounded-md border border-zinc-300 bg-white pl-9 pr-3 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                  />
                </div>
                <select
                  value={filters.role}
                  onChange={(event) => update({ role: event.target.value })}
                  className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900 lg:col-span-2"
                >
                  <option value="">All roles</option>
                  {options.roles.map((role) => (
                    <option key={role} value={role}>{role}</option>
                  ))}
                </select>
                <select
                  value={filters.action}
                  onChange={(event) => update({ action: event.target.value })}
                  className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900 lg:col-span-2"
                >
                  <option value="">All actions</option>
                  {options.actions.map((action) => (
                    <option key={action} value={action}>{action}</option>
                  ))}
                </select>
                <select
                  value={filters.entity_type}
                  onChange={(event) => update({ entity_type: event.target.value })}
                  className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900 lg:col-span-2"
                >
                  <option value="">All entities</option>
                  {options.entity_types.map((entity) => (
                    <option key={entity} value={entity}>{entity}</option>
                  ))}
                </select>
                <input
                  type="date"
                  value={filters.date_from}
                  onChange={(event) => update({ date_from: event.target.value })}
                  aria-label="From date"
                  className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900 lg:col-span-3"
                />
                <input
                  type="date"
                  value={filters.date_to}
                  onChange={(event) => update({ date_to: event.target.value })}
                  aria-label="To date"
                  className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900 lg:col-span-3"
                />
                <button
                  type="button"
                  onClick={() => setFilters(emptyFilters)}
                  className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 lg:col-span-2"
                >
                  Clear filters
                </button>
              </section>

              {/* Table */}
              <section className="grid gap-3">
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  {total.toLocaleString("en-IN")} activities
                  {totalPages > 0 ? ` • page ${page} of ${totalPages}` : ""}
                </p>

                {isLoading ? (
                  <TableSkeleton rows={10} columns={6} />
                ) : logs.length ? (
                  <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
                        <thead className="bg-zinc-100 text-left text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
                          <tr>
                            <th className="px-4 py-3">When</th>
                            <th className="px-4 py-3">User</th>
                            <th className="px-4 py-3">Action</th>
                            <th className="px-4 py-3">Entity</th>
                            <th className="px-4 py-3">Description</th>
                            <th className="px-4 py-3">IP</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                          {logs.map((log) => (
                            <tr key={log.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/60">
                              <td className="whitespace-nowrap px-4 py-3 text-zinc-500">
                                {formatDateTime(log.created_at)}
                              </td>
                              <td className="px-4 py-3">
                                <p className="font-medium text-zinc-900 dark:text-zinc-100">
                                  {log.user_name ?? "System"}
                                </p>
                                {log.role ? (
                                  <p className="text-xs text-zinc-500">{log.role}</p>
                                ) : null}
                              </td>
                              <td className="px-4 py-3">
                                <span className="inline-flex rounded-full bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-800 dark:bg-teal-950 dark:text-teal-300">
                                  {log.action}
                                </span>
                              </td>
                              <td className="px-4 py-3 capitalize text-zinc-600 dark:text-zinc-400">
                                {log.entity_type}
                                {log.entity_id ? ` #${log.entity_id}` : ""}
                              </td>
                              <td className="max-w-md px-4 py-3 text-zinc-700 dark:text-zinc-300">
                                {log.description}
                              </td>
                              <td className="whitespace-nowrap px-4 py-3 text-zinc-500">
                                {log.ip_address ?? "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-zinc-300 p-10 text-center dark:border-zinc-700">
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">
                      No activities match the current filters.
                    </p>
                  </div>
                )}

                {totalPages > 1 ? (
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">
                      Page {page} of {totalPages}
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => goToPage(page - 1)}
                        disabled={page <= 1 || isLoading}
                        className="inline-flex h-9 items-center gap-1 rounded-md border border-zinc-300 bg-white px-3 text-sm font-medium text-zinc-800 transition hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                      >
                        <ChevronLeft className="h-4 w-4" />
                        Previous
                      </button>
                      <button
                        type="button"
                        onClick={() => goToPage(page + 1)}
                        disabled={page >= totalPages || isLoading}
                        className="inline-flex h-9 items-center gap-1 rounded-md border border-zinc-300 bg-white px-3 text-sm font-medium text-zinc-800 transition hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                      >
                        Next
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ) : null}
              </section>
            </div>
          </div>
      </AppShell>
    </ProtectedRoute>
  );
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof AxiosError) {
    const detail = error.response?.data?.detail;
    if (typeof detail === "string") return detail;
  }
  return fallback;
}
