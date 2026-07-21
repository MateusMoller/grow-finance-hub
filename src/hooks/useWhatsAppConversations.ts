import { useInfiniteQuery } from "@tanstack/react-query";
import { listWhatsAppConversations } from "@/lib/whatsappConversations";
import type { WhatsAppConversationFilters } from "@/lib/whatsappTypes";

const PAGE_SIZE = 40;

export const whatsappConversationKeys = {
  all: ["whatsapp", "conversations"] as const,
  list: (filters: WhatsAppConversationFilters) => [...whatsappConversationKeys.all, filters] as const,
};

export function useWhatsAppConversations(filters: WhatsAppConversationFilters) {
  return useInfiniteQuery({
    queryKey: whatsappConversationKeys.list(filters),
    queryFn: ({ pageParam = 0 }) => listWhatsAppConversations(filters, pageParam, PAGE_SIZE),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => (lastPage.length === PAGE_SIZE ? allPages.length : undefined),
    refetchInterval: 10_000,
    refetchOnWindowFocus: true,
  });
}
