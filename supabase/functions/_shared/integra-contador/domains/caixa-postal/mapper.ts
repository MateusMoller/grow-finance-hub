import { parseIndicatorOutput } from "./schemas.ts";
export function mapCaixaPostalIndicator(payload: unknown, expectedTaxId?: string) {
  const row = payload as Record<string, unknown>;
  if (expectedTaxId && row.taxpayerTaxId && row.taxpayerTaxId !== expectedTaxId) throw new Error("IDENTIFIER_MISMATCH");
  return parseIndicatorOutput(payload);
}
