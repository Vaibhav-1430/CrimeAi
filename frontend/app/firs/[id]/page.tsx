"use client";

import { AxiosError } from "axios";
import { ArrowLeft, Loader2, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { useAuth } from "@/components/auth/AuthProvider";
import Navbar from "@/components/Navbar";
import Sidebar from "@/components/Sidebar";
import AuditLogTable from "@/components/case/AuditLogTable";
import CaseStatusPanel from "@/components/case/CaseStatusPanel";
import CaseTimeline from "@/components/case/CaseTimeline";
import AICasePanel from "@/components/ai/AICasePanel";
import SimilarCasesPanel from "@/components/similar/SimilarCasesPanel";
import EvidenceManager from "@/components/case/EvidenceManager";
import SuspectManager from "@/components/case/SuspectManager";
import WitnessManager from "@/components/case/WitnessManager";
import { hasPermission } from "@/lib/rbac";
import { getCaseDetail } from "@/services/caseApi";
import { getDistricts, getPoliceStations, updateFirStatus } from "@/services/firApi";
import type { FIRCaseDetail } from "@/types/case";
import type { District, FIRStatus, PoliceStation } from "@/types/fir";

export default function FIRDetailPage() {
  const params = useParams<{ id: string }>();
  const firId = Number(params.id);
  const { user } = useAuth();
  const [caseDetail, setCaseDetail] = useState<FIRCaseDetail | null>(null);
  const [districts, setDistricts] = useState<District[]>([]);
  const [stations, setStations] = useState<PoliceStation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isStatusUpdating, setIsStatusUpdating] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const canUpdateCase = hasPermission(user?.role, "fir:update");

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      setErrorMessage("");

      try {
        const [detail, districtItems, stationItems] = await Promise.all([
          getCaseDetail(firId),
          getDistricts(),
          getPoliceStations()
        ]);

        setCaseDetail(detail);
        setDistricts(districtItems);
        setStations(stationItems);
      } catch (error) {
        setErrorMessage(getErrorMessage(error, "Unable to load case details."));
      } finally {
        setIsLoading(false);
      }
    }

    if (Number.isFinite(firId)) {
      void load();
    }
  }, [firId]);

  const districtName = useMemo(
    () => districts.find((district) => district.id === caseDetail?.fir.district_id)?.name ?? "-",
    [caseDetail?.fir.district_id, districts]
  );
  const stationName = useMemo(
    () => stations.find((station) => station.id === caseDetail?.fir.police_station_id)?.name ?? "-",
    [caseDetail?.fir.police_station_id, stations]
  );

  const refreshCase = async () => {
    const detail = await getCaseDetail(firId);
    setCaseDetail(detail);
  };

  const handleStatusChange = async (status: FIRStatus) => {
    if (!caseDetail || status === caseDetail.fir.status) {
      return;
    }

    setIsStatusUpdating(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      await updateFirStatus(firId, status);
      await refreshCase();
      setSuccessMessage("Case status updated.");
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "Unable to update case status."));
    } finally {
      setIsStatusUpdating(false);
    }
  };

  if (isLoading) {
    return (
      <ProtectedRoute>
        <main className="flex min-h-screen items-center justify-center bg-zinc-50 text-zinc-600 dark:bg-zinc-950 dark:text-zinc-300">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Loading case details
        </main>
      </ProtectedRoute>
    );
  }

  if (!caseDetail) {
    return (
      <ProtectedRoute>
        <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 text-center dark:bg-zinc-950">
          <div>
            <h1 className="text-2xl font-bold text-zinc-950 dark:text-zinc-50">
              Case not found
            </h1>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              The selected FIR could not be loaded.
            </p>
          </div>
        </main>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <div className="flex min-h-screen bg-zinc-50 dark:bg-zinc-950">
        <Sidebar />
        <div className="flex-1">
          <Navbar />
          <main className="px-4 py-6 text-zinc-950 dark:text-zinc-100 sm:px-6 lg:px-8">
            <div className="mx-auto grid max-w-7xl gap-6">
              <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <Link
                    href="/firs"
                    className="inline-flex items-center gap-2 text-sm font-medium text-teal-700 hover:underline dark:text-teal-400"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back to FIRs
                  </Link>
                  <p className="mt-4 text-sm font-semibold uppercase tracking-wide text-teal-700 dark:text-teal-400">
                    Case Management
                  </p>
                  <h1 className="mt-1 text-3xl font-bold text-zinc-950 dark:text-zinc-50">
                    {caseDetail.fir.fir_number}
                  </h1>
                  <p className="mt-2 max-w-3xl text-sm text-zinc-600 dark:text-zinc-400">
                    {caseDetail.fir.description}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => void refreshCase()}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
                >
                  <RefreshCw className="h-4 w-4" />
                  Refresh
                </button>
              </header>

              {errorMessage ? (
                <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
                  {errorMessage}
                </div>
              ) : null}

              {successMessage ? (
                <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
                  {successMessage}
                </div>
              ) : null}

              <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <InfoCard label="Crime Type" value={caseDetail.fir.crime_type} />
                <InfoCard label="District" value={districtName} />
                <InfoCard label="Police Station" value={stationName} />
                <InfoCard
                  label="Incident Date"
                  value={new Date(caseDetail.fir.incident_date).toLocaleDateString("en-IN", {
                    dateStyle: "medium"
                  })}
                />
              </section>

              <div className="grid gap-6 xl:grid-cols-[1.25fr_0.9fr]">
                <CaseTimeline logs={caseDetail.audit_logs} />
                <CaseStatusPanel
                  status={caseDetail.fir.status}
                  canUpdate={canUpdateCase}
                  isSubmitting={isStatusUpdating}
                  onChange={(status) => void handleStatusChange(status)}
                />
              </div>

              <AICasePanel firId={firId} />

              <section className="rounded-lg border border-zinc-800 bg-zinc-950 p-5">
                <h2 className="mb-4 text-lg font-semibold text-zinc-100">
                  Similar Case Intelligence
                </h2>
                <SimilarCasesPanel firId={firId} compact />
              </section>

              <EvidenceManager
                firId={firId}
                evidence={caseDetail.evidence}
                canEdit={canUpdateCase}
                onRefresh={refreshCase}
              />

              <div className="grid gap-6 xl:grid-cols-2">
                <WitnessManager
                  firId={firId}
                  witnesses={caseDetail.witnesses}
                  canEdit={canUpdateCase}
                  onRefresh={refreshCase}
                />
                <SuspectManager
                  firId={firId}
                  suspects={caseDetail.suspects}
                  canEdit={canUpdateCase}
                  onRefresh={refreshCase}
                />
              </div>

              <AuditLogTable logs={caseDetail.audit_logs} />
            </div>
          </main>
        </div>
      </div>
    </ProtectedRoute>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">{label}</p>
      <p className="mt-2 text-lg font-semibold text-zinc-950 dark:text-zinc-100">{value}</p>
    </div>
  );
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof AxiosError) {
    const detail = error.response?.data?.detail;
    if (typeof detail === "string") {
      return detail;
    }
  }

  return fallback;
}
