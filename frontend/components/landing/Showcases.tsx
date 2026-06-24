"use client";

import { motion } from "framer-motion";
import { BarChart3, Check, Flame, Network, Sparkles } from "lucide-react";
import type { ReactNode } from "react";

function ShowcaseRow({
  id,
  eyebrow,
  title,
  points,
  visual,
  reverse
}: {
  id: string;
  eyebrow: string;
  title: string;
  points: string[];
  visual: ReactNode;
  reverse?: boolean;
}) {
  return (
    <section id={id} className="px-4 py-16">
      <div className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, x: reverse ? 30 : -30 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className={reverse ? "lg:order-2" : ""}
        >
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-400">{eyebrow}</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-white">{title}</h2>
          <ul className="mt-6 grid gap-3">
            {points.map((point) => (
              <li key={point} className="flex items-start gap-3 text-sm text-zinc-300">
                <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-teal-500/15 text-teal-400">
                  <Check className="h-3 w-3" />
                </span>
                {point}
              </li>
            ))}
          </ul>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className={reverse ? "lg:order-1" : ""}
        >
          {visual}
        </motion.div>
      </div>
    </section>
  );
}

export default function Showcases() {
  return (
    <>
      <ShowcaseRow
        id="intelligence"
        eyebrow="AI Intelligence"
        title="An investigator's co-pilot, grounded in case data"
        points={[
          "Summarize any FIR into facts, victims, suspects, and timeline",
          "Surface missing evidence and recommend next investigative steps",
          "Every answer cites sources with a confidence score"
        ]}
        visual={<AiVisual />}
      />
      <ShowcaseRow
        id="analytics"
        eyebrow="Analytics"
        title="From raw FIRs to executive intelligence"
        points={[
          "Crime trends, district rankings, and crime-type distribution",
          "Real-time KPIs across the entire jurisdiction",
          "Server-side aggregation over 100,000+ records"
        ]}
        visual={<AnalyticsVisual />}
        reverse
      />
      <ShowcaseRow
        id="network"
        eyebrow="Network Analysis"
        title="See the criminal network, not just the case"
        points={[
          "Map suspects, FIRs, witnesses, and evidence as a live graph",
          "Detect crime rings, repeat offenders, and shared suspects",
          "Drill into any node to investigate relationships"
        ]}
        visual={<NetworkVisual />}
      />
      <ShowcaseRow
        id="hotspots"
        eyebrow="Predictive Intelligence"
        title="Anticipate crime before it concentrates"
        points={[
          "ML risk scoring for every district (RandomForest)",
          "Crime forecasting up to 12 months ahead (XGBoost)",
          "Interactive Karnataka risk heatmap"
        ]}
        visual={<HotspotVisual />}
        reverse
      />
    </>
  );
}

/* ---- Mock visuals (pure CSS/SVG, no data) ---- */

function VisualFrame({ children, icon }: { children: ReactNode; icon: ReactNode }) {
  return (
    <div className="glass-strong overflow-hidden rounded-2xl p-1.5 shadow-2xl">
      <div className="flex items-center gap-1.5 px-3 py-2">
        <span className="h-2.5 w-2.5 rounded-full bg-red-500/60" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber-500/60" />
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/60" />
        <span className="ml-auto text-teal-400">{icon}</span>
      </div>
      <div className="rounded-xl bg-black/40 p-4">{children}</div>
    </div>
  );
}

function AiVisual() {
  return (
    <VisualFrame icon={<Sparkles className="h-3.5 w-3.5" />}>
      <div className="grid gap-2.5">
        <div className="ml-auto max-w-[80%] rounded-2xl rounded-br-sm bg-teal-600/30 px-3 py-2 text-xs text-teal-50">
          What evidence is missing in FIR/2026/08/0100000?
        </div>
        <div className="max-w-[85%] rounded-2xl rounded-bl-sm border border-white/8 bg-white/5 px-3 py-2.5 text-xs text-zinc-300">
          <p>Based on the case data, two gaps stand out:</p>
          <ul className="mt-1.5 grid gap-1 text-zinc-400">
            <li>• No CCTV footage for the transaction window</li>
            <li>• Complainant bank statement not attached</li>
          </ul>
          <div className="mt-2 flex items-center gap-1.5">
            <span className="h-1 flex-1 rounded-full bg-emerald-500/30">
              <span className="block h-full w-[72%] rounded-full bg-emerald-400" />
            </span>
            <span className="font-mono text-[10px] text-emerald-400">72% conf.</span>
          </div>
        </div>
      </div>
    </VisualFrame>
  );
}

function AnalyticsVisual() {
  const bars = [40, 65, 52, 78, 60, 88, 72, 95];
  return (
    <VisualFrame icon={<BarChart3 className="h-3.5 w-3.5" />}>
      <div className="flex h-40 items-end gap-2">
        {bars.map((h, i) => (
          <motion.div
            key={i}
            initial={{ height: 0 }}
            whileInView={{ height: `${h}%` }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: i * 0.06 }}
            className="flex-1 rounded-t bg-gradient-to-t from-teal-600/40 to-cyan-400"
          />
        ))}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        {["Total", "Open", "Closed"].map((k, i) => (
          <div key={k} className="rounded-lg bg-white/5 py-1.5">
            <p className="font-mono text-sm font-bold text-white">{["100K", "88K", "12K"][i]}</p>
            <p className="text-[10px] text-zinc-500">{k}</p>
          </div>
        ))}
      </div>
    </VisualFrame>
  );
}

function NetworkVisual() {
  const nodes = [
    { x: 50, y: 50, r: 8, c: "#dc2626" },
    { x: 22, y: 28, r: 5, c: "#0d9488" },
    { x: 80, y: 30, r: 5, c: "#0d9488" },
    { x: 26, y: 76, r: 5, c: "#2563eb" },
    { x: 78, y: 74, r: 5, c: "#9333ea" },
    { x: 50, y: 18, r: 4, c: "#ca8a04" }
  ];
  return (
    <VisualFrame icon={<Network className="h-3.5 w-3.5" />}>
      <svg viewBox="0 0 100 100" className="h-44 w-full">
        {nodes.slice(1).map((n, i) => (
          <motion.line
            key={i}
            x1={50}
            y1={50}
            x2={n.x}
            y2={n.y}
            stroke="rgba(45,212,191,0.3)"
            strokeWidth={0.5}
            initial={{ pathLength: 0 }}
            whileInView={{ pathLength: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: i * 0.1 }}
          />
        ))}
        {nodes.map((n, i) => (
          <motion.circle
            key={i}
            cx={n.x}
            cy={n.y}
            r={n.r}
            fill={n.c}
            initial={{ scale: 0 }}
            whileInView={{ scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: 0.2 + i * 0.08, type: "spring" }}
            style={{ transformOrigin: `${n.x}px ${n.y}px` }}
          />
        ))}
      </svg>
    </VisualFrame>
  );
}

function HotspotVisual() {
  const points = [
    { x: 30, y: 35, r: 18, c: "#ef4444" },
    { x: 65, y: 55, r: 12, c: "#fb923c" },
    { x: 48, y: 72, r: 9, c: "#f59e0b" },
    { x: 72, y: 28, r: 7, c: "#22c55e" }
  ];
  return (
    <VisualFrame icon={<Flame className="h-3.5 w-3.5" />}>
      <div className="relative h-44 overflow-hidden rounded-lg bg-[#0a0f0d]">
        <div className="bg-grid absolute inset-0 opacity-40" />
        {points.map((p, i) => (
          <motion.div
            key={i}
            initial={{ scale: 0, opacity: 0 }}
            whileInView={{ scale: 1, opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: i * 0.12 }}
            className="absolute rounded-full blur-md"
            style={{
              left: `${p.x}%`,
              top: `${p.y}%`,
              width: p.r * 2,
              height: p.r * 2,
              background: p.c,
              transform: "translate(-50%,-50%)"
            }}
          />
        ))}
      </div>
    </VisualFrame>
  );
}
