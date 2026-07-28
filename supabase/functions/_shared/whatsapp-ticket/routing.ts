import {
  HIGH_CONFIDENCE_THRESHOLD_PERCENT,
  type WhatsAppTicketRouteDecision,
  type WhatsAppTicketRouteInput,
} from "./types.ts";

export const localSaoPauloParts = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hour12: false,
  }).formatToParts(date);

  const value = (type: string) => parts.find((part) => part.type === type)?.value || "";
  const hour = Number(value("hour"));
  const minute = Number(value("minute"));

  return {
    dateKey: `${value("year")}-${value("month")}-${value("day")}`,
    greeting: hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite",
    minutesOfDay: (Number.isFinite(hour) ? hour : 0) * 60 + (Number.isFinite(minute) ? minute : 0),
    weekday: value("weekday").toLowerCase(),
  };
};

export const isOutsideHumanAttendanceHours = (date = new Date()) => {
  const parts = localSaoPauloParts(date);
  const isWeekend = parts.weekday.startsWith("sáb") ||
    parts.weekday.startsWith("sab") ||
    parts.weekday.startsWith("dom");
  return isWeekend || parts.minutesOfDay >= 17 * 60;
};

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
