import { supabase } from "@/integrations/supabase/client";

export interface TaskAssigneeOption {
  id: string;
  name: string;
}

export async function loadTaskAssignees(
  organizationId: string | null,
): Promise<TaskAssigneeOption[]> {
  if (!organizationId) return [];

  const { data, error } = await supabase.rpc("list_task_assignees", {
    _organization_id: organizationId,
  });

  if (error) throw error;

  return (
    (data || []) as Array<{ user_id: string; display_name: string | null }>
  ).map((row) => ({
    id: String(row.user_id),
    name: row.display_name || "Colaborador",
  }));
}
