import type { WhatsAppTicketEventPayload } from "./types.ts";

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
