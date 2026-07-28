import { useEffect, useState } from "react";
import { Check, Headset, MessageCircle, MessageSquareText, MoreVertical, Palette, Plus, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { WhatsAppStandardMessage } from "@/components/whatsapp/MessageComposer";
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
  allConversations = conversations,
  activeId,
  activeQueue,
  loading,
  search,
  chatDensity,
  chatBackground,
  bubbleTone,
  includeHumanAttendanceInFlow,
  flowSettingsSaving,
  onSearchChange,
  onQueueChange,
  onSelect,
  onChatDensityChange,
  onChatBackgroundChange,
  onBubbleToneChange,
  onIncludeHumanAttendanceInFlowChange,
  standardMessages,
  onStandardMessagesChange,
}: {
  conversations: WhatsAppConversationSummary[];
  allConversations?: WhatsAppConversationSummary[];
  activeId: string | null;
  activeQueue: "attendance" | "automatic";
  loading: boolean;
  search: string;
  chatDensity: WhatsAppChatDensity;
  chatBackground: WhatsAppChatBackground;
  bubbleTone: WhatsAppBubbleTone;
  includeHumanAttendanceInFlow: boolean;
  flowSettingsSaving?: boolean;
  onSearchChange: (value: string) => void;
  onQueueChange: (value: "attendance" | "automatic") => void;
  onSelect: (conversation: WhatsAppConversationSummary) => void;
  onChatDensityChange: (value: WhatsAppChatDensity) => void;
  onChatBackgroundChange: (value: WhatsAppChatBackground) => void;
  onBubbleToneChange: (value: WhatsAppBubbleTone) => void;
  onIncludeHumanAttendanceInFlowChange: (value: boolean) => void;
  standardMessages: WhatsAppStandardMessage[];
  onStandardMessagesChange: (messages: WhatsAppStandardMessage[]) => void;
}) {
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [standardMessagesOpen, setStandardMessagesOpen] = useState(false);
  const [standardMessagesDraft, setStandardMessagesDraft] = useState<WhatsAppStandardMessage[]>(standardMessages);
  const attendanceCount = allConversations.filter((conversation) => conversation.status === "in_attendance").length;
  const automaticCount = allConversations.length - attendanceCount;

  useEffect(() => {
    if (standardMessagesOpen) {
      setStandardMessagesDraft(standardMessages.length > 0 ? standardMessages : [{ title: "", body: "" }]);
    }
  }, [standardMessages, standardMessagesOpen]);

  const saveStandardMessages = () => {
    onStandardMessagesChange(
      standardMessagesDraft
        .map((message) => ({ title: message.title.trim(), body: message.body.trim() }))
        .filter((message) => message.title && message.body)
        .slice(0, 10),
    );
    setStandardMessagesOpen(false);
  };

  const updateStandardMessageDraft = (index: number, field: keyof WhatsAppStandardMessage, value: string) => {
    setStandardMessagesDraft((current) =>
      current.map((message, messageIndex) => (messageIndex === index ? { ...message, [field]: value } : message)),
    );
  };

  const removeStandardMessageDraft = (index: number) => {
    setStandardMessagesDraft((current) => {
      const next = current.filter((_, messageIndex) => messageIndex !== index);
      return next.length > 0 ? next : [{ title: "", body: "" }];
    });
  };

  const addStandardMessageDraft = () => {
    setStandardMessagesDraft((current) => (current.length >= 10 ? current : [...current, { title: "", body: "" }]));
  };

  return (
    <aside className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white">
      <div className="border-b border-[#d1d7db] bg-[#f0f2f5] px-3 py-2.5">
        <div className="mb-2 grid grid-cols-2 rounded-xl bg-[#d9e7e0] p-1 text-[12px] font-semibold text-[#54656f] shadow-inner">
          <button
            type="button"
            onClick={() => onQueueChange("attendance")}
            className={`flex h-9 items-center justify-center gap-1.5 rounded-lg transition ${
              activeQueue === "attendance"
                ? "bg-white text-[#075e54] shadow-sm"
                : "hover:bg-white/65 hover:text-[#111b21]"
            }`}
          >
            Atendimento
            {attendanceCount > 0 && (
              <span className="rounded-full bg-[#25d366] px-1.5 py-0.5 text-[10px] font-bold text-white">
                {attendanceCount}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => onQueueChange("automatic")}
            className={`flex h-9 items-center justify-center gap-1.5 rounded-lg transition ${
              activeQueue === "automatic"
                ? "bg-white text-[#075e54] shadow-sm"
                : "hover:bg-white/65 hover:text-[#111b21]"
            }`}
          >
            Automático
            {automaticCount > 0 && (
              <span className="rounded-full bg-white px-1.5 py-0.5 text-[10px] font-bold text-[#54656f] ring-1 ring-black/5">
                {automaticCount}
              </span>
            )}
          </button>
        </div>
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
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem onSelect={() => setCustomizeOpen(true)}>
                <Palette className="mr-2 h-4 w-4" />
                Customizar
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setStandardMessagesOpen(true)}>
                <MessageSquareText className="mr-2 h-4 w-4" />
                Mensagens padrão
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem disabled className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Fluxo automático
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={flowSettingsSaving}
                onSelect={() => onIncludeHumanAttendanceInFlowChange(true)}
              >
                <Headset className="mr-2 h-4 w-4" />
                <span className="flex-1">Com atendimento</span>
                {includeHumanAttendanceInFlow && <Check className="ml-2 h-4 w-4 text-[#00a884]" />}
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={flowSettingsSaving}
                onSelect={() => onIncludeHumanAttendanceInFlowChange(false)}
              >
                <MessageCircle className="mr-2 h-4 w-4" />
                <span className="flex-1">Somente automático</span>
                {!includeHumanAttendanceInFlow && <Check className="ml-2 h-4 w-4 text-[#00a884]" />}
              </DropdownMenuItem>
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
            const deliveryBlocked = conversation.status === "delivery_blocked";
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
                      <span className={deliveryBlocked ? "text-red-600" : windowActive ? "text-[#008069]" : "text-amber-600"}>
                        {deliveryBlocked ? "envio bloqueado" : windowActive ? "janela ativa" : "janela fechada"}
                      </span>
                    </span>
                  </span>
                </div>
              </button>
            );
          })
        )}
      </div>
      <Dialog open={customizeOpen} onOpenChange={setCustomizeOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Customizar chat</DialogTitle>
            <DialogDescription>Ajustes visuais aplicados somente à sua visualização do WhatsApp.</DialogDescription>
          </DialogHeader>
          <div className="space-y-5">
            <div className="space-y-2">
              <p className="text-sm font-semibold text-foreground">Densidade</p>
              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(chatDensityLabels) as WhatsAppChatDensity[]).map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => onChatDensityChange(value)}
                    className={`rounded-xl border px-3 py-2 text-sm font-medium transition ${
                      chatDensity === value
                        ? "border-[#00a884] bg-[#e7f8f1] text-[#005c4b]"
                        : "border-border bg-background text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {chatDensityLabels[value]}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-semibold text-foreground">Fundo</p>
              <div className="grid grid-cols-3 gap-2">
                {(Object.keys(chatBackgroundLabels) as WhatsAppChatBackground[]).map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => onChatBackgroundChange(value)}
                    className={`rounded-xl border px-3 py-2 text-sm font-medium transition ${
                      chatBackground === value
                        ? "border-[#00a884] bg-[#e7f8f1] text-[#005c4b]"
                        : "border-border bg-background text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {chatBackgroundLabels[value]}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-semibold text-foreground">Bolhas</p>
              <div className="grid grid-cols-3 gap-2">
                {(Object.keys(bubbleToneLabels) as WhatsAppBubbleTone[]).map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => onBubbleToneChange(value)}
                    className={`rounded-xl border px-3 py-2 text-sm font-medium transition ${
                      bubbleTone === value
                        ? "border-[#00a884] bg-[#e7f8f1] text-[#005c4b]"
                        : "border-border bg-background text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {bubbleToneLabels[value]}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={standardMessagesOpen} onOpenChange={setStandardMessagesOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Mensagens padrão</DialogTitle>
            <DialogDescription>
              Configure respostas rápidas com um título curto para o atalho e a mensagem completa para envio.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {standardMessagesDraft.map((message, index) => (
              <div key={`standard-message-${index}`} className="flex items-start gap-2 rounded-2xl border bg-muted/20 p-3">
                <div className="min-w-0 flex-1 space-y-2">
                  <Input
                    value={message.title}
                    onChange={(event) => updateStandardMessageDraft(index, "title", event.target.value)}
                    maxLength={28}
                    placeholder="Título do atalho. Ex: Boas-vindas"
                    className="h-9 bg-background"
                  />
                  <Textarea
                    value={message.body}
                    onChange={(event) => updateStandardMessageDraft(index, "body", event.target.value)}
                    maxLength={500}
                    rows={3}
                    placeholder="Mensagem completa. Ex: Olá, recebemos sua solicitação e já estamos verificando."
                    className="min-h-[5.25rem] resize-none bg-background"
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Remover mensagem padrão"
                  onClick={() => removeStandardMessageDraft(index)}
                  className="mt-1 shrink-0 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              onClick={addStandardMessageDraft}
              disabled={standardMessagesDraft.length >= 10}
              className="w-full"
            >
              <Plus className="h-4 w-4" />
              Adicionar mensagem
            </Button>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setStandardMessagesOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" onClick={saveStandardMessages}>
              Salvar mensagens
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </aside>
  );
}
