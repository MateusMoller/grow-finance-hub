import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, Clock3, Sparkles } from "lucide-react";
import type { PortalActionItem } from "@/components/portal/types";
import { ClientPortalQuickActions } from "@/components/portal/ClientPortalQuickActions";

interface ClientPortalOverviewProps {
  clientName: string;
  monthLabel: string;
  pendingNow: PortalActionItem[];
  recentUpdates: PortalActionItem[];
  onOpenRequestDetail: (requestId: string) => void;
  onNewRequest: () => void;
  onOpenSupport: () => void;
  onOpenHistory: () => void;
}

export function ClientPortalOverview({
  clientName,
  monthLabel,
  pendingNow,
  recentUpdates,
  onOpenRequestDetail,
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
                <button
                  key={item.id}
                  type="button"
                  className="w-full rounded-xl border bg-background px-3 py-3 text-left transition-colors hover:bg-muted/20"
                  onClick={() => item.requestId && onOpenRequestDetail(item.requestId)}
                  disabled={!item.requestId}
                >
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
                </button>
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
                <button
                  key={item.id}
                  type="button"
                  className="w-full rounded-xl border bg-background px-3 py-3 text-left transition-colors hover:bg-muted/20"
                  onClick={() => item.requestId && onOpenRequestDetail(item.requestId)}
                  disabled={!item.requestId}
                >
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
                </button>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
