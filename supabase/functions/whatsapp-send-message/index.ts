import { buildSupabaseAdminClient, corsHeaders, getAuthenticatedUser, jsonResponse, assertWhatsAppModuleAccess } from "../_shared/whatsapp-auth.ts";
import { createWhatsAppEvent, createWhatsAppNotification } from "../_shared/whatsapp-events.ts";
import { dispatchWhatsAppTextMessage } from "../_shared/whatsapp-provider.ts";
import { asRecord, asString, errorMessage, isActiveWindowOpen, safePreview } from "../_shared/whatsapp-validation.ts";

type SupabaseAdmin = ReturnType<typeof buildSupabaseAdminClient>;

const ticketNumberForTask = (taskId: string) => taskId.replaceAll("-", "").slice(0, 8).toUpperCase();

const ticketCreatedMessage = (task: { id: string; title: string; assignee?: string | null }) => [
  "*Ticket de atendimento criado*",
  "",
  `*Numero do ticket:* #${ticketNumberForTask(task.id)}`,
  `*Titulo:* ${task.title}`,
  `*Responsavel:* ${asString(task.assignee) || "Equipe Grow"}`,
  "",
  "Recebemos sua solicitacao e nossa equipe dara continuidade ao atendimento por este ticket.",
].join("\n");

const normalizeContextMessages = (value: unknown) => {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 30).map((item) => {
    const record = asRecord(item);
    return {
      id: asString(record.id),
      direction: asString(record.direction) === "outbound" ? "outbound" : "inbound",
      body: safePreview(asString(record.body) || asString(record.safe_preview) || asString(record.messageType) || "Mensagem"),
      message_type: asString(record.messageType) || asString(record.message_type) || "unknown",
      created_at: asString(record.createdAt) || asString(record.created_at) || null,
    };
  }).filter((message) => message.id && message.body);
};

const formatContextMessagesForTask = (messages: ReturnType<typeof normalizeContextMessages>) => {
  if (messages.length === 0) return null;
  const lines = messages.map((message, index) => {
    const sender = message.direction === "inbound" ? "Cliente" : "Equipe";
    const when = message.created_at ? ` - ${message.created_at}` : "";
    return `${index + 1}. [${sender}${when}] ${message.body}`;
  });
  return ["Contexto selecionado da conversa:", ...lines].join("\n");
};

async function loadConversation(supabaseAdmin: SupabaseAdmin, conversationId: string) {
  const { data, error } = await supabaseAdmin
    .from("whatsapp_conversations")
    .select("*, contact:whatsapp_contacts(*)")
    .eq("id", conversationId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("conversation_not_found");
  return data;
}

async function sendText(supabaseAdmin: SupabaseAdmin, userId: string, body: Record<string, unknown>) {
  const conversationId = asString(body.conversationId);
  const text = asString(body.body);
  const clientMessageId = asString(body.clientMessageId);
  if (!conversationId || !text || !clientMessageId) throw new Error("invalid_send_payload");

  const conversation = await loadConversation(supabaseAdmin, conversationId);
  await assertWhatsAppModuleAccess(supabaseAdmin, userId, conversation.organization_id);

  const blockedReason = !isActiveWindowOpen(conversation.active_window_expires_at)
    ? "active_window_closed"
    : conversation.status === "archived"
      ? "conversation_archived"
      : conversation.contact?.is_blocked
        ? "contact_blocked"
        : null;

  if (blockedReason) {
    const { data: blockedMessage, error } = await supabaseAdmin.from("whatsapp_messages").insert({
      organization_id: conversation.organization_id,
      conversation_id: conversation.id,
      contact_id: conversation.contact_id,
      client_id: conversation.client_id,
      direction: "outbound",
      sender_user_id: userId,
      client_message_id: clientMessageId,
      message_type: "text",
      body: text,
      safe_preview: safePreview(text),
      delivery_status: "failed",
      blocked_reason: blockedReason,
      created_at: new Date().toISOString(),
    }).select("*").single();
    if (error) throw error;
    await createWhatsAppEvent(supabaseAdmin, {
      organization_id: conversation.organization_id,
      conversation_id: conversation.id,
      message_id: blockedMessage.id,
      event_type: "send_failed",
      actor_user_id: userId,
      details: { blocked_reason: blockedReason },
    });
    throw new Error(blockedReason);
  }

  const providerResult = await dispatchWhatsAppTextMessage({
    toPhone: conversation.contact.phone_number,
    body: text,
    clientMessageId,
  }).catch(async (error) => {
    const failureReason = error instanceof Error ? error.message : "whatsapp_provider_failed";
    const { data: failedMessage, error: insertError } = await supabaseAdmin.from("whatsapp_messages").upsert({
      organization_id: conversation.organization_id,
      conversation_id: conversation.id,
      contact_id: conversation.contact_id,
      client_id: conversation.client_id,
      direction: "outbound",
      sender_user_id: userId,
      client_message_id: clientMessageId,
      message_type: "text",
      body: text,
      safe_preview: safePreview(text),
      delivery_status: "failed",
      failure_reason: safePreview(failureReason),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: "organization_id,client_message_id" }).select("*").single();
    if (insertError) throw insertError;
    await createWhatsAppEvent(supabaseAdmin, {
      organization_id: conversation.organization_id,
      conversation_id: conversation.id,
      message_id: failedMessage.id,
      event_type: "send_failed",
      actor_user_id: userId,
      details: { failure_reason: safePreview(failureReason) },
    });
    throw new Error(failureReason);
  });

  const now = new Date().toISOString();
  const { data: message, error } = await supabaseAdmin.from("whatsapp_messages").upsert({
    organization_id: conversation.organization_id,
    conversation_id: conversation.id,
    contact_id: conversation.contact_id,
    client_id: conversation.client_id,
    direction: "outbound",
    sender_user_id: userId,
    provider_message_id: providerResult.providerMessageId,
    client_message_id: clientMessageId,
    message_type: "text",
    body: text,
    safe_preview: safePreview(text),
    delivery_status: providerResult.deliveryStatus,
    sent_at: now,
    created_at: now,
    updated_at: now,
  }, { onConflict: "organization_id,client_message_id" }).select("*").single();
  if (error) throw error;

  await supabaseAdmin.from("whatsapp_conversations").update({
    status: conversation.status === "open" ? "in_attendance" : conversation.status,
    last_message_id: message.id,
    last_message_at: now,
    last_message_preview: safePreview(text),
    last_outbound_at: now,
    updated_at: now,
  }).eq("id", conversation.id);

  await createWhatsAppEvent(supabaseAdmin, {
    organization_id: conversation.organization_id,
    conversation_id: conversation.id,
    message_id: message.id,
    event_type: "outbound_sent",
    actor_user_id: userId,
    provider_event_id: providerResult.providerMessageId,
  });

  return { ok: true, message };
}

async function linkClient(supabaseAdmin: SupabaseAdmin, userId: string, body: Record<string, unknown>) {
  const conversationId = asString(body.conversationId);
  const clientId = asString(body.clientId);
  const conversation = await loadConversation(supabaseAdmin, conversationId);
  await assertWhatsAppModuleAccess(supabaseAdmin, userId, conversation.organization_id);

  const { data: client, error: clientError } = await supabaseAdmin
    .from("clients")
    .select("id")
    .eq("id", clientId)
    .eq("organization_id", conversation.organization_id)
    .eq("status", "Ativo")
    .maybeSingle();
  if (clientError) throw clientError;
  if (!client) throw new Error("active_client_not_found");

  await Promise.all([
    supabaseAdmin.from("whatsapp_conversations").update({ client_id: clientId, updated_at: new Date().toISOString() }).eq("id", conversation.id),
    supabaseAdmin.from("whatsapp_contacts").update({ client_id: clientId, match_status: "manual", auto_link_source: "manual" }).eq("id", conversation.contact_id),
  ]);
  await createWhatsAppEvent(supabaseAdmin, {
    organization_id: conversation.organization_id,
    conversation_id: conversation.id,
    event_type: "client_link_changed",
    actor_user_id: userId,
    details: { client_id: clientId },
  });
  return { ok: true };
}

async function assignConversation(supabaseAdmin: SupabaseAdmin, userId: string, body: Record<string, unknown>) {
  const conversationId = asString(body.conversationId);
  const assignee = asString(body.userId) || null;
  const team = asString(body.team) || null;
  const conversation = await loadConversation(supabaseAdmin, conversationId);
  await assertWhatsAppModuleAccess(supabaseAdmin, userId, conversation.organization_id);

  await supabaseAdmin.from("whatsapp_conversations").update({
    assigned_to_user_id: assignee,
    assigned_team: team,
    updated_at: new Date().toISOString(),
  }).eq("id", conversation.id);
  await supabaseAdmin.from("whatsapp_conversation_assignments").insert({
    organization_id: conversation.organization_id,
    conversation_id: conversation.id,
    assigned_to_user_id: assignee,
    assigned_team: team,
    assigned_by_user_id: userId,
  });
  await createWhatsAppEvent(supabaseAdmin, {
    organization_id: conversation.organization_id,
    conversation_id: conversation.id,
    event_type: "assignment_changed",
    actor_user_id: userId,
    details: { assigned_to_user_id: assignee, assigned_team: team },
  });
  if (assignee) {
    await createWhatsAppNotification(supabaseAdmin, {
      organization_id: conversation.organization_id,
      conversation_id: conversation.id,
      target_user_id: assignee,
      target_scope: "user",
      notification_type: "assigned",
      title: "Conversa WhatsApp atribuida",
      body: conversation.last_message_preview,
    });
  }
  return { ok: true };
}

async function changeStatus(supabaseAdmin: SupabaseAdmin, userId: string, body: Record<string, unknown>) {
  const conversationId = asString(body.conversationId);
  const status = asString(body.status);
  if (!["open", "in_attendance", "pending_client", "resolved", "archived"].includes(status)) {
    throw new Error("invalid_status");
  }
  const conversation = await loadConversation(supabaseAdmin, conversationId);
  await assertWhatsAppModuleAccess(supabaseAdmin, userId, conversation.organization_id);
  await supabaseAdmin.from("whatsapp_conversations").update({ status, updated_at: new Date().toISOString() }).eq("id", conversation.id);
  await createWhatsAppEvent(supabaseAdmin, {
    organization_id: conversation.organization_id,
    conversation_id: conversation.id,
    event_type: "status_changed",
    actor_user_id: userId,
    details: { status },
  });
  return { ok: true };
}

async function createQuickTask(supabaseAdmin: SupabaseAdmin, userId: string, body: Record<string, unknown>) {
  const conversationId = asString(body.conversationId);
  const title = asString(body.title).trim();
  const description = asString(body.description).trim();
  const sector = asString(body.sector) || "Geral";
  const priority = asString(body.priority) || "Media";
  const clientMessageId = asString(body.clientMessageId);
  const contextMessages = normalizeContextMessages(body.contextMessages);
  const contextDescription = formatContextMessagesForTask(contextMessages);
  if (!conversationId || !title || !clientMessageId) throw new Error("invalid_quick_task_payload");

  const conversation = await loadConversation(supabaseAdmin, conversationId);
  await assertWhatsAppModuleAccess(supabaseAdmin, userId, conversation.organization_id);

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("display_name")
    .eq("user_id", userId)
    .eq("organization_id", conversation.organization_id)
    .maybeSingle();
  const assigneeName = asString(profile?.display_name) || "Equipe Grow";

  const descriptionParts = [
    description || null,
    contextDescription,
    "Criada a partir do atendimento WhatsApp.",
    conversation.contact?.phone_number ? `Contato: ${conversation.contact.phone_number}` : null,
  ].filter(Boolean);

  const { data: task, error: taskError } = await supabaseAdmin
    .from("kanban_tasks")
    .insert({
      organization_id: conversation.organization_id,
      title,
      client_name: asString(body.clientName) || null,
      description: descriptionParts.join("\n"),
      priority,
      sector,
      status: "todo",
      tags: [sector, "WhatsApp"],
      subtasks: [],
      created_by: userId,
      assigned_to_user_id: userId,
      assignee: assigneeName,
      integration_source: "whatsapp",
      integration_task_id: conversation.id,
      integration_payload: {
        source: "whatsapp_conversation",
        conversation_id: conversation.id,
        contact_phone: conversation.contact?.phone_number || null,
        context_messages: contextMessages,
      },
    })
    .select("id, title, assigned_to_user_id, assignee")
    .single();
  if (taskError || !task) {
    throw new Error(errorMessage(taskError, "quick_task_creation_failed"));
  }

  const { error: auditError } = await supabaseAdmin.rpc("record_operational_audit_log", {
    _organization_id: conversation.organization_id,
    _action: "Tarefa criada pelo WhatsApp",
    _entity_type: "task",
    _entity_id: task.id,
    _result: "success",
    _metadata: {
      details: task.title,
      source: "whatsapp",
      conversation_id: conversation.id,
      context_message_ids: contextMessages.map((message) => message.id),
    },
    _client_id: null,
    _request_id: null,
  });
  if (auditError) {
    console.warn("whatsapp quick task audit failed", { message: errorMessage(auditError, "audit_failed"), task_id: task.id });
  }

  const confirmation = ticketCreatedMessage(task);
  try {
    await sendText(supabaseAdmin, userId, {
      conversationId: conversation.id,
      body: confirmation,
      clientMessageId,
    });
    return { ok: true, task, confirmationSent: true, confirmationError: null };
  } catch (error) {
    return {
      ok: true,
      task,
      confirmationSent: false,
      confirmationError: error instanceof Error ? error.message : "ticket_confirmation_failed",
    };
  }
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (request.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  try {
    const body = asRecord(await request.json().catch(() => ({})));
    const action = asString(body.action);
    const supabaseAdmin = buildSupabaseAdminClient();
    const user = await getAuthenticatedUser(request, supabaseAdmin);

    if (action === "send_text") return jsonResponse(await sendText(supabaseAdmin, user.id, body));
    if (action === "link_client") return jsonResponse(await linkClient(supabaseAdmin, user.id, body));
    if (action === "assign_conversation") return jsonResponse(await assignConversation(supabaseAdmin, user.id, body));
    if (action === "change_status") return jsonResponse(await changeStatus(supabaseAdmin, user.id, body));
    if (action === "create_quick_task") return jsonResponse(await createQuickTask(supabaseAdmin, user.id, body));
    return jsonResponse({ error: "unknown_action" }, 400);
  } catch (error) {
    return jsonResponse({ error: errorMessage(error, "send_message_failed") }, 400);
  }
});
