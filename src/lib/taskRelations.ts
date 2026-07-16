import { supabase } from "@/integrations/supabase/client";

export interface RelatedTaskSummary {
  relationId: string;
  taskId: string;
  title: string;
  clientName: string | null;
  status: string | null;
  priority: string | null;
  dueDate: string | null;
}

export interface RelatedTaskOption {
  id: string;
  title: string;
  clientName: string | null;
  status: string | null;
  priority: string | null;
  dueDate: string | null;
}

type TaskRelationTable = {
  from: (table: "kanban_task_relations") => {
    select: (columns?: string) => TaskRelationQuery;
    insert: (payload: Record<string, unknown> | Record<string, unknown>[]) => TaskRelationMutation;
    delete: () => TaskRelationDelete;
  };
};

type TaskRelationQuery = {
  eq: (column: string, value: string) => TaskRelationQuery;
  or: (filters: string) => TaskRelationQuery;
  order: (column: string, options?: { ascending?: boolean }) => Promise<{
    data: TaskRelationRow[] | null;
    error: { message: string; code?: string } | null;
  }>;
};

type TaskRelationMutation = Promise<{
  error: { message: string; code?: string } | null;
}>;

type TaskRelationDelete = {
  eq: (column: string, value: string) => TaskRelationMutation;
};

interface TaskRelationRow {
  id: string;
  source_task_id: string;
  target_task_id: string;
}

interface RelatedTaskRow {
  id: string;
  title: string;
  client_name: string | null;
  status: string | null;
  priority: string | null;
  due_date: string | null;
}

const relationClient = supabase as unknown as TaskRelationTable;

export const toRelatedTaskOption = (task: {
  id: string;
  title: string;
  client?: string | null;
  client_name?: string | null;
  status?: string | null;
  priority?: string | null;
  dueDate?: string | null;
  due_date?: string | null;
}): RelatedTaskOption => ({
  id: task.id,
  title: task.title,
  clientName: task.client_name ?? task.client ?? null,
  status: task.status ?? null,
  priority: task.priority ?? null,
  dueDate: task.due_date ?? task.dueDate ?? null,
});

export const loadRelatedTasks = async (
  organizationId: string,
  taskId: string,
): Promise<RelatedTaskSummary[]> => {
  const { data: relations, error } = await relationClient
    .from("kanban_task_relations")
    .select("id, source_task_id, target_task_id")
    .eq("organization_id", organizationId)
    .or(`source_task_id.eq.${taskId},target_task_id.eq.${taskId}`)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const relationRows = relations || [];
  const relatedTaskIds = relationRows
    .map((relation) =>
      relation.source_task_id === taskId
        ? relation.target_task_id
        : relation.source_task_id,
    )
    .filter(Boolean);

  if (relatedTaskIds.length === 0) return [];

  const { data: tasks, error: tasksError } = await supabase
    .from("kanban_tasks")
    .select("id, title, client_name, status, priority, due_date")
    .in("id", relatedTaskIds);

  if (tasksError) {
    throw new Error(tasksError.message);
  }

  const taskMap = new Map(
    ((tasks || []) as RelatedTaskRow[]).map((task) => [task.id, task]),
  );

  return relationRows
    .map((relation) => {
      const relatedTaskId =
        relation.source_task_id === taskId
          ? relation.target_task_id
          : relation.source_task_id;
      const relatedTask = taskMap.get(relatedTaskId);
      if (!relatedTask) return null;

      return {
        relationId: relation.id,
        taskId: relatedTask.id,
        title: relatedTask.title,
        clientName: relatedTask.client_name,
        status: relatedTask.status,
        priority: relatedTask.priority,
        dueDate: relatedTask.due_date,
      };
    })
    .filter((task): task is RelatedTaskSummary => task !== null);
};

export const createTaskRelation = async ({
  organizationId,
  sourceTaskId,
  targetTaskId,
  createdBy,
}: {
  organizationId: string;
  sourceTaskId: string;
  targetTaskId: string;
  createdBy?: string | null;
}) => {
  if (sourceTaskId === targetTaskId) return;

  const { error } = await relationClient.from("kanban_task_relations").insert({
    organization_id: organizationId,
    source_task_id: sourceTaskId,
    target_task_id: targetTaskId,
    relation_type: "related",
    created_by: createdBy || null,
  });

  if (error && error.code !== "23505") {
    throw new Error(error.message);
  }
};

export const createTaskRelations = async ({
  organizationId,
  sourceTaskId,
  targetTaskIds,
  createdBy,
}: {
  organizationId: string;
  sourceTaskId: string;
  targetTaskIds: string[];
  createdBy?: string | null;
}) => {
  const uniqueTargetIds = [...new Set(targetTaskIds)].filter(
    (targetTaskId) => targetTaskId && targetTaskId !== sourceTaskId,
  );

  await Promise.all(
    uniqueTargetIds.map((targetTaskId) =>
      createTaskRelation({
        organizationId,
        sourceTaskId,
        targetTaskId,
        createdBy,
      }),
    ),
  );
};

export const deleteTaskRelation = async (relationId: string) => {
  const { error } = await relationClient
    .from("kanban_task_relations")
    .delete()
    .eq("id", relationId);

  if (error) {
    throw new Error(error.message);
  }
};
