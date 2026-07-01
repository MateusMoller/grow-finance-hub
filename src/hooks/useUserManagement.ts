import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { ModuleKey, PrimaryRole, SectorCode, UserStatus } from "@/lib/userPermissions";

export interface ManagedUser {
  organization_id: string;
  user_id: string;
  email: string | null;
  display_name: string | null;
  primary_role: PrimaryRole;
  status: UserStatus;
  sector_code: SectorCode | null;
  requires_access_review: boolean;
  enabled_modules: ModuleKey[];
  linked_clients: Array<{ client_id: string; name: string; status: string }>;
  created_at: string;
  updated_at: string;
}

export interface UserFilters {
  search: string;
  role: PrimaryRole | "all";
  sectorCode: SectorCode | "all";
  status: UserStatus | "all";
  moduleKey: ModuleKey | "all";
  page: number;
  pageSize: number;
}

export interface UserAccessInput {
  userId?: string;
  displayName: string;
  email?: string;
  password?: string;
  primaryRole: PrimaryRole;
  status: UserStatus;
  sectorCode: SectorCode | null;
  enabledModules: ModuleKey[];
  linkedClientIds: string[];
  changeReason?: string;
}

const readFunctionError = async (error: unknown) => {
  if (error && typeof error === "object" && "context" in error) {
    try {
      const context = (error as { context?: Response }).context;
      const body = await context?.clone().json();
      if (body?.error) return String(body.error);
    } catch {
      // Fall through to the standard message.
    }
  }
  return error instanceof Error ? error.message : "Não foi possível concluir a operação.";
};

const readAccessResult = (data: unknown) => {
  const payload = data as { ok?: boolean; code?: string } | null;
  if (payload?.ok === false) {
    throw new Error(payload.code || "Não foi possível salvar as permissões.");
  }
  return data;
};

export function useUserManagement(organizationId: string | null, filters: UserFilters) {
  const queryClient = useQueryClient();
  const queryKey = ["user-management", organizationId, filters] as const;

  const usersQuery = useQuery({
    queryKey,
    enabled: Boolean(organizationId),
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_list_user_access", {
        _organization_id: organizationId,
        _search: filters.search.trim() || null,
        _role: filters.role === "all" ? null : filters.role,
        _sector_code: filters.sectorCode === "all" ? null : filters.sectorCode,
        _status: filters.status === "all" ? null : filters.status,
        _module_key: filters.moduleKey === "all" ? null : filters.moduleKey,
        _client_id: null,
        _requires_access_review: null,
        _page: filters.page,
        _page_size: filters.pageSize,
      });
      if (error) throw error;
      const payload = (data || {}) as { items?: ManagedUser[]; total?: number };
      return {
        items: payload.items || [],
        total: Number(payload.total || 0),
      };
    },
  });

  const clientsQuery = useQuery({
    queryKey: ["user-management-clients", organizationId],
    enabled: Boolean(organizationId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name")
        .eq("organization_id", organizationId)
        .neq("status", "Inativo")
        .order("name");
      if (error) throw error;
      return (data || []) as Array<{ id: string; name: string }>;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (input: UserAccessInput) => {
      if (!organizationId) {
        throw new Error("Organização não encontrada.");
      }

      if (input.userId) {
        const { data, error } = await supabase.functions.invoke("manage-team-user", {
          body: {
            action: "update",
            organizationId,
            userId: input.userId,
            displayName: input.displayName,
            primaryRole: input.primaryRole,
            status: input.status,
            sectorCode: input.sectorCode,
            enabledModules: input.enabledModules,
            linkedClientIds: input.linkedClientIds,
            changeReason: input.changeReason,
          },
        });
        if (error) throw new Error(await readFunctionError(error));
        return readAccessResult(data);
      }

      const { data, error } = await supabase.functions.invoke("create-team-user", {
        body: {
          organizationId,
          displayName: input.displayName,
          email: input.email,
          password: input.password,
          primaryRole: input.primaryRole,
          status: input.status,
          sectorCode: input.sectorCode,
          enabledModules: input.enabledModules,
          linkedClientIds: input.linkedClientIds,
          changeReason: input.changeReason,
        },
      });
      if (error) throw new Error(await readFunctionError(error));
      return data;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["user-management", organizationId] }),
        queryClient.invalidateQueries({ queryKey: ["permission-audit", organizationId] }),
      ]);
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { data, error } = await supabase.functions.invoke("manage-team-user", {
        body: { action: "deactivate", organizationId, userId },
      });
      if (error) throw new Error(await readFunctionError(error));
      return data;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["user-management", organizationId] }),
        queryClient.invalidateQueries({ queryKey: ["permission-audit", organizationId] }),
      ]);
    },
  });

  return {
    usersQuery,
    clientsQuery,
    saveMutation,
    deactivateMutation,
  };
}
