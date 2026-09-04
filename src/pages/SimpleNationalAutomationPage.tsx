import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Calculator, CheckCircle2, Download, FileCheck2, Loader2, LockKeyhole, Plus, ReceiptText, RefreshCw, Save, Send } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/app/AppLayout";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSimpleNationalDossiers } from "@/features/integra-contador/hooks/useSimpleNationalDossiers";
import { DefisDossierEditor } from "@/features/integra-contador/components/DefisDossierEditor";
import type { SimpleNationalDossier, SimpleNationalObligationKind } from "@/features/integra-contador/types";
import { useAuth } from "@/hooks/useAuth";

const kindLabels: Partial<Record<SimpleNationalObligationKind, string>> = { pgdasd: "PGDAS-D mensal", defis: "DEFIS anual" };
const statusLabels: Record<SimpleNationalDossier["status"], string> = {
  collecting: "Coletando dados", validation_failed: "Dados incompletos", ready_for_review: "Pronto para revisão",
  approved: "Aprovado", transmission_blocked: "Transmissão bloqueada", queued: "Na fila", transmitting: "Transmitindo",
  transmitted: "Transmitido", documents_issued: "Documentos emitidos", published: "Publicado", completed: "Concluído", requires_action: "Requer ação",
};
const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function DossierEditor({ dossier, onSave, saving }: { dossier: SimpleNationalDossier; onSave: (input: Record<string, unknown>, source: string) => Promise<void>; saving: boolean }) {
  const [revenue, setRevenue] = useState(String(dossier.input_data.revenue_total ?? dossier.input_data.annual_revenue ?? ""));
  const [foreignRevenue, setForeignRevenue] = useState(String(dossier.input_data.foreign_revenue ?? "0"));
  const [regime, setRegime] = useState(String(dossier.input_data.revenue_regime ?? "competencia"));
  const activity = (dossier.input_data.revenue_by_activity as Array<{ revenue?: number; activity_id?: number }> | undefined)?.[0];
  const [activityRevenue, setActivityRevenue] = useState(String(activity?.revenue ?? ""));
  const [activityId, setActivityId] = useState(String(activity?.activity_id ?? "1"));
  const [payroll, setPayroll] = useState(String(dossier.input_data.payroll_r12 ?? ""));
  const [source, setSource] = useState(dossier.source_manifest[0]?.reference ?? "Sistema contábil da Grow");
  const [partnersReviewed, setPartnersReviewed] = useState(Boolean(dossier.input_data.partners_reviewed));

  const submit = async () => {
    const input: Record<string, unknown> = { ...dossier.input_data };
    if (dossier.obligation_kind === "pgdasd") {
      Object.assign(input, { revenue_total: Number(revenue), domestic_revenue: Number(revenue), foreign_revenue: Number(foreignRevenue), revenue_regime: regime, revenue_by_activity: [{ classification: "receita_bruta", activity_id: Number(activityId), revenue: Number(activityRevenue) }] });
      if (payroll !== "") input.payroll_r12 = Number(payroll);
    } else if (dossier.obligation_kind === "defis") Object.assign(input, { annual_revenue: Number(revenue), partners_reviewed: partnersReviewed });
    await onSave(input, source);
  };

  return <div className="grid gap-4 border-t pt-4 md:grid-cols-2">
    <div className="space-y-2"><Label htmlFor={`revenue-${dossier.id}`}>{dossier.obligation_kind === "defis" ? "Receita anual" : "Receita interna da competência"}</Label><Input id={`revenue-${dossier.id}`} type="number" min="0" step="0.01" value={revenue} onChange={(event) => setRevenue(event.target.value)} /></div>
    {dossier.obligation_kind === "pgdasd" ? <div className="space-y-2"><Label htmlFor={`foreign-${dossier.id}`}>Receita no exterior</Label><Input id={`foreign-${dossier.id}`} type="number" min="0" step="0.01" value={foreignRevenue} onChange={(event) => setForeignRevenue(event.target.value)} /></div> : null}
    {dossier.obligation_kind === "pgdasd" ? <div className="space-y-2"><Label>Regime da receita</Label><Select value={regime} onValueChange={setRegime}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="competencia">Competência</SelectItem><SelectItem value="caixa">Caixa</SelectItem></SelectContent></Select></div> : null}
    {dossier.obligation_kind === "pgdasd" ? <><div className="space-y-2"><Label htmlFor={`activity-id-${dossier.id}`}>Código da atividade PGDAS-D</Label><Input id={`activity-id-${dossier.id}`} type="number" min="1" step="1" value={activityId} onChange={(event) => setActivityId(event.target.value)} /></div><div className="space-y-2"><Label htmlFor={`activity-${dossier.id}`}>Receita classificada na atividade</Label><Input id={`activity-${dossier.id}`} type="number" min="0" step="0.01" value={activityRevenue} onChange={(event) => setActivityRevenue(event.target.value)} /></div><div className="space-y-2"><Label htmlFor={`payroll-${dossier.id}`}>Folha R12 (controle interno)</Label><Input id={`payroll-${dossier.id}`} type="number" min="0" step="0.01" value={payroll} onChange={(event) => setPayroll(event.target.value)} /></div></> : null}
    {dossier.obligation_kind === "defis" ? <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={partnersReviewed} onChange={(event) => setPartnersReviewed(event.target.checked)} /> Quadro societário revisado</label> : null}
    <div className="space-y-2 md:col-span-2"><Label htmlFor={`source-${dossier.id}`}>Fonte dos dados</Label><Input id={`source-${dossier.id}`} value={source} onChange={(event) => setSource(event.target.value)} placeholder="Ex.: ERP, planilha ou conciliação bancária" /></div>
    <div className="md:col-span-2"><Button onClick={() => void submit()} disabled={saving || !source.trim()}><Save className="mr-2 h-4 w-4" />Validar e salvar</Button></div>
  </div>;
}

function DossierCard({ dossier, workflow, onTransmit }: { dossier: SimpleNationalDossier; workflow: ReturnType<typeof useSimpleNationalDossiers>; onTransmit: (dossier: SimpleNationalDossier) => void }) {
  const taxValues = Array.isArray(dossier.preview_result?.taxValues) ? dossier.preview_result.taxValues as Array<{ codigoTributo: number; valor: number }> : [];
  const defisDeclarations = Array.isArray(dossier.preview_result?.declarations) ? dossier.preview_result.declarations as Array<{ anoCalendario: number; idDefis: string; tipo: string; dataHora: string | number }> : [];
  const total = taxValues.reduce((sum, item) => sum + Number(item.valor || 0), 0);
  const isLocked = ["transmitted", "documents_issued", "published", "completed"].includes(dossier.status);
  const previousValues = (dossier.input_data.previous_competence_values || {}) as Record<string, unknown>;
  const defisMonthsComplete = Number(dossier.input_data.pgdas_months_complete || 0);
  const defisAnnualRevenue = Number(dossier.input_data.annual_revenue || 0);
  return <Card><CardHeader><div className="flex flex-wrap items-start justify-between gap-3"><div><CardTitle className="text-lg">{dossier.client_name} · {kindLabels[dossier.obligation_kind]}</CardTitle><CardDescription>Competência {dossier.competence_key} · versão {dossier.data_version} · {dossier.provider_environment === "trial" ? "Demonstração" : "Produção"}</CardDescription></div><Badge variant={dossier.status === "validation_failed" || dossier.status === "transmission_blocked" ? "destructive" : "secondary"}>{statusLabels[dossier.status]}</Badge></div></CardHeader><CardContent className="space-y-4">
    {dossier.validation_summary.blocking?.map((item) => <Alert key={item.code} variant="destructive"><AlertDescription>{item.message}</AlertDescription></Alert>)}
    {dossier.validation_summary.warnings?.map((item) => <Alert key={item.code}><AlertDescription>{item.message}</AlertDescription></Alert>)}
    {dossier.obligation_kind === "pgdasd" ? <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-y py-3 text-sm"><span className="font-medium">Competência anterior {String(previousValues.reference_month || "não consultada")}</span><span>Receita: {previousValues.gross_revenue == null ? "—" : currency.format(Number(previousValues.gross_revenue))}</span><span>Folha: {previousValues.payroll_with_charges == null ? "não encontrada" : currency.format(Number(previousValues.payroll_with_charges))}</span><Button size="sm" variant="outline" disabled={workflow.syncPreviousCompetence.isPending || isLocked} onClick={() => void workflow.syncPreviousCompetence.mutateAsync(dossier.id).then((result) => toast.success(result.payrollLinked ? "Receita e folha relacionadas." : "Receita consultada; falta a folha da competência.")).catch(() => toast.error("Não foi possível consultar a competência anterior."))}>{workflow.syncPreviousCompetence.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}Buscar competência anterior</Button></div> : null}
    {dossier.obligation_kind === "defis" ? <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-y py-3 text-sm"><span className="font-medium">PGDAS-D consolidado: {defisMonthsComplete}/12 competências</span><span>Receita anual: {currency.format(defisAnnualRevenue)}</span><Button size="sm" variant="outline" disabled={workflow.syncDefisAnnual.isPending || isLocked} onClick={() => void workflow.syncDefisAnnual.mutateAsync(dossier.id).then((result) => toast.success(result.monthsComplete === 12 ? "As 12 competências foram consolidadas." : `${result.monthsComplete} de 12 competências encontradas.`)).catch(() => toast.error("Não foi possível consolidar as receitas do PGDAS-D."))}>{workflow.syncDefisAnnual.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}Consolidar receitas</Button></div> : null}
    {dossier.obligation_kind === "defis" && defisDeclarations.length > 0 ? <div className="rounded-xl border bg-muted/20 p-4"><p className="font-medium">Declarações encontradas no SERPRO</p><div className="mt-2 space-y-2">{defisDeclarations.map((item) => <div key={item.idDefis} className="flex flex-wrap items-center justify-between gap-2 text-sm"><span>Ano {item.anoCalendario} · DEFIS {item.idDefis}</span><Badge variant="outline">Tipo {item.tipo}</Badge></div>)}</div></div> : null}
    {taxValues.length > 0 ? <div className="rounded-xl border bg-muted/20 p-4"><p className="text-sm font-medium">Cálculo retornado pelo PGDAS-D</p><p className="mt-1 text-2xl font-semibold">{currency.format(total)}</p><p className="text-xs text-muted-foreground">{taxValues.length} tributo(s) calculado(s). Esses valores serão comparados antes da transmissão.</p></div> : null}
    {!isLocked && dossier.obligation_kind === "defis" ? <DefisDossierEditor dossier={dossier} saving={workflow.save.isPending} onSave={async (inputData, source) => { try { await workflow.save.mutateAsync({ dossierId: dossier.id, inputData, sourceManifest: [{ type: "internal", reference: source.trim() }] }); toast.success("Dados anuais da DEFIS validados e versionados."); } catch { toast.error("Revise os dados obrigatórios da DEFIS."); } }} /> : null}
    {!isLocked && dossier.obligation_kind !== "defis" ? <DossierEditor dossier={dossier} saving={workflow.save.isPending} onSave={async (inputData, source) => { try { await workflow.save.mutateAsync({ dossierId: dossier.id, inputData, sourceManifest: [{ type: "internal", reference: source.trim() }] }); toast.success("Dados validados e versionados."); } catch { toast.error("Revise os dados e tente novamente."); } }} /> : null}
    <div className="flex flex-wrap gap-2">
      {dossier.obligation_kind === "pgdasd" && dossier.status === "ready_for_review" && taxValues.length === 0 ? <Button disabled={workflow.preview.isPending} onClick={() => void workflow.preview.mutateAsync(dossier.id).then(() => toast.success("Cálculo do PGDAS-D concluído.")).catch(() => toast.error("Não foi possível calcular no PGDAS-D."))}><Calculator className="mr-2 h-4 w-4" />Calcular no PGDAS-D</Button> : null}
      {dossier.status === "ready_for_review" && (dossier.obligation_kind !== "pgdasd" || taxValues.length > 0) ? <Button variant="secondary" disabled={workflow.approve.isPending} onClick={() => void workflow.approve.mutateAsync({ dossierId: dossier.id, expectedVersion: dossier.data_version }).then(() => toast.success("Apuração aprovada.")).catch(() => toast.error("A apuração mudou ou não está pronta."))}><CheckCircle2 className="mr-2 h-4 w-4" />Aprovar valores</Button> : null}
      {dossier.obligation_kind === "pgdasd" && dossier.status === "approved" ? <Button onClick={() => onTransmit(dossier)}><Send className="mr-2 h-4 w-4" />Transmitir declaração</Button> : null}
      {dossier.obligation_kind === "defis" ? <Button variant="outline" disabled={workflow.syncDefis.isPending} onClick={() => void workflow.syncDefis.mutateAsync(dossier.id).then(() => toast.success("Declarações da DEFIS sincronizadas.")).catch(() => toast.error("Não foi possível consultar as declarações."))}><RefreshCw className="mr-2 h-4 w-4" />Consultar transmitidas</Button> : null}
      {dossier.obligation_kind === "defis" && dossier.status === "approved" ? <Button onClick={() => onTransmit(dossier)}><Send className="mr-2 h-4 w-4" />Transmitir DEFIS</Button> : null}
      {dossier.obligation_kind === "pgdasd" && dossier.status === "transmitted" ? <Button disabled={workflow.generateDas.isPending} onClick={() => void workflow.generateDas.mutateAsync(dossier.id).then(() => toast.success("DAS gerado e armazenado com segurança.")).catch(() => toast.error("Não foi possível gerar o DAS."))}><ReceiptText className="mr-2 h-4 w-4" />Gerar DAS</Button> : null}
      {dossier.declaration_storage_path ? <Button variant="outline" onClick={() => void workflow.openArtifact(dossier.id, "declaration")}><FileCheck2 className="mr-2 h-4 w-4" />Declaração</Button> : null}
      {dossier.receipt_storage_path ? <Button variant="outline" onClick={() => void workflow.openArtifact(dossier.id, "receipt")}><Download className="mr-2 h-4 w-4" />Recibo</Button> : null}
      {dossier.das_storage_path ? <Button variant="outline" onClick={() => void workflow.openArtifact(dossier.id, "das")}><Download className="mr-2 h-4 w-4" />Baixar DAS {dossier.das_total != null ? `· ${currency.format(dossier.das_total)}` : ""}</Button> : null}
    </div>
  </CardContent></Card>;
}

export default function SimpleNationalAutomationPage() {
  const { currentOrganizationId } = useAuth();
  const workflow = useSimpleNationalDossiers(currentOrganizationId);
  const [clientId, setClientId] = useState("");
  const [kind, setKind] = useState<SimpleNationalObligationKind>("pgdasd");
  const [competence, setCompetence] = useState(() => new Date().toISOString().slice(0, 7));
  const [transmissionTarget, setTransmissionTarget] = useState<SimpleNationalDossier | null>(null);
  const dossiers = useMemo(() => workflow.query.data ?? [], [workflow.query.data]);
  const pendingCount = useMemo(() => dossiers.filter((item) => ["validation_failed", "ready_for_review", "approved", "transmission_blocked"].includes(item.status)).length, [dossiers]);
  const create = async () => {
    if (!clientId || !competence) return;
    try {
      await workflow.create.mutateAsync({ clientId, kind, competenceKey: competence.replace(/\D/g, "") });
      toast.success("Apuração criada.");
    } catch (error) {
      const code = error instanceof Error ? error.message : "operation_failed";
      const message = code === "canonical_obligation_instance_not_generated"
        ? "A entrega correspondente ainda não pôde ser gerada. Atualize as obrigações e tente novamente."
        : code === "client_not_available" || code === "client_not_simples_nacional"
          ? "Este cliente não está disponível para a automação do Simples Nacional."
          : "Não foi possível criar a apuração.";
      toast.error(message);
    }
  };

  const changeKind = (value: SimpleNationalObligationKind) => {
    setKind(value);
    setCompetence(value === "defis"
      ? String(new Date().getFullYear() - 1)
      : new Date().toISOString().slice(0, 7));
  };

  return <AppLayout><main className="mx-auto w-full max-w-6xl space-y-6 p-4 md:p-8">
    <div className="space-y-2"><Button asChild variant="ghost" size="sm"><Link to="/app/obrigacoes"><ArrowLeft className="mr-2 h-4 w-4" />Voltar para Obrigações</Link></Button><h1 className="text-2xl font-semibold">Automação do Simples Nacional</h1><p className="text-muted-foreground">Calcule, revise, transmita a declaração e emita o DAS com rastreabilidade.</p></div>
    <Alert><LockKeyhole className="h-4 w-4" /><AlertTitle>Operação assistida e segura</AlertTitle><AlertDescription>O ambiente Trial executa o cenário oficial de demonstração do SERPRO, sem efeito fiscal real. A produção continua bloqueada até a validação do contrato e do transporte mTLS.</AlertDescription></Alert>
    <dl className="flex flex-wrap gap-x-8 gap-y-3 border-y py-3" aria-label="Resumo das apurações">{[["Apurações", dossiers.length], ["Pendências de revisão", pendingCount], ["Clientes elegíveis", workflow.clients.data?.length ?? 0]].map(([label, value]) => <div key={label} className="flex items-baseline gap-2"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="text-sm font-semibold tabular-nums">{value}</dd></div>)}</dl>
    <Card><CardHeader><CardTitle>Nova apuração</CardTitle><CardDescription>Somente clientes ativos cadastrados no Simples Nacional aparecem aqui.</CardDescription></CardHeader><CardContent className="grid gap-4 md:grid-cols-4"><div className="space-y-2 md:col-span-2"><Label>Cliente</Label><Select value={clientId} onValueChange={setClientId}><SelectTrigger><SelectValue placeholder="Selecione um cliente" /></SelectTrigger><SelectContent>{workflow.clients.data?.map((client) => <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label>Obrigação</Label><Select value={kind} onValueChange={(value) => changeKind(value as SimpleNationalObligationKind)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(kindLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label htmlFor="simples-competence">{kind === "defis" ? "Ano-calendário" : "Competência"}</Label><Input id="simples-competence" type={kind === "pgdasd" ? "month" : "number"} min={kind === "pgdasd" ? undefined : 2000} max={kind === "pgdasd" ? undefined : 2100} value={competence} onChange={(event) => setCompetence(event.target.value)} /></div><div className="md:col-span-4"><Button onClick={() => void create()} disabled={!clientId || workflow.create.isPending}><Plus className="mr-2 h-4 w-4" />Criar apuração</Button></div></CardContent></Card>
    <section className="space-y-4" aria-labelledby="simples-list-title"><div><h2 id="simples-list-title" className="text-xl font-semibold">Fila de preparação e revisão</h2><p className="text-sm text-muted-foreground">As etapas são liberadas somente quando a anterior estiver concluída.</p></div>{workflow.query.isLoading ? <p className="text-sm text-muted-foreground">Carregando apurações…</p> : null}{workflow.query.isError ? <Alert variant="destructive"><AlertDescription>Não foi possível carregar as apurações.</AlertDescription></Alert> : null}{!workflow.query.isLoading && dossiers.length === 0 ? <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Nenhuma apuração criada.</CardContent></Card> : dossiers.map((dossier) => <DossierCard key={`${dossier.id}-${dossier.data_version}-${dossier.status}`} dossier={dossier} workflow={workflow} onTransmit={setTransmissionTarget} />)}</section>
    <AlertDialog open={Boolean(transmissionTarget)} onOpenChange={(open) => { if (!open) setTransmissionTarget(null); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Confirmar transmissão da declaração?</AlertDialogTitle><AlertDialogDescription>Será enviada exatamente a versão aprovada. No ambiente Trial, o resultado é demonstrativo; a produção permanece protegida pela configuração contratual.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction disabled={workflow.transmit.isPending || workflow.transmitDefis.isPending} onClick={(event) => { event.preventDefault(); if (!transmissionTarget) return; const mutation = transmissionTarget.obligation_kind === "defis" ? workflow.transmitDefis : workflow.transmit; void mutation.mutateAsync(transmissionTarget.id).then(() => { toast.success("Declaração transmitida e documentos armazenados."); setTransmissionTarget(null); }).catch(() => toast.error("A transmissão não foi concluída.")); }}><Send className="mr-2 h-4 w-4" />Confirmar transmissão</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </main></AppLayout>;
}
