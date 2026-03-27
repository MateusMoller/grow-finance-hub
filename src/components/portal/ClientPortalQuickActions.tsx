import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Atalhos rapidos</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
        <Button className="justify-start gap-2" onClick={onNewRequest}>
          <Plus className="h-4 w-4" /> Nova solicitacao
        </Button>
        <Button variant="outline" className="justify-start gap-2" onClick={onUploadDocument}>
          <Upload className="h-4 w-4" /> Enviar documentos
        </Button>
        <Button variant="outline" className="justify-start gap-2" onClick={onOpenForms}>
          <ClipboardList className="h-4 w-4" /> Preencher formulario
        </Button>
        <Button variant="outline" className="justify-start gap-2" onClick={onOpenSupport}>
          <Headset className="h-4 w-4" /> Falar com a equipe
        </Button>
      </CardContent>
    </Card>
  );
}
