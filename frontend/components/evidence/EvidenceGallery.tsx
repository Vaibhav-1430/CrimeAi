"use client";

import {
  Download,
  FileAudio,
  FileText,
  Film,
  ImageIcon,
  Loader2,
  Trash2
} from "lucide-react";
import { downloadEvidence, evidenceFileUrl } from "@/services/evidenceApi";
import { formatFileSize, MEDIA_TYPE_LABELS } from "@/lib/evidence";
import type { Evidence, EvidenceMediaType } from "@/types/case";

interface EvidenceGalleryProps {
  evidence: Evidence[];
  isLoading: boolean;
  canDelete: boolean;
  deletingId: number | null;
  onPreview: (evidence: Evidence) => void;
  onDelete: (evidence: Evidence) => void;
}

const typeIcon: Record<EvidenceMediaType, typeof ImageIcon> = {
  image: ImageIcon,
  video: Film,
  audio: FileAudio,
  pdf: FileText,
  document: FileText
};

export default function EvidenceGallery({
  evidence,
  isLoading,
  canDelete,
  deletingId,
  onPreview,
  onDelete
}: EvidenceGalleryProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <div
            key={index}
            className="aspect-square animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-800"
          />
        ))}
      </div>
    );
  }

  if (evidence.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-zinc-300 p-10 text-center dark:border-zinc-700">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          No evidence matches the current filters.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {evidence.map((item) => {
        const Icon = typeIcon[item.media_type];
        const url = evidenceFileUrl(item);

        return (
          <div
            key={item.id}
            className="group overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
          >
            <button
              type="button"
              onClick={() => onPreview(item)}
              className="relative flex aspect-square w-full items-center justify-center overflow-hidden bg-zinc-100 dark:bg-zinc-900"
            >
              {item.media_type === "image" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={url}
                  alt={item.file_name}
                  loading="lazy"
                  className="h-full w-full object-cover transition group-hover:scale-105"
                />
              ) : (
                <Icon className="h-10 w-10 text-zinc-400" />
              )}
              <span className="absolute left-2 top-2 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-white">
                {MEDIA_TYPE_LABELS[item.media_type]}
              </span>
            </button>

            <div className="flex items-center justify-between gap-2 px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-xs font-medium text-zinc-900 dark:text-zinc-100">
                  {item.file_name}
                </p>
                <p className="text-[11px] text-zinc-500">{formatFileSize(item.file_size)}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => void downloadEvidence(item)}
                  title="Download"
                  className="rounded p-1 text-zinc-500 transition hover:bg-zinc-100 hover:text-teal-700 dark:hover:bg-zinc-800"
                >
                  <Download className="h-4 w-4" />
                </button>
                {canDelete ? (
                  <button
                    type="button"
                    onClick={() => onDelete(item)}
                    disabled={deletingId === item.id}
                    title="Delete"
                    className="rounded p-1 text-zinc-500 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:hover:bg-red-950"
                  >
                    {deletingId === item.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
