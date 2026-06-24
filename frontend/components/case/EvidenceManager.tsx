"use client";

import { AxiosError } from "axios";
import { Search, UploadCloud } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import EvidenceGallery from "@/components/evidence/EvidenceGallery";
import EvidencePreview from "@/components/evidence/EvidencePreview";
import EvidenceUploadModal from "@/components/evidence/EvidenceUploadModal";
import { hasPermission } from "@/lib/rbac";
import { MEDIA_TYPE_LABELS } from "@/lib/evidence";
import { deleteEvidence, getEvidenceCount, listEvidence } from "@/services/evidenceApi";
import type {
  Evidence,
  EvidenceCount,
  EvidenceMediaType
} from "@/types/case";

interface EvidenceManagerProps {
  firId: number;
  /** Initial evidence from the case detail; refreshed independently after that. */
  evidence: Evidence[];
  canEdit: boolean;
  onRefresh: () => Promise<void>;
}

type TypeFilter = EvidenceMediaType | "all";

const TYPE_FILTERS: TypeFilter[] = ["all", "image", "video", "pdf", "audio", "document"];

export default function EvidenceManager({
  firId,
  evidence: initialEvidence,
  canEdit,
  onRefresh
}: EvidenceManagerProps) {
  const { user } = useAuth();
  const canDelete = hasPermission(user?.role, "fir:delete");

  const [evidence, setEvidence] = useState<Evidence[]>(initialEvidence);
  const [count, setCount] = useState<EvidenceCount | null>(null);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [preview, setPreview] = useState<Evidence | null>(null);
  const [error, setError] = useState("");

  const loadEvidence = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const [items, countData] = await Promise.all([
        listEvidence(firId, {
          search: search.trim() || undefined,
          media_type: typeFilter,
          date_from: dateFrom || undefined,
          date_to: dateTo || undefined
        }),
        getEvidenceCount(firId)
      ]);
      setEvidence(items);
      setCount(countData);
    } catch (loadError) {
      setError(getErrorMessage(loadError, "Unable to load evidence."));
    } finally {
      setIsLoading(false);
    }
  }, [firId, search, typeFilter, dateFrom, dateTo]);

  // Debounce filter changes into a single fetch.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadEvidence();
    }, 300);
    return () => window.clearTimeout(timer);
  }, [loadEvidence]);

  const handleUploaded = useCallback(() => {
    void loadEvidence();
    void onRefresh();
  }, [loadEvidence, onRefresh]);

  const handleDelete = useCallback(
    async (item: Evidence) => {
      if (!window.confirm(`Delete "${item.file_name}"? This cannot be undone.`)) {
        return;
      }
      setDeletingId(item.id);
      setError("");
      try {
        await deleteEvidence(item.id);
        await loadEvidence();
        void onRefresh();
      } catch (deleteError) {
        setError(getErrorMessage(deleteError, "Unable to delete evidence."));
      } finally {
        setDeletingId(null);
      }
    },
    [loadEvidence, onRefresh]
  );

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-100">
            Evidence
            {count ? (
              <span className="ml-2 rounded-full bg-zinc-100 px-2 py-0.5 text-sm font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                {count.total}
              </span>
            ) : null}
          </h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Images, video, audio, PDFs, and documents linked to this FIR.
          </p>
        </div>
        {canEdit ? (
          <button
            type="button"
            onClick={() => setShowUpload(true)}
            className="inline-flex h-10 shrink-0 items-center gap-2 rounded-md bg-teal-700 px-4 text-sm font-semibold text-white transition hover:bg-teal-800"
          >
            <UploadCloud className="h-4 w-4" />
            Upload
          </button>
        ) : null}
      </div>

      {/* Filters */}
      <div className="mb-5 grid gap-3">
        <div className="flex flex-wrap gap-2">
          {TYPE_FILTERS.map((type) => {
            const active = typeFilter === type;
            const typeCount =
              type === "all" ? count?.total : count?.by_type?.[type] ?? 0;
            return (
              <button
                key={type}
                type="button"
                onClick={() => setTypeFilter(type)}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition ${
                  active
                    ? "bg-teal-700 text-white"
                    : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                }`}
              >
                {type === "all" ? "All" : MEDIA_TYPE_LABELS[type]}
                {typeCount !== undefined ? (
                  <span className={active ? "text-teal-100" : "text-zinc-500"}>
                    {typeCount}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by file name or description"
              className="h-10 w-full rounded-md border border-zinc-300 bg-white pl-9 pr-3 text-sm text-zinc-950 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
          </div>
          <input
            type="date"
            value={dateFrom}
            onChange={(event) => setDateFrom(event.target.value)}
            aria-label="From date"
            className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-950 outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
          <input
            type="date"
            value={dateTo}
            onChange={(event) => setDateTo(event.target.value)}
            aria-label="To date"
            className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-950 outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
        </div>
      </div>

      {error ? (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          {error}
        </div>
      ) : null}

      <EvidenceGallery
        evidence={evidence}
        isLoading={isLoading}
        canDelete={canDelete}
        deletingId={deletingId}
        onPreview={setPreview}
        onDelete={handleDelete}
      />

      {showUpload ? (
        <EvidenceUploadModal
          firId={firId}
          onClose={() => setShowUpload(false)}
          onUploaded={handleUploaded}
        />
      ) : null}

      {preview ? (
        <EvidencePreview evidence={preview} onClose={() => setPreview(null)} />
      ) : null}
    </section>
  );
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof AxiosError) {
    const detail = error.response?.data?.detail;
    if (typeof detail === "string") return detail;
  }
  return fallback;
}
