import { useState } from "react";
import { CheckCircle2, Download, FileCode2, FileText, Loader2, ReceiptText, Send } from "lucide-react";
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
import { useTaskDctfwebDossier } from "../hooks/useTaskDctfwebDossier";

type Props = {
  organizationId: string | null;
  taskId: string;
  integrationSource?: string | null;
};

const labels: Record<string, string> = {
  collecting: "Preparação",
  ready_for_review: "Pronto para revisão",
  approved: "Aprovado",
  consulted: "Aguardando revisão",
  documents_issued: "Documentos emitidos",
  transmitting: "Transmitindo",
  transmitted: "Transmitido",
  completed: "Concluído",
  requires_action: "Requer ação",
  transmission_unknown: "Confirmar situação",
};

const fileToBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("file_read_failed"));
    reader.onload = () => resolve(String(reader.result || "").split(",")[1] || "");
    reader.readAsDataURL(file);
  });

export function TaskDctfwebPanel({ organizationId, taskId, integrationSource }: Props) {
  const workflow = useTaskDctfwebDossier(organizationId, taskId, integrationSource === "grow_obligation_task");
  const dossier = workflow.query.data?.dossier;
  const [receiptNumber, setReceiptNumber] = useState("");
  const [signedXml, setSignedXml] = useState("");
  const [confirmTransmit, setConfirmTransmit] = useState(false);

  if (integrationSource !== "grow_obligation_task") return null;
  if (workflow.query.isLoading) return null;
  if (workflow.query.isError) {
    return (
      <Alert variant="destructive" className="order-0">
        <AlertDescription>Não foi possível preparar a declaração DCTFWeb desta tarefa.</AlertDescription>
      </Alert>
    );
  }
  if (!workflow.query.data?.eligible || !dossier) return null;

  const busy = workflow.consult.isPending || workflow.approve.isPending || workflow.transmit.isPending;
  const isTransmitted = ["transmitted", "completed"].includes(dossier.status);
  const effectiveReceiptNumber = receiptNumber || dossier.receipt_number || "";

  const consult = (artifact: "xml" | "receipt" | "report") => {
    void workflow.consult
      .mutateAsync({ dossierId: dossier.id, artifact, receiptNumber: effectiveReceiptNumber || undefined })
      .then(() => toast.success(artifact === "xml" ? "Declaração consultada. Revise e aprove a versão." : "Documento consultado e armazenado."))
      .catch(() => toast.error("Não foi possível consultar este documento."));
  };

  return (
    <section className="order-0 space-y-4 rounded-xl border border-sky-200 bg-sky-50/60 p-4" aria-labelledby={`dctfweb-task-${taskId}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 id={`dctfweb-task-${taskId}`} className="font-semibold">Declaração DCTFWeb</h3>
          <p className="text-xs text-muted-foreground">
            {dossier.client_name} · competência {dossier.competence_key.slice(4, 6)}/{dossier.competence_key.slice(0, 4)} · {dossier.category}
          </p>
        </div>
        <Badge variant="secondary">{labels[dossier.status] || dossier.status}</Badge>
      </div>

      <Alert>
        <AlertDescription>
          Faça a declaração por esta tarefa: consulte o XML formado com os dados do eSocial, EFD-Reinf e MIT, revise a versão, aprove e transmita o XML assinado.
        </AlertDescription>
      </Alert>

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" disabled={busy} onClick={() => consult("xml")}>
          <FileCode2 className="mr-2 h-4 w-4" />
          Consultar declaração
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={busy || dossier.status !== "consulted"}
          onClick={() => {
            void workflow.approve
              .mutateAsync({ dossierId: dossier.id, expectedVersion: dossier.data_version })
              .then(() => toast.success("Versão aprovada para transmissão."))
              .catch(() => toast.error("Não foi possível aprovar esta versão."));
          }}
        >
          <CheckCircle2 className="mr-2 h-4 w-4" />
          Revisar e aprovar
        </Button>
      </div>

      {dossier.status === "approved" ? (
        <div className="space-y-3 rounded-lg border bg-background p-3">
          <div className="space-y-1.5">
            <Label htmlFor={`dctf-xml-${dossier.id}`}>XML assinado da versão aprovada</Label>
            <Input
              id={`dctf-xml-${dossier.id}`}
              type="file"
              accept="application/xml,text/xml,.xml"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                if (file.size > 5 * 1024 * 1024) {
                  toast.error("O XML deve ter no máximo 5 MB.");
                  return;
                }
                void fileToBase64(file).then(setSignedXml).catch(() => toast.error("Não foi possível ler o XML."));
              }}
            />
          </div>
          <Button type="button" variant="destructive" disabled={busy || !signedXml} onClick={() => setConfirmTransmit(true)}>
            <Send className="mr-2 h-4 w-4" />
            Transmitir declaração
          </Button>
        </div>
      ) : null}

      {isTransmitted ? (
        <div className="space-y-3 rounded-lg border bg-background p-3">
          <div className="space-y-1.5">
            <Label htmlFor={`dctf-receipt-${dossier.id}`}>Número do recibo da transmissão</Label>
            <Input
              id={`dctf-receipt-${dossier.id}`}
              inputMode="numeric"
              value={effectiveReceiptNumber}
              onChange={(event) => setReceiptNumber(event.target.value.replace(/\D/g, ""))}
              placeholder="Informe o recibo para consultar os comprovantes"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" disabled={busy || !effectiveReceiptNumber} onClick={() => consult("receipt")}>
              <ReceiptText className="mr-2 h-4 w-4" />
              Consultar recibo
            </Button>
            <Button type="button" variant="outline" disabled={busy || !effectiveReceiptNumber} onClick={() => consult("report")}>
              <FileText className="mr-2 h-4 w-4" />
              Relatório completo
            </Button>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {dossier.xml_storage_path ? <Button variant="ghost" onClick={() => void workflow.openArtifact(dossier.id, "xml")}><Download className="mr-2 h-4 w-4" />XML</Button> : null}
        {dossier.receipt_storage_path ? <Button variant="ghost" onClick={() => void workflow.openArtifact(dossier.id, "receipt")}><Download className="mr-2 h-4 w-4" />Recibo</Button> : null}
        {dossier.report_storage_path ? <Button variant="ghost" onClick={() => void workflow.openArtifact(dossier.id, "report")}><Download className="mr-2 h-4 w-4" />Relatório</Button> : null}
      </div>

      {busy ? <p className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" />Processando declaração fiscal…</p> : null}

      <AlertDialog open={confirmTransmit} onOpenChange={setConfirmTransmit}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Transmitir a declaração DCTFWeb?</AlertDialogTitle>
            <AlertDialogDescription>
              Será transmitida exclusivamente a versão revisada e aprovada desta tarefa. No momento, a operação está restrita ao ambiente Trial.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void workflow.transmit
                  .mutateAsync({ dossierId: dossier.id, signedXmlBase64: signedXml })
                  .then(() => {
                    toast.success("Declaração DCTFWeb transmitida no ambiente Trial.");
                    setConfirmTransmit(false);
                  })
                  .catch(() => toast.error("A transmissão foi bloqueada ou não concluída."));
              }}
            >
              Confirmar transmissão
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
