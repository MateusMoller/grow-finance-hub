
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

const internalRoles = new Set([
  "admin",
  "director",
  "manager",
  "employee",
  "commercial",
  "partner",
  "departamento_pessoal",
  "fiscal",
  "contabil",
]);

const defaultCompaniesPathCandidates = [
  "/companies/ListAll?Pagina={page}",
  "/companies/ListAll/?Pagina={page}",
  "/companies/ListAll?Pagina={page}&registrationData",
  "/companies/ListAll/?Pagina={page}&registrationData",
  "/companies/ListAll?Pagina=1",
  "/companies/ListAll/?Pagina=1",
  "/companies/ListAll",
  "/companies/ListAll/",
];

const defaultDeliveriesPathCandidates = [
  "/deliveries/{companyId}?DtInitial={dateFrom}&DtFinal={dateTo}&Pagina=1",
  "/deliveries/{companyId}/?DtInitial={dateFrom}&DtFinal={dateTo}&Pagina=1",
  "/deliveries/{companyId}?DtInitial={dateFrom}&DtFinal={dateTo}&situation=pending,delivered&Pagina=1",
  "/deliveries/{companyId}/?DtInitial={dateFrom}&DtFinal={dateTo}&situation=pending,delivered&Pagina=1",
];

const defaultObligationsMinDate = "2026-04-01";
const weeklyObligationKanbanIntegrationSource = "acessorias_obrigacao_semanal";
const obligationCalendarIntegrationSource = "acessorias_obrigacao";

const defaultEcontinuoPathCandidates = [
  "/v1/econtinuo/upload",
  "/v1/econtinuo/send",
  "/v1/econtinuo",
  "/econtinuo/upload",
  "/econtinuo/send",
];

const defaultEcontinuoPreflightPathCandidates = [
  "/v1/econtinuo/preflight",
  "/v1/econtinuo/preview",
  "/v1/econtinuo/read",
  "/v1/econtinuo/analyze",
  "/econtinuo/preflight",
  "/econtinuo/preview",
  "/econtinuo/read",
  "/econtinuo/analyze",
];

const defaultRequestsPathCandidates = [
  "/requests",
  "/requests/",
];

type JsonRecord = Record<string, unknown>;

type AcessoriasRequestResult = {
  ok: boolean;
  status: number;
  path: string;
  payload: unknown;
};

type ParsedCompany = {
  acessorias_company_id: string;
  cnpj: string | null;
  company_name: string;
  status: string | null;
  raw_payload: JsonRecord;
};

type CompanyRegistrationSnapshot = {
  codigo: string | null;
  regimeTributario: string | null;
  grupoEmpresas: string | null;
  nomeFantasia: string | null;
  apelidoEcontinuo: string | null;
  endereco: string | null;
  numeroEstabelecimento: string | null;
  complementoEndereco: string | null;
  cep: string | null;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
  inscricaoEstadual: string | null;
  inscricaoEstadualUf: string | null;
  inscricaoEstadualData: string | null;
  inscricaoMunicipal: string | null;
  inscricaoMunicipalData: string | null;
  nire: string | null;
  outrosIdentificadores: string | null;
  websiteEmpresa: string | null;
  empresaAtiva: string | null;
  empresaIsenta: string | null;
  ddd: string | null;
  telefone: string | null;
  honorario: string | null;
};

type ParsedObligation = {
  acessorias_obligation_id: string;
  obligation_name: string;
  obligation_period: string | null;
  obligation_period_key: string;
  due_date: string | null;
  delivered_at: string | null;
  status: string | null;
  protocol: string | null;
  notes: string | null;
  source_payload: JsonRecord;
};

type CreateKanbanTaskInput = {
  clientId: string;
  clientName: string;
  obligationId: string;
  obligationName: string;
  obligationPeriod: string | null;
  dueDate: string | null;
  status: string | null;
  protocol: string | null;
  notes: string | null;
  payload: JsonRecord;
  createdBy: string;
};

function buildObligationTaskTitle(obligationName: string, clientName: string) {
  const safeObligationName = asTrimmedString(obligationName) || "Obrigacao";
  const safeClientName = asTrimmedString(clientName) || "Cliente";
  return `${safeObligationName}-${safeClientName}`;
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function asRecord(value: unknown): JsonRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as JsonRecord;
}

function asTrimmedString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function asTrimmedText(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === "number" || typeof value === "bigint") {
    return String(value);
  }
  if (typeof value === "boolean") {
    return value ? "Sim" : "Nao";
  }
  return null;
}

function asBoolean(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value > 0;
  const text = normalizeToken(asTrimmedString(value) || "");
  return text === "true" || text === "1" || text === "yes" || text === "sim";
}

function normalizeCashflowEntryType(value: unknown): "income" | "expense" {
  const token = normalizeToken(asTrimmedString(value) || "");
  if (["income", "entrada", "receita"].includes(token)) return "income";
  return "expense";
}

function normalizePositiveNumber(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) && value > 0 ? Number(value.toFixed(2)) : null;
  }

  const text = asTrimmedText(value);
  if (!text) return null;

  const normalized = text.includes(",") && text.includes(".")
    ? text.replace(/\./g, "").replace(",", ".")
    : text.includes(",")
      ? text.replace(",", ".")
      : text;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Number(parsed.toFixed(2));
}

function normalizeToken(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizeNameKey(value: unknown) {
  const text = asTrimmedString(value);
  if (!text) return "";
  return normalizeToken(text);
}

function normalizeCnpj(value: unknown): string | null {
  const text = asTrimmedString(value);
  if (!text) return null;
  const digits = text.replace(/\D/g, "");
  if (digits.length !== 14) return null;
  return digits;
}

function normalizeCepDigits(value: unknown): string | null {
  const text = asTrimmedText(value);
  if (!text) return null;
  const digits = text.replace(/\D/g, "");
  if (digits.length < 8) return null;
  return digits.slice(0, 8);
}

function normalizeStateCode(value: unknown): string | null {
  const text = asTrimmedText(value);
  if (!text) return null;
  const letters = text.replace(/[^a-zA-Z]/g, "").toUpperCase();
  if (letters.length === 2) return letters;
  return text.trim().toUpperCase();
}

function normalizeYesNo(value: unknown): string | null {
  const text = asTrimmedText(value);
  if (!text) return null;
  const token = normalizeToken(text);
  if (["sim", "yes", "true", "ativo", "ativa", "1"].includes(token)) return "Sim";
  if (["nao", "no", "false", "inativo", "inativa", "0"].includes(token)) return "Nao";
  return text;
}

function splitBrazilPhone(value: unknown) {
  const text = asTrimmedText(value);
  if (!text) return { ddd: null as string | null, telefone: null as string | null };
  let digits = text.replace(/\D/g, "");
  if (!digits) return { ddd: null as string | null, telefone: null as string | null };

  if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) {
    digits = digits.slice(2);
  }

  if (digits.length >= 10) {
    const ddd = digits.slice(0, 2);
    const telefone = digits.slice(2);
    return { ddd, telefone };
  }

  return { ddd: null as string | null, telefone: digits };
}

function normalizePhoneDigits(value: unknown): string | null {
  const text = asTrimmedString(value);
  if (!text) return null;
  const digits = text.replace(/\D/g, "");
  if (digits.length < 10) return null;

  if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) {
    return digits;
  }
  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`;
  }
  return digits;
}

function combineDddAndPhone(dddValue: unknown, phoneValue: unknown): string | null {
  const dddDigits = String(dddValue || "").replace(/\D/g, "");
  const phoneDigits = String(phoneValue || "").replace(/\D/g, "");
  if (!phoneDigits) return null;
  if (phoneDigits.length >= 10) return phoneDigits;
  if (!dddDigits) return phoneDigits;
  return `${dddDigits}${phoneDigits}`;
}

function sanitizeStorageFileName(value: string) {
  const sanitized = value
    .replace(/[\\/:*?"<>|]+/g, "_")
    .replace(/\s+/g, " ")
    .trim();
  return sanitized || "arquivo";
}

function buildStorageObjectPath(folderPath: string, fileName: string) {
  const now = Date.now();
  const safeFileName = sanitizeStorageFileName(fileName);
  const randomSuffix = crypto.randomUUID().slice(0, 8);
  return `${folderPath}/${now}_${randomSuffix}_${safeFileName}`;
}

type UploadHistoryItem = {
  id: string;
  client_id: string | null;
  acessorias_company_id: string | null;
  client_name: string | null;
  company_name: string | null;
  obligation_name: string | null;
  competence: string | null;
  file_name: string;
  status: string;
  error_message: string | null;
  uploaded_at: string | null;
};

function extractUploadMetadata(requestPayload: unknown) {
  const requestRecord = asRecord(requestPayload);
  const metadataCandidate = requestRecord ? getRecordValue(requestRecord, "metadata") : null;
  const metadata = asRecord(metadataCandidate) || requestRecord;

  const obligationName = metadata
    ? pickFirstString(metadata, [
      "obrigacao",
      "obrigaÃ§Ã£o",
      "obligation",
      "obligation_name",
      "entrega",
      "delivery",
    ])
    : null;

  const competence = metadata
    ? pickFirstString(metadata, [
      "competencia",
      "competÃªncia",
      "competence",
      "periodo",
      "period",
      "obligation_period",
    ])
    : null;

  return { obligationName, competence };
}

function mapUploadsForHistory(
  uploads: unknown[],
  clientNameById: Map<string, string>,
  companyNameById: Map<string, string>,
): UploadHistoryItem[] {
  const mapped: UploadHistoryItem[] = [];

  for (const rawUpload of uploads) {
    const upload = asRecord(rawUpload);
    if (!upload) continue;

    const id = asTrimmedString(getRecordValue(upload, "id"));
    const clientId = asTrimmedString(getRecordValue(upload, "client_id"));
    const companyId = asTrimmedString(getRecordValue(upload, "acessorias_company_id"));
    const fileName = asTrimmedString(getRecordValue(upload, "file_name")) || "arquivo";
    const status = asTrimmedString(getRecordValue(upload, "status")) || "processing";
    const errorMessage = asTrimmedString(getRecordValue(upload, "error_message"));
    const uploadedAt = asTrimmedString(getRecordValue(upload, "uploaded_at"));
    const { obligationName, competence } = extractUploadMetadata(getRecordValue(upload, "request_payload"));

    mapped.push({
      id: id || `${clientId || "sem_cliente"}:${fileName}:${uploadedAt || "sem_data"}`,
      client_id: clientId,
      acessorias_company_id: companyId,
      client_name: clientId ? clientNameById.get(clientId) || null : null,
      company_name: companyId ? companyNameById.get(companyId) || null : null,
      obligation_name: obligationName,
      competence,
      file_name: fileName,
      status,
      error_message: errorMessage,
      uploaded_at: uploadedAt,
    });
  }

  return mapped.sort((left, right) => {
    const leftDate = left.uploaded_at || "";
    const rightDate = right.uploaded_at || "";
    return rightDate.localeCompare(leftDate);
  });
}

function mapCompanyStatusToClientStatus(status: string | null) {
  const token = normalizeToken(status || "");
  if (!token) return "Ativo";
  if (
    [
      "inativo",
      "inactive",
      "cancelado",
      "cancelada",
      "cancelled",
      "encerrado",
      "encerrada",
      "baixado",
      "baixada",
      "desativado",
      "desativada",
      "suspenso",
      "suspensa",
      "disabled",
    ].includes(token)
  ) {
    return "Inativo";
  }
  if (["onboarding", "implantacao", "implementacao", "em_implantacao", "em_onboarding"].includes(token)) {
    return "Onboarding";
  }
  return "Ativo";
}

function chunkArray<T>(items: T[], chunkSize: number) {
  if (chunkSize <= 0) return [items];
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize));
  }
  return chunks;
}

function normalizeDate(value: unknown): string | null {
  const text = asTrimmedString(value);
  if (!text) return null;
  if (text === "0000-00-00") return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;

  if (/^\d{2}\/\d{2}\/\d{4}$/.test(text)) {
    const [day, month, year] = text.split("/");
    if (day === "00" || month === "00" || year === "0000") return null;
    return `${year}-${month}-${day}`;
  }

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

function normalizeDateTime(value: unknown): string | null {
  const text = asTrimmedString(value);
  if (!text) return null;
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function extractCnpjFromText(rawText: string): string | null {
  const cnpjPattern = /\d{2}[.\s]?\d{3}[.\s]?\d{3}[/\s]?\d{4}[-\s]?\d{2}/g;
  const directMatch = rawText.match(cnpjPattern);
  if (directMatch && directMatch.length > 0) {
    const normalized = normalizeCnpj(directMatch[0]);
    if (normalized) return normalized;
  }

  const digitsOnlyPattern = /(?:^|[^0-9])(\d{14})(?:[^0-9]|$)/;
  const digitsMatch = rawText.match(digitsOnlyPattern);
  if (digitsMatch?.[1]) {
    return normalizeCnpj(digitsMatch[1]);
  }

  return null;
}

function extractCompetenceFromText(rawText: string): string | null {
  const text = rawText.replace(/\s+/g, " ");
  const yearMonthPattern = /(?:competencia|competÃªncia|periodo|perÃ­odo|ref(?:erencia|erÃªncia)?)?\s*[:-]?\s*(20\d{2})[/_.-]?(0[1-9]|1[0-2])/i;
  const monthYearPattern = /(?:competencia|competÃªncia|periodo|perÃ­odo|ref(?:erencia|erÃªncia)?)?\s*[:-]?\s*(0[1-9]|1[0-2])[/_.-](20\d{2})/i;

  const yearMonthMatch = text.match(yearMonthPattern);
  if (yearMonthMatch) return `${yearMonthMatch[1]}-${yearMonthMatch[2]}`;

  const monthYearMatch = text.match(monthYearPattern);
  if (monthYearMatch) return `${monthYearMatch[2]}-${monthYearMatch[1]}`;

  return null;
}

function extractObligationNameFromPath(pathFolder: string | null): string | null {
  const value = asTrimmedString(pathFolder);
  if (!value) return null;
  const normalized = value.replace(/\\/g, "/");
  const segments = normalized.split("/").map((part) => part.trim()).filter(Boolean);
  if (segments.length === 0) return null;

  const guiasIndex = segments.findIndex((segment) => normalizeToken(segment) === "guias");
  if (guiasIndex >= 0 && segments[guiasIndex + 1]) {
    return segments[guiasIndex + 1];
  }

  return segments[segments.length - 1] || null;
}

function extractBracketedObligation(message: string | null): string | null {
  const value = asTrimmedString(message);
  if (!value) return null;
  const match = value.match(/\[([^\]]+)\]/);
  if (!match?.[1]) return null;
  return asTrimmedString(match[1]);
}

function parseBodyAsRecord(value: unknown): JsonRecord {
  const parsed = asRecord(value);
  return parsed || {};
}

function extractBearerToken(req: Request, fallbackToken?: string | null): string | null {
  const authorization = req.headers.get("authorization");
  if (authorization && authorization.toLowerCase().startsWith("bearer ")) {
    const token = authorization.slice(7).trim();
    if (token.length > 0) return token;
  }
  const fallback = asTrimmedString(fallbackToken);
  return fallback || null;
}

function getPathCandidates(envName: string, defaults: string[]) {
  const raw = asTrimmedString(Deno.env.get(envName));
  if (!raw) return defaults;
  const values = raw
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  return values.length > 0 ? values : defaults;
}

function resolveTemplatePath(pathTemplate: string, values: Record<string, string>) {
  let resolved = pathTemplate;
  for (const [key, value] of Object.entries(values)) {
    resolved = resolved
      .replaceAll(`{${key}}`, encodeURIComponent(value))
      .replaceAll(`:${key}`, encodeURIComponent(value));
  }
  return resolved;
}

function toIsoDateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

function subtractUtcDays(baseDate: Date, days: number) {
  const value = new Date(baseDate.getTime());
  value.setUTCDate(value.getUTCDate() - days);
  return value;
}

function addUtcDays(baseDate: Date, days: number) {
  const value = new Date(baseDate.getTime());
  value.setUTCDate(value.getUTCDate() + days);
  return value;
}

function asArray(value: unknown): unknown[] | null {
  return Array.isArray(value) ? value : null;
}

function getRecordValue(record: JsonRecord, key: string): unknown {
  if (key in record) return record[key];

  const normalizedKey = normalizeToken(key);
  for (const [recordKey, recordValue] of Object.entries(record)) {
    if (recordKey.toLowerCase() === key.toLowerCase()) {
      return recordValue;
    }
    if (normalizedKey && normalizeToken(recordKey) === normalizedKey) {
      return recordValue;
    }
  }

  return undefined;
}

function pickFirstString(source: unknown, keys: string[]): string | null {
  const record = asRecord(source);
  if (!record) return null;
  for (const key of keys) {
    const current = asTrimmedString(getRecordValue(record, key));
    if (current) return current;
  }
  return null;
}

function pickFirstText(source: unknown, keys: string[]): string | null {
  const record = asRecord(source);
  if (!record) return null;
  for (const key of keys) {
    const directText = asTrimmedText(getRecordValue(record, key));
    if (directText) return directText;
  }
  return null;
}

function pickFirstNestedString(source: unknown, paths: string[]): string | null {
  for (const path of paths) {
    const segments = path.split(".");
    let current: unknown = source;
    let valid = true;
    for (const segment of segments) {
      const record = asRecord(current);
      if (!record) {
        valid = false;
        break;
      }
      current = getRecordValue(record, segment);
    }
    if (!valid) continue;
    const value = asTrimmedString(current);
    if (value) return value;
  }
  return null;
}

function pickFirstNestedText(source: unknown, paths: string[]): string | null {
  for (const path of paths) {
    const segments = path.split(".");
    let current: unknown = source;
    let valid = true;
    for (const segment of segments) {
      const record = asRecord(current);
      if (!record) {
        valid = false;
        break;
      }
      current = getRecordValue(record, segment);
    }
    if (!valid) continue;
    const value = asTrimmedText(current);
    if (value) return value;
  }
  return null;
}

function pickFirstRecord(source: unknown, keys: string[]): JsonRecord | null {
  const record = asRecord(source);
  if (!record) return null;
  for (const key of keys) {
    const value = getRecordValue(record, key);
    const valueRecord = asRecord(value);
    if (valueRecord) return valueRecord;
    const valueArray = asArray(value);
    if (!valueArray) continue;
    for (const item of valueArray) {
      const itemRecord = asRecord(item);
      if (itemRecord) return itemRecord;
    }
  }
  return null;
}

function collectCompanyRecordCandidates(companyRecord: JsonRecord): JsonRecord[] {
  const candidates: JsonRecord[] = [companyRecord];
  const nestedKeys = [
    "registration_data",
    "registrationData",
    "dados_cadastrais",
    "cadastro",
    "empresa",
    "company",
    "dadosEmpresa",
    "DadosEmpresa",
  ];
  for (const key of nestedKeys) {
    const nested = asRecord(getRecordValue(companyRecord, key));
    if (nested) candidates.push(nested);
  }
  return candidates;
}

function pickCompanyText(records: JsonRecord[], keys: string[], nestedPaths: string[] = []): string | null {
  for (const record of records) {
    const directValue = pickFirstText(record, keys);
    if (directValue) return directValue;
  }
  if (nestedPaths.length > 0) {
    for (const record of records) {
      const nestedValue = pickFirstNestedText(record, nestedPaths);
      if (nestedValue) return nestedValue;
    }
  }
  return null;
}

function pickCompanyRecord(records: JsonRecord[], keys: string[]): JsonRecord | null {
  for (const record of records) {
    const nested = pickFirstRecord(record, keys);
    if (nested) return nested;
  }
  return null;
}

function buildClientAddressFromSnapshot(snapshot: CompanyRegistrationSnapshot): string | null {
  const streetLine = [snapshot.endereco, snapshot.numeroEstabelecimento ? `N ${snapshot.numeroEstabelecimento}` : null]
    .filter(Boolean)
    .join(", ");
  const cityState = [snapshot.cidade, snapshot.estado].filter(Boolean).join("/");
  const localityLine = [snapshot.bairro, cityState, snapshot.cep].filter(Boolean).join(" - ");
  const composed = [streetLine, snapshot.complementoEndereco, localityLine].filter(Boolean).join(" | ");
  return asTrimmedText(composed);
}

function normalizeMoneyText(value: string | null): string | null {
  if (!value) return null;
  const cleaned = value.replace(/[^\d,.-]/g, "").trim();
  if (!/\d/.test(cleaned)) return null;
  return cleaned;
}

function extractCompanyRegistrationSnapshot(company: ParsedCompany): CompanyRegistrationSnapshot {
  const records = collectCompanyRecordCandidates(company.raw_payload);
  const rawCompanyData = pickCompanyRecord(records, [
    "dados_empresa",
    "dados da empresa",
    "empresa_dados",
  ]);
  if (rawCompanyData) records.push(rawCompanyData);

  const inscricaoEstadualRecord = pickCompanyRecord(records, [
    "inscricoes_estaduais",
    "inscricao_estadual_detalhes",
    "inscricao_estadual",
  ]);
  const inscricaoMunicipalRecord = pickCompanyRecord(records, [
    "inscricao_municipal_detalhes",
    "insc_municipal",
    "inscricao_municipal",
  ]);

  const foneValue = pickCompanyText(records, [
    "fone",
    "fone(s)",
    "fones",
    "telefone",
    "telefone_principal",
    "phone",
  ], [
    "contato.telefone",
    "contato.fone",
  ]);
  const { ddd, telefone } = splitBrazilPhone(foneValue);

  const codigo =
    pickCompanyText(records, ["id_empresa", "id empresa", "codigo", "code", "id"]) ||
    company.acessorias_company_id;
  const regimeTributario = pickCompanyText(records, [
    "regime_tributario",
    "regime tributario",
    "regime",
  ]);
  const grupoEmpresas = pickCompanyText(records, [
    "grupo_de_empresas",
    "grupo empresas",
    "grupo",
  ]);
  const nomeFantasia = pickCompanyText(records, ["nome_fantasia", "nome fantasia", "fantasia"]);
  const apelidoEcontinuo = pickCompanyText(records, [
    "apelido_e_continuo",
    "apelido_econtinuo",
    "apelido e-continuo",
    "apelido econtinuo",
  ]);
  const endereco = pickCompanyText(records, [
    "endereco",
    "endereço",
    "logradouro",
    "rua",
  ]);
  const numeroEstabelecimento = pickCompanyText(records, [
    "numero_estabelecimento",
    "numero",
    "número",
    "endereco_numero",
  ]);
  const complementoEndereco = pickCompanyText(records, ["complemento", "endereco_complemento"]);
  const cep = normalizeCepDigits(
    pickCompanyText(records, ["cep", "codigo_postal", "postal_code"]),
  );
  const bairro = pickCompanyText(records, ["bairro", "distrito"]);
  const cidade = pickCompanyText(records, ["cidade", "municipio", "município"]);
  const estado = normalizeStateCode(
    pickCompanyText(records, ["uf", "estado", "sigla_uf"]),
  );
  const inscricaoEstadual =
    pickCompanyText(records, ["inscricao_estadual", "inscricoes_estaduais", "ie"]) ||
    pickFirstText(inscricaoEstadualRecord, ["numero", "inscricao", "value"]);
  const inscricaoEstadualUf = normalizeStateCode(
    pickCompanyText(records, ["inscricao_estadual_uf", "uf_inscricao_estadual"]) ||
      pickFirstText(inscricaoEstadualRecord, ["uf", "estado"]),
  );
  const inscricaoEstadualData = normalizeDate(
    pickCompanyText(records, ["inscricao_estadual_data", "data_inscricao_estadual"]) ||
      pickFirstText(inscricaoEstadualRecord, ["data", "date"]),
  );
  const inscricaoMunicipal =
    pickCompanyText(records, ["inscricao_municipal", "insc_municipal", "im"]) ||
    pickFirstText(inscricaoMunicipalRecord, ["numero", "inscricao", "value"]);
  const inscricaoMunicipalData = normalizeDate(
    pickCompanyText(records, ["inscricao_municipal_data", "data_inscricao_municipal"]) ||
      pickFirstText(inscricaoMunicipalRecord, ["data", "date"]),
  );
  const nire = pickCompanyText(records, ["nire"]);
  const outrosIdentificadores = pickCompanyText(records, [
    "outros_identificadores",
    "outros identificadores",
    "cpf_cei",
  ]);
  const websiteEmpresa = pickCompanyText(records, [
    "website_da_empresa",
    "website_empresa",
    "website",
    "site",
  ]);
  const empresaAtiva = normalizeYesNo(
    pickCompanyText(records, ["ativa", "ativo", "situacao_ativa", "status"]) || company.status,
  );
  const empresaIsenta = normalizeYesNo(
    pickCompanyText(records, ["empresa_isenta", "isenta"]),
  );
  const honorario = normalizeMoneyText(
    pickCompanyText(records, ["honorario", "honorário", "valor_honorario"]),
  );

  return {
    codigo,
    regimeTributario,
    grupoEmpresas,
    nomeFantasia,
    apelidoEcontinuo,
    endereco,
    numeroEstabelecimento,
    complementoEndereco,
    cep,
    bairro,
    cidade,
    estado,
    inscricaoEstadual,
    inscricaoEstadualUf,
    inscricaoEstadualData,
    inscricaoMunicipal,
    inscricaoMunicipalData,
    nire,
    outrosIdentificadores,
    websiteEmpresa,
    empresaAtiva,
    empresaIsenta,
    ddd,
    telefone,
    honorario,
  };
}

function buildCadastroClientesEntriesFromSnapshot(snapshot: CompanyRegistrationSnapshot) {
  const entries: Array<{ field_name: string; field_value: string }> = [];
  const addEntry = (fieldName: string, value: string | null) => {
    const normalized = asTrimmedText(value);
    if (!normalized) return;
    entries.push({ field_name: fieldName, field_value: normalized });
  };
  const whatsappValue =
    snapshot.ddd && snapshot.telefone ? `${snapshot.ddd}${snapshot.telefone}` : snapshot.telefone;

  addEntry("codigo", snapshot.codigo);
  addEntry("nome_fantasia", snapshot.nomeFantasia);
  addEntry("regime_tribut\u00e1rio", snapshot.regimeTributario);
  addEntry("cep", snapshot.cep);
  addEntry("endere\u00e7o", snapshot.endereco);
  addEntry("numero_estabelecimento", snapshot.numeroEstabelecimento);
  addEntry("complemento_endereco", snapshot.complementoEndereco);
  addEntry("bairro", snapshot.bairro);
  addEntry("cidade", snapshot.cidade);
  addEntry("estado", snapshot.estado);
  addEntry("inscricao_estadual", snapshot.inscricaoEstadual);
  addEntry("inscricao_estadual_uf", snapshot.inscricaoEstadualUf);
  addEntry("inscricao_estadual_data", snapshot.inscricaoEstadualData);
  addEntry("inscricao_municipal", snapshot.inscricaoMunicipal);
  addEntry("inscricao_municipal_data", snapshot.inscricaoMunicipalData);
  addEntry("ddd", snapshot.ddd);
  addEntry("telefone", snapshot.telefone);
  addEntry("whatsapp", whatsappValue);
  addEntry("website_empresa", snapshot.websiteEmpresa);
  addEntry("grupo_empresas", snapshot.grupoEmpresas);
  addEntry("apelido_econtinuo", snapshot.apelidoEcontinuo);
  addEntry("nire", snapshot.nire);
  addEntry("outros_identificadores", snapshot.outrosIdentificadores);
  addEntry("empresa_ativa", snapshot.empresaAtiva);
  addEntry("empresa_isenta", snapshot.empresaIsenta);

  return entries;
}

async function upsertClientDataFields(
  supabaseAdmin: ReturnType<typeof createClient>,
  category: string,
  entriesByClient: Map<string, Map<string, string>>,
  callerUserId: string,
) {
  if (entriesByClient.size === 0) return 0;

  const clientIds = [...entriesByClient.keys()];
  const fieldNames = [...new Set(
    clientIds.flatMap((clientId) => [...(entriesByClient.get(clientId)?.keys() || [])]),
  )];

  if (fieldNames.length === 0) return 0;

  const existingByKey = new Map<string, string>();
  for (const chunk of chunkArray(clientIds, 200)) {
    const { data, error } = await supabaseAdmin
      .from("client_data")
      .select("id, client_id, field_name")
      .eq("category", category)
      .is("period", null)
      .in("client_id", chunk)
      .in("field_name", fieldNames);
    if (error) throw error;

    for (const row of data || []) {
      const clientId = asTrimmedText(row.client_id);
      const fieldName = asTrimmedText(row.field_name);
      const rowId = asTrimmedText(row.id);
      if (!clientId || !fieldName || !rowId) continue;
      existingByKey.set(`${clientId}__${fieldName}`, rowId);
    }
  }

  const rows: Array<Record<string, unknown>> = [];
  for (const [clientId, fieldMap] of entriesByClient.entries()) {
    for (const [fieldName, fieldValue] of fieldMap.entries()) {
      const row: Record<string, unknown> = {
        client_id: clientId,
        category,
        field_name: fieldName,
        field_value: fieldValue,
        period: null,
        created_by: callerUserId,
      };
      const existingId = existingByKey.get(`${clientId}__${fieldName}`);
      if (existingId) row.id = existingId;
      rows.push(row);
    }
  }

  let upserted = 0;
  for (const chunk of chunkArray(rows, 300)) {
    const { error } = await supabaseAdmin
      .from("client_data")
      .upsert(chunk, { onConflict: "id" });
    if (error) throw error;
    upserted += chunk.length;
  }

  return upserted;
}

function extractArrayCandidates(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  const record = asRecord(payload);
  if (!record) return [];

  const directKeys = [
    "data",
    "Data",
    "items",
    "results",
    "rows",
    "companies",
    "Companies",
    "empresas",
    "Empresas",
    "ListAll",
    "deliveries",
    "Deliveries",
    "Entregas",
    "obligations",
    "Obrigacoes",
    "obrigacoes",
    "content",
    "list",
  ];

  for (const key of directKeys) {
    const maybeArray = getRecordValue(record, key);
    if (Array.isArray(maybeArray)) return maybeArray;
    const nestedRecord = asRecord(maybeArray);
    if (!nestedRecord) continue;
    for (const nestedKey of ["data", "items", "results", "rows", "content", "Deliveries", "Entregas"]) {
      const nestedArray = getRecordValue(nestedRecord, nestedKey);
      if (Array.isArray(nestedArray)) return nestedArray;
    }
  }

  return [];
}

function normalizeObligationStatus(value: string | null) {
  if (!value) return null;
  const token = normalizeToken(value);
  if (!token) return value;
  if (
    [
      "done",
      "completed",
      "concluido",
      "concluida",
      "entregue",
      "delivered",
      "sent",
      "enviado",
      "ent_atrasada",
      "ent_antecipada",
      "ent_pztec",
      "ent_pz_tec",
      "ent_no_prazo",
      "entregue_no_prazo",
      "finalizado",
      "finalizada",
    ].includes(token)
  ) {
    return "concluido";
  }
  if (["pending", "pendente", "open", "aberto", "to_send", "a_enviar"].includes(token)) {
    return "pendente";
  }
  if (["overdue", "atrasado", "late", "vencido"].includes(token)) {
    return "atrasado";
  }
  if (["processing", "in_progress", "em_andamento", "running", "sending"].includes(token)) {
    return "em_andamento";
  }
  return value;
}

function isCompletedStatus(status: string | null) {
  const token = normalizeToken(status || "");
  return (
    token === "concluido" ||
    token === "concluida" ||
    token === "completed" ||
    token === "done" ||
    token === "entregue" ||
    token === "delivered" ||
    token === "sent" ||
    token === "enviado"
  );
}

function isPendingLikeStatus(status: string | null) {
  if (!status) return true;
  return !isCompletedStatus(status);
}

function normalizeSectorFromObligationName(name: string) {
  const token = normalizeToken(name);
  if (
    token.includes("folha") ||
    token.includes("esocial") ||
    token.includes("fgts") ||
    token.includes("inss") ||
    token.includes("pro_labore") ||
    token.includes("funcionario") ||
    token.includes("holerite")
  ) {
    return "Departamento Pessoal";
  }

  if (
    token.includes("dctf") ||
    token.includes("sped") ||
    token.includes("icms") ||
    token.includes("iss") ||
    token.includes("pis") ||
    token.includes("cofins") ||
    token.includes("nfe") ||
    token.includes("defis") ||
    token.includes("gia")
  ) {
    return "Fiscal";
  }

  return "Contabil";
}

function computePriorityByDueDate(dueDate: string | null) {
  if (!dueDate) return "Media";
  const parsed = new Date(`${dueDate}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return "Media";
  const now = new Date();
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const targetUtc = Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate());
  const diffDays = Math.floor((targetUtc - todayUtc) / 86400000);
  if (diffDays < 0) return "Urgente";
  if (diffDays <= 2) return "Alta";
  if (diffDays <= 7) return "Media";
  return "Baixa";
}

function toPeriodKey(period: string | null) {
  const value = asTrimmedString(period);
  return value || "";
}

function pickPreferredObligationRow(
  current: Record<string, unknown>,
  incoming: Record<string, unknown>,
) {
  const currentDeliveredAt = normalizeDateTime(asTrimmedString(current.delivered_at));
  const incomingDeliveredAt = normalizeDateTime(asTrimmedString(incoming.delivered_at));
  if (!currentDeliveredAt && incomingDeliveredAt) return incoming;
  if (currentDeliveredAt && !incomingDeliveredAt) return current;
  if (currentDeliveredAt && incomingDeliveredAt && incomingDeliveredAt > currentDeliveredAt) return incoming;

  const currentDueDate = normalizeDate(asTrimmedString(current.due_date));
  const incomingDueDate = normalizeDate(asTrimmedString(incoming.due_date));
  if (!currentDueDate && incomingDueDate) return incoming;
  if (currentDueDate && incomingDueDate && incomingDueDate > currentDueDate) return incoming;

  const currentStatus = normalizeObligationStatus(asTrimmedString(current.status));
  const incomingStatus = normalizeObligationStatus(asTrimmedString(incoming.status));
  if (isPendingLikeStatus(currentStatus) && !isPendingLikeStatus(incomingStatus)) return incoming;

  return current;
}

async function requestAcessorias(
  baseUrl: string,
  apiToken: string,
  path: string,
  init?: RequestInit,
): Promise<AcessoriasRequestResult> {
  const url = path.startsWith("http://") || path.startsWith("https://")
    ? path
    : new URL(path, baseUrl).toString();

  const headers = new Headers(init?.headers || {});
  headers.set("Authorization", `Bearer ${apiToken}`);
  headers.set("Accept", "application/json");

  if (init?.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const rawTimeoutMs = Number(asTrimmedString(Deno.env.get("ACESSORIAS_HTTP_TIMEOUT_MS")) || "12000");
  const timeoutMs = Number.isFinite(rawTimeoutMs) && rawTimeoutMs > 0
    ? Math.min(60000, Math.max(3000, Math.trunc(rawTimeoutMs)))
    : 12000;
  const signal = init?.signal || (typeof AbortSignal !== "undefined" &&
      typeof (AbortSignal as unknown as { timeout?: (ms: number) => AbortSignal }).timeout === "function"
    ? (AbortSignal as unknown as { timeout: (ms: number) => AbortSignal }).timeout(timeoutMs)
    : undefined);

  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers,
      signal,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown fetch error";
    throw new Error(`Acessorias request error at ${path}: ${message}`);
  }

  const text = await response.text();
  let payload: unknown = text;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }

  return {
    ok: response.ok,
    status: response.status,
    path,
    payload,
  };
}

async function requestFirstSuccessful(
  baseUrl: string,
  apiToken: string,
  pathCandidates: string[],
  init?: RequestInit,
) {
  const attempted: Array<{ path: string; status: number; payload: unknown }> = [];

  for (const path of pathCandidates) {
    let result: AcessoriasRequestResult;
    try {
      result = await requestAcessorias(baseUrl, apiToken, path, init);
    } catch (error) {
      attempted.push({
        path,
        status: 0,
        payload: error instanceof Error ? error.message : "Request execution failed",
      });
      continue;
    }
    if (result.ok) {
      return result;
    }
    attempted.push({ path, status: result.status, payload: result.payload });

    if (result.status === 401 || result.status === 403) {
      break;
    }
  }

  throw new Error(
    `Acessorias request failed for all endpoints. Attempts: ${JSON.stringify(attempted)}`,
  );
}

function extractApiMessage(payload: unknown) {
  const direct = asTrimmedString(payload);
  if (direct) return direct;

  const record = asRecord(payload);
  if (!record) return null;

  return (
    pickFirstString(record, ["msg", "message", "Mensagem", "Erro", "error"]) ||
    pickFirstNestedString(record, ["data.msg", "data.message", "payload.msg", "payload.message"])
  );
}

function summarizeObligationChanges(
  previous: {
    obligation_name: string;
    obligation_period: string | null;
    due_date: string | null;
    status: string | null;
    protocol: string | null;
    notes: string | null;
  },
  next: {
    obligation_name: string;
    obligation_period: string | null;
    due_date: string | null;
    status: string | null;
    protocol: string | null;
    notes: string | null;
  },
) {
  const changes: string[] = [];
  if (previous.obligation_name !== next.obligation_name) {
    changes.push(`Obrigacao: ${previous.obligation_name} -> ${next.obligation_name}`);
  }
  if ((previous.obligation_period || "") !== (next.obligation_period || "")) {
    changes.push(`Competencia: ${previous.obligation_period || "-"} -> ${next.obligation_period || "-"}`);
  }
  if ((previous.due_date || "") !== (next.due_date || "")) {
    changes.push(`Vencimento: ${previous.due_date || "-"} -> ${next.due_date || "-"}`);
  }
  if ((normalizeObligationStatus(previous.status) || "") !== (normalizeObligationStatus(next.status) || "")) {
    changes.push(`Status: ${previous.status || "-"} -> ${next.status || "-"}`);
  }
  if ((previous.protocol || "") !== (next.protocol || "")) {
    changes.push(`Protocolo: ${previous.protocol || "-"} -> ${next.protocol || "-"}`);
  }
  if ((previous.notes || "") !== (next.notes || "")) {
    changes.push(`Observacoes: ${previous.notes || "-"} -> ${next.notes || "-"}`);
  }
  return changes;
}

async function notifyAcessoriasObligationChange(
  acessoriasApiBaseUrl: string,
  acessoriasApiToken: string,
  input: {
    companyId: string;
    departmentId: string | null;
    clientName: string;
    clientIdentifier: string | null;
    obligationName: string;
    obligationPeriod: string | null;
    dueDate: string | null;
    status: string | null;
    protocol: string | null;
    notes: string | null;
    changeLines: string[];
  },
) {
  const requestDescriptionLines = [
    "Ajuste de obrigacao solicitado no Grow Finance Hub.",
    `Empresa: ${input.clientName}${input.clientIdentifier ? ` (${input.clientIdentifier})` : ""}`,
    `Obrigacao: ${input.obligationName}`,
    `Competencia: ${input.obligationPeriod || "-"}`,
    `Vencimento: ${input.dueDate || "-"}`,
    `Status: ${input.status || "-"}`,
    input.protocol ? `Protocolo: ${input.protocol}` : null,
    input.notes ? `Observacoes: ${input.notes}` : null,
    input.changeLines.length > 0 ? "Alteracoes aplicadas:" : null,
    ...input.changeLines.map((line) => `- ${line}`),
  ].filter(Boolean);

  const description = requestDescriptionLines.join("\n");
  const departmentId = asTrimmedString(input.departmentId) || "1";
  const formData = new FormData();
  formData.append("assunto", `Atualizacao de obrigacao - ${input.obligationName}`);
  formData.append("tipo", "I");
  formData.append("empresa", input.companyId);
  formData.append("departamento", departmentId);
  formData.append("prioridade", "2");
  formData.append("descricao", description);
  if (input.dueDate) {
    formData.append("data_prazo", input.dueDate);
  }

  const pathCandidates = getPathCandidates("ACESSORIAS_REQUESTS_PATHS", defaultRequestsPathCandidates);
  const response = await requestFirstSuccessful(
    acessoriasApiBaseUrl,
    acessoriasApiToken,
    pathCandidates,
    {
      method: "POST",
      body: formData,
    },
  );

  const payloadRecord = asRecord(response.payload);
  return {
    ok: true,
    endpoint_used: response.path,
    request_id:
      (payloadRecord && pickFirstString(payloadRecord, ["id", "ID", "request_id", "SolID"])) ||
      null,
    message: extractApiMessage(response.payload) || "Solicitacao de atualizacao enviada ao Acessorias.",
    payload: response.payload,
  };
}

function pickFirstArray(source: unknown, keys: string[]): unknown[] | null {
  const record = asRecord(source);
  if (!record) return null;
  for (const key of keys) {
    const value = getRecordValue(record, key);
    const arr = asArray(value);
    if (arr) return arr;
  }
  return null;
}

function parseCompanies(payload: unknown): ParsedCompany[] {
  const rows = extractArrayCandidates(payload);
  const parsed: ParsedCompany[] = [];
  const seenIds = new Set<string>();

  for (const row of rows) {
    const record = asRecord(row);
    if (!record) continue;

    const companyId =
      pickFirstText(record, [
        "id",
        "ID",
        "company_id",
        "empresa_id",
        "codigo",
        "code",
        "uuid",
        "Identificador",
        "identificador",
      ]) ||
      pickFirstNestedText(record, ["company.id", "empresa.id"]);
    if (!companyId) continue;

    if (seenIds.has(companyId)) continue;
    seenIds.add(companyId);

    const companyName =
      pickFirstText(record, [
        "company_name",
        "name",
        "razao_social",
        "Razao",
        "Fantasia",
        "nome_fantasia",
        "nome",
      ]) ||
      `Empresa ${companyId}`;

    const cnpj =
      normalizeCnpj(
        pickFirstText(record, [
          "cnpj",
          "CNPJ",
          "Identificador",
          "identificador",
          "document",
          "document_number",
          "cpf_cnpj",
          "numero_cnpj",
        ]),
      ) ||
      normalizeCnpj(pickFirstNestedText(record, ["document.number", "empresa.cnpj"]));

    const status =
      pickFirstText(record, ["status", "Status", "situacao", "company_status"]) ||
      pickFirstNestedText(record, ["situation.name", "situacao.nome"]);

    parsed.push({
      acessorias_company_id: companyId,
      cnpj,
      company_name: companyName,
      status,
      raw_payload: record,
    });
  }

  return parsed;
}

function parseObligations(payload: unknown): ParsedObligation[] {
  const parsed: ParsedObligation[] = [];
  const seen = new Set<string>();

  const buildAndPushObligation = (
    deliverySource: unknown,
    companyIdentifier: string | null,
    companyName: string | null,
  ) => {
    const record = asRecord(deliverySource);
    if (!record) return;

    const obligationName =
      pickFirstString(record, [
        "Nome",
        "name",
        "obligation_name",
        "descricao",
        "description",
        "title",
        "tipo",
      ]) ||
      pickFirstNestedString(record, ["obligation.name", "tipo.nome"]) ||
      "Obrigacao";

    const obligationId =
      pickFirstString(record, ["id", "ID", "obligation_id", "delivery_id", "codigo", "code", "uuid", "EntID"]) ||
      pickFirstNestedString(record, ["obligation.id", "delivery.id", "Config.EntID", "config.entid", "Config.ID"]);

    const obligationPeriod =
      pickFirstString(record, [
        "period",
        "competencia",
        "competence",
        "reference",
        "mes_referencia",
        "EntCompetencia",
      ]) ||
      pickFirstNestedString(record, ["obligation.period", "delivery.period"]);

    const dueDate =
      normalizeDate(
        pickFirstString(record, [
          "due_date",
          "deadline",
          "data_vencimento",
          "vencimento",
          "expires_at",
          "EntDtPrazo",
          "EntDtAtraso",
        ]),
      ) ||
      normalizeDate(pickFirstNestedString(record, ["deadlines.due_date", "prazo.vencimento"]));

  const deliveredAt =
      normalizeDateTime(
        pickFirstString(record, [
          "delivered_at",
          "sent_at",
          "data_envio",
          "delivery_date",
          "concluded_at",
          "EntDtEntrega",
        ]),
      ) ||
      normalizeDateTime(pickFirstNestedString(record, ["delivery.sent_at", "envio.data"]));

    const statusRaw =
      pickFirstString(record, ["status", "Status", "situacao", "state"]) ||
      pickFirstNestedString(record, ["status.name", "situacao.nome"]);
    const normalizedStatus = normalizeObligationStatus(statusRaw);

    const protocol =
      pickFirstString(record, ["protocol", "protocolo", "receipt", "comprovante", "EntGuiaLida"]) ||
      pickFirstNestedString(record, ["submission.protocol"]);

    const notes =
      pickFirstString(record, [
        "notes",
        "observacoes",
        "observation",
        "message",
        "descricao_complementar",
        "EntMulta",
      ]) ||
      pickFirstNestedString(record, ["status.description"]);

    const safeObligationId =
      obligationId ||
      `${normalizeToken(obligationName) || "obrigacao"}_${toPeriodKey(obligationPeriod) || "sem_periodo"}_${dueDate || "sem_prazo"}`;
    const dedupeKey = `${companyIdentifier || "sem_empresa"}:${safeObligationId}:${toPeriodKey(obligationPeriod)}:${dueDate || ""}`;
    if (seen.has(dedupeKey)) return;
    seen.add(dedupeKey);

    const enrichedPayload: JsonRecord = {
      ...record,
      _company_identifier: companyIdentifier,
      _company_name: companyName,
    };

    parsed.push({
      acessorias_obligation_id: safeObligationId,
      obligation_name: obligationName,
      obligation_period: obligationPeriod,
      obligation_period_key: toPeriodKey(obligationPeriod),
      due_date: dueDate,
      delivered_at: deliveredAt,
      status: normalizedStatus,
      protocol,
      notes,
      source_payload: enrichedPayload,
    });
  };

  const parseCompanyDeliveries = (companySource: unknown) => {
    const companyRecord = asRecord(companySource);
    if (!companyRecord) return false;

    const deliveries = pickFirstArray(companyRecord, ["Entregas", "deliveries", "Deliveries", "obrigacoes", "Obrigacoes"]);
    if (!deliveries || deliveries.length === 0) return false;

    const companyIdentifier =
      normalizeCnpj(pickFirstString(companyRecord, ["Identificador", "identificador", "cnpj", "CNPJ"])) ||
      pickFirstString(companyRecord, ["ID", "id", "company_id", "empresa_id"]);
    const companyName =
      pickFirstString(companyRecord, ["Razao", "Fantasia", "name", "company_name", "nome"]) || null;

    for (const delivery of deliveries) {
      buildAndPushObligation(delivery, companyIdentifier, companyName);
    }
    return true;
  };

  const payloadRecord = asRecord(payload);
  if (payloadRecord) {
    parseCompanyDeliveries(payloadRecord);
  }

  const rows = extractArrayCandidates(payload);
  for (const row of rows) {
    const usedNestedDeliveries = parseCompanyDeliveries(row);
    if (usedNestedDeliveries) continue;
    buildAndPushObligation(row, null, null);
  }

  return parsed;
}

async function buildAuthContext(req: Request, fallbackToken?: string | null) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    throw new Error("Missing Supabase environment configuration");
  }

  const token = extractBearerToken(req, fallbackToken);
  if (!token) {
    return { error: jsonResponse({ error: "Authorization token is required" }, 401) };
  }

  const supabaseUser = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

  const {
    data: { user: callerUser },
    error: callerError,
  } = await supabaseUser.auth.getUser();

  if (callerError || !callerUser) {
    return { error: jsonResponse({ error: "Invalid or expired session" }, 401) };
  }

  const { data: callerRoleRows, error: callerRolesError } = await supabaseAdmin
    .from("user_roles")
    .select("role, organization_id")
    .eq("user_id", callerUser.id);

  if (callerRolesError) {
    throw callerRolesError;
  }

  const callerRoles = (callerRoleRows || [])
    .map((row) => String(row.role || "").toLowerCase())
    .filter(Boolean);
  const organizationIds = Array.from(
    new Set(
      (callerRoleRows || [])
        .map((row) => asTrimmedString((row as JsonRecord).organization_id))
        .filter((organizationId): organizationId is string => Boolean(organizationId)),
    ),
  );

  const hasInternalRole = callerRoles.some((role) => internalRoles.has(role));
  if (!hasInternalRole) {
    return { error: jsonResponse({ error: "Only internal users can use the Acessorias module" }, 403) };
  }

  const acessoriasApiToken = asTrimmedString(Deno.env.get("ACESSORIAS_API_TOKEN"));
  const acessoriasApiBaseUrl =
    asTrimmedString(Deno.env.get("ACESSORIAS_API_BASE_URL")) || "https://api.acessorias.com";

  return {
    supabaseAdmin,
    callerUser,
    callerRoles,
    organizationIds,
    acessoriasApiToken,
    acessoriasApiBaseUrl,
  };
}

function resolveRequestedOrganizationId(payload: JsonRecord, organizationIds: string[]) {
  const requestedOrganizationId = asTrimmedString(payload.organization_id) || asTrimmedString(payload.organizationId);
  if (requestedOrganizationId) {
    if (!organizationIds.includes(requestedOrganizationId)) {
      throw new Error("User is not authorized for the requested organization.");
    }

    return requestedOrganizationId;
  }

  if (organizationIds.length > 0) return organizationIds[0];
  throw new Error("No organization is available for this user.");
}

async function assertOrganizationFeatureEnabled(
  supabaseAdmin: ReturnType<typeof createClient>,
  organizationId: string,
  featureKey: string,
) {
  const { data, error } = await supabaseAdmin
    .from("organization_settings")
    .select("feature_flags")
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error) throw error;

  const flags = data?.feature_flags;
  if (
    flags &&
    typeof flags === "object" &&
    !Array.isArray(flags) &&
    (flags as JsonRecord)[featureKey] === false
  ) {
    throw new Error(`Module ${featureKey} is disabled for this organization.`);
  }
}

async function ensureKanbanTaskForObligation(
  supabaseAdmin: ReturnType<typeof createClient>,
  input: CreateKanbanTaskInput,
  options?: { allowCreate?: boolean },
) {
  const allowCreate = options?.allowCreate ?? true;
  const integrationTaskId = `${input.clientId}:${input.obligationId}:${toPeriodKey(input.obligationPeriod)}`;
  const dueDateText = input.dueDate ? `Vencimento: ${input.dueDate}` : "Vencimento nao informado";
  const protocolText = input.protocol ? `Protocolo: ${input.protocol}` : null;
  const notesText = input.notes ? `Observacoes: ${input.notes}` : null;
  const description = [
    `Obrigacao sincronizada via Acessorias.`,
    dueDateText,
    input.obligationPeriod ? `Competencia: ${input.obligationPeriod}` : null,
    protocolText,
    notesText,
  ]
    .filter(Boolean)
    .join("\n");

  const priority = computePriorityByDueDate(input.dueDate);
  const sector = normalizeSectorFromObligationName(input.obligationName);
  const isCompleted = isCompletedStatus(input.status);

  const { data: existingTask, error: existingTaskError } = await supabaseAdmin
    .from("kanban_tasks")
    .select("id, status")
    .eq("integration_source", "acessorias_obrigacao")
    .eq("integration_task_id", integrationTaskId)
    .maybeSingle();
  if (existingTaskError) {
    throw existingTaskError;
  }

  if (!existingTask) {
    if (!allowCreate) return null;

    const { data: createdTask, error: createError } = await supabaseAdmin
      .from("kanban_tasks")
      .insert({
        title: buildObligationTaskTitle(input.obligationName, input.clientName),
        description,
        client_name: input.clientName,
        assignee: null,
        priority,
        sector,
        status: isCompleted ? "done" : "todo",
        due_date: input.dueDate,
        tags: ["Acessorias", "Obrigacao"],
        created_by: input.createdBy,
        integration_source: "acessorias_obrigacao",
        integration_task_id: integrationTaskId,
        integration_payload: input.payload,
      })
      .select("id")
      .maybeSingle();

    if (createError) {
      throw createError;
    }

    return createdTask?.id || null;
  }

  let nextStatus = existingTask.status;
  if (existingTask.status !== "archived") {
    if (isCompleted) {
      nextStatus = "done";
    } else if (existingTask.status === "done") {
      nextStatus = "todo";
    }
  }

  const updatePayload: Record<string, unknown> = {
    title: buildObligationTaskTitle(input.obligationName, input.clientName),
    description,
    client_name: input.clientName,
    priority,
    sector,
    due_date: input.dueDate,
    tags: ["Acessorias", "Obrigacao"],
    integration_payload: input.payload,
  };
  if (nextStatus !== existingTask.status) {
    updatePayload.status = nextStatus;
  }

  const { data, error } = await supabaseAdmin
    .from("kanban_tasks")
    .update(updatePayload)
    .eq("id", existingTask.id)
    .select("id")
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data?.id || existingTask.id;
}

async function cleanupObligationKanbanTasks(
  supabaseAdmin: ReturnType<typeof createClient>,
  options?: { clientId?: string | null },
) {
  const clientId = asTrimmedString(options?.clientId || null);
  let query = supabaseAdmin
    .from("kanban_tasks")
    .delete()
    .eq("integration_source", "acessorias_obrigacao");

  if (clientId) {
    query = query.like("integration_task_id", `${clientId}:%`);
  }

  const { error } = await query;
  if (!error) return;
  if (isSchemaDependencyError(error)) {
    console.warn("cleanupObligationKanbanTasks skipped due to schema dependency error:", error);
    return;
  }
  throw error;
}

function mapObligationStatusToCalendarStatus(status: string | null) {
  const token = normalizeToken(status || "");
  if (
    token === "cancelado" ||
    token === "cancelada" ||
    token === "cancelled" ||
    token === "canceled" ||
    token === "anulado" ||
    token === "anulada"
  ) {
    return "cancelled";
  }
  return isCompletedStatus(status) ? "completed" : "pending";
}

function computeCalendarPriorityByDueDate(dueDate: string | null) {
  const token = normalizeToken(computePriorityByDueDate(dueDate));
  if (token === "urgente") return "urgente";
  if (token === "alta") return "alta";
  if (token === "baixa") return "baixa";
  return "media";
}

function isCalendarEntryTypeConstraintError(error: unknown) {
  const message =
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
      ? (error as { message: string }).message.toLowerCase()
      : "";

  if (!message) return false;
  return (
    message.includes("calendar_events_entry_type_check") ||
    (message.includes("entry_type") && message.includes("check"))
  );
}

function isSchemaDependencyError(error: unknown) {
  const message =
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
      ? (error as { message: string }).message.toLowerCase()
      : "";

  if (!message) return false;
  return (
    (message.includes("column") && message.includes("does not exist")) ||
    (message.includes("relation") && message.includes("does not exist")) ||
    message.includes("undefined column")
  );
}

async function syncCalendarEventsForObligations(
  supabaseAdmin: ReturnType<typeof createClient>,
  rows: Array<Record<string, unknown>>,
  clientNameById: Map<string, string>,
  callerUserId: string | null,
) {
  let created = 0;
  let updated = 0;
  let cancelled = 0;
  let skipped = 0;

  const upsertByKey = new Map<string, Record<string, unknown>>();
  const keysWithoutDueDate = new Set<string>();

  for (const row of rows) {
    const clientId = asTrimmedString(row.client_id);
    const obligationId = asTrimmedString(row.acessorias_obligation_id);
    const obligationName = asTrimmedString(row.obligation_name);
    const obligationPeriod = asTrimmedString(row.obligation_period);
    const periodKey = asTrimmedString(row.obligation_period_key) || toPeriodKey(obligationPeriod) || "sem_periodo";
    const dueDate = normalizeDate(asTrimmedString(row.due_date));
    const normalizedStatus = normalizeObligationStatus(asTrimmedString(row.status));

    if (!clientId || !obligationId || !obligationName) {
      skipped += 1;
      continue;
    }

    const integrationKey = `${clientId}:${obligationId}:${periodKey}`;
    if (!dueDate) {
      keysWithoutDueDate.add(integrationKey);
      skipped += 1;
      continue;
    }

    const clientName = clientNameById.get(clientId) || "Cliente sem nome";
    const description = [
      "Obrigacao sincronizada automaticamente via Acessorias.",
      `Cliente: ${clientName}`,
      `Obrigacao: ${obligationName}`,
      obligationPeriod ? `Competencia: ${obligationPeriod}` : null,
      `Prazo tecnico: ${dueDate}`,
    ]
      .filter(Boolean)
      .join("\n");

    upsertByKey.set(integrationKey, {
      integration_source: obligationCalendarIntegrationSource,
      integration_key: integrationKey,
      title: `[Obrigacao] ${obligationName} - ${clientName}`,
      description,
      entry_type: "obriga\u00e7\u00e3o",
      priority: computeCalendarPriorityByDueDate(dueDate),
      sector: normalizeSectorFromObligationName(obligationName),
      due_at: `${dueDate}T12:00:00.000Z`,
      all_day: true,
      status: mapObligationStatusToCalendarStatus(normalizedStatus),
      created_by: callerUserId,
    });
  }

  const upsertRows = Array.from(upsertByKey.values());

  for (const rowsChunk of chunkArray(upsertRows, 300)) {
    const integrationKeys = rowsChunk
      .map((item) => asTrimmedString(item.integration_key))
      .filter((value): value is string => Boolean(value));

    const existingSet = new Set<string>();
    if (integrationKeys.length > 0) {
      const { data: existingRows, error: existingError } = await supabaseAdmin
        .from("calendar_events")
        .select("integration_key")
        .eq("integration_source", obligationCalendarIntegrationSource)
        .in("integration_key", integrationKeys);
      if (existingError) throw existingError;

      for (const existingRow of existingRows || []) {
        const key = asTrimmedString(existingRow.integration_key);
        if (key) existingSet.add(key);
      }
    }

    let { error: upsertError } = await supabaseAdmin
      .from("calendar_events")
      .upsert(rowsChunk, { onConflict: "integration_source,integration_key" });

    if (upsertError && isCalendarEntryTypeConstraintError(upsertError)) {
      const fallbackRows = rowsChunk.map((item) => ({ ...item, entry_type: "obrigacao" }));
      const fallbackResult = await supabaseAdmin
        .from("calendar_events")
        .upsert(fallbackRows, { onConflict: "integration_source,integration_key" });
      upsertError = fallbackResult.error;
    }

    if (upsertError) throw upsertError;

    created += integrationKeys.filter((key) => !existingSet.has(key)).length;
    updated += integrationKeys.filter((key) => existingSet.has(key)).length;
  }

  const keysToCancel = Array.from(keysWithoutDueDate);
  for (const keysChunk of chunkArray(keysToCancel, 300)) {
    if (keysChunk.length === 0) continue;
    const { data: cancelledRows, error: cancelError } = await supabaseAdmin
      .from("calendar_events")
      .update({ status: "cancelled" })
      .eq("integration_source", obligationCalendarIntegrationSource)
      .in("integration_key", keysChunk)
      .neq("status", "cancelled")
      .select("id");
    if (cancelError) throw cancelError;
    cancelled += (cancelledRows || []).length;
  }

  return {
    created,
    updated,
    cancelled,
    processed: upsertRows.length,
    skipped,
  };
}

type ParsedKanbanSubtaskState = {
  title: string;
  done: boolean;
  clientId: string | null;
};

function parseKanbanSubtasksForMerge(value: unknown): ParsedKanbanSubtaskState[] {
  const rows = asArray(value);
  if (!rows) return [];

  return rows
    .map((item) => {
      const record = asRecord(item);
      if (!record) return null;
      const title = asTrimmedString(record.title);
      if (!title) return null;
      return {
        title,
        done: asBoolean(record.done),
        clientId: asTrimmedString(record.client_id),
      };
    })
    .filter((item): item is ParsedKanbanSubtaskState => item !== null);
}

async function syncWeeklyObligationKanbanTasks(
  supabaseAdmin: ReturnType<typeof createClient>,
  callerUserId: string,
) {
  const rawDaysAhead = Number(asTrimmedString(Deno.env.get("ACESSORIAS_WEEKLY_TASK_DAYS")) || "7");
  const daysAhead = Number.isFinite(rawDaysAhead) && rawDaysAhead > 0
    ? Math.min(21, Math.max(1, Math.trunc(rawDaysAhead)))
    : 7;

  const weekStart = toIsoDateOnly(new Date());
  const weekEnd = toIsoDateOnly(addUtcDays(new Date(), daysAhead));

  const { data: obligations, error: obligationsError } = await supabaseAdmin
    .from("client_acessorias_obligations")
    .select("client_id, obligation_name, obligation_period, due_date, status")
    .gte("due_date", weekStart)
    .lte("due_date", weekEnd);
  if (obligationsError) throw obligationsError;

  const uniqueClientIds = Array.from(
    new Set((obligations || []).map((row) => asTrimmedString(row.client_id)).filter((value): value is string => Boolean(value))),
  );
  const { data: clients, error: clientsError } = uniqueClientIds.length > 0
    ? await supabaseAdmin
      .from("clients")
      .select("id, name, status")
      .in("id", uniqueClientIds)
    : { data: [], error: null };
  if (clientsError) throw clientsError;

  const clientsById = new Map<string, { name: string; status: string | null }>();
  for (const client of clients || []) {
    clientsById.set(client.id, {
      name: asTrimmedString(client.name) || "Cliente sem nome",
      status: asTrimmedString(client.status),
    });
  }

  type GroupClientState = {
    clientId: string;
    clientName: string;
    done: boolean;
    earliestDueDate: string | null;
    periods: Set<string>;
  };

  type GroupState = {
    integrationKey: string;
    obligationName: string;
    minDueDate: string | null;
    maxDueDate: string | null;
    companies: Map<string, GroupClientState>;
  };

  const groups = new Map<string, GroupState>();

  for (const row of obligations || []) {
    const clientId = asTrimmedString(row.client_id);
    const dueDate = normalizeDate(row.due_date);
    if (!clientId || !dueDate) continue;

    const client = clientsById.get(clientId);
    if (!client) continue;
    const clientStatus = normalizeToken(client.status || "");
    if (clientStatus === "inativo" || clientStatus === "inactive" || clientStatus === "disabled") continue;

    const obligationName = asTrimmedString(row.obligation_name) || "Obrigacao";
    const obligationPeriod = asTrimmedString(row.obligation_period);
    const obligationStatus = normalizeObligationStatus(asTrimmedString(row.status));
    const obligationKey =
      normalizeToken(obligationName) || obligationName.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
    if (!obligationKey) continue;

    let group = groups.get(obligationKey);
    if (!group) {
      group = {
        integrationKey: obligationKey.slice(0, 120),
        obligationName,
        minDueDate: dueDate,
        maxDueDate: dueDate,
        companies: new Map<string, GroupClientState>(),
      };
      groups.set(obligationKey, group);
    } else {
      if (!group.minDueDate || dueDate < group.minDueDate) group.minDueDate = dueDate;
      if (!group.maxDueDate || dueDate > group.maxDueDate) group.maxDueDate = dueDate;
    }

    const existingCompany = group.companies.get(clientId);
    if (!existingCompany) {
      const periods = new Set<string>();
      if (obligationPeriod) periods.add(obligationPeriod);
      group.companies.set(clientId, {
        clientId,
        clientName: client.name,
        done: isCompletedStatus(obligationStatus),
        earliestDueDate: dueDate,
        periods,
      });
      continue;
    }

    existingCompany.done = existingCompany.done && isCompletedStatus(obligationStatus);
    if (!existingCompany.earliestDueDate || dueDate < existingCompany.earliestDueDate) {
      existingCompany.earliestDueDate = dueDate;
    }
    if (obligationPeriod) existingCompany.periods.add(obligationPeriod);
  }

  const { data: existingTasks, error: existingTasksError } = await supabaseAdmin
    .from("kanban_tasks")
    .select("id, integration_task_id, status, subtasks")
    .eq("integration_source", weeklyObligationKanbanIntegrationSource);
  if (existingTasksError) throw existingTasksError;

  const existingByIntegrationId = new Map<string, { id: string; status: string | null; subtasks: unknown }>();
  for (const task of existingTasks || []) {
    const integrationTaskId = asTrimmedString(task.integration_task_id);
    if (!integrationTaskId) continue;
    existingByIntegrationId.set(integrationTaskId, {
      id: task.id,
      status: asTrimmedString(task.status),
      subtasks: task.subtasks,
    });
  }

  const desiredIntegrationIds = new Set<string>();
  let createdTasks = 0;
  let updatedTasks = 0;

  for (const group of groups.values()) {
    const integrationTaskId = `weekly:${group.integrationKey}`;
    desiredIntegrationIds.add(integrationTaskId);

    const companies = Array.from(group.companies.values()).sort((left, right) =>
      left.clientName.localeCompare(right.clientName)
    );
    const baseSubtasks = companies.map((company) => ({
      title: company.clientName,
      done: company.done,
      client_id: company.clientId,
      due_date: company.earliestDueDate,
      obligation_periods: Array.from(company.periods),
    }));

    const existingTask = existingByIntegrationId.get(integrationTaskId);
    const existingSubtasks = parseKanbanSubtasksForMerge(existingTask?.subtasks);
    const existingDoneByClientId = new Map<string, boolean>();
    const existingDoneByTitle = new Map<string, boolean>();
    for (const subtask of existingSubtasks) {
      if (subtask.clientId) {
        existingDoneByClientId.set(subtask.clientId, subtask.done);
      }
      existingDoneByTitle.set(normalizeToken(subtask.title), subtask.done);
    }

    const mergedSubtasks = baseSubtasks.map((subtask) => {
      const byClientId = subtask.client_id ? existingDoneByClientId.get(subtask.client_id) : undefined;
      const byTitle = existingDoneByTitle.get(normalizeToken(subtask.title));
      const done = typeof byClientId === "boolean" ? byClientId : typeof byTitle === "boolean" ? byTitle : subtask.done;
      return {
        ...subtask,
        done,
      };
    });

    const subtasksDone = mergedSubtasks.filter((subtask) => subtask.done).length;
    const subtasksTotal = mergedSubtasks.length;
    const subtasksPending = Math.max(subtasksTotal - subtasksDone, 0);
    const description = [
      "Obrigacao monitorada automaticamente para vencimentos da semana.",
      `Periodo monitorado: ${weekStart} ate ${weekEnd}.`,
      `Empresas vinculadas: ${subtasksTotal}. Concluidas: ${subtasksDone}. Pendentes: ${subtasksPending}.`,
      group.minDueDate ? `Primeiro vencimento: ${group.minDueDate}.` : null,
      group.maxDueDate && group.maxDueDate !== group.minDueDate ? `Ultimo vencimento: ${group.maxDueDate}.` : null,
    ]
      .filter(Boolean)
      .join("\n");

    const payload: JsonRecord = {
      obligation_name: group.obligationName,
      week_start: weekStart,
      week_end: weekEnd,
      companies_total: subtasksTotal,
      companies_done: subtasksDone,
      companies_pending: subtasksPending,
      generated_at: new Date().toISOString(),
    };

    if (!existingTask) {
      const { error: createTaskError } = await supabaseAdmin
        .from("kanban_tasks")
        .insert({
          title: `[Obrigacao semanal] ${group.obligationName}`,
          description,
          client_name: null,
          assignee: null,
          priority: computePriorityByDueDate(group.minDueDate),
          sector: normalizeSectorFromObligationName(group.obligationName),
          status: "backlog",
          due_date: group.minDueDate,
          subtasks: mergedSubtasks,
          tags: ["Acessorias", "Obrigacao", "Semanal"],
          created_by: callerUserId,
          integration_source: weeklyObligationKanbanIntegrationSource,
          integration_task_id: integrationTaskId,
          integration_payload: payload,
        });
      if (createTaskError) throw createTaskError;
      createdTasks += 1;
      continue;
    }

    let nextStatus = existingTask.status || "backlog";
    if (nextStatus === "archived") nextStatus = "backlog";
    if (nextStatus === "done" && subtasksPending > 0) nextStatus = "backlog";

    const { error: updateTaskError } = await supabaseAdmin
      .from("kanban_tasks")
      .update({
        title: `[Obrigacao semanal] ${group.obligationName}`,
        description,
        priority: computePriorityByDueDate(group.minDueDate),
        sector: normalizeSectorFromObligationName(group.obligationName),
        due_date: group.minDueDate,
        status: nextStatus,
        subtasks: mergedSubtasks,
        tags: ["Acessorias", "Obrigacao", "Semanal"],
        integration_payload: payload,
      })
      .eq("id", existingTask.id);
    if (updateTaskError) throw updateTaskError;
    updatedTasks += 1;
  }

  const staleTaskIds = (existingTasks || [])
    .filter((task) => {
      const integrationTaskId = asTrimmedString(task.integration_task_id);
      if (!integrationTaskId) return false;
      return !desiredIntegrationIds.has(integrationTaskId);
    })
    .map((task) => task.id);

  if (staleTaskIds.length > 0) {
    for (const chunk of chunkArray(staleTaskIds, 200)) {
      const { error: deleteError } = await supabaseAdmin
        .from("kanban_tasks")
        .delete()
        .in("id", chunk);
      if (deleteError) throw deleteError;
    }
  }

  return {
    created: createdTasks,
    updated: updatedTasks,
    removed: staleTaskIds.length,
    groups: groups.size,
    window_start: weekStart,
    window_end: weekEnd,
  };
}

async function handleOverview(supabaseAdmin: ReturnType<typeof createClient>) {
  const [clientsResult, companiesResult, linksResult, obligationsResult, uploadsResult, clientDataResult] = await Promise.all([
    supabaseAdmin
      .from("clients")
      .select("id, name, cnpj, status, contact, email, phone")
      .order("name"),
    supabaseAdmin
      .from("acessorias_companies_cache")
      .select("acessorias_company_id, company_name, cnpj, status, last_synced_at")
      .order("company_name"),
    supabaseAdmin
      .from("client_acessorias_links")
      .select("client_id, acessorias_company_id, match_type, last_synced_at")
      .order("created_at"),
    supabaseAdmin
      .from("client_acessorias_obligations")
      .select("client_id, status, due_date, last_synced_at")
      .order("updated_at", { ascending: false }),
    supabaseAdmin
      .from("client_acessorias_uploads")
      .select("id, client_id, acessorias_company_id, file_name, status, error_message, uploaded_at, request_payload")
      .order("uploaded_at", { ascending: false })
      .limit(25),
    supabaseAdmin
      .from("client_data")
      .select("client_id, field_name, field_value")
      .eq("category", "cadastro_clientes")
      .is("period", null),
  ]);

  if (clientsResult.error) throw clientsResult.error;
  if (companiesResult.error) throw companiesResult.error;
  if (linksResult.error) throw linksResult.error;
  if (obligationsResult.error) throw obligationsResult.error;
  if (uploadsResult.error) throw uploadsResult.error;
  if (clientDataResult.error) throw clientDataResult.error;

  const companies = companiesResult.data || [];
  const links = linksResult.data || [];
  const obligations = obligationsResult.data || [];
  const clients = clientsResult.data || [];
  const uploads = uploadsResult.data || [];
  const clientDataRows = clientDataResult.data || [];

  const companyById = new Map(
    companies.map((company) => [company.acessorias_company_id, company]),
  );
  const linkByClient = new Map(links.map((link) => [link.client_id, link]));
  const clientNameById = new Map<string, string>();
  for (const client of clients) {
    const name = asTrimmedString(client.name) || "Cliente sem nome";
    clientNameById.set(client.id, name);
  }
  const companyNameById = new Map<string, string>();
  for (const company of companies) {
    const companyId = asTrimmedString(company.acessorias_company_id);
    const companyName = asTrimmedString(company.company_name);
    if (!companyId || !companyName) continue;
    companyNameById.set(companyId, companyName);
  }
  const mappedUploads = mapUploadsForHistory(uploads, clientNameById, companyNameById);
  const whatsappByClient = new Map<string, string | null>();
  const telefoneByClient = new Map<string, string | null>();
  const dddByClient = new Map<string, string | null>();

  for (const row of clientDataRows) {
    const clientId = asTrimmedString(row.client_id);
    const fieldName = normalizeToken(row.field_name || "");
    const fieldValue = asTrimmedString(row.field_value);
    if (!clientId || !fieldName || !fieldValue) continue;
    if (fieldName === "whatsapp") {
      whatsappByClient.set(clientId, fieldValue);
      continue;
    }
    if (fieldName === "telefone") {
      telefoneByClient.set(clientId, fieldValue);
      continue;
    }
    if (fieldName === "ddd") {
      dddByClient.set(clientId, fieldValue);
    }
  }

  const obligationStatsByClient = new Map<
    string,
    { total: number; pending: number; overdue: number; lastSyncedAt: string | null }
  >();

  const todayIso = toIsoDateOnly(new Date());
  for (const item of obligations) {
    const current = obligationStatsByClient.get(item.client_id) || {
      total: 0,
      pending: 0,
      overdue: 0,
      lastSyncedAt: null as string | null,
    };
    current.total += 1;
    const status = normalizeObligationStatus(item.status);
    const dueDate = normalizeDate(item.due_date);
    if (isPendingLikeStatus(status)) {
      current.pending += 1;
      if (dueDate && dueDate < todayIso) {
        current.overdue += 1;
      }
    }
    if (item.last_synced_at && (!current.lastSyncedAt || item.last_synced_at > current.lastSyncedAt)) {
      current.lastSyncedAt = item.last_synced_at;
    }
    obligationStatsByClient.set(item.client_id, current);
  }

  const mappedClients = clients.map((client) => {
    const link = linkByClient.get(client.id) || null;
    const company = link ? companyById.get(link.acessorias_company_id) || null : null;
    const stats = obligationStatsByClient.get(client.id) || {
      total: 0,
      pending: 0,
      overdue: 0,
      lastSyncedAt: null,
    };

    return {
      id: client.id,
      name: client.name,
      cnpj: normalizeCnpj(client.cnpj) || client.cnpj,
      status: client.status,
      contact: client.contact,
      email: client.email,
      phone:
        asTrimmedString(client.phone) ||
        combineDddAndPhone(dddByClient.get(client.id), telefoneByClient.get(client.id)) ||
        telefoneByClient.get(client.id) ||
        null,
      whatsapp_phone:
        whatsappByClient.get(client.id) ||
        combineDddAndPhone(dddByClient.get(client.id), telefoneByClient.get(client.id)) ||
        telefoneByClient.get(client.id) ||
        asTrimmedString(client.phone) ||
        null,
      whatsapp_phone_digits:
        normalizePhoneDigits(whatsappByClient.get(client.id)) ||
        normalizePhoneDigits(combineDddAndPhone(dddByClient.get(client.id), telefoneByClient.get(client.id))) ||
        normalizePhoneDigits(client.phone) ||
        normalizePhoneDigits(telefoneByClient.get(client.id)),
      linked: Boolean(link),
      link: link
        ? {
          acessorias_company_id: link.acessorias_company_id,
          match_type: link.match_type,
          last_synced_at: link.last_synced_at,
        }
        : null,
      acessorias_company_name: company?.company_name || null,
      acessorias_company_status: company?.status || null,
      obligations: stats,
    };
  });

  return {
    clients: mappedClients,
    companies,
    uploads: mappedUploads,
    summary: {
      clients_total: clients.length,
      clients_linked: mappedClients.filter((item) => item.linked).length,
      companies_cached: companies.length,
      obligations_total: obligations.length,
      obligations_pending: obligations.filter((row) => isPendingLikeStatus(normalizeObligationStatus(row.status))).length,
      obligations_overdue: obligations.filter((row) => {
        const status = normalizeObligationStatus(row.status);
        const dueDate = normalizeDate(row.due_date);
        return Boolean(dueDate && dueDate < todayIso && isPendingLikeStatus(status));
      }).length,
      recent_uploads: mappedUploads.length,
    },
  };
}

async function handleSyncCompanies(
  supabaseAdmin: ReturnType<typeof createClient>,
  acessoriasApiBaseUrl: string,
  acessoriasApiToken: string,
  callerUserId: string,
  options: JsonRecord = {},
) {
  const syncGrowClients = options.sync_grow_clients === undefined ? true : asBoolean(options.sync_grow_clients);
  const restrictToAcessorias =
    options.restrict_to_acessorias === undefined ? true : asBoolean(options.restrict_to_acessorias);
  const allowClientInactivation =
    options.allow_client_inactivation === undefined ? false : asBoolean(options.allow_client_inactivation);

  const pathCandidates = getPathCandidates("ACESSORIAS_COMPANIES_PATHS", defaultCompaniesPathCandidates);
  const supportsPaging = pathCandidates.some((path) => path.includes("{page}") || path.includes(":page"));
  const companies: ParsedCompany[] = [];
  const seenCompanyIds = new Set<string>();
  let endpointUsed = "";

  if (supportsPaging) {
    for (let page = 1; page <= 500; page += 1) {
      const pathCandidatesForPage = pathCandidates.map((template) =>
        resolveTemplatePath(template, { page: String(page) })
      );
      const result = await requestFirstSuccessful(
        acessoriasApiBaseUrl,
        acessoriasApiToken,
        pathCandidatesForPage,
      );
      if (!endpointUsed) endpointUsed = result.path;

      const pageCompanies = parseCompanies(result.payload);
      if (pageCompanies.length === 0) break;

      for (const company of pageCompanies) {
        if (seenCompanyIds.has(company.acessorias_company_id)) continue;
        seenCompanyIds.add(company.acessorias_company_id);
        companies.push(company);
      }
    }
  } else {
    const result = await requestFirstSuccessful(acessoriasApiBaseUrl, acessoriasApiToken, pathCandidates);
    endpointUsed = result.path;
    for (const company of parseCompanies(result.payload)) {
      if (seenCompanyIds.has(company.acessorias_company_id)) continue;
      seenCompanyIds.add(company.acessorias_company_id);
      companies.push(company);
    }
  }

  if (companies.length === 0) {
    return {
      synced: 0,
      auto_linked: 0,
      clients_created: 0,
      clients_updated: 0,
      clients_inactivated: 0,
      stale_links_removed: 0,
      mirrored_clients: 0,
      cadastro_clientes_fields_synced: 0,
      cadastro_honorarios_fields_synced: 0,
      sync_grow_clients: syncGrowClients,
      restrict_to_acessorias: syncGrowClients ? restrictToAcessorias : false,
      allow_client_inactivation: syncGrowClients ? allowClientInactivation : false,
      message:
        "Nenhuma empresa retornada pela API. Verifique os endpoints em ACESSORIAS_COMPANIES_PATHS.",
      endpoint_used: endpointUsed || null,
    };
  }

  const nowIso = new Date().toISOString();
  const upsertRows = companies.map((item) => ({
    acessorias_company_id: item.acessorias_company_id,
    cnpj: item.cnpj,
    company_name: item.company_name,
    status: item.status,
    raw_payload: item.raw_payload,
    last_synced_at: nowIso,
  }));

  const { error: upsertError } = await supabaseAdmin
    .from("acessorias_companies_cache")
    .upsert(upsertRows, { onConflict: "acessorias_company_id" });
  if (upsertError) throw upsertError;

  type ClientSyncRow = {
    id: string;
    name: string;
    cnpj: string | null;
    regime: string | null;
    phone: string | null;
    address: string | null;
    status: string | null;
  };

  type ClientLinkRow = {
    client_id: string;
    acessorias_company_id: string;
  };

  const [{ data: clients, error: clientsError }, { data: links, error: linksError }] = await Promise.all([
    supabaseAdmin
      .from("clients")
      .select("id, name, cnpj, regime, phone, address, status")
      .order("created_at"),
    supabaseAdmin
      .from("client_acessorias_links")
      .select("client_id, acessorias_company_id"),
  ]);

  if (clientsError) throw clientsError;
  if (linksError) throw linksError;

  const clientsRows = (clients || []) as ClientSyncRow[];
  const linksRows = (links || []) as ClientLinkRow[];

  const companyByCnpj = new Map<string, ParsedCompany>();
  for (const company of companies) {
    if (!company.cnpj || companyByCnpj.has(company.cnpj)) continue;
    companyByCnpj.set(company.cnpj, company);
  }

  const linkedClientIds = new Set(linksRows.map((link) => link.client_id));
  const linkedCompanyIds = new Set(linksRows.map((link) => link.acessorias_company_id));
  const linkByCompanyId = new Map<string, string>();
  const linkByClientId = new Map<string, string>();
  for (const link of linksRows) {
    linkByCompanyId.set(link.acessorias_company_id, link.client_id);
    linkByClientId.set(link.client_id, link.acessorias_company_id);
  }

  const autoLinks: Array<{
    client_id: string;
    acessorias_company_id: string;
    match_type: string;
    match_score: number;
    created_by: string;
    last_synced_at: string;
  }> = [];
  const mirroredClientIds = new Set<string>();
  let clientsCreated = 0;
  let clientsUpdated = 0;
  let clientsInactivated = 0;
  let staleLinksRemoved = 0;
  let cadastroClientesFieldsSynced = 0;
  let cadastroHonorariosFieldsSynced = 0;
  const cadastroClientesEntriesByClient = new Map<string, Map<string, string>>();
  const cadastroHonorariosEntriesByClient = new Map<string, Map<string, string>>();

  if (syncGrowClients) {
    const clientsById = new Map<string, ClientSyncRow>();
    for (const client of clientsRows) {
      clientsById.set(client.id, client);
    }

    const availableClientByCnpj = new Map<string, string>();
    const availableClientByName = new Map<string, string>();
    for (const client of clientsRows) {
      if (linkByClientId.has(client.id)) continue;

      const normalizedCnpj = normalizeCnpj(client.cnpj);
      if (normalizedCnpj && !availableClientByCnpj.has(normalizedCnpj)) {
        availableClientByCnpj.set(normalizedCnpj, client.id);
      }

      const nameKey = normalizeNameKey(client.name);
      if (nameKey && !availableClientByName.has(nameKey)) {
        availableClientByName.set(nameKey, client.id);
      }
    }

    for (const company of companies) {
      let resolvedClient: ClientSyncRow | null = null;
      const linkedClientId = linkByCompanyId.get(company.acessorias_company_id) || null;

      if (linkedClientId) {
        resolvedClient = clientsById.get(linkedClientId) || null;
      }

      if (!resolvedClient && company.cnpj) {
        const candidateClientId = availableClientByCnpj.get(company.cnpj);
        if (candidateClientId) {
          resolvedClient = clientsById.get(candidateClientId) || null;
          availableClientByCnpj.delete(company.cnpj);
          if (resolvedClient) {
            const candidateNameKey = normalizeNameKey(resolvedClient.name);
            if (candidateNameKey) availableClientByName.delete(candidateNameKey);
          }
        }
      }

      if (!resolvedClient) {
        const companyNameKey = normalizeNameKey(company.company_name);
        const candidateClientId = companyNameKey ? availableClientByName.get(companyNameKey) : null;
        if (candidateClientId) {
          resolvedClient = clientsById.get(candidateClientId) || null;
          availableClientByName.delete(companyNameKey);
          if (resolvedClient?.cnpj) {
            const candidateCnpj = normalizeCnpj(resolvedClient.cnpj);
            if (candidateCnpj) availableClientByCnpj.delete(candidateCnpj);
          }
        }
      }

      const mappedStatus = mapCompanyStatusToClientStatus(company.status);
      const registrationSnapshot = extractCompanyRegistrationSnapshot(company);
      const snapshotAddress = buildClientAddressFromSnapshot(registrationSnapshot);
      const snapshotPhone =
        registrationSnapshot.ddd && registrationSnapshot.telefone
          ? `${registrationSnapshot.ddd}${registrationSnapshot.telefone}`
          : registrationSnapshot.telefone;

      if (resolvedClient) {
        const updates: {
          name?: string;
          cnpj?: string | null;
          regime?: string | null;
          phone?: string | null;
          address?: string | null;
          status?: string;
        } = {};
        const currentName = asTrimmedString(resolvedClient.name) || "";
        const currentCnpj = normalizeCnpj(resolvedClient.cnpj);
        const currentRegime = asTrimmedText(resolvedClient.regime);
        const currentPhone = asTrimmedText(resolvedClient.phone);
        const currentAddress = asTrimmedText(resolvedClient.address);
        const currentStatus = asTrimmedString(resolvedClient.status) || "";

        if (company.company_name && currentName !== company.company_name) {
          updates.name = company.company_name;
        }
        if (company.cnpj && currentCnpj !== company.cnpj) {
          updates.cnpj = company.cnpj;
        }
        if (
          registrationSnapshot.regimeTributario &&
          registrationSnapshot.regimeTributario !== currentRegime
        ) {
          updates.regime = registrationSnapshot.regimeTributario;
        }
        if (snapshotPhone && snapshotPhone !== currentPhone) {
          updates.phone = snapshotPhone;
        }
        if (snapshotAddress && snapshotAddress !== currentAddress) {
          updates.address = snapshotAddress;
        }
        if (currentStatus !== mappedStatus) {
          updates.status = mappedStatus;
        }

        if (Object.keys(updates).length > 0) {
          const { error: updateClientError } = await supabaseAdmin
            .from("clients")
            .update(updates)
            .eq("id", resolvedClient.id);
          if (updateClientError) throw updateClientError;

          clientsUpdated += 1;
          resolvedClient = {
            ...resolvedClient,
            ...updates,
            cnpj: updates.cnpj === undefined ? resolvedClient.cnpj : updates.cnpj,
            regime: updates.regime === undefined ? resolvedClient.regime : updates.regime,
            phone: updates.phone === undefined ? resolvedClient.phone : updates.phone,
            address: updates.address === undefined ? resolvedClient.address : updates.address,
            status: updates.status === undefined ? resolvedClient.status : updates.status,
          };
          clientsById.set(resolvedClient.id, resolvedClient);
        }
      } else {
        const { data: insertedClient, error: insertClientError } = await supabaseAdmin
          .from("clients")
          .insert({
            name: company.company_name,
            cnpj: company.cnpj,
            regime: registrationSnapshot.regimeTributario,
            phone: snapshotPhone,
            address: snapshotAddress,
            status: mappedStatus,
            created_by: callerUserId,
          })
          .select("id, name, cnpj, regime, phone, address, status")
          .single();

        if (insertClientError) throw insertClientError;

        resolvedClient = insertedClient as ClientSyncRow;
        clientsById.set(resolvedClient.id, resolvedClient);
        clientsCreated += 1;
      }

      mirroredClientIds.add(resolvedClient.id);
      const cadastroEntries = buildCadastroClientesEntriesFromSnapshot(registrationSnapshot);
      if (cadastroEntries.length > 0) {
        const currentMap = cadastroClientesEntriesByClient.get(resolvedClient.id) || new Map<string, string>();
        for (const entry of cadastroEntries) {
          currentMap.set(entry.field_name, entry.field_value);
        }
        cadastroClientesEntriesByClient.set(resolvedClient.id, currentMap);
      }
      if (registrationSnapshot.honorario) {
        const currentHonorariosMap =
          cadastroHonorariosEntriesByClient.get(resolvedClient.id) || new Map<string, string>();
        currentHonorariosMap.set("valor_mensal", registrationSnapshot.honorario);
        cadastroHonorariosEntriesByClient.set(resolvedClient.id, currentHonorariosMap);
      }
      const existingLinkedClientId = linkByCompanyId.get(company.acessorias_company_id) || null;

      if (!existingLinkedClientId || existingLinkedClientId !== resolvedClient.id) {
        autoLinks.push({
          client_id: resolvedClient.id,
          acessorias_company_id: company.acessorias_company_id,
          match_type: existingLinkedClientId ? "relinked" : "auto",
          match_score: 100,
          created_by: callerUserId,
          last_synced_at: nowIso,
        });
        linkByCompanyId.set(company.acessorias_company_id, resolvedClient.id);
        linkByClientId.set(resolvedClient.id, company.acessorias_company_id);
      }
    }

    const returnedCompanyIds = new Set(companies.map((item) => item.acessorias_company_id));
    const staleCompanyIds = linksRows
      .filter((linkRow) => !returnedCompanyIds.has(linkRow.acessorias_company_id))
      .map((linkRow) => linkRow.acessorias_company_id);

    if (staleCompanyIds.length > 0) {
      for (const chunk of chunkArray([...new Set(staleCompanyIds)], 200)) {
        const { data: staleRows, error: staleRowsError } = await supabaseAdmin
          .from("client_acessorias_links")
          .select("client_id")
          .in("acessorias_company_id", chunk);
        if (staleRowsError) throw staleRowsError;

        staleLinksRemoved += (staleRows || []).length;

        const { error: deleteStaleError } = await supabaseAdmin
          .from("client_acessorias_links")
          .delete()
          .in("acessorias_company_id", chunk);
        if (deleteStaleError) throw deleteStaleError;
      }
    }

    if (restrictToAcessorias && allowClientInactivation) {
      const clientsToInactivate = new Set(
        clientsRows
        .filter((client) => !mirroredClientIds.has(client.id))
        .map((client) => client.id),
      );

      const deactivatableIds = clientsRows
        .filter((client) => {
          if (!clientsToInactivate.has(client.id)) return false;
          const statusToken = normalizeToken(client.status || "");
          return statusToken !== "inativo";
        })
        .map((client) => client.id);

      if (deactivatableIds.length > 0) {
        for (const chunk of chunkArray(deactivatableIds, 200)) {
          const { error: deactivateError } = await supabaseAdmin
            .from("clients")
            .update({
              status: "Inativo",
              portal_cashflow_enabled: false,
            })
            .in("id", chunk);
          if (deactivateError) throw deactivateError;
        }
      }

      clientsInactivated = deactivatableIds.length;
    }

    cadastroClientesFieldsSynced = await upsertClientDataFields(
      supabaseAdmin,
      "cadastro_clientes",
      cadastroClientesEntriesByClient,
      callerUserId,
    );
    cadastroHonorariosFieldsSynced = await upsertClientDataFields(
      supabaseAdmin,
      "cadastro_honorarios",
      cadastroHonorariosEntriesByClient,
      callerUserId,
    );
  } else {
    for (const client of clientsRows) {
      if (linkedClientIds.has(client.id)) continue;
      const normalizedCnpj = normalizeCnpj(client.cnpj);
      if (!normalizedCnpj) continue;
      const matched = companyByCnpj.get(normalizedCnpj);
      if (!matched) continue;
      if (linkedCompanyIds.has(matched.acessorias_company_id)) continue;

      autoLinks.push({
        client_id: client.id,
        acessorias_company_id: matched.acessorias_company_id,
        match_type: "auto",
        match_score: 100,
        created_by: callerUserId,
        last_synced_at: nowIso,
      });
      linkedCompanyIds.add(matched.acessorias_company_id);
    }
  }

  if (autoLinks.length > 0) {
    const { error: autoLinkError } = await supabaseAdmin
      .from("client_acessorias_links")
      .upsert(autoLinks, { onConflict: "client_id" });
    if (autoLinkError) throw autoLinkError;
  }

  return {
    synced: companies.length,
    auto_linked: autoLinks.length,
    clients_created: clientsCreated,
    clients_updated: clientsUpdated,
    clients_inactivated: syncGrowClients && restrictToAcessorias ? clientsInactivated : 0,
    stale_links_removed: syncGrowClients ? staleLinksRemoved : 0,
    mirrored_clients: syncGrowClients ? mirroredClientIds.size : 0,
    cadastro_clientes_fields_synced: syncGrowClients ? cadastroClientesFieldsSynced : 0,
    cadastro_honorarios_fields_synced: syncGrowClients ? cadastroHonorariosFieldsSynced : 0,
    sync_grow_clients: syncGrowClients,
    restrict_to_acessorias: syncGrowClients ? restrictToAcessorias : false,
    allow_client_inactivation: syncGrowClients ? allowClientInactivation : false,
    endpoint_used: endpointUsed || null,
  };
}

async function handleSetLink(
  supabaseAdmin: ReturnType<typeof createClient>,
  body: JsonRecord,
  callerUserId: string,
) {
  const clientId = asTrimmedString(body.client_id);
  const acessoriasCompanyId = asTrimmedString(body.acessorias_company_id);
  const matchType = asTrimmedString(body.match_type) || "manual";
  const notes = asTrimmedString(body.notes);

  if (!clientId || !acessoriasCompanyId) {
    return jsonResponse({ error: "client_id e acessorias_company_id sao obrigatorios" }, 400);
  }

  const [{ data: client, error: clientError }, { data: company, error: companyError }] = await Promise.all([
    supabaseAdmin
      .from("clients")
      .select("id")
      .eq("id", clientId)
      .maybeSingle(),
    supabaseAdmin
      .from("acessorias_companies_cache")
      .select("acessorias_company_id")
      .eq("acessorias_company_id", acessoriasCompanyId)
      .maybeSingle(),
  ]);

  if (clientError) throw clientError;
  if (companyError) throw companyError;
  if (!client) return jsonResponse({ error: "Cliente nao encontrado" }, 404);
  if (!company) return jsonResponse({ error: "Empresa do Acessorias nao encontrada no cache" }, 404);

  const { data: existingLink, error: existingLinkError } = await supabaseAdmin
    .from("client_acessorias_links")
    .select("client_id")
    .eq("acessorias_company_id", acessoriasCompanyId)
    .neq("client_id", clientId)
    .maybeSingle();

  if (existingLinkError) throw existingLinkError;
  if (existingLink) {
    return jsonResponse(
      { error: "Esta empresa do Acessorias ja esta vinculada a outro cliente interno." },
      409,
    );
  }

  const { data: upserted, error: upsertError } = await supabaseAdmin
    .from("client_acessorias_links")
    .upsert(
      {
        client_id: clientId,
        acessorias_company_id: acessoriasCompanyId,
        match_type: matchType,
        notes,
        created_by: callerUserId,
        last_synced_at: new Date().toISOString(),
      },
      { onConflict: "client_id" },
    )
    .select("id, client_id, acessorias_company_id, match_type, last_synced_at")
    .maybeSingle();
  if (upsertError) throw upsertError;

  return jsonResponse({ ok: true, link: upserted });
}

async function handleRemoveLink(
  supabaseAdmin: ReturnType<typeof createClient>,
  body: JsonRecord,
) {
  const clientId = asTrimmedString(body.client_id);
  if (!clientId) {
    return jsonResponse({ error: "client_id e obrigatorio" }, 400);
  }

  const { error } = await supabaseAdmin
    .from("client_acessorias_links")
    .delete()
    .eq("client_id", clientId);
  if (error) throw error;

  return jsonResponse({ ok: true });
}

async function ensureLinkForClientByCnpj(
  supabaseAdmin: ReturnType<typeof createClient>,
  clientId: string,
  callerUserId: string,
) {
  const { data: existingLink, error: existingLinkError } = await supabaseAdmin
    .from("client_acessorias_links")
    .select("acessorias_company_id")
    .eq("client_id", clientId)
    .maybeSingle();
  if (existingLinkError) throw existingLinkError;
  if (existingLink?.acessorias_company_id) return existingLink;

  const { data: client, error: clientError } = await supabaseAdmin
    .from("clients")
    .select("id, cnpj")
    .eq("id", clientId)
    .maybeSingle();
  if (clientError) throw clientError;
  if (!client) return null;

  const normalizedClientCnpj = normalizeCnpj(client.cnpj);
  if (!normalizedClientCnpj) return null;

  const { data: company, error: companyError } = await supabaseAdmin
    .from("acessorias_companies_cache")
    .select("acessorias_company_id")
    .eq("cnpj", normalizedClientCnpj)
    .limit(1)
    .maybeSingle();
  if (companyError) throw companyError;
  if (!company?.acessorias_company_id) return null;

  const { data: conflictingLink, error: conflictingLinkError } = await supabaseAdmin
    .from("client_acessorias_links")
    .select("client_id")
    .eq("acessorias_company_id", company.acessorias_company_id)
    .neq("client_id", clientId)
    .maybeSingle();
  if (conflictingLinkError) throw conflictingLinkError;
  if (conflictingLink) return null;

  const { data: createdLink, error: createdLinkError } = await supabaseAdmin
    .from("client_acessorias_links")
    .upsert(
      {
        client_id: clientId,
        acessorias_company_id: company.acessorias_company_id,
        match_type: "auto",
        match_score: 100,
        created_by: callerUserId,
        last_synced_at: new Date().toISOString(),
      },
      { onConflict: "client_id" },
    )
    .select("acessorias_company_id")
    .maybeSingle();
  if (createdLinkError) throw createdLinkError;

  return createdLink || null;
}

async function ensureAutomaticLinksByCnpjFromCache(
  supabaseAdmin: ReturnType<typeof createClient>,
  callerUserId: string,
) {
  const [{ data: clients, error: clientsError }, { data: links, error: linksError }, { data: companies, error: companiesError }] = await Promise.all([
    supabaseAdmin.from("clients").select("id, cnpj").order("created_at"),
    supabaseAdmin.from("client_acessorias_links").select("client_id, acessorias_company_id"),
    supabaseAdmin.from("acessorias_companies_cache").select("acessorias_company_id, cnpj"),
  ]);

  if (clientsError) throw clientsError;
  if (linksError) throw linksError;
  if (companiesError) throw companiesError;

  const companyByCnpj = new Map<string, { acessorias_company_id: string }>();
  for (const company of companies || []) {
    const cnpj = normalizeCnpj(company.cnpj);
    if (!cnpj || companyByCnpj.has(cnpj)) continue;
    companyByCnpj.set(cnpj, { acessorias_company_id: company.acessorias_company_id });
  }

  const linkedClientIds = new Set((links || []).map((item) => item.client_id));
  const linkedCompanyIds = new Set((links || []).map((item) => item.acessorias_company_id));

  const nowIso = new Date().toISOString();
  const autoLinks: Array<{
    client_id: string;
    acessorias_company_id: string;
    match_type: string;
    match_score: number;
    created_by: string;
    last_synced_at: string;
  }> = [];

  for (const client of clients || []) {
    if (linkedClientIds.has(client.id)) continue;
    const cnpj = normalizeCnpj(client.cnpj);
    if (!cnpj) continue;
    const matched = companyByCnpj.get(cnpj);
    if (!matched) continue;
    if (linkedCompanyIds.has(matched.acessorias_company_id)) continue;

    autoLinks.push({
      client_id: client.id,
      acessorias_company_id: matched.acessorias_company_id,
      match_type: "auto",
      match_score: 100,
      created_by: callerUserId,
      last_synced_at: nowIso,
    });
    linkedClientIds.add(client.id);
    linkedCompanyIds.add(matched.acessorias_company_id);
  }

  if (autoLinks.length === 0) return 0;

  const { error: autoLinkError } = await supabaseAdmin
    .from("client_acessorias_links")
    .upsert(autoLinks, { onConflict: "client_id" });
  if (autoLinkError) throw autoLinkError;

  return autoLinks.length;
}

async function handleSyncObligations(
  supabaseAdmin: ReturnType<typeof createClient>,
  body: JsonRecord,
  acessoriasApiBaseUrl: string,
  acessoriasApiToken: string,
  callerUserId: string,
) {
  const clientIdFilter = asTrimmedString(body.client_id);
  const autoLinkedClients = await ensureAutomaticLinksByCnpjFromCache(supabaseAdmin, callerUserId);
  const requestedBatchSize =
    typeof body.batch_size === "number" ? body.batch_size : Number(asTrimmedString(body.batch_size) || "0");
  const requestedCursor =
    typeof body.cursor === "number" ? body.cursor : Number(asTrimmedString(body.cursor) || "0");
  const requestedMaxExecutionMs =
    typeof body.max_execution_ms === "number"
      ? body.max_execution_ms
      : Number(asTrimmedString(body.max_execution_ms) || "");
  const envMaxExecutionMs = Number(asTrimmedString(Deno.env.get("ACESSORIAS_SYNC_MAX_EXECUTION_MS")) || "22000");
  const maxExecutionMs = Number.isFinite(requestedMaxExecutionMs) && requestedMaxExecutionMs > 0
    ? Math.min(55000, Math.max(5000, Math.trunc(requestedMaxExecutionMs)))
    : Number.isFinite(envMaxExecutionMs) && envMaxExecutionMs > 0
      ? Math.min(55000, Math.max(5000, Math.trunc(envMaxExecutionMs)))
      : 22000;
  const requestedMaxCompaniesPerRun =
    typeof body.max_companies_per_run === "number"
      ? body.max_companies_per_run
      : Number(asTrimmedString(body.max_companies_per_run) || "");
  const batchSize = clientIdFilter
    ? 1
    : Number.isFinite(requestedBatchSize) && requestedBatchSize > 0
      ? Math.min(100, Math.max(1, Math.trunc(requestedBatchSize)))
      : 10;
  const maxCompaniesPerRun = clientIdFilter
    ? 1
    : Number.isFinite(requestedMaxCompaniesPerRun) && requestedMaxCompaniesPerRun > 0
      ? Math.min(batchSize, Math.max(1, Math.trunc(requestedMaxCompaniesPerRun)))
      : batchSize;
  const cursor = clientIdFilter
    ? 0
    : Number.isFinite(requestedCursor) && requestedCursor > 0
      ? Math.trunc(requestedCursor)
      : 0;

  if (clientIdFilter) {
    await cleanupObligationKanbanTasks(supabaseAdmin, { clientId: clientIdFilter });
  } else if (cursor === 0) {
    await cleanupObligationKanbanTasks(supabaseAdmin);
  }

  let linksQuery = supabaseAdmin
    .from("client_acessorias_links")
    .select("client_id, acessorias_company_id, last_synced_at", { count: "exact" })
    .order("created_at");
  if (clientIdFilter) {
    linksQuery = linksQuery.eq("client_id", clientIdFilter).limit(1);
  } else {
    linksQuery = linksQuery.range(cursor, cursor + batchSize - 1);
  }

  const { data: links, error: linksError, count: totalLinksCount } = await linksQuery;
  if (linksError) throw linksError;

  const totalLinks = clientIdFilter
    ? (links || []).length
    : typeof totalLinksCount === "number"
      ? totalLinksCount
      : cursor + (links || []).length;

  if (!links || links.length === 0) {
    return {
      synced_obligations: 0,
      clients_processed: 0,
      created_tasks: 0,
      details: [],
      auto_linked_clients: autoLinkedClients,
      total_links: totalLinks,
      processed_in_batch: 0,
      batch_size: batchSize,
      cursor,
      has_more: false,
      next_cursor: null,
    };
  }

  const { data: clients, error: clientsError } = await supabaseAdmin
    .from("clients")
    .select("id, name")
    .in("id", links.map((link) => link.client_id));
  if (clientsError) throw clientsError;

  const uniqueCompanyIds = Array.from(new Set(links.map((link) => link.acessorias_company_id)));
  const { data: companiesCache, error: companiesCacheError } = uniqueCompanyIds.length > 0
    ? await supabaseAdmin
      .from("acessorias_companies_cache")
      .select("acessorias_company_id, cnpj")
      .in("acessorias_company_id", uniqueCompanyIds)
    : { data: [], error: null };
  if (companiesCacheError) throw companiesCacheError;

  const clientsById = new Map((clients || []).map((client) => [client.id, client.name || "Cliente sem nome"]));
  const companyCnpjById = new Map<string, string>();
  for (const companyRow of companiesCache || []) {
    const cnpj = normalizeCnpj(companyRow.cnpj);
    if (cnpj) {
      companyCnpjById.set(companyRow.acessorias_company_id, cnpj);
    }
  }

  const now = new Date();
  const defaultDateFrom = `${now.getUTCFullYear() - 1}-01-01`;
  const defaultDateTo = `${now.getUTCFullYear() + 1}-12-31`;
  const envMinDateFrom = normalizeDate(asTrimmedString(Deno.env.get("ACESSORIAS_OBLIGATIONS_MIN_DATE")));
  const minimumDateFrom = envMinDateFrom || defaultObligationsMinDate;
  const explicitDateFrom = normalizeDate(body.date_from);
  let dateFrom = explicitDateFrom || defaultDateFrom;
  let dateTo = normalizeDate(body.date_to) || defaultDateTo;
  if (dateFrom > dateTo) {
    const swap = dateFrom;
    dateFrom = dateTo;
    dateTo = swap;
  }
  if (dateFrom < minimumDateFrom) {
    dateFrom = minimumDateFrom;
  }
  if (dateTo < minimumDateFrom) {
    dateTo = minimumDateFrom;
  }
  const rawLookbackDays =
    typeof body.incremental_lookback_days === "number"
      ? body.incremental_lookback_days
      : Number(asTrimmedString(body.incremental_lookback_days) || "");
  const envLookbackDays = Number(asTrimmedString(Deno.env.get("ACESSORIAS_INCREMENTAL_LOOKBACK_DAYS")) || "45");
  const incrementalLookbackDays = Number.isFinite(rawLookbackDays) && rawLookbackDays > 0
    ? Math.min(120, Math.max(1, Math.trunc(rawLookbackDays)))
    : Number.isFinite(envLookbackDays) && envLookbackDays > 0
      ? Math.min(120, Math.max(1, Math.trunc(envLookbackDays)))
      : 45;

  const deliveriesPathTemplates = getPathCandidates("ACESSORIAS_DELIVERIES_PATHS", defaultDeliveriesPathCandidates);

  const obligationRows: Array<Record<string, unknown>> = [];
  const details: Array<Record<string, unknown>> = [];
  const runStartedAt = Date.now();
  let processedLinks = 0;

  for (const link of links) {
    if (!clientIdFilter && processedLinks >= maxCompaniesPerRun) break;
    if (!clientIdFilter && processedLinks > 0 && Date.now() - runStartedAt >= maxExecutionMs) break;

    let effectiveDateFrom = dateFrom;
    const linkLastSyncedAt = normalizeDateTime((link as Record<string, unknown>).last_synced_at);
    if (!explicitDateFrom && linkLastSyncedAt) {
      const parsedLastSync = new Date(linkLastSyncedAt);
      if (!Number.isNaN(parsedLastSync.getTime())) {
        const incrementalDateFrom = toIsoDateOnly(subtractUtcDays(parsedLastSync, incrementalLookbackDays));
        if (incrementalDateFrom > effectiveDateFrom) {
          effectiveDateFrom = incrementalDateFrom;
        }
      }
    }
    if (effectiveDateFrom < minimumDateFrom) {
      effectiveDateFrom = minimumDateFrom;
    }

    const primaryCompanyId = link.acessorias_company_id;
    const companyCnpj = companyCnpjById.get(link.acessorias_company_id) || null;
    const identifiers = [companyCnpj, primaryCompanyId].filter(
      (value, index, array): value is string => Boolean(value) && array.indexOf(value) === index,
    );
    const buildPathCandidates = (fromDate: string, toDate: string) => {
      const set = new Set<string>();
      for (const identifier of identifiers) {
        for (const template of deliveriesPathTemplates) {
          if (!template.includes("{companyId}") && !template.includes(":companyId")) {
            // Neste fluxo a sincronizacao e por empresa vinculada; ignoramos endpoints globais.
            continue;
          }
          const hasDateRange =
            template.toLowerCase().includes("dtinitial=") && template.toLowerCase().includes("dtfinal=");
          const templateWithDates = hasDateRange
            ? template
            : `${template}${template.includes("?") ? "&" : "?"}DtInitial={dateFrom}&DtFinal={dateTo}&Pagina=1`;
          set.add(
            resolveTemplatePath(templateWithDates, {
              companyId: identifier,
              dateFrom: fromDate,
              dateTo: toDate,
            }),
          );
        }
      }
      return Array.from(set);
    };
    const pathCandidates = buildPathCandidates(effectiveDateFrom, dateTo);

    let deliveriesResponse: AcessoriasRequestResult;
    try {
      deliveriesResponse = await requestFirstSuccessful(
        acessoriasApiBaseUrl,
        acessoriasApiToken,
        pathCandidates,
      );
    } catch (error) {
      details.push({
        client_id: link.client_id,
        acessorias_company_id: link.acessorias_company_id,
        company_identifier: primaryCompanyId,
        company_cnpj: companyCnpj,
        synced: 0,
        error:
          error instanceof Error
            ? error.message
            : "Falha ao sincronizar obrigacoes para esta empresa",
      });
      processedLinks += 1;
      continue;
    }

    let parsedObligations = parseObligations(deliveriesResponse.payload);
    let usedFallbackFullRange = false;
    if (parsedObligations.length === 0 && !explicitDateFrom && effectiveDateFrom !== dateFrom) {
      const fallbackPathCandidates = buildPathCandidates(dateFrom, dateTo);
      try {
        const fallbackResponse = await requestFirstSuccessful(
          acessoriasApiBaseUrl,
          acessoriasApiToken,
          fallbackPathCandidates,
        );
        const fallbackParsedObligations = parseObligations(fallbackResponse.payload);
        if (fallbackParsedObligations.length > 0) {
          deliveriesResponse = fallbackResponse;
          parsedObligations = fallbackParsedObligations;
          usedFallbackFullRange = true;
        }
      } catch {
        // keep initial empty result and proceed
      }
    }
    const nowIso = new Date().toISOString();

    for (const obligation of parsedObligations) {
      const row = {
        client_id: link.client_id,
        acessorias_company_id: link.acessorias_company_id,
        acessorias_obligation_id: obligation.acessorias_obligation_id,
        obligation_name: obligation.obligation_name,
        obligation_period: obligation.obligation_period,
        obligation_period_key: obligation.obligation_period_key,
        due_date: obligation.due_date,
        delivered_at: obligation.delivered_at,
        status: obligation.status,
        protocol: obligation.protocol,
        notes: obligation.notes,
        source_payload: obligation.source_payload,
        last_synced_at: nowIso,
      };
      obligationRows.push(row);
    }

    details.push({
      client_id: link.client_id,
      acessorias_company_id: link.acessorias_company_id,
      company_identifier: primaryCompanyId,
      company_cnpj: companyCnpj,
      date_from_used: effectiveDateFrom,
      date_to_used: dateTo,
      fallback_full_range_used: usedFallbackFullRange,
      synced: parsedObligations.length,
      endpoint_used: deliveriesResponse.path,
    });

    await supabaseAdmin
      .from("client_acessorias_links")
      .update({ last_synced_at: nowIso })
      .eq("client_id", link.client_id);
    processedLinks += 1;
  }

  const dedupedObligationRowsMap = new Map<string, Record<string, unknown>>();
  for (const row of obligationRows) {
    const clientId = asTrimmedString(row.client_id) || "";
    const obligationId = asTrimmedString(row.acessorias_obligation_id) || "";
    const periodKey = asTrimmedString(row.obligation_period_key) || "";
    const dedupeKey = `${clientId}:${obligationId}:${periodKey}`;
    const existingRow = dedupedObligationRowsMap.get(dedupeKey);
    if (!existingRow) {
      dedupedObligationRowsMap.set(dedupeKey, row);
      continue;
    }
    dedupedObligationRowsMap.set(dedupeKey, pickPreferredObligationRow(existingRow, row));
  }
  const dedupedObligationRows = Array.from(dedupedObligationRowsMap.values());

  if (dedupedObligationRows.length > 0) {
    for (const rowsChunk of chunkArray(dedupedObligationRows, 400)) {
      const { error: obligationsUpsertError } = await supabaseAdmin
        .from("client_acessorias_obligations")
        .upsert(rowsChunk, {
          onConflict: "client_id,acessorias_obligation_id,obligation_period_key",
        });
      if (obligationsUpsertError) throw obligationsUpsertError;
    }
  }

  let calendarSyncSummary = {
    created: 0,
    updated: 0,
    cancelled: 0,
    processed: 0,
    skipped: 0,
  };
  let calendarSyncError: string | null = null;
  try {
    calendarSyncSummary = await syncCalendarEventsForObligations(
      supabaseAdmin,
      dedupedObligationRows,
      clientsById,
      callerUserId,
    );
  } catch (error) {
    calendarSyncError = error instanceof Error ? error.message : "Falha ao sincronizar calendario.";
    console.error("syncCalendarEventsForObligations failed:", error);
  }

  const processedInBatch = processedLinks;
  const nextCursor = clientIdFilter ? null : cursor + processedInBatch;
  const hasMore = !clientIdFilter && nextCursor < totalLinks;
  let weeklyKanbanSummary: {
    created: number;
    updated: number;
    removed: number;
    groups: number;
    window_start: string;
    window_end: string;
  } | null = null;
  let weeklyKanbanError: string | null = null;
  if (clientIdFilter || !hasMore) {
    try {
      weeklyKanbanSummary = await syncWeeklyObligationKanbanTasks(supabaseAdmin, callerUserId);
    } catch (error) {
      weeklyKanbanError = error instanceof Error ? error.message : "Falha ao sincronizar Kanban semanal.";
      console.error("syncWeeklyObligationKanbanTasks failed:", error);
    }
  }

  return {
    synced_obligations: dedupedObligationRows.length,
    clients_processed: processedInBatch,
    created_tasks: weeklyKanbanSummary?.created || 0,
    calendar_events_created: calendarSyncSummary.created,
    calendar_events_updated: calendarSyncSummary.updated,
    calendar_events_cancelled: calendarSyncSummary.cancelled,
    calendar_sync: calendarSyncSummary,
    calendar_sync_error: calendarSyncError,
    details,
    weekly_kanban: weeklyKanbanSummary,
    weekly_kanban_error: weeklyKanbanError,
    auto_linked_clients: autoLinkedClients,
    total_links: totalLinks,
    processed_in_batch: processedInBatch,
    batch_size: batchSize,
    cursor,
    has_more: hasMore,
    next_cursor: hasMore ? nextCursor : null,
  };
}

async function handleListObligations(
  supabaseAdmin: ReturnType<typeof createClient>,
  body: JsonRecord,
) {
  const clientId = asTrimmedString(body.client_id);
  const status = normalizeObligationStatus(asTrimmedString(body.status));

  let query = supabaseAdmin
    .from("client_acessorias_obligations")
    .select(
      "id, client_id, acessorias_company_id, acessorias_obligation_id, obligation_name, obligation_period, due_date, delivered_at, status, protocol, notes, has_financial_impact, projected_amount, financial_entry_type, financial_category, cashflow_account_id, last_synced_at",
    )
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("updated_at", { ascending: false });

  if (clientId) query = query.eq("client_id", clientId);
  if (status) query = query.eq("status", status);

  const { data: obligations, error: obligationsError } = await query.limit(500);
  if (obligationsError) throw obligationsError;

  const uniqueClientIds = Array.from(new Set((obligations || []).map((item) => item.client_id)));
  const uniqueCompanyIds = Array.from(new Set((obligations || []).map((item) => item.acessorias_company_id).filter(Boolean)));

  const [clientsResult, companiesResult] = await Promise.all([
    uniqueClientIds.length > 0
      ? supabaseAdmin.from("clients").select("id, name").in("id", uniqueClientIds)
      : Promise.resolve({ data: [], error: null }),
    uniqueCompanyIds.length > 0
      ? supabaseAdmin
        .from("acessorias_companies_cache")
        .select("acessorias_company_id, company_name")
        .in("acessorias_company_id", uniqueCompanyIds as string[])
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (clientsResult.error) throw clientsResult.error;
  if (companiesResult.error) throw companiesResult.error;

  const clientsById = new Map((clientsResult.data || []).map((row) => [row.id, row.name]));
  const companiesById = new Map((companiesResult.data || []).map((row) => [row.acessorias_company_id, row.company_name]));

  return {
    obligations: (obligations || []).map((item) => ({
      ...item,
      client_name: clientsById.get(item.client_id) || null,
      acessorias_company_name: item.acessorias_company_id
        ? companiesById.get(item.acessorias_company_id) || null
        : null,
    })),
  };
}

async function handleAssignObligation(
  supabaseAdmin: ReturnType<typeof createClient>,
  body: JsonRecord,
  callerUserId: string,
  acessoriasApiBaseUrl: string,
  acessoriasApiToken: string | null,
) {
  const clientId = asTrimmedString(body.client_id);
  const obligationName = asTrimmedString(body.obligation_name);
  const obligationId = asTrimmedString(body.acessorias_obligation_id);
  const obligationPeriod = asTrimmedString(body.obligation_period);
  const dueDate = normalizeDate(body.due_date);
  const status = normalizeObligationStatus(asTrimmedString(body.status)) || "pendente";
  const protocol = asTrimmedString(body.protocol);
  const notes = asTrimmedString(body.notes);
  const hasFinancialImpact = Object.prototype.hasOwnProperty.call(body, "has_financial_impact")
    ? asBoolean(body.has_financial_impact)
    : false;
  const projectedAmount = normalizePositiveNumber(body.projected_amount);
  const financialEntryType = normalizeCashflowEntryType(body.financial_entry_type);
  const financialCategory = asTrimmedString(body.financial_category);
  const cashflowAccountId = asTrimmedString(body.cashflow_account_id);
  const syncRemote = Object.prototype.hasOwnProperty.call(body, "sync_remote")
    ? asBoolean(body.sync_remote)
    : true;

  if (!clientId || !obligationName) {
    return jsonResponse({ error: "client_id e obligation_name sao obrigatorios" }, 400);
  }

  if (hasFinancialImpact && !projectedAmount) {
    return jsonResponse({ error: "projected_amount deve ser maior que zero quando houver impacto financeiro" }, 400);
  }

  const { data: client, error: clientError } = await supabaseAdmin
    .from("clients")
    .select("id, name, cnpj")
    .eq("id", clientId)
    .maybeSingle();
  if (clientError) throw clientError;
  if (!client) return jsonResponse({ error: "Cliente nao encontrado" }, 404);

  const { data: link, error: linkError } = await supabaseAdmin
    .from("client_acessorias_links")
    .select("acessorias_company_id")
    .eq("client_id", clientId)
    .maybeSingle();
  if (linkError) throw linkError;
  if (!link?.acessorias_company_id) {
    await ensureLinkForClientByCnpj(supabaseAdmin, clientId, callerUserId);
  }

  const { data: refreshedLink, error: refreshedLinkError } = await supabaseAdmin
    .from("client_acessorias_links")
    .select("acessorias_company_id")
    .eq("client_id", clientId)
    .maybeSingle();
  if (refreshedLinkError) throw refreshedLinkError;

  const nowIso = new Date().toISOString();
  const safeObligationId = obligationId || `manual_${normalizeToken(obligationName) || "obrigacao"}`;
  let remoteSync: Record<string, unknown> = {
    attempted: false,
    ok: false,
    message: "Sincronizacao remota nao executada.",
  };

  if (syncRemote) {
    if (!acessoriasApiToken) {
      remoteSync = {
        attempted: false,
        ok: false,
        message: "ACESSORIAS_API_TOKEN nao configurado para sincronizacao remota.",
      };
    } else if (!refreshedLink?.acessorias_company_id) {
      remoteSync = {
        attempted: false,
        ok: false,
        message: "Nao foi possivel identificar empresa no Acessorias para enviar a alteracao.",
      };
    } else {
      try {
        const requestResult = await notifyAcessoriasObligationChange(
          acessoriasApiBaseUrl,
          acessoriasApiToken,
          {
            companyId: refreshedLink.acessorias_company_id,
            departmentId: asTrimmedString(body.department_id),
            clientName: client.name || "Cliente",
            clientIdentifier: normalizeCnpj(client.cnpj) || client.cnpj || null,
            obligationName,
            obligationPeriod,
            dueDate,
            status,
            protocol,
            notes,
            changeLines: ["Obrigacao cadastrada no Grow Finance Hub."],
          },
        );
        remoteSync = {
          attempted: true,
          ...requestResult,
        };
      } catch (error) {
        remoteSync = {
          attempted: true,
          ok: false,
          message:
            error instanceof Error
              ? error.message
              : "Falha ao enviar cadastro da obrigacao para o Acessorias.",
        };
      }
    }
  }

  const row = {
    client_id: clientId,
    acessorias_company_id: refreshedLink?.acessorias_company_id || null,
    acessorias_obligation_id: safeObligationId,
    obligation_name: obligationName,
    obligation_period: obligationPeriod,
    obligation_period_key: toPeriodKey(obligationPeriod),
    due_date: dueDate,
    delivered_at: null,
    status,
    protocol,
    notes,
    has_financial_impact: hasFinancialImpact,
    projected_amount: hasFinancialImpact ? projectedAmount : null,
    financial_entry_type: financialEntryType,
    financial_category: hasFinancialImpact ? financialCategory : null,
    cashflow_account_id: hasFinancialImpact ? cashflowAccountId : null,
    source_payload: {
      source: "manual",
      created_by: callerUserId,
      grow_sync: remoteSync,
      grow_sync_history: [
        {
          at: nowIso,
          changed_by: callerUserId,
          changes: ["Obrigacao cadastrada manualmente no Grow."],
          remote_sync: remoteSync,
        },
      ],
    },
    last_synced_at: nowIso,
  };

  const { data: upserted, error: upsertError } = await supabaseAdmin
    .from("client_acessorias_obligations")
    .upsert(row, { onConflict: "client_id,acessorias_obligation_id,obligation_period_key" })
    .select(
      "id, client_id, acessorias_obligation_id, obligation_name, obligation_period, due_date, status, has_financial_impact, projected_amount, financial_entry_type, financial_category, cashflow_account_id",
    )
    .maybeSingle();
  if (upsertError) throw upsertError;

  const calendarSyncSummary = await syncCalendarEventsForObligations(
    supabaseAdmin,
    [row],
    new Map<string, string>([[client.id, client.name || "Cliente sem nome"]]),
    callerUserId,
  );

  await cleanupObligationKanbanTasks(supabaseAdmin, { clientId: client.id });
  const weeklyKanbanSummary = await syncWeeklyObligationKanbanTasks(supabaseAdmin, callerUserId);

  return jsonResponse({
    ok: true,
    obligation: upserted,
    kanban_task_id: null,
    weekly_kanban: weeklyKanbanSummary,
    calendar_sync: calendarSyncSummary,
    remote_sync: remoteSync,
  });
}

async function handleUpdateObligation(
  supabaseAdmin: ReturnType<typeof createClient>,
  body: JsonRecord,
  callerUserId: string,
  acessoriasApiBaseUrl: string,
  acessoriasApiToken: string | null,
) {
  const obligationRowId = asTrimmedString(body.obligation_id);
  if (!obligationRowId) {
    return jsonResponse({ error: "obligation_id e obrigatorio" }, 400);
  }

  const { data: existing, error: existingError } = await supabaseAdmin
    .from("client_acessorias_obligations")
    .select(
      "id, client_id, acessorias_company_id, acessorias_obligation_id, obligation_name, obligation_period, due_date, delivered_at, status, protocol, notes, has_financial_impact, projected_amount, financial_entry_type, financial_category, cashflow_account_id, source_payload",
    )
    .eq("id", obligationRowId)
    .maybeSingle();
  if (existingError) throw existingError;
  if (!existing) {
    return jsonResponse({ error: "Obrigacao nao encontrada" }, 404);
  }

  const hasName = Object.prototype.hasOwnProperty.call(body, "obligation_name");
  const providedName = asTrimmedString(body.obligation_name);
  if (hasName && !providedName) {
    return jsonResponse({ error: "obligation_name nao pode ser vazio" }, 400);
  }

  const hasPeriod = Object.prototype.hasOwnProperty.call(body, "obligation_period");
  const hasDueDate = Object.prototype.hasOwnProperty.call(body, "due_date");
  const hasStatus = Object.prototype.hasOwnProperty.call(body, "status");
  const hasProtocol = Object.prototype.hasOwnProperty.call(body, "protocol");
  const hasNotes = Object.prototype.hasOwnProperty.call(body, "notes");
  const hasFinancialImpact = Object.prototype.hasOwnProperty.call(body, "has_financial_impact");
  const hasProjectedAmount = Object.prototype.hasOwnProperty.call(body, "projected_amount");
  const hasFinancialEntryType = Object.prototype.hasOwnProperty.call(body, "financial_entry_type");
  const hasFinancialCategory = Object.prototype.hasOwnProperty.call(body, "financial_category");
  const hasCashflowAccountId = Object.prototype.hasOwnProperty.call(body, "cashflow_account_id");

  const nextValues = {
    obligation_name: providedName || existing.obligation_name,
    obligation_period: hasPeriod ? asTrimmedString(body.obligation_period) : existing.obligation_period,
    due_date: hasDueDate ? normalizeDate(body.due_date) : existing.due_date,
    status: hasStatus
      ? normalizeObligationStatus(asTrimmedString(body.status)) || null
      : normalizeObligationStatus(existing.status),
    protocol: hasProtocol ? asTrimmedString(body.protocol) : existing.protocol,
    notes: hasNotes ? asTrimmedString(body.notes) : existing.notes,
    has_financial_impact: hasFinancialImpact ? asBoolean(body.has_financial_impact) : Boolean(existing.has_financial_impact),
    projected_amount: hasProjectedAmount ? normalizePositiveNumber(body.projected_amount) : existing.projected_amount,
    financial_entry_type: hasFinancialEntryType
      ? normalizeCashflowEntryType(body.financial_entry_type)
      : normalizeCashflowEntryType(existing.financial_entry_type),
    financial_category: hasFinancialCategory ? asTrimmedString(body.financial_category) : existing.financial_category,
    cashflow_account_id: hasCashflowAccountId ? asTrimmedString(body.cashflow_account_id) : existing.cashflow_account_id,
  };

  if (nextValues.has_financial_impact && !nextValues.projected_amount) {
    return jsonResponse({ error: "projected_amount deve ser maior que zero quando houver impacto financeiro" }, 400);
  }

  const syncRemote = Object.prototype.hasOwnProperty.call(body, "sync_remote")
    ? asBoolean(body.sync_remote)
    : true;

  const { data: client, error: clientError } = await supabaseAdmin
    .from("clients")
    .select("id, name, cnpj")
    .eq("id", existing.client_id)
    .maybeSingle();
  if (clientError) throw clientError;

  const changeLines = summarizeObligationChanges(
    {
      obligation_name: existing.obligation_name,
      obligation_period: existing.obligation_period,
      due_date: existing.due_date,
      status: existing.status,
      protocol: existing.protocol,
      notes: existing.notes,
    },
    nextValues,
  );

  let remoteSync: Record<string, unknown> = {
    attempted: false,
    ok: false,
    message: "Sincronizacao remota nao executada.",
  };

  if (syncRemote) {
    if (!acessoriasApiToken) {
      remoteSync = {
        attempted: false,
        ok: false,
        message: "ACESSORIAS_API_TOKEN nao configurado para sincronizacao remota.",
      };
    } else {
      let acessoriasCompanyId = existing.acessorias_company_id;
      if (!acessoriasCompanyId) {
        await ensureLinkForClientByCnpj(supabaseAdmin, existing.client_id, callerUserId);
        const { data: refreshedLink, error: refreshedLinkError } = await supabaseAdmin
          .from("client_acessorias_links")
          .select("acessorias_company_id")
          .eq("client_id", existing.client_id)
          .maybeSingle();
        if (refreshedLinkError) throw refreshedLinkError;
        acessoriasCompanyId = refreshedLink?.acessorias_company_id || null;
      }

      if (!acessoriasCompanyId) {
        remoteSync = {
          attempted: false,
          ok: false,
          message: "Nao foi possivel identificar empresa no Acessorias para enviar a alteracao.",
        };
      } else {
        const sourcePayload = asRecord(existing.source_payload) || {};
        const departmentIdFromPayload = pickFirstNestedString(sourcePayload, [
          "Config.DptoID",
          "config.dptoid",
          "DptoID",
          "dptoid",
        ]);
        const departmentIdFromBody = asTrimmedString(body.department_id);

        try {
          const requestResult = await notifyAcessoriasObligationChange(
            acessoriasApiBaseUrl,
            acessoriasApiToken,
            {
              companyId: acessoriasCompanyId,
              departmentId: departmentIdFromBody || departmentIdFromPayload,
              clientName: client?.name || "Cliente",
              clientIdentifier: normalizeCnpj(client?.cnpj) || client?.cnpj || null,
              obligationName: nextValues.obligation_name,
              obligationPeriod: nextValues.obligation_period,
              dueDate: nextValues.due_date,
              status: nextValues.status,
              protocol: nextValues.protocol,
              notes: nextValues.notes,
              changeLines,
            },
          );

          remoteSync = {
            attempted: true,
            ...requestResult,
          };
        } catch (error) {
          remoteSync = {
            attempted: true,
            ok: false,
            message:
              error instanceof Error
                ? error.message
                : "Falha ao enviar atualizacao da obrigacao para o Acessorias.",
          };
        }
      }
    }
  }

  const nowIso = new Date().toISOString();
  const existingSourcePayload = asRecord(existing.source_payload) || {};
  const previousHistory = asArray(existingSourcePayload.grow_sync_history) || [];
  const syncHistoryEntry = {
    at: nowIso,
    changed_by: callerUserId,
    changes: changeLines,
    remote_sync: remoteSync,
  };
  const sourcePayload = {
    ...existingSourcePayload,
    source: "grow_manual_update",
    grow_sync: remoteSync,
    grow_sync_history: [syncHistoryEntry, ...previousHistory].slice(0, 25),
  };

  const { data: updated, error: updateError } = await supabaseAdmin
    .from("client_acessorias_obligations")
    .update({
      obligation_name: nextValues.obligation_name,
      obligation_period: nextValues.obligation_period,
      obligation_period_key: toPeriodKey(nextValues.obligation_period),
      due_date: nextValues.due_date,
      status: nextValues.status,
      protocol: nextValues.protocol,
      notes: nextValues.notes,
      has_financial_impact: nextValues.has_financial_impact,
      projected_amount: nextValues.has_financial_impact ? nextValues.projected_amount : null,
      financial_entry_type: nextValues.financial_entry_type,
      financial_category: nextValues.has_financial_impact ? nextValues.financial_category : null,
      cashflow_account_id: nextValues.has_financial_impact ? nextValues.cashflow_account_id : null,
      source_payload: sourcePayload,
      last_synced_at: nowIso,
    })
    .eq("id", obligationRowId)
    .select(
      "id, client_id, acessorias_company_id, acessorias_obligation_id, obligation_name, obligation_period, due_date, delivered_at, status, protocol, notes, has_financial_impact, projected_amount, financial_entry_type, financial_category, cashflow_account_id, last_synced_at",
    )
    .maybeSingle();
  if (updateError) throw updateError;

  const calendarSyncSummary = await syncCalendarEventsForObligations(
    supabaseAdmin,
    updated ? [updated as unknown as Record<string, unknown>] : [],
    new Map<string, string>([
      [existing.client_id, client?.name || "Cliente sem nome"],
    ]),
    callerUserId,
  );

  await cleanupObligationKanbanTasks(supabaseAdmin, { clientId: existing.client_id });
  const weeklyKanbanSummary = await syncWeeklyObligationKanbanTasks(supabaseAdmin, callerUserId);

  return jsonResponse({
    ok: true,
    obligation: updated,
    weekly_kanban: weeklyKanbanSummary,
    calendar_sync: calendarSyncSummary,
    remote_sync: remoteSync,
  });
}

async function handleCleanupKanbanObligations(
  supabaseAdmin: ReturnType<typeof createClient>,
  body: JsonRecord,
) {
  const clientId = asTrimmedString(body.client_id);
  await cleanupObligationKanbanTasks(supabaseAdmin, { clientId });
  return {
    ok: true,
    removed: true,
    scope: clientId ? "client" : "all",
    client_id: clientId || null,
  };
}

async function handleListUploads(
  supabaseAdmin: ReturnType<typeof createClient>,
  body: JsonRecord,
) {
  const clientId = asTrimmedString(body.client_id);
  let query = supabaseAdmin
    .from("client_acessorias_uploads")
    .select("id, client_id, acessorias_company_id, file_name, file_size, content_type, status, error_message, uploaded_by, uploaded_at, request_payload")
    .order("uploaded_at", { ascending: false })
    .limit(100);

  if (clientId) query = query.eq("client_id", clientId);

  const { data, error } = await query;
  if (error) throw error;
  const uploads = data || [];
  if (uploads.length === 0) return { uploads: [] };

  const clientIds = Array.from(
    new Set(
      uploads
        .map((row) => asTrimmedString(row.client_id))
        .filter((value): value is string => Boolean(value)),
    ),
  );
  const companyIds = Array.from(
    new Set(
      uploads
        .map((row) => asTrimmedString(row.acessorias_company_id))
        .filter((value): value is string => Boolean(value)),
    ),
  );

  const clientNameById = new Map<string, string>();
  if (clientIds.length > 0) {
    const { data: clients, error: clientsError } = await supabaseAdmin
      .from("clients")
      .select("id, name")
      .in("id", clientIds);
    if (clientsError) throw clientsError;

    for (const client of clients || []) {
      const id = asTrimmedString(client.id);
      if (!id) continue;
      clientNameById.set(id, asTrimmedString(client.name) || "Cliente sem nome");
    }
  }

  const companyNameById = new Map<string, string>();
  if (companyIds.length > 0) {
    const { data: companies, error: companiesError } = await supabaseAdmin
      .from("acessorias_companies_cache")
      .select("acessorias_company_id, company_name")
      .in("acessorias_company_id", companyIds);
    if (companiesError) throw companiesError;

    for (const company of companies || []) {
      const id = asTrimmedString(company.acessorias_company_id);
      const name = asTrimmedString(company.company_name);
      if (!id || !name) continue;
      companyNameById.set(id, name);
    }
  }

  return { uploads: mapUploadsForHistory(uploads, clientNameById, companyNameById) };
}

async function handlePreflightEcontinuo(
  supabaseAdmin: ReturnType<typeof createClient>,
  body: JsonRecord,
  acessoriasApiBaseUrl: string,
  acessoriasApiToken: string,
  callerUserId: string,
) {
  const fileName = asTrimmedString(body.file_name);
  const contentType = asTrimmedString(body.content_type) || "application/octet-stream";
  const base64Content = asTrimmedString(body.file_content_base64);
  if (!fileName || !base64Content) {
    return jsonResponse(
      { error: "file_name e file_content_base64 sao obrigatorios" },
      400,
    );
  }

  const commaIndex = base64Content.indexOf(",");
  const cleanBase64 = commaIndex >= 0 ? base64Content.slice(commaIndex + 1) : base64Content;

  let fileBytes: Uint8Array;
  try {
    const decoded = atob(cleanBase64);
    fileBytes = new Uint8Array(decoded.length);
    for (let index = 0; index < decoded.length; index += 1) {
      fileBytes[index] = decoded.charCodeAt(index);
    }
  } catch {
    return jsonResponse({ error: "Conteudo do arquivo em Base64 invalido" }, 400);
  }

  const fileField =
    asTrimmedString(body.file_field) ||
    asTrimmedString(Deno.env.get("ACESSORIAS_ECONTINUO_PREFLIGHT_FILE_FIELD")) ||
    "file";
  const referenceModelId =
    asTrimmedString(body.reference_model_id) ||
    asTrimmedString(Deno.env.get("ACESSORIAS_ECONTINUO_REFERENCE_MODEL_ID"));

  const formData = new FormData();
  formData.append(fileField, new Blob([fileBytes], { type: contentType }), fileName);
  formData.append("preview", "1");
  formData.append("simulacao", "1");
  formData.append("simulate", "1");
  formData.append("dry_run", "1");

  let resolvedCompanyId =
    asTrimmedString(body.acessorias_company_id) ||
    asTrimmedString(body.company_id) ||
    asTrimmedString(body.empresa_id);
  const clientId = asTrimmedString(body.client_id);
  if (!resolvedCompanyId && clientId) {
    const { data: existingLink, error: existingLinkError } = await supabaseAdmin
      .from("client_acessorias_links")
      .select("acessorias_company_id")
      .eq("client_id", clientId)
      .maybeSingle();
    if (existingLinkError) throw existingLinkError;

    resolvedCompanyId = asTrimmedString(existingLink?.acessorias_company_id);

    if (!resolvedCompanyId) {
      const ensuredLink = await ensureLinkForClientByCnpj(supabaseAdmin, clientId, callerUserId);
      resolvedCompanyId = asTrimmedString(ensuredLink?.acessorias_company_id);
    }
  }

  if (resolvedCompanyId) {
    formData.append("company_id", resolvedCompanyId);
    formData.append("empresa_id", resolvedCompanyId);
  }

  if (referenceModelId) {
    formData.append("reference_model_id", referenceModelId);
    formData.append("modelo_id", referenceModelId);
    formData.append("template_id", referenceModelId);
  }

  const allowUploadFallback =
    asBoolean(body.allow_upload_fallback) ||
    asBoolean(Deno.env.get("ACESSORIAS_ECONTINUO_PREFLIGHT_ALLOW_UPLOAD_FALLBACK"));
  const pathCandidates = getPathCandidates(
    "ACESSORIAS_ECONTINUO_PREFLIGHT_PATHS",
    defaultEcontinuoPreflightPathCandidates,
  );
  const requestedCandidates = allowUploadFallback
    ? [...pathCandidates, ...defaultEcontinuoPathCandidates]
    : pathCandidates;
  const uniqueCandidates = Array.from(new Set(requestedCandidates));

  let response: AcessoriasRequestResult;
  try {
    response = await requestFirstSuccessful(
      acessoriasApiBaseUrl,
      acessoriasApiToken,
      uniqueCandidates,
      {
        method: "POST",
        body: formData,
      },
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Falha desconhecida ao consultar o Acessorias.";
    const compactMessage = message.length > 220 ? `${message.slice(0, 220)}...` : message;
    return jsonResponse({
      ok: true,
      preflight: {
        endpoint_used: null,
        message: null,
        client_cnpj: null,
        competence: null,
        obligation_name: null,
        path_folder: null,
        confidence: 0,
        warnings: [
          "Leitura remota do Acessorias indisponivel para este arquivo.",
          compactMessage,
        ],
      },
    });
  }

  const payloadRecord = asRecord(response.payload);
  const message = extractApiMessage(response.payload);
  const pathFolder = payloadRecord
    ? pickFirstString(payloadRecord, ["pathFolder", "pathfolder", "path_folder", "pasta", "folder", "caminho"])
    : null;
  const parsedText = [fileName, message || "", pathFolder || ""].filter(Boolean).join("\n");
  const parsedCnpj = extractCnpjFromText(parsedText);
  const parsedCompetence = extractCompetenceFromText(parsedText);
  const parsedObligation =
    extractBracketedObligation(message) ||
    extractObligationNameFromPath(pathFolder);

  let confidence = 25;
  if (message) confidence += 18;
  if (parsedCnpj) confidence += 25;
  if (parsedCompetence) confidence += 20;
  if (parsedObligation) confidence += 22;
  confidence = Math.max(0, Math.min(100, Math.round(confidence)));

  const warnings: string[] = [];
  if (!parsedCnpj) warnings.push("CNPJ nao identificado pela leitura do Acessorias.");
  if (!parsedCompetence) warnings.push("Competencia nao identificada pela leitura do Acessorias.");
  if (!parsedObligation) warnings.push("Obrigacao nao identificada pela leitura do Acessorias.");

  return jsonResponse({
    ok: true,
    preflight: {
      endpoint_used: response.path,
      message: message || null,
      client_cnpj: parsedCnpj,
      competence: parsedCompetence,
      obligation_name: parsedObligation,
      path_folder: pathFolder,
      confidence,
      warnings,
    },
    response: response.payload,
  });
}

async function handleSendEcontinuo(
  supabaseAdmin: ReturnType<typeof createClient>,
  body: JsonRecord,
  acessoriasApiBaseUrl: string,
  acessoriasApiToken: string,
  callerUserId: string,
) {
  const clientId = asTrimmedString(body.client_id);
  const fileName = asTrimmedString(body.file_name);
  const contentType = asTrimmedString(body.content_type) || "application/octet-stream";
  const base64Content = asTrimmedString(body.file_content_base64);
  const metadata = asRecord(body.metadata) || {};

  if (!clientId || !fileName || !base64Content) {
    return jsonResponse(
      { error: "client_id, file_name e file_content_base64 sao obrigatorios" },
      400,
    );
  }

  const { data: clientProfile, error: clientProfileError } = await supabaseAdmin
    .from("clients")
    .select("id, portal_user_id")
    .eq("id", clientId)
    .maybeSingle();
  if (clientProfileError) throw clientProfileError;
  if (!clientProfile) {
    return jsonResponse({ error: "Cliente nao encontrado para registrar o envio." }, 404);
  }

  const { data: link, error: linkError } = await supabaseAdmin
    .from("client_acessorias_links")
    .select("acessorias_company_id")
    .eq("client_id", clientId)
    .maybeSingle();
  if (linkError) throw linkError;

  let ensuredLink = link;
  if (!ensuredLink?.acessorias_company_id) {
    await handleSyncCompanies(
      supabaseAdmin,
      acessoriasApiBaseUrl,
      acessoriasApiToken,
      callerUserId,
      {
        sync_grow_clients: false,
        restrict_to_acessorias: false,
      },
    );

    await ensureLinkForClientByCnpj(supabaseAdmin, clientId, callerUserId);
    const { data: refreshedLink, error: refreshedLinkError } = await supabaseAdmin
      .from("client_acessorias_links")
      .select("acessorias_company_id")
      .eq("client_id", clientId)
      .maybeSingle();
    if (refreshedLinkError) throw refreshedLinkError;
    ensuredLink = refreshedLink;
  }

  if (!ensuredLink?.acessorias_company_id) {
    return jsonResponse(
      { error: "Nao foi possivel identificar empresa no Acessorias por CNPJ para este cliente." },
      409,
    );
  }

  const commaIndex = base64Content.indexOf(",");
  const cleanBase64 = commaIndex >= 0 ? base64Content.slice(commaIndex + 1) : base64Content;

  let fileBytes: Uint8Array;
  try {
    const decoded = atob(cleanBase64);
    fileBytes = new Uint8Array(decoded.length);
    for (let index = 0; index < decoded.length; index += 1) {
      fileBytes[index] = decoded.charCodeAt(index);
    }
  } catch {
    return jsonResponse({ error: "Conteudo do arquivo em Base64 invalido" }, 400);
  }

  const formData = new FormData();
  formData.append(
    "file",
    new Blob([fileBytes], { type: contentType }),
    fileName,
  );
  formData.append("company_id", ensuredLink.acessorias_company_id);
  formData.append("empresa_id", ensuredLink.acessorias_company_id);

  for (const [key, value] of Object.entries(metadata)) {
    if (value === null || value === undefined) continue;
    if (typeof value === "object") {
      formData.append(key, JSON.stringify(value));
      continue;
    }
    formData.append(key, String(value));
  }

  const pathCandidates = getPathCandidates("ACESSORIAS_ECONTINUO_PATHS", defaultEcontinuoPathCandidates);
  let responsePayload: unknown = {};
  let responseStatus = "error";
  let responseError: string | null = null;
  let endpointUsed: string | null = null;
  const mirrorResults = {
    portal: {
      attempted: false,
      ok: false,
      message: "Espelhamento no portal nao executado.",
      document_id: null as string | null,
      file_path: null as string | null,
    },
    internal: {
      attempted: false,
      ok: false,
      message: "Registro interno nao executado.",
      file_id: null as string | null,
      file_path: null as string | null,
      category: "cadastro_documentos",
    },
  };

  try {
    const response = await requestFirstSuccessful(
      acessoriasApiBaseUrl,
      acessoriasApiToken,
      pathCandidates,
      {
        method: "POST",
        body: formData,
      },
    );

    endpointUsed = response.path;
    responsePayload = response.payload;
    responseStatus = "sent";
  } catch (error) {
    responseError = error instanceof Error ? error.message : "Falha ao enviar arquivo para o e-Continuo";
  }

  const { data: uploadRow, error: uploadInsertError } = await supabaseAdmin
    .from("client_acessorias_uploads")
    .insert({
      client_id: clientId,
      acessorias_company_id: ensuredLink.acessorias_company_id,
      file_name: fileName,
      file_size: fileBytes.byteLength,
      content_type: contentType,
      status: responseStatus,
      request_payload: {
        metadata,
        endpoint_candidates: pathCandidates,
      },
      response_payload: {
        endpoint_used: endpointUsed,
        payload: responsePayload,
      },
      error_message: responseError,
      uploaded_by: callerUserId,
    })
    .select("id, status, uploaded_at")
    .maybeSingle();
  if (uploadInsertError) throw uploadInsertError;

  if (responseStatus !== "sent") {
    return jsonResponse(
      {
        error: responseError || "Falha ao enviar arquivo para o e-Continuo",
        upload: uploadRow,
      },
      502,
    );
  }

  if (responseStatus === "sent") {
    if (clientProfile.portal_user_id) {
      mirrorResults.portal.attempted = true;
      try {
        const portalFilePath = buildStorageObjectPath(`${clientProfile.portal_user_id}/envios-econtinuo`, fileName);
        const { error: portalStorageError } = await supabaseAdmin.storage
          .from("client-documents")
          .upload(portalFilePath, fileBytes, {
            contentType,
            upsert: false,
          });

        if (portalStorageError) {
          mirrorResults.portal.ok = false;
          mirrorResults.portal.message = `Falha no upload para o portal: ${portalStorageError.message}`;
        } else {
          const { data: portalDocument, error: portalDocumentError } = await supabaseAdmin
            .from("client_documents")
            .insert({
              user_id: clientProfile.portal_user_id,
              request_id: null,
              file_name: fileName,
              file_path: portalFilePath,
              file_size: fileBytes.byteLength,
              category: "Envios e-continuo",
            })
            .select("id")
            .maybeSingle();

          if (portalDocumentError) {
            mirrorResults.portal.ok = false;
            mirrorResults.portal.message = `Falha ao registrar documento no portal: ${portalDocumentError.message}`;
          } else {
            mirrorResults.portal.ok = true;
            mirrorResults.portal.message = "Copia registrada no portal do cliente.";
            mirrorResults.portal.document_id = portalDocument?.id || null;
            mirrorResults.portal.file_path = portalFilePath;
          }
        }
      } catch (error) {
        mirrorResults.portal.ok = false;
        mirrorResults.portal.message =
          error instanceof Error
            ? `Falha no espelhamento para o portal: ${error.message}`
            : "Falha no espelhamento para o portal.";
      }
    } else {
      mirrorResults.portal.attempted = true;
      mirrorResults.portal.ok = false;
      mirrorResults.portal.message = "Cliente sem usuario de portal vinculado.";
    }

    mirrorResults.internal.attempted = true;
    try {
      const internalFilePath = buildStorageObjectPath(`${clientId}/cadastro_documentos`, fileName);
      const { error: internalStorageError } = await supabaseAdmin.storage
        .from("client-files")
        .upload(internalFilePath, fileBytes, {
          contentType,
          upsert: false,
        });

      if (internalStorageError) {
        mirrorResults.internal.ok = false;
        mirrorResults.internal.message = `Falha no upload para registros internos: ${internalStorageError.message}`;
      } else {
        const { data: internalFileRow, error: internalFileRowError } = await supabaseAdmin
          .from("client_files")
          .insert({
            client_id: clientId,
            category: "cadastro_documentos",
            file_name: fileName,
            file_path: internalFilePath,
            file_size: fileBytes.byteLength,
            uploaded_by: callerUserId,
          })
          .select("id")
          .maybeSingle();

        if (internalFileRowError) {
          mirrorResults.internal.ok = false;
          mirrorResults.internal.message = `Falha ao registrar arquivo interno: ${internalFileRowError.message}`;
        } else {
          mirrorResults.internal.ok = true;
          mirrorResults.internal.message = "Copia registrada no modulo de clientes.";
          mirrorResults.internal.file_id = internalFileRow?.id || null;
          mirrorResults.internal.file_path = internalFilePath;
        }
      }
    } catch (error) {
      mirrorResults.internal.ok = false;
      mirrorResults.internal.message =
        error instanceof Error
          ? `Falha no espelhamento interno: ${error.message}`
          : "Falha no espelhamento interno.";
    }
  }

  if (uploadRow?.id) {
    const { error: mirrorUpdateError } = await supabaseAdmin
      .from("client_acessorias_uploads")
      .update({
        response_payload: {
          endpoint_used: endpointUsed,
          payload: responsePayload,
          mirror_results: mirrorResults,
        },
      })
      .eq("id", uploadRow.id);

    if (mirrorUpdateError) {
      console.error("Falha ao atualizar mirror_results no historico de uploads", mirrorUpdateError);
    }
  }

  return jsonResponse({
    ok: true,
    upload: uploadRow,
    endpoint_used: endpointUsed,
    response: responsePayload,
    mirrors: mirrorResults,
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    let body: JsonRecord;
    try {
      body = parseBodyAsRecord(await req.clone().json());
    } catch {
      return jsonResponse({ error: "Invalid JSON payload" }, 400);
    }

    const context = await buildAuthContext(req, asTrimmedString(body.access_token));
    if ("error" in context) {
      return context.error;
    }

    const action = asTrimmedString(body.action);
    if (!action) {
      return jsonResponse({ error: "action is required" }, 400);
    }

    const {
      supabaseAdmin,
      callerUser,
      organizationIds,
      acessoriasApiToken,
      acessoriasApiBaseUrl,
    } = context;

    const actionKey = normalizeToken(action);
    const organizationId = resolveRequestedOrganizationId(body, organizationIds);
    await assertOrganizationFeatureEnabled(supabaseAdmin, organizationId, "acessorias");
    if (actionKey === "preflight_econtinuo" || actionKey === "send_econtinuo" || actionKey === "list_uploads") {
      await assertOrganizationFeatureEnabled(supabaseAdmin, organizationId, "robo_documentos");
    }

    if (actionKey === "overview") {
      const data = await handleOverview(supabaseAdmin);
      return jsonResponse({
        ok: true,
        has_acessorias_configuration: Boolean(acessoriasApiToken),
        ...data,
      });
    }

    if (
      !acessoriasApiToken &&
      actionKey !== "assign_obligation" &&
      actionKey !== "update_obligation" &&
      actionKey !== "list_obligations" &&
      actionKey !== "list_uploads" &&
      actionKey !== "cleanup_kanban_obligations"
    ) {
      return jsonResponse(
        {
          error:
            "ACESSORIAS_API_TOKEN nao configurado. Defina o secret no projeto Supabase para usar sincronizacao/envio.",
        },
        400,
      );
    }

    if (actionKey === "sync_companies" || actionKey === "sync_obligations") {
      return jsonResponse(
        { error: "A importacao de dados do Acessorias para o Grow foi desativada." },
        403,
      );
    }

    if (actionKey === "set_link" || actionKey === "remove_link") {
      return jsonResponse(
        { error: "Vinculo manual desativado. O cruzamento e automatico por CNPJ." },
        403,
      );
    }

    if (actionKey === "list_obligations") {
      const data = await handleListObligations(supabaseAdmin, body);
      return jsonResponse({ ok: true, ...data });
    }

    if (actionKey === "assign_obligation") {
      return await handleAssignObligation(
        supabaseAdmin,
        body,
        callerUser.id,
        acessoriasApiBaseUrl,
        acessoriasApiToken,
      );
    }

    if (actionKey === "update_obligation") {
      return await handleUpdateObligation(
        supabaseAdmin,
        body,
        callerUser.id,
        acessoriasApiBaseUrl,
        acessoriasApiToken,
      );
    }

    if (actionKey === "cleanup_kanban_obligations") {
      const data = await handleCleanupKanbanObligations(supabaseAdmin, body);
      return jsonResponse(data);
    }

    if (actionKey === "preflight_econtinuo") {
      return await handlePreflightEcontinuo(
        supabaseAdmin,
        body,
        acessoriasApiBaseUrl,
        acessoriasApiToken as string,
        callerUser.id,
      );
    }

    if (actionKey === "send_econtinuo") {
      return await handleSendEcontinuo(
        supabaseAdmin,
        body,
        acessoriasApiBaseUrl,
        acessoriasApiToken as string,
        callerUser.id,
      );
    }

    if (actionKey === "list_uploads") {
      const data = await handleListUploads(supabaseAdmin, body);
      return jsonResponse({ ok: true, ...data });
    }

    return jsonResponse({ error: `Unknown action: ${action}` }, 400);
  } catch (error: unknown) {
    const message =
      typeof error === "object" &&
      error !== null &&
      "message" in error &&
      typeof (error as { message?: unknown }).message === "string"
        ? (error as { message: string }).message
        : "Unknown error";

    return jsonResponse({ error: message }, 400);
  }
});
