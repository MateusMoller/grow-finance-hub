import { supabase } from "@/integrations/supabase/client";
import type {
  WhatsAppConversationFilters,
  WhatsAppConversationStatus,
  WhatsAppConversationSummary,
} from "@/lib/whatsappTypes";

type QueryResponse<T> = PromiseLike<{ data: T | null; error: Error | null }>;
type QueryBuilder<T = unknown> = QueryResponse<T> & {
  select: (columns: string) => QueryBuilder<T>;
  neq: (column: string, value: unknown) => QueryBuilder<T>;
  eq: (column: string, value: unknown) => QueryBuilder<T>;
  gt: (column: string, value: unknown) => QueryBuilder<T>;
  gte: (column: string, value: unknown) => QueryBuilder<T>;
  lte: (column: string, value: unknown) => QueryBuilder<T>;
  or: (filters: string) => QueryBuilder<T>;
  order: (column: string, options?: Record<string, unknown>) => QueryBuilder<T>;
  range: (from: number, to: number) => QueryBuilder<T>;
};

const db = supabase as unknown as {
  from: <T = unknown>(table: string) => QueryBuilder<T>;
  functions: typeof supabase.functions;
};

const normalizeFilter = (value?: string | null) => {
  const trimmed = value?.trim();
  return trimmed && trimmed !== "all" ? trimmed : null;
};

export async function listWhatsAppConversations(filters: WhatsAppConversationFilters = {}, page = 0, pageSize = 40) {
  let query = db
    .from("whatsapp_conversations")
    .select(`
      id,
      organization_id,
      contact_id,
      client_id,
      status,
      assigned_to_user_id,
      assigned_team,
      last_message_at,
      last_message_preview,
      unread_count,
      active_window_expires_at,
      contact:whatsapp_contacts(id, phone_number, display_name, profile_name, match_status, client_id, is_blocked),
      client:clients(id, name)
    `)
    .neq("status", "archived")
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .range(page * pageSize, page * pageSize + pageSize - 1);

  const status = normalizeFilter(filters.status);
  const search = normalizeFilter(filters.search);
  const assignedToUserId = normalizeFilter(filters.assignedToUserId);
  const clientId = normalizeFilter(filters.clientId);

  if (status) query = query.eq("status", status);
  if (filters.unread) query = query.gt("unread_count", 0);
  if (assignedToUserId) query = query.eq("assigned_to_user_id", assignedToUserId);
  if (clientId) query = query.eq("client_id", clientId);
  if (filters.dateFrom) query = query.gte("last_message_at", filters.dateFrom);
  if (filters.dateTo) query = query.lte("last_message_at", filters.dateTo);
  if (search) {
    query = query.or(
      `last_message_preview.ilike.%${search}%,whatsapp_contacts.display_name.ilike.%${search}%,whatsapp_contacts.phone_number.ilike.%${search}%`,
    );
  }

  const { data, error } = await query;
  if (error) throw error;

  return ((data || []) as Array<WhatsAppConversationSummary & { client?: { name?: string | null } | null }>).map((row) => ({
    ...row,
    client_name: row.client?.name || null,
  })) as WhatsAppConversationSummary[];
}

export async function linkWhatsAppConversationClient(conversationId: string, clientId: string) {
  const { data, error } = await db.functions.invoke("whatsapp-send-message", {
    body: { action: "link_client", conversationId, clientId },
  });
  if (error) throw error;
  return data;
}

export async function assignWhatsAppConversation(conversationId: string, payload: { userId?: string | null; team?: string | null }) {
  const { data, error } = await db.functions.invoke("whatsapp-send-message", {
    body: { action: "assign_conversation", conversationId, ...payload },
  });
  if (error) throw error;
  return data;
}

export async function updateWhatsAppConversationStatus(conversationId: string, status: WhatsAppConversationStatus) {
  const { data, error } = await db.functions.invoke("whatsapp-send-message", {
    body: { action: "change_status", conversationId, status },
  });
  if (error) throw error;
  return data;
}

export async function endWhatsAppAttendance(conversationId: string) {
  const { data, error } = await db.functions.invoke("whatsapp-send-message", {
    body: { action: "end_attendance", conversationId },
  });
  if (error) throw error;
  return data;
}
