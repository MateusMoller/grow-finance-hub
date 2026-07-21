import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { AppLayout } from "@/components/app/AppLayout";
import {
  ConversationList,
  ConversationPanel,
} from "@/components/whatsapp";
import type { WhatsAppQuickTaskDraft } from "@/components/whatsapp/ConversationHeader";
import { useAuth } from "@/hooks/useAuth";
import { useWhatsAppConversations, whatsappConversationKeys } from "@/hooks/useWhatsAppConversations";
import { useWhatsAppMessages, whatsappMessageKeys } from "@/hooks/useWhatsAppMessages";
import { useWhatsAppRealtime } from "@/hooks/useWhatsAppRealtime";
import { supabase } from "@/integrations/supabase/client";
import { markWhatsAppConversationRead, sendWhatsAppTextMessage } from "@/lib/whatsappMessages";
import { sendWhatsAppAttachment } from "@/lib/whatsappMedia";
import { linkWhatsAppConversationClient } from "@/lib/whatsappConversations";
import { createWhatsAppQuickTask } from "@/lib/whatsappQuickTasks";
import type { WhatsAppConversationFilters, WhatsAppConversationSummary } from "@/lib/whatsappTypes";

const createClientMessageId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `msg-${Date.now()}-${Math.random().toString(36).slice(2)}`;

export default function WhatsAppAtendimentoPage() {
  const queryClient = useQueryClient();
  const { currentOrganizationId, user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [filters, setFilters] = useState<WhatsAppConversationFilters>({
    search: searchParams.get("q") || "",
    status: "all",
    unread: false,
  });

  const selectedConversationId = searchParams.get("conversation");
  const conversationsQuery = useWhatsAppConversations(filters);
  const conversations = useMemo(
    () => conversationsQuery.data?.pages.flat() || [],
    [conversationsQuery.data],
  );
  const selectedConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === selectedConversationId) || null,
    [conversations, selectedConversationId],
  );
  const messagesQuery = useWhatsAppMessages(selectedConversationId);
  const activeClientsQuery = useQuery({
    queryKey: ["whatsapp", "active-clients", currentOrganizationId],
    enabled: Boolean(currentOrganizationId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name, cnpj, contact, phone")
        .eq("organization_id", currentOrganizationId)
        .eq("status", "Ativo")
        .order("name");

      if (error) throw error;
      return (data || []).map((client) => ({
        id: client.id,
        name: client.name || "Cliente sem nome",
        cnpj: client.cnpj || null,
        contact: client.contact || null,
        phone: client.phone || null,
      }));
    },
  });

  useWhatsAppRealtime(selectedConversationId);

  useEffect(() => {
    if (!selectedConversationId) return;
    void markWhatsAppConversationRead(selectedConversationId)
      .then(() => queryClient.invalidateQueries({ queryKey: whatsappConversationKeys.all }))
      .catch(() => undefined);
  }, [queryClient, selectedConversationId]);

  const updateSearch = (search: string) => {
    setFilters((current) => ({ ...current, search }));
    const next = new URLSearchParams(searchParams);
    if (search) next.set("q", search);
    else next.delete("q");
    setSearchParams(next, { replace: true });
  };

  const selectConversation = (conversation: WhatsAppConversationSummary) => {
    const next = new URLSearchParams(searchParams);
    next.set("conversation", conversation.id);
    setSearchParams(next);
  };

  const sendTextMutation = useMutation({
    mutationFn: ({ text, clientMessageId }: { text: string; clientMessageId: string }) =>
      sendWhatsAppTextMessage(selectedConversationId || "", text, clientMessageId),
    onSuccess: () => {
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: whatsappConversationKeys.all }),
        queryClient.invalidateQueries({ queryKey: whatsappMessageKeys.conversation(selectedConversationId) }),
      ]);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Nao foi possivel enviar a mensagem.");
    },
  });

  const sendFileMutation = useMutation({
    mutationFn: ({ file, clientMessageId }: { file: File; clientMessageId: string }) =>
      sendWhatsAppAttachment(selectedConversationId || "", file, "", clientMessageId),
    onSuccess: () => {
      toast.success("Arquivo enviado para processamento.");
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: whatsappConversationKeys.all }),
        queryClient.invalidateQueries({ queryKey: whatsappMessageKeys.conversation(selectedConversationId) }),
      ]);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Nao foi possivel anexar o arquivo.");
    },
  });

  const linkClientMutation = useMutation({
    mutationFn: (clientId: string) => linkWhatsAppConversationClient(selectedConversationId || "", clientId),
    onSuccess: () => {
      toast.success("Cliente vinculado à conversa.");
      void queryClient.invalidateQueries({ queryKey: whatsappConversationKeys.all });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Nao foi possivel vincular o cliente."),
  });

  const quickTaskMutation = useMutation({
    mutationFn: async (draft: WhatsAppQuickTaskDraft) => {
      if (!currentOrganizationId || !selectedConversation) {
        throw new Error("Conversa ou organizacao ativa nao encontrada.");
      }
      return createWhatsAppQuickTask({
        organizationId: currentOrganizationId,
        title: draft.title,
        description: draft.description,
        sector: draft.sector,
        priority: draft.priority,
        clientName: selectedConversation.client_name || null,
        createdBy: user?.id || null,
        conversationId: selectedConversation.id,
        contactPhone: selectedConversation.contact?.phone_number || null,
        clientMessageId: createClientMessageId(),
        contextMessages: draft.contextMessages,
      });
    },
    onSuccess: (result) => {
      if (result.confirmationSent) {
        toast.success("Ticket criado e enviado ao cliente.");
      } else {
        toast.warning(`Ticket criado, mas a mensagem ao cliente falhou: ${result.confirmationError}`);
      }
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: whatsappConversationKeys.all }),
        queryClient.invalidateQueries({ queryKey: whatsappMessageKeys.conversation(selectedConversationId) }),
      ]);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Nao foi possivel criar a tarefa."),
  });

  const isSending = sendTextMutation.isPending || sendFileMutation.isPending;

  return (
    <AppLayout>
      <div className="flex h-[calc(100svh-5.75rem)] w-full max-w-none flex-col overflow-hidden rounded-2xl border bg-[#f0f2f5] shadow-sm">
        <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[18.5rem_minmax(0,1fr)] xl:grid-cols-[20rem_minmax(0,1fr)]">
          <ConversationList
            conversations={conversations}
            activeId={selectedConversationId}
            loading={conversationsQuery.isLoading}
            search={filters.search || ""}
            onSearchChange={updateSearch}
            onSelect={selectConversation}
          />
          <ConversationPanel
            conversation={selectedConversation}
            messages={messagesQuery.data || []}
            loading={messagesQuery.isLoading}
            sending={isSending}
            activeClients={activeClientsQuery.data || []}
            clientLinking={linkClientMutation.isPending}
            quickTaskCreating={quickTaskMutation.isPending}
            onSendText={async (text) => {
              await sendTextMutation.mutateAsync({ text, clientMessageId: createClientMessageId() });
            }}
            onSendFile={async (file) => {
              await sendFileMutation.mutateAsync({ file, clientMessageId: createClientMessageId() });
            }}
            onLinkClient={(clientId) => linkClientMutation.mutate(clientId)}
            onCreateQuickTask={(draft) => quickTaskMutation.mutate(draft)}
          />
        </div>
      </div>
    </AppLayout>
  );
}
