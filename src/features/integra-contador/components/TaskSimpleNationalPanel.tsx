import { useEffect, useState } from "react";
import { Calculator, CheckCircle2, Download, FileCheck2, Loader2, ReceiptText, RefreshCw, Save, Send } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTaskSimpleNationalDossier } from "../hooks/useTaskSimpleNationalDossier";
import type { SimpleNationalDossier } from "../types";
import { DefisDossierEditor } from "./DefisDossierEditor";

type TaskSimpleNationalPanelProps = {
  organizationId: string | null;
  taskId: string;
  integrationSource?: string | null;
};

const statusLabels: Record<SimpleNationalDossier["status"], string> = {
  collecting: "Coletando dados",
  validation_failed: "Dados incompletos",
  ready_for_review: "Pronto para revisão",
  approved: "Aprovado",
  transmission_blocked: "Transmissão bloqueada",
  queued: "Na fila",
  transmitting: "Transmitindo",
  transmitted: "Transmitido",
  documents_issued: "Documentos emitidos",
  published: "Publicado",
  completed: "Concluído",
  requires_action: "Requer ação",
};
const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function numberInput(value: unknown, fallback = "") {
  return typeof value === "number" || typeof value === "string" ? String(value) : fallback;
}

export function TaskSimpleNationalPanel({ organizationId, taskId, integrationSource }: TaskSimpleNationalPanelProps) {
  const enabled = integrationSource === "grow_obligation_task";
  const workflow = useTaskSimpleNationalDossier(organizationId, taskId, enabled);
  const dossier = workflow.query.data?.dossier || null;
  const [revenue, setRevenue] = useState("");
  const [foreignRevenue, setForeignRevenue] = useState("0");
  const [revenueRegime, setRevenueRegime] = useState("competencia");
  const [activityId, setActivityId] = useState("1");
  const [activityRevenue, setActivityRevenue] = useState("");
  const [payroll, setPayroll] = useState("");
  const [source, setSource] = useState("Sistema contábil da Grow");
  const [confirmTransmission, setConfirmTransmission] = useState(false);

  useEffect(() => {
    if (!dossier) return;
    const activity = Array.isArray(dossier.input_data.revenue_by_activity)
      ? dossier.input_data.revenue_by_activity[0] as { revenue?: unknown; activity_id?: unknown } | undefined
      : undefined;
    setRevenue(numberInput(dossier.input_data.revenue_total ?? dossier.input_data.annual_revenue));
    setForeignRevenue(numberInput(dossier.input_data.foreign_revenue, "0"));
    setRevenueRegime(String(dossier.input_data.revenue_regime || "competencia"));
    setActivityId(numberInput(activity?.activity_id, "1"));
    setActivityRevenue(numberInput(activity?.revenue));
    setPayroll(numberInput(dossier.input_data.payroll_r12));
    setSource(dossier.source_manifest[0]?.reference || "Sistema contábil da Grow");
  }, [dossier]);

  if (!enabled) return null;
  if (workflow.query.isLoading) {
    return <div className="order-0 flex items-center gap-2 rounded-lg border bg-muted/20 p-3 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Preparando automação fiscal da tarefa...</div>;
  }
  if (workflow.query.isError) {
    return <Alert className="order-0" variant="destructive"><AlertDescription>Não foi possível preparar a automação desta obrigação. Verifique o vínculo da tarefa e tente novamente.</AlertDescription></Alert>;
  }
  if (!workflow.query.data?.eligible || !dossier) return null;

  const taxValues = Array.isArray(dossier.preview_result?.taxValues)
    ? dossier.preview_result.taxValues as Array<{ codigoTributo: number; valor: number }>
    : [];
  const total = taxValues.reduce((sum, item) => sum + Number(item.valor || 0), 0);
  const locked = ["transmitted", "documents_issued", "published", "completed"].includes(dossier.status);
  const busy = workflow.save.isPending || workflow.preview.isPending || workflow.syncPreviousCompetence.isPending || workflow.approve.isPending || workflow.transmit.isPending || workflow.transmitDefis.isPending || workflow.syncDefis.isPending || workflow.generateDas.isPending;
  const previousValues = (dossier.input_data.previous_competence_values || {}) as Record<string, unknown>;

  const save = async () => {
    const inputData: Record<string, unknown> = { ...dossier.input_data };
    if (dossier.obligation_kind === "pgdasd") {
      Object.assign(inputData, {
        revenue_total: Number(revenue),
        domestic_revenue: Number(revenue),
        foreign_revenue: Number(foreignRevenue),
        revenue_regime: revenueRegime,
        revenue_by_activity: [{ classification: "receita_bruta", activity_id: Number(activityId), revenue: Number(activityRevenue) }],
      });
      if (payroll !== "") inputData.payroll_r12 = Number(payroll);
    }
    try {
      await workflow.save.mutateAsync({ dossierId: dossier.id, inputData, sourceManifest: [{ type: "internal", reference: source.trim() }] });
      toast.success("Dados da obrigação validados e salvos na tarefa.");
    } catch {
      toast.error("Revise os campos obrigatórios e tente novamente.");
    }
  };

  return (
    <section className="order-0 space-y-4 rounded-xl border border-primary/20 bg-primary/5 p-4" aria-labelledby={`simples-task-${taskId}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 id={`simples-task-${taskId}`} className="font-semibold">Execução fiscal nesta tarefa</h3>
          <p className="text-xs text-muted-foreground">
            {dossier.client_name} · {dossier.obligation_kind === "pgdasd" ? "PGDAS-D e DAS" : "DEFIS"} · competência {dossier.competence_key}
          </p>
        </div>
        <Badge variant={dossier.status === "validation_failed" || dossier.status === "transmission_blocked" ? "destructive" : "secondary"}>{statusLabels[dossier.status]}</Badge>
      </div>

      {dossier.provider_environment === "trial" ? <Alert><AlertDescription>Ambiente de demonstração: as ações não produzem efeito fiscal real.</AlertDescription></Alert> : null}
      {dossier.validation_summary.blocking?.map((item) => <Alert key={item.code} variant="destructive"><AlertDescription>{item.message}</AlertDescription></Alert>)}
      {dossier.validation_summary.warnings?.map((item) => <Alert key={item.code}><AlertDescription>{item.message}</AlertDescription></Alert>)}

      {dossier.obligation_kind === "pgdasd" ? (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-y py-3 text-sm">
          <span className="font-medium">Competência anterior {String(previousValues.reference_month || "não consultada")}</span>
          <span>Receita: {previousValues.gross_revenue == null ? "—" : currency.format(Number(previousValues.gross_revenue))}</span>
          <span>Folha: {previousValues.payroll_with_charges == null ? "não encontrada" : currency.format(Number(previousValues.payroll_with_charges))}</span>
          <Button type="button" size="sm" variant="outline" disabled={busy || locked} onClick={() => void workflow.syncPreviousCompetence.mutateAsync(dossier.id).then((result) => {
            toast.success(result.payrollLinked ? "Receita e folha da competência anterior relacionadas." : "Receita consultada; falta a folha da mesma competência.");
          }).catch(() => toast.error("Não foi possível consultar o PGDAS-D da competência anterior."))}>
            {workflow.syncPreviousCompetence.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Buscar competência anterior
          </Button>
        </div>
      ) : null}

      {!locked && dossier.obligation_kind === "defis" ? <DefisDossierEditor dossier={dossier} saving={workflow.save.isPending} onSave={async (inputData, reference) => {
        await workflow.save.mutateAsync({ dossierId: dossier.id, inputData, sourceManifest: [{ type: "internal", reference: reference.trim() }] });
        toast.success("Dados anuais da DEFIS validados e salvos.");
      }} /> : null}

      {!locked && dossier.obligation_kind === "pgdasd" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5"><Label htmlFor={`task-revenue-${dossier.id}`}>{dossier.obligation_kind === "pgdasd" ? "Receita interna da competência" : "Receita anual"}</Label><Input id={`task-revenue-${dossier.id}`} type="number" min="0" step="0.01" value={revenue} onChange={(event) => setRevenue(event.target.value)} /></div>
          {dossier.obligation_kind === "pgdasd" ? <div className="space-y-1.5"><Label htmlFor={`task-foreign-${dossier.id}`}>Receita no exterior</Label><Input id={`task-foreign-${dossier.id}`} type="number" min="0" step="0.01" value={foreignRevenue} onChange={(event) => setForeignRevenue(event.target.value)} /></div> : null}
          {dossier.obligation_kind === "pgdasd" ? <div className="space-y-1.5"><Label>Regime da receita</Label><Select value={revenueRegime} onValueChange={setRevenueRegime}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="competencia">Competência</SelectItem><SelectItem value="caixa">Caixa</SelectItem></SelectContent></Select></div> : null}
          {dossier.obligation_kind === "pgdasd" ? <div className="space-y-1.5"><Label htmlFor={`task-activity-id-${dossier.id}`}>Código da atividade PGDAS-D</Label><Input id={`task-activity-id-${dossier.id}`} type="number" min="1" step="1" value={activityId} onChange={(event) => setActivityId(event.target.value)} /></div> : null}
          {dossier.obligation_kind === "pgdasd" ? <div className="space-y-1.5"><Label htmlFor={`task-activity-${dossier.id}`}>Receita classificada na atividade</Label><Input id={`task-activity-${dossier.id}`} type="number" min="0" step="0.01" value={activityRevenue} onChange={(event) => setActivityRevenue(event.target.value)} /></div> : null}
          {dossier.obligation_kind === "pgdasd" ? <div className="space-y-1.5"><Label htmlFor={`task-payroll-${dossier.id}`}>Folha R12</Label><Input id={`task-payroll-${dossier.id}`} type="number" min="0" step="0.01" value={payroll} onChange={(event) => setPayroll(event.target.value)} /></div> : null}
          <div className="space-y-1.5 sm:col-span-2"><Label htmlFor={`task-source-${dossier.id}`}>Fonte dos dados</Label><Input id={`task-source-${dossier.id}`} value={source} onChange={(event) => setSource(event.target.value)} /></div>
          <div className="sm:col-span-2"><Button type="button" onClick={() => void save()} disabled={busy || !source.trim()}><Save className="mr-2 h-4 w-4" />Validar e salvar</Button></div>
        </div>
      ) : null}

      {taxValues.length > 0 ? <div className="rounded-lg border bg-background p-3"><p className="text-xs text-muted-foreground">Cálculo oficial retornado</p><p className="text-xl font-semibold">{currency.format(total)}</p><p className="text-xs text-muted-foreground">{taxValues.length} tributo(s) calculado(s)</p></div> : null}

      <div className="flex flex-wrap gap-2">
        {dossier.obligation_kind === "pgdasd" && dossier.status === "ready_for_review" && taxValues.length === 0 ? <Button type="button" disabled={busy} onClick={() => void workflow.preview.mutateAsync(dossier.id).then(() => toast.success("Cálculo concluído.")).catch(() => toast.error("Não foi possível calcular no PGDAS-D."))}><Calculator className="mr-2 h-4 w-4" />Calcular</Button> : null}
        {dossier.status === "ready_for_review" && (dossier.obligation_kind !== "pgdasd" || taxValues.length > 0) ? <Button type="button" variant="secondary" disabled={busy} onClick={() => void workflow.approve.mutateAsync({ dossierId: dossier.id, expectedVersion: dossier.data_version }).then(() => toast.success("Valores aprovados.")).catch(() => toast.error("A apuração mudou ou não está pronta."))}><CheckCircle2 className="mr-2 h-4 w-4" />Aprovar valores</Button> : null}
        {dossier.obligation_kind === "pgdasd" && dossier.status === "approved" ? <Button type="button" disabled={busy} onClick={() => setConfirmTransmission(true)}><Send className="mr-2 h-4 w-4" />Transmitir declaração</Button> : null}
        {dossier.obligation_kind === "defis" ? <Button type="button" variant="outline" disabled={busy} onClick={() => void workflow.syncDefis.mutateAsync(dossier.id).then(() => toast.success("Declarações da DEFIS sincronizadas.")).catch(() => toast.error("Não foi possível consultar as declarações."))}><RefreshCw className="mr-2 h-4 w-4" />Consultar transmitidas</Button> : null}
        {dossier.obligation_kind === "defis" && dossier.status === "approved" ? <Button type="button" disabled={busy} onClick={() => setConfirmTransmission(true)}><Send className="mr-2 h-4 w-4" />Transmitir DEFIS</Button> : null}
        {dossier.obligation_kind === "pgdasd" && dossier.status === "transmitted" ? <Button type="button" disabled={busy} onClick={() => void workflow.generateDas.mutateAsync(dossier.id).then(() => toast.success("DAS gerado.")).catch(() => toast.error("Não foi possível gerar o DAS."))}><ReceiptText className="mr-2 h-4 w-4" />Gerar DAS</Button> : null}
        {dossier.declaration_storage_path ? <Button type="button" variant="outline" onClick={() => void workflow.openArtifact(dossier.id, "declaration")}><FileCheck2 className="mr-2 h-4 w-4" />Declaração</Button> : null}
        {dossier.receipt_storage_path ? <Button type="button" variant="outline" onClick={() => void workflow.openArtifact(dossier.id, "receipt")}><Download className="mr-2 h-4 w-4" />Recibo</Button> : null}
        {dossier.das_storage_path ? <Button type="button" variant="outline" onClick={() => void workflow.openArtifact(dossier.id, "das")}><Download className="mr-2 h-4 w-4" />DAS {dossier.das_total != null ? `· ${currency.format(dossier.das_total)}` : ""}</Button> : null}
      </div>

      <AlertDialog open={confirmTransmission} onOpenChange={setConfirmTransmission}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Transmitir a declaração desta tarefa?</AlertDialogTitle><AlertDialogDescription>Será transmitida exatamente a versão {dossier.data_version}, aprovada para {dossier.client_name} no ano-calendário/competência {dossier.competence_key}.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction disabled={workflow.transmit.isPending || workflow.transmitDefis.isPending} onClick={(event) => { event.preventDefault(); const mutation = dossier.obligation_kind === "defis" ? workflow.transmitDefis : workflow.transmit; void mutation.mutateAsync(dossier.id).then(() => { toast.success("Declaração transmitida e recibo armazenado."); setConfirmTransmission(false); }).catch(() => toast.error("A transmissão não foi concluída.")); }}><Send className="mr-2 h-4 w-4" />Confirmar transmissão</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
