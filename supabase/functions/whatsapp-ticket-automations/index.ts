import { buildSupabaseAdminClient, corsHeaders, jsonResponse } from "../_shared/whatsapp-auth.ts";
import { createWhatsAppTicketEvent } from "../_shared/whatsapp-ticket/audit.ts";
import { dispatchWhatsAppTextMessage } from "../_shared/whatsapp-provider.ts";
import { asRecord, asString, errorMessage, safePreview } from "../_shared/whatsapp-validation.ts";

type SupabaseAdmin = ReturnType<typeof buildSupabaseAdminClient>;

const nowIso = () => new Date().toISOString();

function assertAutomationSecret(request: Request) {
  const expected = Deno.env.get("WHATSAPP_TICKET_AUTOMATION_SECRET")?.trim();
  if (!expected) return;
  const received = request.headers.get("x-automation-secret")?.trim();
  if (received !== expected) throw new Error("invalid_automation_secret");
}

async function expireContexts(supabaseAdmin: SupabaseAdmin) {
  const { data: contexts, error } = await supabaseAdmin
    .from("whatsapp_active_ticket_contexts")
    .select("*")
    .is("cleared_at", null)
    .lt("expires_at", nowIso())
    .limit(500);
  if (error) throw error;

  for (const context of contexts || []) {
    await supabaseAdmin
      .from("whatsapp_active_ticket_contexts")
      .update({ cleared_at: nowIso(), updated_at: nowIso() })
      .eq("id", context.id)
      .is("cleared_at", null);
    await createWhatsAppTicketEvent(supabaseAdmin, {
      organizationId: context.organization_id,
      ticketId: context.ticket_id,
      taskId: context.task_id,
      conversationId: context.conversation_id,
      eventType: "ticket.context.expired",
      details: { expires_at: context.expires_at },
      idempotencyKey: `${context.organization_id}:context-expired:${context.id}`,
    });
  }

  return { expired: contexts?.length || 0 };
}

async function processSlaAlerts(supabaseAdmin: SupabaseAdmin) {
  const { data: records, error } = await supabaseAdmin
    .from("whatsapp_ticket_sla_records")
    .select("*")
    .eq("state", "running")
    .or(`first_response_due_at.lt.${nowIso()},resolution_due_at.lt.${nowIso()}`)
    .limit(500);
  if (error) throw error;

  for (const record of records || []) {
    await supabaseAdmin
      .from("whatsapp_ticket_sla_records")
      .update({ state: "breached", breached_at: nowIso(), updated_at: nowIso() })
      .eq("id", record.id)
      .eq("state", "running");
    await createWhatsAppTicketEvent(supabaseAdmin, {
      organizationId: record.organization_id,
      ticketId: record.ticket_id,
      taskId: record.task_id,
      eventType: "sla.breached",
      details: {
        first_response_due_at: record.first_response_due_at,
        resolution_due_at: record.resolution_due_at,
      },
      idempotencyKey: `${record.organization_id}:sla-breached:${record.id}`,
    });
  }

  return { breached: records?.length || 0 };
}

async function sendWaitingCustomerReminders(supabaseAdmin: SupabaseAdmin) {
  const { data: tickets, error } = await supabaseAdmin
    .from("whatsapp_customer_tickets")
    .select("*, conversation:whatsapp_conversations(provider_phone_number_id, contact:whatsapp_contacts(phone_number))")
    .eq("status", "waiting_customer")
    .not("last_agent_message_at", "is", null)
    .lt("last_agent_message_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .limit(100);
  if (error) throw error;

  let sent = 0;
  for (const ticket of tickets || []) {
    const phone = asString(ticket.conversation?.contact?.phone_number);
    if (!phone) continue;
    const message = [
      `*Lembrete do ticket #${ticket.public_protocol}*`,
      "",
      "Estamos aguardando seu retorno para dar continuidade ao atendimento.",
    ].join("\n");
    await dispatchWhatsAppTextMessage({
      toPhone: phone,
      body: message,
      clientMessageId: `reminder:${ticket.id}:${Date.now()}`,
      phoneNumberId: asString(ticket.conversation?.provider_phone_number_id) || null,
    }).then(async () => {
      sent += 1;
      await createWhatsAppTicketEvent(supabaseAdmin, {
        organizationId: ticket.organization_id,
        ticketId: ticket.id,
        taskId: ticket.task_id,
        conversationId: ticket.conversation_id,
        eventType: "reminder.sent",
        details: { status: ticket.status },
      });
    }).catch(async (sendError) => {
      await createWhatsAppTicketEvent(supabaseAdmin, {
        organizationId: ticket.organization_id,
        ticketId: ticket.id,
        taskId: ticket.task_id,
        conversationId: ticket.conversation_id,
        eventType: "reminder.failed",
        details: { error: safePreview(errorMessage(sendError, "reminder_failed")) },
      });
    });
  }

  return { remindersSent: sent };
}

async function closeResolvedTickets(supabaseAdmin: SupabaseAdmin) {
  const cutoff = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
  const { data: tickets, error } = await supabaseAdmin
    .from("whatsapp_customer_tickets")
    .select("*")
    .eq("status", "resolved")
    .lt("resolved_at", cutoff)
    .limit(500);
  if (error) throw error;

  for (const ticket of tickets || []) {
    await supabaseAdmin
      .from("whatsapp_customer_tickets")
      .update({ status: "closed", closed_at: nowIso(), updated_at: nowIso() })
      .eq("id", ticket.id)
      .eq("status", "resolved");
    await createWhatsAppTicketEvent(supabaseAdmin, {
      organizationId: ticket.organization_id,
      ticketId: ticket.id,
      taskId: ticket.task_id,
      conversationId: ticket.conversation_id,
      eventType: "ticket.closed",
      details: { reason: "resolved_quiet_period_elapsed" },
      idempotencyKey: `${ticket.organization_id}:ticket-closed:${ticket.id}`,
    });
  }

  return { closed: tickets?.length || 0 };
}

async function reprocessFailures(supabaseAdmin: SupabaseAdmin) {
  const { data: failedAttachments, error } = await supabaseAdmin
    .from("whatsapp_conversation_attachments")
    .select("id")
    .eq("status", "failed")
    .limit(100);
  if (error) throw error;
  return { retryCandidates: failedAttachments?.length || 0 };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (request.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  try {
    assertAutomationSecret(request);
    const body = asRecord(await request.json().catch(() => ({})));
    const action = asString(body.action) || "run_all";
    const supabaseAdmin = buildSupabaseAdminClient();

    const result: Record<string, unknown> = {};
    if (action === "expire_contexts" || action === "run_all") result.expireContexts = await expireContexts(supabaseAdmin);
    if (action === "sla_alerts" || action === "run_all") result.slaAlerts = await processSlaAlerts(supabaseAdmin);
    if (action === "waiting_customer_reminders" || action === "run_all") result.waitingCustomerReminders = await sendWaitingCustomerReminders(supabaseAdmin);
    if (action === "close_resolved_tickets" || action === "run_all") result.closeResolvedTickets = await closeResolvedTickets(supabaseAdmin);
    if (action === "reprocess_failures" || action === "run_all") result.reprocessFailures = await reprocessFailures(supabaseAdmin);

    return jsonResponse({ ok: true, action, result });
  } catch (error) {
    return jsonResponse({ error: safePreview(errorMessage(error, "ticket_automation_failed")) }, 400);
  }
});
