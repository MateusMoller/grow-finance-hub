import {
  HIGH_CONFIDENCE_THRESHOLD_PERCENT,
  type WhatsAppTicketRouteDecision,
  type WhatsAppTicketRouteInput,
} from "./types.ts";

export function normalizeConfidencePercent(confidence: number | null | undefined): number | null {
  if (confidence === null || confidence === undefined || Number.isNaN(confidence)) {
    return null;
  }

  if (confidence >= 0 && confidence <= 1) {
    return Math.round(confidence * 100);
  }

  return Math.max(0, Math.min(100, Math.round(confidence)));
}

export function resolveWhatsAppTicketRoute(
  input: WhatsAppTicketRouteInput,
  highConfidenceThreshold = HIGH_CONFIDENCE_THRESHOLD_PERCENT,
): WhatsAppTicketRouteDecision {
  if (input.quotedTicketId) {
    return {
      source: "quoted_reply",
      ticketId: input.quotedTicketId,
      confidencePercent: 100,
      reason: "Mensagem respondeu a uma mensagem vinculada ao ticket.",
    };
  }

  if (input.interactiveTicketId) {
    return {
      source: "interactive_selection",
      ticketId: input.interactiveTicketId,
      confidencePercent: 100,
      reason: "Cliente selecionou o ticket em mensagem interativa oficial.",
    };
  }

  if (input.protocolTicketId) {
    return {
      source: "protocol",
      ticketId: input.protocolTicketId,
      confidencePercent: 100,
      reason: "Mensagem mencionou um protocolo publico conhecido.",
    };
  }

  if (input.activeContextTicketId) {
    return {
      source: "active_context",
      ticketId: input.activeContextTicketId,
      confidencePercent: 100,
      reason: "Conversa possui contexto ativo de ticket dentro da janela configurada.",
    };
  }

  const confidencePercent = normalizeConfidencePercent(input.inferenceConfidence);
  if (input.inferredTicketId && confidencePercent !== null && confidencePercent >= highConfidenceThreshold) {
    return {
      source: "inference",
      ticketId: input.inferredTicketId,
      confidencePercent,
      reason: "Classificacao automatica atingiu o limite minimo de confianca.",
    };
  }

  return {
    source: "unrouted",
    ticketId: null,
    confidencePercent,
    reason: "Nenhum roteamento deterministico ou classificacao confiavel foi encontrado.",
  };
}

export function buildWebhookIdempotencyKey(input: {
  organizationId: string;
  providerMessageId?: string | null;
  clientMessageId?: string | null;
  fallbackTimestamp?: string | number | null;
  fallbackPhone?: string | null;
}): string {
  const sourceId =
    input.providerMessageId?.trim() ||
    input.clientMessageId?.trim() ||
    `${input.fallbackPhone ?? "unknown"}:${input.fallbackTimestamp ?? "unknown"}`;

  return `${input.organizationId}:whatsapp:${sourceId}`;
}

export function shouldCreateAutomaticTask(confidence: number | null | undefined): boolean {
  const confidencePercent = normalizeConfidencePercent(confidence);
  return confidencePercent !== null && confidencePercent >= HIGH_CONFIDENCE_THRESHOLD_PERCENT;
}
