"use client";

import { AxiosError } from "axios";
import { Check, Loader2, RefreshCw, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import AppShell from "@/components/shell/AppShell";
import {
  approveOfficer,
  getApprovals,
  getRoles,
  rejectOfficer,
  type ApprovalRequest
} from "@/services/adminApi";
import { getDistricts, getPoliceStations } from "@/services/firApi";
import type { Role } from "@/types/auth";
import type { District, PoliceStation } from "@/types/fir";

export default function AdminApprovalsPage() {
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [stations, setStations] = useState<PoliceStation[]>([]);
  const [selectedRoleByApproval, setSelectedRoleByApproval] = useState<Record<number, number>>({});
  const [selectedDistrictByApproval, setSelectedDistrictByApproval] = useState<Record<number, number>>({});
  const [selectedStationByApproval, setSelectedStationByApproval] = useState<Record<number, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage("");
    try {
      const [approvalItems, roleItems, districtItems, stationItems] = await Promise.all([
        getApprovals(),
        getRoles(),
        getDistricts(),
        getPoliceStations()
      ]);
      setApprovals(approvalItems);
      setRoles(roleItems);
      setDistricts(districtItems);
      setStations(stationItems);
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "Unable to load approvals."));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadData();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadData]);

  const handleApprove = async (approval: ApprovalRequest) => {
    const roleId = selectedRoleByApproval[approval.id] || approval.requested_role_id || roles[0]?.id;
    const districtId =
      selectedDistrictByApproval[approval.id] || approval.requested_district_id || approval.user.district_id;
    const stationId =
      selectedStationByApproval[approval.id] || approval.requested_station_id || approval.user.station_id;

    if (!roleId || !districtId || !stationId) {
      setErrorMessage("Assign role, district, and station before approving.");
      return;
    }

    setBusyId(approval.id);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      await approveOfficer(approval.id, {
        role_id: roleId,
        district_id: districtId,
        station_id: stationId
      });
      setSuccessMessage("Officer approved successfully.");
      await loadData();
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "Unable to approve officer."));
    } finally {
      setBusyId(null);
    }
  };

  const handleReject = async (approval: ApprovalRequest) => {
    const reason = window.prompt("Reason for rejection");
    if (!reason) {
      return;
    }

    setBusyId(approval.id);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      await rejectOfficer(approval.id, reason);
      setSuccessMessage("Officer rejected.");
      await loadData();
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "Unable to reject officer."));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <ProtectedRoute allowedRoles={["SuperAdmin", "StateAdmin", "DistrictAdmin"]}>
      <AppShell title="Officer Approvals">
          <div className="px-4 py-6 sm:px-6 lg:px-8">
            <div className="mx-auto grid max-w-7xl gap-6">
              <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-wide text-teal-700 dark:text-teal-400">
                    Admin
                  </p>
                  <h1 className="mt-1 text-3xl font-bold">Officer Approvals</h1>
                  <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                    Review pending police personnel before enabling access.
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

              <section className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                {isLoading ? (
                  <div className="flex min-h-56 items-center justify-center text-zinc-600 dark:text-zinc-400">
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Loading approvals
                  </div>
                ) : approvals.length ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
                      <thead className="bg-zinc-100 text-left text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
                        <tr>
                          <th className="px-4 py-3">Name</th>
                          <th className="px-4 py-3">Employee ID</th>
                          <th className="px-4 py-3">Email</th>
                          <th className="px-4 py-3">District</th>
                          <th className="px-4 py-3">Station</th>
                          <th className="px-4 py-3">Applied</th>
                          <th className="px-4 py-3">Assign</th>
                          <th className="px-4 py-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                        {approvals.map((approval) => (
                          <tr key={approval.id}>
                            <td className="px-4 py-3 font-medium">{approval.user.name}</td>
                            <td className="px-4 py-3">{approval.user.employee_id}</td>
                            <td className="px-4 py-3">{approval.user.email}</td>
                            <td className="px-4 py-3">{nameById(districts, approval.user.district_id)}</td>
                            <td className="px-4 py-3">{nameById(stations, approval.user.station_id)}</td>
                            <td className="px-4 py-3 whitespace-nowrap">{formatDate(approval.created_at)}</td>
                            <td className="px-4 py-3">
                              <div className="grid min-w-56 gap-2">
                                <select
                                  value={selectedRoleByApproval[approval.id] || approval.requested_role_id || ""}
                                  onChange={(event) => setSelectedRoleByApproval({ ...selectedRoleByApproval, [approval.id]: Number(event.target.value) })}
                                  className="h-9 rounded-md border border-zinc-300 bg-white px-2 dark:border-zinc-700 dark:bg-zinc-900"
                                >
                                  {roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
                                </select>
                                <select
                                  value={selectedDistrictByApproval[approval.id] || approval.user.district_id || ""}
                                  onChange={(event) => setSelectedDistrictByApproval({ ...selectedDistrictByApproval, [approval.id]: Number(event.target.value) })}
                                  className="h-9 rounded-md border border-zinc-300 bg-white px-2 dark:border-zinc-700 dark:bg-zinc-900"
                                >
                                  {districts.map((district) => <option key={district.id} value={district.id}>{district.name}</option>)}
                                </select>
                                <select
                                  value={selectedStationByApproval[approval.id] || approval.user.station_id || ""}
                                  onChange={(event) => setSelectedStationByApproval({ ...selectedStationByApproval, [approval.id]: Number(event.target.value) })}
                                  className="h-9 rounded-md border border-zinc-300 bg-white px-2 dark:border-zinc-700 dark:bg-zinc-900"
                                >
                                  {stations.map((station) => <option key={station.id} value={station.id}>{station.name}</option>)}
                                </select>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => void handleApprove(approval)}
                                  disabled={busyId === approval.id}
                                  className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-emerald-200 text-emerald-700 hover:bg-emerald-50 disabled:opacity-60 dark:border-emerald-900 dark:text-emerald-300"
                                  title="Approve"
                                >
                                  <Check className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void handleReject(approval)}
                                  disabled={busyId === approval.id}
                                  className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-60 dark:border-red-900 dark:text-red-300"
                                  title="Reject"
                                >
                                  <X className="h-4 w-4" />
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
                    No pending officer approvals.
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

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-IN", { dateStyle: "medium" });
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof AxiosError) {
    const detail = error.response?.data?.detail;
    if (typeof detail === "string") return detail;
  }
  return fallback;
}
