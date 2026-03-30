import { Button } from "@/components/ui/button";
import { ClipboardList, Headset, Plus, Upload } from "lucide-react";

interface ClientPortalQuickActionsProps {
  onNewRequest: () => void;
  onUploadDocument: () => void;
  onOpenForms: () => void;
  onOpenSupport: () => void;
}

export function ClientPortalQuickActions({
  onNewRequest,
  onUploadDocument,
  onOpenForms,
  onOpenSupport,
}: ClientPortalQuickActionsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
      <Button className="justify-start gap-2" onClick={onNewRequest}>
        <Plus className="h-4 w-4" /> Nova solicitacao
      </Button>
      <Button variant="outline" className="justify-start gap-2 bg-card" onClick={onUploadDocument}>
        <Upload className="h-4 w-4" /> Enviar documentos
      </Button>
      <Button variant="outline" className="justify-start gap-2 bg-card" onClick={onOpenForms}>
        <ClipboardList className="h-4 w-4" /> Preencher formulario
      </Button>
      <Button variant="outline" className="justify-start gap-2 bg-card" onClick={onOpenSupport}>
        <Headset className="h-4 w-4" /> Falar com a equipe
      </Button>
    </div>
  );
}
