import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, Plus, RefreshCw, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTaskMitDossier } from "../hooks/useTaskMitDossier";
import type { MitDebt } from "../types";

type Props={organizationId:string|null;taskId:string;integrationSource?:string|null};
const emptyDebt=():MitDebt=>({revenue_code:"",description:"",debit_amount:0,due_date:null,establishment_cnpj:null,source:"manual"});
const statusLabel:Record<string,string>={draft:"Rascunho",ready_for_validation:"Aguardando validação",validated:"Validada",submitting:"Enviando",processing:"Em processamento",transmitted:"Transmitida; aguardando conferência",verified:"Transmissão confirmada",requires_action:"Requer correção",transmission_unknown:"Situação desconhecida"};

export function TaskMitPanel({organizationId,taskId,integrationSource}:Props) {
  const workflow=useTaskMitDossier(organizationId,taskId,integrationSource==="grow_obligation_task");
  const dossier=workflow.query.data?.dossier;
  const [debts,setDebts]=useState<MitDebt[]>([]);
  useEffect(()=>{if(workflow.query.data?.debts)setDebts(workflow.query.data.debts);},[workflow.query.data?.debts]);
  if(integrationSource!=="grow_obligation_task"||workflow.query.isLoading)return null;
  if(workflow.query.isError)return <Alert variant="destructive" className="order-0"><AlertDescription>Não foi possível preparar o fluxo da MIT.</AlertDescription></Alert>;
  if(!workflow.query.data?.eligible||!dossier)return null;
  const busy=workflow.save.isPending||workflow.validate.isPending||workflow.submit.isPending||workflow.verify.isPending;
  const editable=["draft","ready_for_validation","validated","requires_action"].includes(dossier.status);
  const updateDebt=(index:number,patch:Partial<MitDebt>)=>setDebts((current)=>current.map((debt,itemIndex)=>itemIndex===index?{...debt,...patch}:debt));
  const run=(operation:Promise<unknown>,success:string,error:string)=>void operation.then(()=>toast.success(success)).catch((cause)=>toast.error(error,{description:cause instanceof Error?cause.message:undefined}));
  return <section className="order-0 space-y-4 rounded-xl border border-violet-200 bg-violet-50/60 p-4" aria-labelledby={`mit-task-${taskId}`}>
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 id={`mit-task-${taskId}`} className="font-semibold">MIT — Módulo de Inclusão de Tributos</h3><p className="text-xs text-muted-foreground">{dossier.client_name} · competência {dossier.competence_key.slice(4,6)}/{dossier.competence_key.slice(0,4)}</p></div><Badge variant={dossier.status==="verified"?"default":"secondary"}>{statusLabel[dossier.status]||dossier.status}</Badge></div>
    <Alert><AlertDescription>Fluxo interno: informe os débitos, valide, encerre a apuração e confirme o processamento no SERPRO. Esta obrigação não envia mensagens nem documentos ao cliente.</AlertDescription></Alert>
    <div className="space-y-3">
      {debts.map((debt,index)=><div key={debt.id||index} className="grid gap-2 rounded-lg border bg-background p-3 sm:grid-cols-6">
        <div className="space-y-1 sm:col-span-1"><Label>Código</Label><Input inputMode="numeric" maxLength={6} disabled={!editable||busy} value={debt.revenue_code} onChange={(event)=>updateDebt(index,{revenue_code:event.target.value.replace(/\D/g,"")})}/></div>
        <div className="space-y-1 sm:col-span-2"><Label>Descrição</Label><Input disabled={!editable||busy} value={debt.description} onChange={(event)=>updateDebt(index,{description:event.target.value})}/></div>
        <div className="space-y-1"><Label>Valor</Label><Input type="number" min="0" step="0.01" disabled={!editable||busy} value={debt.debit_amount} onChange={(event)=>updateDebt(index,{debit_amount:Number(event.target.value)})}/></div>
        <div className="space-y-1"><Label>Vencimento</Label><Input type="date" disabled={!editable||busy} value={debt.due_date||""} onChange={(event)=>updateDebt(index,{due_date:event.target.value||null})}/></div>
        <div className="flex items-end"><Button type="button" variant="ghost" size="icon" aria-label="Remover débito" disabled={!editable||busy} onClick={()=>setDebts((current)=>current.filter((_,itemIndex)=>itemIndex!==index))}><Trash2 className="h-4 w-4"/></Button></div>
      </div>)}
      {editable?<Button type="button" variant="outline" size="sm" disabled={busy} onClick={()=>setDebts((current)=>[...current,emptyDebt()])}><Plus className="mr-2 h-4 w-4"/>Adicionar débito</Button>:null}
    </div>
    <div className="flex flex-wrap gap-2">
      {editable?<Button type="button" variant="outline" disabled={busy||debts.length===0} onClick={()=>run(workflow.save.mutateAsync({dossierId:dossier.id,debts}),"Débitos salvos.","Não foi possível salvar os débitos.")}>Salvar apuração</Button>:null}
      {dossier.status==="ready_for_validation"?<Button type="button" variant="secondary" disabled={busy} onClick={()=>run(workflow.validate.mutateAsync(dossier.id),"Apuração validada.","A validação encontrou pendências.")}><CheckCircle2 className="mr-2 h-4 w-4"/>Validar débitos</Button>:null}
      {dossier.status==="validated"?<Button type="button" variant="destructive" disabled={busy} onClick={()=>run(workflow.submit.mutateAsync(dossier.id),"Apuração encaminhada ao SERPRO.","O encerramento foi bloqueado ou falhou.")}><Send className="mr-2 h-4 w-4"/>Encerrar e transmitir MIT</Button>:null}
      {["processing","transmitted","transmission_unknown"].includes(dossier.status)?<Button type="button" disabled={busy} onClick={()=>run(workflow.verify.mutateAsync(dossier.id),"Situação consultada no SERPRO.","Não foi possível confirmar a transmissão.")}><RefreshCw className="mr-2 h-4 w-4"/>Confirmar transmissão</Button>:null}
    </div>
    {dossier.protocol_number?<p className="text-xs text-muted-foreground">Protocolo: {dossier.protocol_number}{dossier.receipt_number?` · Recibo: ${dossier.receipt_number}`:""}</p>:null}
    {busy?<p className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin"/>Processando operação fiscal…</p>:null}
  </section>;
}
