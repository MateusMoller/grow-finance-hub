import { MessageCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { ConversationHeader } from "@/components/whatsapp/ConversationHeader";
import type { WhatsAppClientLinkOption, WhatsAppExistingTaskOption, WhatsAppQuickTaskDraft } from "@/components/whatsapp/ConversationHeader";
import {
  whatsappBackgroundClass,
  type WhatsAppBubbleTone,
  type WhatsAppChatBackground,
  type WhatsAppChatDensity,
} from "@/components/whatsapp/appearance";
import { MessageBubble } from "@/components/whatsapp/MessageBubble";
import { MessageComposer } from "@/components/whatsapp/MessageComposer";
import type { WhatsAppStandardMessage } from "@/components/whatsapp/MessageComposer";
import type { WhatsAppReplyReference } from "@/lib/whatsappMessagePreview";
import { listWhatsAppConversationTaskContext } from "@/lib/whatsappTickets";
import type { WhatsAppConversationSummary, WhatsAppMessage } from "@/lib/whatsappTypes";

const getConversationName = (conversation: WhatsAppConversationSummary | null) =>
  conversation?.client_name ||
  conversation?.contact?.display_name ||
  conversation?.contact?.profile_name ||
  conversation?.contact?.phone_number ||
  "Contato";

const initialsFor = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "WA";

const emptyTaskContext: Awaited<ReturnType<typeof listWhatsAppConversationTaskContext>> = [];

export function ConversationPanel({
  conversation,
  messages,
  loading,
  sending,
  activeClients,
  existingTasks,
  clientLinking,
  quickTaskCreating,
  attendanceEnding,
  chatDensity,
  chatBackground,
  bubbleTone,
  standardMessages,
  onSendText,
  onSendFile,
  onLinkClient,
  onCreateQuickTask,
  onEndAttendance,
}: {
  conversation: WhatsAppConversationSummary | null;
  messages: WhatsAppMessage[];
  loading: boolean;
  sending: boolean;
  activeClients: WhatsAppClientLinkOption[];
  existingTasks: WhatsAppExistingTaskOption[];
  clientLinking?: boolean;
  quickTaskCreating?: boolean;
  attendanceEnding?: boolean;
  chatDensity: WhatsAppChatDensity;
  chatBackground: WhatsAppChatBackground;
  bubbleTone: WhatsAppBubbleTone;
  standardMessages?: WhatsAppStandardMessage[];
  onSendText: (text: string, replyReference: WhatsAppReplyReference | null) => Promise<void>;
  onSendFile: (file: File) => Promise<void>;
  onLinkClient: (clientId: string) => void;
  onCreateQuickTask: (draft: WhatsAppQuickTaskDraft) => void;
  onEndAttendance: () => void;
}) {
  const [replyReference, setReplyReference] = useState<WhatsAppReplyReference | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement | null>(null);
  const conversationId = conversation?.id || null;
  const contactInitials = initialsFor(getConversationName(conversation));
  const latestMessageId = messages[messages.length - 1]?.id || null;
  const taskContextQuery = useQuery({
    queryKey: ["whatsapp", "conversation-task-context", conversationId],
    queryFn: () => listWhatsAppConversationTaskContext(conversationId || ""),
    enabled: Boolean(conversationId),
    staleTime: 30_000,
  });
  const taskContext = taskContextQuery.data || emptyTaskContext;
  const taskContextByMessageId = useMemo(() => {
    const grouped = new Map<string, typeof taskContext>();
    for (const context of taskContext) {
      grouped.set(context.message_id, [...(grouped.get(context.message_id) || []), context]);
    }
    return grouped;
  }, [taskContext]);

  const scrollToLatestMessage = () => {
    const scrollArea = scrollAreaRef.current;
    if (!scrollArea) return;
    scrollArea.scrollTop = scrollArea.scrollHeight;
  };

  useEffect(() => {
    setReplyReference(null);
  }, [conversationId]);

  useEffect(() => {
    if (!conversationId || loading) return;

    scrollToLatestMessage();
    const animationFrameId = window.requestAnimationFrame(scrollToLatestMessage);
    const timeoutId = window.setTimeout(scrollToLatestMessage, 120);

    return () => {
      window.cancelAnimationFrame(animationFrameId);
      window.clearTimeout(timeoutId);
    };
  }, [conversationId, latestMessageId, loading]);

  return (
    <section className="flex min-h-0 flex-col overflow-hidden bg-[#efeae2]" aria-label="Painel da conversa WhatsApp">
      {conversation && (
        <ConversationHeader
          conversation={conversation}
          messages={messages}
          onLinkClient={onLinkClient}
          onCreateQuickTask={onCreateQuickTask}
          onEndAttendance={onEndAttendance}
          activeClients={activeClients}
          existingTasks={existingTasks}
          clientLinking={clientLinking}
          quickTaskCreating={quickTaskCreating}
          attendanceEnding={attendanceEnding}
        />
      )}
      {conversation && taskContext.length > 0 && (
        <div className="border-b border-[#d1d7db] bg-[#fffdf7] px-4 py-2">
          <div className="mx-auto flex max-w-[56rem] gap-2 overflow-x-auto text-xs">
            {taskContext.map((item) => (
              <span
                key={item.id}
                className="inline-flex max-w-[18rem] shrink-0 items-center gap-1 rounded-full border border-amber-200 bg-white px-2.5 py-1 text-[#54656f]"
                title={[
                  item.ticket_protocol,
                  item.task_title || item.ticket_title,
                  item.attachment_name ? `Anexo: ${item.attachment_name}` : null,
                ].filter(Boolean).join(" - ")}
              >
                <span className="font-semibold text-[#111b21]">{item.ticket_protocol || "Ticket"}</span>
                <span className="truncate">{item.task_title || item.ticket_title || "Contexto vinculado"}</span>
                {item.attachment_name && <span className="text-amber-700">anexo</span>}
              </span>
            ))}
          </div>
        </div>
      )}
      <div
        ref={scrollAreaRef}
        className={`min-h-0 flex-1 overflow-y-auto px-4 sm:px-7 ${
          chatDensity === "compacta" ? "py-3 sm:py-4" : "py-4 sm:py-5"
        } ${whatsappBackgroundClass[chatBackground]}`}
      >
        {!conversation ? (
          <div className="flex h-full min-h-[24rem] flex-col items-center justify-center text-center text-slate-500">
            <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-white/70 shadow-sm">
              <MessageCircle className="h-10 w-10 text-[#00a884]" />
            </div>
            <p className="text-lg font-medium text-slate-800">WhatsApp Grow</p>
            <p className="max-w-sm text-sm">Escolha uma conversa na lista para iniciar o atendimento ao cliente.</p>
          </div>
        ) : loading ? (
          <div className="rounded-lg bg-white/80 p-4 text-sm text-slate-500 shadow-sm">Carregando mensagens...</div>
        ) : messages.length === 0 ? (
          <div className="flex h-full min-h-[18rem] items-center justify-center">
            <span className="rounded-lg bg-white/80 px-4 py-2 text-sm text-slate-500 shadow-sm">Nenhuma mensagem registrada nesta conversa.</span>
          </div>
        ) : (
          <div className={`mx-auto flex w-full max-w-[56rem] flex-col ${chatDensity === "compacta" ? "gap-1" : "gap-1.5"}`}>
            {messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                contactInitials={contactInitials}
                bubbleTone={bubbleTone}
                compact={chatDensity === "compacta"}
                taskContexts={taskContextByMessageId.get(message.id) || []}
                onReply={setReplyReference}
              />
            ))}
          </div>
        )}
      </div>
      <MessageComposer
        conversation={conversation}
        sending={sending}
        compact={chatDensity === "compacta"}
        standardMessages={standardMessages}
        replyReference={replyReference}
        onSendText={onSendText}
        onSendFile={onSendFile}
        onClearReplyReference={() => setReplyReference(null)}
      />
    </section>
  );
}
