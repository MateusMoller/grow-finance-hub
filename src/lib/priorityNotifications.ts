import type { Tables } from "@/integrations/supabase/types";

type TaskNotificationRow = Pick<
  Tables<"kanban_tasks">,
  "id" | "title" | "due_date" | "status" | "assignee" | "client_name" | "created_at" | "created_by" | "updated_at" | "integration_source"
>;

export type NotificationPriority = "alta" | "media" | "baixa";
export type NotificationKind =
  | "overdue"
  | "due_today"
  | "unassigned"
  | "completed"
  | "sector_added"
  | "internal_message"
  | "client_chat";

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
const obligationTaskSources = new Set(["grow_obligation_task"]);

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
  completed: 3,
  due_today: 2,
  sector_added: 2,
  internal_message: 2,
  client_chat: 2,
  unassigned: 1,
};

export interface TaskEventNotificationRow {
  id: string;
  task_id: string;
  user_id: string;
  content: string;
  created_at: string;
  task: {
    id: string;
    title: string;
    client_name: string | null;
    due_date: string | null;
    created_at: string;
  } | null;
}

const parseJsonRecord = (value: string): Record<string, unknown> | null => {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
};

const isInternalCommentPayload = (payload: Record<string, unknown> | null) =>
  payload?.type === "task_internal_message" || payload?.type === "task_internal_attachment";

const isClientChatPayload = (payload: Record<string, unknown> | null) =>
  payload?.type === "task_chat_attachment";

const getPayloadText = (payload: Record<string, unknown> | null) =>
  typeof payload?.text === "string" ? payload.text.trim() : "";

const getPayloadSectors = (payload: Record<string, unknown> | null) =>
  Array.isArray(payload?.sectors)
    ? payload.sectors.filter((sector): sector is string => typeof sector === "string" && sector.trim().length > 0)
    : [];

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

export const buildPriorityNotifications = (
  tasks: TaskNotificationRow[],
  currentUserId?: string | null,
): PriorityNotification[] => {
  const today = dateKey(new Date());

  const notifications = tasks
    .flatMap((task) => {
      const status = normalizeText(task.status);
      const clientLabel = task.client_name || "Sem cliente";
      if (doneStatuses.has(status)) {
        if (status === "done" && task.created_by && task.created_by === currentUserId) {
          return [
            {
              id: `task-${task.id}-completed-${task.updated_at || task.created_at}`,
              taskId: task.id,
              title: `Tarefa concluida: ${task.title}`,
              description: `${clientLabel} - a tarefa que voce criou foi concluida`,
              priority: "alta" as const,
              kind: "completed" as const,
              createdAt: task.updated_at || task.created_at,
            },
          ];
        }
        return [];
      }

      const hasDueDate = Boolean(task.due_date);
      const overdue = hasDueDate && (task.due_date as string) < today;
      const dueToday = hasDueDate && task.due_date === today;
      const isObligationTask = obligationTaskSources.has(normalizeText(task.integration_source));
      const unassigned = !isObligationTask && !normalizeText(task.assignee);

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

export const buildTaskEventNotifications = (
  comments: TaskEventNotificationRow[],
  currentUserId?: string | null,
): PriorityNotification[] =>
  comments
    .filter((comment) => comment.task && comment.user_id !== currentUserId)
    .flatMap((comment) => {
      const task = comment.task;
      if (!task) return [];

      const payload = parseJsonRecord(comment.content);
      const clientLabel = task.client_name || "Sem cliente";

      if (payload?.type === "task_sector_added") {
        const sectors = getPayloadSectors(payload);
        return [
          {
            id: `task-${comment.task_id}-sector-added-${comment.id}`,
            taskId: comment.task_id,
            title: `Setor adicionado: ${task.title}`,
            description: `${clientLabel} - ${sectors.length > 0 ? sectors.join(", ") : "novo setor vinculado"}`,
            priority: "media" as const,
            kind: "sector_added" as const,
            createdAt: comment.created_at,
          },
        ];
      }

      if (isInternalCommentPayload(payload)) {
        const text = getPayloadText(payload);
        return [
          {
            id: `task-${comment.task_id}-internal-${comment.id}`,
            taskId: comment.task_id,
            title: `Novo andamento interno: ${task.title}`,
            description: text || `${clientLabel} - arquivo interno anexado`,
            priority: "media" as const,
            kind: "internal_message" as const,
            createdAt: comment.created_at,
          },
        ];
      }

      if (isClientChatPayload(payload) || !payload) {
        const text = payload ? getPayloadText(payload) : comment.content.trim();
        return [
          {
            id: `task-${comment.task_id}-client-chat-${comment.id}`,
            taskId: comment.task_id,
            title: `Nova mensagem no chat do cliente: ${task.title}`,
            description: text || `${clientLabel} - arquivo anexado ao chat do cliente`,
            priority: "media" as const,
            kind: "client_chat" as const,
            createdAt: comment.created_at,
          },
        ];
      }

      return [];
    });
