"use client";

import { Download, X } from "lucide-react";
import { useEffect } from "react";
import { downloadEvidence, evidenceFileUrl } from "@/services/evidenceApi";
import { formatFileSize } from "@/lib/evidence";
import type { Evidence } from "@/types/case";

interface EvidencePreviewProps {
  evidence: Evidence;
  onClose: () => void;
}

/** Full-screen preview that renders per media type: image, video, audio, PDF. */
export default function EvidencePreview({ evidence, onClose }: EvidencePreviewProps) {
  const url = evidenceFileUrl(evidence);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/85"
      onClick={onClose}
    >
      <div className="flex items-center justify-between gap-4 px-5 py-3 text-white">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{evidence.file_name}</p>
          <p className="text-xs text-zinc-300">
            {evidence.media_type.toUpperCase()} · {formatFileSize(evidence.file_size)}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              void downloadEvidence(evidence);
            }}
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-white/10 px-3 text-sm font-medium text-white transition hover:bg-white/20"
          >
            <Download className="h-4 w-4" />
            Download
          </button>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-white/10 text-white transition hover:bg-white/20"
            aria-label="Close preview"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div
        className="flex flex-1 items-center justify-center overflow-auto p-4"
        onClick={(event) => event.stopPropagation()}
      >
        {evidence.media_type === "image" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt={evidence.file_name}
            className="max-h-full max-w-full rounded object-contain"
          />
        ) : evidence.media_type === "video" ? (
          <video src={url} controls className="max-h-full max-w-full rounded" />
        ) : evidence.media_type === "audio" ? (
          <div className="w-full max-w-lg rounded-lg bg-white p-6 dark:bg-zinc-900">
            <p className="mb-3 text-sm font-medium text-zinc-800 dark:text-zinc-200">
              {evidence.file_name}
            </p>
            <audio src={url} controls className="w-full" />
          </div>
        ) : evidence.media_type === "pdf" ? (
          <iframe
            src={url}
            title={evidence.file_name}
            className="h-full w-full rounded bg-white"
          />
        ) : (
          <div className="rounded-lg bg-white p-8 text-center dark:bg-zinc-900">
            <p className="text-sm text-zinc-700 dark:text-zinc-300">
              Preview is not available for this file type.
            </p>
            <button
              type="button"
              onClick={() => void downloadEvidence(evidence)}
              className="mt-4 inline-flex h-10 items-center gap-2 rounded-md bg-teal-700 px-4 text-sm font-semibold text-white hover:bg-teal-800"
            >
              <Download className="h-4 w-4" />
              Download file
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
