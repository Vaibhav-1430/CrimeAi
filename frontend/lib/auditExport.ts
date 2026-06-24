import type { AuditLogEntry } from "@/types/audit";

const COLUMNS: Array<{ key: keyof AuditLogEntry; label: string }> = [
  { key: "created_at", label: "Timestamp" },
  { key: "user_name", label: "User" },
  { key: "role", label: "Role" },
  { key: "action", label: "Action" },
  { key: "entity_type", label: "Entity" },
  { key: "entity_id", label: "Entity ID" },
  { key: "description", label: "Description" },
  { key: "ip_address", label: "IP Address" }
];

function cellValue(entry: AuditLogEntry, key: keyof AuditLogEntry): string {
  const value = entry[key];
  if (value === null || value === undefined) return "";
  if (key === "created_at") return new Date(value as string).toLocaleString("en-IN");
  return String(value);
}

function escapeCsv(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** Download the given audit entries as a CSV file. */
export function exportAuditCsv(entries: AuditLogEntry[], fileName = "audit-logs.csv") {
  const header = COLUMNS.map((column) => column.label).join(",");
  const rows = entries.map((entry) =>
    COLUMNS.map((column) => escapeCsv(cellValue(entry, column.key))).join(",")
  );
  const csv = [header, ...rows].join("\n");

  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  triggerDownload(blob, fileName);
}

function triggerDownload(blob: Blob, fileName: string) {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Open a print-ready window for the audit entries so the user can "Save as PDF".
 * Dependency-free PDF export via the browser's native print-to-PDF.
 */
export function exportAuditPdf(entries: AuditLogEntry[], title = "CrimeAI Audit Log") {
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    return;
  }

  const rows = entries
    .map(
      (entry) => `<tr>${COLUMNS.map(
        (column) => `<td>${escapeHtml(cellValue(entry, column.key))}</td>`
      ).join("")}</tr>`
    )
    .join("");

  const generatedAt = new Date().toLocaleString("en-IN");

  printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    body { font-family: Arial, Helvetica, sans-serif; padding: 24px; color: #111; }
    h1 { font-size: 18px; margin: 0 0 4px; }
    .meta { font-size: 12px; color: #555; margin-bottom: 16px; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; vertical-align: top; }
    th { background: #f3f4f6; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <div class="meta">${entries.length} record(s) · generated ${escapeHtml(generatedAt)}</div>
  <table>
    <thead><tr>${COLUMNS.map((column) => `<th>${column.label}</th>`).join("")}</tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <script>window.onload = function () { window.print(); };</script>
</body>
</html>`);
  printWindow.document.close();
}
