import { Button } from "@/components/ui/button";
import { Headset, Plus, Upload } from "lucide-react";

interface ClientPortalQuickActionsProps {
  onNewRequest: () => void;
  onUploadDocument: () => void;
  onOpenSupport: () => void;
}

export function ClientPortalQuickActions({
  onNewRequest,
  onUploadDocument,
  onOpenSupport,
}: ClientPortalQuickActionsProps) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
      <Button className="h-auto min-h-11 justify-start gap-2 px-4 py-3 text-left" onClick={onNewRequest}>
        <Plus className="h-4 w-4" /> Solicitacao livre
      </Button>
      <Button
        variant="outline"
        className="h-auto min-h-11 justify-start gap-2 bg-card px-4 py-3 text-left"
        onClick={onUploadDocument}
      >
        <Upload className="h-4 w-4" /> Enviar documentos
      </Button>
      <Button
        variant="outline"
        className="h-auto min-h-11 justify-start gap-2 bg-card px-4 py-3 text-left sm:col-span-2 xl:col-span-1"
        onClick={onOpenSupport}
      >
        <Headset className="h-4 w-4" /> Atendimento por setor
      </Button>
    </div>
  );
}
