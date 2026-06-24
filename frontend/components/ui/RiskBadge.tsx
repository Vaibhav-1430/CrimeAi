import type { ReactNode } from "react";

export type RiskLevel = "low" | "medium" | "high" | "critical";

const RISK_STYLES: Record<RiskLevel, string> = {
  low: "bg-green-500/10 text-green-400 ring-green-500/30",
  medium: "bg-amber-500/10 text-amber-400 ring-amber-500/30",
  high: "bg-orange-500/10 text-orange-400 ring-orange-500/30",
  critical: "bg-red-500/10 text-red-400 ring-red-500/30"
};

/** Map a 0-100 score to a risk level (Low/Medium/High/Critical). */
export function riskLevelFromScore(score: number): RiskLevel {
  if (score >= 80) return "critical";
  if (score >= 60) return "high";
  if (score >= 35) return "medium";
  return "low";
}

export function RiskBadge({
  level,
  children
}: {
  level: RiskLevel;
  children?: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ring-1 ring-inset ${RISK_STYLES[level]}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {children ?? level}
    </span>
  );
}

const TONE_STYLES = {
  teal: "bg-teal-500/10 text-teal-300 ring-teal-500/25",
  cyan: "bg-cyan-500/10 text-cyan-300 ring-cyan-500/25",
  emerald: "bg-emerald-500/10 text-emerald-300 ring-emerald-500/25",
  neutral: "bg-white/5 text-zinc-300 ring-white/10",
  amber: "bg-amber-500/10 text-amber-300 ring-amber-500/25",
  red: "bg-red-500/10 text-red-300 ring-red-500/25"
} as const;

export function Badge({
  tone = "neutral",
  children,
  className = ""
}: {
  tone?: keyof typeof TONE_STYLES;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${TONE_STYLES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
