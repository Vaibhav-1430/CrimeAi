"use client";

import { AxiosError } from "axios";
import { KeyRound, Loader2, RefreshCw, ShieldBan, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import AppShell from "@/components/shell/AppShell";
import {
  changeUserRole,
  getAdminUsers,
  getRoles,
  reactivateUser,
  resetUserPassword,
  suspendUser
} from "@/services/adminApi";
import { getDistricts, getPoliceStations } from "@/services/firApi";
import type { AuthUser, Role, UserStatus } from "@/types/auth";
import type { District, PoliceStation } from "@/types/fir";

const statuses: UserStatus[] = ["Pending", "Approved", "Rejected", "Suspended"];

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [stations, setStations] = useState<PoliceStation[]>([]);
  const [filters, setFilters] = useState({
    search: "",
    role_id: "",
    district_id: "",
    station_id: "",
    status_filter: ""
  });
  const [isLoading, setIsLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage("");
    try {
      const [userItems, roleItems, districtItems, stationItems] = await Promise.all([
        getAdminUsers(filters),
        getRoles(),
        getDistricts(),
        getPoliceStations()
      ]);
      setUsers(userItems);
      setRoles(roleItems);
      setDistricts(districtItems);
      setStations(stationItems);
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "Unable to load users."));
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadData();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadData]);

  const handleSuspendToggle = async (user: AuthUser) => {
    setBusyId(user.id);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      if (user.status === "Suspended") {
        await reactivateUser(user.id);
        setSuccessMessage("User reactivated.");
      } else {
        await suspendUser(user.id);
        setSuccessMessage("User suspended.");
      }
      await loadData();
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "Unable to update user status."));
    } finally {
      setBusyId(null);
    }
  };

  const handleResetPassword = async (user: AuthUser) => {
    const password = window.prompt("Enter temporary password");
    if (!password) return;
    setBusyId(user.id);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      await resetUserPassword(user.id, password);
      setSuccessMessage("Password reset successfully.");
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "Unable to reset password."));
    } finally {
      setBusyId(null);
    }
  };

  const handleRoleChange = async (user: AuthUser, roleId: number) => {
    setBusyId(user.id);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      await changeUserRole(user.id, roleId);
      setSuccessMessage("Role changed successfully.");
      await loadData();
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "Unable to change role."));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <ProtectedRoute allowedRoles={["SuperAdmin", "StateAdmin", "DistrictAdmin"]}>
      <AppShell title="User Management">
          <div className="px-4 py-6 sm:px-6 lg:px-8">
            <div className="mx-auto grid max-w-7xl gap-6">
              <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-wide text-teal-700 dark:text-teal-400">
                    Admin
                  </p>
                  <h1 className="mt-1 text-3xl font-bold">User Management</h1>
                  <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                    Search, filter, suspend, reactivate, reset passwords, and change roles.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void loadData()}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                >
                  <RefreshCw className="h-4 w-4" />
                  Refresh
                </button>
              </header>

              <Notice message={errorMessage} type="error" />
              <Notice message={successMessage} type="success" />

              <section className="grid gap-3 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 md:grid-cols-5">
                <input
                  placeholder="Search users"
                  value={filters.search}
                  onChange={(event) => setFilters({ ...filters, search: event.target.value })}
                  className="h-11 rounded-md border border-zinc-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                />
                <select value={filters.role_id} onChange={(event) => setFilters({ ...filters, role_id: event.target.value })} className="h-11 rounded-md border border-zinc-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900">
                  <option value="">All roles</option>
                  {roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
                </select>
                <select value={filters.district_id} onChange={(event) => setFilters({ ...filters, district_id: event.target.value })} className="h-11 rounded-md border border-zinc-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900">
                  <option value="">All districts</option>
                  {districts.map((district) => <option key={district.id} value={district.id}>{district.name}</option>)}
                </select>
                <select value={filters.station_id} onChange={(event) => setFilters({ ...filters, station_id: event.target.value })} className="h-11 rounded-md border border-zinc-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900">
                  <option value="">All stations</option>
                  {stations.map((station) => <option key={station.id} value={station.id}>{station.name}</option>)}
                </select>
                <select value={filters.status_filter} onChange={(event) => setFilters({ ...filters, status_filter: event.target.value })} className="h-11 rounded-md border border-zinc-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900">
                  <option value="">All statuses</option>
                  {statuses.map((status) => <option key={status} value={status}>{status}</option>)}
                </select>
                <button type="button" onClick={() => void loadData()} className="h-11 rounded-md bg-teal-700 px-4 text-sm font-semibold text-white md:col-span-5">
                  Apply Filters
                </button>
              </section>

              <section className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                {isLoading ? (
                  <div className="flex min-h-56 items-center justify-center text-zinc-600 dark:text-zinc-400">
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Loading users
                  </div>
                ) : users.length ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
                      <thead className="bg-zinc-100 text-left text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
                        <tr>
                          <th className="px-4 py-3">Officer</th>
                          <th className="px-4 py-3">Employee ID</th>
                          <th className="px-4 py-3">Role</th>
                          <th className="px-4 py-3">District</th>
                          <th className="px-4 py-3">Station</th>
                          <th className="px-4 py-3">Status</th>
                          <th className="px-4 py-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                        {users.map((user) => (
                          <tr key={user.id}>
                            <td className="px-4 py-3">
                              <p className="font-medium">{user.name}</p>
                              <p className="text-xs text-zinc-500">{user.email}</p>
                            </td>
                            <td className="px-4 py-3">{user.employee_id ?? "-"}</td>
                            <td className="px-4 py-3">
                              <select
                                value={user.role_id ?? ""}
                                onChange={(event) => void handleRoleChange(user, Number(event.target.value))}
                                className="h-9 rounded-md border border-zinc-300 bg-white px-2 dark:border-zinc-700 dark:bg-zinc-900"
                              >
                                {roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
                              </select>
                            </td>
                            <td className="px-4 py-3">{nameById(districts, user.district_id)}</td>
                            <td className="px-4 py-3">{nameById(stations, user.station_id)}</td>
                            <td className="px-4 py-3">{user.status}</td>
                            <td className="px-4 py-3">
                              <div className="flex justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => void handleSuspendToggle(user)}
                                  disabled={busyId === user.id}
                                  className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-zinc-300 text-zinc-700 hover:bg-zinc-100 disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200"
                                  title={user.status === "Suspended" ? "Reactivate" : "Suspend"}
                                >
                                  {user.status === "Suspended" ? <ShieldCheck className="h-4 w-4" /> : <ShieldBan className="h-4 w-4" />}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void handleResetPassword(user)}
                                  disabled={busyId === user.id}
                                  className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-zinc-300 text-zinc-700 hover:bg-zinc-100 disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200"
                                  title="Reset password"
                                >
                                  <KeyRound className="h-4 w-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
                    No users match the selected filters.
                  </div>
                )}
              </section>
            </div>
          </div>
      </AppShell>
    </ProtectedRoute>
  );
}

function Notice({ message, type }: { message: string; type: "error" | "success" }) {
  if (!message) return null;
  const className =
    type === "error"
      ? "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
      : "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200";
  return <div className={`rounded-md border px-4 py-3 text-sm ${className}`}>{message}</div>;
}

function nameById(items: Array<{ id: number; name: string }>, id?: number | null) {
  return items.find((item) => item.id === id)?.name ?? "-";
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof AxiosError) {
    const detail = error.response?.data?.detail;
    if (typeof detail === "string") return detail;
  }
  return fallback;
}
