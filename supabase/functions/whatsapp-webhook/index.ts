import { buildSupabaseAdminClient, jsonResponse, corsHeaders } from "../_shared/whatsapp-auth.ts";
import { createWhatsAppEvent, createWhatsAppNotification } from "../_shared/whatsapp-events.ts";
import {
  classifyWhatsAppProviderFailure,
  dispatchWhatsAppInteractiveMessage,
  dispatchWhatsAppTextMessage,
  downloadWhatsAppMedia,
  normalizeInboundMessage,
  normalizeStatusUpdate,
} from "../_shared/whatsapp-provider.ts";
import { activeWindowExpiresAt, asRecord, asString, baseMimeType, classifyAttachment, errorMessage, safePreview } from "../_shared/whatsapp-validation.ts";
import { createWhatsAppTicketEvent } from "../_shared/whatsapp-ticket/audit.ts";
import { formatTicketOpeningMessage } from "../_shared/whatsapp-ticket/task-chat.ts";
import {
  buildAutoServiceButtonPayload,
  buildAutoServiceListPayload,
  buildAutoActionRowId,
  buildRequestsFlowButtonPayload,
  buildRequestsFlowListPayload,
  parseAutoServiceReplyId,
  parseAutoServiceTextReply,
} from "../_shared/whatsapp-ticket/interactive-messages.ts";
import { buildPublicTicketProtocol, extractPublicTicketProtocol } from "../_shared/whatsapp-ticket/protocol.ts";
import { isOutsideHumanAttendanceHours, localSaoPauloParts, resolveWhatsAppTicketRoute } from "../_shared/whatsapp-ticket/routing.ts";
import { DEFAULT_ACTIVE_CONTEXT_MINUTES } from "../_shared/whatsapp-ticket/types.ts";
import { reliableWhatsAppClientId } from "../_shared/whatsapp-ticket/contact-matching.ts";

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

async function loadWhatsAppFlowSettings(supabaseAdmin: SupabaseAdmin, organizationId: string) {
  const { data, error } = await supabaseAdmin
    .from("organization_settings")
    .select("operational_limits")
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error) {
    console.warn("whatsapp_flow_settings_load_failed", error);
    return { includeHumanAttendance: true };
  }

  const limits = asRecord(data?.operational_limits);
  const whatsapp = asRecord(limits.whatsapp);
  const flow = asRecord(whatsapp.flow);
  return { includeHumanAttendance: flow.includeHumanAttendance !== false };
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

  if (status.deliveryStatus === "failed") {
    await blockAutomaticFlowAfterDeliveryFailure(supabaseAdmin, {
      organizationId: asString(message.organization_id) || "",
      conversationId: asString(message.conversation_id) || null,
      messageId: asString(message.id) || null,
      failureReason: status.failureReason || "whatsapp_status_failed",
      context: "provider_status_update",
    });
  }

  return { ok: true, status: status.deliveryStatus };
}

async function listAutoServiceTickets(
  supabaseAdmin: SupabaseAdmin,
  input: {
    organizationId: string;
    conversationId: string;
    contactId: string;
    clientId?: string | null;
    limit?: number | null;
    statuses?: string[] | null;
  },
) {
  let query = supabaseAdmin
    .from("whatsapp_customer_tickets")
    .select("id, public_protocol, title, status, updated_at")
    .eq("organization_id", input.organizationId)
    .order("updated_at", { ascending: false });

  if (input.statuses?.length) {
    query = query.in("status", input.statuses);
  } else {
    query = query.not("status", "in", "(closed,cancelled)");
  }

  if (input.limit) {
    query = query.limit(input.limit);
  }

  if (input.clientId) {
    query = query.eq("client_id", input.clientId);
  } else {
    query = query.or(`conversation_id.eq.${input.conversationId},contact_id.eq.${input.contactId}`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

async function recordOutboundSystemMessage(
  supabaseAdmin: SupabaseAdmin,
  input: {
    organizationId: string;
    conversation: Record<string, unknown>;
    contact: Record<string, unknown>;
    body: string;
    clientMessageId: string;
    providerMessageId?: string | null;
    deliveryStatus: "sent" | "failed";
    failureReason?: string | null;
    metadata?: Record<string, unknown>;
  },
) {
  const { data, error } = await supabaseAdmin
    .from("whatsapp_messages")
    .upsert({
      organization_id: input.organizationId,
      conversation_id: input.conversation.id,
      contact_id: input.contact.id,
      client_id: input.contact.client_id,
      direction: "outbound",
      provider_message_id: input.providerMessageId ?? null,
      provider_phone_number_id: asString(input.conversation.provider_phone_number_id) || null,
      provider_display_phone_number: asString(input.conversation.provider_display_phone_number) || null,
      client_message_id: input.clientMessageId,
      message_type: "text",
      body: input.body,
      safe_preview: safePreview(input.body),
      metadata: input.metadata ?? {},
      delivery_status: input.deliveryStatus,
      failure_reason: input.failureReason ?? null,
      sent_at: input.deliveryStatus === "sent" ? new Date().toISOString() : null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: "organization_id,client_message_id" })
    .select("id, delivery_status, failure_reason")
    .single();
  if (error) throw error;

  await supabaseAdmin
    .from("whatsapp_conversations")
    .update({
      last_message_id: data.id,
      last_message_preview: safePreview(input.body),
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.conversation.id);

  return data;
}

async function sendSystemText(
  supabaseAdmin: SupabaseAdmin,
  input: {
    organizationId: string;
    conversation: Record<string, unknown>;
    contact: Record<string, unknown>;
    body: string;
    clientMessageId: string;
  },
) {
  let providerMessageId: string | null = null;
  let deliveryStatus: "sent" | "failed" = "sent";
  let failureReason: string | null = null;

  try {
    const sent = await dispatchWhatsAppTextMessage({
      toPhone: asString(input.contact.phone_number),
      body: input.body,
      clientMessageId: input.clientMessageId,
      phoneNumberId: asString(input.conversation.provider_phone_number_id) || null,
    });
    providerMessageId = sent.providerMessageId;
  } catch (error) {
    deliveryStatus = "failed";
    failureReason = errorMessage(error, "whatsapp_text_send_failed");
  }

  const message = await recordOutboundSystemMessage(supabaseAdmin, {
    ...input,
    providerMessageId,
    deliveryStatus,
    failureReason,
  });

  if (deliveryStatus === "failed") {
    await blockAutomaticFlowAfterDeliveryFailure(supabaseAdmin, {
      organizationId: input.organizationId,
      conversationId: asString(input.conversation.id) || null,
      messageId: asString(message.id) || null,
      failureReason,
      context: input.clientMessageId,
    });
  }

  return message;
}

async function blockAutomaticFlowAfterDeliveryFailure(
  supabaseAdmin: SupabaseAdmin,
  input: {
    organizationId: string;
    conversationId: string | null;
    messageId: string | null;
    failureReason: string | null;
    context: string;
  },
) {
  if (!input.conversationId) return;
  const classifiedFailure = classifyWhatsAppProviderFailure(new Error(input.failureReason || "whatsapp_delivery_failed"));
  const blockedAt = new Date().toISOString();

  await supabaseAdmin
    .from("whatsapp_task_creation_flows")
    .update({
      status: "blocked",
      blocked_at: blockedAt,
      block_reason: classifiedFailure.reason,
      metadata: {
        blocked_reason: input.failureReason || "whatsapp_delivery_failed",
        blocked_failure_kind: classifiedFailure.kind,
        blocked_retryable: classifiedFailure.retryable,
        blocked_context: input.context,
        blocked_message_id: input.messageId,
      },
      updated_at: blockedAt,
    })
    .eq("organization_id", input.organizationId)
    .eq("conversation_id", input.conversationId)
    .in("status", ["collecting_sector", "collecting_title", "collecting_description"]);

  await supabaseAdmin
    .from("whatsapp_conversations")
    .update({
      status: "delivery_blocked",
      last_message_preview: "Falha no envio automÃ¡tico. IntervenÃ§Ã£o interna necessÃ¡ria.",
      updated_at: blockedAt,
    })
    .eq("id", input.conversationId);

  await createWhatsAppEvent(supabaseAdmin, {
    organization_id: input.organizationId,
    conversation_id: input.conversationId,
    message_id: input.messageId,
    event_type: "automatic_flow.delivery_blocked",
    details: {
      context: input.context,
      failure_reason: input.failureReason,
      failure_kind: classifiedFailure.kind,
      retryable: classifiedFailure.retryable,
      next_step_blocked: true,
    },
  });

  await createWhatsAppNotification(supabaseAdmin, {
    organization_id: input.organizationId,
    conversation_id: input.conversationId,
    target_scope: "queue",
    notification_type: "new_message",
    title: "Fluxo WhatsApp bloqueado",
    body: "Uma mensagem automÃ¡tica falhou e o fluxo foi pausado para intervenÃ§Ã£o interna.",
  });
}

async function stopIfDeliveryFailed(
  supabaseAdmin: SupabaseAdmin,
  input: {
    organizationId: string;
    conversationId: string | null;
    message: Record<string, unknown> | null;
    context: string;
  },
) {
  if (asString(input.message?.delivery_status) !== "failed") return false;
  await blockAutomaticFlowAfterDeliveryFailure(supabaseAdmin, {
    organizationId: input.organizationId,
    conversationId: input.conversationId,
    messageId: asString(input.message?.id) || null,
    failureReason: asString(input.message?.failure_reason) || null,
    context: input.context,
  });
  return true;
}

async function getLinkedClientName(
  supabaseAdmin: SupabaseAdmin,
  clientId: string | null,
) {
  if (!clientId) return null;

  const { data, error } = await supabaseAdmin
    .from("clients")
    .select("name")
    .eq("id", clientId)
    .maybeSingle();

  if (error) throw error;
  return asString(data?.name) || null;
}

async function maybeSendDailyGreeting(
  supabaseAdmin: SupabaseAdmin,
  input: {
    organizationId: string;
    conversation: Record<string, unknown>;
    contact: Record<string, unknown>;
    reason: string;
  },
) {
  const conversationId = asString(input.conversation.id);
  const contactId = asString(input.contact.id);
  if (!conversationId || !contactId) return true;

  const { dateKey, greeting } = localSaoPauloParts();
  const clientMessageId = `${input.organizationId}:daily-greeting:${conversationId}:${dateKey}`;

  const { data: existingMessage, error: existingMessageError } = await supabaseAdmin
    .from("whatsapp_messages")
    .select("id")
    .eq("organization_id", input.organizationId)
    .eq("client_message_id", clientMessageId)
    .maybeSingle();
  if (existingMessageError) throw existingMessageError;
  if (existingMessage?.id) return true;

  const { data: existingGreetingEvent, error: existingGreetingError } = await supabaseAdmin
    .from("whatsapp_conversation_events")
    .select("id")
    .eq("organization_id", input.organizationId)
    .eq("conversation_id", conversationId)
    .eq("event_type", "daily_greeting_sent")
    .contains("details", { greeting_date: dateKey })
    .limit(1)
    .maybeSingle();
  if (existingGreetingError) throw existingGreetingError;
  if (existingGreetingEvent?.id) return true;

  const greetingClientId = reliableWhatsAppClientId({
    clientId: asString(input.contact.client_id) || null,
    matchStatus: asString(input.contact.match_status) as "matched" | "unmatched" | "manual" | "conflict" | null,
    autoLinkSource: asString(input.contact.auto_link_source) as "unique_phone_match" | "manual" | null,
  });
  const clientName = await getLinkedClientName(supabaseAdmin, greetingClientId);
  const body = clientName
    ? `${greeting}, ${clientName}. Seja bem-vindo(a) ao atendimento da Grow Contabilidade.`
    : `${greeting}. OlÃ¡, bem-vindo(a) a Grow Contabilidade.`;

  const message = await sendSystemText(supabaseAdmin, {
    organizationId: input.organizationId,
    conversation: input.conversation,
    contact: input.contact,
    body,
    clientMessageId,
  });

  await createWhatsAppEvent(supabaseAdmin, {
    organization_id: input.organizationId,
    conversation_id: conversationId,
    message_id: asString(message.id) || null,
    event_type: "daily_greeting_sent",
    details: {
      greeting_date: dateKey,
      greeting,
      reason: input.reason,
      client_id: greetingClientId,
      client_name: clientName,
    },
  });

  return asString(message.delivery_status) !== "failed";
}

async function sendAutoServiceMenu(
  supabaseAdmin: SupabaseAdmin,
  input: {
    organizationId: string;
    conversation: Record<string, unknown>;
    contact: Record<string, unknown>;
    reason: string;
    includeTickets?: boolean;
  },
) {
  const greetingOk = await maybeSendDailyGreeting(supabaseAdmin, {
    organizationId: input.organizationId,
    conversation: input.conversation,
    contact: input.contact,
    reason: input.reason,
  });
  if (!greetingOk) return;

  const tickets: Record<string, unknown>[] = [];
  const body = "Para direcionarmos seu atendimento corretamente, selecione uma das opções abaixo.";
  const clientMessageId = `${input.organizationId}:auto-service:${input.conversation.id}:${Date.now()}`;
  const ticketRows = toTicketOptions(tickets.slice(0, 7));
  const flowSettings = await loadWhatsAppFlowSettings(supabaseAdmin, input.organizationId);
  const menuRows = [
    ...(flowSettings.includeHumanAttendance
      ? [{ id: "grow:auto:attendance", title: "Atendimento", description: "Falar diretamente com a equipe." }]
      : []),
    { id: "grow:auto:requests", title: "Solicitações", description: "Abrir ou acompanhar uma demanda." },
  ];
  const interactiveMetadata = tickets.length > 0
    ? {
        interactive: {
          type: "list",
          buttonText: "Escolher opção",
          sections: [
            {
              title: "Menu",
              rows: menuRows,
            },
            ...(ticketRows.length > 0 ? [{ title: "Tickets ativos", rows: ticketRows }] : []),
          ],
        },
      }
    : {
        interactive: {
          type: "button",
          buttons: menuRows.map((row) => ({ id: row.id, title: row.title })),
        },
      };
  let providerMessageId: string | null = null;
  let deliveryStatus: "sent" | "failed" = "sent";
  let failureReason: string | null = null;

  try {
    const sent = await dispatchWhatsAppInteractiveMessage({
      toPhone: asString(input.contact.phone_number),
      phoneNumberId: asString(input.conversation.provider_phone_number_id) || null,
      payloadForPhone: (phone) =>
        tickets.length > 0
          ? buildAutoServiceListPayload({
              to: phone,
              bodyText: body,
              tickets: ticketRows,
              includeAttendance: flowSettings.includeHumanAttendance,
            })
          : buildAutoServiceButtonPayload({
              to: phone,
              bodyText: body,
              includeAttendance: flowSettings.includeHumanAttendance,
            }),
    });
    providerMessageId = sent.providerMessageId;
  } catch (error) {
    deliveryStatus = "failed";
    failureReason = errorMessage(error, "whatsapp_auto_service_send_failed");
  }

  const message = await recordOutboundSystemMessage(supabaseAdmin, {
    organizationId: input.organizationId,
    conversation: input.conversation,
    contact: input.contact,
    body,
    clientMessageId,
    providerMessageId,
    deliveryStatus,
    failureReason,
    metadata: interactiveMetadata,
  });

  await createWhatsAppEvent(supabaseAdmin, {
    organization_id: input.organizationId,
    conversation_id: asString(input.conversation.id),
    message_id: message.id,
    event_type: "auto_service_menu_sent",
    details: {
      reason: input.reason,
      ticket_count: tickets.length,
      include_tickets: input.includeTickets !== false,
      include_human_attendance: flowSettings.includeHumanAttendance,
      delivery_status: deliveryStatus,
      failure_reason: failureReason,
    },
  });

  await stopIfDeliveryFailed(supabaseAdmin, {
    organizationId: input.organizationId,
    conversationId: asString(input.conversation.id) || null,
    message,
    context: "auto_service_menu",
  });
}

const toTicketOptions = (tickets: Record<string, unknown>[]) =>
  tickets.map((ticket) => ({
    id: asString(ticket.id),
    title: asString(ticket.title) || asString(ticket.public_protocol) || "Ticket",
    description: [asString(ticket.public_protocol), asString(ticket.status)].filter(Boolean).join(" - "),
  }));

const toRequestTypeOptions = (requestTypes: Record<string, unknown>[]) =>
  requestTypes.map((requestType) => ({
    id: asString(requestType.id),
    title: asString(requestType.title) || "SolicitaÃ§Ã£o",
    description: asString(requestType.description) || asString(requestType.sector) || null,
  }));

async function listActivePortalRequestTypes(
  supabaseAdmin: SupabaseAdmin,
  organizationId: string,
) {
  const { data, error } = await supabaseAdmin
    .from("portal_request_types")
    .select("id, title, description, sector, sort_order")
    .eq("is_active", true)
    .or(`organization_id.is.null,organization_id.eq.${organizationId}`)
    .order("sort_order", { ascending: true })
    .order("title", { ascending: true })
    .limit(10);

  if (error) throw error;
  return (data || []) as Record<string, unknown>[];
}

async function getPortalRequestType(
  supabaseAdmin: SupabaseAdmin,
  input: {
    organizationId: string;
    requestTypeId: string;
  },
) {
  const { data, error } = await supabaseAdmin
    .from("portal_request_types")
    .select("*")
    .eq("id", input.requestTypeId)
    .eq("is_active", true)
    .or(`organization_id.is.null,organization_id.eq.${input.organizationId}`)
    .maybeSingle();

  if (error) throw error;
  return data as Record<string, unknown> | null;
}

const ticketStatusLabel = (status: string) => {
  if (status === "waiting_customer") return "Aguardando cliente";
  if (status === "resolved") return "Resolvido";
  if (status === "open") return "Em andamento";
  return status || "Em andamento";
};

const formatActiveTicketMessage = (ticket: Record<string, unknown>, index: number, total: number) => {
  const protocol = asString(ticket.public_protocol) || "sem protocolo";
  const title = asString(ticket.title) || "Tarefa sem tÃ­tulo";
  const status = ticketStatusLabel(asString(ticket.status));

  return [
    `*Tarefa em andamento ${index}/${total}*`,
    "",
    `*Ticket:* #${protocol}`,
    `*TÃ­tulo:* ${title}`,
    `*Status:* ${status}`,
    "",
    `Para continuar esta tarefa, responda informando o ticket #${protocol}.`,
  ].join("\n");
};

async function sendRequestsFlowMenu(
  supabaseAdmin: SupabaseAdmin,
  input: {
    organizationId: string;
    conversation: Record<string, unknown>;
    contact: Record<string, unknown>;
    sourceMessageId: string;
  },
) {
  const requestTypes = await listActivePortalRequestTypes(supabaseAdmin, input.organizationId);
  const requestTypeOptions = toRequestTypeOptions(requestTypes);
  const body = requestTypeOptions.length > 0
    ? "Selecione como deseja prosseguir. VocÃª pode consultar tarefas em andamento ou abrir uma nova solicitaÃ§Ã£o para nossa equipe."
    : "Selecione uma das opÃ§Ãµes abaixo para consultar tarefas em andamento ou abrir uma nova demanda.";
  const clientMessageId = `${input.organizationId}:requests-flow:${input.sourceMessageId}`;
  let providerMessageId: string | null = null;
  let deliveryStatus: "sent" | "failed" = "sent";
  let failureReason: string | null = null;

  try {
    const sent = await dispatchWhatsAppInteractiveMessage({
      toPhone: asString(input.contact.phone_number),
      phoneNumberId: asString(input.conversation.provider_phone_number_id) || null,
      payloadForPhone: (phone) =>
        requestTypeOptions.length > 0
          ? buildRequestsFlowListPayload({ to: phone, bodyText: body, requestTypes: requestTypeOptions })
          : buildRequestsFlowButtonPayload({ to: phone, bodyText: body }),
    });
    providerMessageId = sent.providerMessageId;
  } catch (error) {
    deliveryStatus = "failed";
    failureReason = errorMessage(error, "whatsapp_requests_flow_send_failed");
  }

  const message = await recordOutboundSystemMessage(supabaseAdmin, {
    organizationId: input.organizationId,
    conversation: input.conversation,
    contact: input.contact,
    body,
    clientMessageId,
    providerMessageId,
    deliveryStatus,
    failureReason,
    metadata: {
      interactive: requestTypeOptions.length > 0
        ? {
            type: "list",
            buttonText: "Escolher opÃ§Ã£o",
            sections: [
              {
                title: "Acompanhamento",
                rows: [
                  {
                    id: "grow:auto:consult_tasks",
                    title: "Tarefas em andamento",
                    description: "Consultar demandas abertas deste cliente.",
                  },
                ],
              },
              {
                title: "Nova solicitaÃ§Ã£o",
                rows: requestTypeOptions.map((requestType) => ({
                  id: `grow:reqtype:${requestType.id}`,
                  title: requestType.title,
                  description: requestType.description,
                })),
              },
            ],
          }
        : {
            type: "button",
            buttons: [
              { id: "grow:auto:consult_tasks", title: "Tarefas em andamento" },
              { id: "grow:auto:create_task", title: "Criar nova tarefa" },
            ],
          },
    },
  });

  await createWhatsAppEvent(supabaseAdmin, {
    organization_id: input.organizationId,
    conversation_id: asString(input.conversation.id),
    message_id: message.id,
    event_type: "requests_flow_menu_sent",
    details: {
      delivery_status: deliveryStatus,
      failure_reason: failureReason,
      request_type_count: requestTypeOptions.length,
    },
  });

  await stopIfDeliveryFailed(supabaseAdmin, {
    organizationId: input.organizationId,
    conversationId: asString(input.conversation.id) || null,
    message,
    context: "requests_flow_menu",
  });
}

async function sendActiveTicketsFollowupActions(
  supabaseAdmin: SupabaseAdmin,
  input: {
    organizationId: string;
    conversation: Record<string, unknown>;
    contact: Record<string, unknown>;
    sourceMessageId: string;
    body?: string;
    returnAction?: "menu" | "consult_tasks";
    returnTitle?: string;
  },
) {
  const body = input.body || "Como deseja prosseguir? VocÃª pode encerrar este fluxo ou voltar ao menu principal para escolher outra opÃ§Ã£o.";
  const returnAction = input.returnAction || "menu";
  const returnTitle = input.returnTitle || "Voltar menu";
  const clientMessageId = `${input.organizationId}:active-tickets-followup-actions:${input.sourceMessageId}`;
  let providerMessageId: string | null = null;
  let deliveryStatus: "sent" | "failed" = "sent";
  let failureReason: string | null = null;

  try {
    const sent = await dispatchWhatsAppInteractiveMessage({
      toPhone: asString(input.contact.phone_number),
      phoneNumberId: asString(input.conversation.provider_phone_number_id) || null,
      payloadForPhone: (phone) => ({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: phone,
        type: "interactive",
        interactive: {
          type: "button",
          body: { text: body },
          action: {
            buttons: [
              {
                type: "reply",
                reply: {
                  id: buildAutoActionRowId("end_flow"),
                  title: "Encerrar",
                },
              },
              {
                type: "reply",
                reply: {
                  id: buildAutoActionRowId(returnAction),
                  title: returnTitle,
                },
              },
            ],
          },
        },
      }),
    });
    providerMessageId = sent.providerMessageId;
  } catch (error) {
    deliveryStatus = "failed";
    failureReason = errorMessage(error, "whatsapp_active_tickets_followup_send_failed");
  }

  const message = await recordOutboundSystemMessage(supabaseAdmin, {
    organizationId: input.organizationId,
    conversation: input.conversation,
    contact: input.contact,
    body,
    clientMessageId,
    providerMessageId,
    deliveryStatus,
    failureReason,
    metadata: {
      interactive: {
        type: "button",
        buttons: [
          { id: buildAutoActionRowId("end_flow"), title: "Encerrar" },
          { id: buildAutoActionRowId(returnAction), title: returnTitle },
        ],
      },
    },
  });

  await stopIfDeliveryFailed(supabaseAdmin, {
    organizationId: input.organizationId,
    conversationId: asString(input.conversation.id) || null,
    message,
    context: "active_tickets_followup_actions",
  });

  return message;
}

async function sendTicketContextFollowupActions(
  supabaseAdmin: SupabaseAdmin,
  input: {
    organizationId: string;
    conversation: Record<string, unknown>;
    contact: Record<string, unknown>;
    sourceMessageId: string;
  },
) {
  const body = "Contexto recebido e vinculado ao ticket. Deseja continuar adicionando informaÃ§Ãµes ou sair deste fluxo?";
  const clientMessageId = `${input.organizationId}:ticket-context-followup:${input.sourceMessageId}`;
  let providerMessageId: string | null = null;
  let deliveryStatus: "sent" | "failed" = "sent";
  let failureReason: string | null = null;

  try {
    const sent = await dispatchWhatsAppInteractiveMessage({
      toPhone: asString(input.contact.phone_number),
      phoneNumberId: asString(input.conversation.provider_phone_number_id) || null,
      payloadForPhone: (phone) => ({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: phone,
        type: "interactive",
        interactive: {
          type: "button",
          body: { text: body },
          action: {
            buttons: [
              {
                type: "reply",
                reply: {
                  id: buildAutoActionRowId("continue_context"),
                  title: "Continuar",
                },
              },
              {
                type: "reply",
                reply: {
                  id: buildAutoActionRowId("end_flow"),
                  title: "Sair do fluxo",
                },
              },
            ],
          },
        },
      }),
    });
    providerMessageId = sent.providerMessageId;
  } catch (error) {
    deliveryStatus = "failed";
    failureReason = errorMessage(error, "whatsapp_ticket_context_followup_send_failed");
  }

  const message = await recordOutboundSystemMessage(supabaseAdmin, {
    organizationId: input.organizationId,
    conversation: input.conversation,
    contact: input.contact,
    body,
    clientMessageId,
    providerMessageId,
    deliveryStatus,
    failureReason,
    metadata: {
      interactive: {
        type: "button",
        buttons: [
          { id: buildAutoActionRowId("continue_context"), title: "Continuar" },
          { id: buildAutoActionRowId("end_flow"), title: "Sair do fluxo" },
        ],
      },
    },
  });

  await stopIfDeliveryFailed(supabaseAdmin, {
    organizationId: input.organizationId,
    conversationId: asString(input.conversation.id) || null,
    message,
    context: "ticket_context_followup_actions",
  });

  return message;
}

async function sendActiveTicketsSelection(
  supabaseAdmin: SupabaseAdmin,
  input: {
    organizationId: string;
    conversation: Record<string, unknown>;
    contact: Record<string, unknown>;
    sourceMessageId: string;
  },
) {
  const clientId = reliableWhatsAppClientId({
    clientId: asString(input.contact.client_id) || null,
    matchStatus: asString(input.contact.match_status) as "matched" | "unmatched" | "manual" | "conflict" | null,
    autoLinkSource: asString(input.contact.auto_link_source) as "unique_phone_match" | "manual" | null,
  });
  if (!clientId) {
    await sendSystemText(supabaseAdmin, {
      organizationId: input.organizationId,
      conversation: input.conversation,
      contact: input.contact,
      body: "NÃ£o localizamos um cliente vinculado a este nÃºmero. Para consultar tarefas em andamento, este contato precisa estar vinculado a um cliente cadastrado.",
      clientMessageId: `${input.organizationId}:active-tickets-client-required:${input.sourceMessageId}`,
    });
    await sendActiveTicketsFollowupActions(supabaseAdmin, {
      organizationId: input.organizationId,
      conversation: input.conversation,
      contact: input.contact,
      sourceMessageId: `active-tickets-client-required:${input.sourceMessageId}`,
      body: "Como deseja prosseguir? VocÃª pode voltar ao menu principal ou encerrar este atendimento automÃ¡tico.",
      returnAction: "menu",
      returnTitle: "Voltar menu",
    });
    return;
  }

  const tickets = await listAutoServiceTickets(supabaseAdmin, {
    organizationId: input.organizationId,
    conversationId: asString(input.conversation.id),
    contactId: asString(input.contact.id),
    clientId,
    statuses: ["open", "waiting_team", "waiting_customer"],
  });

  if (tickets.length === 0) {
    await sendSystemText(supabaseAdmin, {
      organizationId: input.organizationId,
      conversation: input.conversation,
      contact: input.contact,
      body: "NÃ£o localizamos tarefas em andamento para este cliente no momento. Caso precise registrar uma nova demanda, selecione SolicitaÃ§Ãµes e depois Criar nova tarefa.",
      clientMessageId: `${input.organizationId}:active-tickets-empty:${input.sourceMessageId}`,
    });
    await sendActiveTicketsFollowupActions(supabaseAdmin, {
      organizationId: input.organizationId,
      conversation: input.conversation,
      contact: input.contact,
      sourceMessageId: `active-tickets-empty:${input.sourceMessageId}`,
      body: "Como deseja prosseguir? VocÃª pode voltar ao menu principal para escolher outra opÃ§Ã£o ou encerrar este atendimento automÃ¡tico.",
      returnAction: "menu",
      returnTitle: "Voltar menu",
    });
    return;
  }

  await sendSystemText(supabaseAdmin, {
    organizationId: input.organizationId,
    conversation: input.conversation,
    contact: input.contact,
    body: `Localizamos ${tickets.length} tarefa(s) em andamento para este cliente. Enviaremos os detalhes a seguir.`,
    clientMessageId: `${input.organizationId}:active-tickets-summary:${input.sourceMessageId}`,
  });

  for (const [index, ticket] of tickets.entries()) {
    await sendSystemText(supabaseAdmin, {
      organizationId: input.organizationId,
      conversation: input.conversation,
      contact: input.contact,
      body: formatActiveTicketMessage(ticket, index + 1, tickets.length),
      clientMessageId: `${input.organizationId}:active-ticket:${input.sourceMessageId}:${asString(ticket.id) || index}`,
    });
  }

  const message = await sendActiveTicketsFollowupActions(supabaseAdmin, {
    organizationId: input.organizationId,
    conversation: input.conversation,
    contact: input.contact,
    sourceMessageId: input.sourceMessageId,
  });

  await createWhatsAppEvent(supabaseAdmin, {
    organization_id: input.organizationId,
    conversation_id: asString(input.conversation.id),
    message_id: message.id,
    event_type: "active_tickets_messages_sent",
    details: {
      client_id: clientId,
      ticket_count: tickets.length,
      delivery_status: "sent",
    },
  });
}

const taskCreationSectorOptions = [
  { label: "Geral", normalized: "Geral", aliases: ["geral", "administrativo"] },
  { label: "Fiscal", normalized: "Fiscal", aliases: ["fiscal"] },
  { label: "ContÃ¡bil", normalized: "Contabil", aliases: ["contabil", "contÃ¡bil", "contabil"] },
  { label: "Departamento Pessoal", normalized: "Departamento Pessoal", aliases: ["departamento pessoal", "dp", "pessoal"] },
  { label: "SocietÃ¡rio", normalized: "Societario", aliases: ["societario", "societÃ¡rio"] },
  { label: "Comercial", normalized: "Comercial", aliases: ["comercial", "vendas"] },
];

const normalizeTaskCreationSector = (value: string) => {
  const normalizedInput = value.trim().toLowerCase();
  const match = taskCreationSectorOptions.find((option) =>
    option.aliases.includes(normalizedInput) || option.label.toLowerCase() === normalizedInput
  );
  return match?.normalized || null;
};

const taskCreationSectorPrompt = [
  "Vamos registrar uma nova tarefa para acompanhamento da equipe.",
  "",
  "*1/3 - Setor*",
  "Informe qual setor deve atender esta demanda.",
  "",
  "Responda com uma das opÃ§Ãµes abaixo:",
  "Geral, Fiscal, ContÃ¡bil, Departamento Pessoal, SocietÃ¡rio ou Comercial.",
  "",
  "Para cancelar, responda *cancelar*.",
].join("\n");

const taskCreationTitlePrompt = [
  "*2/3 - TÃ­tulo da tarefa*",
  "Envie um tÃ­tulo curto e objetivo para identificarmos a demanda.",
  "",
  "Exemplo: Revisar documentos enviados",
].join("\n");

const taskCreationDescriptionPrompt = [
  "*3/3 - DescriÃ§Ã£o da tarefa*",
  "Descreva o contexto da solicitaÃ§Ã£o, o resultado esperado e qualquer prazo relevante.",
].join("\n");

const appendFlowAnswerMessageId = (metadata: Record<string, unknown>, messageId: string) => {
  const existing = Array.isArray(metadata.answer_message_ids) ? metadata.answer_message_ids : [];
  return {
    ...metadata,
    answer_message_ids: [...existing.map(String), messageId],
  };
};

async function startTaskCreationFlow(
  supabaseAdmin: SupabaseAdmin,
  input: {
    organizationId: string;
    conversation: Record<string, unknown>;
    contact: Record<string, unknown>;
    sourceMessageId: string;
    requestType?: Record<string, unknown> | null;
  },
) {
  const clientId = reliableWhatsAppClientId({
    clientId: asString(input.contact.client_id) || null,
    matchStatus: asString(input.contact.match_status) as "matched" | "unmatched" | "manual" | "conflict" | null,
    autoLinkSource: asString(input.contact.auto_link_source) as "unique_phone_match" | "manual" | null,
  });
  if (!clientId) {
    await sendSystemText(supabaseAdmin, {
      organizationId: input.organizationId,
      conversation: input.conversation,
      contact: input.contact,
      body: "Para abrir uma nova solicitaÃ§Ã£o, precisamos primeiro identificar o cliente vinculado a este nÃºmero. Vamos direcionar sua conversa para a equipe.",
      clientMessageId: `${input.organizationId}:task-flow-client-required:${input.sourceMessageId}`,
    });
    await supabaseAdmin
      .from("whatsapp_conversations")
      .update({
        status: "in_attendance",
        assigned_team: "Atendimento",
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.conversation.id);
    await createWhatsAppNotification(supabaseAdmin, {
      organization_id: input.organizationId,
      conversation_id: asString(input.conversation.id),
      target_scope: "queue",
      notification_type: "new_message",
      title: "IdentificaÃ§Ã£o de cliente necessÃ¡ria",
      body: "Contato WhatsApp tentou abrir uma tarefa sem cliente vinculado.",
    });
    await createWhatsAppEvent(supabaseAdmin, {
      organization_id: input.organizationId,
      conversation_id: asString(input.conversation.id),
      message_id: input.sourceMessageId,
      event_type: "task_creation.blocked_unlinked_contact",
      details: { next_step: "attendance_queue" },
    });
    return;
  }

  await supabaseAdmin
    .from("whatsapp_task_creation_flows")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("organization_id", input.organizationId)
    .eq("conversation_id", asString(input.conversation.id))
    .in("status", ["collecting_sector", "collecting_title", "collecting_description", "blocked"]);

  const requestType = input.requestType || null;
  const requestTypeTitle = asString(requestType?.title);
  const requestTypeSector = normalizeTaskCreationSector(asString(requestType?.sector)) || "Geral";
  const requestTypeTaskTitle = asString(requestType?.task_title_template) || requestTypeTitle || "";
  const requestTypeDescription = asString(requestType?.task_description_template);
  const flowStatus = requestType ? "collecting_title" : "collecting_sector";

  const { error } = await supabaseAdmin.from("whatsapp_task_creation_flows").insert({
    organization_id: input.organizationId,
    conversation_id: input.conversation.id,
    contact_id: input.contact.id,
    client_id: clientId,
    source_message_id: input.sourceMessageId,
    status: flowStatus,
    sector: requestType ? requestTypeSector : null,
    title: requestTypeTaskTitle || null,
    expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    metadata: {
      source: "whatsapp_auto_service",
      request_type_id: requestType ? asString(requestType.id) : null,
      request_type_title: requestTypeTitle || null,
      request_type_description: requestTypeDescription || null,
    },
  });
  if (error) throw error;

  const confirmationMessage = await sendSystemText(supabaseAdmin, {
    organizationId: input.organizationId,
    conversation: input.conversation,
    contact: input.contact,
    body: requestType
      ? [
          `Vamos registrar uma nova solicitaÃ§Ã£o de *${requestTypeTitle || requestTypeTaskTitle || "Tarefa"}*.`,
          "",
          requestTypeDescription || null,
          requestTypeTaskTitle ? `TÃ­tulo sugerido: ${requestTypeTaskTitle}` : null,
          "",
          "*1/2 - TÃ­tulo da tarefa*",
          "Envie um tÃ­tulo curto para a tarefa ou responda *manter* para usar o tÃ­tulo sugerido.",
          "",
          "Para cancelar, responda *cancelar*.",
        ].filter(Boolean).join("\n")
      : taskCreationSectorPrompt,
    clientMessageId: `${input.organizationId}:task-flow-start:${input.sourceMessageId}`,
  });

  if (asString(confirmationMessage.delivery_status) === "failed") {
    return;
  }
}

async function createTaskFromCreationFlow(
  supabaseAdmin: SupabaseAdmin,
  input: {
    organizationId: string;
    conversation: Record<string, unknown>;
    contact: Record<string, unknown>;
    flow: Record<string, unknown>;
    description: string;
    messageId: string;
  },
) {
  const clientId = asString(input.flow.client_id);
  const { data: client, error: clientError } = await supabaseAdmin
    .from("clients")
    .select("id, name")
    .eq("organization_id", input.organizationId)
    .eq("id", clientId)
    .maybeSingle();
  if (clientError) throw clientError;
  if (!client) throw new Error("client_not_found_for_task_creation_flow");

  const flowMetadata = appendFlowAnswerMessageId(asRecord(input.flow.metadata), input.messageId);
  const answerMessageIds = Array.isArray(flowMetadata.answer_message_ids)
    ? flowMetadata.answer_message_ids.map(String)
    : [input.messageId];
  const sector = asString(input.flow.sector) || "Geral";
  const title = asString(input.flow.title) || "SolicitaÃ§Ã£o via WhatsApp";
  const requestTypeTitle = asString(flowMetadata.request_type_title);
  const requestTypeDescription = asString(flowMetadata.request_type_description);
  const descriptionParts = [
    requestTypeTitle ? `Tipo de solicitaÃ§Ã£o: ${requestTypeTitle}` : null,
    requestTypeDescription || null,
    input.description,
    "Criada automaticamente a partir do atendimento WhatsApp.",
    input.contact.phone_number ? `Contato: ${input.contact.phone_number}` : null,
  ].filter(Boolean);
  const integrationTaskId = `whatsapp-flow:${input.flow.id}`;

  const { data: existingTask, error: existingTaskError } = await supabaseAdmin
    .from("kanban_tasks")
    .select("id, title")
    .eq("organization_id", input.organizationId)
    .eq("integration_source", "whatsapp")
    .eq("integration_task_id", integrationTaskId)
    .maybeSingle();
  if (existingTaskError) throw existingTaskError;

  let task = existingTask;
  if (!task) {
    const { data: insertedTask, error: taskError } = await supabaseAdmin
      .from("kanban_tasks")
      .insert({
        organization_id: input.organizationId,
        title,
        client_name: asString(client.name),
        description: descriptionParts.join("\n"),
        priority: "Media",
        sector,
        status: "todo",
        tags: [sector, "WhatsApp"],
        subtasks: [],
        integration_source: "whatsapp",
        integration_task_id: integrationTaskId,
        integration_payload: {
          source: "whatsapp_task_creation_flow",
          conversation_id: input.conversation.id,
          contact_id: input.contact.id,
          flow_id: input.flow.id,
          request_type_id: asString(flowMetadata.request_type_id) || null,
          request_type_title: requestTypeTitle || null,
          answer_message_ids: answerMessageIds,
        },
      })
      .select("id, title")
      .single();

    if (taskError?.code === "23505") {
      const { data: recoveredTask, error: recoverTaskError } = await supabaseAdmin
        .from("kanban_tasks")
        .select("id, title")
        .eq("organization_id", input.organizationId)
        .eq("integration_source", "whatsapp")
        .eq("integration_task_id", integrationTaskId)
        .single();
      if (recoverTaskError) throw recoverTaskError;
      task = recoveredTask;
    } else if (taskError) {
      throw taskError;
    } else {
      task = insertedTask;
    }
  }
  if (!task) throw new Error("whatsapp_task_creation_failed");

  const publicProtocol = buildPublicTicketProtocol({
    openedAt: new Date(),
    sequence: 0,
    suffix: task.id.replaceAll("-", "").slice(0, 6),
  });
  const { data: ticket, error: ticketError } = await supabaseAdmin
    .from("whatsapp_customer_tickets")
    .upsert({
      organization_id: input.organizationId,
      client_id: clientId,
      contact_id: input.contact.id,
      conversation_id: input.conversation.id,
      task_id: task.id,
      public_protocol: publicProtocol,
      title: task.title,
      description: input.description,
      status: "open",
      responsible_name: "Equipe Grow",
      opened_from_message_id: input.messageId,
      metadata: {
        source: "whatsapp_task_creation_flow",
        flow_id: input.flow.id,
        request_type_id: asString(flowMetadata.request_type_id) || null,
        request_type_title: requestTypeTitle || null,
        answer_message_ids: answerMessageIds,
      },
      updated_at: new Date().toISOString(),
    }, { onConflict: "organization_id,task_id" })
    .select("id, public_protocol")
    .single();
  if (ticketError) throw ticketError;

  for (const answerMessageId of answerMessageIds) {
    await supabaseAdmin.from("whatsapp_task_message_links").upsert({
      organization_id: input.organizationId,
      ticket_id: ticket.id,
      task_id: task.id,
      conversation_id: input.conversation.id,
      message_id: answerMessageId,
      relation_type: "context",
      visibility: "customer",
      route_source: null,
      route_confidence_percent: 100,
    }, { onConflict: "organization_id,message_id,relation_type,ticket_id" });
  }

  const { data: attachments, error: attachmentsError } = await supabaseAdmin
    .from("whatsapp_conversation_attachments")
    .select("id, message_id")
    .eq("organization_id", input.organizationId)
    .in("message_id", answerMessageIds);
  if (attachmentsError) throw attachmentsError;

  for (const attachment of attachments || []) {
    await supabaseAdmin.from("whatsapp_task_message_links").upsert({
      organization_id: input.organizationId,
      ticket_id: ticket.id,
      task_id: task.id,
      conversation_id: input.conversation.id,
      message_id: attachment.message_id,
      attachment_id: attachment.id,
      relation_type: "document",
      visibility: "customer",
      route_source: null,
      route_confidence_percent: 100,
    }, { onConflict: "organization_id,message_id,relation_type,ticket_id" });
  }

  await supabaseAdmin
    .from("whatsapp_task_creation_flows")
    .update({
      status: "completed",
      description: input.description,
      created_task_id: task.id,
      created_ticket_id: ticket.id,
      metadata: flowMetadata,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.flow.id);

  await createWhatsAppTicketEvent(supabaseAdmin, {
    organizationId: input.organizationId,
    ticketId: ticket.id,
    taskId: task.id,
    conversationId: asString(input.conversation.id),
    messageId: input.messageId,
    eventType: "ticket_created_from_customer_flow",
    details: {
      public_protocol: ticket.public_protocol,
      flow_id: input.flow.id,
      answer_message_ids: answerMessageIds,
    },
    idempotencyKey: `${input.organizationId}:customer-task-flow:${input.flow.id}`,
  });

  const confirmationMessage = await sendSystemText(supabaseAdmin, {
    organizationId: input.organizationId,
    conversation: input.conversation,
    contact: input.contact,
    body: formatTicketOpeningMessage({
      ticketProtocol: ticket.public_protocol,
      taskTitle: task.title,
      responsibleName: "Equipe Grow",
    }),
    clientMessageId: `${input.organizationId}:task-flow-confirmation:${input.flow.id}`,
  });

  if (asString(confirmationMessage.delivery_status) === "failed") {
    return { task, ticket };
  }

  await sendActiveTicketsFollowupActions(supabaseAdmin, {
    organizationId: input.organizationId,
    conversation: input.conversation,
    contact: input.contact,
    sourceMessageId: `task-flow:${input.flow.id}`,
    body: "Como deseja prosseguir? VocÃª pode voltar ao menu para escolher outra opÃ§Ã£o ou encerrar este atendimento automÃ¡tico.",
    returnAction: "menu",
    returnTitle: "Voltar menu",
  });

  return { task, ticket };
}

async function handleTaskCreationFlowReply(
  supabaseAdmin: SupabaseAdmin,
  input: {
    organizationId: string;
    conversation: Record<string, unknown>;
    contact: Record<string, unknown>;
    message: Record<string, unknown>;
    body: string | null;
  },
) {
  const { data: flow, error } = await supabaseAdmin
    .from("whatsapp_task_creation_flows")
    .select("*")
    .eq("organization_id", input.organizationId)
    .eq("conversation_id", asString(input.conversation.id))
    .in("status", ["collecting_sector", "collecting_title", "collecting_description"])
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (error) throw error;
  if (!flow) return null;

  const body = asString(input.body).trim();
  if (!body) {
    await sendSystemText(supabaseAdmin, {
      organizationId: input.organizationId,
      conversation: input.conversation,
      contact: input.contact,
      body: "Para continuar a abertura da tarefa, envie sua resposta em texto. Se desejar encerrar este fluxo, responda *cancelar*.",
      clientMessageId: `${input.organizationId}:task-flow-text-required:${input.message.id}`,
    });
    return {
      source: "unrouted" as const,
      ticketId: null,
      confidencePercent: null,
      reason: "Cliente enviou mensagem sem texto durante criaÃ§Ã£o de tarefa.",
    };
  }

  if (body.toLowerCase() === "cancelar") {
    await supabaseAdmin
      .from("whatsapp_task_creation_flows")
      .update({ status: "cancelled", cancelled_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", flow.id);
    await sendSystemText(supabaseAdmin, {
      organizationId: input.organizationId,
      conversation: input.conversation,
      contact: input.contact,
      body: "A abertura da tarefa foi cancelada. Quando desejar registrar uma nova demanda, selecione SolicitaÃ§Ãµes e depois Criar nova tarefa.",
      clientMessageId: `${input.organizationId}:task-flow-cancelled:${input.message.id}`,
    });
    return {
      source: "unrouted" as const,
      ticketId: null,
      confidencePercent: null,
      reason: "Cliente cancelou o fluxo de criaÃ§Ã£o de tarefa.",
    };
  }

  const metadata = appendFlowAnswerMessageId(asRecord(flow.metadata), asString(input.message.id));
  if (flow.status === "collecting_sector") {
    const sector = normalizeTaskCreationSector(body);
    if (!sector) {
      await sendSystemText(supabaseAdmin, {
        organizationId: input.organizationId,
        conversation: input.conversation,
        contact: input.contact,
        body: "NÃ£o conseguimos identificar o setor informado. Responda com uma das opÃ§Ãµes abaixo: Geral, Fiscal, ContÃ¡bil, Departamento Pessoal, SocietÃ¡rio ou Comercial.",
        clientMessageId: `${input.organizationId}:task-flow-invalid-sector:${input.message.id}`,
      });
      return {
        source: "unrouted" as const,
        ticketId: null,
        confidencePercent: null,
        reason: "Cliente informou setor invÃ¡lido no fluxo de criaÃ§Ã£o de tarefa.",
      };
    }

    await supabaseAdmin
      .from("whatsapp_task_creation_flows")
      .update({ sector, status: "collecting_title", metadata, updated_at: new Date().toISOString() })
      .eq("id", flow.id);
    await sendSystemText(supabaseAdmin, {
      organizationId: input.organizationId,
      conversation: input.conversation,
      contact: input.contact,
      body: taskCreationTitlePrompt,
      clientMessageId: `${input.organizationId}:task-flow-title:${input.message.id}`,
    });
    return {
      source: "unrouted" as const,
      ticketId: null,
      confidencePercent: null,
      reason: "Cliente informou setor da nova tarefa.",
    };
  }

  if (flow.status === "collecting_title") {
    const existingTitle = asString(flow.title);
    const shouldKeepSuggestedTitle = existingTitle && ["manter", "usar", "ok"].includes(body.toLowerCase());
    if (!shouldKeepSuggestedTitle && body.length < 4) {
      await sendSystemText(supabaseAdmin, {
        organizationId: input.organizationId,
        conversation: input.conversation,
        contact: input.contact,
        body: "O tÃ­tulo informado ficou muito curto. Envie um tÃ­tulo mais claro e objetivo para a tarefa.",
        clientMessageId: `${input.organizationId}:task-flow-title-short:${input.message.id}`,
      });
      return {
        source: "unrouted" as const,
        ticketId: null,
        confidencePercent: null,
        reason: "Cliente informou tÃ­tulo curto no fluxo de criaÃ§Ã£o de tarefa.",
      };
    }

    await supabaseAdmin
      .from("whatsapp_task_creation_flows")
      .update({
        title: shouldKeepSuggestedTitle ? existingTitle : body.slice(0, 140),
        status: "collecting_description",
        metadata,
        updated_at: new Date().toISOString(),
      })
      .eq("id", flow.id);
    await sendSystemText(supabaseAdmin, {
      organizationId: input.organizationId,
      conversation: input.conversation,
      contact: input.contact,
      body: taskCreationDescriptionPrompt,
      clientMessageId: `${input.organizationId}:task-flow-description:${input.message.id}`,
    });
    return {
      source: "unrouted" as const,
      ticketId: null,
      confidencePercent: null,
      reason: "Cliente informou tÃ­tulo da nova tarefa.",
    };
  }

  const { ticket } = await createTaskFromCreationFlow(supabaseAdmin, {
    organizationId: input.organizationId,
    conversation: input.conversation,
    contact: input.contact,
    flow,
    description: body,
    messageId: asString(input.message.id),
  });

  return {
    source: "interactive_selection" as const,
    ticketId: asString(ticket.id),
    confidencePercent: 100,
    reason: "Tarefa criada automaticamente a partir das respostas do cliente.",
  };
}

async function activateTicketContextFromSelection(
  supabaseAdmin: SupabaseAdmin,
  input: {
    organizationId: string;
    conversation: Record<string, unknown>;
    contact: Record<string, unknown>;
    message: Record<string, unknown>;
    ticketId: string;
  },
) {
  const { data: ticket, error } = await supabaseAdmin
    .from("whatsapp_customer_tickets")
    .select("*")
    .eq("organization_id", input.organizationId)
    .eq("id", input.ticketId)
    .not("status", "in", "(closed,cancelled)")
    .maybeSingle();
  if (error) throw error;
  if (!ticket) return null;

  const contactId = asString(input.contact.id);
  const conversationId = asString(input.conversation.id);
  const clientId = reliableWhatsAppClientId({
    clientId: asString(input.contact.client_id) || null,
    matchStatus: asString(input.contact.match_status) as "matched" | "unmatched" | "manual" | "conflict" | null,
    autoLinkSource: asString(input.contact.auto_link_source) as "unique_phone_match" | "manual" | null,
  });
  const ticketAllowed = asString(ticket.conversation_id) === conversationId ||
    asString(ticket.contact_id) === contactId ||
    (clientId && asString(ticket.client_id) === clientId);
  if (!ticketAllowed) return null;

  const expiresAt = new Date(Date.now() + DEFAULT_ACTIVE_CONTEXT_MINUTES * 60 * 1000).toISOString();
  await supabaseAdmin
    .from("whatsapp_active_ticket_contexts")
    .update({
      cleared_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("organization_id", input.organizationId)
    .eq("conversation_id", conversationId)
    .is("cleared_at", null);

  await supabaseAdmin.from("whatsapp_active_ticket_contexts").insert({
    organization_id: input.organizationId,
    conversation_id: conversationId,
    contact_id: contactId,
    ticket_id: ticket.id,
    task_id: ticket.task_id,
    source: "interactive_selection",
    selected_message_id: input.message.id,
    expires_at: expiresAt,
  });

  await createWhatsAppTicketEvent(supabaseAdmin, {
    organizationId: input.organizationId,
    ticketId: ticket.id,
    taskId: ticket.task_id,
    conversationId,
    messageId: asString(input.message.id),
    eventType: "ticket.context.activated_by_customer",
    details: { source: "interactive_selection", expires_at: expiresAt },
    idempotencyKey: `${input.organizationId}:interactive-context:${input.message.id}`,
  });

  await sendSystemText(supabaseAdmin, {
    organizationId: input.organizationId,
    conversation: input.conversation,
    contact: input.contact,
    body: `Ticket #${ticket.public_protocol} selecionado. Envie sua mensagem ou documento por aqui para vincularmos ao atendimento correspondente.`,
    clientMessageId: `${input.organizationId}:ticket-selected:${input.message.id}`,
  });

  return ticket;
}

async function routeInboundToTicket(
  supabaseAdmin: SupabaseAdmin,
  input: {
    organizationId: string;
    conversation: Record<string, unknown>;
    contact: Record<string, unknown>;
    message: Record<string, unknown>;
    body: string | null;
    interactiveReplyId?: string | null;
  },
) {
  const selectedById = parseAutoServiceReplyId(input.interactiveReplyId);
  const selectedByText = parseAutoServiceTextReply(input.body);
  const selected = selectedById.type !== "unknown" ? selectedById : selectedByText;
  if (selected.type === "ticket" && selected.id) {
    const ticket = await activateTicketContextFromSelection(supabaseAdmin, {
      organizationId: input.organizationId,
      conversation: input.conversation,
      contact: input.contact,
      message: input.message,
      ticketId: selected.id,
    });
    if (ticket) {
      return resolveWhatsAppTicketRoute({ interactiveTicketId: asString(ticket.id) });
    }

    await sendAutoServiceMenu(supabaseAdmin, {
      organizationId: input.organizationId,
      conversation: input.conversation,
      contact: input.contact,
      reason: "invalid_ticket_selection",
    });
    return {
      source: "unrouted" as const,
      ticketId: null,
      confidencePercent: null,
      reason: "Cliente selecionou um ticket indisponÃ­vel ou sem permissÃ£o.",
    };
  }

  if (selected.type === "request_type" && selected.id) {
    await supabaseAdmin
      .from("whatsapp_conversations")
      .update({ status: "open", assigned_team: null, updated_at: new Date().toISOString() })
      .eq("id", input.conversation.id);

    const requestType = await getPortalRequestType(supabaseAdmin, {
      organizationId: input.organizationId,
      requestTypeId: selected.id,
    });

    if (!requestType) {
      await sendRequestsFlowMenu(supabaseAdmin, {
        organizationId: input.organizationId,
        conversation: input.conversation,
        contact: input.contact,
        sourceMessageId: asString(input.message.id),
      });
      return {
        source: "unrouted" as const,
        ticketId: null,
        confidencePercent: null,
        reason: "Cliente selecionou um tipo de solicitaÃ§Ã£o indisponÃ­vel.",
      };
    }

    await startTaskCreationFlow(supabaseAdmin, {
      organizationId: input.organizationId,
      conversation: input.conversation,
      contact: input.contact,
      sourceMessageId: asString(input.message.id),
      requestType,
    });
    await createWhatsAppEvent(supabaseAdmin, {
      organization_id: input.organizationId,
      conversation_id: asString(input.conversation.id),
      message_id: asString(input.message.id),
      event_type: "auto_service_action.request_type",
      details: {
        request_type_id: selected.id,
        request_type_title: asString(requestType.title),
        next_step: "task_creation_flow",
      },
    });
    return {
      source: "unrouted" as const,
      ticketId: null,
      confidencePercent: null,
      reason: "Cliente escolheu um tipo de solicitaÃ§Ã£o para criar tarefa.",
    };
  }

  if (selected.type === "action") {
    if (selected.action === "menu") {
      await supabaseAdmin
        .from("whatsapp_active_ticket_contexts")
        .update({
          cleared_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("organization_id", input.organizationId)
        .eq("conversation_id", asString(input.conversation.id))
        .is("cleared_at", null);

      await supabaseAdmin
        .from("whatsapp_task_creation_flows")
        .update({
          status: "cancelled",
          cancelled_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("organization_id", input.organizationId)
        .eq("conversation_id", asString(input.conversation.id))
        .in("status", ["collecting_sector", "collecting_title", "collecting_description", "blocked"]);

      await sendAutoServiceMenu(supabaseAdmin, {
        organizationId: input.organizationId,
        conversation: input.conversation,
        contact: input.contact,
        reason: "customer_requested_menu",
        includeTickets: false,
      });
      await supabaseAdmin
        .from("whatsapp_conversations")
        .update({ status: "open", assigned_team: null, updated_at: new Date().toISOString() })
        .eq("id", input.conversation.id);
      await createWhatsAppEvent(supabaseAdmin, {
        organization_id: input.organizationId,
        conversation_id: asString(input.conversation.id),
        message_id: asString(input.message.id),
        event_type: "auto_service_action.menu",
        details: { action: selected.action, next_step: "auto_service_menu", cleared_context: true },
      });
      return {
        source: "unrouted" as const,
        ticketId: null,
        confidencePercent: null,
        reason: "Cliente solicitou o menu de autoatendimento.",
      };
    }

    if (selected.action === "requests") {
      await supabaseAdmin
        .from("whatsapp_conversations")
        .update({ status: "open", assigned_team: null, updated_at: new Date().toISOString() })
        .eq("id", input.conversation.id);
      await sendRequestsFlowMenu(supabaseAdmin, {
        organizationId: input.organizationId,
        conversation: input.conversation,
        contact: input.contact,
        sourceMessageId: asString(input.message.id),
      });
      await createWhatsAppEvent(supabaseAdmin, {
        organization_id: input.organizationId,
        conversation_id: asString(input.conversation.id),
        message_id: asString(input.message.id),
        event_type: "auto_service_action.requests",
        details: { action: selected.action, next_step: "requests_flow_menu" },
      });
      return {
        source: "unrouted" as const,
        ticketId: null,
        confidencePercent: null,
        reason: "Cliente abriu o fluxo de solicitaÃ§Ãµes.",
      };
    }

    if (selected.action === "continue_context") {
      await sendSystemText(supabaseAdmin, {
        organizationId: input.organizationId,
        conversation: input.conversation,
        contact: input.contact,
        body: "Certo. Envie a prÃ³xima mensagem ou documento que deseja adicionar ao ticket selecionado.",
        clientMessageId: `${input.organizationId}:continue-context:${input.message.id}`,
      });
      await createWhatsAppEvent(supabaseAdmin, {
        organization_id: input.organizationId,
        conversation_id: asString(input.conversation.id),
        message_id: asString(input.message.id),
        event_type: "auto_service_action.continue_context",
        details: { action: selected.action, active_context_kept: true },
      });
      return {
        source: "unrouted" as const,
        ticketId: null,
        confidencePercent: null,
        reason: "Cliente optou por continuar adicionando contexto ao ticket selecionado.",
      };
    }

    if (selected.action === "end_flow") {
      await supabaseAdmin
        .from("whatsapp_active_ticket_contexts")
        .update({
          cleared_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("organization_id", input.organizationId)
        .eq("conversation_id", asString(input.conversation.id))
        .is("cleared_at", null);

      await supabaseAdmin
        .from("whatsapp_task_creation_flows")
        .update({
          status: "cancelled",
          cancelled_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("organization_id", input.organizationId)
        .eq("conversation_id", asString(input.conversation.id))
        .in("status", ["collecting_sector", "collecting_title", "collecting_description", "blocked"]);

      await supabaseAdmin
        .from("whatsapp_conversations")
        .update({ status: "open", assigned_team: null, updated_at: new Date().toISOString() })
        .eq("id", input.conversation.id);

      await sendSystemText(supabaseAdmin, {
        organizationId: input.organizationId,
        conversation: input.conversation,
        contact: input.contact,
        body: "Certo. Encerramos este fluxo de atendimento automÃ¡tico. Caso precise de algo mais, envie *menu* para ver as opÃ§Ãµes novamente.",
        clientMessageId: `${input.organizationId}:auto-action:${selected.action}:${input.message.id}`,
      });

      await createWhatsAppEvent(supabaseAdmin, {
        organization_id: input.organizationId,
        conversation_id: asString(input.conversation.id),
        message_id: asString(input.message.id),
        event_type: "auto_service_action.end_flow",
        details: { action: selected.action, cleared_context: true },
      });

      return {
        source: "unrouted" as const,
        ticketId: null,
        confidencePercent: null,
        reason: "Cliente encerrou o fluxo automÃ¡tico.",
      };
    }

    if (selected.action === "attendance" || selected.action === "talk_team") {
      const flowSettings = await loadWhatsAppFlowSettings(supabaseAdmin, input.organizationId);
      if (!flowSettings.includeHumanAttendance) {
        await sendSystemText(supabaseAdmin, {
          organizationId: input.organizationId,
          conversation: input.conversation,
          contact: input.contact,
          body: "Este canal esta configurado para atendimento automatico no momento. Selecione uma opcao para abrir ou acompanhar solicitacoes.",
          clientMessageId: `${input.organizationId}:auto-action:${selected.action}:automatic-only:${input.message.id}`,
        });
        await sendRequestsFlowMenu(supabaseAdmin, {
          organizationId: input.organizationId,
          conversation: input.conversation,
          contact: input.contact,
          sourceMessageId: `automatic-only:${input.message.id}`,
        });
        await createWhatsAppEvent(supabaseAdmin, {
          organization_id: input.organizationId,
          conversation_id: asString(input.conversation.id),
          message_id: asString(input.message.id),
          event_type: "auto_service_action.attendance_disabled",
          details: { action: selected.action, next_step: "automatic_flow" },
        });
        return {
          source: "unrouted" as const,
          ticketId: null,
          confidencePercent: null,
          reason: "Atendimento humano desabilitado no fluxo automatico.",
        };
      }

      const outsideOfficeHours = isOutsideHumanAttendanceHours();
      await supabaseAdmin
        .from("whatsapp_conversations")
        .update({
          status: "in_attendance",
          assigned_team: "Atendimento",
          updated_at: new Date().toISOString(),
        })
        .eq("id", input.conversation.id);

      const attendanceMessage = outsideOfficeHours
        ? "No momento, o horÃ¡rio de atendimento do escritÃ³rio jÃ¡ foi excedido. Sua solicitaÃ§Ã£o ficou registrada e retornaremos no prÃ³ximo dia Ãºtil, ou assim que possÃ­vel."
        : "Certo. Encaminhamos sua conversa para a equipe de atendimento. Em instantes, alguÃ©m da nossa equipe darÃ¡ continuidade por aqui.";
      await sendSystemText(supabaseAdmin, {
        organizationId: input.organizationId,
        conversation: input.conversation,
        contact: input.contact,
        body: attendanceMessage,
        clientMessageId: `${input.organizationId}:auto-action:${selected.action}:${input.message.id}`,
      });
      await createWhatsAppNotification(supabaseAdmin, {
        organization_id: input.organizationId,
        conversation_id: asString(input.conversation.id),
        target_scope: "queue",
        notification_type: "new_message",
        title: "Atendimento WhatsApp solicitado",
        body: input.body || "Cliente solicitou atendimento humano pelo WhatsApp.",
      });
      await createWhatsAppEvent(supabaseAdmin, {
        organization_id: input.organizationId,
        conversation_id: asString(input.conversation.id),
        message_id: asString(input.message.id),
        event_type: `auto_service_action.${selected.action}`,
        details: { action: selected.action, next_step: "attendance_queue", outside_office_hours: outsideOfficeHours },
      });
      return {
        source: "unrouted" as const,
        ticketId: null,
        confidencePercent: null,
        reason: outsideOfficeHours
          ? "Cliente solicitou atendimento humano fora do horÃ¡rio comercial."
          : "Cliente solicitou atendimento humano.",
      };
    }

    if (selected.action === "consult_tasks") {
      await supabaseAdmin
        .from("whatsapp_conversations")
        .update({ status: "open", assigned_team: null, updated_at: new Date().toISOString() })
        .eq("id", input.conversation.id);
      await sendActiveTicketsSelection(supabaseAdmin, {
        organizationId: input.organizationId,
        conversation: input.conversation,
        contact: input.contact,
        sourceMessageId: asString(input.message.id),
      });
      await createWhatsAppEvent(supabaseAdmin, {
        organization_id: input.organizationId,
        conversation_id: asString(input.conversation.id),
        message_id: asString(input.message.id),
        event_type: "auto_service_action.consult_tasks",
        details: { action: selected.action },
      });
      return {
        source: "unrouted" as const,
        ticketId: null,
        confidencePercent: null,
        reason: "Cliente solicitou consulta de tarefas em andamento.",
      };
    }

    if (selected.action === "create_task") {
      await supabaseAdmin
        .from("whatsapp_conversations")
        .update({ status: "open", assigned_team: null, updated_at: new Date().toISOString() })
        .eq("id", input.conversation.id);
      await startTaskCreationFlow(supabaseAdmin, {
        organizationId: input.organizationId,
        conversation: input.conversation,
        contact: input.contact,
        sourceMessageId: asString(input.message.id),
      });
      await createWhatsAppEvent(supabaseAdmin, {
        organization_id: input.organizationId,
        conversation_id: asString(input.conversation.id),
        message_id: asString(input.message.id),
        event_type: "auto_service_action.create_task",
        details: { action: selected.action, next_step: "task_creation_flow" },
      });
      return {
        source: "unrouted" as const,
        ticketId: null,
        confidencePercent: null,
        reason: "Cliente iniciou fluxo guiado de criaÃ§Ã£o de tarefa.",
      };
    }

    const actionMessages = {
      attendance: "Chamamos a equipe interna. Envie sua mensagem com o contexto para darmos continuidade.",
      new_request: "Certo. Descreva sua solicitaÃ§Ã£o em uma mensagem para criarmos o atendimento.",
      send_document: "Pode enviar o documento por aqui. Se ele estiver relacionado a um ticket existente, selecione o ticket antes de anexar.",
      talk_team: "Chamamos a equipe interna. Envie sua mensagem com o contexto para darmos continuidade.",
    } as const;
    await sendSystemText(supabaseAdmin, {
      organizationId: input.organizationId,
      conversation: input.conversation,
      contact: input.contact,
      body: actionMessages[selected.action as keyof typeof actionMessages],
      clientMessageId: `${input.organizationId}:auto-action:${selected.action}:${input.message.id}`,
    });
    await createWhatsAppEvent(supabaseAdmin, {
      organization_id: input.organizationId,
      conversation_id: asString(input.conversation.id),
      message_id: asString(input.message.id),
      event_type: `auto_service_action.${selected.action}`,
      details: { action: selected.action },
    });
    return {
      source: "unrouted" as const,
      ticketId: null,
      confidencePercent: null,
      reason: "Cliente escolheu uma aÃ§Ã£o do autoatendimento.",
    };
  }

  const flowDecision = await handleTaskCreationFlowReply(supabaseAdmin, {
    organizationId: input.organizationId,
    conversation: input.conversation,
    contact: input.contact,
    message: input.message,
    body: input.body,
  });
  if (flowDecision) return flowDecision;

  const protocol = extractPublicTicketProtocol(input.body);
  const { data: protocolTicket, error: protocolTicketError } = protocol
    ? await supabaseAdmin
      .from("whatsapp_customer_tickets")
      .select("*")
      .eq("organization_id", input.organizationId)
      .eq("public_protocol", protocol)
      .maybeSingle()
    : { data: null, error: null };
  if (protocolTicketError) throw protocolTicketError;

  const { data: activeContext, error: contextError } = await supabaseAdmin
    .from("whatsapp_active_ticket_contexts")
    .select("*, ticket:whatsapp_customer_tickets(*)")
    .eq("organization_id", input.organizationId)
    .eq("conversation_id", asString(input.conversation.id))
    .is("cleared_at", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (contextError) throw contextError;

  const decision = resolveWhatsAppTicketRoute({
    protocolTicketId: asString(protocolTicket?.id) || null,
    activeContextTicketId: asString(activeContext?.ticket_id) || null,
  });

  if (decision.ticketId) {
    const ticket = protocolTicket || activeContext?.ticket;
    if (!ticket) return decision;

    await supabaseAdmin.from("whatsapp_task_message_links").upsert({
      organization_id: input.organizationId,
      ticket_id: ticket.id,
      task_id: ticket.task_id,
      conversation_id: input.conversation.id,
      message_id: input.message.id,
      relation_type: "customer_reply",
      visibility: "customer",
      route_source: decision.source,
      route_confidence_percent: decision.confidencePercent,
    }, { onConflict: "organization_id,message_id,relation_type,ticket_id" });

    await supabaseAdmin
      .from("whatsapp_customer_tickets")
      .update({
        status: ticket.status === "waiting_customer" || ticket.status === "resolved" ? "open" : ticket.status,
        resolved_at: ticket.status === "resolved" ? null : ticket.resolved_at,
        closed_at: ticket.status === "closed" ? null : ticket.closed_at,
        last_customer_message_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", ticket.id);

    await createWhatsAppTicketEvent(supabaseAdmin, {
      organizationId: input.organizationId,
      ticketId: ticket.id,
      taskId: ticket.task_id,
      conversationId: asString(input.conversation.id),
      messageId: asString(input.message.id),
      eventType: `message.route.${decision.source}`,
      details: { reason: decision.reason, confidence_percent: decision.confidencePercent },
      idempotencyKey: `${input.organizationId}:route-message:${input.message.id}`,
    });

    if (decision.source === "active_context") {
      await sendTicketContextFollowupActions(supabaseAdmin, {
        organizationId: input.organizationId,
        conversation: input.conversation,
        contact: input.contact,
        sourceMessageId: asString(input.message.id),
      });
    }

    return decision;
  }

  await createWhatsAppTicketEvent(supabaseAdmin, {
    organizationId: input.organizationId,
    conversationId: asString(input.conversation.id),
    messageId: asString(input.message.id),
    eventType: "message.route.unrouted",
    details: { reason: decision.reason },
    idempotencyKey: `${input.organizationId}:route-unrouted:${input.message.id}`,
  });

  await sendAutoServiceMenu(supabaseAdmin, {
    organizationId: input.organizationId,
    conversation: input.conversation,
    contact: input.contact,
    reason: "unrouted_message",
  });

  return { ...decision, reason: "Mensagem sem ticket selecionado; autoatendimento enviado ao cliente." };
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
    .select("id, client_id, phone_number, display_name, profile_name, match_status, auto_link_source")
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
    provider_phone_number_id: inbound.providerPhoneNumberId,
    provider_display_phone_number: inbound.providerDisplayPhoneNumber,
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
      provider_phone_number_id: inbound.providerPhoneNumberId,
      provider_display_phone_number: inbound.providerDisplayPhoneNumber,
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
        const downloaded = await downloadWhatsAppMedia(inbound.providerMediaId, inbound.providerPhoneNumberId);
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
    details: {
      message_type: inbound.messageType,
      provider_phone_number_id: inbound.providerPhoneNumberId,
      provider_display_phone_number: inbound.providerDisplayPhoneNumber,
    },
  });

  const routeDecision = await routeInboundToTicket(supabaseAdmin, {
    organizationId,
    conversation,
    contact,
    message,
    body: inbound.body,
    interactiveReplyId: inbound.interactiveReplyId,
  });

  await createWhatsAppNotification(supabaseAdmin, {
    organization_id: organizationId,
    conversation_id: conversation.id,
    target_user_id: conversation.assigned_to_user_id,
    target_scope: conversation.assigned_to_user_id ? "user" : "queue",
    notification_type: "new_message",
    title: `Nova mensagem WhatsApp${contact.client_id ? "" : " nÃ£o identificada"}`,
    body: routeDecision.ticketId
      ? inbound.body || "Arquivo recebido pelo WhatsApp"
      : `Mensagem sem ticket selecionado: ${inbound.body || "Arquivo recebido pelo WhatsApp"}`,
  });

  return { ok: true, conversation_id: conversation.id, message_id: message.id, route: routeDecision };
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


