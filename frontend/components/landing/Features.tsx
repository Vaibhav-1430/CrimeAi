"use client";

import { motion } from "framer-motion";
import {
  Brain,
  FileText,
  Flame,
  Network,
  ScrollText,
  ShieldCheck,
  Sparkles,
  Users2
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const FEATURES: Array<{ icon: LucideIcon; title: string; desc: string }> = [
  { icon: FileText, title: "FIR & Case Management", desc: "End-to-end registration, evidence chains, and case lifecycle tracking." },
  { icon: Sparkles, title: "AI Investigation Assistant", desc: "Summarize cases, surface missing evidence, and get next-step leads." },
  { icon: Network, title: "Criminal Network Analysis", desc: "Map relationships between suspects, FIRs, and locations as a live graph." },
  { icon: Flame, title: "Hotspot Prediction", desc: "ML-driven district risk scoring and crime forecasting." },
  { icon: Brain, title: "Explainable Intelligence", desc: "Every AI answer cites its sources, reasoning chain, and confidence." },
  { icon: Users2, title: "Sociological Analytics", desc: "Demographic and socio-economic crime pattern analysis." },
  { icon: ScrollText, title: "Immutable Audit Trail", desc: "Every action logged. Admin-only, tamper-resistant, exportable." },
  { icon: ShieldCheck, title: "Enterprise RBAC", desc: "Role-based access for officers, investigators, analysts, and admins." }
];

export default function Features() {
  return (
    <section id="features" className="relative px-4 py-24">
      <div className="mx-auto max-w-6xl">
        <SectionHeading
          eyebrow="Capabilities"
          title="One platform. Total operational picture."
          sub="Every module shares the same data fabric — so intelligence flows from FIR to forecast without silos."
        />

        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-80px" }}
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.05 } } }}
          className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          {FEATURES.map((feature) => {
            const Icon = feature.icon;
            return (
              <motion.div
                key={feature.title}
                variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }}
                className="glass group rounded-xl p-5 transition-all duration-300 hover:border-teal-500/30 hover:shadow-[0_0_30px_-12px_rgba(45,212,191,0.3)]"
              >
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-teal-500/10 text-teal-300 ring-1 ring-inset ring-teal-500/20 transition group-hover:scale-105">
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 text-sm font-semibold text-white">{feature.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-zinc-500">{feature.desc}</p>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  sub
}: {
  eyebrow: string;
  title: string;
  sub?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      className="mx-auto max-w-2xl text-center"
    >
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-400">{eyebrow}</p>
      <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">{title}</h2>
      {sub ? <p className="mt-4 text-zinc-400">{sub}</p> : null}
    </motion.div>
  );
}
