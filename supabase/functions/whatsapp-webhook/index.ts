import { buildSupabaseAdminClient, jsonResponse, corsHeaders } from "../_shared/whatsapp-auth.ts";
import { createWhatsAppEvent, createWhatsAppNotification } from "../_shared/whatsapp-events.ts";
import { downloadWhatsAppMedia, normalizeInboundMessage, normalizeStatusUpdate } from "../_shared/whatsapp-provider.ts";
import { activeWindowExpiresAt, asString, baseMimeType, classifyAttachment, errorMessage, safePreview } from "../_shared/whatsapp-validation.ts";

const verifyWebhook = (request: Request) => {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const challenge = url.searchParams.get("hub.challenge");
  const token = url.searchParams.get("hub.verify_token");
  const expectedToken = Deno.env.get("WHATSAPP_VERIFY_TOKEN");

  if (mode === "subscribe" && challenge && token && expectedToken && token === expectedToken) {
    return new Response(challenge, { status: 200 });
  }

  return jsonResponse({ error: "invalid_verification" }, 403);
};

type SupabaseAdmin = ReturnType<typeof buildSupabaseAdminClient>;

const bytesToHex = (bytes: ArrayBuffer) =>
  Array.from(new Uint8Array(bytes))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

const timingSafeEqual = (first: string, second: string) => {
  if (first.length !== second.length) return false;

  let mismatch = 0;
  for (let index = 0; index < first.length; index += 1) {
    mismatch |= first.charCodeAt(index) ^ second.charCodeAt(index);
  }
  return mismatch === 0;
};

async function assertWebhookSignature(request: Request, rawBody: string) {
  const appSecret = Deno.env.get("WHATSAPP_APP_SECRET")?.trim();
  if (!appSecret) return;

  const signatureHeader = request.headers.get("x-hub-signature-256") || "";
  const receivedSignature = signatureHeader.startsWith("sha256=")
    ? signatureHeader.slice("sha256=".length)
    : "";
  if (!receivedSignature) throw new Error("missing_whatsapp_signature");

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(appSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const expectedSignature = bytesToHex(
    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody)),
  );

  if (!timingSafeEqual(receivedSignature, expectedSignature)) {
    throw new Error("invalid_whatsapp_signature");
  }
}

const parseWebhookPayload = (rawBody: string): Record<string, unknown> => {
  const parsed = JSON.parse(rawBody || "{}");
  return parsed && typeof parsed === "object" && !Array.isArray(parsed)
    ? parsed as Record<string, unknown>
    : {};
};

async function recordWebhookLog(
  supabaseAdmin: SupabaseAdmin,
  payload: Record<string, unknown>,
  status: string,
  details?: Record<string, unknown>,
) {
  const inbound = normalizeInboundMessage(payload);
  const organizationId = await findOrganizationId(supabaseAdmin, payload).catch(() => null);

  await supabaseAdmin.from("whatsapp_webhook_logs").insert({
    organization_id: organizationId,
    direction: "inbound",
    phone: inbound?.fromPhone || null,
    message_type: inbound?.messageType || null,
    provider_message_id: inbound?.providerMessageId || null,
    payload: { ...payload, grow_processing: details || {} },
    processing_status: status,
  });
}

async function findOrganizationId(supabaseAdmin: SupabaseAdmin, payload: Record<string, unknown>) {
  const explicit = typeof payload.organization_id === "string" ? payload.organization_id : null;
  if (explicit) return explicit;

  const { data, error } = await supabaseAdmin
    .from("organizations")
    .select("id")
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data?.id) throw new Error("organization_mapping_not_found");
  return data.id as string;
}

const onlyDigits = (value: unknown) => String(value || "").replace(/\D/g, "");

const withoutBrazilCountryCode = (digits: string) =>
  digits.startsWith("55") && digits.length > 11 ? digits.slice(2) : digits;

const phoneVariants = (value: unknown) => {
  const digits = onlyDigits(value);
  if (!digits) return new Set<string>();

  const local = withoutBrazilCountryCode(digits);
  const variants = new Set([digits, local]);

  if (local.length === 10) {
    variants.add(`${local.slice(0, 2)}9${local.slice(2)}`);
  }

  if (local.length === 11 && local[2] === "9") {
    variants.add(`${local.slice(0, 2)}${local.slice(3)}`);
  }

  for (const variant of Array.from(variants)) {
    if (variant.length >= 10 && !variant.startsWith("55")) {
      variants.add(`55${variant}`);
    }
  }

  return variants;
};

const phonesMatch = (first: unknown, second: unknown) => {
  const firstVariants = phoneVariants(first);
  const secondVariants = phoneVariants(second);
  for (const variant of firstVariants) {
    if (secondVariants.has(variant)) return true;
  }
  return false;
};

const combineDddAndPhone = (ddd: string | null | undefined, phone: string | null | undefined) => {
  const dddDigits = onlyDigits(ddd);
  const phoneDigits = onlyDigits(phone);
  if (!phoneDigits) return null;
  if (phoneDigits.length >= 10) return phoneDigits;
  return dddDigits ? `${dddDigits}${phoneDigits}` : phoneDigits;
};

const normalizeName = (value: unknown) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const namesMatch = (first: unknown, second: unknown) => {
  const firstName = normalizeName(first);
  const secondName = normalizeName(second);
  if (!firstName || !secondName) return false;
  return firstName.includes(secondName) || secondName.includes(firstName);
};

const extensionForMimeType = (contentType: unknown) => {
  const type = baseMimeType(contentType);
  if (type === "audio/ogg") return "ogg";
  if (type === "audio/mpeg") return "mp3";
  if (type === "audio/mp4") return "m4a";
  if (type === "audio/aac") return "aac";
  if (type === "audio/amr") return "amr";
  if (type === "video/mp4") return "mp4";
  if (type === "video/3gp") return "3gp";
  if (type === "image/jpeg") return "jpg";
  if (type === "image/png") return "png";
  if (type === "application/pdf") return "pdf";
  if (type === "text/plain") return "txt";
  return "bin";
};

const fallbackInboundFileName = (messageType: string, contentType: unknown) =>
  `${messageType || "arquivo"}-${Date.now()}.${extensionForMimeType(contentType)}`;

async function findUniqueClientByPhone(
  supabaseAdmin: SupabaseAdmin,
  organizationId: string,
  phoneNumber: string,
  displayName: string | null,
) {
  if (!phoneNumber) return { clientId: null, matchStatus: "unmatched", autoLinkSource: null };

  const { data: clients, error } = await supabaseAdmin
    .from("clients")
    .select("id, name, contact, phone")
    .eq("organization_id", organizationId)
    .eq("status", "Ativo")
    .limit(5000);
  if (error) throw error;

  const clientIds = (clients || []).map((client) => client.id as string);
  const { data: clientData, error: clientDataError } = clientIds.length > 0
    ? await supabaseAdmin
      .from("client_data")
      .select("client_id, field_name, field_value")
      .in("client_id", clientIds)
      .in("field_name", ["whatsapp", "telefone", "ddd"])
    : { data: [], error: null };
  if (clientDataError) throw clientDataError;

  const dddByClient = new Map<string, string | null>();
  const telefoneByClient = new Map<string, string | null>();
  const whatsappByClient = new Map<string, string | null>();

  for (const row of clientData || []) {
    const clientId = asString(row.client_id);
    const fieldName = asString(row.field_name)?.toLowerCase();
    const fieldValue = asString(row.field_value);
    if (!clientId || !fieldName || !fieldValue) continue;
    if (fieldName === "ddd") dddByClient.set(clientId, fieldValue);
    if (fieldName === "telefone") telefoneByClient.set(clientId, fieldValue);
    if (fieldName === "whatsapp") whatsappByClient.set(clientId, fieldValue);
  }

  const matches = [];
  for (const client of clients || []) {
    const clientId = client.id as string;
    const candidates = [
      { source: "clients.phone", value: client.phone },
      { source: "client_data.whatsapp", value: whatsappByClient.get(clientId) },
      { source: "client_data.telefone", value: combineDddAndPhone(dddByClient.get(clientId), telefoneByClient.get(clientId)) },
      { source: "client_data.telefone", value: telefoneByClient.get(clientId) },
    ];
    const matched = candidates.find((candidate) => candidate.value && phonesMatch(phoneNumber, candidate.value));
    if (matched) {
      matches.push({
        clientId,
        source: matched.source,
        nameScore: namesMatch(displayName, client.name) || namesMatch(displayName, client.contact) ? 1 : 0,
      });
    }
  }

  if (matches.length === 1) {
    return { clientId: matches[0].clientId, matchStatus: "matched", autoLinkSource: "unique_phone_match" };
  }

  if (matches.length > 1) {
    const nameMatches = matches.filter((match) => match.nameScore > 0);
    if (nameMatches.length === 1) {
      return { clientId: nameMatches[0].clientId, matchStatus: "matched", autoLinkSource: "unique_phone_match" };
    }
    return { clientId: null, matchStatus: "conflict", autoLinkSource: null };
  }

  return { clientId: null, matchStatus: "unmatched", autoLinkSource: null };
}

async function processStatus(supabaseAdmin: SupabaseAdmin, status: NonNullable<ReturnType<typeof normalizeStatusUpdate>>) {
  if (!status.providerMessageId) return { ok: true, ignored: "missing_provider_message_id" };
  const { data: message, error: messageError } = await supabaseAdmin
    .from("whatsapp_messages")
    .select("id, organization_id, conversation_id")
    .eq("provider_message_id", status.providerMessageId)
    .maybeSingle();
  if (messageError) throw messageError;
  if (!message) return { ok: true, ignored: "message_not_found" };

  const { error: updateError } = await supabaseAdmin
    .from("whatsapp_messages")
    .update({
      delivery_status: status.deliveryStatus,
      failure_reason: status.failureReason,
      updated_at: new Date().toISOString(),
    })
    .eq("id", message.id);
  if (updateError) throw updateError;

  await createWhatsAppEvent(supabaseAdmin, {
    organization_id: message.organization_id,
    conversation_id: message.conversation_id,
    message_id: message.id,
    event_type: status.deliveryStatus === "failed" ? "send_failed" : "delivery_updated",
    provider_event_id: status.providerMessageId,
    details: { delivery_status: status.deliveryStatus },
  });

  return { ok: true, status: status.deliveryStatus };
}

async function processInbound(supabaseAdmin: SupabaseAdmin, payload: Record<string, unknown>) {
  const inbound = normalizeInboundMessage(payload);
  if (!inbound) return { ok: true, ignored: "unsupported_payload" };
  if (!inbound.fromPhone) throw new Error("missing_contact_phone");

  const organizationId = await findOrganizationId(supabaseAdmin, payload);
  const clientMatch = await findUniqueClientByPhone(supabaseAdmin, organizationId, inbound.fromPhone, inbound.displayName);

  const { data: existingContact, error: existingContactError } = await supabaseAdmin
    .from("whatsapp_contacts")
    .select("id, client_id, match_status, auto_link_source")
    .eq("organization_id", organizationId)
    .eq("phone_number", inbound.fromPhone)
    .maybeSingle();
  if (existingContactError) throw existingContactError;

  const hasLockedManualClientLink = Boolean(
    existingContact?.client_id &&
    (existingContact.match_status === "manual" || existingContact.auto_link_source === "manual"),
  );
  const resolvedContactClientId = hasLockedManualClientLink
    ? existingContact.client_id
    : clientMatch.clientId;
  const resolvedMatchStatus = hasLockedManualClientLink
    ? "manual"
    : clientMatch.matchStatus;
  const resolvedAutoLinkSource = hasLockedManualClientLink
    ? "manual"
    : clientMatch.autoLinkSource;

  const { data: contact, error: contactError } = await supabaseAdmin
    .from("whatsapp_contacts")
    .upsert({
      organization_id: organizationId,
      phone_number: inbound.fromPhone,
      display_name: inbound.displayName,
      profile_name: inbound.displayName,
      client_id: resolvedContactClientId,
      match_status: resolvedMatchStatus,
      auto_link_source: resolvedAutoLinkSource,
      last_seen_at: inbound.timestamp,
      updated_at: new Date().toISOString(),
    }, { onConflict: "organization_id,phone_number" })
    .select("id, client_id")
    .single();
  if (contactError) throw contactError;

  const { data: existingConversation, error: existingError } = await supabaseAdmin
    .from("whatsapp_conversations")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("contact_id", contact.id)
    .neq("status", "archived")
    .maybeSingle();
  if (existingError) throw existingError;

  const conversationPayload = {
    organization_id: organizationId,
    contact_id: contact.id,
    client_id: contact.client_id,
    status: existingConversation?.status === "resolved" ? "open" : existingConversation?.status || "open",
    last_message_at: inbound.timestamp,
    last_message_preview: safePreview(inbound.body || inbound.messageType),
    unread_count: (existingConversation?.unread_count || 0) + 1,
    last_inbound_at: inbound.timestamp,
    active_window_expires_at: activeWindowExpiresAt(new Date(inbound.timestamp)),
    updated_at: new Date().toISOString(),
  };

  const { data: conversation, error: conversationError } = existingConversation
    ? await supabaseAdmin
      .from("whatsapp_conversations")
      .update(conversationPayload)
      .eq("id", existingConversation.id)
      .select("*")
      .single()
    : await supabaseAdmin
      .from("whatsapp_conversations")
      .insert(conversationPayload)
      .select("*")
      .single();
  if (conversationError) throw conversationError;

  const { data: message, error: messageError } = await supabaseAdmin
    .from("whatsapp_messages")
    .upsert({
      organization_id: organizationId,
      conversation_id: conversation.id,
      contact_id: contact.id,
      client_id: contact.client_id,
      direction: "inbound",
      provider_message_id: inbound.providerMessageId,
      message_type: inbound.messageType,
      body: inbound.body,
      safe_preview: safePreview(inbound.body || inbound.messageType),
      delivery_status: "received",
      received_at: inbound.timestamp,
      created_at: inbound.timestamp,
      updated_at: new Date().toISOString(),
    }, { onConflict: "organization_id,provider_message_id" })
    .select("*")
    .single();
  if (messageError) throw messageError;

  await supabaseAdmin
    .from("whatsapp_conversations")
    .update({ last_message_id: message.id })
    .eq("id", conversation.id);

  if (inbound.providerMediaId) {
    const attachmentStatus = classifyAttachment(inbound.contentType, inbound.sizeBytes || 0);
    const fileName = inbound.fileName || fallbackInboundFileName(inbound.messageType, inbound.contentType);
    const storagePath = attachmentStatus.allowed
      ? `${organizationId}/${conversation.id}/${message.id}/${fileName}`
      : null;
    const { data: attachment, error: attachmentError } = await supabaseAdmin
      .from("whatsapp_conversation_attachments")
      .insert({
      organization_id: organizationId,
      conversation_id: conversation.id,
      message_id: message.id,
      direction: "inbound",
      provider_media_id: inbound.providerMediaId,
      storage_path: storagePath,
      file_name: fileName,
      content_type: inbound.contentType,
      size_bytes: inbound.sizeBytes,
      allowed_type: attachmentStatus.allowedType,
      status: attachmentStatus.allowed ? "pending" : "blocked",
      failure_reason: attachmentStatus.reason,
    })
      .select("id, storage_path")
      .single();
    if (attachmentError) throw attachmentError;

    if (attachmentStatus.allowed && attachment?.storage_path) {
      try {
        const downloaded = await downloadWhatsAppMedia(inbound.providerMediaId);
        const uploadContentType = baseMimeType(downloaded.contentType) || baseMimeType(inbound.contentType) || "application/octet-stream";
        const { error: uploadError } = await supabaseAdmin.storage
          .from("whatsapp-media")
          .upload(attachment.storage_path, downloaded.file, {
            contentType: uploadContentType,
            upsert: true,
          });
        if (uploadError) throw uploadError;

        await supabaseAdmin
          .from("whatsapp_conversation_attachments")
          .update({
            content_type: downloaded.contentType || inbound.contentType,
            size_bytes: downloaded.file.size || inbound.sizeBytes,
            status: "stored",
            failure_reason: null,
          })
          .eq("id", attachment.id);
      } catch (mediaError) {
        await supabaseAdmin
          .from("whatsapp_conversation_attachments")
          .update({
            status: "failed",
            failure_reason: errorMessage(mediaError, "media_download_failed"),
          })
          .eq("id", attachment.id);
      }
    }
  }

  await createWhatsAppEvent(supabaseAdmin, {
    organization_id: organizationId,
    conversation_id: conversation.id,
    message_id: message.id,
    event_type: "inbound_received",
    provider_event_id: inbound.providerMessageId,
    details: { message_type: inbound.messageType },
  });

  await createWhatsAppNotification(supabaseAdmin, {
    organization_id: organizationId,
    conversation_id: conversation.id,
    target_user_id: conversation.assigned_to_user_id,
    target_scope: conversation.assigned_to_user_id ? "user" : "queue",
    notification_type: "new_message",
    title: `Nova mensagem WhatsApp${contact.client_id ? "" : " nao identificada"}`,
    body: inbound.body || "Arquivo recebido pelo WhatsApp",
  });

  return { ok: true, conversation_id: conversation.id, message_id: message.id };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (request.method === "GET") return verifyWebhook(request);
  if (request.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  const supabaseAdmin = buildSupabaseAdminClient();
  const rawBody = await request.text();

  try {
    await assertWebhookSignature(request, rawBody);
    const payload = parseWebhookPayload(rawBody);
    const status = normalizeStatusUpdate(payload);
    const result = status
      ? await processStatus(supabaseAdmin, status)
      : await processInbound(supabaseAdmin, payload);
    await recordWebhookLog(supabaseAdmin, payload, "processed", result);
    return jsonResponse(result);
  } catch (error) {
    const message = errorMessage(error, "webhook_processing_failed");
    const payload = (() => {
      try {
        return parseWebhookPayload(rawBody);
      } catch {
        return {};
      }
    })();
    await recordWebhookLog(supabaseAdmin, payload, "failed", { error: message }).catch(() => undefined);
    const status = message.includes("whatsapp_signature") ? 401 : 400;
    return jsonResponse({ error: message }, status);
  }
});
