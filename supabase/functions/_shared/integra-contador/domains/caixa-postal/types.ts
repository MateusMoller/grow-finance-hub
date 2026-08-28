import type { TaxIdentifier } from "../../core/provider.ts";
export const CAIXA_POSTAL_INDICATOR_CAPABILITY = "caixa_postal.new_message_indicator";
export type CaixaPostalIndicatorInput = { taxpayer: TaxIdentifier };
export type CaixaPostalIndicator = { hasNewMessages: boolean; indicatorCode?: string; sourceUpdatedAt?: string };
