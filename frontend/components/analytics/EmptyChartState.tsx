import { BarChart3 } from "lucide-react";

interface EmptyChartStateProps {
  message?: string;
}

export default function EmptyChartState({
  message = "No FIR data available for this chart."
}: EmptyChartStateProps) {
  return (
    <div className="flex h-full flex-col items-center justify-center rounded-md border border-dashed border-zinc-300 text-center text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
      <BarChart3 className="mb-3 h-8 w-8" />
      <p className="text-sm">{message}</p>
    </div>
  );
}
