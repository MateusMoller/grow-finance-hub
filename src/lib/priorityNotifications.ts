import type { Tables } from "@/integrations/supabase/types";

type TaskNotificationRow = Pick<
  Tables<"kanban_tasks">,
  "id" | "title" | "due_date" | "status" | "assignee" | "client_name" | "created_at"
>;

export type NotificationPriority = "alta" | "media" | "baixa";
export type NotificationKind = "overdue" | "due_today" | "unassigned";

export interface PriorityNotification {
  id: string;
  taskId: string;
  title: string;
  description: string;
  priority: NotificationPriority;
  kind: NotificationKind;
  createdAt: string;
}

const doneStatuses = new Set(["done", "archived"]);

const normalizeText = (value: string | null | undefined) =>
  (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const dateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const priorityWeight: Record<NotificationPriority, number> = {
  alta: 3,
  media: 2,
  baixa: 1,
};

const kindWeight: Record<NotificationKind, number> = {
  overdue: 3,
  due_today: 2,
  unassigned: 1,
};

const buildStorageKey = (userId: string) => `grow-priority-notification-read-${userId}`;

const parseReadIds = (value: string | null): string[] => {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === "string");
  } catch {
    return [];
  }
};

export const getReadNotificationIds = (userId: string) => {
  if (!userId) return [] as string[];
  return parseReadIds(localStorage.getItem(buildStorageKey(userId)));
};

export const markNotificationRead = (userId: string, notificationId: string) => {
  if (!userId || !notificationId) return;
  const current = new Set(getReadNotificationIds(userId));
  current.add(notificationId);
  localStorage.setItem(buildStorageKey(userId), JSON.stringify(Array.from(current)));
};

export const markAllNotificationsRead = (userId: string, notifications: PriorityNotification[]) => {
  if (!userId) return;
  localStorage.setItem(
    buildStorageKey(userId),
    JSON.stringify(notifications.map((notification) => notification.id)),
  );
};

export const clearReadNotifications = (userId: string) => {
  if (!userId) return;
  localStorage.removeItem(buildStorageKey(userId));
};

export const buildPriorityNotifications = (tasks: TaskNotificationRow[]): PriorityNotification[] => {
  const today = dateKey(new Date());

  const notifications = tasks
    .filter((task) => !doneStatuses.has(normalizeText(task.status)))
    .flatMap((task) => {
      const hasDueDate = Boolean(task.due_date);
      const overdue = hasDueDate && (task.due_date as string) < today;
      const dueToday = hasDueDate && task.due_date === today;
      const unassigned = !normalizeText(task.assignee);
      const clientLabel = task.client_name || "Sem cliente";

      const taskNotifications: PriorityNotification[] = [];

      if (overdue) {
        taskNotifications.push({
          id: `task-${task.id}-overdue`,
          taskId: task.id,
          title: `Tarefa atrasada: ${task.title}`,
          description: `${clientLabel} - prazo em ${task.due_date}`,
          priority: "alta",
          kind: "overdue",
          createdAt: task.created_at,
        });
      }

      if (dueToday) {
        taskNotifications.push({
          id: `task-${task.id}-due_today`,
          taskId: task.id,
          title: `Tarefa vencendo hoje: ${task.title}`,
          description: `${clientLabel} - conclua hoje para manter o prazo`,
          priority: "media",
          kind: "due_today",
          createdAt: task.created_at,
        });
      }

      if (unassigned) {
        taskNotifications.push({
          id: `task-${task.id}-unassigned`,
          taskId: task.id,
          title: `Tarefa sem responsavel: ${task.title}`,
          description: `${clientLabel} - defina o responsavel para evitar bloqueios`,
          priority: dueToday || overdue ? "alta" : "media",
          kind: "unassigned",
          createdAt: task.created_at,
        });
      }

      return taskNotifications;
    })
    .sort((a, b) => {
      const byPriority = priorityWeight[b.priority] - priorityWeight[a.priority];
      if (byPriority !== 0) return byPriority;
      const byKind = kindWeight[b.kind] - kindWeight[a.kind];
      if (byKind !== 0) return byKind;
      return b.createdAt.localeCompare(a.createdAt);
    });

  return notifications;
};
