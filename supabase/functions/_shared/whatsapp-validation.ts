export const WHATSAPP_WINDOW_HOURS = 24;
export const WHATSAPP_MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const WHATSAPP_MAX_AUDIO_BYTES = 16 * 1024 * 1024;
export const WHATSAPP_MAX_VIDEO_BYTES = 16 * 1024 * 1024;
export const WHATSAPP_MAX_DOCUMENT_BYTES = 100 * 1024 * 1024;
export const WHATSAPP_MAX_ATTACHMENT_BYTES = WHATSAPP_MAX_DOCUMENT_BYTES;

const allowedMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "audio/aac",
  "audio/amr",
  "audio/mpeg",
  "audio/mp4",
  "audio/ogg",
  "video/mp4",
  "video/3gp",
  "text/plain",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);

export const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};

export const asString = (value: unknown) => {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
};

export const baseMimeType = (value: unknown) => asString(value).toLowerCase().split(";")[0].trim();

export const normalizePhone = (value: unknown) => asString(value).replace(/\D/g, "");

export const safePreview = (value: unknown) => {
  const text = asString(value).replace(/\s+/g, " ");
  return text.length > 180 ? `${text.slice(0, 177)}...` : text;
};

export const errorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error) return error.message;
  const record = asRecord(error);
  return asString(record.message || record.details || record.error || record.code) || fallback;
};

export const activeWindowExpiresAt = (baseDate = new Date()) =>
  new Date(baseDate.getTime() + WHATSAPP_WINDOW_HOURS * 60 * 60 * 1000).toISOString();

export const isActiveWindowOpen = (expiresAt: string | null | undefined) => {
  if (!expiresAt) return false;
  const timestamp = Date.parse(expiresAt);
  return Number.isFinite(timestamp) && timestamp > Date.now();
};

export const classifyAttachment = (contentType: unknown, size: unknown) => {
  const type = baseMimeType(contentType);
  const sizeBytes = typeof size === "number" ? size : Number(size || 0);

  if (!allowedMimeTypes.has(type)) {
    return { allowed: false, reason: "unsupported_file_type", allowedType: null as string | null };
  }

  const maxBytes = type.startsWith("image/")
    ? WHATSAPP_MAX_IMAGE_BYTES
    : type.startsWith("audio/")
      ? WHATSAPP_MAX_AUDIO_BYTES
      : type.startsWith("video/")
        ? WHATSAPP_MAX_VIDEO_BYTES
        : WHATSAPP_MAX_DOCUMENT_BYTES;

  if (!Number.isFinite(sizeBytes) || sizeBytes < 0 || sizeBytes > maxBytes) {
    return { allowed: false, reason: "file_too_large", allowedType: null as string | null };
  }

  if (type.startsWith("image/")) return { allowed: true, reason: null, allowedType: "image" };
  if (type.startsWith("audio/")) return { allowed: true, reason: null, allowedType: "audio" };
  if (type.startsWith("video/")) return { allowed: true, reason: null, allowedType: "video" };
  if (type === "application/pdf") return { allowed: true, reason: null, allowedType: "pdf" };
  return { allowed: true, reason: null, allowedType: "document" };
};
