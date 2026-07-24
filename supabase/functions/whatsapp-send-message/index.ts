import { buildSupabaseAdminClient, corsHeaders, getAuthenticatedUser, jsonResponse, assertWhatsAppModuleAccess } from "../_shared/whatsapp-auth.ts";
import { createWhatsAppEvent, createWhatsAppNotification } from "../_shared/whatsapp-events.ts";
import { dispatchWhatsAppTextMessage } from "../_shared/whatsapp-provider.ts";
import { asRecord, asString, errorMessage, isActiveWindowOpen, safePreview } from "../_shared/whatsapp-validation.ts";
import { createWhatsAppTicketEvent } from "../_shared/whatsapp-ticket/audit.ts";
import { buildPublicTicketProtocol } from "../_shared/whatsapp-ticket/protocol.ts";
import { formatTaskCustomerMessage, formatTicketOpeningMessage } from "../_shared/whatsapp-ticket/task-chat.ts";

type SupabaseAdmin = ReturnType<typeof buildSupabaseAdminClient>;

type SenderIdentity = {
  displayName: string;
  sectorLabel: string;
};

const sectorLabelByCode: Record<string, string> = {
  contabil: "Contábil",
  fiscal: "Fiscal",
  departamento_pessoal: "Departamento Pessoal",
  societario: "Societário",
  comercial: "Comercial",
  geral: "Geral",
  admin: "Administrativo",
};

const roleLabelByCode: Record<string, string> = {
  admin: "Administrativo",
  colaborador: "Equipe Grow",
  cliente: "Cliente",
};

const normalizeSectorCode = (value: string | null) =>
  asString(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

const resolveSectorLabel = (sectorCode: string | null, primaryRole: string | null) => {
  const normalizedSector = normalizeSectorCode(sectorCode);
  if (normalizedSector) return sectorLabelByCode[normalizedSector] || normalizedSector;

  const normalizedRole = asString(primaryRole).trim().toLowerCase();
  return roleLabelByCode[normalizedRole] || "Equipe Grow";
};

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

async function loadSenderIdentity(supabaseAdmin: SupabaseAdmin, userId: string, organizationId: string): Promise<SenderIdentity> {
  const { data, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("display_name")
    .eq("user_id", userId)
    .maybeSingle();
  if (profileError) {
    console.warn("whatsapp sender profile lookup failed", { user_id: userId, message: errorMessage(profileError, "profile_lookup_failed") });
  }

  const { data: access } = await supabaseAdmin
    .from("organization_user_access")
    .select("primary_role, sector_code")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();

  return {
    displayName: asString(data?.display_name) || "Equipe Grow",
    sectorLabel: resolveSectorLabel(asString(access?.sector_code) || null, asString(access?.primary_role) || null),
  };
}

const formatOutboundTextForClient = (text: string, sender: SenderIdentity) => {
  return [
    `*Atendente:* ${sender.displayName}`,
    `*Setor:* ${sender.sectorLabel}`,
    "",
    text,
  ].join("\n");
};

async function sendText(supabaseAdmin: SupabaseAdmin, userId: string, body: Record<string, unknown>) {
  const conversationId = asString(body.conversationId);
  const text = asString(body.body);
  const clientMessageId = asString(body.clientMessageId);
  const replyToProviderMessageId = asString(body.replyToProviderMessageId) || null;
  const taskId = asString(body.taskId) || null;
  const ticketId = asString(body.ticketId) || null;
  const requiresCustomerResponse = body.requiresCustomerResponse === true;
  if (!conversationId || !text || !clientMessageId) throw new Error("invalid_send_payload");

  const conversation = await loadConversation(supabaseAdmin, conversationId);
  await assertWhatsAppModuleAccess(supabaseAdmin, userId, conversation.organization_id);
  const senderIdentity = await loadSenderIdentity(supabaseAdmin, userId, conversation.organization_id);
  const providerText = taskId
    ? await formatTaskBoundOutboundText(supabaseAdmin, conversation.organization_id, taskId, ticketId, senderIdentity, text)
    : formatOutboundTextForClient(text, senderIdentity);

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
      body: providerText,
      safe_preview: safePreview(providerText),
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
    body: providerText,
    clientMessageId,
    replyToProviderMessageId,
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
      body: providerText,
      safe_preview: safePreview(providerText),
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
    body: providerText,
    safe_preview: safePreview(providerText),
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
    last_message_preview: safePreview(providerText),
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
      details: {
        sender_display_name: senderIdentity.displayName,
        sender_sector: senderIdentity.sectorLabel,
        reply_to_provider_message_id: replyToProviderMessageId,
      },
  });

  if (taskId) {
    await supabaseAdmin.from("whatsapp_task_message_links").upsert({
      organization_id: conversation.organization_id,
      ticket_id: ticketId,
      task_id: taskId,
      conversation_id: conversation.id,
      message_id: message.id,
      relation_type: "agent_reply",
      visibility: "customer",
      route_confidence_percent: 100,
      created_by_user_id: userId,
    }, { onConflict: "organization_id,message_id,relation_type,ticket_id" });

    const ticketQuery = supabaseAdmin
      .from("whatsapp_customer_tickets")
      .update({
        status: requiresCustomerResponse ? "waiting_customer" : "open",
        last_agent_message_at: now,
        updated_at: now,
      })
      .eq("organization_id", conversation.organization_id);
    if (ticketId) {
      await ticketQuery.eq("id", ticketId);
    } else {
      await ticketQuery.eq("task_id", taskId);
    }
  }

  return { ok: true, message };
}

async function formatTaskBoundOutboundText(
  supabaseAdmin: SupabaseAdmin,
  organizationId: string,
  taskId: string,
  ticketId: string | null,
  sender: SenderIdentity,
  text: string,
) {
  const { data: task, error: taskError } = await supabaseAdmin
    .from("kanban_tasks")
    .select("id, title, organization_id, sector")
    .eq("id", taskId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (taskError) throw taskError;
  if (!task) throw new Error("task_not_found");

  const ticketQuery = supabaseAdmin
    .from("whatsapp_customer_tickets")
    .select("id, public_protocol")
    .eq("organization_id", organizationId);
  const { data: ticket, error: ticketError } = ticketId
    ? await ticketQuery.eq("id", ticketId).maybeSingle()
    : await ticketQuery.eq("task_id", taskId).maybeSingle();
  if (ticketError) throw ticketError;

  const taskSectorLabel = resolveSectorLabel(asString(task.sector) || null, null);
  const senderForTask = {
    ...sender,
    sectorLabel: ["Administrativo", "Equipe Grow"].includes(sender.sectorLabel)
      ? taskSectorLabel
      : sender.sectorLabel,
  };

  return formatTaskCustomerMessage({
    ticketProtocol: asString(ticket?.public_protocol) || taskId.replaceAll("-", "").slice(0, 8).toUpperCase(),
    taskTitle: asString(task.title) || "Tarefa",
    attendantName: senderForTask.displayName,
    attendantSector: senderForTask.sectorLabel,
    message: text,
  });
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
  const mode = asString(body.mode) === "continue" ? "continue" : "create";
  const existingTaskId = asString(body.existingTaskId) || null;
  const title = asString(body.title).trim();
  const description = asString(body.description).trim();
  const sector = asString(body.sector) || "Geral";
  const priority = asString(body.priority) || "Media";
  const clientMessageId = asString(body.clientMessageId);
  const contextMessages = normalizeContextMessages(body.contextMessages);
  const contextDescription = formatContextMessagesForTask(contextMessages);
  if (!conversationId || !clientMessageId) throw new Error("invalid_quick_task_payload");
  if (mode === "create" && !title) throw new Error("invalid_quick_task_payload");
  if (mode === "continue" && (!existingTaskId || contextMessages.length === 0)) throw new Error("invalid_continue_task_payload");

  const conversation = await loadConversation(supabaseAdmin, conversationId);
  await assertWhatsAppModuleAccess(supabaseAdmin, userId, conversation.organization_id);
  if (!conversation.client_id) throw new Error("client_link_required_for_ticket");

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("display_name")
    .eq("user_id", userId)
    .maybeSingle();
  const assigneeName = asString(profile?.display_name) || "Equipe Grow";

  if (mode === "continue") {
    const { data: client, error: clientError } = await supabaseAdmin
      .from("clients")
      .select("id, name")
      .eq("id", conversation.client_id)
      .eq("organization_id", conversation.organization_id)
      .maybeSingle();
    if (clientError) throw clientError;
    if (!client) throw new Error("client_not_found");

    const { data: task, error: taskError } = await supabaseAdmin
      .from("kanban_tasks")
      .select("id, title, client_name, description, assigned_to_user_id, assignee, status")
      .eq("id", existingTaskId)
      .eq("organization_id", conversation.organization_id)
      .not("status", "in", '("done","archived")')
      .maybeSingle();
    if (taskError) throw taskError;
    if (!task) throw new Error("active_task_not_found");
    if (asString(task.client_name) !== asString(client.name)) throw new Error("task_client_mismatch");

    const publicProtocol = buildPublicTicketProtocol({
      openedAt: new Date(),
      sequence: 0,
      suffix: task.id.replaceAll("-", "").slice(0, 6),
    });
    const { data: ticket, error: ticketError } = await supabaseAdmin
      .from("whatsapp_customer_tickets")
      .upsert({
        organization_id: conversation.organization_id,
        client_id: conversation.client_id,
        contact_id: conversation.contact_id,
        conversation_id: conversation.id,
        task_id: task.id,
        public_protocol: publicProtocol,
        title: task.title,
        status: "open",
        responsible_user_id: task.assigned_to_user_id,
        responsible_name: asString(task.assignee) || assigneeName,
        opened_by_user_id: userId,
        metadata: {
          source: "continued_from_whatsapp",
          continue_task_client_message_id: clientMessageId,
          context_message_ids: contextMessages.map((message) => message.id),
        },
        updated_at: new Date().toISOString(),
      }, { onConflict: "organization_id,task_id" })
      .select("id, public_protocol")
      .single();
    if (ticketError) throw ticketError;

    for (const contextMessage of contextMessages) {
      await supabaseAdmin.from("whatsapp_task_message_links").upsert({
        organization_id: conversation.organization_id,
        ticket_id: ticket.id,
        task_id: task.id,
        conversation_id: conversation.id,
        message_id: contextMessage.id,
        relation_type: "context",
        visibility: "customer",
        route_source: null,
        route_confidence_percent: 100,
        created_by_user_id: userId,
      }, { onConflict: "organization_id,message_id,relation_type,ticket_id" });
    }

    const addition = contextDescription ? `\n\nContexto adicional do WhatsApp:\n${contextDescription}` : "";
    if (addition) {
      await supabaseAdmin
        .from("kanban_tasks")
        .update({
          description: `${asString(task.description)}${addition}`,
          updated_at: new Date().toISOString(),
        })
        .eq("id", task.id)
        .eq("organization_id", conversation.organization_id);
    }

    await createWhatsAppTicketEvent(supabaseAdmin, {
      organizationId: conversation.organization_id,
      ticketId: ticket.id,
      taskId: task.id,
      conversationId: conversation.id,
      actorUserId: userId,
      eventType: "task_context_added_from_whatsapp",
      details: {
        public_protocol: ticket.public_protocol,
        context_message_ids: contextMessages.map((message) => message.id),
      },
      idempotencyKey: `${conversation.organization_id}:continue-task-context:${task.id}:${clientMessageId}`,
    });

    const { error: auditError } = await supabaseAdmin.rpc("record_operational_audit_log", {
      _organization_id: conversation.organization_id,
      _action: "Contexto WhatsApp adicionado à tarefa",
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
      console.warn("whatsapp continue task audit failed", { message: errorMessage(auditError, "audit_failed"), task_id: task.id });
    }

    return { ok: true, mode: "continue", task, ticket, contextAdded: true };
  }

  const descriptionParts = [
    description || null,
    contextDescription,
    "Criada a partir do atendimento WhatsApp.",
    conversation.contact?.phone_number ? `Contato: ${conversation.contact.phone_number}` : null,
  ].filter(Boolean);
  const quickTaskIntegrationId = `quick:${conversation.id}:${clientMessageId}`;

  const { data: insertedTask, error: taskError } = await supabaseAdmin
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
      integration_task_id: quickTaskIntegrationId,
      integration_payload: {
        source: "whatsapp_conversation",
        conversation_id: conversation.id,
        quick_task_client_message_id: clientMessageId,
        contact_phone: conversation.contact?.phone_number || null,
        context_messages: contextMessages,
      },
    })
    .select("id, title, assigned_to_user_id, assignee")
    .single();
  let task = insertedTask;
  if (taskError || !task) {
    const isDuplicateIntegrationKey =
      taskError?.code === "23505" &&
      asString(taskError?.message).includes("kanban_tasks_integration_source_task_id_key");

    if (isDuplicateIntegrationKey) {
      const { data: existingTask, error: existingTaskError } = await supabaseAdmin
        .from("kanban_tasks")
        .select("id, title, assigned_to_user_id, assignee")
        .eq("integration_source", "whatsapp")
        .eq("integration_task_id", quickTaskIntegrationId)
        .maybeSingle();
      if (existingTaskError || !existingTask) {
        throw new Error(errorMessage(existingTaskError || taskError, "quick_task_creation_failed"));
      }
      task = existingTask;
    } else {
      throw new Error(errorMessage(taskError, "quick_task_creation_failed"));
    }
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

  const publicProtocol = buildPublicTicketProtocol({
    openedAt: new Date(),
    sequence: 0,
    suffix: task.id.replaceAll("-", "").slice(0, 6),
  });
  const { data: ticket, error: ticketError } = await supabaseAdmin
    .from("whatsapp_customer_tickets")
    .upsert({
      organization_id: conversation.organization_id,
      client_id: conversation.client_id,
      contact_id: conversation.contact_id,
      conversation_id: conversation.id,
      task_id: task.id,
      public_protocol: publicProtocol,
      title: task.title,
      status: "open",
      responsible_user_id: task.assigned_to_user_id,
      responsible_name: asString(task.assignee) || assigneeName,
      opened_by_user_id: userId,
      metadata: {
        source: "quick_task",
        quick_task_client_message_id: clientMessageId,
        context_message_ids: contextMessages.map((message) => message.id),
      },
      updated_at: new Date().toISOString(),
    }, { onConflict: "organization_id,task_id" })
    .select("id, public_protocol")
    .single();
  if (ticketError) throw ticketError;

  for (const contextMessage of contextMessages) {
    await supabaseAdmin.from("whatsapp_task_message_links").upsert({
      organization_id: conversation.organization_id,
      ticket_id: ticket.id,
      task_id: task.id,
      conversation_id: conversation.id,
      message_id: contextMessage.id,
      relation_type: "context",
      visibility: "customer",
      route_source: null,
      route_confidence_percent: 100,
      created_by_user_id: userId,
    }, { onConflict: "organization_id,message_id,relation_type,ticket_id" });
  }

  await createWhatsAppTicketEvent(supabaseAdmin, {
    organizationId: conversation.organization_id,
    ticketId: ticket.id,
    taskId: task.id,
    conversationId: conversation.id,
    actorUserId: userId,
    eventType: "ticket_created_from_quick_task",
    details: {
      public_protocol: ticket.public_protocol,
      context_message_ids: contextMessages.map((message) => message.id),
    },
    idempotencyKey: `${conversation.organization_id}:quick-task-ticket:${task.id}`,
  });

  const confirmation = formatTicketOpeningMessage({
    ticketProtocol: ticket.public_protocol,
    taskTitle: task.title,
    responsibleName: asString(task.assignee) || assigneeName,
  });
  try {
    const sendResult = await sendText(supabaseAdmin, userId, {
      conversationId: conversation.id,
      body: confirmation,
      clientMessageId,
      taskId: task.id,
      ticketId: ticket.id,
    });
    return { ok: true, task, ticket, message: sendResult.message, confirmationSent: true, confirmationError: null };
  } catch (error) {
    return {
      ok: true,
      task,
      ticket,
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
