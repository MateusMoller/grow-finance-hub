import { MessageCircle, Search } from "lucide-react";
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
  "Contato nao identificado";

const initialsFor = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "WA";

const statusLabel = (conversation: WhatsAppConversationSummary) => {
  if (conversation.status === "resolved") return "Resolvida";
  if (conversation.status === "pending_client") return "Aguardando cliente";
  if (conversation.status === "in_attendance") return "Em atendimento";
  return "Aberta";
};

export function ConversationList({
  conversations,
  activeId,
  loading,
  search,
  onSearchChange,
  onSelect,
}: {
  conversations: WhatsAppConversationSummary[];
  activeId: string | null;
  loading: boolean;
  search: string;
  onSearchChange: (value: string) => void;
  onSelect: (conversation: WhatsAppConversationSummary) => void;
}) {
  return (
    <aside className="flex min-h-0 flex-col overflow-hidden border-r bg-white">
      <div className="border-b bg-[#f0f2f5] px-3.5 py-2.5">
        <div className="mb-2.5 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">Conversas</h2>
          <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-slate-500 shadow-sm">
            {conversations.length}
          </span>
        </div>
        <label className="flex h-9 items-center gap-2 rounded-lg bg-white px-3 shadow-sm">
          <Search className="h-4 w-4 shrink-0 text-slate-400" />
          <input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Buscar conversa"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
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
                className={`w-full border-b border-slate-100 px-2.5 py-0 text-left transition ${
                  active ? "bg-[#f0f2f5]" : "hover:bg-[#f7f8fa] focus-visible:bg-[#f7f8fa] focus-visible:outline-none"
                }`}
              >
                <div className="flex min-h-[4.25rem] items-center gap-2.5">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-100 to-teal-200 text-xs font-semibold text-emerald-900">
                    {initialsFor(getConversationName(conversation))}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-start gap-2">
                      <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-slate-900">{getConversationName(conversation)}</span>
                      <span className="shrink-0 text-[11px] text-slate-400">{formatTime(conversation.last_message_at)}</span>
                    </span>
                    <span className="mt-1 flex items-center gap-2">
                      <span className="min-w-0 flex-1 truncate text-[13px] text-slate-500">
                        {conversation.last_message_preview || "Sem mensagens recentes"}
                      </span>
                      {conversation.unread_count > 0 && (
                        <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-[#25d366] px-1.5 text-[11px] font-bold text-white">
                          {conversation.unread_count}
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 flex items-center gap-2 text-[10px] text-slate-400">
                      <span>{statusLabel(conversation)}</span>
                      <span className={windowActive ? "text-emerald-600" : "text-amber-600"}>
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
