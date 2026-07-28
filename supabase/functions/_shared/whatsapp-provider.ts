import { asRecord, asString, baseMimeType, normalizePhone, safePreview } from "./whatsapp-validation.ts";

export interface NormalizedWhatsAppMessage {
  providerMessageId: string | null;
  providerMediaId: string | null;
  providerPhoneNumberId: string | null;
  providerDisplayPhoneNumber: string | null;
  fromPhone: string;
  displayName: string | null;
  body: string;
  messageType: "text" | "image" | "audio" | "video" | "document" | "unknown";
  contentType: string | null;
  fileName: string | null;
  sizeBytes: number | null;
  timestamp: string;
  interactiveReplyId: string | null;
  interactiveReplyTitle: string | null;
}

export const normalizeInboundMessage = (payload: unknown): NormalizedWhatsAppMessage | null => {
  const root = asRecord(payload);
  const direct = asRecord(root.message);
  const entry = Array.isArray(root.entry) ? asRecord(root.entry[0]) : {};
  const change = Array.isArray(entry.changes) ? asRecord(entry.changes[0]) : {};
  const value = asRecord(change.value);
  const metadata = asRecord(value.metadata);
  const message = Object.keys(direct).length > 0
    ? direct
    : Array.isArray(value.messages)
      ? asRecord(value.messages[0])
      : {};

  if (Object.keys(message).length === 0) return null;

  const contacts = Array.isArray(value.contacts) ? asRecord(value.contacts[0]) : {};
  const profile = asRecord(contacts.profile);
  const type = asString(message.type) || "text";
  const text = asRecord(message.text);
  const image = asRecord(message.image);
  const audio = asRecord(message.audio);
  const video = asRecord(message.video);
  const document = asRecord(message.document);
  const interactive = asRecord(message.interactive);
  const buttonReply = asRecord(interactive.button_reply);
  const listReply = asRecord(interactive.list_reply);
  const interactiveReplyId = asString(buttonReply.id || listReply.id) || null;
  const interactiveReplyTitle = asString(buttonReply.title || listReply.title) || null;
  const media = type === "image"
    ? image
    : type === "audio"
      ? audio
      : type === "video"
        ? video
        : type === "document"
          ? document
          : {};
  const timestampSeconds = Number(asString(message.timestamp));
  const messageType = ["image", "audio", "video", "document"].includes(type)
    ? type as "image" | "audio" | "video" | "document"
    : type === "text"
      ? "text"
      : "unknown";

  return {
    providerMessageId: asString(message.id) || null,
    providerMediaId: asString(media.id) || null,
    providerPhoneNumberId: asString(metadata.phone_number_id || root.phone_number_id) || null,
    providerDisplayPhoneNumber: asString(metadata.display_phone_number || root.display_phone_number) || null,
    fromPhone: normalizePhone(message.from || root.from || contacts.wa_id),
    displayName: asString(profile.name || root.display_name) || null,
    body: asString(text.body || media.caption || interactiveReplyTitle || root.body || ""),
    messageType: interactiveReplyId ? "text" : messageType,
    contentType: asString(media.mime_type) || null,
    fileName: asString(media.filename) || null,
    sizeBytes: media.file_size ? Number(media.file_size) : null,
    timestamp: Number.isFinite(timestampSeconds) && timestampSeconds > 0
      ? new Date(timestampSeconds * 1000).toISOString()
      : new Date().toISOString(),
    interactiveReplyId,
    interactiveReplyTitle,
  };
};

export const normalizeStatusUpdate = (payload: unknown) => {
  const root = asRecord(payload);
  const direct = asRecord(root.status);
  const entry = Array.isArray(root.entry) ? asRecord(root.entry[0]) : {};
  const change = Array.isArray(entry.changes) ? asRecord(entry.changes[0]) : {};
  const value = asRecord(change.value);
  const metadata = asRecord(value.metadata);
  const status = Object.keys(direct).length > 0
    ? direct
    : Array.isArray(value.statuses)
      ? asRecord(value.statuses[0])
      : {};

  if (Object.keys(status).length === 0) return null;
  return {
    providerMessageId: asString(status.id),
    providerPhoneNumberId: asString(metadata.phone_number_id || root.phone_number_id) || null,
    providerDisplayPhoneNumber: asString(metadata.display_phone_number || root.display_phone_number) || null,
    deliveryStatus: asString(status.status) || "sent",
    failureReason: asString(status.errors ? JSON.stringify(status.errors) : "") || null,
  };
};

const DEFAULT_WHATSAPP_GRAPH_API_VERSION = "v23.0";

interface WhatsAppProviderConfig {
  accessToken: string;
  phoneNumberId: string;
  graphApiVersion: string;
}

const loadProviderConfig = (): WhatsAppProviderConfig => {
  const accessToken = Deno.env.get("WHATSAPP_ACCESS_TOKEN")?.trim() || "";
  const phoneNumberId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID")?.trim() || "";
  const graphApiVersion = Deno.env.get("WHATSAPP_GRAPH_API_VERSION")?.trim() || DEFAULT_WHATSAPP_GRAPH_API_VERSION;

  if (!accessToken || !phoneNumberId) {
    throw new Error("whatsapp_provider_not_configured");
  }

  return { accessToken, phoneNumberId, graphApiVersion };
};

const graphUrl = (config: WhatsAppProviderConfig, path: string) =>
  `https://graph.facebook.com/${config.graphApiVersion}/${path}`;

const parseProviderResponse = async (response: Response) => {
  const payload = asRecord(await response.json().catch(() => ({})));
  if (response.ok) return payload;

  const error = asRecord(payload.error);
  const message = asString(error.message) || `HTTP ${response.status}`;
  const type = asString(error.type);
  const code = asString(error.code);
  const subcode = asString(error.error_subcode);
  const errorData = asRecord(error.error_data);
  const details = asString(errorData.details);
  const metadata = [
    type ? `type=${type}` : "",
    code ? `code=${code}` : "",
    subcode ? `subcode=${subcode}` : "",
  ].filter(Boolean).join(" ");
  const fullMessage = [message, details, metadata].filter(Boolean).join(": ");
  throw new Error(`whatsapp_provider_failed: ${safePreview(fullMessage)}`);
};

const postProviderJson = async (path: string, body: Record<string, unknown>) => {
  const config = loadProviderConfig();
  const response = await fetch(graphUrl(config, path), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  return parseProviderResponse(response);
};

const postProviderForm = async (path: string, formData: FormData) => {
  const config = loadProviderConfig();
  const response = await fetch(graphUrl(config, path), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.accessToken}`,
    },
    body: formData,
  });

  return parseProviderResponse(response);
};

const getProviderJson = async (path: string) => {
  const config = loadProviderConfig();
  const response = await fetch(graphUrl(config, path), {
    headers: {
      Authorization: `Bearer ${config.accessToken}`,
    },
  });

  return parseProviderResponse(response);
};

const providerMessageId = (payload: Record<string, unknown>) => {
  const messages = Array.isArray(payload.messages) ? payload.messages : [];
  const firstMessage = asRecord(messages[0]);
  return asString(firstMessage.id);
};

const isRecipientNotAllowedError = (error: unknown) =>
  error instanceof Error && (error.message.includes("#131030") || error.message.includes("code=131030"));

export type WhatsAppProviderFailureKind =
  | "recipient_not_allowed"
  | "authentication"
  | "reengagement_window"
  | "country_restricted"
  | "not_configured"
  | "unknown";

export function classifyWhatsAppProviderFailure(error: unknown): {
  kind: WhatsAppProviderFailureKind;
  retryable: boolean;
  reason: string;
} {
  const message = error instanceof Error ? error.message : String(error ?? "");

  if (message.includes("#131030") || message.includes("code=131030") || message.includes("Recipient phone number not in allowed list")) {
    return { kind: "recipient_not_allowed", retryable: false, reason: "recipient_not_allowed" };
  }

  if (message.includes("code=190") || message.includes("OAuthException") || message.includes("Authentication Error")) {
    return { kind: "authentication", retryable: false, reason: "authentication_error" };
  }

  if (message.includes("#131047") || message.includes("code=131047") || message.includes("Re-engagement message")) {
    return { kind: "reengagement_window", retryable: false, reason: "reengagement_window_expired" };
  }

  if (message.includes("130497") || message.includes("restricted from messaging users in this country")) {
    return { kind: "country_restricted", retryable: false, reason: "country_restricted" };
  }

  if (message.includes("whatsapp_provider_not_configured")) {
    return { kind: "not_configured", retryable: false, reason: "provider_not_configured" };
  }

  return { kind: "unknown", retryable: false, reason: "provider_failed" };
}

const recipientPhoneVariants = (value: unknown) => {
  const phone = normalizePhone(value);
  if (!phone) return [];

  const variants = [phone];
  const local = phone.startsWith("55") ? phone.slice(2) : phone;

  if (local.length === 10) {
    variants.push(`55${local.slice(0, 2)}9${local.slice(2)}`);
  } else if (local.length === 11 && local[2] === "9") {
    variants.push(`55${local.slice(0, 2)}${local.slice(3)}`);
  }

  return Array.from(new Set(variants));
};

const postProviderMessageWithRecipientFallback = async (
  phoneNumberId: string,
  toPhone: string,
  payloadForPhone: (phone: string) => Record<string, unknown>,
) => {
  const variants = recipientPhoneVariants(toPhone);
  if (variants.length === 0) throw new Error("whatsapp_provider_missing_recipient_phone");

  let lastError: unknown = null;
  for (let index = 0; index < variants.length; index += 1) {
    try {
      return await postProviderJson(`${phoneNumberId}/messages`, payloadForPhone(variants[index]));
    } catch (error) {
      lastError = error;
      if (!isRecipientNotAllowedError(error) || index === variants.length - 1) throw error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("whatsapp_provider_send_failed");
};

export async function dispatchWhatsAppTextMessage(args: {
  toPhone: string;
  body: string;
  clientMessageId: string;
  replyToProviderMessageId?: string | null;
  phoneNumberId?: string | null;
}) {
  const config = loadProviderConfig();
  const phoneNumberId = args.phoneNumberId?.trim() || config.phoneNumberId;
  const payload = await postProviderMessageWithRecipientFallback(phoneNumberId, args.toPhone, (phone) => {
    const messagePayload: Record<string, unknown> = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: phone,
      type: "text",
      text: {
        preview_url: false,
        body: args.body,
      },
    };

    if (args.replyToProviderMessageId) {
      messagePayload.context = { message_id: args.replyToProviderMessageId };
    }

    return messagePayload;
  });

  const messageId = providerMessageId(payload);
  if (!messageId) throw new Error("whatsapp_provider_missing_message_id");

  return {
    providerMessageId: messageId,
    deliveryStatus: "sent" as const,
  };
}

export async function dispatchWhatsAppInteractiveMessage(args: {
  toPhone: string;
  payloadForPhone: (phone: string) => Record<string, unknown>;
  phoneNumberId?: string | null;
}) {
  const config = loadProviderConfig();
  const phoneNumberId = args.phoneNumberId?.trim() || config.phoneNumberId;
  const payload = await postProviderMessageWithRecipientFallback(phoneNumberId, args.toPhone, args.payloadForPhone);
  const messageId = providerMessageId(payload);
  if (!messageId) throw new Error("whatsapp_provider_missing_message_id");

  return {
    providerMessageId: messageId,
    deliveryStatus: "sent" as const,
  };
}

export async function dispatchWhatsAppTemplateMessage(args: {
  toPhone: string;
  templateName: string;
  languageCode?: string | null;
  bodyParameters?: string[];
  phoneNumberId?: string | null;
}) {
  const config = loadProviderConfig();
  const phoneNumberId = args.phoneNumberId?.trim() || config.phoneNumberId;
  const payload = await postProviderMessageWithRecipientFallback(phoneNumberId, args.toPhone, (phone) => {
    const parameters = (args.bodyParameters || [])
      .map((parameter) => parameter.trim())
      .filter(Boolean)
      .map((parameter) => ({ type: "text", text: parameter }));

    const templatePayload: Record<string, unknown> = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: phone,
      type: "template",
      template: {
        name: args.templateName,
        language: { code: args.languageCode || "pt_BR" },
        ...(parameters.length > 0
          ? {
              components: [
                {
                  type: "body",
                  parameters,
                },
              ],
            }
          : {}),
      },
    };

    return templatePayload;
  });

  const messageId = providerMessageId(payload);
  if (!messageId) throw new Error("whatsapp_provider_missing_message_id");

  return {
    providerMessageId: messageId,
    deliveryStatus: "sent" as const,
  };
}

export async function dispatchWhatsAppMediaMessage(args: {
  toPhone: string;
  file: Blob;
  fileName: string;
  contentType: string;
  caption: string | null;
  phoneNumberId?: string | null;
}) {
  const config = loadProviderConfig();
  const phoneNumberId = args.phoneNumberId?.trim() || config.phoneNumberId;
  const formData = new FormData();
  formData.append("messaging_product", "whatsapp");
  formData.append("type", baseMimeType(args.contentType) || args.contentType);
  formData.append("file", args.file, args.fileName);

  const uploaded = await postProviderForm(`${phoneNumberId}/media`, formData);
  const mediaId = asString(uploaded.id);
  if (!mediaId) throw new Error("whatsapp_provider_missing_media_id");

  const contentType = baseMimeType(args.contentType) || args.contentType;
  const mediaType = contentType.startsWith("image/")
    ? "image"
    : contentType.startsWith("audio/")
      ? "audio"
      : contentType.startsWith("video/")
        ? "video"
        : "document";
  const mediaPayload: Record<string, unknown> = { id: mediaId };
  if (args.caption && mediaType !== "audio") mediaPayload.caption = args.caption;
  if (mediaType === "document") mediaPayload.filename = args.fileName;

  const sent = await postProviderMessageWithRecipientFallback(phoneNumberId, args.toPhone, (phone) => ({
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: phone,
    type: mediaType,
    [mediaType]: mediaPayload,
  }));

  const messageId = providerMessageId(sent);
  if (!messageId) throw new Error("whatsapp_provider_missing_message_id");

  return {
    providerMessageId: messageId,
    providerMediaId: mediaId,
    deliveryStatus: "sent" as const,
  };
}

export async function downloadWhatsAppMedia(providerMediaId: string, phoneNumberIdOverride?: string | null) {
  const config = loadProviderConfig();
  const phoneNumberId = phoneNumberIdOverride?.trim() || config.phoneNumberId;
  const media = await getProviderJson(`${providerMediaId}?phone_number_id=${encodeURIComponent(phoneNumberId)}`);
  const mediaUrl = asString(media.url);
  if (!mediaUrl) throw new Error("whatsapp_provider_missing_media_url");

  const response = await fetch(mediaUrl, {
    headers: {
      Authorization: `Bearer ${config.accessToken}`,
    },
  });
  if (!response.ok) {
    throw new Error(`whatsapp_provider_media_download_failed: HTTP ${response.status}`);
  }

  const contentType = response.headers.get("content-type") || asString(media.mime_type);
  return {
    file: await response.blob(),
    contentType,
  };
}
