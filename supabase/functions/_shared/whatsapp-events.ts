export async function createWhatsAppEvent(
  supabaseAdmin: { from: (table: string) => { insert: (values: Record<string, unknown>) => Promise<unknown> } },
  payload: {
    organization_id: string;
    conversation_id: string;
    message_id?: string | null;
    event_type: string;
    actor_user_id?: string | null;
    provider_event_id?: string | null;
    details?: Record<string, unknown>;
  },
) {
  await supabaseAdmin.from("whatsapp_conversation_events").insert({
    organization_id: payload.organization_id,
    conversation_id: payload.conversation_id,
    message_id: payload.message_id || null,
    event_type: payload.event_type,
    actor_user_id: payload.actor_user_id || null,
    provider_event_id: payload.provider_event_id || null,
    details: payload.details || {},
  });
}

export async function createWhatsAppNotification(
  supabaseAdmin: { from: (table: string) => { insert: (values: Record<string, unknown>) => Promise<unknown> } },
  payload: {
    organization_id: string;
    conversation_id: string;
    target_user_id?: string | null;
    target_scope: "user" | "queue";
    notification_type: "new_message" | "assigned" | "send_failed";
    title: string;
    body?: string | null;
  },
) {
  await supabaseAdmin.from("whatsapp_conversation_notifications").insert({
    organization_id: payload.organization_id,
    conversation_id: payload.conversation_id,
    target_user_id: payload.target_user_id || null,
    target_scope: payload.target_scope,
    notification_type: payload.notification_type,
    title: payload.title,
    body: payload.body || null,
  });
}
