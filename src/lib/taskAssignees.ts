import { supabase } from "@/integrations/supabase/client";
import {
  SECTOR_LABELS,
  normalizeSectorCode,
  type SectorCode,
} from "@/lib/userPermissions";

export interface TaskAssigneeOption {
  id: string;
  name: string;
  sectorCode: SectorCode | null;
  sectorLabel: string | null;
}

export const formatTaskAssigneeLabel = (option: TaskAssigneeOption) =>
  option.sectorLabel ? `${option.name} - ${option.sectorLabel}` : option.name;

const roleToSectorCode = (role: string | null | undefined): SectorCode | null => {
  if (role === "commercial") return "comercial";
  if (role === "employee") return "geral";
  return normalizeSectorCode(role);
};

export async function loadTaskAssignees(
  organizationId: string | null,
): Promise<TaskAssigneeOption[]> {
  if (!organizationId) return [];

  const { data, error } = await supabase.rpc("list_task_assignees", {
    _organization_id: organizationId,
  });

  if (error) throw error;

  const rows = (data || []) as Array<{
    user_id: string;
    display_name: string | null;
    sector_code?: string | null;
  }>;

  const userIdsWithoutSector = rows
    .filter((row) => !normalizeSectorCode(row.sector_code))
    .map((row) => String(row.user_id));

  const sectorByUserId = new Map<string, SectorCode>();

  if (userIdsWithoutSector.length > 0) {
    const [accessResult, legacyRoleResult] = await Promise.all([
      supabase
        .from("organization_user_access")
        .select("user_id, sector_code")
        .eq("organization_id", organizationId)
        .in("user_id", userIdsWithoutSector),
      supabase
        .from("user_roles")
        .select("user_id, role")
        .eq("organization_id", organizationId)
        .in("user_id", userIdsWithoutSector),
    ]);

    if (!accessResult.error) {
      (accessResult.data || []).forEach((row) => {
        const sectorCode = normalizeSectorCode(row.sector_code);
        if (sectorCode) sectorByUserId.set(String(row.user_id), sectorCode);
      });
    }

    if (!legacyRoleResult.error) {
      (legacyRoleResult.data || []).forEach((row) => {
        if (sectorByUserId.has(String(row.user_id))) return;
        const sectorCode = roleToSectorCode(String(row.role || ""));
        if (sectorCode) sectorByUserId.set(String(row.user_id), sectorCode);
      });
    }
  }

  return rows.map((row) => {
    const id = String(row.user_id);
    const sectorCode = normalizeSectorCode(row.sector_code) || sectorByUserId.get(id) || null;

    return {
      id,
      name: row.display_name || "Colaborador",
      sectorCode,
      sectorLabel: sectorCode ? SECTOR_LABELS[sectorCode] : null,
    };
  });
}
