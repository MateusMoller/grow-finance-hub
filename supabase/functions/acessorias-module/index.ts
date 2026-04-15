
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
  "/deliveries/ListAll?DtInitial={dateFrom}&DtFinal={dateTo}&Pagina=1",
  "/deliveries/ListAll/?DtInitial={dateFrom}&DtFinal={dateTo}&Pagina=1",
];

const defaultEcontinuoPathCandidates = [
  "/v1/econtinuo/upload",
  "/v1/econtinuo/send",
  "/v1/econtinuo",
  "/econtinuo/upload",
  "/econtinuo/send",
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

function asBoolean(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value > 0;
  const text = normalizeToken(asTrimmedString(value) || "");
  return text === "true" || text === "1" || text === "yes" || text === "sim";
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

  const response = await fetch(url, {
    ...init,
    headers,
  });

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
    const result = await requestAcessorias(baseUrl, apiToken, path, init);
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
      pickFirstString(record, [
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
      pickFirstNestedString(record, ["company.id", "empresa.id"]);
    if (!companyId) continue;

    if (seenIds.has(companyId)) continue;
    seenIds.add(companyId);

    const companyName =
      pickFirstString(record, [
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
        pickFirstString(record, [
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
      normalizeCnpj(pickFirstNestedString(record, ["document.number", "empresa.cnpj"]));

    const status =
      pickFirstString(record, ["status", "Status", "situacao", "company_status"]) ||
      pickFirstNestedString(record, ["situation.name", "situacao.nome"]);

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
    .select("role")
    .eq("user_id", callerUser.id);

  if (callerRolesError) {
    throw callerRolesError;
  }

  const callerRoles = (callerRoleRows || [])
    .map((row) => String(row.role || "").toLowerCase())
    .filter(Boolean);

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
    acessoriasApiToken,
    acessoriasApiBaseUrl,
  };
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
        title: `[Acessorias] ${input.obligationName}`,
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
    title: `[Acessorias] ${input.obligationName}`,
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

async function handleOverview(supabaseAdmin: ReturnType<typeof createClient>) {
  const [clientsResult, companiesResult, linksResult, obligationsResult, uploadsResult] = await Promise.all([
    supabaseAdmin
      .from("clients")
      .select("id, name, cnpj, status")
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
      .select("id, client_id, file_name, status, error_message, uploaded_at")
      .order("uploaded_at", { ascending: false })
      .limit(25),
  ]);

  if (clientsResult.error) throw clientsResult.error;
  if (companiesResult.error) throw companiesResult.error;
  if (linksResult.error) throw linksResult.error;
  if (obligationsResult.error) throw obligationsResult.error;
  if (uploadsResult.error) throw uploadsResult.error;

  const companies = companiesResult.data || [];
  const links = linksResult.data || [];
  const obligations = obligationsResult.data || [];
  const clients = clientsResult.data || [];
  const uploads = uploadsResult.data || [];

  const companyById = new Map(
    companies.map((company) => [company.acessorias_company_id, company]),
  );
  const linkByClient = new Map(links.map((link) => [link.client_id, link]));

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
    uploads,
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
      recent_uploads: uploads.length,
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
      sync_grow_clients: syncGrowClients,
      restrict_to_acessorias: syncGrowClients ? restrictToAcessorias : false,
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
    status: string | null;
  };

  type ClientLinkRow = {
    client_id: string;
    acessorias_company_id: string;
  };

  const [{ data: clients, error: clientsError }, { data: links, error: linksError }] = await Promise.all([
    supabaseAdmin
      .from("clients")
      .select("id, name, cnpj, status")
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

      if (resolvedClient) {
        const updates: {
          name?: string;
          cnpj?: string | null;
          status?: string;
        } = {};
        const currentName = asTrimmedString(resolvedClient.name) || "";
        const currentCnpj = normalizeCnpj(resolvedClient.cnpj);
        const currentStatus = asTrimmedString(resolvedClient.status) || "";

        if (company.company_name && currentName !== company.company_name) {
          updates.name = company.company_name;
        }
        if (company.cnpj && currentCnpj !== company.cnpj) {
          updates.cnpj = company.cnpj;
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
            status: mappedStatus,
            created_by: callerUserId,
          })
          .select("id, name, cnpj, status")
          .single();

        if (insertClientError) throw insertClientError;

        resolvedClient = insertedClient as ClientSyncRow;
        clientsById.set(resolvedClient.id, resolvedClient);
        clientsCreated += 1;
      }

      mirroredClientIds.add(resolvedClient.id);
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

    if (restrictToAcessorias) {
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
    sync_grow_clients: syncGrowClients,
    restrict_to_acessorias: syncGrowClients ? restrictToAcessorias : false,
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
  const shouldCreateTasks = asBoolean(body.create_tasks);
  const autoLinkedClients = await ensureAutomaticLinksByCnpjFromCache(supabaseAdmin, callerUserId);
  const requestedBatchSize =
    typeof body.batch_size === "number" ? body.batch_size : Number(asTrimmedString(body.batch_size) || "0");
  const requestedCursor =
    typeof body.cursor === "number" ? body.cursor : Number(asTrimmedString(body.cursor) || "0");
  const batchSize = clientIdFilter
    ? 1
    : Number.isFinite(requestedBatchSize) && requestedBatchSize > 0
      ? Math.min(50, Math.max(1, Math.trunc(requestedBatchSize)))
      : 10;
  const cursor = clientIdFilter
    ? 0
    : Number.isFinite(requestedCursor) && requestedCursor > 0
      ? Math.trunc(requestedCursor)
      : 0;

  let linksQuery = supabaseAdmin
    .from("client_acessorias_links")
    .select("client_id, acessorias_company_id", { count: "exact" })
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
  const companyIdentifierById = new Map<string, string>();
  for (const companyRow of companiesCache || []) {
    const identifier = normalizeCnpj(companyRow.cnpj) || companyRow.acessorias_company_id;
    if (!identifier) continue;
    companyIdentifierById.set(companyRow.acessorias_company_id, identifier);
  }

  const now = new Date();
  const defaultDateFrom = `${now.getUTCFullYear() - 1}-01-01`;
  const defaultDateTo = `${now.getUTCFullYear() + 1}-12-31`;
  let dateFrom = normalizeDate(body.date_from) || defaultDateFrom;
  let dateTo = normalizeDate(body.date_to) || defaultDateTo;
  if (dateFrom > dateTo) {
    const swap = dateFrom;
    dateFrom = dateTo;
    dateTo = swap;
  }

  const deliveriesPathTemplates = getPathCandidates("ACESSORIAS_DELIVERIES_PATHS", defaultDeliveriesPathCandidates);

  const obligationRows: Array<Record<string, unknown>> = [];
  const details: Array<Record<string, unknown>> = [];
  let createdTasks = 0;

  for (const link of links) {
    const companyIdentifier = companyIdentifierById.get(link.acessorias_company_id) || link.acessorias_company_id;
    const pathCandidates = deliveriesPathTemplates.map((template) => {
      const hasDateRange =
        template.toLowerCase().includes("dtinitial=") && template.toLowerCase().includes("dtfinal=");
      const templateWithDates = hasDateRange
        ? template
        : `${template}${template.includes("?") ? "&" : "?"}DtInitial={dateFrom}&DtFinal={dateTo}&Pagina=1`;
      return resolveTemplatePath(templateWithDates, {
        companyId: companyIdentifier,
        dateFrom,
        dateTo,
      });
    });

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
        company_identifier: companyIdentifier,
        synced: 0,
        error:
          error instanceof Error
            ? error.message
            : "Falha ao sincronizar obrigacoes para esta empresa",
      });
      continue;
    }

    const parsedObligations = parseObligations(deliveriesResponse.payload);
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

      if (shouldCreateTasks) {
        const taskId = await ensureKanbanTaskForObligation(
          supabaseAdmin,
          {
            clientId: link.client_id,
            clientName: clientsById.get(link.client_id) || "Cliente",
            obligationId: obligation.acessorias_obligation_id,
            obligationName: obligation.obligation_name,
            obligationPeriod: obligation.obligation_period,
            dueDate: obligation.due_date,
            status: obligation.status,
            protocol: obligation.protocol,
            notes: obligation.notes,
            payload: obligation.source_payload,
            createdBy: callerUserId,
          },
          { allowCreate: true },
        );
        if (taskId) createdTasks += 1;
      } else {
        await ensureKanbanTaskForObligation(
          supabaseAdmin,
          {
            clientId: link.client_id,
            clientName: clientsById.get(link.client_id) || "Cliente",
            obligationId: obligation.acessorias_obligation_id,
            obligationName: obligation.obligation_name,
            obligationPeriod: obligation.obligation_period,
            dueDate: obligation.due_date,
            status: obligation.status,
            protocol: obligation.protocol,
            notes: obligation.notes,
            payload: obligation.source_payload,
            createdBy: callerUserId,
          },
          { allowCreate: false },
        );
      }
    }

    details.push({
      client_id: link.client_id,
      acessorias_company_id: link.acessorias_company_id,
      company_identifier: companyIdentifier,
      synced: parsedObligations.length,
      endpoint_used: deliveriesResponse.path,
    });

    await supabaseAdmin
      .from("client_acessorias_links")
      .update({ last_synced_at: nowIso })
      .eq("client_id", link.client_id);
  }

  if (obligationRows.length > 0) {
    for (const rowsChunk of chunkArray(obligationRows, 400)) {
      const { error: obligationsUpsertError } = await supabaseAdmin
        .from("client_acessorias_obligations")
        .upsert(rowsChunk, {
          onConflict: "client_id,acessorias_obligation_id,obligation_period_key",
        });
      if (obligationsUpsertError) throw obligationsUpsertError;
    }
  }

  const processedInBatch = links.length;
  const nextCursor = clientIdFilter ? null : cursor + processedInBatch;
  const hasMore = !clientIdFilter && nextCursor < totalLinks;

  return {
    synced_obligations: obligationRows.length,
    clients_processed: links.length,
    created_tasks: createdTasks,
    details,
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
      "id, client_id, acessorias_company_id, acessorias_obligation_id, obligation_name, obligation_period, due_date, delivered_at, status, protocol, notes, last_synced_at",
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
  const createTask = asBoolean(body.create_task);
  const syncRemote = Object.prototype.hasOwnProperty.call(body, "sync_remote")
    ? asBoolean(body.sync_remote)
    : true;

  if (!clientId || !obligationName) {
    return jsonResponse({ error: "client_id e obligation_name sao obrigatorios" }, 400);
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
    .select("id, client_id, acessorias_obligation_id, obligation_name, obligation_period, due_date, status")
    .maybeSingle();
  if (upsertError) throw upsertError;

  let taskId: string | null = null;
  if (createTask) {
    taskId = await ensureKanbanTaskForObligation(supabaseAdmin, {
      clientId: client.id,
      clientName: client.name || "Cliente",
      obligationId: safeObligationId,
      obligationName,
      obligationPeriod,
      dueDate,
      status,
      protocol,
      notes,
      payload: {
        source: "manual",
      },
      createdBy: callerUserId,
    });
  }

  return jsonResponse({
    ok: true,
    obligation: upserted,
    kanban_task_id: taskId,
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
      "id, client_id, acessorias_company_id, acessorias_obligation_id, obligation_name, obligation_period, due_date, delivered_at, status, protocol, notes, source_payload",
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

  const nextValues = {
    obligation_name: providedName || existing.obligation_name,
    obligation_period: hasPeriod ? asTrimmedString(body.obligation_period) : existing.obligation_period,
    due_date: hasDueDate ? normalizeDate(body.due_date) : existing.due_date,
    status: hasStatus
      ? normalizeObligationStatus(asTrimmedString(body.status)) || null
      : normalizeObligationStatus(existing.status),
    protocol: hasProtocol ? asTrimmedString(body.protocol) : existing.protocol,
    notes: hasNotes ? asTrimmedString(body.notes) : existing.notes,
  };

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
      source_payload: sourcePayload,
      last_synced_at: nowIso,
    })
    .eq("id", obligationRowId)
    .select(
      "id, client_id, acessorias_company_id, acessorias_obligation_id, obligation_name, obligation_period, due_date, delivered_at, status, protocol, notes, last_synced_at",
    )
    .maybeSingle();
  if (updateError) throw updateError;

  if (updated) {
    await ensureKanbanTaskForObligation(
      supabaseAdmin,
      {
        clientId: existing.client_id,
        clientName: client?.name || "Cliente",
        obligationId: existing.acessorias_obligation_id,
        obligationName: nextValues.obligation_name,
        obligationPeriod: nextValues.obligation_period,
        dueDate: nextValues.due_date,
        status: nextValues.status,
        protocol: nextValues.protocol,
        notes: nextValues.notes,
        payload: sourcePayload as JsonRecord,
        createdBy: callerUserId,
      },
      { allowCreate: false },
    );
  }

  return jsonResponse({
    ok: true,
    obligation: updated,
    remote_sync: remoteSync,
  });
}

async function handleListUploads(
  supabaseAdmin: ReturnType<typeof createClient>,
  body: JsonRecord,
) {
  const clientId = asTrimmedString(body.client_id);
  let query = supabaseAdmin
    .from("client_acessorias_uploads")
    .select("id, client_id, acessorias_company_id, file_name, file_size, content_type, status, error_message, uploaded_by, uploaded_at")
    .order("uploaded_at", { ascending: false })
    .limit(100);

  if (clientId) query = query.eq("client_id", clientId);

  const { data, error } = await query;
  if (error) throw error;

  return { uploads: data || [] };
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

  return jsonResponse({
    ok: true,
    upload: uploadRow,
    endpoint_used: endpointUsed,
    response: responsePayload,
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
      acessoriasApiToken,
      acessoriasApiBaseUrl,
    } = context;

    const actionKey = normalizeToken(action);

    if (actionKey === "overview") {
      const data = await handleOverview(supabaseAdmin);
      return jsonResponse({
        ok: true,
        has_acessorias_configuration: Boolean(acessoriasApiToken),
        ...data,
      });
    }

    if (!acessoriasApiToken && actionKey !== "assign_obligation" && actionKey !== "update_obligation" && actionKey !== "list_obligations" && actionKey !== "list_uploads") {
      return jsonResponse(
        {
          error:
            "ACESSORIAS_API_TOKEN nao configurado. Defina o secret no projeto Supabase para usar sincronizacao/envio.",
        },
        400,
      );
    }

    if (actionKey === "sync_companies") {
      const data = await handleSyncCompanies(
        supabaseAdmin,
        acessoriasApiBaseUrl,
        acessoriasApiToken as string,
        callerUser.id,
        body,
      );
      return jsonResponse({ ok: true, ...data });
    }

    if (actionKey === "set_link" || actionKey === "remove_link") {
      return jsonResponse(
        { error: "Vinculo manual desativado. O cruzamento e automatico por CNPJ." },
        403,
      );
    }

    if (actionKey === "sync_obligations") {
      const data = await handleSyncObligations(
        supabaseAdmin,
        body,
        acessoriasApiBaseUrl,
        acessoriasApiToken as string,
        callerUser.id,
      );
      return jsonResponse({ ok: true, ...data });
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
