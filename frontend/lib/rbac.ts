import type { UserRole } from "@/types/auth";

export const rolePermissions: Record<UserRole, string[]> = {
  SuperAdmin: [
    "dashboard:view",
    "fir:view",
    "fir:create",
    "fir:update",
    "fir:delete",
    "analytics:view",
    "admin:view",
    "users:manage",
    "approvals:manage",
    "audit:view",
    "ai:use",
    "network:view"
  ],
  StateAdmin: [
    "dashboard:view",
    "fir:view",
    "analytics:view",
    "admin:view",
    "users:manage",
    "approvals:manage",
    "audit:view",
    "ai:use",
    "network:view"
  ],
  DistrictAdmin: [
    "dashboard:view",
    "fir:view",
    "analytics:view",
    "admin:view",
    "users:manage",
    "approvals:manage",
    "audit:view",
    "ai:use",
    "network:view"
  ],
  StationOfficer: ["dashboard:view", "fir:view", "fir:create", "fir:update"],
  Investigator: [
    "dashboard:view",
    "fir:view",
    "fir:create",
    "fir:update",
    "fir:delete",
    "analytics:view",
    "ai:use",
    "network:view"
  ],
  Analyst: ["fir:view", "analytics:view", "network:view"]
};

export function hasPermission(role: UserRole | undefined, permission: string) {
  if (!role) {
    return false;
  }

  return rolePermissions[role].includes(permission);
}

export function canAccessRole(role: UserRole | undefined, allowedRoles?: UserRole[]) {
  if (!role) {
    return false;
  }

  return !allowedRoles || allowedRoles.includes(role);
}
