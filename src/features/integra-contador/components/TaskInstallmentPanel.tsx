import { Download, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getInstallmentDocumentUrl } from "../api";
import { useInstallmentDetail, useInstallments } from "../hooks/useInstallments";

type Payload={installment_entry_id?:string;agreement_id?:string;modality?:string;period_key?:string};
export function TaskInstallmentPanel({organizationId,integrationSource,integrationPayload}:{organizationId:string|null;integrationSource?:string|null;integrationPayload?:unknown}){
  const payload=(integrationPayload&&typeof integrationPayload==="object"?integrationPayload:{}) as Payload;
  const eligible=integrationSource==="integra_contador"&&Boolean(payload.installment_entry_id&&payload.agreement_id&&organizationId);
  const detail=useInstallmentDetail(organizationId,eligible?payload.agreement_id!:null);
  const {payment}=useInstallments(organizationId,{});
  if(!eligible)return null;
  const entry=detail.data?.fiscal_installment_entries?.find((item)=>item.id===payload.installment_entry_id);
  const openDas=async()=>{if(!entry?.fiscal_document_id||!organizationId)return;try{window.open(await getInstallmentDocumentUrl(organizationId,entry.fiscal_document_id),"_blank","noopener,noreferrer");}catch{toast.error("Não foi possível abrir o DAS.");}};
  return <section className="order-0 rounded-lg border bg-background p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex items-center gap-2"><h3 className="text-sm font-semibold">Parcela do acordo {detail.data?.agreement_number||""}</h3>{entry?<Badge variant="outline">{entry.status}</Badge>:null}</div><p className="mt-1 text-xs text-muted-foreground">Competência {payload.period_key?.slice(4)}/{payload.period_key?.slice(0,4)} · {payload.modality}</p></div>{detail.isLoading?<Loader2 className="h-4 w-4 animate-spin"/>:<div className="flex gap-2">{entry?.fiscal_document_id?<Button size="sm" variant="outline" onClick={()=>void openDas()}><Download className="h-4 w-4"/> Baixar DAS</Button>:null}{entry?<Button size="sm" variant="outline" disabled={payment.isPending} onClick={()=>payment.mutate(entry.id,{onSuccess:(result)=>toast.success(result.paid?"Pagamento confirmado pelo SERPRO.":"Pagamento ainda não localizado."),onError:()=>toast.error("Não foi possível consultar o pagamento.")})}><RefreshCw className="h-4 w-4"/> Consultar pagamento</Button>:null}</div>}</div></section>;
}
