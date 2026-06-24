import type { AuditLog } from "@/types/case";

interface AuditLogTableProps {
  logs: AuditLog[];
}

export default function AuditLogTable({ logs }: AuditLogTableProps) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mb-5">
        <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-100">
          Audit Log
        </h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Every case action is recorded for traceability.
        </p>
      </div>

      {logs.length ? (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
            <thead className="bg-zinc-100 text-left text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
              <tr>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Entity</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3">When</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {logs.map((log) => (
                <tr key={log.id}>
                  <td className="px-4 py-3 font-medium text-zinc-950 dark:text-zinc-100">
                    {log.action}
                  </td>
                  <td className="px-4 py-3 capitalize text-zinc-600 dark:text-zinc-400">
                    {log.entity_type}
                  </td>
                  <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">
                    {log.description}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-zinc-500 dark:text-zinc-500">
                    {formatDateTime(log.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          No audit activity recorded yet.
        </p>
      )}
    </section>
  );
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short"
  });
}
