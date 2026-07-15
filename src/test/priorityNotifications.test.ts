import { describe, expect, it } from "vitest";
import { buildPriorityNotifications, buildTaskEventNotifications } from "@/lib/priorityNotifications";

const baseTask = {
  id: "task-1",
  title: "Inserir parcelamento - PGFN",
  due_date: null,
  status: "todo",
  assignee: null,
  client_name: "Cliente teste",
  created_at: "2026-07-13T12:00:00.000Z",
  created_by: "creator-user",
  updated_at: "2026-07-13T13:00:00.000Z",
  integration_source: null,
};

describe("buildPriorityNotifications", () => {
  it("keeps unassigned alerts for manual tasks", () => {
    const notifications = buildPriorityNotifications([baseTask]);

    expect(notifications.some((notification) => notification.kind === "unassigned")).toBe(true);
  });

  it("does not require an assignee for obligation tasks", () => {
    const notifications = buildPriorityNotifications([
      {
        ...baseTask,
        integration_source: "grow_obligation_task",
      },
    ]);

    expect(notifications.some((notification) => notification.kind === "unassigned")).toBe(false);
  });

  it("notifies the task creator when a task is completed", () => {
    const notifications = buildPriorityNotifications([
      {
        ...baseTask,
        status: "done",
      },
    ], "creator-user");

    expect(notifications).toEqual([
      expect.objectContaining({
        kind: "completed",
        title: "Tarefa concluida: Inserir parcelamento - PGFN",
      }),
    ]);
  });

  it("does not notify other users when a task is completed", () => {
    const notifications = buildPriorityNotifications([
      {
        ...baseTask,
        status: "done",
      },
    ], "other-user");

    expect(notifications).toHaveLength(0);
  });
});

describe("buildTaskEventNotifications", () => {
  const baseComment = {
    id: "comment-1",
    task_id: "task-1",
    user_id: "other-user",
    content: "Mensagem para o cliente",
    created_at: "2026-07-13T13:00:00.000Z",
    task: {
      id: "task-1",
      title: "Regularizacao empresa",
      client_name: "Cliente teste",
      due_date: null,
      created_at: "2026-07-13T12:00:00.000Z",
    },
  };

  it("creates notifications for client chat, internal progress and added sectors", () => {
    const notifications = buildTaskEventNotifications([
      baseComment,
      {
        ...baseComment,
        id: "comment-2",
        content: JSON.stringify({ type: "task_internal_message", text: "Validacao interna feita." }),
      },
      {
        ...baseComment,
        id: "comment-3",
        content: JSON.stringify({ type: "task_sector_added", sectors: ["Fiscal"], text: "Setor adicionado: Fiscal" }),
      },
    ], "current-user");

    expect(notifications.map((notification) => notification.kind)).toEqual([
      "client_chat",
      "internal_message",
      "sector_added",
    ]);
  });

  it("does not notify the user who created the event", () => {
    const notifications = buildTaskEventNotifications([
      {
        ...baseComment,
        user_id: "current-user",
      },
    ], "current-user");

    expect(notifications).toHaveLength(0);
  });
});
