import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppLayout } from "@/components/app/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/useAuth";
import { useInternalChatNotifications } from "@/hooks/useInternalChatNotifications";
import { hasAnyInternalRole, normalizeRoles } from "@/lib/accessControl";
import { canAccessModule } from "@/lib/userPermissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Building2,
  Check,
  ClipboardList,
  Download,
  FileText,
  Loader2,
  MessageSquare,
  Palette,
  Paperclip,
  Reply,
  Send,
  UserRound,
  Users,
  X,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";

type InternalChatMessageRow = Tables<"internal_chat_messages">;
type ProfileRow = Pick<Tables<"profiles">, "user_id" | "display_name" | "avatar_url">;
type ChatDensity = "compact" | "comfortable";
type ChatBackground = "grid" | "plain" | "soft";
type ChatBubbleTone = "green" | "blue" | "slate";
type ReferencePickerType = "task" | "client";

interface InternalMessage extends InternalChatMessageRow {
  profile?: ProfileRow | null;
}

interface InternalUser {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
}

interface InternalChatPresence {
  user_id?: string;
  online_at?: string;
}

type ActiveChat = { type: "group" } | { type: "direct"; targetUserId: string };

interface InternalChatAttachment {
  type: "internal_chat_attachment";
  text: string;
  reply?: InternalChatReplyData | null;
  reference?: InternalChatReferenceData | null;
  file: {
    name: string;
    path: string;
    size: number;
    contentType: string;
  };
}

interface InternalChatReferenceData {
  kind: ReferencePickerType;
  id: string;
  title: string;
  subtitle: string;
  url: string;
}

interface InternalChatReference {
  type: "internal_chat_reference";
  text: string;
  reply?: InternalChatReplyData | null;
  reference: InternalChatReferenceData;
}

interface InternalChatReplyData {
  messageId: string;
  senderName: string;
  preview: string;
  createdAt: string;
}

interface InternalChatReply {
  type: "internal_chat_reply";
  text: string;
  reply: InternalChatReplyData;
}

interface TaskReferenceOption {
  id: string;
  title: string;
  clientName: string | null;
  status: string | null;
  dueDate: string | null;
}

interface ClientReferenceOption {
  id: string;
  name: string;
  cnpj: string | null;
  regime: string | null;
}

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

const isHiddenSystemUser = (name: string | null | undefined) => {
  const normalized = (name || "").trim().toLowerCase();
  return normalized.startsWith("grow docume") || normalized.startsWith("grow bot");
};

const isInternalChatReplyData = (value: unknown): value is InternalChatReplyData => {
  if (!value || typeof value !== "object") return false;
  const reply = value as Partial<InternalChatReplyData>;
  return (
    typeof reply.messageId === "string" &&
    typeof reply.senderName === "string" &&
    typeof reply.preview === "string" &&
    typeof reply.createdAt === "string"
  );
};

const parseInternalChatAttachment = (content: string): InternalChatAttachment | null => {
  try {
    const parsed = JSON.parse(content) as Partial<InternalChatAttachment>;
    if (
      parsed.type !== "internal_chat_attachment" ||
      !parsed.file ||
      typeof parsed.file.name !== "string" ||
      typeof parsed.file.path !== "string"
    ) {
      return null;
    }

    return {
      type: "internal_chat_attachment",
      text: typeof parsed.text === "string" ? parsed.text : "",
      reply: isInternalChatReplyData(parsed.reply) ? parsed.reply : null,
      reference: isInternalChatReferenceData(parsed.reference) ? parsed.reference : null,
      file: {
        name: parsed.file.name,
        path: parsed.file.path,
        size: typeof parsed.file.size === "number" ? parsed.file.size : 0,
        contentType: typeof parsed.file.contentType === "string" ? parsed.file.contentType : "application/octet-stream",
      },
    };
  } catch {
    return null;
  }
};

const isInternalChatReferenceData = (value: unknown): value is InternalChatReferenceData => {
  if (!value || typeof value !== "object") return false;
  const reference = value as Partial<InternalChatReferenceData>;
  return (
    (reference.kind === "task" || reference.kind === "client") &&
    typeof reference.id === "string" &&
    typeof reference.title === "string" &&
    typeof reference.url === "string"
  );
};

const parseInternalChatReference = (content: string): InternalChatReference | null => {
  try {
    const parsed = JSON.parse(content) as Partial<InternalChatReference>;
    if (parsed.type !== "internal_chat_reference" || !isInternalChatReferenceData(parsed.reference)) {
      return null;
    }

    return {
      type: "internal_chat_reference",
      text: typeof parsed.text === "string" ? parsed.text : "",
      reply: isInternalChatReplyData(parsed.reply) ? parsed.reply : null,
      reference: {
        ...parsed.reference,
        subtitle: typeof parsed.reference.subtitle === "string" ? parsed.reference.subtitle : "",
      },
    };
  } catch {
    return null;
  }
};

const parseInternalChatReply = (content: string): InternalChatReply | null => {
  try {
    const parsed = JSON.parse(content) as Partial<InternalChatReply>;
    if (parsed.type !== "internal_chat_reply" || !isInternalChatReplyData(parsed.reply)) {
      return null;
    }

    return {
      type: "internal_chat_reply",
      text: typeof parsed.text === "string" ? parsed.text : "",
      reply: parsed.reply,
    };
  } catch {
    return null;
  }
};

const getInternalMessageReplyPreview = (message: InternalMessage) => {
  const attachment = parseInternalChatAttachment(message.content);
  if (attachment) {
    const text = attachment.text.trim();
    if (text) return text;
    if (attachment.reference?.title) {
      return `${attachment.reference.kind === "task" ? "Tarefa" : "Cliente"}: ${attachment.reference.title}`;
    }
    return `Anexo: ${attachment.file.name}`;
  }

  const referenceMessage = parseInternalChatReference(message.content);
  if (referenceMessage) {
    const text = referenceMessage.text.trim();
    if (text) return text;
    return `${referenceMessage.reference.kind === "task" ? "Tarefa" : "Cliente"}: ${referenceMessage.reference.title}`;
  }

  const replyMessage = parseInternalChatReply(message.content);
  if (replyMessage) {
    const text = replyMessage.text.trim();
    return text || `Resposta a ${replyMessage.reply.senderName}`;
  }

  return message.content.trim() || "Mensagem";
};

const formatFileSize = (bytes: number) => {
  if (!bytes) return "Tamanho não informado";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

const sanitizeStorageFileName = (name: string) =>
  name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120) || "arquivo";

const chatPreferenceKey = (userId: string | undefined, key: string) => `grow-internal-chat-${key}-${userId || "anon"}`;
const duplicateKeyErrorCode = "23505";

const createClientMessageId = () => {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
};

const readChatPreference = <T extends string>(userId: string | undefined, key: string, fallback: T, allowed: readonly T[]) => {
  if (typeof window === "undefined") return fallback;
  const stored = localStorage.getItem(chatPreferenceKey(userId, key));
  return allowed.includes(stored as T) ? (stored as T) : fallback;
};

const saveChatPreference = (userId: string | undefined, key: string, value: string) => {
  if (typeof window === "undefined") return;
  localStorage.setItem(chatPreferenceKey(userId, key), value);
};

const ownBubbleToneClass: Record<ChatBubbleTone, string> = {
  green: "bg-[#dcf8c6] text-slate-900",
  blue: "bg-sky-100 text-slate-950 dark:bg-sky-900/40 dark:text-sky-50",
  slate: "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-950",
};

const chatBackgroundClass: Record<ChatBackground, string> = {
  grid: "bg-muted/20 [background-image:linear-gradient(rgba(15,23,42,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.035)_1px,transparent_1px)] [background-size:28px_28px]",
  plain: "bg-muted/10",
  soft: "bg-gradient-to-b from-muted/20 to-background",
};

function ChatAvatar({
  name,
  avatarUrl,
  size = "md",
  className = "",
}: {
  name: string;
  avatarUrl?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const sizeClass = size === "sm" ? "h-7 w-7 text-[10px]" : size === "lg" ? "h-11 w-11 text-sm" : "h-10 w-10 text-xs";

  return (
    <div className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted font-semibold text-muted-foreground ${sizeClass} ${className}`}>
      {avatarUrl ? (
        <img src={avatarUrl} alt={name} className="h-full w-full object-cover" />
      ) : (
        initialsFromName(name)
      )}
    </div>
  );
}

function ChatReferenceCard({
  reference,
  compact = false,
  onRemove,
}: {
  reference: InternalChatReferenceData;
  compact?: boolean;
  onRemove?: () => void;
}) {
  const Icon = reference.kind === "task" ? ClipboardList : Building2;
  const content = (
    <>
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-semibold">
          {reference.kind === "task" ? "Tarefa" : "Cliente"}: {reference.title}
        </p>
        {reference.subtitle ? (
          <p className="truncate text-[11px] text-muted-foreground">{reference.subtitle}</p>
        ) : null}
      </div>
    </>
  );
  const className = `flex items-center gap-2 rounded-xl border bg-background/80 px-3 ${
    compact ? "py-2" : "py-2.5"
  } text-left shadow-sm transition-colors ${
    onRemove ? "" : "hover:border-primary/40 hover:bg-background"
  }`;

  if (!onRemove) {
    return (
      <Link to={reference.url} className={className} aria-label={`Abrir ${reference.kind === "task" ? "tarefa" : "cliente"} ${reference.title}`}>
        {content}
      </Link>
    );
  }

  return (
    <div className={className}>
      {content}
      <div className="shrink-0">
        <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={onRemove}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

function ChatReplyPreview({
  reply,
  compact = false,
  onRemove,
}: {
  reply: InternalChatReplyData;
  compact?: boolean;
  onRemove?: () => void;
}) {
  return (
    <div
      className={`flex items-start gap-2 rounded-xl border-l-4 border-primary/60 bg-background/75 px-3 ${
        compact ? "py-2" : "py-2.5"
      } text-left`}
    >
      <Reply className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold text-primary">
          Respondendo {reply.senderName}
        </p>
        <p className="line-clamp-2 text-xs text-muted-foreground">
          {reply.preview}
        </p>
      </div>
      {onRemove ? (
        <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={onRemove}>
          <X className="h-3.5 w-3.5" />
        </Button>
      ) : null}
    </div>
  );
}

export default function ChatInternoPage() {
  const { user, role, roles, currentOrganizationId, effectiveAccess, loading: authLoading } = useAuth();
  const [messages, setMessages] = useState<InternalMessage[]>([]);
  const [contacts, setContacts] = useState<InternalUser[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [sending, setSending] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedReply, setSelectedReply] = useState<InternalChatReplyData | null>(null);
  const [selectedReference, setSelectedReference] = useState<InternalChatReferenceData | null>(null);
  const [referencePickerType, setReferencePickerType] = useState<ReferencePickerType | null>(null);
  const [referenceSearch, setReferenceSearch] = useState("");
  const [referenceLoading, setReferenceLoading] = useState(false);
  const [taskReferenceOptions, setTaskReferenceOptions] = useState<TaskReferenceOption[]>([]);
  const [clientReferenceOptions, setClientReferenceOptions] = useState<ClientReferenceOption[]>([]);
  const [activeChat, setActiveChat] = useState<ActiveChat>({ type: "group" });
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(() => new Set());
  const [showCustomization, setShowCustomization] = useState(false);
  const [chatDensity, setChatDensity] = useState<ChatDensity>(() =>
    readChatPreference(user?.id, "density", "comfortable", ["compact", "comfortable"] as const),
  );
  const [chatBackground, setChatBackground] = useState<ChatBackground>(() =>
    readChatPreference(user?.id, "background", "grid", ["grid", "plain", "soft"] as const),
  );
  const [chatBubbleTone, setChatBubbleTone] = useState<ChatBubbleTone>(() =>
    readChatPreference(user?.id, "bubble", "green", ["green", "blue", "slate"] as const),
  );
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const sendInFlightRef = useRef(false);
  const {
    summaries: conversationSummaries,
    markConversationRead,
    refresh: refreshConversationSummaries,
  } = useInternalChatNotifications();

  const activeRoles = useMemo(() => normalizeRoles(roles.length > 0 ? roles : role ? [role] : []), [role, roles]);
  const canAccess = effectiveAccess
    ? canAccessModule(effectiveAccess, "chat_interno")
    : hasAnyInternalRole(activeRoles);
  const activeDirectUser = activeChat.type === "direct"
    ? contacts.find((contact) => contact.userId === activeChat.targetUserId) || null
    : null;
  const isActiveDirectUserOnline = activeChat.type === "direct" && onlineUserIds.has(activeChat.targetUserId);
  const conversationSummaryMap = useMemo(
    () => new Map(conversationSummaries.map((summary) => [summary.key, summary])),
    [conversationSummaries],
  );
  const groupConversationSummary = conversationSummaryMap.get("group") || null;
  const sortedContacts = useMemo(
    () =>
      [...contacts].sort((left, right) => {
        const leftSummary = conversationSummaryMap.get(`direct:${left.userId}`);
        const rightSummary = conversationSummaryMap.get(`direct:${right.userId}`);
        const byLastMessage = (rightSummary?.lastMessageAt || "").localeCompare(leftSummary?.lastMessageAt || "");
        if (byLastMessage !== 0) return byLastMessage;
        return left.displayName.localeCompare(right.displayName, "pt-BR");
      }),
    [contacts, conversationSummaryMap],
  );

  const fetchContacts = useCallback(async () => {
    if (!user?.id) {
      setContacts([]);
      setLoadingContacts(false);
      return;
    }

    setLoadingContacts(true);

    const { data, error } = currentOrganizationId
      ? await supabase.rpc("list_internal_user_profiles", { _organization_id: currentOrganizationId })
      : await supabase.rpc("list_internal_user_profiles");
    if (error) {
      toast.error(`Não foi possível carregar usuários do chat: ${error.message}`);
      setContacts([]);
      setLoadingContacts(false);
      return;
    }

    const baseUsers = ((data || []) as Array<{ user_id: string; display_name: string | null }>)
      .filter((item) => item.user_id !== user.id && !isHiddenSystemUser(item.display_name));
    const userIds = baseUsers.map((item) => item.user_id);
    let profileMap = new Map<string, ProfileRow>();

    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name, avatar_url")
        .in("user_id", userIds);

      profileMap = new Map(((profiles || []) as ProfileRow[]).map((profile) => [profile.user_id, profile]));
    }

    const users = baseUsers.map((item) => ({
      userId: item.user_id,
      displayName: resolveDisplayName(
        profileMap.get(item.user_id)?.display_name || item.display_name,
        `Usuario ${item.user_id.slice(0, 6)}`,
      ),
      avatarUrl: profileMap.get(item.user_id)?.avatar_url || null,
    }));

    setContacts(users);
    setLoadingContacts(false);
  }, [currentOrganizationId, user?.id]);

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

    if (currentOrganizationId) {
      query = query.eq("organization_id", currentOrganizationId);
    }

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
      toast.error(`Não foi possível carregar o chat interno: ${error.message}`);
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
        .select("user_id, display_name, avatar_url")
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
  }, [activeChat, currentOrganizationId, user?.id]);

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
    if (!canAccess || !user?.id) {
      setOnlineUserIds(new Set());
      return;
    }

    const channelName = `internal-chat-presence-${currentOrganizationId || "global"}`;
    const channel = supabase.channel(channelName, {
      config: {
        presence: {
          key: user.id,
        },
      },
    });

    const syncOnlineUsers = () => {
      const state = channel.presenceState<InternalChatPresence>();
      const nextOnlineUserIds = new Set<string>();

      Object.values(state).forEach((presences) => {
        presences.forEach((presence) => {
          if (presence.user_id) {
            nextOnlineUserIds.add(presence.user_id);
          }
        });
      });

      setOnlineUserIds(nextOnlineUserIds);
    };

    channel
      .on("presence", { event: "sync" }, syncOnlineUsers)
      .on("presence", { event: "join" }, syncOnlineUsers)
      .on("presence", { event: "leave" }, syncOnlineUsers)
      .subscribe((status) => {
        if (status !== "SUBSCRIBED") return;
        void channel.track({
          user_id: user.id,
          online_at: new Date().toISOString(),
        } satisfies InternalChatPresence);
      });

    return () => {
      setOnlineUserIds(new Set());
      void channel.untrack();
      supabase.removeChannel(channel);
    };
  }, [canAccess, currentOrganizationId, user?.id]);

  useEffect(() => {
    if (!messages.length) return;
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!messages.length) return;
    const conversationKey = activeChat.type === "group" ? "group" : `direct:${activeChat.targetUserId}`;
    markConversationRead(conversationKey, messages[messages.length - 1]?.created_at);
  }, [activeChat, markConversationRead, messages]);

  useEffect(() => {
    if (activeChat.type !== "direct") return;
    const exists = contacts.some((contact) => contact.userId === activeChat.targetUserId);
    if (exists) return;
    setActiveChat({ type: "group" });
  }, [activeChat, contacts]);

  useEffect(() => {
    setSelectedReply(null);
  }, [activeChat]);

  useEffect(() => {
    saveChatPreference(user?.id, "density", chatDensity);
  }, [chatDensity, user?.id]);

  useEffect(() => {
    saveChatPreference(user?.id, "background", chatBackground);
  }, [chatBackground, user?.id]);

  useEffect(() => {
    saveChatPreference(user?.id, "bubble", chatBubbleTone);
  }, [chatBubbleTone, user?.id]);

  const handleSendMessage = async () => {
    if (sendInFlightRef.current) return;

    const text = newMessage.trim();
    const file = selectedFile;
    const reference = selectedReference;
    const reply = selectedReply;
    if ((!text && !file && !reference) || !user || !currentOrganizationId) return;

    sendInFlightRef.current = true;
    setSending(true);
    const clientMessageId = createClientMessageId();
    let content = text;
    let uploadedPath: string | null = null;

    if (file) {
      const chatScope = activeChat.type === "group" ? "group" : `direct-${activeChat.targetUserId}`;
      const filePath = `${currentOrganizationId}/${user.id}/${chatScope}/${Date.now()}-${sanitizeStorageFileName(file.name)}`;
      const { error: uploadError } = await supabase.storage
        .from("internal-chat-files")
        .upload(filePath, file);

      if (uploadError) {
        sendInFlightRef.current = false;
        setSending(false);
        toast.error(`Não foi possível anexar o arquivo: ${uploadError.message}`);
        return;
      }

      uploadedPath = filePath;
      content = JSON.stringify({
        type: "internal_chat_attachment",
        text,
        reply,
        reference,
        file: {
          name: file.name,
          path: filePath,
          size: file.size,
          contentType: file.type || "application/octet-stream",
        },
      } satisfies InternalChatAttachment);
    } else if (reference) {
      content = JSON.stringify({
        type: "internal_chat_reference",
        text,
        reply,
        reference,
      } satisfies InternalChatReference);
    } else if (reply) {
      content = JSON.stringify({
        type: "internal_chat_reply",
        text,
        reply,
      } satisfies InternalChatReply);
    }

    const payload =
      activeChat.type === "group"
        ? {
          user_id: user.id,
          content,
          chat_type: "group",
          recipient_user_id: null,
          organization_id: currentOrganizationId,
          client_message_id: clientMessageId,
        }
        : {
            user_id: user.id,
            content,
            chat_type: "direct",
            recipient_user_id: activeChat.targetUserId,
            organization_id: currentOrganizationId,
            client_message_id: clientMessageId,
          };

    const { error } = await supabase.from("internal_chat_messages").insert(payload);
    const duplicateMessage = error?.code === duplicateKeyErrorCode;

    sendInFlightRef.current = false;
    setSending(false);

    if (error && !duplicateMessage) {
      if (uploadedPath) {
        void supabase.storage.from("internal-chat-files").remove([uploadedPath]);
      }
      toast.error(`Não foi possível enviar mensagem: ${error.message}`);
      return;
    }

    setNewMessage("");
    setSelectedFile(null);
    setSelectedReply(null);
    setSelectedReference(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    void fetchMessages();
    void refreshConversationSummaries();
  };

  const handleDownloadAttachment = async (filePath: string) => {
    const { data, error } = await supabase.storage
      .from("internal-chat-files")
      .createSignedUrl(filePath, 60);

    if (error || !data?.signedUrl) {
      toast.error("Não foi possível gerar o link do anexo.");
      return;
    }

    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  const openReferencePicker = async (type: ReferencePickerType) => {
    setReferencePickerType(type);
    setReferenceSearch("");
    setReferenceLoading(true);

    if (type === "task") {
      let query = supabase
        .from("kanban_tasks")
        .select("id, title, client_name, status, due_date")
        .order("updated_at", { ascending: false })
        .limit(120);

      if (currentOrganizationId) {
        query = query.eq("organization_id", currentOrganizationId);
      }

      const { data, error } = await query;
      if (error) {
        toast.error("Nao foi possivel carregar tarefas ativas.");
        setTaskReferenceOptions([]);
      } else {
        const activeTasks = ((data || []) as Array<{
          id: string;
          title: string;
          client_name: string | null;
          status: string | null;
          due_date: string | null;
        }>).filter((task) => !["done", "archived", "Concluido", "Concluído"].includes(String(task.status || "")));

        setTaskReferenceOptions(
          activeTasks.map((task) => ({
            id: task.id,
            title: task.title,
            clientName: task.client_name,
            status: task.status,
            dueDate: task.due_date,
          })),
        );
      }
    } else {
      let query = supabase
        .from("clients")
        .select("id, name, cnpj, regime")
        .eq("status", "Ativo")
        .order("name", { ascending: true })
        .limit(160);

      if (currentOrganizationId) {
        query = query.eq("organization_id", currentOrganizationId);
      }

      const { data, error } = await query;
      if (error) {
        toast.error("Nao foi possivel carregar clientes ativos.");
        setClientReferenceOptions([]);
      } else {
        setClientReferenceOptions((data || []) as ClientReferenceOption[]);
      }
    }

    setReferenceLoading(false);
  };

  const handleSelectReference = (reference: InternalChatReferenceData) => {
    setSelectedReference(reference);
    setReferencePickerType(null);
    setReferenceSearch("");
  };

  const handleReplyToMessage = (message: InternalMessage, senderName: string) => {
    setSelectedReply({
      messageId: message.id,
      senderName,
      preview: getInternalMessageReplyPreview(message),
      createdAt: message.created_at,
    });
  };

  const handleInputKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void handleSendMessage();
    }
  };

  const participantsInCurrentChat = useMemo(
    () => new Set(messages.map((message) => message.user_id)).size,
    [messages],
  );
  const normalizedReferenceSearch = referenceSearch.trim().toLowerCase();
  const filteredTaskReferenceOptions = useMemo(
    () =>
      taskReferenceOptions.filter((task) => {
        if (!normalizedReferenceSearch) return true;
        return `${task.title} ${task.clientName || ""} ${task.status || ""}`.toLowerCase().includes(normalizedReferenceSearch);
      }),
    [normalizedReferenceSearch, taskReferenceOptions],
  );
  const filteredClientReferenceOptions = useMemo(
    () =>
      clientReferenceOptions.filter((client) => {
        if (!normalizedReferenceSearch) return true;
        return `${client.name} ${client.cnpj || ""} ${client.regime || ""}`.toLowerCase().includes(normalizedReferenceSearch);
      }),
    [clientReferenceOptions, normalizedReferenceSearch],
  );

  const chatTitle =
    activeChat.type === "group"
      ? "Grupo Geral"
      : `Conversa com ${activeDirectUser?.displayName || "usuário"}`;
  const inputPlaceholder =
    activeChat.type === "group"
      ? "Digite uma mensagem para o grupo geral..."
      : `Digite uma mensagem para ${activeDirectUser?.displayName || "este usuário"}...`;

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
              Esta area e exclusiva para funcionários da equipe interna.
            </p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="mx-auto flex h-[calc(100vh-7.5rem)] min-h-[640px] w-full max-w-none flex-col space-y-5 px-1 sm:px-2 xl:px-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-heading text-2xl font-bold">Chat Interno</h1>
            <p className="text-sm text-muted-foreground">
              Canais internos e conversas diretas da equipe.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 gap-1.5 rounded-full px-3 text-xs"
              onClick={() => setShowCustomization((current) => !current)}
            >
              <Palette className="h-3.5 w-3.5" />
              Personalizar
            </Button>
          </div>
        </div>

        {showCustomization && (
          <div className="rounded-2xl border bg-card px-4 py-3 shadow-sm">
            <div className="flex flex-wrap items-center gap-4 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-medium text-muted-foreground">Mensagens</span>
                {(["comfortable", "compact"] as ChatDensity[]).map((item) => (
                  <Button
                    key={item}
                    type="button"
                    variant={chatDensity === item ? "default" : "outline"}
                    size="sm"
                    className="h-7 rounded-full px-3 text-xs"
                    onClick={() => setChatDensity(item)}
                  >
                    {item === "comfortable" ? "Confortavel" : "Compacta"}
                  </Button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-muted-foreground">Fundo</span>
                {(["grid", "plain", "soft"] as ChatBackground[]).map((item) => (
                  <Button
                    key={item}
                    type="button"
                    variant={chatBackground === item ? "default" : "outline"}
                    size="sm"
                    className="h-7 rounded-full px-3 text-xs"
                    onClick={() => setChatBackground(item)}
                  >
                    {item === "grid" ? "Grade" : item === "plain" ? "Limpo" : "Suave"}
                  </Button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-muted-foreground">Minha cor</span>
                {(["green", "blue", "slate"] as ChatBubbleTone[]).map((item) => (
                  <Button
                    key={item}
                    type="button"
                    variant={chatBubbleTone === item ? "default" : "outline"}
                    size="sm"
                    className="h-7 rounded-full px-3 text-xs"
                    onClick={() => setChatBubbleTone(item)}
                  >
                    {item === "green" ? "Verde" : item === "blue" ? "Azul" : "Escura"}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[300px_minmax(0,1fr)] xl:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="flex min-h-0 flex-col overflow-hidden rounded-2xl border bg-card shadow-sm">
            <div className="border-b bg-muted/30 px-4 py-4">
              <p className="text-sm font-semibold">Conversas</p>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              <button
                type="button"
                className={`mb-3 w-full rounded-2xl border p-3 text-left transition-all ${
                  activeChat.type === "group"
                    ? "border-primary/40 bg-primary/10 shadow-sm"
                    : "border-transparent bg-muted/30 hover:bg-muted"
                }`}
                onClick={() => setActiveChat({ type: "group" })}
              >
                <div className="flex items-center gap-2">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                    <Users className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-semibold">Grupo Geral</p>
                      {groupConversationSummary?.lastMessageAt ? (
                        <span className="shrink-0 text-[10px] text-muted-foreground">
                          {formatMessageTime(groupConversationSummary.lastMessageAt)}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-0.5 flex items-center justify-between gap-2">
                      <p className="truncate text-xs text-muted-foreground">
                        {groupConversationSummary
                          ? `${groupConversationSummary.lastSenderName}: ${groupConversationSummary.lastMessagePreview}`
                          : "Canal único da equipe"}
                      </p>
                      {groupConversationSummary?.unreadCount ? (
                        <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
                          {groupConversationSummary.unreadCount > 99 ? "99+" : groupConversationSummary.unreadCount}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
              </button>

              <div className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Conversas pessoais
              </div>

              {loadingContacts ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                </div>
              ) : contacts.length === 0 ? (
                <div className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
                  Nenhum outro usuário interno encontrado.
                </div>
              ) : (
                <div className="space-y-1.5">
                  {sortedContacts.map((contact) => {
                    const isActive =
                      activeChat.type === "direct" &&
                      activeChat.targetUserId === contact.userId;
                    const summary = conversationSummaryMap.get(`direct:${contact.userId}`);

                    return (
                      <button
                        key={contact.userId}
                        type="button"
                        className={`w-full rounded-2xl border p-2.5 text-left transition-all ${
                          isActive
                            ? "border-primary/40 bg-primary/10 shadow-sm"
                            : "border-transparent hover:bg-muted"
                        }`}
                        onClick={() =>
                          setActiveChat({ type: "direct", targetUserId: contact.userId })
                        }
                      >
                        <div className="flex items-center gap-2">
                          <div className="relative shrink-0">
                            <ChatAvatar name={contact.displayName} avatarUrl={contact.avatarUrl} />
                            {onlineUserIds.has(contact.userId) ? (
                              <span
                                className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-card bg-emerald-500"
                                aria-label="Usuário online"
                              />
                            ) : null}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <p className="truncate text-sm font-medium">{contact.displayName}</p>
                              {summary?.lastMessageAt ? (
                                <span className="shrink-0 text-[10px] text-muted-foreground">
                                  {formatMessageTime(summary.lastMessageAt)}
                                </span>
                              ) : null}
                            </div>
                            <div className="mt-0.5 flex items-center justify-between gap-2">
                              <p className="truncate text-xs text-muted-foreground">
                                {summary
                                  ? `${summary.lastSenderName}: ${summary.lastMessagePreview}`
                                  : "Conversa pessoal"}
                              </p>
                              {summary?.unreadCount ? (
                                <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
                                  {summary.unreadCount > 99 ? "99+" : summary.unreadCount}
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </aside>

          <section className="flex min-h-0 flex-col overflow-hidden rounded-2xl border bg-card shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/30 px-4 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="relative">
                  {activeChat.type === "group" ? (
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                      <Users className="h-5 w-5" />
                    </div>
                  ) : (
                    <ChatAvatar
                      name={activeDirectUser?.displayName || "Usuario"}
                      avatarUrl={activeDirectUser?.avatarUrl}
                      size="lg"
                    />
                  )}
                  {isActiveDirectUserOnline ? (
                    <span
                      className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-card bg-emerald-500"
                      aria-label="Usuário online"
                    />
                  ) : null}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{chatTitle}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {activeChat.type === "group"
                      ? "Canal interno para alinhamentos rápidos da equipe"
                      : "Conversa direta entre usuários internos"}
                  </p>
                </div>
              </div>
              <Badge variant="outline" className="gap-1.5">
                <UserRound className="h-3.5 w-3.5" /> {participantsInCurrentChat} participante(s)
              </Badge>
            </div>

            <div className={`min-h-0 flex-1 overflow-y-auto px-4 py-5 ${chatDensity === "compact" ? "space-y-2" : "space-y-4"} ${chatBackgroundClass[chatBackground]}`}>
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
                    const attachment = parseInternalChatAttachment(message.content);
                    const referenceMessage = attachment ? null : parseInternalChatReference(message.content);
                    const replyMessage = attachment || referenceMessage ? null : parseInternalChatReply(message.content);
                    const embeddedReply = attachment?.reply || referenceMessage?.reply || replyMessage?.reply || null;
                    const senderName =
                      message.profile?.display_name?.trim() ||
                      (isOwn ? "Voce" : `Usuário ${message.user_id.slice(0, 6)}`);

                    return (
                      <motion.div
                        key={message.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`flex items-end gap-2 ${isOwn ? "justify-end" : "justify-start"}`}
                      >
                        {!isOwn && (
                          <ChatAvatar
                            name={senderName}
                            avatarUrl={message.profile?.avatar_url}
                            size="sm"
                            className="mb-1 bg-card shadow-sm"
                          />
                        )}
                        <div
                          className={`max-w-[92%] rounded-2xl px-4 shadow-sm sm:max-w-[72%] ${chatDensity === "compact" ? "py-2" : "py-2.5"} ${
                            isOwn
                              ? `rounded-br-md ${ownBubbleToneClass[chatBubbleTone]}`
                              : "rounded-bl-md bg-card text-card-foreground"
                          }`}
                        >
                          <div className="mb-1 flex items-center justify-between gap-3">
                            <p className="text-xs font-semibold text-muted-foreground">
                              {activeChat.type === "group" ? senderName : isOwn ? "Você" : senderName}
                            </p>
                            <div className="flex shrink-0 items-center gap-2">
                              <button
                                type="button"
                                className="rounded-full px-2 py-0.5 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-background/70 hover:text-foreground"
                                onClick={() =>
                                  handleReplyToMessage(
                                    message,
                                    activeChat.type === "group" ? senderName : isOwn ? "Voce" : senderName,
                                  )
                                }
                              >
                                Responder
                              </button>
                              <p className="text-[10px] text-muted-foreground">
                                {formatMessageTime(message.created_at)}
                              </p>
                            </div>
                          </div>
                          {embeddedReply ? (
                            <div className="mb-2">
                              <ChatReplyPreview reply={embeddedReply} compact />
                            </div>
                          ) : null}
                          {attachment ? (
                            <div className="space-y-2">
                              {attachment.reference ? (
                                <ChatReferenceCard reference={attachment.reference} compact />
                              ) : null}
                              {attachment.text && (
                                <p className="whitespace-pre-wrap break-words text-sm leading-6">
                                  {attachment.text}
                                </p>
                              )}
                              <button
                                type="button"
                                className={`flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left text-xs transition-colors ${
                                  isOwn
                                    ? "border-slate-900/10 bg-white/40 hover:bg-white/60"
                                    : "border-border bg-muted/50 hover:bg-muted"
                                }`}
                                onClick={() => handleDownloadAttachment(attachment.file.path)}
                              >
                                <FileText className="h-4 w-4 shrink-0" />
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate font-medium">
                                    {attachment.file.name}
                                  </span>
                                  <span className="block text-muted-foreground">
                                    {formatFileSize(attachment.file.size)}
                                  </span>
                                </span>
                                <Download className="h-3.5 w-3.5 shrink-0" />
                              </button>
                            </div>
                          ) : referenceMessage ? (
                            <div className="space-y-2">
                              <ChatReferenceCard reference={referenceMessage.reference} compact />
                              {referenceMessage.text ? (
                                <p className="whitespace-pre-wrap break-words text-sm leading-6">
                                  {referenceMessage.text}
                                </p>
                              ) : null}
                            </div>
                          ) : replyMessage ? (
                            <p className="whitespace-pre-wrap break-words text-sm leading-6">
                              {replyMessage.text}
                            </p>
                          ) : (
                            <p className="whitespace-pre-wrap break-words text-sm leading-6">
                              {message.content}
                            </p>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              )}

              <div ref={bottomRef} />
            </div>

            <div className="border-t bg-card px-4 py-3">
              <div className="flex items-end gap-2 rounded-2xl bg-muted/50 p-2">
                <div className="min-w-0 flex-1">
                  {selectedReply && (
                    <div className="mb-2">
                      <ChatReplyPreview
                        reply={selectedReply}
                        compact
                        onRemove={() => setSelectedReply(null)}
                      />
                    </div>
                  )}
                  {selectedFile && (
                    <div className="mb-2 flex items-center gap-2 rounded-xl border bg-background px-3 py-2 text-xs shadow-sm">
                      <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="min-w-0 flex-1 truncate font-medium">
                        {selectedFile.name}
                      </span>
                      <span className="text-muted-foreground">
                        {formatFileSize(selectedFile.size)}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => {
                          setSelectedFile(null);
                          if (fileInputRef.current) fileInputRef.current.value = "";
                        }}
                        aria-label="Remover anexo"
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                  {selectedReference && (
                    <div className="mb-2">
                      <ChatReferenceCard
                        reference={selectedReference}
                        compact
                        onRemove={() => setSelectedReference(null)}
                      />
                    </div>
                  )}
                  <Textarea
                    rows={1}
                    value={newMessage}
                    onChange={(event) => setNewMessage(event.target.value)}
                    onKeyDown={handleInputKeyDown}
                    disabled={sending}
                    placeholder={inputPlaceholder}
                    className="max-h-32 min-h-11 resize-none rounded-xl border-0 bg-background px-4 py-3 shadow-sm focus-visible:ring-1"
                  />
                  <p className="mt-1 px-1 text-[11px] text-muted-foreground">
                    Enter envia. Shift+Enter quebra linha.
                  </p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}
                />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-11 w-11 shrink-0 rounded-full bg-background"
                      disabled={sending}
                      aria-label="Adicionar anexo ou referencia"
                    >
                      <Paperclip className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-64">
                    <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
                      <Paperclip className="mr-2 h-4 w-4" />
                      Anexar arquivo
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => void openReferencePicker("task")}>
                      <ClipboardList className="mr-2 h-4 w-4" />
                      Referenciar tarefa ativa
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => void openReferencePicker("client")}>
                      <Building2 className="mr-2 h-4 w-4" />
                      Referenciar cliente ativo
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button
                  type="button"
                  size="icon"
                  className="h-11 w-11 shrink-0 rounded-full"
                  onClick={() => void handleSendMessage()}
                  disabled={sending || (!newMessage.trim() && !selectedFile && !selectedReference)}
                >
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </section>
        </div>

        <Dialog open={referencePickerType !== null} onOpenChange={(open) => !open && setReferencePickerType(null)}>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>
                {referencePickerType === "task" ? "Referenciar tarefa ativa" : "Referenciar cliente ativo"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <Input
                value={referenceSearch}
                onChange={(event) => setReferenceSearch(event.target.value)}
                placeholder={referencePickerType === "task" ? "Buscar por tarefa, cliente ou status..." : "Buscar por cliente, CNPJ ou regime..."}
                className="h-11 rounded-xl"
              />

              <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
                {referenceLoading ? (
                  <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Carregando referencias...
                  </div>
                ) : referencePickerType === "task" ? (
                  filteredTaskReferenceOptions.length === 0 ? (
                    <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                      Nenhuma tarefa ativa encontrada.
                    </div>
                  ) : (
                    filteredTaskReferenceOptions.map((task) => {
                      const reference: InternalChatReferenceData = {
                        kind: "task",
                        id: task.id,
                        title: task.title,
                        subtitle: [task.clientName, task.status, task.dueDate ? `Prazo ${task.dueDate}` : null]
                          .filter(Boolean)
                          .join(" · "),
                        url: `/app/tarefas?task=${encodeURIComponent(task.id)}`,
                      };

                      return (
                        <button
                          key={task.id}
                          type="button"
                          className="flex w-full items-center gap-3 rounded-xl border bg-background px-3 py-3 text-left transition-colors hover:bg-muted/50"
                          onClick={() => handleSelectReference(reference)}
                        >
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                            <ClipboardList className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{task.title}</p>
                            <p className="truncate text-xs text-muted-foreground">{reference.subtitle || "Tarefa ativa"}</p>
                          </div>
                          <Check className="h-4 w-4 text-muted-foreground" />
                        </button>
                      );
                    })
                  )
                ) : filteredClientReferenceOptions.length === 0 ? (
                  <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                    Nenhum cliente ativo encontrado.
                  </div>
                ) : (
                  filteredClientReferenceOptions.map((client) => {
                    const reference: InternalChatReferenceData = {
                      kind: "client",
                      id: client.id,
                      title: client.name,
                      subtitle: [client.cnpj, client.regime].filter(Boolean).join(" · "),
                      url: `/app/clientes/${encodeURIComponent(client.id)}`,
                    };

                    return (
                      <button
                        key={client.id}
                        type="button"
                        className="flex w-full items-center gap-3 rounded-xl border bg-background px-3 py-3 text-left transition-colors hover:bg-muted/50"
                        onClick={() => handleSelectReference(reference)}
                      >
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <Building2 className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{client.name}</p>
                          <p className="truncate text-xs text-muted-foreground">{reference.subtitle || "Cliente ativo"}</p>
                        </div>
                        <Check className="h-4 w-4 text-muted-foreground" />
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
