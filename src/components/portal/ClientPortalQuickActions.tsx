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
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
      <Button className="justify-start gap-2" onClick={onNewRequest}>
        <Plus className="h-4 w-4" /> Solicitacao livre
      </Button>
      <Button variant="outline" className="justify-start gap-2 bg-card" onClick={onUploadDocument}>
        <Upload className="h-4 w-4" /> Enviar documentos
      </Button>
      <Button variant="outline" className="justify-start gap-2 bg-card" onClick={onOpenSupport}>
        <Headset className="h-4 w-4" /> Atendimento por setor
      </Button>
    </div>
  );
}
