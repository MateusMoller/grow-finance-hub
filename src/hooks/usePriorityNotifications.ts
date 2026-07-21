import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useGlobalFilters } from "@/hooks/useGlobalFilters";
import type { Tables } from "@/integrations/supabase/types";
import {
  buildPriorityNotifications,
  buildTaskEventNotifications,
  buildWhatsAppNotifications,
  clearReadNotifications,
  getReadNotificationIds,
  markAllNotificationsRead,
  markNotificationRead,
  type PriorityNotification,
  type TaskEventNotificationRow,
  type WhatsAppNotificationRow,
} from "@/lib/priorityNotifications";
import { getTaskCompetence, matchesSelectedCompany, matchesSelectedCompetence } from "@/lib/globalFilters";

type TaskNotificationRow = Pick<
  Tables<"kanban_tasks">,
  "id" | "title" | "due_date" | "status" | "assignee" | "client_name" | "created_at" | "created_by" | "updated_at" | "integration_source"
>;

type LooseSupabaseQuery<T> = PromiseLike<{ data: T | null; error: Error | null }> & {
  select: (columns: string) => LooseSupabaseQuery<T>;
  order: (column: string, options?: Record<string, unknown>) => LooseSupabaseQuery<T>;
  limit: (count: number) => LooseSupabaseQuery<T>;
};

const looseSupabase = supabase as unknown as {
  from: <T = unknown>(table: string) => LooseSupabaseQuery<T>;
};

export interface NotificationWithRead extends PriorityNotification {
  read: boolean;
}

type RefreshSource = "initial" | "filters" | "realtime" | "manual";

export function usePriorityNotifications() {
  const { user } = useAuth();
  const { selectedCompany, selectedCompetence } = useGlobalFilters();
  const [notifications, setNotifications] = useState<NotificationWithRead[]>([]);
  const [loading, setLoading] = useState(false);
  const [notificationSignal, setNotificationSignal] = useState(0);
  const [latestRealtimeNotifications, setLatestRealtimeNotifications] = useState<NotificationWithRead[]>([]);
  const notificationsRef = useRef<NotificationWithRead[]>([]);

  useEffect(() => {
    notificationsRef.current = notifications;
  }, [notifications]);

  const refresh = useCallback(async (source: RefreshSource = "manual") => {
    if (!user?.id) {
      setNotifications([]);
      return;
    }

    setLoading(true);
    const [tasksResponse, commentsResponse, whatsappResponse] = await Promise.all([
      supabase
        .from("kanban_tasks")
        .select("id, title, due_date, status, assignee, assigned_to_user_id, client_name, created_at, created_by, updated_at, integration_source")
        .order("created_at", { ascending: false })
        .limit(3000),
      supabase
        .from("kanban_task_comments")
        .select("id, task_id, user_id, content, created_at, task:kanban_tasks(id, title, client_name, due_date, created_at)")
        .order("created_at", { ascending: false })
        .limit(1000),
      looseSupabase
        .from("whatsapp_conversation_notifications")
        .select("id, conversation_id, notification_type, title, body, created_at")
        .order("created_at", { ascending: false })
        .limit(500),
    ]);

    const scopedTasks = ((tasksResponse.data || []) as TaskNotificationRow[]).filter(
      (task) =>
        matchesSelectedCompany(task.client_name, selectedCompany) &&
        matchesSelectedCompetence(
          getTaskCompetence(task.due_date, task.created_at),
          selectedCompetence,
        ),
    );
    const scopedComments = ((commentsResponse.data || []) as unknown as TaskEventNotificationRow[]).filter(
      (comment) =>
        matchesSelectedCompany(comment.task?.client_name || null, selectedCompany) &&
        matchesSelectedCompetence(
          getTaskCompetence(comment.task?.due_date || null, comment.task?.created_at || comment.created_at),
          selectedCompetence,
        ),
    );

    const readIds = new Set(getReadNotificationIds(user.id));
    const built = [
      ...buildPriorityNotifications(scopedTasks, user.id),
      ...buildTaskEventNotifications(scopedComments, user.id),
      ...buildWhatsAppNotifications(((whatsappResponse.data || []) as WhatsAppNotificationRow[])),
    ]
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .map((notification) => ({
        ...notification,
        read: readIds.has(notification.id),
      }));

    if (source === "realtime") {
      const previousIds = new Set(notificationsRef.current.map((notification) => notification.id));
      const newUnreadNotifications = built.filter(
        (notification) => !notification.read && !previousIds.has(notification.id),
      );

      if (newUnreadNotifications.length > 0) {
        setNotificationSignal((prev) => prev + 1);
        setLatestRealtimeNotifications(newUnreadNotifications);
      } else {
        setLatestRealtimeNotifications([]);
      }
    } else {
      setLatestRealtimeNotifications([]);
    }

    setNotifications(built);
    setLoading(false);
  }, [selectedCompany, selectedCompetence, user?.id]);

  useEffect(() => {
    void refresh("filters");
  }, [refresh]);

  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`priority-notifications-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "kanban_tasks",
        },
        () => {
          void refresh("realtime");
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "kanban_task_comments",
        },
        () => {
          void refresh("realtime");
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "whatsapp_conversation_notifications",
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
    () => notifications.filter((notification) => !notification.read).length,
    [notifications],
  );

  const markAsRead = (notificationId: string) => {
    if (!user?.id) return;
    markNotificationRead(user.id, notificationId);
    setNotifications((prev) =>
      prev.map((notification) =>
        notification.id === notificationId ? { ...notification, read: true } : notification,
      ),
    );
  };

  const markAllAsRead = () => {
    if (!user?.id) return;
    markAllNotificationsRead(user.id, notifications);
    setNotifications((prev) => prev.map((notification) => ({ ...notification, read: true })));
  };

  const resetReadState = () => {
    if (!user?.id) return;
    clearReadNotifications(user.id);
    setNotifications((prev) => prev.map((notification) => ({ ...notification, read: false })));
  };

  return {
    notifications,
    loading,
    unreadCount,
    markAsRead,
    markAllAsRead,
    refresh,
    resetReadState,
    notificationSignal,
    latestRealtimeNotifications,
  };
}
