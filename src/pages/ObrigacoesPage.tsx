import { AppLayout } from "@/components/app/AppLayout";
import { GrowObligationsWorkspace } from "@/components/obligations/GrowObligationsWorkspace";
import { useLocation } from "react-router-dom";

export default function ObrigacoesPage() {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const requestedTab = searchParams.get("tab");
  const defaultTab =
    requestedTab === "catalogo" || requestedTab === "execucao" || requestedTab === "documentos"
      ? requestedTab
      : "execucao";

  return (
    <AppLayout>
      <div className="max-w-7xl space-y-6">
        <GrowObligationsWorkspace defaultTab={defaultTab} />
      </div>
    </AppLayout>
  );
}
