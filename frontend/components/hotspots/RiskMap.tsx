"use client";

import { useState } from "react";
import type { HeatmapPoint } from "@/types/hotspot";

interface RiskMapProps {
  points: HeatmapPoint[];
  onSelect?: (district: string) => void;
  selected?: string | null;
}

/** Color ramp green→amber→red by risk score (0-100). */
function riskColor(score: number): string {
  if (score >= 66) return "#dc2626";
  if (score >= 33) return "#f59e0b";
  return "#16a34a";
}

/**
 * Interactive SVG bubble-map of Karnataka districts. Coordinates come from the
 * backend already normalized to a 0-100 viewport (x = west→east, y = north→
 * south), so no map-tile dependency is needed. Bubble size & color encode risk.
 */
export default function RiskMap({ points, onSelect, selected }: RiskMapProps) {
  const [hover, setHover] = useState<HeatmapPoint | null>(null);

  return (
    <div className="relative h-[460px] w-full overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950">
      <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" className="h-full w-full">
        {/* subtle grid */}
        {Array.from({ length: 11 }).map((_, i) => (
          <g key={i} stroke="#27272a" strokeWidth={0.1}>
            <line x1={i * 10} y1={0} x2={i * 10} y2={100} />
            <line x1={0} y1={i * 10} x2={100} y2={i * 10} />
          </g>
        ))}

        {/* soft heat halos */}
        {points.map((p) => (
          <circle
            key={`halo-${p.district}`}
            cx={p.x}
            cy={p.y}
            r={Math.max(3, p.risk_score / 8)}
            fill={riskColor(p.risk_score)}
            opacity={0.18}
          />
        ))}

        {/* district markers */}
        {points.map((p) => {
          const isSelected = selected === p.district;
          return (
            <circle
              key={p.district}
              cx={p.x}
              cy={p.y}
              r={isSelected ? 2.6 : 1.8}
              fill={riskColor(p.risk_score)}
              stroke={isSelected ? "#fff" : "rgba(255,255,255,0.5)"}
              strokeWidth={isSelected ? 0.6 : 0.3}
              className="cursor-pointer transition-all"
              onMouseEnter={() => setHover(p)}
              onMouseLeave={() => setHover(null)}
              onClick={() => onSelect?.(p.district)}
            />
          );
        })}
      </svg>

      {hover ? (
        <div
          className="pointer-events-none absolute rounded-md border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 text-xs text-zinc-100 shadow-lg"
          style={{ left: `${hover.x}%`, top: `${hover.y}%`, transform: "translate(-50%, -130%)" }}
        >
          <p className="font-semibold">{hover.district}</p>
          <p className="text-zinc-400">Risk {hover.risk_score}</p>
        </div>
      ) : null}

      {/* legend */}
      <div className="absolute bottom-3 left-3 flex items-center gap-3 rounded-md bg-zinc-900/80 px-3 py-1.5 text-xs text-zinc-300">
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-[#16a34a]" />Low</span>
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-[#f59e0b]" />Medium</span>
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-[#dc2626]" />High</span>
      </div>
    </div>
  );
}
