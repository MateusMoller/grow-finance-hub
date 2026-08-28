import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { generateDctfwebDarf, getDctfwebArtifactUrl, getTaskDarfInssContext } from "../api";

export function useTaskDarfInss(organizationId: string | null, taskId: string, enabled: boolean) {
  const queryClient = useQueryClient();
  const queryKey = ["integra-contador", organizationId || "none", "task-darf-inss", taskId] as const;
  const query = useQuery({
    queryKey,
    enabled: enabled && Boolean(organizationId && taskId),
    queryFn: () => getTaskDarfInssContext(organizationId!, taskId),
    staleTime: 30_000,
  });
  const generate = useMutation({
    mutationFn: (input: { dossierId: string; receiptNumber: string; targetInstanceId: string }) =>
      generateDctfwebDarf(organizationId!, input.dossierId, "transmitted", input.receiptNumber, input.targetInstanceId, taskId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });
  const openDarf = async (dossierId: string) => {
    const url = await getDctfwebArtifactUrl(organizationId!, dossierId, "darf");
    window.open(url, "_blank", "noopener,noreferrer");
  };
  return { query, generate, openDarf };
}
