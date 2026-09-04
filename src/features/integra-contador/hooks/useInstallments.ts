import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getInstallmentDetail, issueInstallmentDas, listInstallmentClients, listInstallments, syncInstallmentPayment, syncInstallmentsClient } from "../api";

export function useInstallments(organizationId:string|null, filters:Record<string,unknown> = {}) {
  const queryClient = useQueryClient();
  const queryKey = ["integra-contador", organizationId || "none", "installments", filters] as const;
  const query = useQuery({ queryKey, enabled:Boolean(organizationId), queryFn:()=>listInstallments(organizationId!, filters) });
  const refresh = () => queryClient.invalidateQueries({queryKey:["integra-contador",organizationId,"installments"]});
  const sync = useMutation({mutationFn:(clientId:string)=>syncInstallmentsClient(organizationId!,clientId),onSuccess:refresh});
  const issue = useMutation({mutationFn:(entryId:string)=>issueInstallmentDas(organizationId!,entryId),onSuccess:refresh});
  const payment = useMutation({mutationFn:(entryId:string)=>syncInstallmentPayment(organizationId!,entryId),onSuccess:refresh});
  return {query,sync,issue,payment};
}

export function useInstallmentDetail(organizationId:string|null,agreementId:string|null){return useQuery({queryKey:["integra-contador",organizationId||"none","installment",agreementId||"none"],enabled:Boolean(organizationId&&agreementId),queryFn:()=>getInstallmentDetail(organizationId!,agreementId!)});}
export function useInstallmentClients(organizationId:string|null){return useQuery({queryKey:["integra-contador",organizationId||"none","installment-clients"],enabled:Boolean(organizationId),queryFn:()=>listInstallmentClients(organizationId!)});}
