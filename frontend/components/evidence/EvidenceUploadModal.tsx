"use client";

import { AxiosError } from "axios";
import { FileUp, Loader2, UploadCloud, X } from "lucide-react";
import { useCallback, useRef, useState, type DragEvent } from "react";
import { uploadEvidence } from "@/services/evidenceApi";
import {
  ACCEPTED_EXTENSIONS,
  classifyFile,
  formatFileSize,
  MEDIA_TYPE_LABELS,
  validateFile
} from "@/lib/evidence";

interface EvidenceUploadModalProps {
  firId: number;
  onClose: () => void;
  onUploaded: () => void;
}

export default function EvidenceUploadModal({
  firId,
  onClose,
  onUploaded
}: EvidenceUploadModalProps) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [description, setDescription] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback((incoming: FileList | File[]) => {
    setError("");
    const next: File[] = [];
    for (const file of Array.from(incoming)) {
      const validationError = validateFile(file);
      if (validationError) {
        setError(validationError);
        continue;
      }
      next.push(file);
    }
    setSelectedFiles((current) => [...current, ...next]);
  }, []);

  const handleDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setIsDragging(false);
      if (event.dataTransfer.files?.length) {
        addFiles(event.dataTransfer.files);
      }
    },
    [addFiles]
  );

  const removeFile = (index: number) => {
    setSelectedFiles((current) => current.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (!selectedFiles.length) {
      setError("Select at least one file to upload.");
      return;
    }

    setIsUploading(true);
    setError("");
    setProgress(0);

    try {
      await uploadEvidence(firId, selectedFiles, {
        description: description.trim() || undefined,
        onProgress: setProgress
      });
      onUploaded();
      onClose();
    } catch (uploadError) {
      setError(getErrorMessage(uploadError, "Upload failed. Please try again."));
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-xl rounded-lg border border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
          <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-100">
            Upload Evidence
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={isUploading}
            className="rounded-md p-1 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-50 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid gap-4 px-5 py-5">
          {/* Drag & drop zone */}
          <div
            onDragOver={(event) => {
              event.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-6 py-10 text-center transition ${
              isDragging
                ? "border-teal-500 bg-teal-50 dark:bg-teal-950/30"
                : "border-zinc-300 hover:border-teal-400 dark:border-zinc-700"
            }`}
          >
            <UploadCloud className="h-8 w-8 text-teal-600 dark:text-teal-400" />
            <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
              Drag & drop files here, or click to browse
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Images, video, audio, PDF, documents · up to 100 MB each
            </p>
            <input
              ref={inputRef}
              type="file"
              multiple
              accept={ACCEPTED_EXTENSIONS}
              onChange={(event) => {
                if (event.target.files?.length) addFiles(event.target.files);
                event.target.value = "";
              }}
              className="hidden"
            />
          </div>

          {/* Selected files */}
          {selectedFiles.length > 0 ? (
            <ul className="grid max-h-48 gap-2 overflow-y-auto">
              {selectedFiles.map((file, index) => (
                <li
                  key={`${file.name}-${index}`}
                  className="flex items-center justify-between gap-3 rounded-md border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <FileUp className="h-4 w-4 shrink-0 text-zinc-500" />
                    <span className="truncate text-zinc-900 dark:text-zinc-100">
                      {file.name}
                    </span>
                    <span className="shrink-0 rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                      {MEDIA_TYPE_LABELS[classifyFile(file)]}
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-xs text-zinc-500">{formatFileSize(file.size)}</span>
                    {!isUploading ? (
                      <button
                        type="button"
                        onClick={() => removeFile(index)}
                        className="text-zinc-400 hover:text-red-600"
                        aria-label={`Remove ${file.name}`}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          ) : null}

          {/* Description */}
          <label className="grid gap-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Description (optional)
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={2}
              placeholder="Context for this evidence batch…"
              className="resize-none rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
          </label>

          {/* Progress bar */}
          {isUploading ? (
            <div className="grid gap-1.5">
              <div className="h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
                <div
                  className="h-full rounded-full bg-teal-600 transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs text-zinc-500">Uploading… {progress}%</p>
            </div>
          ) : null}

          {error ? (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
              {error}
            </div>
          ) : null}
        </div>

        <div className="flex justify-end gap-3 border-t border-zinc-200 px-5 py-4 dark:border-zinc-800">
          <button
            type="button"
            onClick={onClose}
            disabled={isUploading}
            className="inline-flex h-10 items-center rounded-md border border-zinc-300 px-4 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleUpload()}
            disabled={isUploading || selectedFiles.length === 0}
            className="inline-flex h-10 items-center gap-2 rounded-md bg-teal-700 px-4 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
            Upload {selectedFiles.length > 0 ? `(${selectedFiles.length})` : ""}
          </button>
        </div>
      </div>
    </div>
  );
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof AxiosError) {
    const detail = error.response?.data?.detail;
    if (typeof detail === "string") return detail;
  }
  return fallback;
}
