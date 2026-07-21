import { useQuery } from "@tanstack/react-query";
import { listWhatsAppMessages } from "@/lib/whatsappMessages";

export const whatsappMessageKeys = {
  all: ["whatsapp", "messages"] as const,
  conversation: (conversationId: string | null) => [...whatsappMessageKeys.all, conversationId] as const,
};

export function useWhatsAppMessages(conversationId: string | null) {
  return useQuery({
    queryKey: whatsappMessageKeys.conversation(conversationId),
    queryFn: () => listWhatsAppMessages(conversationId || ""),
    enabled: Boolean(conversationId),
    refetchInterval: conversationId ? 10_000 : false,
    refetchOnWindowFocus: true,
  });
}
