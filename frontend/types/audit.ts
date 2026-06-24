export interface AuditLogEntry {
  id: number;
  user_id: number | null;
  user_name: string | null;
  role: string | null;
  action: string;
  entity_type: string;
  entity_id: number | null;
  description: string;
  ip_address: string | null;
  created_at: string;
}

export interface PaginatedAuditLogs {
  items: AuditLogEntry[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface AuditFilterOptions {
  actions: string[];
  entity_types: string[];
  roles: string[];
}

export interface AuditLogQuery {
  page?: number;
  page_size?: number;
  search?: string;
  user_id?: number;
  role?: string;
  action?: string;
  entity_type?: string;
  date_from?: string;
  date_to?: string;
}
