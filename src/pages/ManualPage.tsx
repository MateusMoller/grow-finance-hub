import { AppLayout } from "@/components/app/AppLayout";
import { ManualEngine } from "@/components/manual/ManualEngine";
import { useAuth } from "@/hooks/useAuth";

export default function ManualPage() {
  const { role } = useAuth();
  const canViewAdoption = role === "admin" || role === "director" || role === "manager";

  return (
    <AppLayout>
      <div className="max-w-7xl space-y-6">
        <ManualEngine
          mode="internal"
          title="Manual profissional de uso"
          subtitle="Trilhas interativas por contexto para capacitar equipe e clientes com padrão operacional único."
          allowedContexts={["institutional", "internal"]}
          role={role}
          canViewAdoption={canViewAdoption}
        />
      </div>
    </AppLayout>
  );
}
