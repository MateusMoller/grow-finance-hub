import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getTaskMitContext, saveMitDebts, submitMit, validateMit, verifyMit } from "../api";
import type { MitDebt } from "../types";

export function useTaskMitDossier(organizationId:string|null,taskId:string,enabled:boolean) {
  const queryClient=useQueryClient();
  const key=["integra-contador",organizationId||"none","task-mit",taskId] as const;
  const query=useQuery({queryKey:key,enabled:enabled&&Boolean(organizationId&&taskId),queryFn:()=>getTaskMitContext(organizationId!,taskId),staleTime:15_000});
  const invalidate=()=>queryClient.invalidateQueries({queryKey:key});
  const save=useMutation({mutationFn:(input:{dossierId:string;debts:MitDebt[]})=>saveMitDebts(organizationId!,input.dossierId,input.debts),onSuccess:invalidate});
  const validate=useMutation({mutationFn:(dossierId:string)=>validateMit(organizationId!,dossierId),onSuccess:invalidate});
  const submit=useMutation({mutationFn:(dossierId:string)=>submitMit(organizationId!,dossierId,taskId),onSuccess:invalidate});
  const verify=useMutation({mutationFn:(dossierId:string)=>verifyMit(organizationId!,dossierId,taskId),onSuccess:invalidate});
  return {query,save,validate,submit,verify};
}
