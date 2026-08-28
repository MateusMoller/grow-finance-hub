import type { IntegraContadorProvider, ProviderRequest, ProviderResult } from "../core/provider.ts";

export const SERPRO_TRIAL_BASE_URL = "https://gateway.apiserpro.serpro.gov.br/integra-contador-trial/v1";
// Public demonstration key published by SERPRO. It is not a production credential.
export const SERPRO_TRIAL_PUBLIC_BEARER = "06aef429-a981-3ec5-a1f8-71d38d86481e";

type TrialEnvelope = {
  status?: number;
  dados?: string;
  mensagens?: Array<{ codigo?: string; texto?: string }>;
};

export function parseTrialNewMessageIndicator(payload: TrialEnvelope) {
  if (payload.status !== 200 || typeof payload.dados !== "string") throw new Error("MALFORMED_PROVIDER_RESPONSE");
  const data = JSON.parse(payload.dados) as { codigo?: string; conteudo?: Array<{ indicadorMensagensNovas?: string }> };
  const indicator = data.conteudo?.[0]?.indicadorMensagensNovas;
  if (data.codigo !== "00" || typeof indicator !== "string") throw new Error("MALFORMED_PROVIDER_RESPONSE");
  return { hasNewMessages: indicator !== "0", indicatorCode: indicator };
}

export function createSerproTrialProvider(fetcher: typeof fetch = fetch): IntegraContadorProvider {
  return {
    async execute<I, O>(request: ProviderRequest<I>): Promise<ProviderResult<O>> {
      if (request.capabilityKey !== "caixa_postal.new_message_indicator") throw new Error("UNSUPPORTED_TRIAL_CAPABILITY");
      const response = await fetcher(`${SERPRO_TRIAL_BASE_URL}/Monitorar`, {
        method: "POST",
        headers: {
          Accept: "text/plain",
          Authorization: `Bearer ${SERPRO_TRIAL_PUBLIC_BEARER}`,
          "Content-Type": "application/json",
          "X-Request-Tag": request.requestTag,
        },
        body: JSON.stringify({
          contratante: { numero: "00000000000000", tipo: 2 },
          autorPedidoDados: { numero: "00000000000000", tipo: 2 },
          contribuinte: { numero: "99999999999", tipo: 1 },
          pedidoDados: { idSistema: "CAIXAPOSTAL", idServico: "INNOVAMSG63", versaoSistema: "1.0", dados: "" },
        }),
      });
      if (!response.ok) throw new Error(`SERPRO_HTTP_${response.status}`);
      const output = parseTrialNewMessageIndicator(await response.json()) as O;
      return { kind: "completed", output, sourceUpdatedAt: new Date().toISOString() };
    },
  };
}
