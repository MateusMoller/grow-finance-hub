import { AppLayout } from "@/components/app/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Activity, FileClock, RefreshCcw, Bot, MessageCircleWarning } from "lucide-react";

type AuditRow = {
  id: string;
  action: string;
  result: string;
  entity_type: string | null;
  created_at: string;
  metadata: Record<string, unknown>;
};

type InboxRow = {
  id: string;
  file_name: string;
  status: string;
  created_at: string;
};

type WebhookLogRow = {
  id: string;
  message_type?: string | null;
  processing_status?: string | null;
  created_at: string;
};

const formatDateTime = (value: string | null | undefined) =>
  value ? new Date(value).toLocaleString("pt-BR") : "-";

export default function OperationalHealthPage() {
  const { currentOrganizationId } = useAuth();

  const healthQuery = useQuery({
    queryKey: ["operational-health", currentOrganizationId],
    enabled: Boolean(currentOrganizationId),
    queryFn: async () => {
      if (!currentOrganizationId) {
        return {
          recentFailures: [] as AuditRow[],
          pendingDocuments: [] as InboxRow[],
          aiPending: [] as AuditRow[],
          webhookErrors: [] as WebhookLogRow[],
        };
      }

      const [failuresRes, pendingDocumentsRes, aiPendingRes, webhookErrorsRes] = await Promise.all([
        supabase
          .from("operational_audit_logs")
          .select("id, action, result, entity_type, created_at, metadata")
          .eq("organization_id", currentOrganizationId)
          .neq("result", "success")
          .order("created_at", { ascending: false })
          .limit(10),
        supabase
          .from("document_inbox_items")
          .select("id, file_name, status, created_at")
          .eq("organization_id", currentOrganizationId)
          .eq("status", "pending_review")
          .order("created_at", { ascending: false })
          .limit(10),
        supabase
          .from("operational_audit_logs")
          .select("id, action, result, entity_type, created_at, metadata")
          .eq("organization_id", currentOrganizationId)
          .ilike("action", "%ai%")
          .order("created_at", { ascending: false })
          .limit(10),
        supabase
          .from("whatsapp_webhook_logs")
          .select("id, message_type, processing_status, created_at")
          .eq("organization_id", currentOrganizationId)
          .neq("processing_status", "processed")
          .order("created_at", { ascending: false })
          .limit(10),
      ]);

      if (failuresRes.error) throw failuresRes.error;
      if (pendingDocumentsRes.error) throw pendingDocumentsRes.error;
      if (aiPendingRes.error) throw aiPendingRes.error;
      if (webhookErrorsRes.error) throw webhookErrorsRes.error;

      return {
        recentFailures: (failuresRes.data || []) as AuditRow[],
        pendingDocuments: (pendingDocumentsRes.data || []) as InboxRow[],
        aiPending: (aiPendingRes.data || []) as AuditRow[],
        webhookErrors: (webhookErrorsRes.data || []) as WebhookLogRow[],
      };
    },
  });

  const data = healthQuery.data;

  const metrics = [
    {
      label: "Falhas recentes",
      value: data?.recentFailures.length || 0,
      icon: AlertTriangle,
      tone: "text-destructive",
    },
    {
      label: "Documentos pendentes",
      value: data?.pendingDocuments.length || 0,
      icon: FileClock,
      tone: "text-amber-600",
    },
    {
      label: "Eventos de IA",
      value: data?.aiPending.length || 0,
      icon: Bot,
      tone: "text-blue-600",
    },
    {
      label: "Webhooks com atenção",
      value: data?.webhookErrors.length || 0,
      icon: MessageCircleWarning,
      tone: "text-violet-600",
    },
  ];

  return (
    <AppLayout>
      <div className="max-w-7xl space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-heading text-2xl font-bold">Saúde operacional</h1>
            <p className="text-sm text-muted-foreground">
              Falhas, documentos pendentes, integrações e eventos críticos por organização.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void healthQuery.refetch()}
            disabled={healthQuery.isFetching}
          >
            <RefreshCcw className={healthQuery.isFetching ? "mr-2 h-4 w-4 animate-spin" : "mr-2 h-4 w-4"} />
            Atualizar
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {metrics.map((metric) => (
            <Card key={metric.label}>
              <CardContent className="flex items-center justify-between p-5">
                <div>
                  <p className="text-xs text-muted-foreground">{metric.label}</p>
                  <p className="mt-1 text-2xl font-semibold">{metric.value}</p>
                </div>
                <metric.icon className={`h-5 w-5 ${metric.tone}`} />
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Activity className="h-4 w-4" />
                Falhas recentes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {(data?.recentFailures || []).length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma falha recente registrada.</p>
              ) : (
                data!.recentFailures.map((item) => (
                  <div key={item.id} className="rounded-lg border p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium">{item.action}</p>
                      <Badge variant="destructive">{item.result}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(item.created_at)}</p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileClock className="h-4 w-4" />
                Documentos pendentes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {(data?.pendingDocuments || []).length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum documento pendente na fila.</p>
              ) : (
                data!.pendingDocuments.map((item) => (
                  <div key={item.id} className="rounded-lg border p-3">
                    <p className="text-sm font-medium">{item.file_name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {item.status} · {formatDateTime(item.created_at)}
                    </p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
