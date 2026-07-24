import { supabase } from "@/integrations/supabase/client";
import { throwDetailedFunctionError } from "@/lib/whatsappFunctionErrors";
import type { WhatsAppMessage } from "@/lib/whatsappTypes";

type QueryResponse<T> = PromiseLike<{ data: T | null; error: Error | null }>;
type QueryBuilder<T = unknown> = QueryResponse<T> & {
  select: (columns: string) => QueryBuilder<T>;
  eq: (column: string, value: unknown) => QueryBuilder<T>;
  update: (values: Record<string, unknown>) => QueryBuilder<T>;
  order: (column: string, options?: Record<string, unknown>) => QueryBuilder<T>;
  range: (from: number, to: number) => QueryBuilder<T>;
};

const db = supabase as unknown as {
  from: <T = unknown>(table: string) => QueryBuilder<T>;
  functions: typeof supabase.functions;
};

export async function listWhatsAppMessages(conversationId: string, page = 0, pageSize = 100) {
  if (!conversationId) return [] as WhatsAppMessage[];

  const { data, error } = await db
    .from("whatsapp_messages")
    .select(`
      id,
      conversation_id,
      direction,
      sender_user_id,
      provider_message_id,
      message_type,
      body,
      safe_preview,
      delivery_status,
      failure_reason,
      blocked_reason,
      sent_at,
      received_at,
      created_at,
      metadata,
      attachments:whatsapp_conversation_attachments(id, file_name, content_type, size_bytes, status, failure_reason, storage_path)
    `)
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .range(page * pageSize, page * pageSize + pageSize - 1);

  if (error) throw error;
  return [...((data || []) as WhatsAppMessage[])].reverse();
}

export async function sendWhatsAppTextMessage(
  conversationId: string,
  body: string,
  clientMessageId: string,
  replyToProviderMessageId?: string | null,
  taskId?: string | null,
  ticketId?: string | null,
  requiresCustomerResponse?: boolean,
) {
  const { data, error } = await db.functions.invoke("whatsapp-send-message", {
    body: {
      action: "send_text",
      conversationId,
      body,
      clientMessageId,
      replyToProviderMessageId,
      taskId,
      ticketId,
      requiresCustomerResponse,
    },
  });
  if (error) await throwDetailedFunctionError(error);
  return data;
}

export async function markWhatsAppConversationRead(conversationId: string) {
  if (!conversationId) return;
  const { error } = await db
    .from("whatsapp_conversations")
    .update({ unread_count: 0 })
    .eq("id", conversationId);
  if (error) throw error;
}
