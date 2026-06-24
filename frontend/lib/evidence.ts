import type { EvidenceMediaType } from "@/types/case";

export const MAX_EVIDENCE_BYTES = 100 * 1024 * 1024; // 100 MB — matches backend cap.

export const ACCEPTED_EXTENSIONS =
  ".jpg,.jpeg,.png,.gif,.webp,.bmp,.mp4,.mov,.avi,.mkv,.webm,.mp3,.wav,.ogg,.m4a,.aac,.pdf,.doc,.docx,.xls,.xlsx,.txt";

/** Classify a File into a logical media type (mirrors backend logic). */
export function classifyFile(file: File): EvidenceMediaType {
  const type = file.type.toLowerCase();
  if (type.startsWith("image/")) return "image";
  if (type.startsWith("video/")) return "video";
  if (type.startsWith("audio/")) return "audio";
  if (type === "application/pdf") return "pdf";

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (["jpg", "jpeg", "png", "gif", "webp", "bmp"].includes(ext)) return "image";
  if (["mp4", "mov", "avi", "mkv", "webm"].includes(ext)) return "video";
  if (["mp3", "wav", "ogg", "m4a", "aac"].includes(ext)) return "audio";
  if (ext === "pdf") return "pdf";
  return "document";
}

/** Human-readable byte size, e.g. "2.4 MB". */
export function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes && bytes !== 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(1)} ${units[unitIndex]}`;
}

/** Validate a file against the size cap. Returns an error message or null. */
export function validateFile(file: File): string | null {
  if (file.size > MAX_EVIDENCE_BYTES) {
    return `${file.name} exceeds the 100 MB limit (${formatFileSize(file.size)}).`;
  }
  if (file.size === 0) {
    return `${file.name} is empty.`;
  }
  return null;
}

export const MEDIA_TYPE_LABELS: Record<EvidenceMediaType, string> = {
  image: "Image",
  video: "Video",
  pdf: "PDF",
  audio: "Audio",
  document: "Document"
};
