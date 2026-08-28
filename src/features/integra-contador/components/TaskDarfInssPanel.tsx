import { useState } from "react";
import { Download, Loader2, ReceiptText } from "lucide-react";
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
import { useTaskDarfInss } from "../hooks/useTaskDarfInss";

type Props = { organizationId: string | null; taskId: string; integrationSource?: string | null };

const reasonMessages: Record<string, string> = {
  dctfweb_declaration_required: "A declaração DCTFWeb desta competência ainda não foi preparada.",
  dctfweb_transmission_required: "Transmita primeiro a DCTFWeb desta competência para liberar a emissão do DARF - INSS.",
  invalid_obligation_competence: "A competência desta obrigação não é válida para a emissão do DARF - INSS.",
};

export function TaskDarfInssPanel({ organizationId, taskId, integrationSource }: Props) {
  const workflow = useTaskDarfInss(organizationId, taskId, integrationSource === "grow_obligation_task");
  const context = workflow.query.data;
  const dossier = context?.dossier;
  const [receiptNumber, setReceiptNumber] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  if (integrationSource !== "grow_obligation_task" || workflow.query.isLoading) return null;
  if (workflow.query.isError) return <Alert variant="destructive" className="order-0"><AlertDescription>Não foi possível preparar a emissão do DARF - INSS.</AlertDescription></Alert>;
  if (!context?.eligible) return null;

  const effectiveReceipt = receiptNumber || dossier?.receipt_number || "";
  const blockedMessage = context.reason ? reasonMessages[context.reason] : null;

  return (
    <section className="order-0 space-y-4 rounded-xl border border-amber-200 bg-amber-50/60 p-4" aria-labelledby={`darf-inss-task-${taskId}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 id={`darf-inss-task-${taskId}`} className="font-semibold">Emissão do DARF - INSS</h3>
          <p className="text-xs text-muted-foreground">Documento previdenciário vinculado à DCTFWeb da mesma competência.</p>
        </div>
        <Badge variant="secondary">Automação SERPRO</Badge>
      </div>

      {blockedMessage ? <Alert><AlertDescription>{blockedMessage}</AlertDescription></Alert> : null}

      {dossier && !blockedMessage && context.targetInstanceId ? (
        <>
          <div className="space-y-1.5">
            <Label htmlFor={`darf-inss-receipt-${taskId}`}>Número do recibo da DCTFWeb</Label>
            <Input
              id={`darf-inss-receipt-${taskId}`}
              inputMode="numeric"
              value={effectiveReceipt}
              onChange={(event) => setReceiptNumber(event.target.value.replace(/\D/g, ""))}
              placeholder="Informe o recibo da declaração transmitida"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" disabled={!effectiveReceipt || workflow.generate.isPending} onClick={() => setConfirmOpen(true)}>
              {workflow.generate.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ReceiptText className="mr-2 h-4 w-4" />}
              Gerar DARF - INSS
            </Button>
            {dossier.darf_storage_path ? (
              <Button type="button" variant="outline" onClick={() => void workflow.openDarf(dossier.id)}>
                <Download className="mr-2 h-4 w-4" />
                Baixar DARF
              </Button>
            ) : null}
          </div>
        </>
      ) : null}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Gerar o DARF - INSS?</AlertDialogTitle>
            <AlertDialogDescription>A guia será emitida para este cliente e competência, usando o recibo da DCTFWeb transmitida.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                if (!dossier || !context.targetInstanceId) return;
                void workflow.generate.mutateAsync({ dossierId: dossier.id, receiptNumber: effectiveReceipt, targetInstanceId: context.targetInstanceId })
                  .then(() => { toast.success("DARF - INSS gerado e vinculado à obrigação."); setConfirmOpen(false); })
                  .catch(() => toast.error("Não foi possível gerar o DARF - INSS."));
              }}
            >Confirmar emissão</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
