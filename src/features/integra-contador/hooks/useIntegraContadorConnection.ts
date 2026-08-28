import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { configureConnection, getConnectionStatus, testConnection } from "../api";
import { integraContadorKeys } from "../queryKeys";

export function useIntegraContadorConnection(organizationId: string | null) {
  const queryClient = useQueryClient();
  const key = organizationId ? integraContadorKeys.connection(organizationId) : ["integra-contador", "none", "connection"] as const;
  const refresh = () => queryClient.invalidateQueries({ queryKey: key, exact: true });
  const statusQuery = useQuery({ queryKey: key, enabled: Boolean(organizationId), queryFn: () => getConnectionStatus(organizationId!) });
  const configureMutation = useMutation({ mutationFn: configureConnection, onSuccess: refresh });
  const testMutation = useMutation({ mutationFn: () => testConnection(organizationId!), onSuccess: refresh });
  return { statusQuery, configureMutation, testMutation };
}
