import api from "@/services/api";
import type {
  AuditFilterOptions,
  AuditLogEntry,
  AuditLogQuery,
  PaginatedAuditLogs
} from "@/types/audit";

function buildParams(query: AuditLogQuery): Record<string, string | number> {
  const params: Record<string, string | number> = {
    page: query.page ?? 1,
    page_size: query.page_size ?? 25
  };
  if (query.search) params.search = query.search;
  if (query.user_id) params.user_id = query.user_id;
  if (query.role) params.role = query.role;
  if (query.action) params.action = query.action;
  if (query.entity_type) params.entity_type = query.entity_type;
  if (query.date_from) params.date_from = query.date_from;
  if (query.date_to) params.date_to = query.date_to;
  return params;
}

export async function getAuditLogs(query: AuditLogQuery = {}): Promise<PaginatedAuditLogs> {
  const response = await api.get<PaginatedAuditLogs>("/audit-logs", {
    params: buildParams(query)
  });
  return response.data;
}

export async function getRecentAuditLogs(limit = 8): Promise<AuditLogEntry[]> {
  const response = await api.get<AuditLogEntry[]>("/audit-logs/recent", {
    params: { limit }
  });
  return response.data;
}

export async function getAuditFilterOptions(): Promise<AuditFilterOptions> {
  const response = await api.get<AuditFilterOptions>("/audit-logs/filter-options");
  return response.data;
}

/**
 * Fetch every row matching the current filters (across all pages) for export.
 * Pages through the API in large chunks so exports aren't capped at one page.
 */
export async function getAllAuditLogsForExport(
  query: AuditLogQuery
): Promise<AuditLogEntry[]> {
  const pageSize = 100;
  const first = await getAuditLogs({ ...query, page: 1, page_size: pageSize });
  const all = [...first.items];
  for (let page = 2; page <= first.total_pages; page += 1) {
    const next = await getAuditLogs({ ...query, page, page_size: pageSize });
    all.push(...next.items);
  }
  return all;
}
