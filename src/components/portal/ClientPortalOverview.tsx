import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, Clock3, Sparkles } from "lucide-react";
import type { PortalActionItem, PortalSummaryMetric } from "@/components/portal/types";
import { ClientPortalQuickActions } from "@/components/portal/ClientPortalQuickActions";

interface ClientPortalOverviewProps {
  clientName: string;
  monthLabel: string;
  metrics: PortalSummaryMetric[];
  pendingNow: PortalActionItem[];
  recentUpdates: PortalActionItem[];
  onNewRequest: () => void;
  onUploadDocument: () => void;
  onOpenForms: () => void;
  onOpenSupport: () => void;
}

export function ClientPortalOverview({
  clientName,
  monthLabel,
  metrics,
  pendingNow,
  recentUpdates,
  onNewRequest,
  onUploadDocument,
  onOpenForms,
  onOpenSupport,
}: ClientPortalOverviewProps) {
  return (
    <div className="space-y-5">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="space-y-1">
              <CardTitle className="text-xl">Ola, {clientName}</CardTitle>
              <CardDescription className="text-sm">
                Aqui voce acompanha solicitacoes, documentos e pendencias em um fluxo unico.
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-xs">
              Resumo de {monthLabel}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <ClientPortalQuickActions
            onNewRequest={onNewRequest}
            onUploadDocument={onUploadDocument}
            onOpenForms={onOpenForms}
            onOpenSupport={onOpenSupport}
          />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
        {metrics.map((metric) => (
          <div key={metric.label} className="rounded-xl border bg-card p-4">
            <p className="text-xs text-muted-foreground">{metric.label}</p>
            <p className="text-2xl font-semibold mt-1">{metric.value}</p>
            <p className="text-[11px] text-muted-foreground mt-1">{metric.helper}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock3 className="h-4 w-4 text-amber-600" />
              O que precisa da sua acao
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {pendingNow.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Tudo certo por enquanto. Assim que houver nova pendencia, ela aparece aqui.
              </p>
            ) : (
              pendingNow.map((item) => (
                <div key={item.id} className="rounded-lg border bg-background px-3 py-2.5">
                  <p className="text-sm font-medium">{item.title}</p>
                  {item.description && <p className="text-xs text-muted-foreground mt-1">{item.description}</p>}
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    {item.sector && (
                      <Badge variant="outline" className="text-[10px]">
                        {item.sector}
                      </Badge>
                    )}
                    {item.dueDate && (
                      <span className="text-[10px] text-muted-foreground">
                        Prazo: {new Date(item.dueDate).toLocaleDateString("pt-BR")}
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Atualizacoes recentes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {recentUpdates.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Ainda nao temos atualizacoes recentes. Voce recebera novidades por aqui.
              </p>
            ) : (
              recentUpdates.map((item) => (
                <div key={item.id} className="rounded-lg border bg-background px-3 py-2.5">
                  <p className="text-sm font-medium">{item.title}</p>
                  {item.description && <p className="text-xs text-muted-foreground mt-1">{item.description}</p>}
                  <div className="flex items-center justify-between mt-2">
                    {item.sector ? (
                      <Badge variant="secondary" className="text-[10px]">
                        {item.sector}
                      </Badge>
                    ) : (
                      <span />
                    )}
                    {item.dueDate ? (
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(item.dueDate).toLocaleDateString("pt-BR")}
                      </span>
                    ) : (
                      <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                    )}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
