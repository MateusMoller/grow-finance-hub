import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getClientCnd, getClientCndPdfUrl, issueClientCnd } from "../api";

export function useClientCnd(organizationId:string,clientId:string,enabled=true){
  const queryClient=useQueryClient();
  const key=["integra-contador",organizationId,clientId,"cnd"] as const;
  const query=useQuery({queryKey:key,enabled:Boolean(enabled&&organizationId&&clientId),queryFn:()=>getClientCnd(organizationId,clientId),staleTime:30_000});
  const issue=useMutation({mutationFn:()=>issueClientCnd(organizationId,clientId),onSuccess:()=>queryClient.invalidateQueries({queryKey:key,exact:true})});
  const openPdf=async(certificateId:string)=>window.open(await getClientCndPdfUrl(organizationId,clientId,certificateId),"_blank","noopener,noreferrer");
  return {query,issue,openPdf};
}
