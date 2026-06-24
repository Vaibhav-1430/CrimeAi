"use client";

import { motion } from "framer-motion";
import { ArrowRight, Radar } from "lucide-react";
import Link from "next/link";

export default function Footer() {
  return (
    <footer className="relative px-4 pb-10 pt-16">
      {/* CTA band */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="glass-strong relative mx-auto max-w-5xl overflow-hidden rounded-3xl px-8 py-12 text-center"
      >
        <div className="pointer-events-none absolute left-1/2 top-0 h-40 w-96 -translate-x-1/2 rounded-full bg-teal-500/20 blur-[80px]" />
        <h2 className="relative text-3xl font-bold tracking-tight text-white">
          Bring your jurisdiction online
        </h2>
        <p className="relative mx-auto mt-3 max-w-xl text-zinc-400">
          A single command center for FIRs, cases, evidence, and AI-driven
          intelligence — secured with enterprise RBAC and a full audit trail.
        </p>
        <Link
          href="/login"
          className="relative mt-7 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-600 px-6 py-3 text-sm font-semibold text-white transition hover:shadow-[0_0_30px_-6px_rgba(34,211,238,0.6)]"
        >
          Launch Console
          <ArrowRight className="h-4 w-4" />
        </Link>
      </motion.div>

      {/* footer bar */}
      <div className="mx-auto mt-14 flex max-w-6xl flex-col items-center justify-between gap-4 border-t border-white/5 pt-8 sm:flex-row">
        <div className="flex items-center gap-2.5">
          <div className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-teal-500 to-cyan-600">
            <Radar className="h-3.5 w-3.5 text-white" />
          </div>
          <span className="text-sm font-semibold text-zinc-300">CrimeAI Intelligence OS</span>
        </div>
        <p className="text-xs text-zinc-600">
          Built for police, investigators, and government agencies · Demonstration platform
        </p>
      </div>
    </footer>
  );
}
