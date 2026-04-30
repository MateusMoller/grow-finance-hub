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
  onOpenSupport: () => void;
  onOpenHistory: () => void;
}

export function ClientPortalOverview({
  clientName,
  monthLabel,
  metrics,
  pendingNow,
  recentUpdates,
  onNewRequest,
  onOpenSupport,
  onOpenHistory,
}: ClientPortalOverviewProps) {
  return (
    <div className="space-y-5">
      <Card className="overflow-hidden border-primary/10 shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <CardTitle className="text-xl">Ola, {clientName}</CardTitle>
              <CardDescription className="max-w-2xl text-sm leading-relaxed">
                Aqui voce acompanha solicitacoes, documentos e pendencias em um fluxo unico.
              </CardDescription>
            </div>
            <Badge variant="outline" className="w-fit text-xs">
              Resumo de {monthLabel}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <ClientPortalQuickActions
            onNewRequest={onNewRequest}
            onOpenSupport={onOpenSupport}
            onOpenHistory={onOpenHistory}
          />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {metrics.map((metric) => (
          <div key={metric.label} className="rounded-2xl border bg-card p-4 shadow-sm">
            <p className="text-xs leading-relaxed text-muted-foreground">{metric.label}</p>
            <p className="mt-1 text-2xl font-semibold">{metric.value}</p>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{metric.helper}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock3 className="h-4 w-4 text-amber-600" />
              O que precisa da sua acao
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {pendingNow.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Tudo certo por enquanto. Assim que houver nova pendencia, ela aparece aqui.
              </p>
            ) : (
              pendingNow.map((item) => (
                <div key={item.id} className="rounded-xl border bg-background px-3 py-3">
                  <p className="text-sm font-medium">{item.title}</p>
                  {item.description && <p className="mt-1 text-xs text-muted-foreground">{item.description}</p>}
                  <div className="mt-2 flex flex-wrap items-center gap-2">
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
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-primary" />
              Atualizacoes recentes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {recentUpdates.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Ainda nao temos atualizacoes recentes. Voce recebera novidades por aqui.
              </p>
            ) : (
              recentUpdates.map((item) => (
                <div key={item.id} className="rounded-xl border bg-background px-3 py-3">
                  <p className="text-sm font-medium">{item.title}</p>
                  {item.description && <p className="mt-1 text-xs text-muted-foreground">{item.description}</p>}
                  <div className="mt-2 flex items-center justify-between gap-2">
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
