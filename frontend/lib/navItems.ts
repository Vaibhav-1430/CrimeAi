import {
  BarChart3,
  Building2,
  FileText,
  Flame,
  LayoutDashboard,
  Layers,
  Network,
  ScrollText,
  Shield,
  Siren,
  Sparkles,
  Users,
  Users2,
  type LucideIcon
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  permission: string;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

/** Grouped navigation — drives both the sidebar and the command palette. */
export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { href: "/dashboard", label: "Command Center", icon: LayoutDashboard, permission: "dashboard:view" },
      { href: "/analytics", label: "Analytics", icon: BarChart3, permission: "analytics:view" }
    ]
  },
  {
    label: "Casework",
    items: [
      { href: "/firs", label: "FIRs", icon: FileText, permission: "fir:view" },
      { href: "/similar-cases", label: "Similar Cases", icon: Layers, permission: "fir:view" }
    ]
  },
  {
    label: "Intelligence",
    items: [
      { href: "/ai-assistant", label: "AI Assistant", icon: Sparkles, permission: "ai:use" },
      { href: "/network-analysis", label: "Network Analysis", icon: Network, permission: "network:view" },
      { href: "/hotspots", label: "Hotspot Prediction", icon: Flame, permission: "analytics:view" },
      { href: "/sociology", label: "Sociology", icon: Users2, permission: "analytics:view" }
    ]
  },
  {
    label: "Administration",
    items: [
      { href: "/districts", label: "Districts", icon: Building2, permission: "admin:view" },
      { href: "/stations", label: "Stations", icon: Siren, permission: "admin:view" },
      { href: "/admin/approvals", label: "Approvals", icon: Shield, permission: "approvals:manage" },
      { href: "/admin/users", label: "Users", icon: Users, permission: "users:manage" },
      { href: "/audit-logs", label: "Audit Logs", icon: ScrollText, permission: "audit:view" }
    ]
  }
];

export const ALL_NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);
