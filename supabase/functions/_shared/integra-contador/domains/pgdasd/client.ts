import { previousCompetence, resolvePreviousPgdasValues, type PreviousPgdasValues } from "./prior-period.ts";

export const PGDASD_TRIAL_BASE_URL = "https://gateway.apiserpro.serpro.gov.br/integra-contador-trial/v1";
export const PGDASD_TRIAL_BEARER = "06aef429-a981-3ec5-a1f8-71d38d86481e";

export type PgdasTaxValue = { codigoTributo: number; valor: number };
export type PgdasActivity = { idAtividade: number; valorAtividade: number; receitasAtividade: Array<{ valor: number; codigoOutroMunicipio: string | null; outraUf: string | null; isencoes: null; reducoes: null; qualificacoesTributarias: null; exigibilidadesSuspensas: null }> };
export type PgdasDeclarationInput = {
  cnpj: string;
  competence: string;
  revenueRegime: "caixa" | "competencia";
  domesticRevenue: number;
  foreignRevenue: number;
  activityId: number;
  priorRevenues?: Array<{ pa: number; valorInterno: number; valorExterno: number }>;
  payrollHistory?: Array<{ pa: number; valor: number }>;
  taxValues?: PgdasTaxValue[];
};

type SerproResponse = { status?: number; dados?: string; mensagens?: Array<{ codigo?: string; texto?: string }> };

export type PgdasDeclarationResult = {
  declarationId: string | null;
  transmittedAt: string | null;
  taxValues: PgdasTaxValue[];
  declarationPdf: string | null;
  receiptPdf: string | null;
};

export type PgdasDasResult = {
  pdf: string;
  dasNumber: string | null;
  dueDate: string | null;
  total: number | null;
};

const cleanCnpj = (value: string) => value.replace(/\D/g, "");
const finiteMoney = (value: number) => Number.isFinite(value) && value >= 0 ? Math.round(value * 100) / 100 : 0;

export function buildPgdasDeclarationData(input: PgdasDeclarationInput, transmit: boolean) {
  const cnpj = cleanCnpj(input.cnpj);
  if (cnpj.length !== 14 || !/^\d{6}$/.test(input.competence)) throw new Error("PGDASD_INVALID_IDENTIFICATION");
  if (!Number.isInteger(input.activityId) || input.activityId <= 0) throw new Error("PGDASD_INVALID_ACTIVITY");
  const domestic = finiteMoney(input.domesticRevenue);
  const foreign = finiteMoney(input.foreignRevenue);
  const total = finiteMoney(domestic + foreign);
  const declaration = {
    tipoDeclaracao: 1,
    receitaPaCompetenciaInterno: domestic,
    receitaPaCompetenciaExterno: foreign,
    receitaPaCaixaInterno: input.revenueRegime === "caixa" ? domestic : null,
    receitaPaCaixaExterno: input.revenueRegime === "caixa" ? foreign : null,
    valorFixoIcms: null,
    valorFixoIss: null,
    receitasBrutasAnteriores: input.priorRevenues || [],
    folhasSalario: input.payrollHistory || [],
    naoOptante: null,
    estabelecimentos: [{
      cnpjCompleto: cnpj,
      atividades: [{
        idAtividade: input.activityId,
        valorAtividade: total,
        receitasAtividade: [{ valor: total, codigoOutroMunicipio: null, outraUf: null, isencoes: null, reducoes: null, qualificacoesTributarias: null, exigibilidadesSuspensas: null }],
      } satisfies PgdasActivity],
    }],
  };
  return {
    cnpjCompleto: cnpj,
    pa: Number(input.competence),
    indicadorTransmissao: transmit,
    indicadorComparacao: transmit && Boolean(input.taxValues?.length),
    declaracao: declaration,
    valoresParaComparacao: transmit ? input.taxValues || [] : [],
  };
}

function envelope(cnpj: string, serviceId: string, data: unknown) {
  const party = { numero: cnpj, tipo: 2 };
  return { contratante: party, autorPedidoDados: party, contribuinte: party, pedidoDados: { idSistema: "PGDASD", idServico: serviceId, versaoSistema: "1.0", dados: JSON.stringify(data) } };
}

async function trialCall(route: "Consultar" | "Declarar" | "Emitir", cnpj: string, serviceId: string, data: unknown, requestTag: string, fetcher: typeof fetch) {
  const response = await fetcher(`${PGDASD_TRIAL_BASE_URL}/${route}`, {
    method: "POST",
    headers: { Accept: "text/plain", Authorization: `Bearer ${PGDASD_TRIAL_BEARER}`, "Content-Type": "application/json", "X-Request-Tag": requestTag.slice(0, 32) },
    body: JSON.stringify(envelope(cnpj, serviceId, data)),
  });
  if (!response.ok) throw new Error(`SERPRO_HTTP_${response.status}`);
  const payload = await response.json() as SerproResponse;
  if (payload.status !== 200 || typeof payload.dados !== "string") throw new Error(payload.mensagens?.[0]?.codigo || "MALFORMED_PROVIDER_RESPONSE");
  return JSON.parse(payload.dados) as unknown;
}

export async function consultPreviousPgdasTrial(
  currentCompetence: string,
  requestTag: string,
  fetcher: typeof fetch = fetch,
): Promise<PreviousPgdasValues> {
  previousCompetence(currentCompetence);
  const trialCompetence = "202101";
  const output = await trialCall(
    "Consultar",
    "00000000000100",
    "CONSULTIMADECREC14",
    { periodoApuracao: trialCompetence },
    requestTag,
    fetcher,
  );
  return await resolvePreviousPgdasValues(output, trialCompetence);
}

export async function previewPgdasTrial(input: PgdasDeclarationInput, requestTag: string, fetcher: typeof fetch = fetch): Promise<PgdasDeclarationResult> {
  // The public trial only recognizes SERPRO's documented demonstration taxpayer.
  const trialInput = { ...input, cnpj: "00000000000100", competence: "202101" };
  const output = await trialCall("Declarar", trialInput.cnpj, "TRANSDECLARACAO11", buildPgdasDeclarationData(trialInput, false), requestTag, fetcher) as Array<Record<string, unknown>>;
  const item = output[0] || {};
  return { declarationId: typeof item.idDeclaracao === "string" ? item.idDeclaracao : null, transmittedAt: null, taxValues: Array.isArray(item.valoresDevidos) ? item.valoresDevidos as PgdasTaxValue[] : [], declarationPdf: null, receiptPdf: null };
}

export async function transmitPgdasTrial(input: PgdasDeclarationInput, requestTag: string, fetcher: typeof fetch = fetch): Promise<PgdasDeclarationResult> {
  const trialInput = { ...input, cnpj: "00000000000100", competence: "202101" };
  const output = await trialCall("Declarar", trialInput.cnpj, "TRANSDECLARACAO11", buildPgdasDeclarationData(trialInput, true), requestTag, fetcher) as Array<Record<string, unknown>>;
  const item = output[0] || {};
  return {
    declarationId: typeof item.idDeclaracao === "string" ? item.idDeclaracao : null,
    transmittedAt: typeof item.dataHoraTransmissao === "string" ? item.dataHoraTransmissao : null,
    taxValues: Array.isArray(item.valoresDevidos) ? item.valoresDevidos as PgdasTaxValue[] : [],
    declarationPdf: typeof item.declaracao === "string" ? item.declaracao : null,
    receiptPdf: typeof item.recibo === "string" ? item.recibo : null,
  };
}

export async function generateDasTrial(competence: string, requestTag: string, fetcher: typeof fetch = fetch): Promise<PgdasDasResult> {
  const output = await trialCall("Emitir", "00000000000100", "GERARDAS12", { periodoApuracao: "201801" }, requestTag, fetcher) as Array<Record<string, unknown>>;
  const item = output[0] || {};
  const detail = (item.detalhamentoDas || {}) as Record<string, unknown>;
  const values = (detail.valores || {}) as Record<string, unknown>;
  if (typeof item.pdf !== "string") throw new Error("PGDASD_DAS_PDF_MISSING");
  void competence;
  return { pdf: item.pdf, dasNumber: typeof detail.numeroDocumento === "string" ? detail.numeroDocumento : null, dueDate: typeof detail.dataVencimento === "string" ? detail.dataVencimento : null, total: typeof values.total === "number" ? values.total : null };
}
