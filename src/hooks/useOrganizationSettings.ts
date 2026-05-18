import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  normalizeFeatureFlags,
  organizationFeatureDefaults,
  type OrganizationFeatureKey,
} from "@/lib/organizationFeatures";

type OrganizationSettings = {
  featureFlags: Record<OrganizationFeatureKey, boolean>;
};

export function useOrganizationSettings() {
  const { currentOrganizationId } = useAuth();

  const query = useQuery({
    queryKey: ["organization-settings", currentOrganizationId],
    enabled: Boolean(currentOrganizationId),
    queryFn: async (): Promise<OrganizationSettings> => {
      if (!currentOrganizationId) {
        return { featureFlags: organizationFeatureDefaults };
      }

      const { data, error } = await supabase
        .from("organization_settings")
        .select("feature_flags")
        .eq("organization_id", currentOrganizationId)
        .maybeSingle();

      if (error) throw error;

      return {
        featureFlags: normalizeFeatureFlags(data?.feature_flags),
      };
    },
  });

  return {
    ...query,
    featureFlags: query.data?.featureFlags || organizationFeatureDefaults,
    isFeatureEnabled: (feature: OrganizationFeatureKey) =>
      (query.data?.featureFlags || organizationFeatureDefaults)[feature] !== false,
  };
}
