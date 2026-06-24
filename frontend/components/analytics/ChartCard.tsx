import type { ReactNode } from "react";

interface ChartCardProps {
  title: string;
  subtitle: string;
  children: ReactNode;
}

export default function ChartCard({ title, subtitle, children }: ChartCardProps) {
  return (
    <section className="glass rounded-xl p-5 transition-all duration-300 hover:border-teal-500/20">
      <div className="mb-5">
        <h3 className="text-sm font-semibold text-zinc-100">{title}</h3>
        <p className="mt-0.5 text-xs text-zinc-500">{subtitle}</p>
      </div>
      <div className="h-80">{children}</div>
    </section>
  );
}
