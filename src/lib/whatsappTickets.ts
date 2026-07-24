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
