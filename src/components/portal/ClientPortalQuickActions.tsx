import { Button } from "@/components/ui/button";
import { Headset, History, Plus } from "lucide-react";

interface ClientPortalQuickActionsProps {
  onNewRequest: () => void;
  onOpenSupport: () => void;
  onOpenHistory: () => void;
}

export function ClientPortalQuickActions({
  onNewRequest,
  onOpenSupport,
  onOpenHistory,
}: ClientPortalQuickActionsProps) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
      <Button className="h-auto min-h-11 justify-start gap-2 px-4 py-3 text-left" onClick={onNewRequest}>
        <Plus className="h-4 w-4" /> Solicitacao livre
      </Button>
      <Button
        variant="outline"
        className="h-auto min-h-11 justify-start gap-2 bg-card px-4 py-3 text-left"
        onClick={onOpenSupport}
      >
        <Headset className="h-4 w-4" /> Atendimento por setor
      </Button>
      <Button
        variant="outline"
        className="h-auto min-h-11 justify-start gap-2 bg-card px-4 py-3 text-left"
        onClick={onOpenHistory}
      >
        <History className="h-4 w-4" /> Historico
      </Button>
    </div>
  );
}
