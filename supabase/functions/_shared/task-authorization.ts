export const TASK_ACTIONS = [
  "task.create",
  "task.update_content",
  "task.change_status",
  "task.assign",
  "task.change_sector",
  "task.change_client",
  "task.manage_subtasks",
  "task.archive",
  "task.delete",
  "task.restore",
] as const;

export type TaskAction = (typeof TASK_ACTIONS)[number];
export type TaskActorKind = "human" | "system";

export interface DelegatedTaskActor {
  kind: "human";
  userId: string;
  source: string;
}

export interface SystemTaskActor {
  kind: "system";
  source: "grow_obligations" | "acessorias" | "whatsapp_webhook" | "calendar_sync";
  technicalLink: Record<string, string>;
  idempotencyKey: string;
}

export type TaskActor = DelegatedTaskActor | SystemTaskActor;

export interface TaskAuthorizationDecision {
  allowed: boolean;
  code: "allowed" | "task_not_available" | "action_not_allowed" | "integration_scope_invalid";
}

const taskActionSet = new Set<string>(TASK_ACTIONS);

export const isTaskAction = (value: unknown): value is TaskAction =>
  typeof value === "string" && taskActionSet.has(value);

export const hasValidSystemContext = (actor: SystemTaskActor) =>
  actor.idempotencyKey.trim().length >= 8 && Object.values(actor.technicalLink).some((value) => value.trim().length > 0);

export const assertDelegatedTaskAction = async (
  supabaseAdmin: { rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }> },
  input: { actor: DelegatedTaskActor; organizationId: string; taskId?: string | null; action: TaskAction },
) => {
  const { data, error } = await supabaseAdmin.rpc("authorize_task_action", {
    _actor_user_id: input.actor.userId,
    _organization_id: input.organizationId,
    _task_id: input.taskId ?? null,
    _action: input.action,
  });
  if (error) throw error;
  const decision = data as TaskAuthorizationDecision | null;
  if (!decision?.allowed) throw new Error(decision?.code || "task_not_available");
  return decision;
};
