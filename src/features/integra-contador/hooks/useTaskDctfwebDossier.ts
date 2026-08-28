import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { approveDctfweb, consultDctfwebArtifact, getDctfwebArtifactUrl, getTaskDctfwebContext, transmitDctfweb } from "../api";
export function useTaskDctfwebDossier(organizationId:string|null,taskId:string,enabled:boolean){
 const client=useQueryClient(); const key=["integra-contador",organizationId||"none","task-dctfweb",taskId] as const;
 const query=useQuery({queryKey:key,enabled:enabled&&Boolean(organizationId&&taskId),queryFn:()=>getTaskDctfwebContext(organizationId!,taskId),staleTime:30_000});
 const invalidate=()=>client.invalidateQueries({queryKey:key});
 const consult=useMutation({mutationFn:(input:{dossierId:string;artifact:"xml"|"receipt"|"report";receiptNumber?:string})=>consultDctfwebArtifact(organizationId!,input.dossierId,input.artifact,input.receiptNumber),onSuccess:invalidate});
 const approve=useMutation({mutationFn:(input:{dossierId:string;expectedVersion:number})=>approveDctfweb(organizationId!,input.dossierId,input.expectedVersion),onSuccess:invalidate});
 const transmit=useMutation({mutationFn:(input:{dossierId:string;signedXmlBase64:string})=>transmitDctfweb(organizationId!,input.dossierId,input.signedXmlBase64),onSuccess:invalidate});
 const openArtifact=async(dossierId:string,artifact:"xml"|"receipt"|"report"|"darf")=>window.open(await getDctfwebArtifactUrl(organizationId!,dossierId,artifact),"_blank","noopener,noreferrer");
 return {query,consult,approve,transmit,openArtifact};
}
