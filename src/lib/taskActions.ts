import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import type { TaskCapability } from "@/lib/taskPermissions";

export type TaskMutationAction = Exclude<TaskCapability, "task.read" | "task.comment" | "task.relate">;
export interface TaskMutationItem { taskId?: string; expectedVersion?: number; changes: Record<string, Json | undefined> }
export type TaskMutationResult =
  | { ok: true; tasks: Array<Record<string, Json>>; auditId?: string; correlationId: string }
  | { ok: false; code: "invalid_request" | "task_not_available" | "version_conflict" | "mutation_failed"; correlationId?: string };

export async function mutateTasks(input: {
  action: TaskMutationAction;
  organizationId: string;
  items: TaskMutationItem[];
}): Promise<TaskMutationResult> {
  if (input.items.length < 1 || input.items.length > 100) return { ok: false, code: "invalid_request" };
  const { data, error } = await supabase.functions.invoke("task-actions", { body: input });
  if (error) {
    const context = (error as { context?: { json?: () => Promise<unknown> } }).context;
    const payload = context?.json ? await context.json().catch(() => null) : null;
    if (payload && typeof payload === "object" && "code" in payload) return payload as TaskMutationResult;
    return { ok: false, code: "mutation_failed" };
  }
  return data as TaskMutationResult;
}
