import { MessageCircle } from "lucide-react";
import { useEffect, useState } from "react";
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

export function ConversationPanel({
  conversation,
  messages,
  loading,
  sending,
  activeClients,
  existingTasks,
  clientLinking,
  quickTaskCreating,
  chatDensity,
  chatBackground,
  bubbleTone,
  standardMessages,
  onSendText,
  onSendFile,
  onLinkClient,
  onCreateQuickTask,
}: {
  conversation: WhatsAppConversationSummary | null;
  messages: WhatsAppMessage[];
  loading: boolean;
  sending: boolean;
  activeClients: WhatsAppClientLinkOption[];
  existingTasks: WhatsAppExistingTaskOption[];
  clientLinking?: boolean;
  quickTaskCreating?: boolean;
  chatDensity: WhatsAppChatDensity;
  chatBackground: WhatsAppChatBackground;
  bubbleTone: WhatsAppBubbleTone;
  standardMessages?: WhatsAppStandardMessage[];
  onSendText: (text: string, replyReference: WhatsAppReplyReference | null) => Promise<void>;
  onSendFile: (file: File) => Promise<void>;
  onLinkClient: (clientId: string) => void;
  onCreateQuickTask: (draft: WhatsAppQuickTaskDraft) => void;
}) {
  const [replyReference, setReplyReference] = useState<WhatsAppReplyReference | null>(null);
  const contactInitials = initialsFor(getConversationName(conversation));

  useEffect(() => {
    setReplyReference(null);
  }, [conversation?.id]);

  return (
    <section className="flex min-h-0 flex-col overflow-hidden bg-[#efeae2]" aria-label="Painel da conversa WhatsApp">
      {conversation && (
        <ConversationHeader
          conversation={conversation}
          messages={messages}
          onLinkClient={onLinkClient}
          onCreateQuickTask={onCreateQuickTask}
          activeClients={activeClients}
          existingTasks={existingTasks}
          clientLinking={clientLinking}
          quickTaskCreating={quickTaskCreating}
        />
      )}
      <div
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
