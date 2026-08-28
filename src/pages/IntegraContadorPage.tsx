import { AppLayout } from "@/components/app/AppLayout";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ConnectionHealthCard } from "@/features/integra-contador/components/ConnectionHealthCard";
import { ConnectionSettingsForm } from "@/features/integra-contador/components/ConnectionSettingsForm";
import { useIntegraContadorConnection } from "@/features/integra-contador/hooks/useIntegraContadorConnection";
import { useAuth } from "@/hooks/useAuth";
import { Tabs,TabsContent,TabsList,TabsTrigger } from "@/components/ui/tabs";
import { FiscalClientsTable } from "@/features/integra-contador/components/FiscalClientsTable";
import { FiscalSyncRunsTable } from "@/features/integra-contador/components/FiscalSyncRunsTable";
import { useFiscalSyncRuns } from "@/features/integra-contador/hooks/useFiscalSyncRuns";
import { useSearchParams } from "react-router-dom";

const integraContadorTabs = new Set(["overview", "clients", "monitoring", "settings"]);

export default function IntegraContadorPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { currentOrganizationId, effectiveAccess } = useAuth();
  const isAdmin = effectiveAccess?.primaryRole === "admin";
  const { statusQuery, configureMutation, testMutation } = useIntegraContadorConnection(currentOrganizationId);
  const monitoring=useFiscalSyncRuns(currentOrganizationId,{});
  const requestedTab = searchParams.get("tab") || "overview";
  const activeTab = integraContadorTabs.has(requestedTab) ? requestedTab : "overview";
  return <AppLayout><main className="mx-auto w-full max-w-5xl space-y-6 p-4 md:p-8">
    <div><h1 className="text-2xl font-semibold">Integra Contador</h1><p className="text-muted-foreground">Conexão segura com os serviços fiscais da Receita Federal.</p></div>
    {statusQuery.isError ? <Alert variant="destructive"><AlertDescription>Não foi possível consultar o estado da integração.</AlertDescription></Alert> : null}
    <Tabs value={activeTab} onValueChange={(tab) => setSearchParams(tab === "overview" ? {} : { tab }, { replace: true })}><TabsList className="grid h-auto grid-cols-2 md:grid-cols-4"><TabsTrigger value="overview">Visão geral</TabsTrigger><TabsTrigger value="clients">Clientes</TabsTrigger><TabsTrigger value="monitoring">Monitoramento</TabsTrigger><TabsTrigger value="settings">Configurações</TabsTrigger></TabsList>
      <TabsContent value="overview" className="space-y-4"><ConnectionHealthCard connection={statusQuery.data ?? null} canTest={isAdmin} testing={testMutation.isPending} onTest={() => testMutation.mutate()} /><div className="grid gap-3 sm:grid-cols-3">{Object.entries((monitoring.summary.data?.runs as Record<string,number>|undefined)||{}).map(([status,total])=><div key={status} className="rounded-lg border p-4"><span className="text-sm text-muted-foreground">{status}</span><strong className="block text-2xl">{total}</strong></div>)}</div></TabsContent>
      <TabsContent value="clients">{currentOrganizationId?<FiscalClientsTable organizationId={currentOrganizationId}/>:null}</TabsContent>
      <TabsContent value="monitoring"><FiscalSyncRunsTable runs={monitoring.runs.data||[]} isLoading={monitoring.runs.isLoading} canReprocess={isAdmin} reprocessing={monitoring.reprocess.isPending} onReprocess={id=>monitoring.reprocess.mutate(id)}/></TabsContent>
      <TabsContent value="settings">{isAdmin && currentOrganizationId ? <ConnectionSettingsForm organizationId={currentOrganizationId} submitting={configureMutation.isPending} onSubmit={async (input) => { await configureMutation.mutateAsync(input); }} /> : <Alert><AlertDescription>Somente administradores podem alterar credenciais e validar a conexão.</AlertDescription></Alert>}</TabsContent>
    </Tabs>
  </main></AppLayout>;
}
