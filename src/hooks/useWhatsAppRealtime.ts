import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { whatsappConversationKeys } from "@/hooks/useWhatsAppConversations";
import { whatsappMessageKeys } from "@/hooks/useWhatsAppMessages";

export function useWhatsAppRealtime(activeConversationId: string | null) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel("whatsapp-client-chat")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "whatsapp_conversations" },
        () => {
          void queryClient.invalidateQueries({ queryKey: whatsappConversationKeys.all });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "whatsapp_messages" },
        (payload) => {
          void queryClient.invalidateQueries({ queryKey: whatsappConversationKeys.all });
          const conversationId = (payload.new as { conversation_id?: string } | null)?.conversation_id;
          if (conversationId) {
            void queryClient.invalidateQueries({ queryKey: whatsappMessageKeys.conversation(conversationId) });
          } else if (activeConversationId) {
            void queryClient.invalidateQueries({ queryKey: whatsappMessageKeys.conversation(activeConversationId) });
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "whatsapp_conversation_attachments" },
        (payload) => {
          const conversationId = (payload.new as { conversation_id?: string } | null)?.conversation_id;
          if (conversationId) {
            void queryClient.invalidateQueries({ queryKey: whatsappMessageKeys.conversation(conversationId) });
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeConversationId, queryClient]);
}
