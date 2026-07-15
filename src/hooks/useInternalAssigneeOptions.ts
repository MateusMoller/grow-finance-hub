import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export interface InternalAssigneeOption {
  userId: string;
  displayName: string;
}

const resolveDisplayName = (displayName: string | null, userId: string) => {
  const normalized = displayName?.trim();
  if (normalized) return normalized;
  return `Usuario ${userId.slice(0, 6)}`;
};

export function useInternalAssigneeOptions() {
  const { currentOrganizationId } = useAuth();

  const query = useQuery({
    queryKey: ["internal-assignee-options", currentOrganizationId],
    enabled: Boolean(currentOrganizationId),
    staleTime: 60_000,
    queryFn: async (): Promise<InternalAssigneeOption[]> => {
      if (!currentOrganizationId) return [];

      const { data, error } = await supabase.rpc("list_internal_user_profiles_by_org", {
        organization_id: currentOrganizationId,
      });

      if (error) throw error;

      return ((data || []) as Array<{ user_id: string; display_name: string | null }>).map((item) => ({
        userId: item.user_id,
        displayName: resolveDisplayName(item.display_name, item.user_id),
      }));
    },
  });

  return {
    ...query,
    assigneeOptions: query.data || [],
    loadingAssignees: query.isLoading || query.isFetching,
  };
}
