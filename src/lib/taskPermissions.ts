import type { EffectiveAccess } from "@/lib/userPermissions";
import { normalizeSectorCode } from "@/lib/userPermissions";

export const TASK_CAPABILITIES = [
  "task.read",
  "task.create",
  "task.update_content",
  "task.change_status",
  "task.assign",
  "task.change_sector",
  "task.change_client",
  "task.manage_subtasks",
  "task.comment",
  "task.relate",
  "task.archive",
  "task.delete",
  "task.restore",
] as const;

export type TaskCapability = (typeof TASK_CAPABILITIES)[number];
export type TaskPermissionReason =
  | "allowed"
  | "access_inactive"
  | "access_review_required"
  | "module_not_granted"
  | "task_not_available"
  | "action_not_allowed";

export interface TaskPermissionContext {
  organizationId: string;
  sector?: string | null;
  deletedAt?: string | null;
}

export interface TaskPermissionDecision {
  allowed: boolean;
  reason: TaskPermissionReason;
}

const ADMIN_CAPABILITIES = new Set<TaskCapability>(TASK_CAPABILITIES);
const COLLABORATOR_CAPABILITIES = new Set<TaskCapability>([
  "task.read",
  "task.create",
  "task.update_content",
  "task.change_status",
  "task.manage_subtasks",
  "task.comment",
  "task.relate",
]);

export function decideTaskCapability(
  access: EffectiveAccess | null,
  capability: TaskCapability,
  task?: TaskPermissionContext,
): TaskPermissionDecision {
  if (!access || access.status !== "active") return { allowed: false, reason: "access_inactive" };
  if (access.requiresAccessReview) return { allowed: false, reason: "access_review_required" };
  if (task && task.organizationId !== access.organizationId) return { allowed: false, reason: "task_not_available" };
  if (access.primaryRole === "admin") {
    if (task?.deletedAt && capability !== "task.restore" && capability !== "task.read") {
      return { allowed: false, reason: "action_not_allowed" };
    }
    return { allowed: ADMIN_CAPABILITIES.has(capability), reason: "allowed" };
  }
  if (access.primaryRole !== "colaborador" || !access.enabledModules.includes("tarefas")) {
    return { allowed: false, reason: "module_not_granted" };
  }
  if (capability === "task.create") return { allowed: true, reason: "allowed" };
  if (!task || !access.sectorCode || normalizeSectorCode(task.sector) !== access.sectorCode || task.deletedAt) {
    return { allowed: false, reason: "task_not_available" };
  }
  const allowed = COLLABORATOR_CAPABILITIES.has(capability);
  return { allowed, reason: allowed ? "allowed" : "action_not_allowed" };
}

export const canTask = (
  access: EffectiveAccess | null,
  capability: TaskCapability,
  task?: TaskPermissionContext,
) => decideTaskCapability(access, capability, task).allowed;
