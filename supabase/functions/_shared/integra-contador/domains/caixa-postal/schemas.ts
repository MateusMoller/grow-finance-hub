import { normalizeTaxIdentifier } from "../../core/identifiers.ts";
import type { CaixaPostalIndicator } from "./types.ts";
export function parseIndicatorInput(value: unknown) {
  const row = value as { taxpayer?: { type?: unknown; value?: unknown } };
  if (!row?.taxpayer || !["CPF", "CNPJ"].includes(String(row.taxpayer.type))) throw new Error("INVALID_TAX_IDENTIFIER");
  const taxpayer = normalizeTaxIdentifier(String(row.taxpayer.value));
  if (taxpayer.type !== String(row.taxpayer.type)) throw new Error("INVALID_TAX_IDENTIFIER");
  return { taxpayer };
}
export function parseIndicatorOutput(value: unknown): CaixaPostalIndicator {
  const row = value as Record<string, unknown>;
  if (!row || typeof row.hasNewMessages !== "boolean") throw new Error("MALFORMED_PROVIDER_RESPONSE");
  if (row.indicatorCode != null && typeof row.indicatorCode !== "string") throw new Error("MALFORMED_PROVIDER_RESPONSE");
  return { hasNewMessages: row.hasNewMessages, indicatorCode: row.indicatorCode as string | undefined, sourceUpdatedAt: row.sourceUpdatedAt as string | undefined };
}
