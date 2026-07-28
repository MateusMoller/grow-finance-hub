import { supabase } from "@/integrations/supabase/client";

export const WHATSAPP_TICKET_HIGH_CONFIDENCE_THRESHOLD = 90;
export const WHATSAPP_TICKET_CONTEXT_MINUTES = 24 * 60;

export type WhatsAppTicketStatus =
  | "open"
  | "waiting_customer"
  | "waiting_team"
  | "resolved"
  | "closed"
  | "cancelled";

export type WhatsAppTicketRouteSource =
  | "quoted_reply"
  | "interactive_selection"
  | "protocol"
  | "active_context"
  | "inference"
  | "unrouted";

export type WhatsAppCustomerTicket = {
  id: string;
  organization_id: string;
  client_id: string;
  contact_id: string | null;
  conversation_id: string | null;
  task_id: string;
  public_protocol: string;
  title: string;
  status: WhatsAppTicketStatus;
  responsible_user_id: string | null;
  responsible_name: string | null;
  opened_at: string;
  updated_at: string;
};

export type WhatsAppActiveTicketContext = {
  id: string;
  organization_id: string;
  conversation_id: string;
  contact_id: string;
  ticket_id: string;
  task_id: string;
  source: "interactive_selection" | "protocol" | "active_context";
  expires_at: string;
};

export type WhatsAppTicketSlaRecord = {
  id: string;
  organization_id: string;
  ticket_id: string;
  task_id: string;
  state: "running" | "paused_waiting_customer" | "resolved" | "breached";
  due_at: string | null;
  breached_at: string | null;
};

export type WhatsAppTicketEvent = {
  id: string;
  organization_id: string;
  ticket_id: string | null;
  task_id: string | null;
  conversation_id: string | null;
  message_id: string | null;
  actor_user_id: string | null;
  event_type: string;
  details: Record<string, unknown>;
  created_at: string;
};

export type WhatsAppConversationTaskContext = {
  id: string;
  message_id: string;
  task_id: string;
  ticket_id: string | null;
  relation_type: string;
  created_at: string;
  ticket_protocol: string | null;
  ticket_title: string | null;
  task_title: string | null;
  task_status: string | null;
  attachment_name: string | null;
  attachment_status: string | null;
};

export async function listWhatsAppTicketsForConversation(conversationId: string): Promise<WhatsAppCustomerTicket[]> {
  const { data, error } = await supabase
    .from("whatsapp_customer_tickets" as never)
    .select("*")
    .eq("conversation_id", conversationId)
    .order("updated_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []) as unknown as WhatsAppCustomerTicket[];
}

export async function listWhatsAppConversationTaskContext(
  conversationId: string,
): Promise<WhatsAppConversationTaskContext[]> {
  if (!conversationId) return [];

  const { data, error } = await supabase
    .from("whatsapp_task_message_links" as never)
    .select(`
      id,
      message_id,
      task_id,
      ticket_id,
      relation_type,
      created_at,
      ticket:whatsapp_customer_tickets(public_protocol, title),
      task:kanban_tasks(title, status),
      attachment:whatsapp_conversation_attachments(file_name, status)
    `)
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(12);

  if (error) {
    throw error;
  }

  return ((data ?? []) as unknown as Array<{
    id: string;
    message_id: string;
    task_id: string;
    ticket_id: string | null;
    relation_type: string;
    created_at: string;
    ticket?: { public_protocol?: string | null; title?: string | null } | null;
    task?: { title?: string | null; status?: string | null } | null;
    attachment?: { file_name?: string | null; status?: string | null } | null;
  }>).map((row) => ({
    id: row.id,
    message_id: row.message_id,
    task_id: row.task_id,
    ticket_id: row.ticket_id,
    relation_type: row.relation_type,
    created_at: row.created_at,
    ticket_protocol: row.ticket?.public_protocol || null,
    ticket_title: row.ticket?.title || null,
    task_title: row.task?.title || null,
    task_status: row.task?.status || null,
    attachment_name: row.attachment?.file_name || null,
    attachment_status: row.attachment?.status || null,
  }));
}

export async function listWhatsAppTicketMessages(taskId: string) {
  const { data, error } = await supabase
    .from("whatsapp_task_message_links" as never)
    .select("*, message:whatsapp_messages(*)")
    .eq("task_id", taskId)
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []) as unknown as Array<{
    id: string;
    message_id: string;
    relation_type: string;
    visibility: "customer" | "internal";
    message?: Record<string, unknown> | null;
  }>;
}

export async function selectWhatsAppTicketContext(input: { conversationId: string; ticketId: string }) {
  const { data, error } = await supabase.functions.invoke("whatsapp-ticket-actions", {
    body: {
      action: "select_ticket_context",
      ...input,
    },
  });
  if (error) throw error;
  return data;
}

export async function clearWhatsAppTicketContext(conversationId: string) {
  const { data, error } = await supabase.functions.invoke("whatsapp-ticket-actions", {
    body: {
      action: "clear_ticket_context",
      conversationId,
    },
  });
  if (error) throw error;
  return data;
}

export async function listWhatsAppTicketsForContact(conversationId: string) {
  const { data, error } = await supabase.functions.invoke("whatsapp-ticket-actions", {
    body: {
      action: "list_customer_tickets_for_contact",
      conversationId,
    },
  });
  if (error) throw error;
  return ((data as { tickets?: WhatsAppCustomerTicket[] } | null)?.tickets ?? []) as WhatsAppCustomerTicket[];
}
