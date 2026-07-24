import { HIGH_CONFIDENCE_THRESHOLD_PERCENT } from "./types.ts";
import { normalizeConfidencePercent } from "./routing.ts";

export type WhatsAppClassificationIntent =
  | "existing_ticket_reply"
  | "new_request"
  | "thanks_or_confirmation"
  | "divergence"
  | "unknown";

export type WhatsAppClassificationResult = {
  intent: WhatsAppClassificationIntent;
  confidencePercent: number;
  suggestedTitle?: string | null;
  suggestedDescription?: string | null;
};

export function isHighConfidenceClassification(
  confidence: number | null | undefined,
  threshold = HIGH_CONFIDENCE_THRESHOLD_PERCENT,
): boolean {
  const confidencePercent = normalizeConfidencePercent(confidence);
  return confidencePercent !== null && confidencePercent >= threshold;
}

export function buildFallbackClassification(body: string | null | undefined): WhatsAppClassificationResult {
  const text = String(body ?? "").trim();

  if (!text) {
    return { intent: "unknown", confidencePercent: 0 };
  }

  const lowerText = text.toLowerCase();
  if (/\b(obrigad|valeu|ok|certo|perfeito)\b/.test(lowerText)) {
    return { intent: "thanks_or_confirmation", confidencePercent: 65 };
  }

  if (/\b(nao resolveu|não resolveu|continua|problema|erro|divergencia|divergência|incorreto)\b/.test(lowerText)) {
    return {
      intent: "divergence",
      confidencePercent: 75,
      suggestedTitle: text.slice(0, 80),
      suggestedDescription: text,
    };
  }

  return {
    intent: "new_request",
    confidencePercent: 50,
    suggestedTitle: text.slice(0, 80),
    suggestedDescription: text,
  };
}
