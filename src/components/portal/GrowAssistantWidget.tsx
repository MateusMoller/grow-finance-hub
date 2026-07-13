import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Bot, CheckCircle2, Loader2, MessageSquarePlus, Send, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  askGrowAssistant,
  confirmGrowAssistantAction,
  type GrowAssistantResponse,
} from "@/lib/ai/growAssistant";
import { cn } from "@/lib/utils";

type AssistantMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  response?: GrowAssistantResponse;
};

const quickPrompts = [
  "Quais documentos estão pendentes?",
  "Minhas guias estão prontas?",
  "Qual o status do meu chamado?",
] as const;

function riskVariant(riskLevel: GrowAssistantResponse["safety"]["riskLevel"]) {
  if (riskLevel === "alto") return "destructive";
  if (riskLevel === "medio") return "secondary";
  return "outline";
}

function buildActionLabel(response: GrowAssistantResponse) {
  switch (response.action.type) {
    case "created_ticket":
      return "Chamado criado";
    case "duplicate_found":
      return "Duplicidade encontrada";
    case "confirmation_required":
      return "Confirmação necessária";
    case "human_review_required":
      return "Validação humana";
    default:
      return "Sem ação";
  }
}

export interface GrowAssistantWidgetProps {
  clientId: string;
  clientName: string;
  className?: string;
  onRequestHumanSupport?: () => void;
}

export function GrowAssistantWidget({
  clientId,
  clientName,
  className,
  onRequestHumanSupport,
}: GrowAssistantWidgetProps) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<AssistantMessage[]>([
    {
      id: "assistant-welcome",
      role: "assistant",
      text: `Sou a assistente operacional da Grow para ${clientName}. Posso consultar pendências, status de chamados, guias e preparar solicitações com segurança.`,
    },
  ]);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const viewport = scrollRef.current?.querySelector("[data-radix-scroll-area-viewport]");
    if (viewport instanceof HTMLElement) {
      viewport.scrollTop = viewport.scrollHeight;
    }
  }, [messages, loading]);

  const appendConversation = async (messageText: string) => {
    const normalizedMessage = messageText.trim();
    if (!normalizedMessage || loading) return;

    const userEntry: AssistantMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      text: normalizedMessage,
    };

    setMessages((prev) => [...prev, userEntry]);
    setInput("");
    setLoading(true);

    try {
      const response = await askGrowAssistant({
        clienteId: clientId,
        message: normalizedMessage,
        channel: "portal",
      });

      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          text: response.reply,
          response,
        },
      ]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao consultar a assistente Grow.";
      toast.error(message);
      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-error-${Date.now()}`,
          role: "assistant",
          text: "Não consegui concluir esta consulta agora. Tente novamente ou encaminhe para a equipe.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    await appendConversation(input);
  };

  const handleConfirmAction = async (response: GrowAssistantResponse) => {
    const actionId = response.action.actionId;
    if (!actionId || loading) return;

    setLoading(true);
    try {
      const confirmation = await confirmGrowAssistantAction({
        actionId,
        confirm: true,
      });

      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-confirm-${Date.now()}`,
          role: "assistant",
          text: confirmation.reply,
          response: confirmation,
        },
      ]);
      toast.success("Ação confirmada com sucesso.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao confirmar a ação.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className={cn("border-border/70 shadow-sm", className)}>
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Bot className="h-4.5 w-4.5" />
              </div>
              <div>
                <CardTitle className="text-base">Assistente Grow</CardTitle>
                <p className="text-sm text-muted-foreground">Triagem segura para pendências, guias, relatórios e chamados.</p>
              </div>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full sm:w-auto"
            onClick={onRequestHumanSupport}
          >
            <MessageSquarePlus className="mr-1.5 h-4 w-4" />
            Atendimento humano
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {quickPrompts.map((prompt) => (
            <Button
              key={prompt}
              type="button"
              variant="outline"
              size="sm"
              className="h-auto rounded-full px-3 py-1.5 text-xs"
              onClick={() => void appendConversation(prompt)}
              disabled={loading}
            >
              {prompt}
            </Button>
          ))}
        </div>

        <ScrollArea ref={scrollRef} className="h-[360px] rounded-2xl border bg-muted/10 p-3">
          <div className="space-y-3 pr-3">
            {messages.map((message) => {
              const response = message.response;
              const isAssistant = message.role === "assistant";

              return (
                <div
                  key={message.id}
                  className={cn(
                    "max-w-[92%] rounded-2xl px-4 py-3 text-sm shadow-sm",
                    isAssistant
                      ? "border border-border/70 bg-card text-foreground"
                      : "ml-auto bg-primary text-primary-foreground",
                  )}
                >
                  <p className="whitespace-pre-wrap leading-relaxed">{message.text}</p>

                  {response ? (
                    <div className="mt-3 space-y-3">
                      <Separator />
                      <div className="flex flex-wrap gap-2">
                        <Badge variant={riskVariant(response.safety.riskLevel)}>
                          {response.safety.riskLevel === "alto" ? <ShieldAlert className="mr-1 h-3 w-3" /> : <CheckCircle2 className="mr-1 h-3 w-3" />}
                          Risco {response.safety.riskLevel}
                        </Badge>
                        <Badge variant="secondary">{buildActionLabel(response)}</Badge>
                        {response.detectedIntent ? <Badge variant="outline">{response.detectedIntent}</Badge> : null}
                      </div>

                      {response.safety.requiresHumanReview ? (
                        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                          <div className="flex items-center gap-2 font-medium">
                            <AlertTriangle className="h-3.5 w-3.5" />
                            Este pedido exige validação humana antes de prosseguir.
                          </div>
                        </div>
                      ) : null}

                      {response.safety.requiresConfirmation && response.action.actionId ? (
                        <div className="flex flex-col gap-2 sm:flex-row">
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => void handleConfirmAction(response)}
                            disabled={loading}
                          >
                            {loading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-1.5 h-4 w-4" />}
                            Confirmar ação
                          </Button>
                          <Button type="button" variant="outline" size="sm" onClick={onRequestHumanSupport}>
                            Encaminhar para humano
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            })}

            {loading ? (
              <div className="flex max-w-[92%] items-center gap-2 rounded-2xl border border-border/70 bg-card px-4 py-3 text-sm text-muted-foreground shadow-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                Processando com contexto seguro do cliente...
              </div>
            ) : null}
          </div>
        </ScrollArea>

        <div className="rounded-2xl border bg-background p-3">
          <div className="space-y-3">
            <Textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ex.: Minhas guias estão prontas? Quais documentos estão pendentes?"
              className="min-h-[96px] resize-none border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
            />
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-muted-foreground">
                Dados de outros clientes nunca entram neste contexto.
              </p>
              <Button type="button" onClick={() => void handleSubmit()} disabled={loading || !input.trim()}>
                {loading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Send className="mr-1.5 h-4 w-4" />}
                Enviar
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
