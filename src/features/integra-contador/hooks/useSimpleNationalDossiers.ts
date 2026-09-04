import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { approveSimpleNationalDossier, createSimpleNationalDossier, generatePgdasdDas, getDefisArtifactUrl, getPgdasdArtifactUrl, listSimpleNationalClients, listSimpleNationalDossiers, previewPgdasd, requestSimpleNationalTransmission, saveSimpleNationalDossier, syncDefisAnnualValues, syncDefisDeclarations, syncPgdasdPreviousCompetence, transmitDefis, transmitPgdasd } from "../api";
import { integraContadorKeys } from "../queryKeys";

export function useSimpleNationalDossiers(organizationId: string | null) {
  const queryClient = useQueryClient();
  const queryKey = organizationId ? integraContadorKeys.simplesDossiers(organizationId) : ["integra-contador", "none", "simples-nacional"] as const;
  const invalidate = () => queryClient.invalidateQueries({ queryKey });
  const query = useQuery({ queryKey, enabled: Boolean(organizationId), queryFn: () => listSimpleNationalDossiers(organizationId!) });
  const clients = useQuery({ queryKey: organizationId ? integraContadorKeys.simplesClients(organizationId) : ["integra-contador", "none", "simples-clients"], enabled: Boolean(organizationId), queryFn: () => listSimpleNationalClients(organizationId!) });
  const create = useMutation({ mutationFn: (input: Parameters<typeof createSimpleNationalDossier>[1]) => createSimpleNationalDossier(organizationId!, input), onSuccess: invalidate });
  const save = useMutation({ mutationFn: (input: { dossierId: string; inputData: Record<string, unknown>; sourceManifest: Array<{ type: string; reference: string }> }) => saveSimpleNationalDossier(organizationId!, input.dossierId, input.inputData, input.sourceManifest), onSuccess: invalidate });
  const approve = useMutation({ mutationFn: (input: { dossierId: string; expectedVersion: number }) => approveSimpleNationalDossier(organizationId!, input.dossierId, input.expectedVersion), onSuccess: invalidate });
  const requestTransmission = useMutation({ mutationFn: (dossierId: string) => requestSimpleNationalTransmission(organizationId!, dossierId), onSuccess: invalidate });
  const preview = useMutation({ mutationFn: (dossierId: string) => previewPgdasd(organizationId!, dossierId), onSuccess: invalidate });
  const syncPreviousCompetence = useMutation({ mutationFn: (dossierId: string) => syncPgdasdPreviousCompetence(organizationId!, dossierId), onSuccess: invalidate });
  const transmit = useMutation({ mutationFn: (dossierId: string) => transmitPgdasd(organizationId!, dossierId), onSuccess: invalidate });
  const transmitDefisDeclaration = useMutation({ mutationFn: (dossierId: string) => transmitDefis(organizationId!, dossierId), onSuccess: invalidate });
  const syncDefis = useMutation({ mutationFn: (dossierId: string) => syncDefisDeclarations(organizationId!, dossierId), onSuccess: invalidate });
  const syncDefisAnnual = useMutation({ mutationFn: (dossierId: string) => syncDefisAnnualValues(organizationId!, dossierId), onSuccess: invalidate });
  const generateDas = useMutation({ mutationFn: (dossierId: string) => generatePgdasdDas(organizationId!, dossierId), onSuccess: invalidate });
  const openArtifact = async (dossierId: string, artifact: "declaration" | "receipt" | "das") => {
    const dossier = query.data?.find((item) => item.id === dossierId);
    const url = dossier?.obligation_kind === "defis" && artifact !== "das"
      ? await getDefisArtifactUrl(organizationId!, dossierId, artifact)
      : await getPgdasdArtifactUrl(organizationId!, dossierId, artifact);
    window.open(url, "_blank", "noopener,noreferrer");
  };
  return { query, clients, create, save, approve, requestTransmission, preview, syncPreviousCompetence, transmit, transmitDefis: transmitDefisDeclaration, syncDefis, syncDefisAnnual, generateDas, openArtifact };
}
