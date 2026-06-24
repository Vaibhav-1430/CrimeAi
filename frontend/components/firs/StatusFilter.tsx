import type { StatusFilterValue } from "@/types/fir";

const options: StatusFilterValue[] = [
  "All",
  "Open",
  "Under Investigation",
  "Chargesheet Filed",
  "Closed"
];

interface StatusFilterProps {
  value: StatusFilterValue;
  onChange: (value: StatusFilterValue) => void;
}

export default function StatusFilter({ value, onChange }: StatusFilterProps) {
  return (
    <div className="inline-flex h-11 rounded-md border border-zinc-300 bg-zinc-100 p-1 dark:border-zinc-700 dark:bg-zinc-900">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          className={`min-w-20 rounded px-3 text-sm font-medium transition ${
            value === option
              ? "bg-white text-zinc-950 shadow-sm dark:bg-zinc-800 dark:text-zinc-100"
              : "text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-100"
          }`}
        >
          {option}
        </button>
      ))}
    </div>
  );
}
