import type { WhatsAppTicketEventPayload } from "./types.ts";

export type WhatsAppOperationalEventType =
  | "daily_greeting_sent"
  | "daily_greeting_skipped"
  | "auto_service_menu_sent"
  | "auto_service_action.menu"
  | "auto_service_action.attendance"
  | "auto_service_action.requests"
  | "auto_service_action.consult_tasks"
  | "auto_service_action.create_task"
  | "auto_service_action.continue_context"
  | "auto_service_action.end_flow"
  | "requests_flow_menu_sent"
  | "task_creation.blocked_unlinked_contact"
  | "ticket_created_from_customer_flow"
  | "ticket.context.activated_by_customer"
  | "active_tickets_messages_sent"
  | "automatic_flow.delivery_blocked"
  | `message.route.${string}`;

type SupabaseInsertClient = {
  from: (table: string) => {
    insert: (payload: Record<string, unknown>) => Promise<{ error: { code?: string; message?: string } | null }>;
  };
};

export async function createWhatsAppTicketEvent(
  supabaseAdmin: SupabaseInsertClient,
  payload: WhatsAppTicketEventPayload,
): Promise<void> {
  const { error } = await supabaseAdmin.from("whatsapp_ticket_events").insert({
    organization_id: payload.organizationId,
    ticket_id: payload.ticketId ?? null,
    task_id: payload.taskId ?? null,
    conversation_id: payload.conversationId ?? null,
    message_id: payload.messageId ?? null,
    actor_user_id: payload.actorUserId ?? null,
    event_type: payload.eventType,
    details: payload.details ?? {},
    idempotency_key: payload.idempotencyKey ?? null,
  });

  if (error) {
    if (error.code === "23505" && payload.idempotencyKey) {
      return;
    }

    throw new Error(`whatsapp_ticket_event_insert_failed: ${error.message ?? "unknown error"}`);
  }
}

export async function recordWhatsAppOperationalEvent(
  supabaseAdmin: SupabaseInsertClient,
  payload: Omit<WhatsAppTicketEventPayload, "eventType"> & { eventType: WhatsAppOperationalEventType },
): Promise<void> {
  await createWhatsAppTicketEvent(supabaseAdmin, payload);
}
