import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  approveSimpleNationalDossier,
  generatePgdasdDas,
  getDefisArtifactUrl,
  getPgdasdArtifactUrl,
  getTaskSimpleNationalContext,
  previewPgdasd,
  saveSimpleNationalDossier,
  syncDefisDeclarations,
  syncPgdasdPreviousCompetence,
  transmitDefis,
  transmitPgdasd,
} from "../api";
import { integraContadorKeys } from "../queryKeys";

export function useTaskSimpleNationalDossier(organizationId: string | null, taskId: string | null, enabled: boolean) {
  const queryClient = useQueryClient();
  const queryKey = ["integra-contador", organizationId || "none", "task-simples", taskId || "none"] as const;
  const query = useQuery({
    queryKey,
    enabled: enabled && Boolean(organizationId && taskId),
    queryFn: () => getTaskSimpleNationalContext(organizationId!, taskId!),
    staleTime: 30_000,
  });
  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey }),
      organizationId
        ? queryClient.invalidateQueries({ queryKey: integraContadorKeys.simplesDossiers(organizationId) })
        : Promise.resolve(),
    ]);
  };
  const save = useMutation({
    mutationFn: (input: { dossierId: string; inputData: Record<string, unknown>; sourceManifest: Array<{ type: string; reference: string }> }) =>
      saveSimpleNationalDossier(organizationId!, input.dossierId, input.inputData, input.sourceManifest),
    onSuccess: invalidate,
  });
  const preview = useMutation({ mutationFn: (dossierId: string) => previewPgdasd(organizationId!, dossierId), onSuccess: invalidate });
  const syncPreviousCompetence = useMutation({ mutationFn: (dossierId: string) => syncPgdasdPreviousCompetence(organizationId!, dossierId), onSuccess: invalidate });
  const approve = useMutation({
    mutationFn: (input: { dossierId: string; expectedVersion: number }) => approveSimpleNationalDossier(organizationId!, input.dossierId, input.expectedVersion),
    onSuccess: invalidate,
  });
  const transmit = useMutation({ mutationFn: (dossierId: string) => transmitPgdasd(organizationId!, dossierId), onSuccess: invalidate });
  const transmitDefisDeclaration = useMutation({ mutationFn: (dossierId: string) => transmitDefis(organizationId!, dossierId), onSuccess: invalidate });
  const syncDefis = useMutation({ mutationFn: (dossierId: string) => syncDefisDeclarations(organizationId!, dossierId), onSuccess: invalidate });
  const generateDas = useMutation({ mutationFn: (dossierId: string) => generatePgdasdDas(organizationId!, dossierId), onSuccess: invalidate });
  const openArtifact = async (dossierId: string, artifact: "declaration" | "receipt" | "das") => {
    const dossier = query.data?.dossier;
    const url = dossier?.obligation_kind === "defis" && artifact !== "das"
      ? await getDefisArtifactUrl(organizationId!, dossierId, artifact)
      : await getPgdasdArtifactUrl(organizationId!, dossierId, artifact);
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return { query, save, preview, syncPreviousCompetence, approve, transmit, transmitDefis: transmitDefisDeclaration, syncDefis, generateDas, openArtifact };
}
