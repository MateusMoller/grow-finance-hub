import { MessageCircle, MoreVertical, Search } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  bubbleToneLabels,
  chatBackgroundLabels,
  chatDensityLabels,
  type WhatsAppBubbleTone,
  type WhatsAppChatBackground,
  type WhatsAppChatDensity,
} from "@/components/whatsapp/appearance";
import { isWhatsAppWindowActive, type WhatsAppConversationSummary } from "@/lib/whatsappTypes";

const formatTime = (value: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const today = new Date();
  const sameDay = date.toDateString() === today.toDateString();
  return sameDay
    ? date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    : date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
};

const getConversationName = (conversation: WhatsAppConversationSummary) =>
  conversation.client_name ||
  conversation.contact?.display_name ||
  conversation.contact?.profile_name ||
  conversation.contact?.phone_number ||
  "Contato não identificado";

const initialsFor = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "WA";

export function ConversationList({
  conversations,
  activeId,
  loading,
  search,
  chatDensity,
  chatBackground,
  bubbleTone,
  onSearchChange,
  onSelect,
  onChatDensityChange,
  onChatBackgroundChange,
  onBubbleToneChange,
}: {
  conversations: WhatsAppConversationSummary[];
  activeId: string | null;
  loading: boolean;
  search: string;
  chatDensity: WhatsAppChatDensity;
  chatBackground: WhatsAppChatBackground;
  bubbleTone: WhatsAppBubbleTone;
  onSearchChange: (value: string) => void;
  onSelect: (conversation: WhatsAppConversationSummary) => void;
  onChatDensityChange: (value: WhatsAppChatDensity) => void;
  onChatBackgroundChange: (value: WhatsAppChatBackground) => void;
  onBubbleToneChange: (value: WhatsAppBubbleTone) => void;
}) {
  return (
    <aside className="flex min-h-0 flex-col overflow-hidden border-r border-[#d1d7db] bg-white">
      <div className="border-b border-[#d1d7db] bg-[#f0f2f5] px-3 py-2.5">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-[15px] font-semibold text-[#111b21]">Conversas</h2>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="Personalizar chat"
                className="flex h-8 w-8 items-center justify-center rounded-full text-[#54656f] transition hover:bg-white/80 hover:text-[#111b21] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00a884]/35"
              >
                <MoreVertical className="h-5 w-5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Personalizar chat</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">Densidade</DropdownMenuLabel>
              <DropdownMenuRadioGroup value={chatDensity} onValueChange={(value) => onChatDensityChange(value as WhatsAppChatDensity)}>
                {(Object.keys(chatDensityLabels) as WhatsAppChatDensity[]).map((value) => (
                  <DropdownMenuRadioItem key={value} value={value}>
                    {chatDensityLabels[value]}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">Fundo</DropdownMenuLabel>
              <DropdownMenuRadioGroup value={chatBackground} onValueChange={(value) => onChatBackgroundChange(value as WhatsAppChatBackground)}>
                {(Object.keys(chatBackgroundLabels) as WhatsAppChatBackground[]).map((value) => (
                  <DropdownMenuRadioItem key={value} value={value}>
                    {chatBackgroundLabels[value]}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">Bolhas</DropdownMenuLabel>
              <DropdownMenuRadioGroup value={bubbleTone} onValueChange={(value) => onBubbleToneChange(value as WhatsAppBubbleTone)}>
                {(Object.keys(bubbleToneLabels) as WhatsAppBubbleTone[]).map((value) => (
                  <DropdownMenuRadioItem key={value} value={value}>
                    {bubbleToneLabels[value]}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <label className="flex h-9 items-center gap-2 rounded-lg bg-white px-3 shadow-sm ring-1 ring-black/5 transition focus-within:ring-[#00a884]/40">
          <Search className="h-4 w-4 shrink-0 text-[#667781]" />
          <input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Buscar conversa"
            className="min-w-0 flex-1 bg-transparent text-sm text-[#111b21] outline-none placeholder:text-[#8696a0]"
          />
        </label>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto bg-white">
        {loading ? (
          <div className="p-4 text-sm text-slate-500">Carregando conversas...</div>
        ) : conversations.length === 0 ? (
          <div className="m-3 flex flex-col items-center gap-2 rounded-xl border border-dashed p-6 text-center text-sm text-slate-500">
            <MessageCircle className="h-7 w-7" />
            Nenhuma conversa encontrada.
          </div>
        ) : (
          conversations.map((conversation) => {
            const active = conversation.id === activeId;
            const windowActive = isWhatsAppWindowActive(conversation.active_window_expires_at);
            return (
              <button
                key={conversation.id}
                type="button"
                onClick={() => onSelect(conversation)}
                aria-label={`Abrir conversa ${getConversationName(conversation)}`}
                className={`w-full border-b border-[#f0f2f5] px-3 py-0 text-left transition ${
                  active ? "bg-[#f0f2f5]" : "hover:bg-[#f5f6f6] focus-visible:bg-[#f5f6f6] focus-visible:outline-none"
                }`}
              >
                <div className="flex min-h-[4.55rem] items-center gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#dfe5e7] text-sm font-semibold text-[#54656f]">
                    {initialsFor(getConversationName(conversation))}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-start gap-2">
                      <span className="min-w-0 flex-1 truncate text-[14px] font-semibold text-[#111b21]">{getConversationName(conversation)}</span>
                      <span className={`shrink-0 text-[11px] ${conversation.unread_count > 0 ? "font-semibold text-[#00a884]" : "text-[#667781]"}`}>
                        {formatTime(conversation.last_message_at)}
                      </span>
                    </span>
                    <span className="mt-1 flex items-center gap-2">
                      <span className={`min-w-0 flex-1 truncate text-[13px] ${conversation.unread_count > 0 ? "font-medium text-[#111b21]" : "text-[#667781]"}`}>
                        {conversation.last_message_preview || "Sem mensagens recentes"}
                      </span>
                      {conversation.unread_count > 0 && (
                        <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-[#25d366] px-1.5 text-[11px] font-bold text-white">
                          {conversation.unread_count}
                        </span>
                      )}
                    </span>
                    <span className="mt-1 flex items-center gap-1.5 text-[10px] text-[#8696a0]">
                      <span className={windowActive ? "text-[#008069]" : "text-amber-600"}>
                        {windowActive ? "janela ativa" : "janela fechada"}
                      </span>
                    </span>
                  </span>
                </div>
              </button>
            );
          })
        )}
      </div>
    </aside>
  );
}
