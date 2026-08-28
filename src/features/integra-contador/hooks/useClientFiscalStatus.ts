import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getClientFiscalStatus, syncClientFiscalStatus } from "../api";
import { integraContadorKeys } from "../queryKeys";
const activeStatuses=new Set(["queued","processing","waiting_external"]);
export function useClientFiscalStatus(organizationId:string|null,clientId:string,enabled=true){
  const qc=useQueryClient();const key=organizationId?integraContadorKeys.clientFiscalStatus(organizationId,clientId):["integra-contador","none",clientId,"fiscal-status"] as const;
  const query=useQuery({queryKey:key,enabled:Boolean(organizationId&&clientId&&enabled),queryFn:()=>getClientFiscalStatus(organizationId!,clientId),refetchInterval:(state)=>activeStatuses.has(state.state.data?.run?.status||"")?3000:false});
  const sync=useMutation({mutationFn:(forceRefresh=false)=>syncClientFiscalStatus(organizationId!,clientId,forceRefresh),onSuccess:()=>qc.invalidateQueries({queryKey:key,exact:true})});
  return {query,sync};
}
