import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type ChatType = "group" | "direct";

interface InternalChatMessageSummaryRow {
  id: string;
  user_id: string;
  recipient_user_id: string | null;
  chat_type: ChatType;
  content: string;
  created_at: string;
}

interface ProfileSummary {
  user_id: string;
  display_name: string | null;
}

export interface InternalChatConversationSummary {
  key: string;
  type: ChatType;
  targetUserId: string | null;
  lastMessageAt: string | null;
  lastMessagePreview: string;
  lastSenderName: string;
  unreadCount: number;
}

export interface InternalChatRealtimeMessage {
  id: string;
  conversationKey: string;
  title: string;
  body: string;
  createdAt: string;
}

type RefreshSource = "initial" | "realtime" | "manual";

const readStorageKey = (userId: string, organizationId: string | null | undefined) =>
  `grow-internal-chat-read-${organizationId || "global"}-${userId}`;

const parseReadMap = (value: string | null): Record<string, string> => {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? Object.fromEntries(
          Object.entries(parsed).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
        )
      : {};
  } catch {
    return {};
  }
};

const getReadMap = (userId: string, organizationId: string | null | undefined) =>
  parseReadMap(localStorage.getItem(readStorageKey(userId, organizationId)));

const saveReadMap = (
  userId: string,
  organizationId: string | null | undefined,
  map: Record<string, string>,
) => {
  localStorage.setItem(readStorageKey(userId, organizationId), JSON.stringify(map));
};

const conversationKeyForMessage = (message: InternalChatMessageSummaryRow, currentUserId: string) => {
  if (message.chat_type === "group") return "group";
  const otherUserId = message.user_id === currentUserId ? message.recipient_user_id : message.user_id;
  return otherUserId ? `direct:${otherUserId}` : null;
};

const conversationTargetForMessage = (message: InternalChatMessageSummaryRow, currentUserId: string) => {
  if (message.chat_type === "group") return null;
  return message.user_id === currentUserId ? message.recipient_user_id : message.user_id;
};

const parseAttachmentPreview = (content: string) => {
  try {
    const parsed = JSON.parse(content) as { type?: string; text?: unknown; file?: { name?: unknown } };
    if (parsed.type !== "internal_chat_attachment") return null;
    const text = typeof parsed.text === "string" ? parsed.text.trim() : "";
    const fileName = typeof parsed.file?.name === "string" ? parsed.file.name : "arquivo";
    return text || `Anexo: ${fileName}`;
  } catch {
    return null;
  }
};

export const getInternalChatMessagePreview = (content: string) => {
  const attachmentPreview = parseAttachmentPreview(content);
  if (attachmentPreview) return attachmentPreview;
  return content.trim() || "Mensagem";
};

export const markInternalChatConversationRead = (
  userId: string,
  organizationId: string | null | undefined,
  conversationKey: string,
  readAt: string,
) => {
  if (!userId || !conversationKey || !readAt) return;
  const map = getReadMap(userId, organizationId);
  if (!map[conversationKey] || map[conversationKey] < readAt) {
    map[conversationKey] = readAt;
    saveReadMap(userId, organizationId, map);
  }
};

export function useInternalChatNotifications() {
  const { user, currentOrganizationId } = useAuth();
  const [summaries, setSummaries] = useState<InternalChatConversationSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [notificationSignal, setNotificationSignal] = useState(0);
  const [latestRealtimeMessages, setLatestRealtimeMessages] = useState<InternalChatRealtimeMessage[]>([]);
  const unreadMessageIdsRef = useRef<Set<string>>(new Set());

  const refresh = useCallback(async (source: RefreshSource = "manual") => {
    if (!user?.id) {
      setSummaries([]);
      setLatestRealtimeMessages([]);
      return;
    }

    setLoading(true);
    let query = supabase
      .from("internal_chat_messages")
      .select("id, user_id, recipient_user_id, chat_type, content, created_at")
      .order("created_at", { ascending: false })
      .limit(1000);

    if (currentOrganizationId) {
      query = query.eq("organization_id", currentOrganizationId);
    }

    const { data, error } = await query;
    if (error) {
      setLoading(false);
      return;
    }

    const rows = (data || []) as InternalChatMessageSummaryRow[];
    const userIds = Array.from(
      new Set(rows.flatMap((row) => [row.user_id, row.recipient_user_id]).filter((id): id is string => Boolean(id))),
    );
    let profileMap = new Map<string, ProfileSummary>();
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .in("user_id", userIds);
      profileMap = new Map(((profiles || []) as ProfileSummary[]).map((profile) => [profile.user_id, profile]));
    }

    const readMap = getReadMap(user.id, currentOrganizationId);
    const conversationMap = new Map<string, InternalChatConversationSummary>();
    const unreadMessageIds = new Set<string>();
    const unreadRealtimeMessages: InternalChatRealtimeMessage[] = [];

    rows.forEach((message) => {
      const conversationKey = conversationKeyForMessage(message, user.id);
      if (!conversationKey) return;

      const targetUserId = conversationTargetForMessage(message, user.id);
      const senderName =
        profileMap.get(message.user_id)?.display_name?.trim() ||
        (message.user_id === user.id ? "Você" : "Equipe");
      const preview = getInternalChatMessagePreview(message.content);
      const isUnread = message.user_id !== user.id && (!readMap[conversationKey] || message.created_at > readMap[conversationKey]);

      if (!conversationMap.has(conversationKey)) {
        conversationMap.set(conversationKey, {
          key: conversationKey,
          type: message.chat_type,
          targetUserId,
          lastMessageAt: message.created_at,
          lastMessagePreview: preview,
          lastSenderName: senderName,
          unreadCount: 0,
        });
      }

      const summary = conversationMap.get(conversationKey);
      if (summary && isUnread) {
        summary.unreadCount += 1;
        unreadMessageIds.add(message.id);
        if (source === "realtime" && !unreadMessageIdsRef.current.has(message.id)) {
          unreadRealtimeMessages.push({
            id: message.id,
            conversationKey,
            title: message.chat_type === "group" ? "Nova mensagem no Grupo Geral" : `Nova mensagem de ${senderName}`,
            body: preview,
            createdAt: message.created_at,
          });
        }
      }
    });

    const built = Array.from(conversationMap.values()).sort((left, right) =>
      (right.lastMessageAt || "").localeCompare(left.lastMessageAt || ""),
    );

    unreadMessageIdsRef.current = unreadMessageIds;
    setSummaries(built);
    setLoading(false);

    if (source === "realtime" && unreadRealtimeMessages.length > 0) {
      setNotificationSignal((current) => current + 1);
      setLatestRealtimeMessages(unreadRealtimeMessages);
    } else {
      setLatestRealtimeMessages([]);
    }
  }, [currentOrganizationId, user?.id]);

  useEffect(() => {
    void refresh("initial");
  }, [refresh]);

  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`internal-chat-notifications-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "internal_chat_messages",
        },
        () => {
          void refresh("realtime");
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refresh, user?.id]);

  const unreadCount = useMemo(
    () => summaries.reduce((total, summary) => total + summary.unreadCount, 0),
    [summaries],
  );

  const markConversationRead = useCallback((conversationKey: string, readAt?: string | null) => {
    if (!user?.id) return;
    markInternalChatConversationRead(
      user.id,
      currentOrganizationId,
      conversationKey,
      readAt || new Date().toISOString(),
    );
    void refresh("manual");
  }, [currentOrganizationId, refresh, user?.id]);

  return {
    summaries,
    loading,
    unreadCount,
    notificationSignal,
    latestRealtimeMessages,
    markConversationRead,
    refresh,
  };
}
