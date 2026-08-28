import type {
  IntegraContadorProvider,
  ProviderRequest,
  ProviderResult,
  TaxIdentifier,
} from "./provider.ts";
import type { OAuthTokenManager } from "./auth.ts";
import type { ServiceRegistryEntry } from "./registry.ts";

export type MtlsTransport = {
  send<I, O>(
    request: ProviderRequest<I>,
    tokens: { accessToken: string; jwtToken: string },
  ): Promise<{ status: number; result?: ProviderResult<O> }>;
};

type SerproParty = { numero: string; tipo: 1 | 2 | 3 | 4 };

export type SerproEnvelope = {
  contratante: SerproParty;
  autorPedidoDados: SerproParty;
  contribuinte: SerproParty;
  pedidoDados: {
    idSistema: string;
    idServico: string;
    versaoSistema: string;
    dados: string;
  };
};

function toSerproParty(identifier: TaxIdentifier): SerproParty {
  const types = { CPF: 1, CNPJ: 2, CPF_BATCH: 3, CNPJ_BATCH: 4 } as const;
  return { numero: identifier.value, tipo: types[identifier.type] };
}

export function buildSerproEnvelope<I>(
  request: ProviderRequest<I>,
  capability: ServiceRegistryEntry,
): SerproEnvelope {
  if (
    capability.capabilityKey !== request.capabilityKey ||
    !capability.externalSystemId ||
    !capability.externalServiceId ||
    !capability.externalVersion
  ) {
    throw new Error("EXTERNAL_CONTRACT_UNVERIFIED");
  }

  return {
    contratante: toSerproParty(request.authorization.contractor),
    autorPedidoDados: toSerproParty(request.authorization.requestAuthor),
    contribuinte: toSerproParty(request.authorization.taxpayer),
    pedidoDados: {
      idSistema: capability.externalSystemId,
      idServico: capability.externalServiceId,
      versaoSistema: capability.externalVersion,
      dados: JSON.stringify(request.input),
    },
  };
}

export class SerproIntegraContadorProvider implements IntegraContadorProvider {
  constructor(
    private tokens: OAuthTokenManager,
    private transport: MtlsTransport,
  ) {}

  async execute<I, O>(request: ProviderRequest<I>): Promise<ProviderResult<O>> {
    let token = await this.tokens.get(request.authorization.connectionId);
    let response = await this.transport.send<I, O>(request, token);
    if (response.status === 401) {
      await this.tokens.invalidate(request.authorization.connectionId);
      token = await this.tokens.get(request.authorization.connectionId);
      response = await this.transport.send<I, O>(request, token);
    }
    if (!response.result) throw new Error(`SERPRO_HTTP_${response.status}`);
    return response.result;
  }
}
