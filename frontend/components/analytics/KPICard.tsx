import type { LucideIcon } from "lucide-react";

interface KPICardProps {
  label: string;
  value: number;
  helper: string;
  icon: LucideIcon;
}

export default function KPICard({ label, value, helper, icon: Icon }: KPICardProps) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">{label}</p>
          <p className="mt-2 text-3xl font-bold text-zinc-950 dark:text-zinc-50">
            {value.toLocaleString("en-IN")}
          </p>
        </div>
        <div className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300">
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-500">{helper}</p>
    </div>
  );
}
