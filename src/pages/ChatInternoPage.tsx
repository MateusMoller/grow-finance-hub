import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppLayout } from "@/components/app/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, MessageSquare, Send, ShieldCheck, Users } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

type InternalChatMessageRow = Tables<"internal_chat_messages">;
type ProfileRow = Pick<Tables<"profiles">, "user_id" | "display_name">;

interface InternalMessage extends InternalChatMessageRow {
  profile?: ProfileRow | null;
}

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

export default function ChatInternoPage() {
  const { user, role, loading: authLoading } = useAuth();
  const [messages, setMessages] = useState<InternalMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const canAccess = internalRoles.has(String(role || ""));

  const fetchMessages = useCallback(async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from("internal_chat_messages")
      .select("*")
      .order("created_at", { ascending: true })
      .limit(500);

    if (error) {
      toast.error(`Nao foi possivel carregar o chat interno: ${error.message}`);
      setLoading(false);
      return;
    }

    const rows = (data || []) as InternalChatMessageRow[];
    const userIds = Array.from(new Set(rows.map((item) => item.user_id).filter(Boolean)));

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

    setLoading(false);
  }, []);

  useEffect(() => {
    if (authLoading) return;

    if (!canAccess) {
      setLoading(false);
      setMessages([]);
      return;
    }

    void fetchMessages();

    const channel = supabase
      .channel("internal-chat-room")
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
  }, [authLoading, canAccess, fetchMessages]);

  useEffect(() => {
    if (!messages.length) return;
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async () => {
    const content = newMessage.trim();
    if (!content || !user) return;

    setSending(true);

    const { error } = await supabase.from("internal_chat_messages").insert({
      user_id: user.id,
      content,
    });

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

  const totalUsers = useMemo(
    () => new Set(messages.map((message) => message.user_id)).size,
    [messages],
  );

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
      <div className="max-w-6xl space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-heading text-2xl font-bold">Chat Interno</h1>
            <p className="text-sm text-muted-foreground">
              Canal unico de comunicacao entre os funcionarios.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary" className="gap-1.5">
              <MessageSquare className="h-3.5 w-3.5" /> {messages.length} mensagens
            </Badge>
            <Badge variant="outline" className="gap-1.5">
              <Users className="h-3.5 w-3.5" /> {totalUsers} participantes
            </Badge>
            <Badge variant="outline" className="gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5" /> So equipe interna
            </Badge>
          </div>
        </div>

        <div className="rounded-xl border bg-card">
          <div className="border-b px-4 py-3 text-xs text-muted-foreground">
            Enter para enviar. Shift+Enter para quebrar linha.
          </div>

          <div className="h-[52vh] min-h-[320px] space-y-3 overflow-y-auto px-4 py-4">
            {loading ? (
              <div className="flex h-full items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : messages.length === 0 ? (
              <div className="flex h-full items-center justify-center text-center">
                <div>
                  <MessageSquare className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Nenhuma mensagem ainda. Inicie a conversa da equipe.
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
                        className={`max-w-[90%] rounded-2xl px-4 py-2.5 sm:max-w-[75%] ${
                          isOwn
                            ? "rounded-br-md bg-primary text-primary-foreground"
                            : "rounded-bl-md bg-muted"
                        }`}
                      >
                        <div className="mb-1 flex items-center justify-between gap-3">
                          <p className="text-xs font-semibold opacity-80">{senderName}</p>
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
                placeholder="Digite uma mensagem para a equipe..."
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
        </div>
      </div>
    </AppLayout>
  );
}
