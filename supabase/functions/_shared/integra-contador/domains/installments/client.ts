export const INSTALLMENT_MODALITIES = [
  "PARCSN", "PARCSN-ESP", "PERTSN", "RELPSN",
  "PARCMEI", "PARCMEI-ESP", "PERTMEI", "RELPMEI",
] as const;

export type InstallmentModality = typeof INSTALLMENT_MODALITIES[number];
export type InstallmentOperation = "list" | "detail" | "payment" | "printable" | "issue";

type ServiceDefinition = {
  system: InstallmentModality;
  services: Record<InstallmentOperation, string>;
  procurationCodes: string[];
};

const serviceSuffixes: Record<InstallmentModality, number> = {
  PARCSN: 16, "PARCSN-ESP": 17, PERTSN: 18, RELPSN: 19,
  PARCMEI: 20, "PARCMEI-ESP": 21, PERTMEI: 22, RELPMEI: 23,
};

const procurations: Record<InstallmentModality, string[]> = {
  PARCSN: ["00076", "00188"],
  "PARCSN-ESP": ["00125"],
  PERTSN: ["00149", "10011"],
  RELPSN: ["00210", "10036"],
  PARCMEI: ["00134"],
  "PARCMEI-ESP": ["00133"],
  PERTMEI: ["00152", "10012"],
  RELPMEI: ["00209", "10035"],
};

export const INSTALLMENT_SERVICE_REGISTRY = Object.fromEntries(
  INSTALLMENT_MODALITIES.map((system) => {
    const suffix = serviceSuffixes[system];
    return [system, {
      system,
      services: {
        issue: `GERARDAS${suffix}1`,
        printable: `PARCELASPARAGERAR${suffix}2`,
        list: `PEDIDOSPARC${suffix}3`,
        detail: `OBTERPARC${suffix}4`,
        payment: `DETPAGTOPARC${suffix}5`,
      },
      procurationCodes: procurations[system],
    } satisfies ServiceDefinition];
  }),
) as Record<InstallmentModality, ServiceDefinition>;

export type InstallmentProviderConfig = {
  baseUrl: string;
  bearerToken: string;
  jwtToken?: string;
  contractorTaxId: string;
  authorTaxId?: string;
};

type SerproEnvelope = { status?: number; dados?: string; mensagens?: Array<{ codigo?: string; texto?: string }> };

const digits = (value: string) => value.replace(/\D/g, "");

export function buildInstallmentEnvelope(
  modality: InstallmentModality,
  operation: InstallmentOperation,
  config: Pick<InstallmentProviderConfig, "contractorTaxId" | "authorTaxId">,
  taxpayerTaxId: string,
  data: Record<string, unknown> | "",
) {
  const contractor = digits(config.contractorTaxId);
  const author = digits(config.authorTaxId || config.contractorTaxId);
  const taxpayer = digits(taxpayerTaxId);
  if (contractor.length !== 14 || ![11, 14].includes(author.length) || taxpayer.length !== 14) {
    throw new Error("INSTALLMENT_INVALID_IDENTIFICATION");
  }
  const definition = INSTALLMENT_SERVICE_REGISTRY[modality];
  return {
    contratante: { numero: contractor, tipo: 2 },
    autorPedidoDados: { numero: author, tipo: author.length === 14 ? 2 : 1 },
    contribuinte: { numero: taxpayer, tipo: 2 },
    pedidoDados: {
      idSistema: definition.system,
      idServico: definition.services[operation],
      versaoSistema: "1.0",
      dados: data === "" ? "" : JSON.stringify(data),
    },
  };
}

async function callInstallmentProvider(
  config: InstallmentProviderConfig,
  modality: InstallmentModality,
  operation: InstallmentOperation,
  taxpayerTaxId: string,
  data: Record<string, unknown> | "",
  requestTag: string,
  fetcher: typeof fetch = fetch,
) {
  const route = operation === "issue" ? "Emitir" : "Consultar";
  let response: Response | null = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    response = await fetcher(`${config.baseUrl.replace(/\/$/, "")}/${route}`, {
      method: "POST",
      headers: {
        Accept: "text/plain",
        Authorization: `Bearer ${config.bearerToken}`,
        ...(config.jwtToken ? { jwt_token: config.jwtToken } : {}),
        "Content-Type": "application/json",
        "X-Request-Tag": requestTag.slice(0, 32),
      },
      body: JSON.stringify(buildInstallmentEnvelope(modality, operation, config, taxpayerTaxId, data)),
    });
    if (response.status !== 429 || attempt === 2) break;
    const retryAfter = Number(response.headers.get("retry-after"));
    const waitMs = Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter * 1000, 10_000) : 750 * (attempt + 1);
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }
  if (!response) throw new Error("SERPRO_UNAVAILABLE");
  if (!response.ok) throw new Error(`SERPRO_HTTP_${response.status}`);
  const envelope = await response.json() as SerproEnvelope;
  const successMessage = envelope.mensagens?.some((message) => /sucesso/i.test(`${message.codigo || ""} ${message.texto || ""}`)) === true;
  const successWithoutContent = successMessage && (typeof envelope.dados !== "string" || envelope.dados.trim() === "");
  if (successWithoutContent) return {};
  if ((typeof envelope.status === "number" && (envelope.status < 200 || envelope.status >= 300)) || typeof envelope.dados !== "string") {
    throw new Error(envelope.mensagens?.[0]?.codigo || "MALFORMED_PROVIDER_RESPONSE");
  }
  try {
    return JSON.parse(envelope.dados) as unknown;
  } catch {
    throw new Error("MALFORMED_PROVIDER_RESPONSE");
  }
}

const firstObject = (value: unknown): Record<string, unknown> => {
  if (Array.isArray(value)) return (value[0] || {}) as Record<string, unknown>;
  if (!value || typeof value !== "object") return {};
  const object = value as Record<string, unknown>;
  const content = object.conteudo ?? object.conteudos ?? object.resultado;
  if (Array.isArray(content)) return (content[0] || {}) as Record<string, unknown>;
  return content && typeof content === "object" ? content as Record<string, unknown> : object;
};

export async function listInstallmentAgreements(config: InstallmentProviderConfig, modality: InstallmentModality, taxpayerTaxId: string, requestTag: string, fetcher: typeof fetch = fetch) {
  const payload = firstObject(await callInstallmentProvider(config, modality, "list", taxpayerTaxId, "", requestTag, fetcher));
  return Array.isArray(payload.parcelamentos) ? payload.parcelamentos as Array<Record<string, unknown>> : [];
}

export async function getInstallmentAgreement(config: InstallmentProviderConfig, modality: InstallmentModality, taxpayerTaxId: string, agreementNumber: string, requestTag: string, fetcher: typeof fetch = fetch) {
  return firstObject(await callInstallmentProvider(config, modality, "detail", taxpayerTaxId, { numeroParcelamento: Number(agreementNumber) }, requestTag, fetcher));
}

export async function getInstallmentPayment(config: InstallmentProviderConfig, modality: InstallmentModality, taxpayerTaxId: string, agreementNumber: string, periodKey: string, requestTag: string, fetcher: typeof fetch = fetch) {
  return firstObject(await callInstallmentProvider(config, modality, "payment", taxpayerTaxId, { numeroParcelamento: Number(agreementNumber), anoMesParcela: Number(periodKey) }, requestTag, fetcher));
}

export async function listPrintableInstallments(config: InstallmentProviderConfig, modality: InstallmentModality, taxpayerTaxId: string, requestTag: string, fetcher: typeof fetch = fetch) {
  const payload = firstObject(await callInstallmentProvider(config, modality, "printable", taxpayerTaxId, "", requestTag, fetcher));
  return Array.isArray(payload.listaParcela) ? payload.listaParcela as Array<Record<string, unknown>> : [];
}

export async function issueInstallmentDas(config: InstallmentProviderConfig, modality: InstallmentModality, taxpayerTaxId: string, periodKey: string, requestTag: string, fetcher: typeof fetch = fetch) {
  const payload = firstObject(await callInstallmentProvider(config, modality, "issue", taxpayerTaxId, { parcelaParaEmitir: Number(periodKey) }, requestTag, fetcher));
  if (typeof payload.docArrecadacaoPdfB64 !== "string" || !payload.docArrecadacaoPdfB64) throw new Error("INSTALLMENT_DAS_PDF_MISSING");
  return { pdfBase64: payload.docArrecadacaoPdfB64 };
}
