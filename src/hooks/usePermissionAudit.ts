import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export interface PermissionAuditEntry {
  id: string;
  organization_id: string;
  actor_user_id: string | null;
  actor_name: string | null;
  target_user_id: string;
  target_name: string | null;
  action: string;
  previous_value: unknown;
  new_value: unknown;
  reason: string | null;
  result: "success" | "denied";
  created_at: string;
}

export const formatPermissionAuditValue = (value: unknown) => {
  if (value === null || value === undefined) return "-";
  if (typeof value === "string") return value || "-";
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value) && value.length === 0) return "[]";
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

export function usePermissionAudit(
  organizationId: string | null,
  filters: { action: string; page: number; pageSize: number },
) {
  return useQuery({
    queryKey: ["permission-audit", organizationId, filters],
    enabled: Boolean(organizationId),
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_list_permission_audit", {
        _organization_id: organizationId,
        _target_user_id: null,
        _actor_user_id: null,
        _action: filters.action === "all" ? null : filters.action,
        _date_from: null,
        _date_to: null,
        _page: filters.page,
        _page_size: filters.pageSize,
      });
      if (error) throw error;
      const payload = (data || {}) as { items?: PermissionAuditEntry[]; total?: number };
      return {
        items: payload.items || [],
        total: Number(payload.total || 0),
      };
    },
  });
}
