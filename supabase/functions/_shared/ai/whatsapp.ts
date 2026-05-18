import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

import { runGrowAssistantWithAuthorizedContext } from "./assistant.ts";
import { getAuthorizedClientContext } from "./authorization.ts";
import { logWhatsAppWebhookEvent } from "./logging.ts";
import type { JsonRecord, ParsedWhatsAppInboundMessage, WhatsAppClientMatch } from "./types.ts";
import { asRecord, asTrimmedString, maskCnpj, normalizePhoneDigits, normalizeText } from "./utils.ts";

const DEFAULT_WHATSAPP_GRAPH_API_VERSION = "v23.0";

function getWhatsAppConfig() {
  return {
    verifyToken: Deno.env.get("WHATSAPP_VERIFY_TOKEN")?.trim() || "",
    accessToken: Deno.env.get("WHATSAPP_ACCESS_TOKEN")?.trim() || "",
    phoneNumberId: Deno.env.get("WHATSAPP_PHONE_NUMBER_ID")?.trim() || "",
    graphApiVersion: DEFAULT_WHATSAPP_GRAPH_API_VERSION,
  };
}

async function isWhatsAppEnabledForOrganization(supabaseAdmin: SupabaseClient, organizationId: string) {
  const { data, error } = await supabaseAdmin
    .from("organization_settings")
    .select("feature_flags")
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error) throw error;

  const flags = data?.feature_flags;
  return !(
    flags &&
    typeof flags === "object" &&
    !Array.isArray(flags) &&
    (flags as Record<string, unknown>).whatsapp === false
  );
}

function combineDddAndPhone(ddd: string | null | undefined, phone: string | null | undefined) {
  const dddDigits = normalizePhoneDigits(ddd);
  const phoneDigits = normalizePhoneDigits(phone);
  if (!phoneDigits) return null;
  return dddDigits ? `${dddDigits}${phoneDigits}` : phoneDigits;
}

function extractMessageText(message: JsonRecord) {
  const type = String(message.type || "").trim().toLowerCase();

  if (type === "text") {
    return asTrimmedString(asRecord(message.text)?.body) || "";
  }

  if (type === "button") {
    return asTrimmedString(asRecord(message.button)?.text) || "";
  }

  const interactive = asRecord(message.interactive);
  const buttonReply = asRecord(interactive?.button_reply);
  const listReply = asRecord(interactive?.list_reply);

  return (
    asTrimmedString(buttonReply?.title) ||
    asTrimmedString(listReply?.title) ||
    asTrimmedString(asRecord(message.document)?.caption) ||
    asTrimmedString(asRecord(message.image)?.caption) ||
    asTrimmedString(asRecord(message.video)?.caption) ||
    ""
  );
}

function extractAttachments(message: JsonRecord): JsonRecord[] {
  const type = String(message.type || "").trim().toLowerCase();
  if (!type || type === "text") return [];

  const media = asRecord(message[type]);
  if (!media) return [];

  return [{
    type,
    id: asTrimmedString(media.id),
    mime_type: asTrimmedString(media.mime_type),
    sha256: asTrimmedString(media.sha256),
    filename: asTrimmedString(media.filename),
    caption: asTrimmedString(media.caption),
  }];
}

export function parseWhatsAppMessage(payload: unknown): ParsedWhatsAppInboundMessage[] {
  const root = asRecord(payload);
  if (!root) return [];

  const entries = Array.isArray(root.entry) ? root.entry : [];
  const parsed: ParsedWhatsAppInboundMessage[] = [];

  for (const entry of entries) {
    const entryRecord = asRecord(entry);
    const changes = Array.isArray(entryRecord?.changes) ? entryRecord?.changes : [];

    for (const change of changes) {
      const value = asRecord(asRecord(change)?.value);
      const contacts = Array.isArray(value?.contacts) ? value.contacts : [];
      const profileName =
        asTrimmedString(asRecord(asRecord(contacts[0])?.profile)?.name) ||
        null;
      const messages = Array.isArray(value?.messages) ? value.messages : [];

      for (const messageItem of messages) {
        const message = asRecord(messageItem);
        if (!message) continue;

        const type = String(message.type || "unknown").trim().toLowerCase();
        parsed.push({
          from: normalizePhoneDigits(asTrimmedString(message.from)) || "",
          profileName,
          messageId: asTrimmedString(message.id),
          messageType: type || "unknown",
          text: extractMessageText(message),
          rawText: extractMessageText(message) || null,
          attachments: extractAttachments(message),
          timestamp: asTrimmedString(message.timestamp),
        });
      }
    }
  }

  return parsed.filter((item) => item.from);
}

async function fetchWhatsAppStatusEvents(
  payload: unknown,
  supabaseAdmin: SupabaseClient,
) {
  const root = asRecord(payload);
  if (!root) return 0;

  const entries = Array.isArray(root.entry) ? root.entry : [];
  let count = 0;

  for (const entry of entries) {
    const changes = Array.isArray(asRecord(entry)?.changes) ? (asRecord(entry)?.changes as unknown[]) : [];
    for (const change of changes) {
      const value = asRecord(asRecord(change)?.value);
      const statuses = Array.isArray(value?.statuses) ? value.statuses : [];

      for (const statusItem of statuses) {
        const status = asRecord(statusItem);
        if (!status) continue;
        await logWhatsAppWebhookEvent(supabaseAdmin, {
          cliente_id: null,
          user_id: null,
          direction: "system",
          phone: normalizePhoneDigits(asTrimmedString(status.recipient_id)),
          message_type: "status",
          provider_message_id: asTrimmedString(status.id),
          payload: status,
          processing_status: asTrimmedString(status.status) || "status_update",
        });
        count += 1;
      }
    }
  }

  return count;
}

export async function findClientByPhone(
  supabaseAdmin: SupabaseClient,
  phone: string,
): Promise<WhatsAppClientMatch[]> {
  const normalizedPhone = normalizePhoneDigits(phone);
  if (!normalizedPhone) return [];

  const [clientsResult, clientDataResult] = await Promise.all([
    supabaseAdmin
      .from("clients")
      .select("id, organization_id, name, cnpj, phone, portal_user_id")
      .not("status", "eq", "Inativo"),
    supabaseAdmin
      .from("client_data")
      .select("client_id, field_name, field_value")
      .in("field_name", ["whatsapp", "telefone", "ddd"]),
  ]);

  if (clientsResult.error) throw clientsResult.error;
  if (clientDataResult.error) throw clientDataResult.error;

  const dddByClient = new Map<string, string | null>();
  const telefoneByClient = new Map<string, string | null>();
  const whatsappByClient = new Map<string, string | null>();

  for (const row of clientDataResult.data || []) {
    const clientId = asTrimmedString(row.client_id);
    const fieldName = asTrimmedString(row.field_name)?.toLowerCase();
    const fieldValue = asTrimmedString(row.field_value);
    if (!clientId || !fieldName || !fieldValue) continue;

    if (fieldName === "ddd") dddByClient.set(clientId, fieldValue);
    if (fieldName === "telefone") telefoneByClient.set(clientId, fieldValue);
    if (fieldName === "whatsapp") whatsappByClient.set(clientId, fieldValue);
  }

  const matches = new Map<string, WhatsAppClientMatch>();

  for (const client of clientsResult.data || []) {
    const clientPhone = normalizePhoneDigits(client.phone);
    const whatsappPhone = normalizePhoneDigits(whatsappByClient.get(client.id));
    const telefonePhone = normalizePhoneDigits(combineDddAndPhone(dddByClient.get(client.id), telefoneByClient.get(client.id)));
    const fallbackPhone = normalizePhoneDigits(telefoneByClient.get(client.id));

    if (clientPhone && clientPhone === normalizedPhone) {
      matches.set(client.id, {
        clientId: client.id,
        organizationId: client.organization_id,
        clientName: client.name,
        portalUserId: client.portal_user_id,
        phone: client.phone,
        cnpjMasked: maskCnpj(client.cnpj),
        cnpjDigits: asTrimmedString(client.cnpj)?.replace(/\D/g, "") || null,
        matchedBy: "clients.phone",
      });
      continue;
    }

    if (whatsappPhone && whatsappPhone === normalizedPhone) {
      matches.set(client.id, {
        clientId: client.id,
        organizationId: client.organization_id,
        clientName: client.name,
        portalUserId: client.portal_user_id,
        phone: whatsappByClient.get(client.id) || client.phone,
        cnpjMasked: maskCnpj(client.cnpj),
        cnpjDigits: asTrimmedString(client.cnpj)?.replace(/\D/g, "") || null,
        matchedBy: "client_data.whatsapp",
      });
      continue;
    }

    if ((telefonePhone && telefonePhone === normalizedPhone) || (fallbackPhone && fallbackPhone === normalizedPhone)) {
      matches.set(client.id, {
        clientId: client.id,
        organizationId: client.organization_id,
        clientName: client.name,
        portalUserId: client.portal_user_id,
        phone: telefoneByClient.get(client.id) || client.phone,
        cnpjMasked: maskCnpj(client.cnpj),
        cnpjDigits: asTrimmedString(client.cnpj)?.replace(/\D/g, "") || null,
        matchedBy: "client_data.telefone",
      });
    }
  }

  return Array.from(matches.values());
}

async function sendWhatsAppRequest(body: JsonRecord) {
  const config = getWhatsAppConfig();
  if (!config.accessToken || !config.phoneNumberId) {
    return { sent: false, skipped: true, response: null };
  }

  const response = await fetch(
    `https://graph.facebook.com/${config.graphApiVersion}/${config.phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(
      `WhatsApp Cloud API error: ${
        payload && typeof payload === "object" && "error" in payload
          ? JSON.stringify((payload as { error: unknown }).error)
          : response.statusText
      }`,
    );
  }

  return { sent: true, skipped: false, response: payload };
}

export async function sendWhatsAppTextMessage(to: string, message: string) {
  return await sendWhatsAppRequest({
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "text",
    text: {
      preview_url: false,
      body: message,
    },
  });
}

export async function sendWhatsAppDocumentMessage(to: string, documentUrl: string, caption?: string | null) {
  return await sendWhatsAppRequest({
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "document",
    document: {
      link: documentUrl,
      caption: caption || undefined,
    },
  });
}

function buildUnknownPhoneReply() {
  return "Nao consegui localizar um cliente vinculado a este numero. Informe o CNPJ da empresa ou acesse o portal da Grow para continuar com seguranca.";
}

function buildAmbiguousPhoneReply(_matches: WhatsAppClientMatch[]) {
  return "Localizei mais de um cliente vinculado a este numero. Responda com o CNPJ ou a razao social da empresa para seguirmos com seguranca.";
}

function resolveMatchByUserReply(matches: WhatsAppClientMatch[], text: string) {
  const digits = normalizePhoneDigits(text);
  if (digits && digits.length >= 8) {
    const byCnpj = matches.find((item) => item.cnpjDigits === digits);
    if (byCnpj) return byCnpj;
  }

  const normalizedText = normalizeText(text);
  if (!normalizedText) return null;

  return matches.find((item) => normalizeText(item.clientName).includes(normalizedText));
}

export async function handleWhatsAppInboundMessage(params: {
  payload: unknown;
  supabaseAdmin: SupabaseClient;
}) {
  const parsedMessages = parseWhatsAppMessage(params.payload);
  const statusEvents = await fetchWhatsAppStatusEvents(params.payload, params.supabaseAdmin);

  if (parsedMessages.length === 0) {
    return {
      processed: 0,
      statusEvents,
      replies: [],
    };
  }

  const replies: Array<Record<string, unknown>> = [];

  for (const message of parsedMessages) {
    const incomingLog = await logWhatsAppWebhookEvent(params.supabaseAdmin, {
      cliente_id: null,
      user_id: null,
      direction: "incoming",
      phone: message.from,
      message_type: message.messageType,
      provider_message_id: message.messageId,
      payload: message,
      processing_status: "received",
    });

    let reply = "";
    let clientId: string | null = null;
    let organizationId: string | null = null;
    let userId: string | null = null;
    let processingStatus = "processed";

    const matches = await findClientByPhone(params.supabaseAdmin, message.from);

    if (matches.length === 0) {
      reply = buildUnknownPhoneReply();
      processingStatus = "unknown_phone";
    } else if (matches.length > 1) {
      const resolvedMatch = resolveMatchByUserReply(matches, message.text);

      if (!resolvedMatch) {
        reply = buildAmbiguousPhoneReply(matches);
        processingStatus = "multiple_clients";
      } else if (!resolvedMatch.portalUserId) {
        clientId = resolvedMatch.clientId;
        organizationId = resolvedMatch.organizationId;
        reply =
          "Identifiquei a empresa, mas este numero ainda nao esta habilitado para atendimento automatizado com acesso seguro ao portal. Vou direcionar para atendimento humano.";
        processingStatus = "missing_portal_user";
      } else {
        clientId = resolvedMatch.clientId;
        organizationId = resolvedMatch.organizationId;
        userId = resolvedMatch.portalUserId;

        if (!await isWhatsAppEnabledForOrganization(params.supabaseAdmin, resolvedMatch.organizationId)) {
          reply = "O atendimento automatico por WhatsApp esta temporariamente indisponivel para esta organizacao.";
          processingStatus = "module_disabled";
        } else {
          const authorizedContext = await getAuthorizedClientContext({
            supabaseAdmin: params.supabaseAdmin,
            userId: resolvedMatch.portalUserId,
            requesterRoles: ["client"],
            clienteId: resolvedMatch.clientId,
            requesterDisplayName: message.profileName || "Contato WhatsApp",
            requesterEmail: null,
            requesterIdentityMethod: "phone_match",
            requesterIdentityVerified: false,
          });

          const result = await runGrowAssistantWithAuthorizedContext({
            supabaseAdmin: params.supabaseAdmin,
            userId: resolvedMatch.portalUserId,
            requesterRoles: ["client"],
            clienteId: resolvedMatch.clientId,
            message: message.text || "Mensagem recebida sem conteudo textual.",
            channel: "whatsapp",
            attachments: message.attachments,
            authorizedContext,
          });

          reply = result.reply;
          processingStatus = result.action.type;
        }
      }
    } else {
      const match = matches[0];
      clientId = match.clientId;
      organizationId = match.organizationId;
      userId = match.portalUserId;

      if (!match.portalUserId) {
        reply =
          "Encontrei o cliente, mas este numero ainda nao esta habilitado para atendimento automatizado com acesso seguro ao portal. Vou direcionar para atendimento humano.";
        processingStatus = "missing_portal_user";
      } else {
        if (!await isWhatsAppEnabledForOrganization(params.supabaseAdmin, match.organizationId)) {
          reply = "O atendimento automatico por WhatsApp esta temporariamente indisponivel para esta organizacao.";
          processingStatus = "module_disabled";
        } else {
          const authorizedContext = await getAuthorizedClientContext({
            supabaseAdmin: params.supabaseAdmin,
            userId: match.portalUserId,
            requesterRoles: ["client"],
            clienteId: match.clientId,
            requesterDisplayName: message.profileName || "Contato WhatsApp",
            requesterEmail: null,
            requesterIdentityMethod: "phone_match",
            requesterIdentityVerified: false,
          });

          const result = await runGrowAssistantWithAuthorizedContext({
            supabaseAdmin: params.supabaseAdmin,
            userId: match.portalUserId,
            requesterRoles: ["client"],
            clienteId: match.clientId,
            message: message.text || "Mensagem recebida sem conteudo textual.",
            channel: "whatsapp",
            attachments: message.attachments,
            authorizedContext,
          });

          reply = result.reply;
          processingStatus = result.action.type;
        }
      }
    }

    const outboundResult = reply
      ? await sendWhatsAppTextMessage(message.from, reply)
      : { sent: false, skipped: true, response: null };

    await logWhatsAppWebhookEvent(params.supabaseAdmin, {
      organization_id: organizationId,
      cliente_id: clientId,
      user_id: userId,
      direction: "outgoing",
      phone: message.from,
      message_type: "text",
      provider_message_id:
        outboundResult.response &&
        typeof outboundResult.response === "object" &&
        Array.isArray((outboundResult.response as { messages?: unknown[] }).messages) &&
        typeof ((outboundResult.response as { messages: Array<{ id?: unknown }> }).messages[0]?.id) === "string"
          ? ((outboundResult.response as { messages: Array<{ id: string }> }).messages[0].id)
          : null,
      payload: {
        reply,
        inbound_log_id: incomingLog.id,
      },
      processing_status: outboundResult.sent ? processingStatus : "reply_not_sent",
    });

    replies.push({
      phone: message.from,
      organizationId,
      clientId,
      userId,
      reply,
      processingStatus,
      sent: outboundResult.sent,
      skipped: outboundResult.skipped,
    });
  }

  return {
    processed: parsedMessages.length,
    statusEvents,
    replies,
  };
}

export function verifyWhatsAppWebhook(req: Request) {
  const { verifyToken } = getWhatsAppConfig();
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  if (mode === "subscribe" && token && verifyToken && token === verifyToken && challenge) {
    return new Response(challenge, { status: 200 });
  }

  return new Response("Forbidden", { status: 403 });
}
