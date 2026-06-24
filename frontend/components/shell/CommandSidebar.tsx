"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, LogOut, Radar } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { hasPermission } from "@/lib/rbac";
import { NAV_GROUPS } from "@/lib/navItems";

interface CommandSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export default function CommandSidebar({ collapsed, onToggle }: CommandSidebarProps) {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const visibleGroups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => hasPermission(user?.role, item.permission))
  })).filter((group) => group.items.length > 0);

  return (
    <motion.aside
      animate={{ width: collapsed ? 72 : 248 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="glass-strong relative z-30 flex h-screen shrink-0 flex-col border-r border-white/5"
    >
      {/* Brand */}
      <div className="flex h-16 items-center gap-3 px-4">
        <div className="relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-teal-500 to-cyan-600">
          <Radar className="h-5 w-5 text-white" />
          <span className="live-dot absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-cyan-400" />
        </div>
        <AnimatePresence>
          {!collapsed ? (
            <motion.div
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.2 }}
              className="min-w-0"
            >
              <p className="truncate text-sm font-bold tracking-tight text-white">CrimeAI</p>
              <p className="truncate text-[10px] font-medium uppercase tracking-[0.2em] text-teal-400">
                Intelligence OS
              </p>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-2">
        {visibleGroups.map((group) => (
          <div key={group.label} className="mb-4">
            {!collapsed ? (
              <p className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-600">
                {group.label}
              </p>
            ) : null}
            <div className="grid gap-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={collapsed ? item.label : undefined}
                    className={`group relative flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium transition-all ${
                      active
                        ? "bg-teal-500/10 text-teal-300"
                        : "text-zinc-400 hover:bg-white/5 hover:text-zinc-100"
                    }`}
                  >
                    {active ? (
                      <motion.span
                        layoutId="nav-active"
                        className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-teal-400"
                      />
                    ) : null}
                    <Icon className={`h-4 w-4 shrink-0 ${active ? "text-teal-400" : ""}`} />
                    {!collapsed ? <span className="truncate">{item.label}</span> : null}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-white/5 p-3">
        {!collapsed ? (
          <div className="mb-2 flex items-center gap-2 rounded-lg px-2 py-1.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-zinc-700 to-zinc-800 text-xs font-bold text-zinc-200">
              {user?.name?.[0] ?? "?"}
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-zinc-200">{user?.name}</p>
              <p className="truncate text-[10px] text-teal-400">{user?.role}</p>
            </div>
          </div>
        ) : null}
        <button
          type="button"
          onClick={() => void logout()}
          title="Sign out"
          className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium text-zinc-400 transition hover:bg-red-500/10 hover:text-red-300"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed ? "Sign out" : null}
        </button>
      </div>

      {/* Collapse toggle */}
      <button
        type="button"
        onClick={onToggle}
        className="absolute -right-3 top-20 z-40 flex h-6 w-6 items-center justify-center rounded-full border border-white/10 bg-zinc-900 text-zinc-400 shadow-lg transition hover:text-teal-300"
        aria-label="Toggle sidebar"
      >
        <ChevronLeft className={`h-3.5 w-3.5 transition-transform ${collapsed ? "rotate-180" : ""}`} />
      </button>
    </motion.aside>
  );
}
