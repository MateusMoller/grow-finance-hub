import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";

import { AppLayout } from "@/components/app/AppLayout";
import {
  ConversationList,
  ConversationPanel,
} from "@/components/whatsapp";
import type { WhatsAppBubbleTone, WhatsAppChatBackground, WhatsAppChatDensity } from "@/components/whatsapp/appearance";
import type { WhatsAppQuickTaskDraft } from "@/components/whatsapp/ConversationHeader";
import type { WhatsAppStandardMessage } from "@/components/whatsapp/MessageComposer";
import { useAuth } from "@/hooks/useAuth";
import { useWhatsAppConversations, whatsappConversationKeys } from "@/hooks/useWhatsAppConversations";
import { useWhatsAppMessages, whatsappMessageKeys } from "@/hooks/useWhatsAppMessages";
import { useWhatsAppRealtime } from "@/hooks/useWhatsAppRealtime";
import { supabase } from "@/integrations/supabase/client";
import { endWhatsAppAttendance, linkWhatsAppConversationClient } from "@/lib/whatsappConversations";
import { sendWhatsAppAttachment } from "@/lib/whatsappMedia";
import { markWhatsAppConversationRead, sendWhatsAppTextMessage } from "@/lib/whatsappMessages";
import { createWhatsAppQuickTask } from "@/lib/whatsappQuickTasks";
import {
  defaultWhatsAppFlowSettings,
  getWhatsAppFlowSettings,
  saveWhatsAppFlowSettings,
} from "@/lib/whatsappFlowSettings";
import type { WhatsAppConversationFilters, WhatsAppConversationSummary } from "@/lib/whatsappTypes";

const createClientMessageId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `msg-${Date.now()}-${Math.random().toString(36).slice(2)}`;

const whatsappPreferenceKey = (key: string) => `grow-whatsapp-chat-${key}`;
const whatsappUserPreferenceKey = (userId: string | undefined, key: string) =>
  `grow-whatsapp-user-${userId || "anonymous"}-${key}`;

const loadWhatsAppPreference = <T extends string>(key: string, fallback: T, allowed: readonly T[]) => {
  if (typeof window === "undefined") return fallback;
  const stored = window.localStorage.getItem(whatsappPreferenceKey(key));
  return allowed.includes(stored as T) ? (stored as T) : fallback;
};

const titleFromStandardMessage = (message: string) => message.trim().split(/\s+/).slice(0, 3).join(" ").slice(0, 28);

const loadWhatsAppStandardMessages = (userId: string | undefined) => {
  if (typeof window === "undefined") return [];
  const stored = window.localStorage.getItem(whatsappUserPreferenceKey(userId, "standard-messages"));
  if (!stored) return [];

  try {
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed)
      ? parsed
          .map((message): WhatsAppStandardMessage | null => {
            if (typeof message === "string") {
              const body = message.trim();
              return body ? { title: titleFromStandardMessage(body) || "Atalho", body } : null;
            }

            if (message && typeof message === "object" && "title" in message && "body" in message) {
              const title = typeof message.title === "string" ? message.title.trim().slice(0, 28) : "";
              const body = typeof message.body === "string" ? message.body.trim() : "";
              return title && body ? { title, body } : null;
            }

            return null;
          })
          .filter((message): message is WhatsAppStandardMessage => Boolean(message))
          .slice(0, 10)
      : [];
  } catch {
    return [];
  }
};

export default function WhatsAppAtendimentoPage() {
  const queryClient = useQueryClient();
  const { currentOrganizationId, user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [filters, setFilters] = useState<WhatsAppConversationFilters>({
    search: searchParams.get("q") || "",
    status: "all",
    unread: false,
  });
  const [conversationQueue, setConversationQueue] = useState<"attendance" | "automatic">("attendance");
  const [chatDensity, setChatDensity] = useState<WhatsAppChatDensity>(() =>
    loadWhatsAppPreference("density", "confortavel", ["compacta", "confortavel"] as const),
  );
  const [chatBackground, setChatBackground] = useState<WhatsAppChatBackground>(() =>
    loadWhatsAppPreference("background", "classico", ["classico", "limpo", "suave"] as const),
  );
  const [bubbleTone, setBubbleTone] = useState<WhatsAppBubbleTone>(() =>
    loadWhatsAppPreference("bubble", "verde", ["verde", "azul", "neutro"] as const),
  );
  const [standardMessages, setStandardMessages] = useState<WhatsAppStandardMessage[]>(() => loadWhatsAppStandardMessages(user?.id));

  const selectedConversationId = searchParams.get("conversation");
  const conversationsQuery = useWhatsAppConversations(filters);
  const conversations = useMemo(
    () => conversationsQuery.data?.pages.flat() || [],
    [conversationsQuery.data],
  );
  const visibleConversations = useMemo(
    () =>
      conversations.filter((conversation) =>
        conversationQueue === "attendance"
          ? conversation.status === "in_attendance"
          : conversation.status !== "in_attendance",
      ),
    [conversationQueue, conversations],
  );
  const selectedConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === selectedConversationId) || null,
    [conversations, selectedConversationId],
  );
  const messagesQuery = useWhatsAppMessages(selectedConversationId);
  const flowSettingsQuery = useQuery({
    queryKey: ["whatsapp", "flow-settings", currentOrganizationId],
    enabled: Boolean(currentOrganizationId),
    queryFn: () => getWhatsAppFlowSettings(currentOrganizationId || ""),
  });
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
  const existingTasksQuery = useQuery({
    queryKey: ["whatsapp", "existing-client-tasks", currentOrganizationId, selectedConversation?.client_name || null],
    enabled: Boolean(currentOrganizationId && selectedConversation?.client_name),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("kanban_tasks")
        .select("id, title, status, sector, priority, updated_at")
        .eq("organization_id", currentOrganizationId)
        .eq("client_name", selectedConversation?.client_name || "")
        .not("status", "in", '("done","archived")')
        .order("updated_at", { ascending: false })
        .limit(80);

      if (error) throw error;
      return (data || []).map((task) => ({
        id: task.id,
        title: task.title,
        status: task.status,
        sector: task.sector,
        priority: task.priority,
        updatedAt: task.updated_at,
      }));
    },
  });

  useWhatsAppRealtime(selectedConversationId);

  useEffect(() => {
    window.localStorage.setItem(whatsappPreferenceKey("density"), chatDensity);
  }, [chatDensity]);

  useEffect(() => {
    window.localStorage.setItem(whatsappPreferenceKey("background"), chatBackground);
  }, [chatBackground]);

  useEffect(() => {
    window.localStorage.setItem(whatsappPreferenceKey("bubble"), bubbleTone);
  }, [bubbleTone]);

  useEffect(() => {
    setStandardMessages(loadWhatsAppStandardMessages(user?.id));
  }, [user?.id]);

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

  const saveStandardMessages = (messages: WhatsAppStandardMessage[]) => {
    const sanitized = messages
      .map((message) => ({ title: message.title.trim().slice(0, 28), body: message.body.trim() }))
      .filter((message) => message.title && message.body)
      .slice(0, 10);
    setStandardMessages(sanitized);
    window.localStorage.setItem(whatsappUserPreferenceKey(user?.id, "standard-messages"), JSON.stringify(sanitized));
    toast.success("Mensagens padrão atualizadas.");
  };

  const flowSettingsMutation = useMutation({
    mutationFn: (includeHumanAttendance: boolean) => {
      if (!currentOrganizationId) {
        throw new Error("Organizacao ativa nao encontrada.");
      }

      return saveWhatsAppFlowSettings(currentOrganizationId, { includeHumanAttendance });
    },
    onSuccess: (settings) => {
      queryClient.setQueryData(["whatsapp", "flow-settings", currentOrganizationId], settings);
      toast.success(
        settings.includeHumanAttendance
          ? "Fluxo com atendimento habilitado."
          : "Fluxo configurado para modo somente automático.",
      );
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Nao foi possivel salvar o fluxo do WhatsApp.");
    },
  });

  const sendTextMutation = useMutation({
    mutationFn: ({
      text,
      clientMessageId,
      replyToProviderMessageId,
    }: {
      text: string;
      clientMessageId: string;
      replyToProviderMessageId?: string | null;
    }) =>
      sendWhatsAppTextMessage(selectedConversationId || "", text, clientMessageId, replyToProviderMessageId),
    onSuccess: () => {
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: whatsappConversationKeys.all }),
        queryClient.invalidateQueries({ queryKey: whatsappMessageKeys.conversation(selectedConversationId) }),
      ]);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Não foi possível enviar a mensagem.");
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
      toast.error(error instanceof Error ? error.message : "Não foi possível anexar o arquivo.");
    },
  });

  const linkClientMutation = useMutation({
    mutationFn: (clientId: string) => linkWhatsAppConversationClient(selectedConversationId || "", clientId),
    onSuccess: () => {
      toast.success("Cliente vinculado à conversa.");
      void queryClient.invalidateQueries({ queryKey: whatsappConversationKeys.all });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Não foi possível vincular o cliente."),
  });

  const quickTaskMutation = useMutation({
    mutationFn: async (draft: WhatsAppQuickTaskDraft) => {
      if (!currentOrganizationId || !selectedConversation) {
        throw new Error("Conversa ou organização ativa não encontrada.");
      }

      return createWhatsAppQuickTask({
        organizationId: currentOrganizationId,
        title: draft.title,
        description: draft.description,
        sector: draft.sector,
        priority: draft.priority,
        mode: draft.mode,
        existingTaskId: draft.existingTaskId,
        clientName: selectedConversation.client_name || null,
        createdBy: user?.id || null,
        conversationId: selectedConversation.id,
        contactPhone: selectedConversation.contact?.phone_number || null,
        clientMessageId: createClientMessageId(),
        contextMessages: draft.contextMessages,
      });
    },
    onSuccess: (result) => {
      if (result.mode === "continue" || result.contextAdded) {
        toast.success("Contexto adicionado à tarefa existente.");
      } else if (result.confirmationSent) {
        toast.success("Ticket criado e enviado ao cliente.");
      } else {
        toast.warning(`Ticket criado, mas a mensagem ao cliente falhou: ${result.confirmationError}`);
      }
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: whatsappConversationKeys.all }),
        queryClient.invalidateQueries({ queryKey: whatsappMessageKeys.conversation(selectedConversationId) }),
      ]);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Não foi possível criar a tarefa."),
  });

  const endAttendanceMutation = useMutation({
    mutationFn: () => endWhatsAppAttendance(selectedConversationId || ""),
    onSuccess: () => {
      toast.success("Atendimento finalizado.");
      setConversationQueue("automatic");
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: whatsappConversationKeys.all }),
        queryClient.invalidateQueries({ queryKey: whatsappMessageKeys.conversation(selectedConversationId) }),
      ]);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Nao foi possivel finalizar o atendimento."),
  });

  const isSending = sendTextMutation.isPending || sendFileMutation.isPending;

  return (
    <AppLayout hideFooter flushContentTop>
      <div className="flex h-[calc(100svh-4rem)] w-full max-w-none flex-col">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden border-y bg-[#f0f2f5] shadow-sm lg:rounded-none">
          <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[17rem_minmax(0,1fr)] xl:grid-cols-[18rem_minmax(0,1fr)]">
            <div className="flex min-h-0 flex-col border-r border-[#d1d7db] bg-white">
              <ConversationList
                conversations={visibleConversations}
                allConversations={conversations}
                activeId={selectedConversationId}
                activeQueue={conversationQueue}
                loading={conversationsQuery.isLoading}
                search={filters.search || ""}
                chatDensity={chatDensity}
                chatBackground={chatBackground}
                bubbleTone={bubbleTone}
                includeHumanAttendanceInFlow={
                  flowSettingsQuery.data?.includeHumanAttendance ??
                  defaultWhatsAppFlowSettings.includeHumanAttendance
                }
                flowSettingsSaving={flowSettingsMutation.isPending || flowSettingsQuery.isLoading}
                onSearchChange={updateSearch}
                onQueueChange={setConversationQueue}
                onSelect={selectConversation}
                onChatDensityChange={setChatDensity}
                onChatBackgroundChange={setChatBackground}
                onBubbleToneChange={setBubbleTone}
                onIncludeHumanAttendanceInFlowChange={(value) => flowSettingsMutation.mutate(value)}
                standardMessages={standardMessages}
                onStandardMessagesChange={saveStandardMessages}
              />
            </div>
            <ConversationPanel
              conversation={selectedConversation}
              messages={messagesQuery.data || []}
              loading={messagesQuery.isLoading}
              sending={isSending}
              activeClients={activeClientsQuery.data || []}
              existingTasks={existingTasksQuery.data || []}
              clientLinking={linkClientMutation.isPending}
              quickTaskCreating={quickTaskMutation.isPending}
              attendanceEnding={endAttendanceMutation.isPending}
              chatDensity={chatDensity}
              chatBackground={chatBackground}
              bubbleTone={bubbleTone}
              standardMessages={standardMessages}
              onSendText={async (text, replyReference) => {
                await sendTextMutation.mutateAsync({
                  text,
                  clientMessageId: createClientMessageId(),
                  replyToProviderMessageId: replyReference?.providerMessageId || null,
                });
              }}
              onSendFile={async (file) => {
                await sendFileMutation.mutateAsync({ file, clientMessageId: createClientMessageId() });
              }}
              onLinkClient={(clientId) => linkClientMutation.mutate(clientId)}
              onCreateQuickTask={(draft) => quickTaskMutation.mutate(draft)}
              onEndAttendance={() => endAttendanceMutation.mutate()}
            />
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
