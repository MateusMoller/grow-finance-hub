export type WhatsAppConversationStatus = "open" | "in_attendance" | "pending_client" | "resolved" | "archived";
export type WhatsAppMessageDirection = "inbound" | "outbound";
export type WhatsAppMessageType = "text" | "image" | "audio" | "video" | "document" | "unknown";
export type WhatsAppDeliveryStatus = "queued" | "sending" | "sent" | "delivered" | "read" | "failed" | "received";
export type WhatsAppAttachmentStatus = "pending" | "stored" | "sent" | "failed" | "blocked";
export type WhatsAppMatchStatus = "matched" | "unmatched" | "manual" | "conflict";

export const WHATSAPP_MODULE_KEY = "whatsapp" as const;
export const WHATSAPP_MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const WHATSAPP_MAX_AUDIO_BYTES = 16 * 1024 * 1024;
export const WHATSAPP_MAX_VIDEO_BYTES = 16 * 1024 * 1024;
export const WHATSAPP_MAX_DOCUMENT_BYTES = 100 * 1024 * 1024;
export const WHATSAPP_MAX_ATTACHMENT_BYTES = WHATSAPP_MAX_DOCUMENT_BYTES;

export const WHATSAPP_ALLOWED_MIME_TYPES = new Set([
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

export interface WhatsAppContactSummary {
  id: string;
  phone_number: string;
  display_name: string | null;
  profile_name: string | null;
  match_status: WhatsAppMatchStatus;
  client_id: string | null;
  is_blocked: boolean;
}

export interface WhatsAppConversationSummary {
  id: string;
  organization_id: string;
  contact_id: string;
  client_id: string | null;
  status: WhatsAppConversationStatus;
  assigned_to_user_id: string | null;
  assigned_team: string | null;
  last_message_at: string | null;
  last_message_preview: string | null;
  unread_count: number;
  active_window_expires_at: string | null;
  client_name?: string | null;
  contact?: WhatsAppContactSummary | null;
}

export interface WhatsAppAttachment {
  id: string;
  file_name: string | null;
  content_type: string | null;
  size_bytes: number | null;
  status: WhatsAppAttachmentStatus;
  failure_reason: string | null;
  storage_path: string | null;
}

export interface WhatsAppMessage {
  id: string;
  conversation_id: string;
  direction: WhatsAppMessageDirection;
  sender_user_id: string | null;
  message_type: WhatsAppMessageType;
  body: string | null;
  safe_preview: string | null;
  delivery_status: WhatsAppDeliveryStatus;
  failure_reason: string | null;
  blocked_reason: string | null;
  sent_at: string | null;
  received_at: string | null;
  created_at: string;
  attachments?: WhatsAppAttachment[];
}

export interface WhatsAppConversationFilters {
  search?: string;
  status?: WhatsAppConversationStatus | "all";
  unread?: boolean;
  assignedToUserId?: string | "all";
  clientId?: string | "all";
  dateFrom?: string | null;
  dateTo?: string | null;
}

export const isWhatsAppWindowActive = (expiresAt: string | null | undefined) => {
  if (!expiresAt) return false;
  const expires = new Date(expiresAt).getTime();
  return Number.isFinite(expires) && expires > Date.now();
};

export const normalizePhoneForWhatsApp = (value: string | null | undefined) =>
  (value || "").replace(/\D/g, "");

export const whatsAppAttachmentLimitForType = (contentType: string) => {
  if (contentType.startsWith("image/")) return WHATSAPP_MAX_IMAGE_BYTES;
  if (contentType.startsWith("audio/")) return WHATSAPP_MAX_AUDIO_BYTES;
  if (contentType.startsWith("video/")) return WHATSAPP_MAX_VIDEO_BYTES;
  return WHATSAPP_MAX_DOCUMENT_BYTES;
};

export const isAllowedWhatsAppAttachment = (file: Pick<File, "type" | "size">) =>
  WHATSAPP_ALLOWED_MIME_TYPES.has(file.type) && file.size <= whatsAppAttachmentLimitForType(file.type);
