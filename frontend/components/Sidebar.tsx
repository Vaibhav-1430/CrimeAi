"use client";

import {
  BarChart3,
  Building2,
  FileText,
  Flame,
  Layers,
  LayoutDashboard,
  LogOut,
  Network,
  ScrollText,
  Shield,
  Siren,
  Sparkles,
  Users,
  Users2
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { hasPermission } from "@/lib/rbac";

const menuItems = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    permission: "dashboard:view"
  },
  {
    href: "/firs",
    label: "FIRs",
    icon: FileText,
    permission: "fir:view"
  },
  {
    href: "/analytics",
    label: "Analytics",
    icon: BarChart3,
    permission: "analytics:view"
  },
  {
    href: "/ai-assistant",
    label: "AI Assistant",
    icon: Sparkles,
    permission: "ai:use"
  },
  {
    href: "/network-analysis",
    label: "Network Analysis",
    icon: Network,
    permission: "network:view"
  },
  {
    href: "/hotspots",
    label: "Hotspots",
    icon: Flame,
    permission: "analytics:view"
  },
  {
    href: "/similar-cases",
    label: "Similar Cases",
    icon: Layers,
    permission: "fir:view"
  },
  {
    href: "/sociology",
    label: "Sociology",
    icon: Users2,
    permission: "analytics:view"
  },
  {
    href: "/districts",
    label: "Districts",
    icon: Building2,
    permission: "admin:view"
  },
  {
    href: "/stations",
    label: "Stations",
    icon: Siren,
    permission: "admin:view"
  },
  {
    href: "/admin/approvals",
    label: "Approvals",
    icon: Shield,
    permission: "approvals:manage"
  },
  {
    href: "/admin/users",
    label: "Users",
    icon: Users,
    permission: "users:manage"
  },
  {
    href: "/audit-logs",
    label: "Audit Logs",
    icon: ScrollText,
    permission: "audit:view"
  }
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const visibleItems = menuItems.filter((item) =>
    hasPermission(user?.role, item.permission)
  );

  return (
    <aside className="flex min-h-screen w-64 shrink-0 flex-col bg-zinc-950 px-4 py-5 text-white">
      <div className="mb-7 flex items-center gap-3">
        <div className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-teal-600">
          <Shield className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-lg font-bold">CrimeAI</h2>
          <p className="text-xs text-zinc-400">{user?.role ?? "Secure access"}</p>
        </div>
      </div>

      <nav className="grid gap-1">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition ${
                isActive
                  ? "bg-teal-600 text-white"
                  : "text-zinc-300 hover:bg-zinc-900 hover:text-white"
              }`}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto border-t border-zinc-800 pt-4">
        <p className="mb-3 truncate text-sm font-medium">{user?.name}</p>
        <button
          type="button"
          onClick={() => void logout()}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-zinc-300 transition hover:bg-zinc-900 hover:text-white"
        >
          <LogOut className="h-4 w-4" />
          Logout
        </button>
      </div>
    </aside>
  );
}
