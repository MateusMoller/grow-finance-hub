import {
  assertWhatsAppModuleAccess,
  buildSupabaseAdminClient,
  corsHeaders,
  getAuthenticatedUser,
  jsonResponse,
} from "../_shared/whatsapp-auth.ts";
import { createWhatsAppTicketEvent } from "../_shared/whatsapp-ticket/audit.ts";
import { buildPublicTicketProtocol } from "../_shared/whatsapp-ticket/protocol.ts";
import { dispatchWhatsAppTextMessage } from "../_shared/whatsapp-provider.ts";
import { asRecord, asString, errorMessage, safePreview } from "../_shared/whatsapp-validation.ts";
import { assertDelegatedTaskAction } from "../_shared/task-authorization.ts";

type SupabaseAdmin = ReturnType<typeof buildSupabaseAdminClient>;

const nowIso = () => new Date().toISOString();

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

async function loadTask(supabaseAdmin: SupabaseAdmin, organizationId: string, taskId: string) {
  const { data, error } = await supabaseAdmin
    .from("kanban_tasks")
    .select("id, title, description, client_name, priority, sector, status, assigned_to_user_id, assignee, organization_id, version")
    .eq("id", taskId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("task_not_found");
  return data;
}

async function ensureCanAccessConversation(
  supabaseAdmin: SupabaseAdmin,
  userId: string,
  conversationId: string,
) {
  const conversation = await loadConversation(supabaseAdmin, conversationId);
  await assertWhatsAppModuleAccess(supabaseAdmin, userId, conversation.organization_id);
  return conversation;
}

async function ensureTicketForTask(
  supabaseAdmin: SupabaseAdmin,
  input: {
    organizationId: string;
    clientId: string;
    contactId?: string | null;
    conversationId?: string | null;
    taskId: string;
    title: string;
    responsibleUserId?: string | null;
    responsibleName?: string | null;
    openedByUserId?: string | null;
    openedFromMessageId?: string | null;
  },
) {
  const publicProtocol = buildPublicTicketProtocol({
    openedAt: new Date(),
    sequence: 0,
    suffix: input.taskId.replaceAll("-", "").slice(0, 6),
  });
  const { data, error } = await supabaseAdmin
    .from("whatsapp_customer_tickets")
    .upsert({
      organization_id: input.organizationId,
      client_id: input.clientId,
      contact_id: input.contactId ?? null,
      conversation_id: input.conversationId ?? null,
      task_id: input.taskId,
      public_protocol: publicProtocol,
      title: input.title,
      status: "open",
      responsible_user_id: input.responsibleUserId ?? null,
      responsible_name: input.responsibleName ?? null,
      opened_by_user_id: input.openedByUserId ?? null,
      opened_from_message_id: input.openedFromMessageId ?? null,
      updated_at: nowIso(),
    }, { onConflict: "organization_id,task_id" })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

async function listCustomerTicketsForContact(
  supabaseAdmin: SupabaseAdmin,
  userId: string,
  body: Record<string, unknown>,
) {
  const conversationId = asString(body.conversationId);
  const contactId = asString(body.contactId);
  let organizationId = asString(body.organizationId);

  if (conversationId) {
    const conversation = await ensureCanAccessConversation(supabaseAdmin, userId, conversationId);
    organizationId = conversation.organization_id;
    const { data, error } = await supabaseAdmin
      .from("whatsapp_customer_tickets")
      .select("*")
      .eq("organization_id", organizationId)
      .or(`conversation_id.eq.${conversation.id},contact_id.eq.${conversation.contact_id}`)
      .not("status", "in", "(closed,cancelled)")
      .order("updated_at", { ascending: false })
      .limit(50);
    if (error) throw error;
    return { ok: true, tickets: data || [] };
  }

  if (!organizationId || !contactId) throw new Error("invalid_ticket_list_payload");
  await assertWhatsAppModuleAccess(supabaseAdmin, userId, organizationId);
  const { data, error } = await supabaseAdmin
    .from("whatsapp_customer_tickets")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("contact_id", contactId)
    .not("status", "in", "(closed,cancelled)")
    .order("updated_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return { ok: true, tickets: data || [] };
}

async function selectTicketContext(supabaseAdmin: SupabaseAdmin, userId: string, body: Record<string, unknown>) {
  const conversationId = asString(body.conversationId);
  const ticketId = asString(body.ticketId);
  if (!conversationId || !ticketId) throw new Error("invalid_context_payload");

  const conversation = await ensureCanAccessConversation(supabaseAdmin, userId, conversationId);
  const { data: ticket, error: ticketError } = await supabaseAdmin
    .from("whatsapp_customer_tickets")
    .select("*")
    .eq("id", ticketId)
    .eq("organization_id", conversation.organization_id)
    .maybeSingle();
  if (ticketError) throw ticketError;
  if (!ticket) throw new Error("ticket_not_found");

  await supabaseAdmin
    .from("whatsapp_active_ticket_contexts")
    .update({ cleared_at: nowIso(), updated_at: nowIso() })
    .eq("organization_id", conversation.organization_id)
    .eq("conversation_id", conversation.id)
    .is("cleared_at", null);

  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const { data: context, error } = await supabaseAdmin
    .from("whatsapp_active_ticket_contexts")
    .insert({
      organization_id: conversation.organization_id,
      conversation_id: conversation.id,
      contact_id: conversation.contact_id,
      ticket_id: ticket.id,
      task_id: ticket.task_id,
      source: "interactive_selection",
      expires_at: expiresAt,
      created_by_user_id: userId,
    })
    .select("*")
    .single();
  if (error) throw error;

  await createWhatsAppTicketEvent(supabaseAdmin, {
    organizationId: conversation.organization_id,
    ticketId: ticket.id,
    taskId: ticket.task_id,
    conversationId: conversation.id,
    actorUserId: userId,
    eventType: "ticket.context.activated",
    details: { source: "interactive_selection", expires_at: expiresAt },
  });

  return { ok: true, context };
}

async function clearTicketContext(supabaseAdmin: SupabaseAdmin, userId: string, body: Record<string, unknown>) {
  const conversationId = asString(body.conversationId);
  if (!conversationId) throw new Error("invalid_context_payload");
  const conversation = await ensureCanAccessConversation(supabaseAdmin, userId, conversationId);
  const { data, error } = await supabaseAdmin
    .from("whatsapp_active_ticket_contexts")
    .update({ cleared_at: nowIso(), updated_at: nowIso() })
    .eq("organization_id", conversation.organization_id)
    .eq("conversation_id", conversation.id)
    .is("cleared_at", null)
    .select("*");
  if (error) throw error;
  return { ok: true, cleared: data || [] };
}

async function linkMessageToExistingTask(supabaseAdmin: SupabaseAdmin, userId: string, body: Record<string, unknown>) {
  const conversation = await ensureCanAccessConversation(supabaseAdmin, userId, asString(body.conversationId));
  const task = await loadTask(supabaseAdmin, conversation.organization_id, asString(body.taskId));
  if (!conversation.client_id) throw new Error("client_link_required_for_ticket");
  const ticket = await ensureTicketForTask(supabaseAdmin, {
    organizationId: conversation.organization_id,
    clientId: conversation.client_id,
    contactId: conversation.contact_id,
    conversationId: conversation.id,
    taskId: task.id,
    title: task.title,
    responsibleUserId: task.assigned_to_user_id,
    responsibleName: task.assignee,
    openedByUserId: userId,
    openedFromMessageId: asString(body.messageId) || null,
  });
  const messageId = asString(body.messageId);
  if (messageId) {
    await supabaseAdmin.from("whatsapp_task_message_links").upsert({
      organization_id: conversation.organization_id,
      ticket_id: ticket.id,
      task_id: task.id,
      conversation_id: conversation.id,
      message_id: messageId,
      relation_type: "manual_link",
      visibility: "customer",
      route_source: null,
      route_confidence_percent: 100,
      created_by_user_id: userId,
    }, { onConflict: "organization_id,message_id,relation_type,ticket_id" });
  }
  return { ok: true, ticket };
}

const parseWhatsAppFlowSettings = (operationalLimits: unknown) => {
  const limits = asRecord(operationalLimits);
  const whatsapp = asRecord(limits.whatsapp);
  const flow = asRecord(whatsapp.flow);
  return { includeHumanAttendance: flow.includeHumanAttendance !== false };
};

async function loadWhatsAppFlowSettings(supabaseAdmin: SupabaseAdmin, userId: string, body: Record<string, unknown>) {
  const organizationId = asString(body.organizationId);
  if (!organizationId) throw new Error("invalid_organization_payload");
  await assertWhatsAppModuleAccess(supabaseAdmin, userId, organizationId);

  const { data, error } = await supabaseAdmin
    .from("organization_settings")
    .select("operational_limits")
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error) throw error;
  return { ok: true, settings: parseWhatsAppFlowSettings(data?.operational_limits) };
}

async function updateWhatsAppFlowSettings(supabaseAdmin: SupabaseAdmin, userId: string, body: Record<string, unknown>) {
  const organizationId = asString(body.organizationId);
  if (!organizationId) throw new Error("invalid_organization_payload");
  await assertWhatsAppModuleAccess(supabaseAdmin, userId, organizationId);

  const includeHumanAttendance = body.includeHumanAttendance !== false;
  const { data: current, error: loadError } = await supabaseAdmin
    .from("organization_settings")
    .select("operational_limits")
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (loadError) throw loadError;
  if (!current) throw new Error("organization_settings_not_found");

  const limits = asRecord(current.operational_limits);
  const whatsapp = asRecord(limits.whatsapp);
  const flow = asRecord(whatsapp.flow);
  const operationalLimits = {
    ...limits,
    whatsapp: {
      ...whatsapp,
      flow: {
        ...flow,
        includeHumanAttendance,
      },
    },
  };

  const { data, error } = await supabaseAdmin
    .from("organization_settings")
    .update({ operational_limits: operationalLimits })
    .eq("organization_id", organizationId)
    .select("operational_limits")
    .single();

  if (error) throw error;
  return { ok: true, settings: parseWhatsAppFlowSettings(data.operational_limits) };
}

async function transitionTicket(supabaseAdmin: SupabaseAdmin, userId: string, body: Record<string, unknown>, status: string) {
  const ticketId = asString(body.ticketId);
  if (!ticketId) throw new Error("invalid_ticket_payload");
  const { data: existing, error: existingError } = await supabaseAdmin
    .from("whatsapp_customer_tickets")
    .select("*")
    .eq("id", ticketId)
    .maybeSingle();
  if (existingError) throw existingError;
  if (!existing) throw new Error("ticket_not_found");
  await assertWhatsAppModuleAccess(supabaseAdmin, userId, existing.organization_id);

  const update: Record<string, unknown> = { status, updated_at: nowIso() };
  if (status === "resolved") update.resolved_at = nowIso();
  if (status === "closed") update.closed_at = nowIso();
  if (status === "open") {
    update.resolved_at = null;
    update.closed_at = null;
  }

  const { data: ticket, error } = await supabaseAdmin
    .from("whatsapp_customer_tickets")
    .update(update)
    .eq("id", ticketId)
    .select("*")
    .single();
  if (error) throw error;

  await createWhatsAppTicketEvent(supabaseAdmin, {
    organizationId: existing.organization_id,
    ticketId: existing.id,
    taskId: existing.task_id,
    conversationId: existing.conversation_id,
    actorUserId: userId,
    eventType: `ticket.${status}`,
    details: { old_status: existing.status, new_status: status, reason: asString(body.reason) || null },
  });
  return { ok: true, ticket };
}

async function completeTicketTask(supabaseAdmin: SupabaseAdmin, userId: string, body: Record<string, unknown>) {
  const summary = asString(body.summary).trim();
  if (!summary) throw new Error("completion_summary_required");
  const ticketId = asString(body.ticketId);
  const { data: pendingTicket, error: pendingTicketError } = await supabaseAdmin
    .from("whatsapp_customer_tickets")
    .select("*")
    .eq("id", ticketId)
    .maybeSingle();
  if (pendingTicketError) throw pendingTicketError;
  if (!pendingTicket) throw new Error("ticket_not_found");
  const task = await loadTask(supabaseAdmin, pendingTicket.organization_id, pendingTicket.task_id);
  await assertDelegatedTaskAction(supabaseAdmin, {
    actor: { kind: "human", userId, source: "whatsapp_ticket" },
    organizationId: pendingTicket.organization_id,
    taskId: task.id,
    action: "task.change_status",
  });
  const { error: taskError } = await supabaseAdmin.rpc("mutate_tasks_canonical", {
    _actor_user_id: userId,
    _organization_id: pendingTicket.organization_id,
    _action: "task.change_status",
    _items: [{ taskId: task.id, expectedVersion: task.version, changes: { status: "done" } }],
    _actor_source: "whatsapp_ticket",
    _correlation_id: `ticket:${pendingTicket.id}:complete`,
  });
  if (taskError) throw taskError;
  const result = await transitionTicket(supabaseAdmin, userId, body, "resolved");
  const ticket = result.ticket;

  if (ticket.conversation_id) {
    const messageBody = [
      `*Ticket #${ticket.public_protocol} concluido*`,
      "",
      summary,
    ].join("\n");
    const { data: conversation } = await supabaseAdmin
      .from("whatsapp_conversations")
      .select("provider_phone_number_id, contact:whatsapp_contacts(phone_number)")
      .eq("id", ticket.conversation_id)
      .maybeSingle();
    const toPhone = asString(conversation?.contact?.phone_number);
    if (toPhone) {
      await dispatchWhatsAppTextMessage({
        toPhone,
        body: messageBody,
        clientMessageId: `complete:${ticket.id}:${Date.now()}`,
        phoneNumberId: asString(conversation?.provider_phone_number_id) || null,
      }).catch(() => undefined);
    }
  }

  return result;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (request.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  try {
    const body = asRecord(await request.json().catch(() => ({})));
    const action = asString(body.action);
    const supabaseAdmin = buildSupabaseAdminClient();
    const user = await getAuthenticatedUser(request, supabaseAdmin);

    if (action === "list_customer_tickets_for_contact") return jsonResponse(await listCustomerTicketsForContact(supabaseAdmin, user.id, body));
    if (action === "select_ticket_context") return jsonResponse(await selectTicketContext(supabaseAdmin, user.id, body));
    if (action === "clear_ticket_context") return jsonResponse(await clearTicketContext(supabaseAdmin, user.id, body));
    if (action === "link_message_to_existing_task") return jsonResponse(await linkMessageToExistingTask(supabaseAdmin, user.id, body));
    if (action === "load_whatsapp_flow_settings") return jsonResponse(await loadWhatsAppFlowSettings(supabaseAdmin, user.id, body));
    if (action === "update_whatsapp_flow_settings") return jsonResponse(await updateWhatsAppFlowSettings(supabaseAdmin, user.id, body));
    if (action === "complete_ticket_task") return jsonResponse(await completeTicketTask(supabaseAdmin, user.id, body));
    if (action === "resolve_ticket") return jsonResponse(await transitionTicket(supabaseAdmin, user.id, body, "resolved"));
    if (action === "close_ticket") return jsonResponse(await transitionTicket(supabaseAdmin, user.id, body, "closed"));
    if (action === "reopen_ticket") return jsonResponse(await transitionTicket(supabaseAdmin, user.id, body, "open"));
    return jsonResponse({ error: "unknown_action" }, 400);
  } catch (error) {
    return jsonResponse({ error: safePreview(errorMessage(error, "ticket_action_failed")) }, 400);
  }
});
