import { useMemo } from "react";
import { Headset, MessageSquareText } from "lucide-react";
import { RequestChat } from "@/components/app/RequestChat";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { PortalClientRequest, PortalRequestMessage, RequestStatusMeta } from "@/components/portal/types";

interface ClientPortalSupportProps {
  requests: PortalClientRequest[];
  messages: PortalRequestMessage[];
  selectedRequestId: string | null;
  statusConfig: Record<PortalClientRequest["status"], RequestStatusMeta>;
  sectors: string[];
  onOpenRequestWithSector: (sector: string) => void;
  onSelectRequest: (requestId: string) => void;
}

export function ClientPortalSupport({
  requests,
  messages,
  selectedRequestId,
  statusConfig,
  sectors,
  onOpenRequestWithSector,
  onSelectRequest,
}: ClientPortalSupportProps) {
  const latestMessageByRequest = useMemo(() => {
    const map = new Map<string, PortalRequestMessage>();
    messages.forEach((message) => {
      if (!map.has(message.request_id)) {
        map.set(message.request_id, message);
      }
    });
    return map;
  }, [messages]);

  const conversationRequests = useMemo(
    () =>
      requests
        .filter((request) => latestMessageByRequest.has(request.id))
        .sort((a, b) => {
          const aMessage = latestMessageByRequest.get(a.id);
          const bMessage = latestMessageByRequest.get(b.id);
          return (
            new Date(bMessage?.created_at || b.updated_at).getTime() -
            new Date(aMessage?.created_at || a.updated_at).getTime()
          );
        }),
    [latestMessageByRequest, requests]
  );

  const activeRequestId = selectedRequestId || conversationRequests[0]?.id || requests[0]?.id || null;
  const activeRequest = requests.find((request) => request.id === activeRequestId) || null;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Atendimento Grow</CardTitle>
          <CardDescription>
            Use este espaco para conversar com nossa equipe com clareza e acompanhamento.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Sua mensagem sera direcionada ao setor responsavel. Voce acompanha respostas e atualizacoes sem sair do portal.
          </p>
          <div className="flex flex-wrap gap-2">
            {sectors.map((sector) => (
              <Button key={sector} variant="outline" size="sm" onClick={() => onOpenRequestWithSector(sector)}>
                {sector}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-[330px_minmax(0,1fr)] gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Conversas ativas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {conversationRequests.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Ainda nao ha conversas iniciadas. Abra uma solicitacao para comecar.
              </p>
            ) : (
              conversationRequests.map((request) => {
                const latest = latestMessageByRequest.get(request.id);
                const statusMeta = statusConfig[request.status];
                const isActive = request.id === activeRequestId;

                return (
                  <button
                    type="button"
                    key={request.id}
                    onClick={() => onSelectRequest(request.id)}
                    className={`w-full text-left rounded-lg border p-3 transition-colors ${
                      isActive ? "border-primary bg-primary/5" : "hover:bg-muted/40"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium line-clamp-1">{request.title}</p>
                      <Badge variant="outline" className={`text-[10px] border-0 ${statusMeta.className}`}>
                        {statusMeta.label}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{latest?.content || "Sem mensagem recente."}</p>
                    <p className="text-[10px] text-muted-foreground mt-2">
                      {new Date(latest?.created_at || request.updated_at).toLocaleString("pt-BR")}
                    </p>
                  </button>
                );
              })
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Headset className="h-4 w-4" />
              {activeRequest ? activeRequest.title : "Selecione uma conversa"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {activeRequest ? (
              <RequestChat requestId={activeRequest.id} isTeamMember={false} />
            ) : (
              <div className="py-10 text-center text-muted-foreground">
                <MessageSquareText className="h-8 w-8 mx-auto mb-2" />
                <p className="text-sm">Escolha uma conversa ativa para continuar o atendimento.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
