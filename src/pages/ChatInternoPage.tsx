import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppLayout } from "@/components/app/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, MessageSquare, Send, ShieldCheck, UserRound, Users } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

type InternalChatMessageRow = Tables<"internal_chat_messages">;
type ProfileRow = Pick<Tables<"profiles">, "user_id" | "display_name">;

interface InternalMessage extends InternalChatMessageRow {
  profile?: ProfileRow | null;
}

interface InternalUser {
  userId: string;
  displayName: string;
}

type ActiveChat = { type: "group" } | { type: "direct"; targetUserId: string };

const internalRoles = new Set([
  "admin",
  "director",
  "manager",
  "employee",
  "commercial",
  "departamento_pessoal",
  "fiscal",
  "contabil",
]);

const formatMessageTime = (dateString: string) => {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "-";

  return `${date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  })} ${date.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
};

const resolveDisplayName = (name: string | null | undefined, fallback: string) => {
  const normalized = (name || "").trim();
  return normalized || fallback;
};

const initialsFromName = (name: string) => {
  const words = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) return "U";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[1][0]}`.toUpperCase();
};

export default function ChatInternoPage() {
  const { user, role, loading: authLoading } = useAuth();
  const [messages, setMessages] = useState<InternalMessage[]>([]);
  const [contacts, setContacts] = useState<InternalUser[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [sending, setSending] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [activeChat, setActiveChat] = useState<ActiveChat>({ type: "group" });
  const bottomRef = useRef<HTMLDivElement>(null);

  const canAccess = internalRoles.has(String(role || ""));
  const activeDirectUser = activeChat.type === "direct"
    ? contacts.find((contact) => contact.userId === activeChat.targetUserId) || null
    : null;

  const fetchContacts = useCallback(async () => {
    if (!user?.id) {
      setContacts([]);
      setLoadingContacts(false);
      return;
    }

    setLoadingContacts(true);

    const { data, error } = await supabase.rpc("list_internal_user_profiles");
    if (error) {
      toast.error(`Nao foi possivel carregar usuarios do chat: ${error.message}`);
      setContacts([]);
      setLoadingContacts(false);
      return;
    }

    const users = ((data || []) as Array<{ user_id: string; display_name: string | null }>)
      .filter((item) => item.user_id !== user.id)
      .map((item) => ({
        userId: item.user_id,
        displayName: resolveDisplayName(item.display_name, `Usuario ${item.user_id.slice(0, 6)}`),
      }));

    setContacts(users);
    setLoadingContacts(false);
  }, [user?.id]);

  const fetchMessages = useCallback(async () => {
    if (!user?.id) {
      setMessages([]);
      setLoadingMessages(false);
      return;
    }

    setLoadingMessages(true);

    let query = supabase
      .from("internal_chat_messages")
      .select("*")
      .order("created_at", { ascending: true })
      .limit(500);

    if (activeChat.type === "group") {
      query = query.eq("chat_type", "group").is("recipient_user_id", null);
    } else {
      const sourceUserId = user.id;
      const targetUserId = activeChat.targetUserId;
      query = query
        .eq("chat_type", "direct")
        .or(
          `and(user_id.eq.${sourceUserId},recipient_user_id.eq.${targetUserId}),and(user_id.eq.${targetUserId},recipient_user_id.eq.${sourceUserId})`,
        );
    }

    const { data, error } = await query;

    if (error) {
      toast.error(`Nao foi possivel carregar o chat interno: ${error.message}`);
      setMessages([]);
      setLoadingMessages(false);
      return;
    }

    const rows = (data || []) as InternalChatMessageRow[];
    const userIds = Array.from(
      new Set(
        rows
          .flatMap((item) => [item.user_id, item.recipient_user_id])
          .filter((value): value is string => Boolean(value)),
      ),
    );

    let profileMap = new Map<string, ProfileRow>();
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .in("user_id", userIds);

      profileMap = new Map(
        ((profiles || []) as ProfileRow[]).map((profile) => [profile.user_id, profile]),
      );
    }

    setMessages(
      rows.map((row) => ({
        ...row,
        profile: profileMap.get(row.user_id) || null,
      })),
    );

    setLoadingMessages(false);
  }, [activeChat, user?.id]);

  useEffect(() => {
    if (authLoading) return;

    if (!canAccess) {
      setLoadingContacts(false);
      setLoadingMessages(false);
      setContacts([]);
      setMessages([]);
      return;
    }

    void fetchContacts();
  }, [authLoading, canAccess, fetchContacts]);

  useEffect(() => {
    if (authLoading || !canAccess) return;
    void fetchMessages();
  }, [authLoading, canAccess, fetchMessages]);

  useEffect(() => {
    if (!canAccess || !user?.id) return;

    const channel = supabase
      .channel(`internal-chat-room-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "internal_chat_messages",
        },
        () => {
          void fetchMessages();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [canAccess, fetchMessages, user?.id]);

  useEffect(() => {
    if (!messages.length) return;
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (activeChat.type !== "direct") return;
    const exists = contacts.some((contact) => contact.userId === activeChat.targetUserId);
    if (exists) return;
    setActiveChat({ type: "group" });
  }, [activeChat, contacts]);

  const handleSendMessage = async () => {
    const content = newMessage.trim();
    if (!content || !user) return;

    setSending(true);

    const payload =
      activeChat.type === "group"
        ? {
            user_id: user.id,
            content,
            chat_type: "group",
            recipient_user_id: null,
          }
        : {
            user_id: user.id,
            content,
            chat_type: "direct",
            recipient_user_id: activeChat.targetUserId,
          };

    const { error } = await supabase.from("internal_chat_messages").insert(payload);

    setSending(false);

    if (error) {
      toast.error(`Nao foi possivel enviar mensagem: ${error.message}`);
      return;
    }

    setNewMessage("");
    void fetchMessages();
  };

  const handleInputKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void handleSendMessage();
    }
  };

  const totalUsers = contacts.length + (user ? 1 : 0);
  const participantsInCurrentChat = useMemo(
    () => new Set(messages.map((message) => message.user_id)).size,
    [messages],
  );

  const chatTitle =
    activeChat.type === "group"
      ? "Grupo Geral"
      : `Conversa com ${activeDirectUser?.displayName || "usuario"}`;
  const inputPlaceholder =
    activeChat.type === "group"
      ? "Digite uma mensagem para o grupo geral..."
      : `Digite uma mensagem para ${activeDirectUser?.displayName || "este usuario"}...`;

  if (authLoading) {
    return (
      <AppLayout>
        <div className="flex min-h-[300px] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (!canAccess) {
    return (
      <AppLayout>
        <div className="max-w-4xl space-y-4">
          <h1 className="font-heading text-2xl font-bold">Chat Interno</h1>
          <div className="rounded-xl border bg-card p-6">
            <p className="text-sm">
              Esta area e exclusiva para funcionarios da equipe interna.
            </p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-7xl space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-heading text-2xl font-bold">Chat Interno</h1>
            <p className="text-sm text-muted-foreground">
              Grupo geral da equipe e conversas pessoais entre usuarios.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary" className="gap-1.5">
              <MessageSquare className="h-3.5 w-3.5" /> {messages.length} mensagens
            </Badge>
            <Badge variant="outline" className="gap-1.5">
              <Users className="h-3.5 w-3.5" /> {totalUsers} usuarios internos
            </Badge>
            <Badge variant="outline" className="gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5" /> So equipe interna
            </Badge>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
          <aside className="rounded-xl border bg-card">
            <div className="border-b px-4 py-3">
              <p className="text-sm font-semibold">Conversas</p>
              <p className="text-xs text-muted-foreground">
                Escolha entre grupo geral e conversa pessoal.
              </p>
            </div>

            <div className="max-h-[62vh] overflow-y-auto p-2">
              <button
                type="button"
                className={`mb-2 w-full rounded-lg border p-3 text-left transition-colors ${
                  activeChat.type === "group"
                    ? "border-primary bg-primary/10"
                    : "hover:bg-muted"
                }`}
                onClick={() => setActiveChat({ type: "group" })}
              >
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-primary/15 text-primary flex items-center justify-center">
                    <Users className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium">Grupo Geral</p>
                    <p className="text-xs text-muted-foreground">Canal unico de toda equipe</p>
                  </div>
                </div>
              </button>

              <div className="mb-2 px-1 text-[11px] uppercase tracking-wide text-muted-foreground">
                Conversas pessoais
              </div>

              {loadingContacts ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                </div>
              ) : contacts.length === 0 ? (
                <div className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
                  Nenhum outro usuario interno encontrado.
                </div>
              ) : (
                <div className="space-y-1">
                  {contacts.map((contact) => {
                    const isActive =
                      activeChat.type === "direct" &&
                      activeChat.targetUserId === contact.userId;

                    return (
                      <button
                        key={contact.userId}
                        type="button"
                        className={`w-full rounded-lg border p-2.5 text-left transition-colors ${
                          isActive ? "border-primary bg-primary/10" : "hover:bg-muted"
                        }`}
                        onClick={() =>
                          setActiveChat({ type: "direct", targetUserId: contact.userId })
                        }
                      >
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-semibold">
                            {initialsFromName(contact.displayName)}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{contact.displayName}</p>
                            <p className="text-xs text-muted-foreground">Conversa pessoal</p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </aside>

          <section className="rounded-xl border bg-card">
            <div className="border-b px-4 py-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold">{chatTitle}</p>
                <p className="text-xs text-muted-foreground">
                  Enter para enviar. Shift+Enter para quebrar linha.
                </p>
              </div>
              <Badge variant="outline" className="gap-1.5">
                <UserRound className="h-3.5 w-3.5" /> {participantsInCurrentChat} participante(s)
              </Badge>
            </div>

            <div className="h-[52vh] min-h-[320px] space-y-3 overflow-y-auto px-4 py-4">
              {loadingMessages ? (
                <div className="flex h-full items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex h-full items-center justify-center text-center">
                  <div>
                    <MessageSquare className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      Nenhuma mensagem ainda nesta conversa.
                    </p>
                  </div>
                </div>
              ) : (
                <AnimatePresence initial={false}>
                  {messages.map((message) => {
                    const isOwn = message.user_id === user?.id;
                    const senderName =
                      message.profile?.display_name?.trim() ||
                      (isOwn ? "Voce" : `Usuario ${message.user_id.slice(0, 6)}`);

                    return (
                      <motion.div
                        key={message.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`flex ${isOwn ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[92%] rounded-2xl px-4 py-2.5 sm:max-w-[78%] ${
                            isOwn
                              ? "rounded-br-md bg-primary text-primary-foreground"
                              : "rounded-bl-md bg-muted"
                          }`}
                        >
                          <div className="mb-1 flex items-center justify-between gap-3">
                            <p className="text-xs font-semibold opacity-80">
                              {activeChat.type === "group" ? senderName : isOwn ? "Voce" : senderName}
                            </p>
                            <p
                              className={`text-[10px] ${
                                isOwn ? "text-primary-foreground/70" : "text-muted-foreground"
                              }`}
                            >
                              {formatMessageTime(message.created_at)}
                            </p>
                          </div>
                          <p className="whitespace-pre-wrap break-words text-sm leading-6">
                            {message.content}
                          </p>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              )}

              <div ref={bottomRef} />
            </div>

            <div className="border-t px-4 py-3">
              <div className="flex items-end gap-2">
                <Textarea
                  rows={2}
                  value={newMessage}
                  onChange={(event) => setNewMessage(event.target.value)}
                  onKeyDown={handleInputKeyDown}
                  placeholder={inputPlaceholder}
                  className="resize-none"
                />
                <Button
                  type="button"
                  size="icon"
                  className="h-10 w-10 shrink-0"
                  onClick={() => void handleSendMessage()}
                  disabled={sending || !newMessage.trim()}
                >
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </AppLayout>
  );
}
