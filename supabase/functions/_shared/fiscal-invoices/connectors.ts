import { decodeXmlPayload, extractNfeDocZip, extractSoapValue, type DistributedDocument } from "./xml.ts";

export type DistributionBatch = { statusCode: string; lastNsu: number; maxNsu: number | null; documents: DistributedDocument[]; upToDate: boolean };
type TlsIdentity = { cert: string; key: string };
type NfseRow = { NSU?: unknown; nsu?: unknown; TipoDocumento?: unknown; tipoDocumento?: unknown; ChaveAcesso?: unknown; chaveAcesso?: unknown; ArquivoXml?: unknown; arquivoXml?: unknown };
type NfseResponse = { StatusProcessamento?: unknown; statusProcessamento?: unknown; LoteDFe?: unknown; loteDFe?: unknown };

function httpClient(identity: TlsIdentity) {
  return Deno.createHttpClient({ cert: identity.cert, key: identity.key, http2: false, poolMaxIdlePerHost: 0 });
}

function requestError(source: "nfe" | "nfse", cause: unknown) {
  let current = cause;
  const messages: string[] = [];
  for (let depth = 0; depth < 8 && current; depth += 1) {
    if (current instanceof Error) {
      if (current.message) messages.push(current.message.toLowerCase());
      current = current.cause;
    } else break;
  }
  const details = messages.join(" ");
  console.error("fiscal connector request failed", { source, messages });
  if (/certificate|unknown issuer|bad certificate|handshake|tls|peer.*incompatible/.test(details)) return new Error(`${source}_tls_certificate_rejected`);
  if (/dns|connection refused|connection reset|timed out|timeout|sending request/.test(details)) return new Error(`${source}_connection_failed`);
  return cause instanceof Error && cause.message ? cause : new Error(`${source}_request_failed`);
}

export async function fetchNfseAdnBatch(input: { identity: TlsIdentity; cnpj: string; lastNsu: number; environment: string }): Promise<DistributionBatch> {
  const base = input.environment === "homologation" ? "https://adn.producaorestrita.nfse.gov.br" : "https://adn.nfse.gov.br";
  const url = new URL(`${base}/contribuintes/DFe/${input.lastNsu}`);
  url.searchParams.set("tipoNSU", "DISTRIBUICAO"); url.searchParams.set("lote", "true"); url.searchParams.set("cnpjConsulta", input.cnpj);
  const client = httpClient(input.identity);
  try {
    let response: Response;
    try {
      response = await fetch(url, { client, headers: { Accept: "application/json" } } as RequestInit & { client: Deno.HttpClient });
    } catch (cause) {
      throw requestError("nfse", cause);
    }
    const body = await response.json().catch(() => null) as NfseResponse | null;
    if (!response.ok || !body) throw new Error(`nfse_http_${response.status}`);
    const statusCode = String(body.StatusProcessamento || body.statusProcessamento || "UNKNOWN");
    const rows = body.LoteDFe || body.loteDFe || [];
    const documents = await Promise.all((Array.isArray(rows) ? rows as NfseRow[] : []).map(async (row) => ({
      nsu: Number(row.NSU || row.nsu || 0), schema: String(row.TipoDocumento || row.tipoDocumento || "nfse"),
      accessKeyHint: String(row.ChaveAcesso || row.chaveAcesso || "") || null,
      xml: await decodeXmlPayload(String(row.ArquivoXml || row.arquivoXml || "")),
    })));
    const lastNsu = documents.reduce((maximum, document) => Math.max(maximum, document.nsu), input.lastNsu);
    return { statusCode, lastNsu, maxNsu: null, documents, upToDate: documents.length === 0 };
  } finally { client.close(); }
}

export async function fetchNfeSefazBatch(input: { identity: TlsIdentity; cnpj: string; lastNsu: number; environment: string }): Promise<DistributionBatch> {
  const endpoint = input.environment === "homologation"
    ? "https://hom1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx"
    : "https://www1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx";
  const tpAmb = input.environment === "homologation" ? "2" : "1";
  const payload = `<distDFeInt xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.01"><tpAmb>${tpAmb}</tpAmb><cUFAutor>91</cUFAutor><CNPJ>${input.cnpj}</CNPJ><distNSU><ultNSU>${String(input.lastNsu).padStart(15, "0")}</ultNSU></distNSU></distDFeInt>`;
  const envelope = `<?xml version="1.0" encoding="utf-8"?><soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope"><soap12:Body><nfeDistDFeInteresse xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe"><nfeDadosMsg>${payload}</nfeDadosMsg></nfeDistDFeInteresse></soap12:Body></soap12:Envelope>`;
  const client = httpClient(input.identity);
  try {
    let response: Response;
    try {
      response = await fetch(endpoint, { method: "POST", client, headers: { "Content-Type": "application/soap+xml; charset=utf-8; action=\"http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe/nfeDistDFeInteresse\"", "Connection": "close" }, body: envelope } as RequestInit & { client: Deno.HttpClient });
    } catch (cause) {
      throw requestError("nfe", cause);
    }
    const soapXml = await response.text();
    if (!response.ok) throw new Error(`nfe_http_${response.status}`);
    const statusCode = extractSoapValue(soapXml, "cStat") || "UNKNOWN";
    const lastNsu = Number(extractSoapValue(soapXml, "ultNSU") || input.lastNsu);
    const maxNsu = Number(extractSoapValue(soapXml, "maxNSU") || lastNsu);
    if (!["137", "138", "656"].includes(statusCode)) throw new Error(`nfe_cstat_${statusCode}`);
    if (statusCode === "656") throw new Error("nfe_rate_limited");
    const documents = await extractNfeDocZip(soapXml);
    return { statusCode, lastNsu, maxNsu, documents, upToDate: statusCode === "137" || lastNsu >= maxNsu };
  } finally { client.close(); }
}
