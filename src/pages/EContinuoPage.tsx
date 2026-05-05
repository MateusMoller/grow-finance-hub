import { AppLayout } from "@/components/app/AppLayout";
import { GrowObligationsWorkspace } from "@/components/obligations/GrowObligationsWorkspace";

export default function EContinuoPage() {
  return (
    <AppLayout>
      <div className="max-w-7xl space-y-6">
        <GrowObligationsWorkspace defaultTab="documentos" />
      </div>
    </AppLayout>
  );
}
