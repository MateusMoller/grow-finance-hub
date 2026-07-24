import { useQuery } from "@tanstack/react-query";

import {
  listWhatsAppTicketMessages,
  listWhatsAppTicketsForConversation,
  type WhatsAppCustomerTicket,
} from "@/lib/whatsappTickets";

export const whatsappTicketKeys = {
  all: ["whatsapp-tickets"] as const,
  conversation: (conversationId: string | null | undefined) =>
    [...whatsappTicketKeys.all, "conversation", conversationId ?? "none"] as const,
  taskMessages: (taskId: string | null | undefined) =>
    [...whatsappTicketKeys.all, "task-messages", taskId ?? "none"] as const,
};

export function useWhatsAppTicketsForConversation(conversationId: string | null | undefined) {
  return useQuery<WhatsAppCustomerTicket[]>({
    queryKey: whatsappTicketKeys.conversation(conversationId),
    queryFn: () => listWhatsAppTicketsForConversation(conversationId as string),
    enabled: Boolean(conversationId),
  });
}

export function useWhatsAppTicketMessages(taskId: string | null | undefined) {
  return useQuery({
    queryKey: whatsappTicketKeys.taskMessages(taskId),
    queryFn: () => listWhatsAppTicketMessages(taskId as string),
    enabled: Boolean(taskId),
  });
}
