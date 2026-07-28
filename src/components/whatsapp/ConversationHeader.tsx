import { useMemo, useState } from "react";
import { Check, ExternalLink, Link2, Loader2, Plus, Search, XCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { isWhatsAppWindowActive, type WhatsAppConversationSummary, type WhatsAppMessage } from "@/lib/whatsappTypes";

export type WhatsAppClientLinkOption = {
  id: string;
  name: string;
  cnpj: string | null;
  contact: string | null;
  phone: string | null;
};

export type WhatsAppQuickTaskDraft = {
  mode: "create" | "continue";
  title: string;
  description: string;
  sector: string;
  priority: string;
  existingTaskId: string | null;
  contextMessages: WhatsAppQuickTaskContextMessage[];
};

export type WhatsAppExistingTaskOption = {
  id: string;
  title: string;
  status: string;
  sector: string;
  priority: string;
  updatedAt: string;
};

export type WhatsAppQuickTaskContextMessage = {
  id: string;
  direction: "inbound" | "outbound";
  body: string;
  messageType: string;
  createdAt: string;
};

const taskSectorOptions = [
  "Contábil",
  "Fiscal",
  "Departamento Pessoal",
  "Comercial",
  "Societário",
  "Geral",
];

const taskPriorityOptions = ["Baixa", "Média", "Alta"];

const initialsFor = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "WA";

const formatContextMessageTime = (value: string) => {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const messagePreview = (message: WhatsAppMessage) => {
  const text = (message.body || message.safe_preview || "").trim();
  if (text) return text;
  if (message.message_type === "image") return "Imagem";
  if (message.message_type === "audio") return "Áudio";
  if (message.message_type === "video") return "Vídeo";
  if (message.message_type === "document") return "Documento";
  return "Mensagem";
};

export function ConversationHeader({
  conversation,
  messages,
  onLinkClient,
  onCreateQuickTask,
  onEndAttendance,
  activeClients,
  existingTasks,
  clientLinking,
  quickTaskCreating,
  attendanceEnding,
}: {
  conversation: WhatsAppConversationSummary | null;
  messages: WhatsAppMessage[];
  onLinkClient?: (clientId: string) => void;
  onCreateQuickTask?: (draft: WhatsAppQuickTaskDraft) => void;
  onEndAttendance?: () => void;
  activeClients: WhatsAppClientLinkOption[];
  existingTasks: WhatsAppExistingTaskOption[];
  clientLinking?: boolean;
  quickTaskCreating?: boolean;
  attendanceEnding?: boolean;
}) {
  const navigate = useNavigate();
  const [clientPopoverOpen, setClientPopoverOpen] = useState(false);
  const [clientSearch, setClientSearch] = useState("");
  const [quickTaskOpen, setQuickTaskOpen] = useState(false);
  const [quickTask, setQuickTask] = useState<WhatsAppQuickTaskDraft>({
    mode: "create",
    title: "",
    description: "",
    sector: "Geral",
    priority: "Média",
    existingTaskId: null,
    contextMessages: [],
  });
  const normalizedClientSearch = clientSearch.trim().toLowerCase();
  const filteredClients = useMemo(() => {
    if (!normalizedClientSearch) return activeClients.slice(0, 40);
    return activeClients
      .filter((client) =>
        [client.name, client.cnpj, client.contact, client.phone]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(normalizedClientSearch)),
      )
      .slice(0, 40);
  }, [activeClients, normalizedClientSearch]);
  if (!conversation) return null;

  const name =
    conversation.client_name ||
    conversation.contact?.display_name ||
    conversation.contact?.profile_name ||
    "Contato não identificado";
  const windowActive = isWhatsAppWindowActive(conversation.active_window_expires_at);
  const deliveryBlocked = conversation.status === "delivery_blocked";
  const contextMessageOptions = messages
    .filter((message) => message.delivery_status !== "failed")
    .slice(-30)
    .reverse();
  const selectedContextIds = new Set(quickTask.contextMessages.map((message) => message.id));
  const toggleContextMessage = (message: WhatsAppMessage) => {
    const contextMessage: WhatsAppQuickTaskContextMessage = {
      id: message.id,
      direction: message.direction,
      body: messagePreview(message),
      messageType: message.message_type,
      createdAt: message.created_at,
    };
    setQuickTask((current) => ({
      ...current,
      contextMessages: selectedContextIds.has(message.id)
        ? current.contextMessages.filter((item) => item.id !== message.id)
        : [...current.contextMessages, contextMessage],
    }));
  };
  const submitQuickTask = () => {
    if (quickTask.mode === "create" && !quickTask.title.trim()) return;
    if (quickTask.mode === "continue" && (!quickTask.existingTaskId || quickTask.contextMessages.length === 0)) return;
    onCreateQuickTask?.(quickTask);
    setQuickTaskOpen(false);
    setQuickTask({
      mode: "create",
      title: "",
      description: "",
      sector: "Geral",
      priority: "Média",
      existingTaskId: null,
      contextMessages: [],
    });
  };

  return (
    <div className="flex min-h-[3.9rem] items-center justify-between border-b border-[#d1d7db] bg-[#f0f2f5] px-4 py-2">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#dfe5e7] text-sm font-semibold text-[#54656f]">
          {initialsFor(name)}
        </span>
        <div className="min-w-0">
          <h2 className="truncate text-[15px] font-semibold text-[#111b21]">{name}</h2>
          <p className="truncate text-xs text-[#667781]">
            {conversation.contact?.phone_number || "Sem telefone"} -{" "}
            {deliveryBlocked ? "envio automático bloqueado" : windowActive ? "janela ativa" : "janela fechada"}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {conversation.status === "in_attendance" && (
          <Button
            variant="ghost"
            size="sm"
            className="h-9 rounded-full px-3 text-[#54656f] hover:bg-white/80 hover:text-[#111b21]"
            onClick={onEndAttendance}
            disabled={attendanceEnding}
            aria-label="Finalizar atendimento"
          >
            {attendanceEnding ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <XCircle className="mr-2 h-4 w-4" />}
            Finalizar atendimento
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="h-9 rounded-full px-3 text-[#54656f] hover:bg-white/80 hover:text-[#111b21]"
          onClick={() => setQuickTaskOpen(true)}
          disabled={quickTaskCreating}
          aria-label="Criar tarefa rápida"
        >
          {quickTaskCreating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
          Tarefa
        </Button>
        {conversation.client_id ? (
          <Button variant="ghost" size="sm" className="h-9 rounded-full px-3 text-[#54656f] hover:bg-white/80 hover:text-[#111b21]" onClick={() => navigate(`/app/clientes/${conversation.client_id}`)} aria-label="Abrir cliente vinculado">
            <ExternalLink className="mr-2 h-4 w-4" /> Cliente
          </Button>
        ) : (
          <Popover open={clientPopoverOpen} onOpenChange={setClientPopoverOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="inline-flex h-9 items-center rounded-full bg-amber-100 px-3 text-xs font-medium text-amber-800 transition hover:bg-amber-200 focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:cursor-not-allowed disabled:opacity-70"
                disabled={clientLinking}
              >
                <Link2 className="mr-1 h-3.5 w-3.5" /> Não vinculado
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-96 rounded-xl p-0">
              <div className="border-b p-3">
                <p className="text-sm font-semibold text-slate-900">Vincular cliente</p>
                <p className="text-xs text-slate-500">Selecione um cliente ativo já cadastrado.</p>
                <div className="relative mt-3">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={clientSearch}
                    onChange={(event) => setClientSearch(event.target.value)}
                    placeholder="Buscar por nome, CNPJ ou telefone"
                    className="h-9 rounded-lg pl-9 text-sm"
                  />
                </div>
              </div>
              <div className="max-h-80 overflow-y-auto p-2">
                {filteredClients.length === 0 ? (
                  <p className="rounded-lg px-3 py-6 text-center text-sm text-slate-500">Nenhum cliente ativo encontrado.</p>
                ) : (
                  filteredClients.map((client) => (
                    <button
                      key={client.id}
                      type="button"
                      className="flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition hover:bg-slate-100 focus:bg-slate-100 focus:outline-none"
                      onClick={() => {
                        onLinkClient?.(client.id);
                        setClientPopoverOpen(false);
                        setClientSearch("");
                      }}
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-xs font-semibold text-emerald-800">
                        {initialsFor(client.name)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-slate-900">{client.name}</span>
                        <span className="block truncate text-xs text-slate-500">
                          {[client.cnpj, client.contact || client.phone].filter(Boolean).join(" - ") || "Cliente ativo"}
                        </span>
                      </span>
                    </button>
                  ))
                )}
              </div>
            </PopoverContent>
          </Popover>
        )}
      </div>
      <Dialog open={quickTaskOpen} onOpenChange={setQuickTaskOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Tarefa do atendimento</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1">
              <button
                type="button"
                className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                  quickTask.mode === "create" ? "bg-white text-slate-950 shadow-sm" : "text-slate-600 hover:text-slate-950"
                }`}
                onClick={() => setQuickTask((current) => ({ ...current, mode: "create", existingTaskId: null }))}
              >
                Criar nova tarefa
              </button>
              <button
                type="button"
                className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                  quickTask.mode === "continue" ? "bg-white text-slate-950 shadow-sm" : "text-slate-600 hover:text-slate-950"
                }`}
                onClick={() => setQuickTask((current) => ({ ...current, mode: "continue", title: "", existingTaskId: current.existingTaskId || existingTasks[0]?.id || null }))}
              >
                Continuar tarefa existente
              </button>
            </div>
            {quickTask.mode === "continue" ? (
              <div className="grid gap-2">
                <Label>Tarefa existente</Label>
                <Select
                  value={quickTask.existingTaskId || ""}
                  onValueChange={(existingTaskId) => setQuickTask((current) => ({ ...current, existingTaskId }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma tarefa ativa" />
                  </SelectTrigger>
                  <SelectContent>
                    {existingTasks.map((task) => (
                      <SelectItem key={task.id} value={task.id}>
                        {task.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {existingTasks.length === 0 ? (
                  <p className="rounded-lg border border-dashed px-3 py-4 text-sm text-slate-500">
                    Nenhuma tarefa ativa encontrada para este cliente.
                  </p>
                ) : null}
              </div>
            ) : null}
            <div className={`grid gap-2 ${quickTask.mode === "continue" ? "hidden" : ""}`}>
              <Label htmlFor="whatsapp-quick-task-title">Título</Label>
              <Input
                id="whatsapp-quick-task-title"
                value={quickTask.title}
                onChange={(event) => setQuickTask((current) => ({ ...current, title: event.target.value }))}
                placeholder="Ex: Retornar contato do cliente"
              />
            </div>
            <div className={`grid gap-2 ${quickTask.mode === "continue" ? "hidden" : ""}`}>
              <Label htmlFor="whatsapp-quick-task-description">Descrição</Label>
              <Textarea
                id="whatsapp-quick-task-description"
                value={quickTask.description}
                onChange={(event) => setQuickTask((current) => ({ ...current, description: event.target.value }))}
                placeholder="Contexto rápido da conversa"
                className="min-h-24 resize-none"
              />
            </div>
            <div className="grid gap-2">
              <div className="flex items-center justify-between gap-3">
                <Label>Contexto da conversa</Label>
                <span className="text-xs text-slate-500">{quickTask.contextMessages.length} selecionada(s)</span>
              </div>
              <div className="max-h-64 overflow-y-auto rounded-xl border bg-[#efeae2] p-3">
                {contextMessageOptions.length === 0 ? (
                  <p className="rounded-lg px-3 py-6 text-center text-sm text-slate-500">
                    Nenhuma mensagem disponível para anexar como contexto.
                  </p>
                ) : (
                  <div className="grid gap-3">
                    {contextMessageOptions.map((message) => {
                      const selected = selectedContextIds.has(message.id);
                      const isClientMessage = message.direction === "inbound";
                      return (
                        <button
                          key={message.id}
                          type="button"
                          className={`group flex w-full items-center gap-2 text-left transition ${
                            isClientMessage ? "justify-start" : "justify-end"
                          }`}
                          onClick={() => toggleContextMessage(message)}
                        >
                          <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition ${
                            selected ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-300 bg-white/85 group-hover:border-slate-400"
                          }`}>
                            {selected ? <Check className="h-3.5 w-3.5" /> : null}
                          </span>
                          <span
                            className={`min-w-0 max-w-[86%] rounded-2xl border px-3 py-2 shadow-sm transition ${
                              isClientMessage
                                ? selected
                                  ? "border-emerald-300 bg-emerald-50"
                                  : "border-white bg-white hover:border-slate-200"
                                : selected
                                  ? "border-emerald-300 bg-emerald-100"
                                  : "border-[#d9fdd3] bg-[#d9fdd3] hover:border-emerald-200"
                            }`}
                          >
                            <span className="mb-1 flex items-center justify-between gap-3 text-[11px] font-medium">
                              <span className={isClientMessage ? "text-slate-600" : "text-emerald-800"}>
                                {isClientMessage ? "Cliente" : "Equipe interna"}
                              </span>
                              <span className="shrink-0 text-slate-500">{formatContextMessageTime(message.created_at)}</span>
                            </span>
                            <span className="block line-clamp-3 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-900">
                              {messagePreview(message)}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              <p className="text-xs text-slate-500">
                Selecione manualmente as mensagens que explicam o contexto da tarefa.
              </p>
            </div>
            <div className={`grid gap-3 sm:grid-cols-2 ${quickTask.mode === "continue" ? "hidden" : ""}`}>
              <div className="grid gap-2">
                <Label>Setor</Label>
                <Select value={quickTask.sector} onValueChange={(sector) => setQuickTask((current) => ({ ...current, sector }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {taskSectorOptions.map((sector) => (
                      <SelectItem key={sector} value={sector}>
                        {sector}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Prioridade</Label>
                <Select value={quickTask.priority} onValueChange={(priority) => setQuickTask((current) => ({ ...current, priority }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {taskPriorityOptions.map((priority) => (
                      <SelectItem key={priority} value={priority}>
                        {priority}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <p className="text-xs text-slate-500">
              {quickTask.mode === "create"
                ? "A tarefa será criada em A Fazer e vinculada ao cliente da conversa quando houver cliente associado."
                : "As mensagens selecionadas serão adicionadas como novo contexto da tarefa escolhida, sem alterar o fluxo ou status atual."}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setQuickTaskOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={submitQuickTask}
              disabled={
                quickTaskCreating ||
                (quickTask.mode === "create" && !quickTask.title.trim()) ||
                (quickTask.mode === "continue" && (!quickTask.existingTaskId || quickTask.contextMessages.length === 0))
              }
            >
              {quickTaskCreating ? "Salvando..." : quickTask.mode === "create" ? "Criar tarefa" : "Adicionar contexto"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
