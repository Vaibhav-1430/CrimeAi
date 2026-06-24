import { CalendarClock, FileSearch, UserPlus } from "lucide-react";
import type { AuditLog } from "@/types/case";

interface CaseTimelineProps {
  logs: AuditLog[];
}

const timelineActions = new Set([
  "FIR Created",
  "Evidence Added",
  "Witness Added",
  "Status Changed",
  "Witness Updated",
  "Suspect Linked"
]);

export default function CaseTimeline({ logs }: CaseTimelineProps) {
  const items = logs.filter((log) => timelineActions.has(log.action)).slice(0, 8);

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mb-5">
        <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-100">
          Case Timeline
        </h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Key case events in reverse chronological order.
        </p>
      </div>

      {items.length ? (
        <div className="grid gap-4">
          {items.map((item) => (
            <div key={item.id} className="flex gap-3">
              <div className="mt-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300">
                {getIcon(item.action)}
              </div>
              <div>
                <p className="text-sm font-semibold text-zinc-950 dark:text-zinc-100">
                  {item.action}
                </p>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                  {item.description}
                </p>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-500">
                  {formatDateTime(item.created_at)}
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Timeline entries will appear as case activity is recorded.
        </p>
      )}
    </section>
  );
}

function getIcon(action: string) {
  if (action.includes("Evidence")) {
    return <FileSearch className="h-4 w-4" />;
  }

  if (action.includes("Witness") || action.includes("Suspect")) {
    return <UserPlus className="h-4 w-4" />;
  }

  return <CalendarClock className="h-4 w-4" />;
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short"
  });
}
