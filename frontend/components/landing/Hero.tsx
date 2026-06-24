"use client";

import { motion } from "framer-motion";
import { ArrowRight, ShieldCheck, Sparkles } from "lucide-react";
import Link from "next/link";

const STATS = [
  { value: "100K+", label: "FIRs analyzed" },
  { value: "30", label: "Districts covered" },
  { value: "8", label: "Intelligence modules" },
  { value: "24/7", label: "Operational posture" }
];

export default function Hero() {
  return (
    <section className="relative overflow-hidden px-4 pt-40 pb-24">
      {/* ambient glows */}
      <div className="pointer-events-none absolute left-1/2 top-0 h-[500px] w-[800px] -translate-x-1/2 rounded-full bg-teal-500/10 blur-[120px]" />
      <div className="pointer-events-none absolute right-0 top-40 h-[400px] w-[400px] rounded-full bg-cyan-500/10 blur-[100px]" />

      <div className="relative mx-auto max-w-5xl text-center">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="inline-flex items-center gap-2 rounded-full border border-teal-500/20 bg-teal-500/5 px-4 py-1.5 text-xs font-medium text-teal-300"
        >
          <span className="live-dot h-1.5 w-1.5 rounded-full bg-teal-400" />
          AI-native crime intelligence platform
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
          className="mx-auto mt-6 max-w-4xl text-5xl font-bold leading-[1.05] tracking-tight text-white sm:text-6xl lg:text-7xl"
        >
          The intelligence OS for{" "}
          <span className="bg-gradient-to-r from-teal-300 via-cyan-300 to-emerald-300 bg-clip-text text-transparent">
            modern policing
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.12, ease: [0.16, 1, 0.3, 1] }}
          className="mx-auto mt-6 max-w-2xl text-lg text-zinc-400"
        >
          Unify FIRs, case files, evidence, and analytics into a single command
          center. AI investigation, criminal network mapping, and predictive
          hotspot intelligence — built for investigators and agencies.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.18, ease: [0.16, 1, 0.3, 1] }}
          className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row"
        >
          <Link
            href="/login"
            className="group inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-600 px-6 py-3 text-sm font-semibold text-white transition hover:shadow-[0_0_30px_-6px_rgba(34,211,238,0.6)]"
          >
            <Sparkles className="h-4 w-4" />
            Launch Console
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
          <a
            href="#features"
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-6 py-3 text-sm font-semibold text-zinc-200 transition hover:border-teal-500/30"
          >
            <ShieldCheck className="h-4 w-4" />
            Explore capabilities
          </a>
        </motion.div>

        {/* stats */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          className="mx-auto mt-16 grid max-w-3xl grid-cols-2 gap-px overflow-hidden rounded-2xl border border-white/8 bg-white/5 sm:grid-cols-4"
        >
          {STATS.map((stat) => (
            <div key={stat.label} className="bg-black/20 px-4 py-5 backdrop-blur">
              <p className="font-mono text-2xl font-bold text-white">{stat.value}</p>
              <p className="mt-1 text-xs text-zinc-500">{stat.label}</p>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
