"use client";

import { motion } from "framer-motion";
import { Bell, Command, Search, Sparkles } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { hasPermission } from "@/lib/rbac";
import { ALL_NAV_ITEMS } from "@/lib/navItems";
import CommandPalette from "@/components/shell/CommandPalette";
import CommandSidebar from "@/components/shell/CommandSidebar";

/**
 * The command-center shell: collapsible sidebar + top bar with global search
 * (Cmd/Ctrl+K) + floating AI access. Wrap any authenticated page in this.
 */
export default function AppShell({
  children,
  title
}: {
  children: ReactNode;
  title?: string;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  // Auto-collapse the sidebar on narrow viewports (mobile/tablet).
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1024px)");
    const apply = () => setCollapsed(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();

  const canUseAI = hasPermission(user?.role, "ai:use");
  const current = ALL_NAV_ITEMS.find(
    (i) => pathname === i.href || pathname.startsWith(`${i.href}/`)
  );
  const pageTitle = title ?? current?.label ?? "CrimeAI";

  // Cmd/Ctrl+K opens the palette.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
      if (e.key === "Escape") setPaletteOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="bg-grid flex h-screen overflow-hidden">
      <CommandSidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header className="glass-strong z-20 flex h-16 shrink-0 items-center gap-4 border-b border-white/5 px-5">
          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold text-zinc-100">{pageTitle}</h1>
            <div className="flex items-center gap-1.5 text-[11px] text-zinc-500">
              <span className="live-dot h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Live · {new Date().toLocaleDateString("en-IN", { dateStyle: "medium" })}
            </div>
          </div>

          {/* Global search trigger */}
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="group ml-auto flex h-9 w-full max-w-sm items-center gap-2 rounded-lg border border-white/8 bg-white/5 px-3 text-sm text-zinc-500 transition hover:border-teal-500/30 hover:text-zinc-300"
          >
            <Search className="h-4 w-4" />
            <span className="flex-1 text-left">Search intelligence…</span>
            <kbd className="hidden items-center gap-0.5 rounded border border-white/10 bg-black/30 px-1.5 py-0.5 text-[10px] text-zinc-500 sm:flex">
              <Command className="h-2.5 w-2.5" />K
            </kbd>
          </button>

          <button
            type="button"
            className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-white/8 bg-white/5 text-zinc-400 transition hover:text-teal-300"
            aria-label="Notifications"
          >
            <Bell className="h-4 w-4" />
            <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-cyan-400" />
          </button>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>

      {/* Floating AI access */}
      {canUseAI && current?.href !== "/ai-assistant" ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="fixed bottom-6 right-6 z-40"
        >
          <Link
            href="/ai-assistant"
            className="group flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500 to-cyan-600 shadow-[0_8px_30px_-6px_rgba(34,211,238,0.5)] transition-transform hover:scale-105"
            aria-label="Open AI Assistant"
          >
            <Sparkles className="h-6 w-6 text-white transition-transform group-hover:rotate-12" />
          </Link>
        </motion.div>
      ) : null}

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}
