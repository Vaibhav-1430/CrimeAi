"use client";

import { AxiosError } from "axios";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { useAuth } from "@/components/auth/AuthProvider";
import AppShell from "@/components/shell/AppShell";
import { GlassCard } from "@/components/ui/GlassCard";
import { Badge } from "@/components/ui/RiskBadge";
import { staggerContainer, fadeUp } from "@/lib/motion";
import FIRForm from "@/components/firs/FIRForm";
import FIRTable from "@/components/firs/FIRTable";
import SearchBar from "@/components/firs/SearchBar";
import StatusFilter from "@/components/firs/StatusFilter";
import { hasPermission } from "@/lib/rbac";
import {
  createFir,
  deleteFir,
  getDistricts,
  getFirs,
  getPoliceStations,
  updateFir
} from "@/services/firApi";
import type {
  District,
  FIR,
  FIRPayload,
  PoliceStation,
  StatusFilterValue
} from "@/types/fir";

const emptyForm: FIRPayload = {
  fir_number: "",
  crime_type: "",
  description: "",
  district_id: 0,
  police_station_id: 0,
  incident_date: "",
  status: "Open"
};

export default function FIRPage() {
  const { user } = useAuth();
  const [firs, setFirs] = useState<FIR[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [policeStations, setPoliceStations] = useState<PoliceStation[]>([]);
  const [formData, setFormData] = useState<FIRPayload>(emptyForm);
  const [editingFirId, setEditingFirId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilterValue>("All");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const pageSize = 25;
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const canCreateFir = hasPermission(user?.role, "fir:create");
  const canUpdateFir = hasPermission(user?.role, "fir:update");
  const canDeleteFir = hasPermission(user?.role, "fir:delete");
  const canSubmitForm = editingFirId ? canUpdateFir : canCreateFir;

  // Fetch one page of FIRs with the current filters applied server-side.
  const loadFirs = useCallback(
    async (targetPage: number, search: string, status: StatusFilterValue) => {
      setIsLoading(true);
      setErrorMessage("");

      try {
        const result = await getFirs({
          page: targetPage,
          page_size: pageSize,
          search: search.trim() || undefined,
          status_filter: status
        });

        setFirs(result.items);
        setTotal(result.total);
        setTotalPages(result.total_pages);
        setPage(result.page);
      } catch (error) {
        setErrorMessage(getErrorMessage(error, "Unable to load FIR records."));
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  // District/station reference data only needs loading once.
  const loadOrgData = useCallback(async () => {
    try {
      const [districtsData, policeStationsData] = await Promise.all([
        getDistricts(),
        getPoliceStations()
      ]);

      setDistricts(districtsData);
      setPoliceStations(policeStationsData);

      setFormData((current) => {
        if (current.district_id && current.police_station_id) {
          return current;
        }

        const firstDistrictId = districtsData[0]?.id ?? 0;
        const firstStation =
          policeStationsData.find((station) => station.district_id === firstDistrictId) ??
          policeStationsData[0];

        return {
          ...current,
          district_id: firstDistrictId,
          police_station_id: firstStation?.id ?? 0
        };
      });
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "Unable to load reference data."));
    }
  }, []);

  // Refetch after edits/deletes using the current filters & page.
  const reloadCurrentPage = useCallback(() => {
    void loadFirs(page, searchTerm, statusFilter);
  }, [loadFirs, page, searchTerm, statusFilter]);

  useEffect(() => {
    void loadOrgData();
  }, [loadOrgData]);

  // Debounce search/status changes; reset to page 1 on filter change.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadFirs(1, searchTerm, statusFilter);
    }, 300);

    return () => window.clearTimeout(timer);
  }, [loadFirs, searchTerm, statusFilter]);

  const goToPage = useCallback(
    (targetPage: number) => {
      const clamped = Math.min(Math.max(targetPage, 1), Math.max(totalPages, 1));
      void loadFirs(clamped, searchTerm, statusFilter);
    },
    [loadFirs, searchTerm, statusFilter, totalPages]
  );

  const handleSubmit = async () => {
    if (!canSubmitForm) {
      setErrorMessage("You do not have permission to save FIR records.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      if (editingFirId) {
        await updateFir(editingFirId, formData);
        setSuccessMessage("FIR updated successfully.");
      } else {
        await createFir(formData);
        setSuccessMessage("FIR created successfully.");
      }

      reloadCurrentPage();
      resetForm();
    } catch (error) {
      setErrorMessage(
        getErrorMessage(
          error,
          editingFirId ? "Unable to update FIR." : "Unable to create FIR."
        )
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (fir: FIR) => {
    if (!canUpdateFir) {
      setErrorMessage("You do not have permission to update FIR records.");
      return;
    }

    setEditingFirId(fir.id);
    setFormData({
      fir_number: fir.fir_number,
      crime_type: fir.crime_type,
      description: fir.description,
      district_id: fir.district_id,
      police_station_id: fir.police_station_id,
      incident_date: normalizeDateInput(fir.incident_date),
      status: fir.status
    });
    setSuccessMessage("");
    setErrorMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (fir: FIR) => {
    if (!canDeleteFir) {
      setErrorMessage("You do not have permission to delete FIR records.");
      return;
    }

    const confirmed = window.confirm(
      `Delete FIR ${fir.fir_number}? This action cannot be undone.`
    );

    if (!confirmed) {
      return;
    }

    setDeletingId(fir.id);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      await deleteFir(fir.id);
      reloadCurrentPage();
      setSuccessMessage("FIR deleted successfully.");

      if (editingFirId === fir.id) {
        resetForm();
      }
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "Unable to delete FIR."));
    } finally {
      setDeletingId(null);
    }
  };

  const resetForm = () => {
    const firstDistrictId = districts[0]?.id ?? 0;
    const firstStation =
      policeStations.find((station) => station.district_id === firstDistrictId) ??
      policeStations[0];

    setEditingFirId(null);
    setFormData({
      ...emptyForm,
      district_id: firstDistrictId,
      police_station_id: firstStation?.id ?? 0
    });
  };

  return (
    <ProtectedRoute>
    <AppShell title="FIR Management">
    <div className="p-6">
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="show"
        className="mx-auto grid max-w-[1600px] gap-5"
      >
        <motion.header variants={fadeUp} className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-400">
              Casework
            </p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight text-white">
              First Information Reports
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-zinc-500">
              Create, update, search, and maintain FIR records with district and
              police station mapping.
            </p>
          </div>

          <button
            type="button"
            onClick={reloadCurrentPage}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 text-sm font-semibold text-zinc-200 transition hover:border-teal-500/30 hover:text-teal-300"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </motion.header>

        {errorMessage ? (
          <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {errorMessage}
          </div>
        ) : null}

        {successMessage ? (
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
            {successMessage}
          </div>
        ) : null}

        {(canCreateFir || canUpdateFir) ? (
          <motion.div variants={fadeUp}>
            <FIRForm
              value={formData}
              districts={districts}
              policeStations={policeStations}
              isEditing={editingFirId !== null}
              isSubmitting={isSubmitting}
              onChange={setFormData}
              onSubmit={handleSubmit}
              onCancelEdit={resetForm}
            />
          </motion.div>
        ) : null}

        <GlassCard animate className="grid gap-4 p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-zinc-100">FIR Records</h3>
              <p className="mt-0.5 flex items-center gap-2 text-sm text-zinc-500">
                <Badge tone="teal">{total.toLocaleString("en-IN")} records</Badge>
                {totalPages > 0 ? <span className="text-zinc-600">page {page} of {totalPages}</span> : null}
              </p>
            </div>
            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              <SearchBar value={searchTerm} onChange={setSearchTerm} />
              <StatusFilter value={statusFilter} onChange={setStatusFilter} />
            </div>
          </div>

          <FIRTable
            firs={firs}
            districts={districts}
            policeStations={policeStations}
            isLoading={isLoading}
            deletingId={deletingId}
            canEdit={canUpdateFir}
            canDelete={canDeleteFir}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />

          {totalPages > 1 ? (
            <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Page {page} of {totalPages}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => goToPage(page - 1)}
                  disabled={page <= 1 || isLoading}
                  className="inline-flex h-9 items-center gap-1 rounded-md border border-zinc-300 bg-white px-3 text-sm font-medium text-zinc-800 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() => goToPage(page + 1)}
                  disabled={page >= totalPages || isLoading}
                  className="inline-flex h-9 items-center gap-1 rounded-md border border-zinc-300 bg-white px-3 text-sm font-medium text-zinc-800 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          ) : null}
        </GlassCard>
      </motion.div>
    </div>
    </AppShell>
    </ProtectedRoute>
  );
}

function normalizeDateInput(value: string) {
  if (!value) {
    return "";
  }

  return value.slice(0, 10);
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof AxiosError) {
    const detail = error.response?.data?.detail;

    if (typeof detail === "string") {
      return detail;
    }

    if (Array.isArray(detail) && detail[0]?.msg) {
      return detail[0].msg;
    }
  }

  return fallback;
}
