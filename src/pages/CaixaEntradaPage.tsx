import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  CheckCircle2,
  Inbox,
  Loader2,
  Mail,
  RefreshCcw,
  Search,
  Settings2,
} from "lucide-react";
import { AppLayout } from "@/components/app/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

type InboxMessageRow = Tables<"email_inbox_messages">;

const normalizeText = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const toRelativeTime = (isoDate: string) => {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return "-";

  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.max(1, Math.floor(diffMs / 60000));
  if (diffMin < 60) return `Ha ${diffMin} min`;

  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `Ha ${diffHours}h`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "Ontem";
  if (diffDays < 7) return `Ha ${diffDays} dias`;

  return date.toLocaleDateString("pt-BR");
};

export default function CaixaEntradaPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [mailboxEmail, setMailboxEmail] = useState("");
  const [loadingMailbox, setLoadingMailbox] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [markingId, setMarkingId] = useState<string | null>(null);

  const [messages, setMessages] = useState<InboxMessageRow[]>([]);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const webhookUrl = useMemo(() => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    if (!supabaseUrl) return "";
    return `${String(supabaseUrl).replace(/\/$/, "")}/functions/v1/email-inbox-webhook`;
  }, []);

  const fetchMessages = useCallback(async (targetEmail: string, softRefresh = false) => {
    const normalizedTarget = targetEmail.trim().toLowerCase();

    if (!normalizedTarget) {
      setMessages([]);
      setSelectedId(null);
      setLoadingMessages(false);
      return;
    }

    if (softRefresh) {
      setRefreshing(true);
    } else {
      setLoadingMessages(true);
    }

    const { data, error } = await supabase
      .from("email_inbox_messages")
      .select("*")
      .eq("to_email", normalizedTarget)
      .order("received_at", { ascending: false })
      .limit(200);

    if (softRefresh) {
      setRefreshing(false);
    } else {
      setLoadingMessages(false);
    }

    if (error) {
      toast.error(`Nao foi possivel carregar a caixa de entrada: ${error.message}`);
      return;
    }

    const nextMessages = (data || []) as InboxMessageRow[];
    setMessages(nextMessages);
    setSelectedId((prev) => {
      if (prev && nextMessages.some((item) => item.id === prev)) {
        return prev;
      }
      return nextMessages[0]?.id || null;
    });
  }, []);

  useEffect(() => {
    let active = true;

    const loadMailbox = async () => {
      if (!user) {
        setMailboxEmail("");
        setLoadingMailbox(false);
        setLoadingMessages(false);
        setMessages([]);
        setSelectedId(null);
        return;
      }

      setLoadingMailbox(true);

      const { data, error } = await supabase
        .from("user_settings")
        .select("company_email")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!active) return;

      const fallbackEmail = String(user.email || "").trim().toLowerCase();

      if (error) {
        toast.error(`Nao foi possivel carregar o e-mail cadastrado: ${error.message}`);
        setMailboxEmail(fallbackEmail);
        setLoadingMailbox(false);
        await fetchMessages(fallbackEmail);
        return;
      }

      const configuredEmail = String(data?.company_email || "").trim().toLowerCase();
      const nextMailboxEmail = configuredEmail || fallbackEmail;

      setMailboxEmail(nextMailboxEmail);
      setLoadingMailbox(false);
      await fetchMessages(nextMailboxEmail);
    };

    void loadMailbox();

    return () => {
      active = false;
    };
  }, [fetchMessages, user]);

  const filteredMessages = useMemo(() => {
    const term = normalizeText(search);
    if (!term) return messages;

    return messages.filter((message) => {
      const blob = [
        message.from_email,
        message.subject,
        message.preview || "",
        message.text_content || "",
      ]
        .map((entry) => normalizeText(String(entry || "")))
        .join(" ");

      return blob.includes(term);
    });
  }, [messages, search]);

  const selectedMessage = useMemo(
    () => filteredMessages.find((message) => message.id === selectedId) || filteredMessages[0] || null,
    [filteredMessages, selectedId],
  );

  const unreadCount = useMemo(
    () => messages.filter((message) => !message.read_at).length,
    [messages],
  );

  const openMessage = async (message: InboxMessageRow) => {
    setSelectedId(message.id);

    if (message.read_at) return;

    const readAt = new Date().toISOString();
    setMarkingId(message.id);

    setMessages((prev) =>
      prev.map((entry) =>
        entry.id === message.id
          ? {
              ...entry,
              read_at: readAt,
            }
          : entry,
      ),
    );

    const { error } = await supabase
      .from("email_inbox_messages")
      .update({ read_at: readAt })
      .eq("id", message.id)
      .is("read_at", null);

    setMarkingId(null);

    if (error) {
      toast.error(`Nao foi possivel marcar o e-mail como lido: ${error.message}`);
      await fetchMessages(mailboxEmail, true);
    }
  };

  return (
    <AppLayout>
      <div className="max-w-7xl space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-heading text-2xl font-bold">Caixa de Entrada</h1>
            <p className="text-sm text-muted-foreground">
              Mensagens recebidas no e-mail cadastrado em configuracoes.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            className="gap-1.5"
            disabled={!mailboxEmail || refreshing || loadingMailbox || loadingMessages}
            onClick={() => void fetchMessages(mailboxEmail, true)}
          >
            {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
            Atualizar
          </Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border bg-card p-4">
            <p className="text-xs text-muted-foreground">E-mail da caixa</p>
            <p className="mt-1 flex items-center gap-2 break-all text-sm font-semibold">
              <Mail className="h-4 w-4 text-primary" /> {mailboxEmail || "Nao configurado"}
            </p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <p className="text-xs text-muted-foreground">Total de mensagens</p>
            <p className="mt-1 text-2xl font-bold">{messages.length}</p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <p className="text-xs text-muted-foreground">Nao lidas</p>
            <p className="mt-1 flex items-center gap-2 text-2xl font-bold text-primary">
              <Inbox className="h-5 w-5" /> {unreadCount}
            </p>
          </div>
        </div>

        {loadingMailbox || loadingMessages ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-7 w-7 animate-spin text-primary" />
          </div>
        ) : !mailboxEmail ? (
          <div className="rounded-xl border bg-card p-8 text-center">
            <Inbox className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
            <p className="font-medium">Defina um e-mail para ativar a caixa de entrada</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Cadastre o e-mail corporativo em Configuracoes &gt; Empresa.
            </p>
            <Button className="mt-4 gap-2" onClick={() => navigate("/app/configuracoes")}>
              <Settings2 className="h-4 w-4" /> Ir para configuracoes
            </Button>
          </div>
        ) : (
          <>
            <div className="rounded-xl border bg-card p-4">
              <p className="text-sm font-medium">Integracao de e-mail</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Conecte seu provedor para enviar mensagens recebidas ao webhook abaixo. A caixa exibe os e-mails onde o
                destinatario for igual ao e-mail cadastrado acima.
              </p>
              {webhookUrl && (
                <code className="mt-3 block rounded-md border bg-muted/40 px-3 py-2 text-xs">{webhookUrl}</code>
              )}
            </div>

            <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
              <div className="rounded-xl border bg-card p-3">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Buscar por remetente, assunto ou texto"
                    className="pl-9"
                  />
                </div>

                <div className="mt-3 space-y-2 overflow-auto pr-1 lg:max-h-[68vh]">
                  {filteredMessages.length === 0 ? (
                    <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
                      Nenhuma mensagem encontrada.
                    </div>
                  ) : (
                    filteredMessages.map((message, index) => {
                      const isSelected = selectedMessage?.id === message.id;
                      const isUnread = !message.read_at;

                      return (
                        <motion.button
                          key={message.id}
                          type="button"
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.02 }}
                          onClick={() => void openMessage(message)}
                          className={`w-full rounded-lg border px-3 py-3 text-left transition-colors ${
                            isSelected
                              ? "border-primary/40 bg-primary/5"
                              : isUnread
                                ? "border-primary/20 bg-primary/5 hover:bg-primary/10"
                                : "hover:bg-muted"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="truncate text-sm font-semibold">{message.subject || "(sem assunto)"}</p>
                            {markingId === message.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                            ) : isUnread ? (
                              <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
                            ) : null}
                          </div>
                          <p className="mt-1 truncate text-xs text-muted-foreground">De: {message.from_email}</p>
                          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                            {message.preview || message.text_content || "Sem previa"}
                          </p>
                          <p className="mt-2 text-[11px] text-muted-foreground">{toRelativeTime(message.received_at)}</p>
                        </motion.button>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="rounded-xl border bg-card p-5">
                {!selectedMessage ? (
                  <div className="flex h-full min-h-[240px] items-center justify-center text-center">
                    <div>
                      <Inbox className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">Selecione uma mensagem para ver os detalhes.</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-start justify-between gap-2 border-b pb-3">
                      <div>
                        <h2 className="text-lg font-semibold">{selectedMessage.subject || "(sem assunto)"}</h2>
                        <p className="mt-1 text-xs text-muted-foreground">Recebido em {new Date(selectedMessage.received_at).toLocaleString("pt-BR")}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">{selectedMessage.provider || "webhook"}</Badge>
                        {selectedMessage.read_at ? (
                          <Badge className="gap-1 bg-emerald-600/10 text-emerald-700 hover:bg-emerald-600/10">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Lido
                          </Badge>
                        ) : (
                          <Badge variant="default">Nao lido</Badge>
                        )}
                      </div>
                    </div>

                    <div className="grid gap-2 rounded-lg border bg-muted/20 p-3 text-sm">
                      <p><span className="font-medium">De:</span> {selectedMessage.from_email}</p>
                      <p><span className="font-medium">Para:</span> {selectedMessage.to_email}</p>
                    </div>

                    <div className="rounded-lg border p-4">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Mensagem</p>
                      <pre className="whitespace-pre-wrap text-sm leading-6 text-foreground">
                        {selectedMessage.text_content?.trim() || selectedMessage.preview || "Sem conteudo textual disponivel para exibir."}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
