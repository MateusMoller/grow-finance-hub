import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useGlobalFilters } from "@/hooks/useGlobalFilters";
import type { Tables } from "@/integrations/supabase/types";
import {
  buildPriorityNotifications,
  clearReadNotifications,
  getReadNotificationIds,
  markAllNotificationsRead,
  markNotificationRead,
  type PriorityNotification,
} from "@/lib/priorityNotifications";
import { getTaskCompetence, matchesSelectedCompany, matchesSelectedCompetence } from "@/lib/globalFilters";

type TaskNotificationRow = Pick<
  Tables<"kanban_tasks">,
  "id" | "title" | "due_date" | "status" | "assignee" | "client_name" | "created_at"
>;

export interface NotificationWithRead extends PriorityNotification {
  read: boolean;
}

export function usePriorityNotifications() {
  const { user } = useAuth();
  const { selectedCompany, selectedCompetence } = useGlobalFilters();
  const [notifications, setNotifications] = useState<NotificationWithRead[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!user?.id) {
      setNotifications([]);
      return;
    }

    setLoading(true);
    const { data } = await supabase
      .from("kanban_tasks")
      .select("id, title, due_date, status, assignee, client_name, created_at")
      .order("created_at", { ascending: false })
      .limit(3000);

    const scopedTasks = ((data || []) as TaskNotificationRow[]).filter(
      (task) =>
        matchesSelectedCompany(task.client_name, selectedCompany) &&
        matchesSelectedCompetence(
          getTaskCompetence(task.due_date, task.created_at),
          selectedCompetence,
        ),
    );

    const readIds = new Set(getReadNotificationIds(user.id));
    const built = buildPriorityNotifications(scopedTasks).map((notification) => ({
      ...notification,
      read: readIds.has(notification.id),
    }));

    setNotifications(built);
    setLoading(false);
  }, [selectedCompany, selectedCompetence, user?.id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

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
  };
}
