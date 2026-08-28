import type { DctfwebArtifact, DctfwebInput, DctfwebTransmissionInput } from "./contracts.ts";

export const DCTFWEB_TRIAL_BASE_URL = "https://gateway.apiserpro.serpro.gov.br/integra-contador-trial/v1";
export const DCTFWEB_TRIAL_BEARER = "06aef429-a981-3ec5-a1f8-71d38d86481e";
type Route = "Consultar" | "Emitir" | "Declarar";
type ProviderResponse = { status?: number; dados?: string; mensagens?: Array<{ codigo?: string }> };
const digits = (value: string) => value.replace(/\D/g, "");

export function buildDctfwebData(input: DctfwebInput) {
  const competence = digits(input.competence);
  if (![11,14].includes(digits(input.cnpj).length) || !/^\d{6}$/.test(competence)) throw new Error("DCTFWEB_INVALID_CONTEXT");
  return { categoria: input.category, anoPA: competence.slice(0, 4), mesPA: competence.slice(4, 6), ...(input.receiptNumber ? { numeroReciboEntrega: Number(input.receiptNumber) } : {}) };
}
export function buildDctfwebEnvelope(cnpj: string, serviceId: string, data: unknown) {
  const taxId=digits(cnpj); const party = { numero: taxId, tipo: taxId.length===11?1:2 };
  return { contratante: party, autorPedidoDados: party, contribuinte: party, pedidoDados: { idSistema: "DCTFWEB", idServico: serviceId, versaoSistema: "1.0", dados: JSON.stringify(data) } };
}
async function call(route: Route, serviceId: string, input: DctfwebInput, requestTag: string, fetcher: typeof fetch) {
  const response = await fetcher(`${DCTFWEB_TRIAL_BASE_URL}/${route}`, { method: "POST", headers: { Accept: "text/plain", Authorization: `Bearer ${DCTFWEB_TRIAL_BEARER}`, "Content-Type": "application/json", "X-Request-Tag": requestTag.slice(0,32) }, body: JSON.stringify(buildDctfwebEnvelope(input.cnpj,serviceId,buildDctfwebData(input))) });
  if (!response.ok) throw new Error(`SERPRO_HTTP_${response.status}`);
  const payload = await response.json() as ProviderResponse;
  if (payload.status !== 200 || typeof payload.dados !== "string") throw new Error(payload.mensagens?.[0]?.codigo || "MALFORMED_PROVIDER_RESPONSE");
  return JSON.parse(payload.dados) as Record<string, unknown> | Array<Record<string, unknown>>;
}
const artifact = (output: Record<string, unknown> | Array<Record<string, unknown>>, keys: string[], mimeType: string): DctfwebArtifact => {
  const item = Array.isArray(output) ? output[0] || {} : output;
  const base64 = keys.map((key) => item[key]).find((value) => typeof value === "string") as string | undefined;
  if (!base64) throw new Error("DCTFWEB_ARTIFACT_MISSING");
  return { base64, mimeType, receiptNumber: item.numeroReciboEntrega == null ? null : String(item.numeroReciboEntrega), metadata: Object.fromEntries(Object.entries(item).filter(([key]) => !keys.includes(key))) };
};
export const consultDctfwebXmlTrial = async (input:DctfwebInput,tag:string,fetcher:typeof fetch=fetch) => artifact(await call("Consultar","CONSXMLDECLARACAO38",{...input,cnpj:"00000000000",competence:"202206",category:"PF_MENSAL"},tag,fetcher),["xml","xmlDeclaracao","declaracao"],"application/xml");
export const consultDctfwebReceiptTrial = async (input:DctfwebInput,tag:string,fetcher:typeof fetch=fetch) => artifact(await call("Consultar","CONSRECIBO32",{...input,cnpj:"00000000000000",competence:"202711",receiptNumber:"24573"},tag,fetcher),["recibo","pdf"],"application/pdf");
export const consultDctfwebReportTrial = async (input:DctfwebInput,tag:string,fetcher:typeof fetch=fetch) => artifact(await call("Consultar","CONSDECCOMPLETA33",{...input,cnpj:"00000000000000",competence:"202711",receiptNumber:"24573"},tag,fetcher),["declaracao","relatorio","pdf"],"application/pdf");
export const generateDctfwebDarfTrial = async (input:DctfwebInput,inProgress:boolean,tag:string,fetcher:typeof fetch=fetch) => artifact(await call("Emitir",inProgress?"GERARGUIAANDAMENTO313":"GERARGUIA31",{...input,cnpj:"00000000000000",competence:inProgress?"202501":"202711",receiptNumber:inProgress?null:"24573"},tag,fetcher),["pdf","documento","guia"],"application/pdf");
export async function transmitDctfwebTrial(input:DctfwebTransmissionInput,tag:string,fetcher:typeof fetch=fetch) {
  const trialInput = {...input,cnpj:"00000000000",competence:"202206",category:"PF_MENSAL" as const};
  const data = {...buildDctfwebData(trialInput),xmlAssinadoBase64:input.signedXmlBase64};
  const response = await fetcher(`${DCTFWEB_TRIAL_BASE_URL}/Declarar`, {
    method:"POST",
    headers:{Accept:"text/plain",Authorization:`Bearer ${DCTFWEB_TRIAL_BEARER}`,"Content-Type":"application/json","X-Request-Tag":tag.slice(0,32)},
    body:JSON.stringify(buildDctfwebEnvelope(trialInput.cnpj,"TRANSDECLARACAO310",data)),
  });
  if (!response.ok) throw new Error(`SERPRO_HTTP_${response.status}`);
  const payload = await response.json() as ProviderResponse;
  if (payload.status !== 200 || typeof payload.dados !== "string") throw new Error(payload.mensagens?.[0]?.codigo || "MALFORMED_PROVIDER_RESPONSE");
  return JSON.parse(payload.dados) as Record<string,unknown>;
}
