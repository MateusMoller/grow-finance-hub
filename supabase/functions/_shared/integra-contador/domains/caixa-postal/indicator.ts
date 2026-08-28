import type { IntegraContadorProvider, ProviderRequest, ProviderResult } from "../../core/provider.ts";
import { mapCaixaPostalIndicator } from "./mapper.ts";
import type { CaixaPostalIndicator, CaixaPostalIndicatorInput } from "./types.ts";
export async function fetchCaixaPostalIndicator(provider: IntegraContadorProvider, request: ProviderRequest<CaixaPostalIndicatorInput>): Promise<ProviderResult<CaixaPostalIndicator>> {
  const result = await provider.execute<CaixaPostalIndicatorInput, unknown>(request);
  if (result.kind !== "completed") return result;
  return { ...result, output: mapCaixaPostalIndicator(result.output, request.input.taxpayer.value) };
}
