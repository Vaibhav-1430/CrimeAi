"use client";

import { motion, useInView, useMotionValue, useTransform, animate } from "framer-motion";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { fadeUp } from "@/lib/motion";

interface KpiCardProps {
  label: string;
  value: number;
  /** Display suffix, e.g. "%" or "k". */
  suffix?: string;
  icon?: ReactNode;
  /** Percentage delta vs previous period. */
  delta?: number;
  /** Accent tone for the icon chip + glow. */
  tone?: "teal" | "cyan" | "emerald" | "amber" | "red";
  format?: (n: number) => string;
}

const TONE: Record<NonNullable<KpiCardProps["tone"]>, string> = {
  teal: "text-teal-300 bg-teal-500/10 ring-teal-500/20",
  cyan: "text-cyan-300 bg-cyan-500/10 ring-cyan-500/20",
  emerald: "text-emerald-300 bg-emerald-500/10 ring-emerald-500/20",
  amber: "text-amber-300 bg-amber-500/10 ring-amber-500/20",
  red: "text-red-300 bg-red-500/10 ring-red-500/20"
};

/** Animated counter that ticks up to `value` when scrolled into view. */
function Counter({ value, format }: { value: number; format?: (n: number) => string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const count = useMotionValue(0);
  const rounded = useTransform(count, (v) =>
    format ? format(v) : Math.round(v).toLocaleString("en-IN")
  );

  useEffect(() => {
    if (inView) {
      const controls = animate(count, value, { duration: 1.1, ease: [0.16, 1, 0.3, 1] });
      return controls.stop;
    }
  }, [inView, value, count]);

  return <motion.span ref={ref}>{rounded}</motion.span>;
}

export function KpiCard({
  label,
  value,
  suffix,
  icon,
  delta,
  tone = "teal",
  format
}: KpiCardProps) {
  const up = (delta ?? 0) >= 0;
  return (
    <motion.div
      variants={fadeUp}
      className="glass group relative overflow-hidden rounded-xl p-5 transition-all duration-300 hover:border-teal-500/30"
    >
      {/* corner glow */}
      <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-teal-500/10 blur-2xl transition-opacity duration-300 group-hover:opacity-100 opacity-0" />

      <div className="flex items-start justify-between">
        <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">{label}</p>
        {icon ? (
          <span className={`inline-flex h-8 w-8 items-center justify-center rounded-lg ring-1 ring-inset ${TONE[tone]}`}>
            {icon}
          </span>
        ) : null}
      </div>

      <div className="mt-3 flex items-end gap-1 font-mono text-3xl font-bold tracking-tight text-zinc-50">
        <Counter value={value} format={format} />
        {suffix ? <span className="pb-0.5 text-lg text-zinc-400">{suffix}</span> : null}
      </div>

      {delta !== undefined ? (
        <div className="mt-2 flex items-center gap-1 text-xs">
          <span
            className={`inline-flex items-center gap-0.5 font-semibold ${
              up ? "text-emerald-400" : "text-red-400"
            }`}
          >
            {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            {Math.abs(delta)}%
          </span>
          <span className="text-zinc-600">vs prev. period</span>
        </div>
      ) : null}
    </motion.div>
  );
}
