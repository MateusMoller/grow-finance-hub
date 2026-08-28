export const DEFIS_TRIAL_BASE_URL = "https://gateway.apiserpro.serpro.gov.br/integra-contador-trial/v1";
export const DEFIS_TRIAL_BEARER = "06aef429-a981-3ec5-a1f8-71d38d86481e";

export type DefisPartner = {
  cpf: string;
  rendimentosIsentos: number;
  rendimentosTributaveis: number;
  participacaoCapitalSocial: number;
  irRetidoFonte: number;
};

export type DefisEstablishment = {
  cnpjCompleto: string;
  estoqueInicial: number;
  estoqueFinal: number;
  saldoCaixaInicial: number;
  saldoCaixaFinal: number;
  aquisicoesMercadoInterno: number;
  importacoes: number;
  totalEntradasPorTransferencia: number;
  totalSaidasPorTransferencia: number;
  totalDevolucoesVendas: number;
  totalEntradas: number;
  totalDevolucoesCompras: number;
  totalDespesas: number;
};

export type DefisDeclarationInput = {
  cnpj: string;
  year: number;
  inactivity?: 0 | 1 | 2 | null;
  specialSituation?: { tipoEvento: 1 | 2 | 3 | 4 | 5; dataEvento: number } | null;
  capitalGain: number;
  employeesAtStart: number;
  employeesAtEnd: number;
  accountingProfit?: number | null;
  directExportRevenue: number;
  treasuryQuotaParticipation?: number | null;
  variableIncomeGain: number;
  partners: DefisPartner[];
  establishments: DefisEstablishment[];
};

export type DefisTransmissionResult = {
  declarationId: string;
  declarationPdf: string;
  receiptPdf: string;
};

export type DefisDeclarationSummary = {
  anoCalendario: number;
  idDefis: string;
  tipo: string;
  dataHora: string | number;
};

type SerproResponse = { status?: number; dados?: string; mensagens?: Array<{ codigo?: string; texto?: string }> };

const digits = (value: string) => value.replace(/\D/g, "");
const money = (value: number) => Number.isFinite(value) ? Math.round(value * 100) / 100 : 0;
const integer = (value: number) => Number.isInteger(value) && value >= 0 ? value : 0;

export function buildDefisDeclarationData(input: DefisDeclarationInput) {
  const cnpj = digits(input.cnpj);
  if (cnpj.length !== 14 || !Number.isInteger(input.year) || input.year < 2000 || input.year > 2100) {
    throw new Error("DEFIS_INVALID_IDENTIFICATION");
  }
  if (input.year < 2025 && ![0, 1, 2].includes(Number(input.inactivity))) throw new Error("DEFIS_INACTIVITY_REQUIRED");
  if (!input.partners.length) throw new Error("DEFIS_PARTNER_REQUIRED");
  if (!input.establishments.length) throw new Error("DEFIS_ESTABLISHMENT_REQUIRED");
  const partners = input.partners.map((partner) => {
    const cpf = digits(partner.cpf);
    if (cpf.length !== 11 || partner.participacaoCapitalSocial < 0 || partner.participacaoCapitalSocial > 100) {
      throw new Error("DEFIS_INVALID_PARTNER");
    }
    return { ...partner, cpf, rendimentosIsentos: money(partner.rendimentosIsentos), rendimentosTributaveis: money(partner.rendimentosTributaveis), participacaoCapitalSocial: money(partner.participacaoCapitalSocial), irRetidoFonte: money(partner.irRetidoFonte) };
  });
  const establishments = input.establishments.map((establishment) => {
    const establishmentCnpj = digits(establishment.cnpjCompleto);
    if (establishmentCnpj.length !== 14) throw new Error("DEFIS_INVALID_ESTABLISHMENT");
    return {
      ...establishment,
      cnpjCompleto: establishmentCnpj,
      estoqueInicial: money(establishment.estoqueInicial), estoqueFinal: money(establishment.estoqueFinal),
      saldoCaixaInicial: money(establishment.saldoCaixaInicial), saldoCaixaFinal: money(establishment.saldoCaixaFinal),
      aquisicoesMercadoInterno: money(establishment.aquisicoesMercadoInterno), importacoes: money(establishment.importacoes),
      totalEntradasPorTransferencia: money(establishment.totalEntradasPorTransferencia), totalSaidasPorTransferencia: money(establishment.totalSaidasPorTransferencia),
      totalDevolucoesVendas: money(establishment.totalDevolucoesVendas), totalEntradas: money(establishment.totalEntradas),
      totalDevolucoesCompras: money(establishment.totalDevolucoesCompras), totalDespesas: money(establishment.totalDespesas),
    };
  });
  return {
    ano: input.year,
    situacaoEspecial: input.specialSituation || null,
    inatividade: input.year < 2025 ? input.inactivity : null,
    empresa: {
      ganhoCapital: money(input.capitalGain),
      qtdEmpregadoInicial: integer(input.employeesAtStart),
      qtdEmpregadoFinal: integer(input.employeesAtEnd),
      lucroContabil: input.accountingProfit == null ? null : money(input.accountingProfit),
      receitaExportacaoDireta: money(input.directExportRevenue),
      comerciaisExportadoras: [],
      socios: partners,
      participacaoCotasTesouraria: input.treasuryQuotaParticipation == null ? null : money(input.treasuryQuotaParticipation),
      ganhoRendaVariavel: money(input.variableIncomeGain),
      doacoesCampanhaEleitoral: [],
      estabelecimentos: establishments,
    },
    naoOptante: null,
  };
}

export function buildDefisEnvelope(cnpj: string, serviceId: string, data: unknown | "") {
  const party = { numero: digits(cnpj), tipo: 2 };
  return { contratante: party, autorPedidoDados: party, contribuinte: party, pedidoDados: { idSistema: "DEFIS", idServico: serviceId, versaoSistema: "1.0", dados: data === "" ? "" : JSON.stringify(data) } };
}

async function trialCall(route: "Declarar" | "Consultar", cnpj: string, serviceId: string, data: unknown | "", requestTag: string, fetcher: typeof fetch) {
  const response = await fetcher(`${DEFIS_TRIAL_BASE_URL}/${route}`, { method: "POST", headers: { Accept: "text/plain", Authorization: `Bearer ${DEFIS_TRIAL_BEARER}`, "Content-Type": "application/json", "X-Request-Tag": requestTag.slice(0, 32) }, body: JSON.stringify(buildDefisEnvelope(cnpj, serviceId, data)) });
  if (!response.ok) throw new Error(`SERPRO_HTTP_${response.status}`);
  const payload = await response.json() as SerproResponse;
  if (payload.status !== 200 || typeof payload.dados !== "string") throw new Error(payload.mensagens?.[0]?.codigo || "MALFORMED_PROVIDER_RESPONSE");
  return JSON.parse(payload.dados) as unknown;
}

export async function transmitDefisTrial(input: DefisDeclarationInput, requestTag: string, fetcher: typeof fetch = fetch): Promise<DefisTransmissionResult> {
  const trialInput = { ...input, cnpj: "00000000000000", year: 2021, inactivity: 2 as const };
  const output = await trialCall("Declarar", trialInput.cnpj, "TRANSDECLARACAO141", buildDefisDeclarationData(trialInput), requestTag, fetcher) as Record<string, unknown> | Array<Record<string, unknown>>;
  const item = Array.isArray(output) ? output[0] || {} : output;
  if (typeof item.idDefis !== "string" || typeof item.declaracaoPdf !== "string" || typeof item.reciboPdf !== "string") throw new Error("DEFIS_ARTIFACTS_MISSING");
  return { declarationId: item.idDefis, declarationPdf: item.declaracaoPdf, receiptPdf: item.reciboPdf };
}

export async function listDefisDeclarationsTrial(requestTag: string, fetcher: typeof fetch = fetch): Promise<DefisDeclarationSummary[]> {
  const output = await trialCall("Consultar", "00000000000000", "CONSDECLARACAO142", "", requestTag, fetcher);
  return Array.isArray(output) ? output as DefisDeclarationSummary[] : [];
}

export async function getLatestDefisTrial(year: number, requestTag: string, fetcher: typeof fetch = fetch): Promise<DefisTransmissionResult> {
  const output = await trialCall("Consultar", "00000000000000", "CONSULTIMADECREC143", { ano: year }, requestTag, fetcher) as Record<string, unknown> | Array<Record<string, unknown>>;
  const item = Array.isArray(output) ? output[0] || {} : output;
  const id = String(item.idDefis || "");
  const declarationPdf = String(item.declaracao || "");
  const receiptPdf = String(item.recibo || "");
  if (!id || !declarationPdf || !receiptPdf) throw new Error("DEFIS_ARTIFACTS_MISSING");
  return { declarationId: id, declarationPdf, receiptPdf };
}
