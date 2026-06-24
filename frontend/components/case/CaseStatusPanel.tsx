import { Loader2 } from "lucide-react";
import { firStatusOptions } from "@/types/fir";
import type { FIRStatus } from "@/types/fir";

interface CaseStatusPanelProps {
  status: FIRStatus;
  canUpdate: boolean;
  isSubmitting: boolean;
  onChange: (status: FIRStatus) => void;
}

export default function CaseStatusPanel({
  status,
  canUpdate,
  isSubmitting,
  onChange
}: CaseStatusPanelProps) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-100">
          Case Status
        </h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Track the current investigation stage.
        </p>
      </div>

      {canUpdate ? (
        <label className="grid gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Status
          <div className="flex items-center gap-3">
            <select
              value={status}
              onChange={(event) => onChange(event.target.value as FIRStatus)}
              className="h-11 min-w-64 rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-950 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            >
              {firStatusOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin text-zinc-500" /> : null}
          </div>
        </label>
      ) : (
        <p className="text-sm font-medium text-zinc-950 dark:text-zinc-100">{status}</p>
      )}
    </section>
  );
}
