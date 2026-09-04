import { useDeferredValue, useMemo, useState } from "react";
import { AlertTriangle, Download, Loader2, RefreshCw, Search } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { getInstallmentDocumentUrl } from "../api";
import { useInstallmentClients, useInstallmentDetail, useInstallments } from "../hooks/useInstallments";
import type { InstallmentAgreement, InstallmentEntry, InstallmentModality } from "../types";

const modalityLabels:Record<InstallmentModality,string>={PARCSN:"Simples", "PARCSN-ESP":"Simples Especial", PERTSN:"PERT Simples", RELPSN:"Relp Simples", PARCMEI:"MEI", "PARCMEI-ESP":"MEI Especial", PERTMEI:"PERT MEI", RELPMEI:"Relp MEI"};
const obligationLabels:Record<InstallmentModality,string>={PARCSN:"PGDAS-D / Simples Nacional", "PARCSN-ESP":"PGDAS-D / Simples Nacional", PERTSN:"PGDAS-D / Simples Nacional", RELPSN:"PGDAS-D / Simples Nacional", PARCMEI:"DAS-MEI / PGMEI", "PARCMEI-ESP":"DAS-MEI / PGMEI", PERTMEI:"DAS-MEI / PGMEI", RELPMEI:"DAS-MEI / PGMEI"};
const statusLabels:Record<string,string>={available:"Parcela disponível",issued:"Guia emitida",paid:"Paga",overdue:"Vencida",cancelled:"Cancelada",unknown:"Sem informação"};
const money=(value:number|null|undefined)=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(Number(value||0));
const shortDate=(value:string|null|undefined)=>value?new Intl.DateTimeFormat("pt-BR",{timeZone:"UTC"}).format(new Date(`${value.slice(0,10)}T12:00:00Z`)):"—";
const competence=(value:string)=>/^20\d{4}$/.test(value)?`${value.slice(4)}/${value.slice(0,4)}`:value;
const errorMessage=(error:unknown)=>{const code=error instanceof Error?error.message:"operation_failed";if(code.includes("INSTALLMENT_PROCURATION_REQUIRED"))return `A procuração eletrônica não cobre esta modalidade (${code.split(":").at(-1)?.replaceAll("|"," ou ")}).`;if(code==="INSTALLMENTS_FEATURE_DISABLED")return "O piloto de Parcelamentos ainda não foi habilitado para esta organização.";if(code==="INTEGRA_CONTADOR_CONNECTION_MISSING")return "Configure a conexão com o Integra Contador antes de sincronizar.";return `Não foi possível concluir a operação (${code}).`;};

type Props={organizationId:string;clientId?:string;embedded?:boolean};

export function InstallmentsSection({organizationId,clientId,embedded=false}:Props){
  const [clientFilter,setClientFilter]=useState(clientId||"all");
  const [modalityFilter,setModalityFilter]=useState("all");
  const [statusFilter,setStatusFilter]=useState("all");
  const [search,setSearch]=useState("");
  const [selectedId,setSelectedId]=useState<string|null>(null);
  const deferredSearch=useDeferredValue(search.trim().toLocaleLowerCase("pt-BR"));
  const filters={clientId:clientId||(clientFilter==="all"?undefined:clientFilter),modality:modalityFilter==="all"?undefined:modalityFilter,status:statusFilter==="all"?undefined:statusFilter};
  const {query,sync,issue,payment}=useInstallments(organizationId,filters);
  const clients=useInstallmentClients(organizationId);
  const detail=useInstallmentDetail(organizationId,selectedId);
  const agreements=useMemo(()=>(query.data||[]).filter((item)=>!deferredSearch||`${item.clients?.name||""} ${item.agreement_number}`.toLocaleLowerCase("pt-BR").includes(deferredSearch)),[query.data,deferredSearch]);
  const entries=detail.data?.fiscal_installment_entries||[];
  const runSync=(target:string)=>sync.mutate(target,{onSuccess:(result)=>{const errors=result.results.filter((item)=>item.error);if(errors.length){toast.warning(`Sincronização concluída com ${errors.length} modalidade(s) pendente(s).`);}else{toast.success("Parcelamentos atualizados.");}},onError:(error)=>toast.error(errorMessage(error))});
  const emit=(entry:InstallmentEntry)=>{if(!window.confirm(`Confirma a emissão do DAS da parcela ${competence(entry.period_key)}?`))return;issue.mutate(entry.id,{onSuccess:()=>toast.success("DAS emitido, arquivado e vinculado à tarefa."),onError:(error)=>toast.error(errorMessage(error))});};
  const download=async(entry:InstallmentEntry)=>{if(!entry.fiscal_document_id)return;try{window.open(await getInstallmentDocumentUrl(organizationId,entry.fiscal_document_id),"_blank","noopener,noreferrer");}catch(error){toast.error(errorMessage(error));}};
  return <div className="space-y-4">
    <div className="flex flex-col gap-3 border-y py-3 md:flex-row md:items-center">
      {!clientId?<Select value={clientFilter} onValueChange={setClientFilter}><SelectTrigger className="md:w-64"><SelectValue placeholder="Cliente"/></SelectTrigger><SelectContent><SelectItem value="all">Todos os clientes</SelectItem>{clients.data?.map((client)=><SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>)}</SelectContent></Select>:null}
      <Select value={modalityFilter} onValueChange={setModalityFilter}><SelectTrigger className="md:w-52"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">Todas as modalidades</SelectItem>{Object.entries(modalityLabels).map(([key,label])=><SelectItem key={key} value={key}>{label}</SelectItem>)}</SelectContent></Select>
      <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="md:w-48"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">Todas as situações</SelectItem><SelectItem value="Ativo">Ativos</SelectItem><SelectItem value="Encerrado">Encerrados</SelectItem></SelectContent></Select>
      <div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"/><Input value={search} onChange={(event)=>setSearch(event.target.value)} placeholder="Cliente ou número" className="pl-9"/></div>
      <Button variant="outline" disabled={sync.isPending||(!clientId&&clientFilter==="all")} onClick={()=>runSync(clientId||clientFilter)}>{sync.isPending?<Loader2 className="h-4 w-4 animate-spin"/>:<RefreshCw className="h-4 w-4"/>} Atualizar cliente</Button>
    </div>
    <div className="overflow-x-auto rounded-xl border"><table className="w-full min-w-[1120px] text-sm"><thead className="border-b bg-muted/30 text-left text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-4 py-3">Cliente</th><th className="px-4 py-3">Obrigação</th><th className="px-4 py-3">Modalidade / número</th><th className="px-4 py-3">Situação</th><th className="px-4 py-3 text-right">Saldo consolidado</th><th className="px-4 py-3 text-center">Restantes</th><th className="px-4 py-3">Próxima parcela</th><th className="px-4 py-3">Última sincronização</th></tr></thead><tbody>
      {query.isLoading?<tr><td colSpan={8} className="py-14 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin"/></td></tr>:agreements.length===0?<tr><td colSpan={8} className="py-14 text-center text-muted-foreground">Nenhum parcelamento sincronizado. Selecione um cliente e clique em Atualizar cliente.</td></tr>:agreements.map((agreement)=>{const available=agreement.fiscal_installment_entries?.find((entry)=>entry.available_for_issue);return <tr key={agreement.id} className="cursor-pointer border-b last:border-0 hover:bg-muted/25" onClick={()=>setSelectedId(agreement.id)}><td className="px-4 py-3 font-medium">{agreement.clients?.name||"Cliente"}</td><td className="px-4 py-3"><Badge variant="secondary" className="whitespace-nowrap">{obligationLabels[agreement.modality]}</Badge></td><td className="px-4 py-3"><p>{modalityLabels[agreement.modality]}</p><p className="text-xs text-muted-foreground">{agreement.agreement_number}</p></td><td className="px-4 py-3"><Badge variant="outline">{agreement.status}</Badge></td><td className="px-4 py-3 text-right tabular-nums">{money(agreement.total_consolidated)}</td><td className="px-4 py-3 text-center tabular-nums">{agreement.remaining_installments??"—"}</td><td className="px-4 py-3">{available?<span className="text-amber-700">{competence(available.period_key)} disponível</span>:"—"}</td><td className="px-4 py-3">{shortDate(agreement.last_synced_at)}</td></tr>;})}
    </tbody></table></div>
    <Sheet open={Boolean(selectedId)} onOpenChange={(open)=>!open&&setSelectedId(null)}><SheetContent className="w-full overflow-y-auto sm:max-w-2xl"><SheetHeader><SheetTitle>{detail.data?`${modalityLabels[detail.data.modality]} · ${detail.data.agreement_number}`:"Carregando parcelamento"}</SheetTitle><SheetDescription>Consolidação, parcelas, emissão assistida e evidências de pagamento.</SheetDescription></SheetHeader>
      {detail.isLoading?<Loader2 className="mx-auto mt-16 h-5 w-5 animate-spin"/>:<div className="mt-6 space-y-6"><dl className="grid grid-cols-2 gap-4 border-y py-4 text-sm"><div><dt className="text-muted-foreground">Obrigação</dt><dd className="font-medium">{detail.data?obligationLabels[detail.data.modality]:"—"}</dd></div><div><dt className="text-muted-foreground">Situação</dt><dd className="font-medium">{detail.data?.status}</dd></div><div><dt className="text-muted-foreground">Consolidado</dt><dd className="font-medium">{money(detail.data?.total_consolidated)}</dd></div><div><dt className="text-muted-foreground">Parcelas</dt><dd className="font-medium">{detail.data?.installment_count??"—"}</dd></div><div><dt className="text-muted-foreground">Remanescentes</dt><dd className="font-medium">{detail.data?.remaining_installments??"—"}</dd></div></dl>
        <div><h3 className="mb-2 text-sm font-semibold">Parcelas e pagamentos</h3><div className="divide-y rounded-lg border">{entries.length===0?<p className="p-4 text-sm text-muted-foreground">Nenhuma parcela retornada.</p>:entries.map((entry)=><div key={entry.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-medium">{competence(entry.period_key)} · {money(entry.amount)}</p><p className="text-xs text-muted-foreground">{statusLabels[entry.status]||entry.status}{entry.due_date?` · vence ${shortDate(entry.due_date)}`:" · vencimento ainda não informado"}</p></div><div className="flex gap-2">{entry.available_for_issue?<Button size="sm" disabled={issue.isPending} onClick={()=>emit(entry)}>Emitir DAS</Button>:null}{entry.fiscal_document_id?<Button size="sm" variant="outline" onClick={()=>void download(entry)}><Download className="h-4 w-4"/> DAS</Button>:null}<Button size="sm" variant="ghost" disabled={payment.isPending} onClick={()=>payment.mutate(entry.id,{onSuccess:(result)=>toast.success(result.paid?"Pagamento confirmado pelo SERPRO.":"Nenhum pagamento confirmado."),onError:(error)=>toast.error(errorMessage(error))})}><RefreshCw className="h-4 w-4"/> Pagamento</Button></div></div>)}</div></div>
        {detail.data?.last_error_code?<p className="flex gap-2 text-sm text-destructive"><AlertTriangle className="h-4 w-4"/>{detail.data.last_error_code}</p>:null}
      </div>}
    </SheetContent></Sheet>
  </div>;
}
