import { AppLayout } from "@/components/app/AppLayout";
import { GrowObligationsWorkspace } from "@/components/obligations/GrowObligationsWorkspace";
import { useLocation } from "react-router-dom";

export default function ObrigacoesPage() {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const requestedTab = searchParams.get("tab");
  const initialInstanceId = searchParams.get("instance_id");
  const defaultTab =
    requestedTab === "dashboard" || requestedTab === "catalogo" || requestedTab === "documentos" || requestedTab === "entregas"
      ? requestedTab
      : "dashboard";

  return (
    <AppLayout>
      <div className="w-full max-w-[1600px] space-y-5">
        <GrowObligationsWorkspace
          key={`${defaultTab}:${initialInstanceId || "all"}`}
          defaultTab={defaultTab}
          initialInstanceId={initialInstanceId}
        />
      </div>
    </AppLayout>
  );
}
