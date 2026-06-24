"use client";

import { motion } from "framer-motion";
import { ArrowRight, Radar } from "lucide-react";
import Link from "next/link";

const LINKS = [
  { href: "#features", label: "Capabilities" },
  { href: "#intelligence", label: "Intelligence" },
  { href: "#analytics", label: "Analytics" },
  { href: "#network", label: "Network" }
];

export default function LandingNav() {
  return (
    <motion.header
      initial={{ y: -24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-4"
    >
      <nav className="glass-strong flex w-full max-w-6xl items-center gap-4 rounded-2xl px-4 py-2.5">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-teal-500 to-cyan-600">
            <Radar className="h-4 w-4 text-white" />
          </div>
          <span className="text-sm font-bold tracking-tight text-white">
            CrimeAI<span className="ml-1 text-[10px] font-medium uppercase tracking-[0.2em] text-teal-400">OS</span>
          </span>
        </Link>

        <div className="ml-4 hidden items-center gap-1 md:flex">
          {LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="rounded-lg px-3 py-1.5 text-sm text-zinc-400 transition hover:bg-white/5 hover:text-zinc-100"
            >
              {link.label}
            </a>
          ))}
        </div>

        <Link
          href="/login"
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-teal-500 to-cyan-600 px-4 py-2 text-sm font-semibold text-white transition hover:shadow-[0_0_24px_-6px_rgba(34,211,238,0.6)]"
        >
          Launch Console
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </nav>
    </motion.header>
  );
}
