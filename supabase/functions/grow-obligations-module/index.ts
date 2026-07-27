import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendWhatsAppTextMessage } from "../_shared/ai/whatsapp.ts";
import { normalizePhoneDigits } from "../_shared/ai/utils.ts";

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

const templateManagerRoles = new Set(["admin", "director", "manager"]);

type JsonRecord = Record<string, unknown>;
type SupabaseAdmin = ReturnType<typeof createClient>;
type MatchStrategy =
  | "manual_instance"
  | "direct_expected_doc"
  | "alias_match"
  | "single_open_instance"
  | "manual_review";

type ExpectedDocumentDefinition = {
  document_type_key: string;
  label: string;
  aliases: string[];
  required: boolean;
  active: boolean;
};

type MatchCandidate = {
  template: TemplateRow;
  document: ExpectedDocumentDefinition;
};

type MatchResult = {
  resolvedInstanceId: string | null;
  suggestedTemplateId: string | null;
  documentTypeKey: string | null;
  strategy: MatchStrategy;
  score: number;
  reasons: string[];
  reviewRequired: boolean;
  documentDefinition: ExpectedDocumentDefinition | null;
  candidateInstanceIds: string[];
  detectedClientId?: string | null;
  detectedCnpj?: string | null;
  competenceDetected?: string | null;
  referenceFileId?: string | null;
  referenceMatchScore?: number;
  referenceMatchReasons?: string[];
  textExtractionStatus?: string;
  ocrStatus?: string;
  extractedTextPreview?: string | null;
  fingerprintPayload?: JsonRecord;
  autoLinkBlockReason?: string | null;
};

type ReferenceFileRow = {
  id: string;
  template_id: string;
  profile_id: string | null;
  document_type_key: string;
  file_name: string;
  storage_bucket: string;
  storage_path: string;
  content_type: string | null;
  file_size: number | null;
  is_active: boolean;
  source_kind: string;
  extracted_text: string | null;
  extracted_text_preview: string | null;
  text_extraction_status: string;
  ocr_status: string;
  fingerprint_version: number;
  fingerprint_payload: unknown;
  keywords: unknown;
  primary_cues: unknown;
  created_at: string;
};

type DocumentAnalysisPayload = {
  extracted_text: string | null;
  extracted_text_preview: string | null;
  detected_cnpj: string | null;
  competence_detected: string | null;
  text_extraction_status: string;
  ocr_status: string;
  fingerprint_payload: JsonRecord;
  keywords: string[];
  primary_cues: string[];
};

type TemplateRow = {
  id: string;
  organization_id?: string;
  code: string;
  name: string;
  sector: string;
  periodicity: string;
  competence_reference: string;
  technical_due_month_reference: string;
  due_day: number;
  yearly_due_month: number | null;
  legal_due_day: number | null;
  priority: string;
  expected_documents: unknown;
  is_active: boolean;
  generates_calendar: boolean;
  generates_kanban: boolean;
  requires_document: boolean;
  operational_notes: string | null;
  completion_email_enabled: boolean;
  completion_email_subject: string | null;
  completion_email_body: string | null;
  completion_whatsapp_enabled: boolean;
  completion_whatsapp_body: string | null;
  baseline_source?: string | null;
  catalog_review_status?: string | null;
};

type ClientDeliveryContext = {
  id: string;
  name: string;
  cnpj: string | null;
  sector: string;
  status: string;
  email: string | null;
  phone: string | null;
  contact: string | null;
  obligation_completion_whatsapp_enabled: boolean;
};

type ProfileRow = {
  id: string;
  organization_id?: string;
  client_id: string;
  template_id: string;
  source_kind?: string | null;
  source_load_id?: string | null;
  source_load_item_id?: string | null;
  applied_regime?: string | null;
  application_batch_id?: string | null;
  inactivation_reason?: string | null;
  sync_status?: string | null;
  conditional_review_reason?: string | null;
  conditional_skip_reason?: string | null;
  assigned_to: string | null;
  start_date: string;
  end_date: string | null;
  is_active: boolean;
  due_day_override: number | null;
  yearly_due_month_override: number | null;
  legal_due_day_override: number | null;
  expected_documents_override: unknown;
  notes: string | null;
  parameters: unknown;
};

type InstanceRow = {
  id: string;
  organization_id?: string;
  client_id: string;
  profile_id: string;
  template_id: string;
  competence_label: string;
  competence_date: string;
  competence_key: string;
  technical_due_date: string;
  legal_due_date: string | null;
  status: string;
  priority: string;
  current_assignee: string | null;
  completion_notes: string | null;
  document_required: boolean;
  protocol: string | null;
  protocol_issued_at: string | null;
  completed_by_inbox_item_id: string | null;
  processed_automatically: boolean;
  completed_at: string | null;
  updated_at: string;
  created_at: string;
};

type RegimeLoadRow = {
  id: string;
  organization_id: string;
  tax_regime_code: string;
  name: string;
  status: string;
};

type RegimeLoadItemRow = {
  id: string;
  organization_id: string;
  load_id: string;
  template_id: string;
  applicability: string;
  condition_key: string | null;
  default_due_day_override: number | null;
  is_active: boolean;
  sort_order: number;
};

type DefaultEvidence = Record<string, boolean | null | undefined>;

type DefaultApplicationSummary = {
  created: number;
  kept: number;
  reactivated: number;
  skipped: number;
  blocked: number;
  duplicate_risk: number;
  conditional_skipped: number;
  inactivated_prior_regime: number;
  inactivated: number;
  unsupported_clients?: number;
  processed_clients?: number;
  add: number;
  keep: number;
};

function resolveRowOrganizationId(...rows: Array<{ organization_id?: string | null } | null | undefined>) {
  for (const row of rows) {
    const organizationId = asTrimmedString(row?.organization_id);
    if (organizationId) return organizationId;
  }
  return "";
}

type IngestionJobRow = {
  id: string;
  organization_id?: string;
  source_kind: string;
  status: string;
  classification_status: string;
  application_status: string;
  communication_status: string;
  publication_status: string;
  client_id: string | null;
  detected_client_id: string | null;
  template_id: string | null;
  instance_id: string | null;
  inbox_item_id: string | null;
  file_name: string;
  storage_bucket: string;
  storage_path: string;
  file_hash: string | null;
  file_size: number | null;
  protocol_number: string | null;
  protocol_issued_at: string | null;
  robot_origin_path: string | null;
  robot_machine_id: string | null;
  review_required: boolean;
  attempts: number;
  started_at: string | null;
  completed_at: string | null;
  last_error: string | null;
  metadata: unknown;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

type InboxRow = {
  id: string;
  organization_id?: string;
  ingestion_job_id: string | null;
  created_by?: string | null;
  client_id: string | null;
  suggested_client_id: string | null;
  detected_client_id: string | null;
  suggested_template_id: string | null;
  suggested_instance_id: string | null;
  linked_instance_id: string | null;
  document_type_key: string | null;
  file_name: string;
  storage_bucket: string;
  storage_path: string;
  source_kind: string;
  file_hash: string | null;
  content_type: string | null;
  file_size: number | null;
  suggested_competence_label: string | null;
  detected_cnpj: string | null;
  competence_detected: string | null;
  identification_confidence: number;
  matched_by: MatchStrategy | null;
  match_score: number;
  match_reasons: unknown;
  reference_file_id: string | null;
  reference_match_score: number;
  reference_match_reasons: unknown;
  review_required: boolean;
  status: string;
  blocking_reason: string | null;
  text_extraction_status: string;
  ocr_status: string;
  extracted_text_preview: string | null;
  fingerprint_payload: unknown;
  auto_link_block_reason: string | null;
  processing_status: string;
  processing_attempts: number;
  processing_started_at: string | null;
  processing_completed_at: string | null;
  last_processing_error: string | null;
  execution_status: string;
  execution_notes: string | null;
  archive_path: string | null;
  notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  classification_status: string;
  application_status: string;
  communication_status: string;
  publication_status: string;
  robot_origin_path: string | null;
  robot_machine_id: string | null;
  protocol_number: string | null;
  protocol_issued_at: string | null;
  processed_automatically: boolean;
  created_at: string;
  updated_at: string;
};

type DeliveryAttachment = {
  id: string;
  filename: string;
  content: string;
  content_type?: string | null;
  storage_bucket: string;
  storage_path: string;
};

type DeliveryPreparation = {
  organizationId: string;
  instance: InstanceRow;
  template: TemplateRow;
  client: ClientDeliveryContext;
  inboxItem: InboxRow | null;
  files: Array<JsonRecord>;
  sender: {
    verifiedFrom: string;
    replyTo: string;
    actorEmail: string;
    displaySenderContext: string;
  };
  recipientEmail: string;
  subject: string;
  textBody: string;
  htmlBody: string;
  warnings: string[];
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

function asUuid(value: unknown): string | null {
  const text = asTrimmedString(value);
  return text && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text)
    ? text
    : null;
}

function normalizeEmail(value: unknown): string | null {
  const email = asTrimmedString(value)?.toLowerCase();
  if (!email) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

function formatEmailAddress(email: string, name?: string | null) {
  const safeEmail = normalizeEmail(email);
  if (!safeEmail) return null;
  const safeName = asTrimmedString(name)?.replace(/[<>"\r\n]/g, " ").replace(/\s+/g, " ").trim();
  return safeName ? `${safeName} <${safeEmail}>` : safeEmail;
}

function getEmailDomain(email: string | null) {
  const normalized = normalizeEmail(email);
  return normalized?.split("@")[1] || null;
}

function normalizeSourceKind(value: unknown, fallback = "web_manual") {
  const normalized = asTrimmedString(value);
  if (normalized === "local_robot" || normalized === "web_manual" || normalized === "api") {
    return normalized;
  }
  return fallback;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => asTrimmedString(item))
    .filter((item): item is string => Boolean(item));
}

function asExpectedDocuments(value: unknown): ExpectedDocumentDefinition[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (typeof item === "string") {
        const label = asTrimmedString(item);
        if (!label) return null;
        return {
          document_type_key: normalizeToken(label),
          label,
          aliases: [],
          required: true,
          active: true,
        } satisfies ExpectedDocumentDefinition;
      }

      const record = asRecord(item);
      if (!record) return null;
      const label = asTrimmedString(record.label) || asTrimmedString(record.document_type_key) || "Documento";
      const key = asTrimmedString(record.document_type_key) || normalizeToken(label);
      if (!key) return null;

      return {
        document_type_key: key,
        label,
        aliases: asStringArray(record.aliases),
        required: asBoolean(record.required, true),
        active: asBoolean(record.active, true),
      } satisfies ExpectedDocumentDefinition;
    })
    .filter((item): item is ExpectedDocumentDefinition => Boolean(item));
}

function asBoolean(value: unknown, fallback = false) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value > 0;
  const token = String(value || "").trim().toLowerCase();
  if (["1", "true", "sim", "yes"].includes(token)) return true;
  if (["0", "false", "nao", "não", "no"].includes(token)) return false;
  return fallback;
}

function normalizeMonthReference(value: unknown, fallback: "vigente" | "anterior" = "vigente") {
  const token = asTrimmedString(value);
  if (token === "anterior") return "anterior";
  if (token === "vigente") return "vigente";
  return fallback;
}

function asInteger(value: unknown, fallback: number | null = null) {
  if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value);
  const normalized = asTrimmedString(value);
  if (normalized === null) return fallback;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;
}

function normalizeCnpj(value: string | null | undefined) {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  return digits.length === 14 ? digits : null;
}

function normalizeToken(value: unknown) {
  const normalized = asTrimmedString(value);
  if (!normalized) return "";
  return normalized
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizeTemplateCode(value: string) {
  return normalizeToken(value).replace(/_+/g, "-");
}

function toArchiveSegment(value: string | null | undefined, fallback: string) {
  const token = normalizeToken(value || "").replace(/_+/g, "-");
  return token || fallback;
}

function combineDddAndPhone(ddd: string | null | undefined, phone: string | null | undefined) {
  const dddDigits = normalizePhoneDigits(ddd);
  const phoneDigits = normalizePhoneDigits(phone);
  if (!phoneDigits) return null;
  return dddDigits ? `${dddDigits}${phoneDigits}` : phoneDigits;
}

function asJsonRecord(value: unknown) {
  return asRecord(value) || {};
}

function parseDocumentAnalysisPayload(value: unknown): DocumentAnalysisPayload {
  const record = asRecord(value) || {};
  return {
    extracted_text: asTrimmedString(record.extracted_text),
    extracted_text_preview: asTrimmedString(record.extracted_text_preview),
    detected_cnpj: normalizeCnpj(asTrimmedString(record.detected_cnpj)),
    competence_detected: asTrimmedString(record.competence_detected),
    text_extraction_status: asTrimmedString(record.text_extraction_status) || "pending",
    ocr_status: asTrimmedString(record.ocr_status) || "pending",
    fingerprint_payload: asJsonRecord(record.fingerprint_payload),
    keywords: asStringArray(record.keywords),
    primary_cues: asStringArray(record.primary_cues),
  };
}

function buildDocumentLookupKey(templateId: string, documentTypeKey: string) {
  return `${templateId}::${documentTypeKey}`;
}

function buildCompetenceCandidates(value: string | null) {
  const token = normalizeToken(value || "");
  if (!token) return [];

  const normalized = token.replace(/_/g, "-");
  const compactMatch = token.match(/(\d{1,2})_(\d{4})/);
  if (compactMatch) {
    const month = compactMatch[1].padStart(2, "0");
    const year = compactMatch[2];
    return Array.from(new Set([
      `${month}/${year}`,
      `${year}-${month}`,
      normalized,
    ]));
  }

  return Array.from(new Set([normalized]));
}

function toMonthWindowStart(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function toMonthWindowEnd(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));
}

function isInstanceEligibleWithoutExactCompetence(instance: InstanceRow, windowStart: Date, windowEnd: Date) {
  if (instance.document_required !== true) return false;
  if (instance.status === "cancelada" || instance.status === "concluida") return false;
  const competenceDate = new Date(`${instance.competence_date}T00:00:00.000Z`);
  return competenceDate >= windowStart && competenceDate <= windowEnd;
}

function isInstanceEligibleWithExactCompetence(instance: InstanceRow) {
  return instance.document_required === true && instance.status !== "cancelada";
}

function extractBearerToken(req: Request) {
  const authorization = req.headers.get("authorization");
  if (!authorization?.toLowerCase().startsWith("bearer ")) return null;
  const token = authorization.slice(7).trim();
  return token || null;
}

function toIsoDate(date: Date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function monthLabel(date: Date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${month}/${year}`;
}

function competenceKey(date: Date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function currentCompetenceGenerationWindow(now = new Date()) {
  const targetCompetenceDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const cursorStart = new Date(targetCompetenceDate);
  const cursorEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

  return {
    cursorStart,
    cursorEnd,
    targetCompetenceKey: competenceKey(targetCompetenceDate),
  };
}

function clampDay(day: number, year: number, monthIndex: number) {
  const lastDay = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  return Math.max(1, Math.min(day, lastDay));
}

function computeCompetenceDate(
  periodicity: string,
  cursor: Date,
  competenceReference: string,
  yearlyDueMonth?: number | null,
) {
  let baseDate: Date;

  if (periodicity === "yearly") {
    const dueMonthIndex = Math.max(0, Math.min(11, (yearlyDueMonth || 1) - 1));
    baseDate = new Date(Date.UTC(cursor.getUTCFullYear(), dueMonthIndex, 1));
  } else {
    baseDate = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), 1));
  }

  if (competenceReference === "anterior") {
    baseDate.setUTCMonth(baseDate.getUTCMonth() - 1);
  }

  return baseDate;
}

function computeDueDate(
  competenceDate: Date,
  dueDay: number,
  dueMonthReference: "vigente" | "anterior" = "vigente",
) {
  const dueBaseDate = new Date(Date.UTC(competenceDate.getUTCFullYear(), competenceDate.getUTCMonth(), 1));
  if (dueMonthReference === "anterior") {
    dueBaseDate.setUTCMonth(dueBaseDate.getUTCMonth() - 1);
  }
  const year = dueBaseDate.getUTCFullYear();
  const monthIndex = dueBaseDate.getUTCMonth();
  const day = clampDay(dueDay, year, monthIndex);
  return new Date(Date.UTC(year, monthIndex, day));
}

async function buildAuthContext(req: Request) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    throw new Error("Missing Supabase environment configuration");
  }

  const token = extractBearerToken(req);
  if (!token) {
    return { error: jsonResponse({ error: "Authorization token is required" }, 401) };
  }

  const supabaseUser = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

  const {
    data: { user },
    error: userError,
  } = await supabaseUser.auth.getUser();

  if (userError || !user) {
    return { error: jsonResponse({ error: "Invalid or expired session" }, 401) };
  }

  const [legacyRolesResult, accessRowsResult] = await Promise.all([
    supabaseAdmin
      .from("user_roles")
      .select("role, organization_id")
      .eq("user_id", user.id),
    supabaseAdmin
      .from("organization_user_access")
      .select("primary_role, organization_id, status")
      .eq("user_id", user.id),
  ]);

  if (legacyRolesResult.error) throw legacyRolesResult.error;
  if (accessRowsResult.error) throw accessRowsResult.error;

  const legacyRoleRows = legacyRolesResult.data || [];
  const accessRows = (accessRowsResult.data || []).filter(
    (row) => asTrimmedString((row as JsonRecord).status) !== "inactive",
  );
  const accessRoles = accessRows
    .map((row) => {
      const primaryRole = asTrimmedString((row as JsonRecord).primary_role);
      if (primaryRole === "colaborador") return "employee";
      if (primaryRole === "cliente") return "client";
      return primaryRole;
    })
    .filter((role): role is string => Boolean(role));
  const roles = Array.from(
    new Set([
      ...legacyRoleRows
        .map((row) => asTrimmedString((row as JsonRecord).role))
        .filter((role): role is string => Boolean(role)),
      ...accessRoles,
    ]),
  );
  const organizationIds = Array.from(
    new Set(
      [...legacyRoleRows, ...accessRows]
        .map((row) => asTrimmedString((row as JsonRecord).organization_id))
        .filter((organizationId): organizationId is string => Boolean(organizationId)),
    ),
  );
  const internal = roles.some((role) => internalRoles.has(role));

  if (!internal) {
    return { error: jsonResponse({ error: "Only internal users can access this module" }, 403) };
  }

  return { supabaseAdmin, user, roles, organizationIds };
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
  supabaseAdmin: SupabaseAdmin,
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

async function loadClientsMap(supabaseAdmin: SupabaseAdmin, organizationId?: string) {
  let query = supabaseAdmin
    .from("clients")
    .select("id, organization_id, name, cnpj, regime, sector, status, email, phone, contact, obligation_completion_whatsapp_enabled")
    .order("name");

  if (organizationId) query = query.eq("organization_id", organizationId);

  const { data, error } = await query;

  if (error) throw error;

  return new Map(
    (data || []).map((row) => [
      String((row as JsonRecord).id),
      {
        id: String((row as JsonRecord).id),
        organization_id: asTrimmedString((row as JsonRecord).organization_id),
        name: String((row as JsonRecord).name || ""),
        cnpj: normalizeCnpj(asTrimmedString((row as JsonRecord).cnpj)),
        regime: asTrimmedString((row as JsonRecord).regime),
        tax_regime_code: normalizeRegimeCode((row as JsonRecord).regime),
        sector: asTrimmedString((row as JsonRecord).sector) || "Geral",
        status: asTrimmedString((row as JsonRecord).status) || "Ativo",
        email: normalizeEmail((row as JsonRecord).email),
        phone: asTrimmedString((row as JsonRecord).phone),
        contact: asTrimmedString((row as JsonRecord).contact),
        obligation_completion_whatsapp_enabled: asBoolean(
          (row as JsonRecord).obligation_completion_whatsapp_enabled,
          false,
        ),
      },
    ]),
  );
}

function filterByOrganization<T extends JsonRecord>(rows: T[], organizationId: string) {
  return rows.filter((row) => !row.organization_id || String(row.organization_id) === organizationId);
}

function buildEmptyOverview(warnings: string[] = []) {
  return {
    ok: true,
    summary: {
      templates_total: 0,
      templates_active: 0,
      active_profiles: 0,
      pending_instances: 0,
      overdue_instances: 0,
      waiting_documents: 0,
      done_instances: 0,
      inbox_pending: 0,
      inbox_processing: 0,
      inbox_failed: 0,
      inbox_applied: 0,
      robot_received_today: 0,
      robot_completed_today: 0,
      robot_review_required: 0,
      robot_failed_total: 0,
    },
    clients: [],
    templates: [],
    profiles: [],
    instances: [],
    documents: [],
    ingestion_jobs: [],
    delivery_attempts: [],
    warnings,
  };
}

async function loadTemplatesMap(supabaseAdmin: SupabaseAdmin, organizationId?: string) {
  let query = supabaseAdmin
    .from("obligation_templates")
    .select("*")
    .order("name");

  if (organizationId) query = query.eq("organization_id", organizationId);

  const { data, error } = await query;
  if (error) throw error;
  return new Map((data || []).map((row) => [String((row as JsonRecord).id), row as TemplateRow]));
}

async function loadProfilesMap(supabaseAdmin: SupabaseAdmin, organizationId?: string) {
  let query = supabaseAdmin
    .from("client_obligation_profiles")
    .select("*")
    .order("created_at", { ascending: false });

  if (organizationId) query = query.eq("organization_id", organizationId);

  const { data, error } = await query;
  if (error) throw error;
  return new Map((data || []).map((row) => [String((row as JsonRecord).id), row as ProfileRow]));
}

async function loadReferenceFilesMap(
  supabaseAdmin: SupabaseAdmin,
  organizationId?: string,
  options: { includeAnalysisPayload?: boolean } = {},
) {
  const selectColumns = options.includeAnalysisPayload
    ? "*"
    : [
        "id",
        "organization_id",
        "template_id",
        "profile_id",
        "document_type_key",
        "file_name",
        "storage_bucket",
        "storage_path",
        "content_type",
        "file_size",
        "is_active",
        "source_kind",
        "extracted_text_preview",
        "text_extraction_status",
        "ocr_status",
        "fingerprint_version",
        "keywords",
        "primary_cues",
        "created_at",
      ].join(", ");
  let query = supabaseAdmin
    .from("expected_document_reference_files")
    .select(selectColumns)
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (organizationId) query = query.eq("organization_id", organizationId);

  const { data, error } = await query;
  if (error) throw error;

  const rows = (data || []) as ReferenceFileRow[];
  const byTemplateDocument = new Map<string, ReferenceFileRow[]>();
  const byId = new Map<string, ReferenceFileRow>();

  for (const row of rows) {
    byId.set(row.id, row);
    const key = `${row.template_id}::${row.document_type_key}`;
    const current = byTemplateDocument.get(key) || [];
    current.push(row);
    byTemplateDocument.set(key, current);
  }

  return { byTemplateDocument, byId, rows };
}

async function loadIngestionJobs(supabaseAdmin: SupabaseAdmin, organizationId?: string) {
  let query = supabaseAdmin
    .from("document_ingestion_jobs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(120);

  if (organizationId) query = query.eq("organization_id", organizationId);

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as IngestionJobRow[];
}

function enrichExpectedDocuments(
  template: TemplateRow,
  referenceFilesMap: Map<string, ReferenceFileRow[]>,
) {
  return asExpectedDocuments(template.expected_documents).map((document) => {
    const key = `${template.id}::${document.document_type_key}`;
    const references = (referenceFilesMap.get(key) || []).map((reference) => ({
      ...reference,
      fingerprint_payload: asJsonRecord(reference.fingerprint_payload),
      keywords: asStringArray(reference.keywords),
      primary_cues: asStringArray(reference.primary_cues),
    }));

    return {
      ...document,
      reference_files_count: references.length,
      has_active_reference: references.length > 0,
      reference_files: references,
    };
  });
}

function resolveExpectedDocument(
  template: TemplateRow | null | undefined,
  documentTypeKey: string | null | undefined,
) {
  if (!template || !documentTypeKey) return null;
  return asExpectedDocuments(template.expected_documents).find(
    (item) => item.document_type_key === documentTypeKey,
  ) || null;
}

async function loadInstancesForClient(supabaseAdmin: SupabaseAdmin, clientId: string) {
  const { data, error } = await supabaseAdmin
    .from("obligation_instances")
    .select("*")
    .eq("client_id", clientId)
    .order("technical_due_date", { ascending: true });

  if (error) throw error;
  return (data || []) as InstanceRow[];
}

function buildClientDocumentCandidates(
  clientId: string,
  templatesMap: Map<string, TemplateRow>,
  profiles: ProfileRow[],
) {
  const matches: MatchCandidate[] = [];

  for (const profile of profiles) {
    if (profile.client_id !== clientId || !profile.is_active) continue;
    const template = templatesMap.get(profile.template_id);
    if (!template || !template.is_active) continue;

    for (const document of asExpectedDocuments(template.expected_documents).filter((item) => item.active)) {
      matches.push({
        template,
        document,
      });
    }
  }

  return matches;
}

function matchDocumentsByAlias(
  fileName: string | null,
  clientDocuments: MatchCandidate[],
) {
  if (!fileName) return [];
  const normalizedFileName = normalizeToken(fileName);
  if (!normalizedFileName) return [];

  return clientDocuments.filter(({ document }) => {
    const aliasTokens = [document.label, ...document.aliases]
      .map((value) => normalizeToken(value))
      .filter(Boolean);

    return aliasTokens.some((alias) => normalizedFileName.includes(alias));
  });
}

function buildEligibleInstanceCandidates(
  instances: InstanceRow[],
  templatesMap: Map<string, TemplateRow>,
  profilesMap: Map<string, ProfileRow>,
  {
    clientId,
    exactCompetence,
    templateIds,
  }: {
    clientId: string;
    exactCompetence: string | null;
    templateIds?: Set<string>;
  },
) {
  const competenceCandidates = buildCompetenceCandidates(exactCompetence);
  const now = new Date();
  const windowStart = toMonthWindowStart(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)));
  const windowEnd = toMonthWindowEnd(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 2, 1)));

  return instances.filter((instance) => {
    if (instance.client_id !== clientId) return false;
    if (templateIds && !templateIds.has(instance.template_id)) return false;

    if (competenceCandidates.length > 0) {
      const instanceCandidates = new Set([
        ...buildCompetenceCandidates(instance.competence_label),
        ...buildCompetenceCandidates(instance.competence_key),
      ]);

      return isInstanceEligibleWithExactCompetence(instance)
        && competenceCandidates.some((item) => instanceCandidates.has(item));
    }

    return isInstanceEligibleWithoutExactCompetence(instance, windowStart, windowEnd);
  }).map((instance) => ({
    instance,
    template: templatesMap.get(instance.template_id) || null,
    profile: profilesMap.get(instance.profile_id) || null,
  })).filter((item): item is { instance: InstanceRow; template: TemplateRow; profile: ProfileRow | null } => Boolean(item.template));
}

async function resolveDocumentMatch(
  supabaseAdmin: SupabaseAdmin,
  payload: {
    clientId: string | null;
    instanceId: string | null;
    templateId: string | null;
    documentTypeKey: string | null;
    suggestedCompetenceLabel: string | null;
    fileName: string | null;
  },
) {
  const { clientId, instanceId, templateId, documentTypeKey, suggestedCompetenceLabel, fileName } = payload;
  const emptyResult: MatchResult = {
    resolvedInstanceId: null,
    suggestedTemplateId: templateId,
    documentTypeKey,
    strategy: "manual_review",
    score: 0.45,
    reasons: ["Aguardando validação humana para vincular o arquivo."],
    reviewRequired: true,
    documentDefinition: null,
    candidateInstanceIds: [],
  };

  if (!clientId && !instanceId) {
    return emptyResult;
  }

  const templatesMap = await loadTemplatesMap(supabaseAdmin);
  const profilesMap = await loadProfilesMap(supabaseAdmin);
  const instances = clientId ? await loadInstancesForClient(supabaseAdmin, clientId) : [];

  if (instanceId) {
    const instance = instances.find((item) => item.id === instanceId) || null;
    const template = (instance && templatesMap.get(instance.template_id)) || (templateId ? templatesMap.get(templateId) : null) || null;
    return {
      resolvedInstanceId: instanceId,
      suggestedTemplateId: template?.id || templateId,
      documentTypeKey,
      strategy: "manual_instance",
      score: 1,
      reasons: ["Instância definida manualmente pelo usuário."],
      reviewRequired: false,
      documentDefinition: resolveExpectedDocument(template, documentTypeKey),
      candidateInstanceIds: instance ? [instance.id] : [],
    };
  }

  if (!clientId) {
    return emptyResult;
  }

  const clientProfiles = Array.from(profilesMap.values()).filter((profile) => profile.client_id === clientId && profile.is_active);
  const clientDocumentDefs = buildClientDocumentCandidates(clientId, templatesMap, clientProfiles);

  const targetDocumentMatches = documentTypeKey
    ? clientDocumentDefs.filter(({ template, document }) =>
        document.document_type_key === documentTypeKey && (!templateId || template.id === templateId),
      )
    : [];

  if (targetDocumentMatches.length > 0) {
    const templateIds = new Set(targetDocumentMatches.map((item) => item.template.id));
    const exactCandidates = buildEligibleInstanceCandidates(instances, templatesMap, profilesMap, {
      clientId,
      exactCompetence: suggestedCompetenceLabel,
      templateIds,
    });

    if (suggestedCompetenceLabel && exactCandidates.length === 1) {
      return {
        resolvedInstanceId: exactCandidates[0].instance.id,
        suggestedTemplateId: exactCandidates[0].template.id,
        documentTypeKey,
        strategy: "direct_expected_doc",
        score: 0.95,
        reasons: [
          "Documento esperado informado pelo usuário.",
          `Competência compatível: ${exactCandidates[0].instance.competence_label}.`,
        ],
        reviewRequired: false,
        documentDefinition: resolveExpectedDocument(exactCandidates[0].template, documentTypeKey),
        candidateInstanceIds: exactCandidates.map((item) => item.instance.id),
      };
    }

    if (!suggestedCompetenceLabel) {
      const openCandidates = buildEligibleInstanceCandidates(instances, templatesMap, profilesMap, {
        clientId,
        exactCompetence: null,
        templateIds,
      });

      if (openCandidates.length === 1) {
        return {
          resolvedInstanceId: openCandidates[0].instance.id,
          suggestedTemplateId: openCandidates[0].template.id,
          documentTypeKey,
          strategy: "single_open_instance",
          score: 0.75,
          reasons: ["Documento esperado informado e apenas uma instância elegível aberta encontrada."],
          reviewRequired: true,
          documentDefinition: resolveExpectedDocument(openCandidates[0].template, documentTypeKey),
          candidateInstanceIds: openCandidates.map((item) => item.instance.id),
        };
      }
    }
  }

  const aliasDocumentMatches = matchDocumentsByAlias(fileName, clientDocumentDefs).filter(({ template }) => !templateId || template.id === templateId);
  if (aliasDocumentMatches.length > 0 && suggestedCompetenceLabel) {
    const templateIds = new Set(aliasDocumentMatches.map((item) => item.template.id));
    const exactCandidates = buildEligibleInstanceCandidates(instances, templatesMap, profilesMap, {
      clientId,
      exactCompetence: suggestedCompetenceLabel,
      templateIds,
    });

    if (exactCandidates.length === 1) {
      const aliasDefinition = aliasDocumentMatches.find((item) => item.template.id === exactCandidates[0].template.id)?.document || aliasDocumentMatches[0].document;
      return {
        resolvedInstanceId: exactCandidates[0].instance.id,
        suggestedTemplateId: exactCandidates[0].template.id,
        documentTypeKey: aliasDefinition.document_type_key,
        strategy: "alias_match",
        score: 0.9,
        reasons: [
          "Documento identificado pelos apelidos no nome do arquivo.",
          `Competência compatível: ${exactCandidates[0].instance.competence_label}.`,
        ],
        reviewRequired: false,
        documentDefinition: aliasDefinition,
        candidateInstanceIds: exactCandidates.map((item) => item.instance.id),
      };
    }
  }

  const candidateInstanceIds = buildEligibleInstanceCandidates(instances, templatesMap, profilesMap, {
    clientId,
    exactCompetence: suggestedCompetenceLabel,
    templateIds: templateId ? new Set([templateId]) : undefined,
  }).map((item) => item.instance.id);

  return {
    ...emptyResult,
    suggestedTemplateId: templateId,
    documentTypeKey,
    candidateInstanceIds,
    documentDefinition: templateId ? resolveExpectedDocument(templatesMap.get(templateId) || null, documentTypeKey) : null,
    reasons: candidateInstanceIds.length > 1
      ? ["Mais de uma instância elegível encontrada. Revisão humana necessária."]
      : emptyResult.reasons,
  };
}

function overlapRatio(source: string[], target: string[]) {
  if (source.length === 0 || target.length === 0) return 0;
  const sourceSet = new Set(source.map((item) => normalizeToken(item)).filter(Boolean));
  const targetSet = new Set(target.map((item) => normalizeToken(item)).filter(Boolean));
  if (sourceSet.size === 0 || targetSet.size === 0) return 0;

  let matches = 0;
  for (const token of sourceSet) {
    if (targetSet.has(token)) matches += 1;
  }

  return matches / Math.max(targetSet.size, sourceSet.size);
}

function buildReferenceDocumentCandidates(
  clientId: string,
  templatesMap: Map<string, TemplateRow>,
  profiles: ProfileRow[],
  referenceFilesMap: Map<string, ReferenceFileRow[]>,
) {
  const matches: Array<MatchCandidate & { reference: ReferenceFileRow }> = [];

  for (const profile of profiles) {
    if (profile.client_id !== clientId || !profile.is_active) continue;
    const template = templatesMap.get(profile.template_id);
    if (!template || !template.is_active) continue;

    for (const document of asExpectedDocuments(template.expected_documents).filter((item) => item.active)) {
      const key = `${template.id}::${document.document_type_key}`;
      for (const reference of referenceFilesMap.get(key) || []) {
        matches.push({ template, document, reference });
      }
    }
  }

  return matches;
}

async function resolveDocumentReferenceMatch(
  supabaseAdmin: SupabaseAdmin,
  payload: {
    clientId: string | null;
    instanceId: string | null;
    templateId: string | null;
    documentTypeKey: string | null;
    suggestedCompetenceLabel: string | null;
    fileName: string | null;
    analysis: DocumentAnalysisPayload;
  },
) {
  const { clientId, instanceId, templateId, documentTypeKey, suggestedCompetenceLabel, fileName, analysis } = payload;
  const emptyResult: MatchResult = {
    resolvedInstanceId: null,
    suggestedTemplateId: templateId,
    documentTypeKey,
    strategy: "manual_review",
    score: 0.35,
    reasons: ["Aguardando validacao humana para vincular o arquivo."],
    reviewRequired: true,
    documentDefinition: null,
    candidateInstanceIds: [],
    detectedClientId: clientId,
    detectedCnpj: analysis.detected_cnpj,
    competenceDetected: analysis.competence_detected,
    referenceFileId: null,
    referenceMatchScore: 0,
    referenceMatchReasons: [],
    textExtractionStatus: analysis.text_extraction_status,
    ocrStatus: analysis.ocr_status,
    extractedTextPreview: analysis.extracted_text_preview,
    fingerprintPayload: analysis.fingerprint_payload,
    autoLinkBlockReason: "Candidato insuficiente para auto-vinculo.",
  };

  const templatesMap = await loadTemplatesMap(supabaseAdmin);
  const profilesMap = await loadProfilesMap(supabaseAdmin);
  const clientsMap = await loadClientsMap(supabaseAdmin);
  const referenceFiles = await loadReferenceFilesMap(supabaseAdmin);

  const detectedClientByCnpj = analysis.detected_cnpj
    ? Array.from(clientsMap.values()).find((client) => normalizeCnpj(client.cnpj) === analysis.detected_cnpj) || null
    : null;

  const effectiveClientId = detectedClientByCnpj?.id || clientId || null;
  const effectiveCompetence = analysis.competence_detected || suggestedCompetenceLabel || null;

  if (instanceId && effectiveClientId) {
    const instances = await loadInstancesForClient(supabaseAdmin, effectiveClientId);
    const instance = instances.find((item) => item.id === instanceId) || null;
    const template = (instance && templatesMap.get(instance.template_id)) || (templateId ? templatesMap.get(templateId) : null) || null;
    return {
      ...emptyResult,
      resolvedInstanceId: instanceId,
      suggestedTemplateId: template?.id || templateId,
      documentTypeKey,
      strategy: "manual_instance",
      score: 1,
      reasons: ["Instancia definida manualmente pelo usuario."],
      reviewRequired: false,
      documentDefinition: resolveExpectedDocument(template, documentTypeKey),
      candidateInstanceIds: instance ? [instance.id] : [],
      detectedClientId: effectiveClientId,
      autoLinkBlockReason: null,
    };
  }

  if (!effectiveClientId) {
    return {
      ...emptyResult,
      reasons: analysis.detected_cnpj
        ? ["CNPJ detectado nao corresponde a nenhum cliente da Grow."]
        : ["Nao foi possivel detectar CNPJ valido no documento."],
      autoLinkBlockReason: "CNPJ obrigatorio para auto-vinculo.",
    };
  }

  const instances = await loadInstancesForClient(supabaseAdmin, effectiveClientId);
  const clientProfiles = Array.from(profilesMap.values()).filter((profile) => profile.client_id === effectiveClientId && profile.is_active);
  const candidates = buildReferenceDocumentCandidates(effectiveClientId, templatesMap, clientProfiles, referenceFiles.byTemplateDocument)
    .filter((candidate) => (!templateId || candidate.template.id === templateId) && (!documentTypeKey || candidate.document.document_type_key === documentTypeKey));

  if (candidates.length === 0) {
    const fallbackMatch = await resolveDocumentMatch(supabaseAdmin, {
      clientId: effectiveClientId,
      instanceId,
      templateId,
      documentTypeKey,
      suggestedCompetenceLabel: effectiveCompetence,
      fileName,
    });
    if (fallbackMatch.resolvedInstanceId || fallbackMatch.candidateInstanceIds.length > 0 || fallbackMatch.documentDefinition) {
      return {
        ...emptyResult,
        ...fallbackMatch,
        score: Math.max(fallbackMatch.score, fallbackMatch.reviewRequired ? 0.65 : 0.85),
        reasons: [
          detectedClientByCnpj
            ? `Cliente identificado por CNPJ: ${detectedClientByCnpj.name}.`
            : "Cliente selecionado manualmente.",
          ...fallbackMatch.reasons,
        ],
        detectedClientId: effectiveClientId,
        detectedCnpj: analysis.detected_cnpj,
        competenceDetected: effectiveCompetence,
        textExtractionStatus: analysis.text_extraction_status,
        ocrStatus: analysis.ocr_status,
        extractedTextPreview: analysis.extracted_text_preview,
        fingerprintPayload: analysis.fingerprint_payload,
        autoLinkBlockReason: fallbackMatch.reviewRequired
          ? "Roteamento por CNPJ/competencia encontrado, mas exige revisao manual por falta de documento modelo ativo."
          : null,
      };
    }

    return {
      ...emptyResult,
      detectedClientId: effectiveClientId,
      reasons: [
        detectedClientByCnpj
          ? `Cliente identificado por CNPJ: ${detectedClientByCnpj.name}.`
          : "Cliente selecionado manualmente.",
        "Nenhuma obrigacao ativa elegivel foi encontrada para este arquivo e competencia.",
      ],
      autoLinkBlockReason: "Cadastre/vincule a obrigacao ao cliente ou selecione a instancia manualmente.",
    };
  }

  const inputTokens = analysis.keywords;
  const inputCues = analysis.primary_cues;
  const fileNameToken = normalizeToken(fileName || "");

  const ranked = candidates.map((candidate) => {
    const referenceTokens = asStringArray(candidate.reference.keywords);
    const referenceCues = asStringArray(candidate.reference.primary_cues);
    const referenceFingerprint = asJsonRecord(candidate.reference.fingerprint_payload);
    const referenceFingerprintTokens = asStringArray(referenceFingerprint.top_tokens);
    const aliasScore = [candidate.document.label, ...candidate.document.aliases]
      .map((item) => normalizeToken(item))
      .filter(Boolean)
      .some((token) => fileNameToken.includes(token))
      ? 0.1
      : 0;
    const docHintScore = documentTypeKey && documentTypeKey === candidate.document.document_type_key ? 0.15 : 0;
    const keywordScore = overlapRatio(inputTokens, referenceTokens) * 0.35;
    const cueScore = overlapRatio(inputCues, referenceCues) * 0.2;
    const fingerprintScore = overlapRatio(inputTokens, referenceFingerprintTokens) * 0.2;
    const textScore = candidate.reference.extracted_text && analysis.extracted_text
      ? overlapRatio(
          inputTokens,
          analysis.extracted_text.includes(candidate.reference.extracted_text.slice(0, 80)) ? referenceTokens : referenceTokens,
        ) * 0.1
      : 0;
    const cnpjScore = detectedClientByCnpj ? 0.2 : 0;
    const totalScore = Math.min(1, keywordScore + cueScore + fingerprintScore + textScore + aliasScore + docHintScore + cnpjScore);

    const eligibleInstances = buildEligibleInstanceCandidates(instances, templatesMap, profilesMap, {
      clientId: effectiveClientId,
      exactCompetence: effectiveCompetence,
      templateIds: new Set([candidate.template.id]),
    });

    return {
      ...candidate,
      eligibleInstances,
      totalScore: Number(totalScore.toFixed(2)),
    };
  }).sort((left, right) => right.totalScore - left.totalScore);

  const best = ranked[0];
  const second = ranked[1];

  if (!best) {
    return {
      ...emptyResult,
      detectedClientId: effectiveClientId,
      autoLinkBlockReason: "Nenhum documento modelo elegivel encontrado.",
    };
  }

  const ambiguous = second && Math.abs(best.totalScore - second.totalScore) <= 0.05;
  const uniqueOpenInstance = best.eligibleInstances.length === 1 ? best.eligibleInstances[0].instance.id : null;
  const autoAllowed = Boolean(
    analysis.detected_cnpj &&
    detectedClientByCnpj &&
    best.totalScore >= 0.9 &&
    !ambiguous &&
    uniqueOpenInstance,
  );

  const reasons = [
    detectedClientByCnpj
      ? `Cliente identificado por CNPJ: ${detectedClientByCnpj.name}.`
      : "Cliente sugerido manualmente, sem CNPJ confiavel para auto-vinculo.",
    `Documento modelo mais aderente: ${best.reference.file_name}.`,
    `Score do modelo: ${best.totalScore.toFixed(2)}.`,
  ];

  if (effectiveCompetence) {
    reasons.push(`Competencia considerada: ${effectiveCompetence}.`);
  }

  const autoLinkBlockReason = autoAllowed
    ? null
    : !analysis.detected_cnpj
      ? "Nao foi detectado CNPJ valido no documento."
      : ambiguous
        ? "Mais de um documento modelo apresentou score parecido."
        : !uniqueOpenInstance
          ? "Nao existe uma instancia unica e elegivel para a obrigacao candidata."
          : "Score abaixo do limiar de auto-vinculo.";

  return {
    ...emptyResult,
    resolvedInstanceId: autoAllowed ? uniqueOpenInstance : uniqueOpenInstance,
    suggestedTemplateId: best.template.id,
    documentTypeKey: best.document.document_type_key,
    strategy: autoAllowed ? "direct_expected_doc" : "manual_review",
    score: autoAllowed ? best.totalScore : Math.max(0.55, best.totalScore),
    reasons,
    reviewRequired: !autoAllowed,
    documentDefinition: best.document,
    candidateInstanceIds: best.eligibleInstances.map((item) => item.instance.id),
    detectedClientId: effectiveClientId,
    detectedCnpj: analysis.detected_cnpj,
    competenceDetected: effectiveCompetence,
    referenceFileId: best.reference.id,
    referenceMatchScore: best.totalScore,
    referenceMatchReasons: reasons,
    textExtractionStatus: analysis.text_extraction_status,
    ocrStatus: analysis.ocr_status,
    extractedTextPreview: analysis.extracted_text_preview,
    fingerprintPayload: analysis.fingerprint_payload,
    autoLinkBlockReason,
  };
}

async function createInstanceEvent(
  supabaseAdmin: SupabaseAdmin,
  instanceId: string,
  createdBy: string,
  eventType: string,
  fromStatus: string | null,
  toStatus: string | null,
  comment?: string | null,
  metadata?: JsonRecord,
) {
  const { error } = await supabaseAdmin
    .from("obligation_instance_events")
    .insert({
      instance_id: instanceId,
      event_type: eventType,
      from_status: fromStatus,
      to_status: toStatus,
      comment: comment || null,
      metadata: metadata || {},
      created_by: createdBy,
    });

  if (error) throw error;
}

function buildOperationalArchivePath(
  client: { cnpj: string | null; name: string },
  template: TemplateRow,
  instance: InstanceRow,
  fileName: string,
) {
  const extension = fileName.includes(".") ? fileName.slice(fileName.lastIndexOf(".")) : ".pdf";
  const safeName = toArchiveSegment(fileName.replace(/\.[^.]+$/, ""), "arquivo");
  return [
    "obrigacoes-grow",
    toArchiveSegment(client.cnpj, "sem-cnpj"),
    toArchiveSegment(client.name, "cliente"),
    toArchiveSegment(template.name, "obrigacao"),
    toArchiveSegment(instance.competence_label, "competencia"),
    `${safeName}${extension.toLowerCase()}`,
  ].join("/");
}

function buildProtocolNumber(instance: InstanceRow, inboxItemId: string) {
  const competence = normalizeToken(instance.competence_key).replace(/_/g, "").toUpperCase() || "SEMCOMP";
  const suffix = normalizeToken(inboxItemId).replace(/_/g, "").slice(0, 8).toUpperCase() || "DOC";
  return `GROW-${new Date().getUTCFullYear()}-${competence}-${suffix}`;
}

async function findDuplicateIngestionJob(
  supabaseAdmin: SupabaseAdmin,
  params: {
    sourceKind: string;
    fileHash: string | null;
    fileName: string;
    fileSize: number | null;
    robotMachineId: string | null;
  },
) {
  if (!params.fileHash) return null;

  const { data, error } = await supabaseAdmin
    .from("document_ingestion_jobs")
    .select("*")
    .eq("source_kind", params.sourceKind)
    .eq("file_hash", params.fileHash)
    .eq("file_name", params.fileName)
    .eq("file_size", params.fileSize)
    .eq("robot_machine_id", params.robotMachineId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return (data || null) as IngestionJobRow | null;
}

async function upsertIngestionJob(
  supabaseAdmin: SupabaseAdmin,
  payload: {
    organizationId: string;
    sourceKind: string;
    fileName: string;
    storageBucket: string;
    storagePath: string;
    fileHash: string | null;
    fileSize: number | null;
    clientId: string | null;
    detectedClientId: string | null;
    templateId: string | null;
    instanceId: string | null;
    robotOriginPath: string | null;
    robotMachineId: string | null;
    createdBy: string;
    metadata?: JsonRecord;
  },
) {
  const row = {
    organization_id: payload.organizationId,
    source_kind: payload.sourceKind,
    file_name: payload.fileName,
    storage_bucket: payload.storageBucket,
    storage_path: payload.storagePath,
    file_hash: payload.fileHash,
    file_size: payload.fileSize,
    client_id: payload.clientId,
    detected_client_id: payload.detectedClientId,
    template_id: payload.templateId,
    instance_id: payload.instanceId,
    robot_origin_path: payload.robotOriginPath,
    robot_machine_id: payload.robotMachineId,
    created_by: payload.createdBy,
    metadata: payload.metadata || {},
  };

  const { data, error } = await supabaseAdmin
    .from("document_ingestion_jobs")
    .upsert(row, { onConflict: "storage_bucket,storage_path" })
    .select("*")
    .single();

  if (error || !data) throw error || new Error("Falha ao registrar job de ingestao.");
  return data as IngestionJobRow;
}

async function updateIngestionJob(
  supabaseAdmin: SupabaseAdmin,
  jobId: string | null | undefined,
  updates: JsonRecord,
) {
  if (!jobId) return;
  const { error } = await supabaseAdmin
    .from("document_ingestion_jobs")
    .update(updates)
    .eq("id", jobId);
  if (error) throw error;
}

function renderCompletionEmailTemplate(
  templateText: string,
  payload: {
    clientName: string;
    obligationName: string;
    competence: string;
    sector: string;
    technicalDueDate: string;
  },
) {
  return templateText
    .replaceAll("{{cliente_nome}}", payload.clientName)
    .replaceAll("{{obrigacao_nome}}", payload.obligationName)
    .replaceAll("{{competencia}}", payload.competence)
    .replaceAll("{{setor}}", payload.sector)
    .replaceAll("{{prazo_tecnico}}", payload.technicalDueDate);
}

async function resolveActorEmailSender(supabaseAdmin: SupabaseAdmin, actorId: string) {
  const fallbackFrom =
    asTrimmedString(Deno.env.get("OBLIGATION_FROM_EMAIL")) ||
    asTrimmedString(Deno.env.get("NEWSLETTER_FROM_EMAIL")) ||
    "Grow Contabilidade <contato@contabilidadegrow.com.br>";
  const allowedDomains = asStringArray(
    (Deno.env.get("OBLIGATION_ALLOWED_FROM_DOMAINS") || "")
      .split(",")
      .map((domain) => domain.trim().toLowerCase())
      .filter(Boolean),
  );

  const { data, error } = await supabaseAdmin.auth.admin.getUserById(actorId);
  if (error || !data?.user) {
    return {
      from: fallbackFrom,
      replyTo: null,
      actorEmail: null,
      usedActorAsFrom: false,
    };
  }

  const actorEmail = normalizeEmail(data.user.email);
  const actorName =
    asTrimmedString(data.user.user_metadata?.display_name) ||
    asTrimmedString(data.user.user_metadata?.full_name) ||
    asTrimmedString(data.user.user_metadata?.name) ||
    actorEmail?.split("@")[0] ||
    "Grow Contabilidade";
  const actorFrom = actorEmail ? formatEmailAddress(actorEmail, actorName) : null;
  const actorDomain = getEmailDomain(actorEmail);
  const canUseActorAsFrom = Boolean(actorFrom && actorDomain) && allowedDomains.includes(actorDomain as string);

  return {
    from: canUseActorAsFrom && actorFrom ? actorFrom : fallbackFrom,
    replyTo: actorEmail,
    actorEmail,
    usedActorAsFrom: canUseActorAsFrom,
  };
}

async function resolveDeliverySender(supabaseAdmin: SupabaseAdmin, actorId: string) {
  const verifiedFrom =
    asTrimmedString(Deno.env.get("OBLIGATION_FROM_EMAIL")) ||
    asTrimmedString(Deno.env.get("NEWSLETTER_FROM_EMAIL")) ||
    "Grow Contabilidade <contato@contabilidadegrow.com.br>";

  const { data, error } = await supabaseAdmin.auth.admin.getUserById(actorId);
  if (error || !data?.user) {
    throw new Error("Nao foi possivel carregar o usuario responsavel pelo envio.");
  }

  const actorEmail = normalizeEmail(data.user.email);
  if (!actorEmail) {
    throw new Error("O usuario responsavel pelo envio precisa ter um e-mail valido cadastrado.");
  }

  const actorName =
    asTrimmedString(data.user.user_metadata?.display_name) ||
    asTrimmedString(data.user.user_metadata?.full_name) ||
    asTrimmedString(data.user.user_metadata?.name) ||
    actorEmail.split("@")[0] ||
    "Grow";

  return {
    verifiedFrom,
    replyTo: actorEmail,
    actorEmail,
    displaySenderContext: formatEmailAddress(actorEmail, actorName) || actorEmail,
  };
}

function sanitizeProviderMessage(value: unknown) {
  const message = asTrimmedString(value);
  if (!message) return "Falha no provedor de e-mail.";
  return message.slice(0, 700);
}

function buildDeliveryIdempotencyKey(instanceId: string, recipientEmail: string, attachmentIds: string[]) {
  const attachments = attachmentIds.slice().sort().join(",");
  return `obligation-delivery:${instanceId}:${recipientEmail}:${attachments}`;
}

async function downloadDeliveryAttachments(
  supabaseAdmin: SupabaseAdmin,
  files: Array<JsonRecord>,
): Promise<DeliveryAttachment[]> {
  const attachments: DeliveryAttachment[] = [];

  for (const file of files) {
    const id = asTrimmedString(file.id);
    const storageBucket = asTrimmedString(file.storage_bucket) || "obligation-files";
    const storagePath = asTrimmedString(file.storage_path);
    const filename = asTrimmedString(file.file_name) || storagePath?.split("/").pop() || "guia.pdf";
    if (!id || !storagePath) continue;

    const { data, error } = await supabaseAdmin.storage.from(storageBucket).download(storagePath);
    if (error || !data) {
      throw new Error(`Nao foi possivel carregar o anexo ${filename}.`);
    }

    const bytes = new Uint8Array(await data.arrayBuffer());
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);

    attachments.push({
      id,
      filename,
      content: btoa(binary),
      content_type: asTrimmedString(file.content_type),
      storage_bucket: storageBucket,
      storage_path: storagePath,
    });
  }

  return attachments;
}

async function prepareObligationDelivery(
  supabaseAdmin: SupabaseAdmin,
  actorId: string,
  organizationId: string,
  payload: JsonRecord,
): Promise<DeliveryPreparation> {
  const instanceId = asTrimmedString(payload.instance_id);
  if (!instanceId) throw new Error("Instancia da obrigacao e obrigatoria.");

  const { data: instanceData, error: instanceError } = await supabaseAdmin
    .from("obligation_instances")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("id", instanceId)
    .single();
  if (instanceError || !instanceData) throw new Error("Instancia da obrigacao nao encontrada.");

  const instance = instanceData as InstanceRow;
  const [{ data: templateData, error: templateError }, { data: clientData, error: clientError }] = await Promise.all([
    supabaseAdmin
      .from("obligation_templates")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("id", instance.template_id)
      .single(),
    supabaseAdmin
      .from("clients")
      .select("id, name, cnpj, sector, status, email, phone, contact, obligation_completion_whatsapp_enabled")
      .eq("organization_id", organizationId)
      .eq("id", instance.client_id)
      .single(),
  ]);
  if (templateError || !templateData) throw new Error("Template da obrigacao nao encontrado.");
  if (clientError || !clientData) throw new Error("Cliente da obrigacao nao encontrado.");

  const template = templateData as TemplateRow;
  const clientRecord = clientData as JsonRecord;
  const client: ClientDeliveryContext = {
    id: String(clientRecord.id),
    name: String(clientRecord.name || "Cliente"),
    cnpj: normalizeCnpj(asTrimmedString(clientRecord.cnpj)),
    sector: asTrimmedString(clientRecord.sector) || "Geral",
    status: asTrimmedString(clientRecord.status) || "Ativo",
    email: normalizeEmail(clientRecord.email),
    phone: asTrimmedString(clientRecord.phone),
    contact: asTrimmedString(clientRecord.contact),
    obligation_completion_whatsapp_enabled: asBoolean(clientRecord.obligation_completion_whatsapp_enabled, false),
  };

  if (!template.completion_email_enabled) {
    throw new Error("Esta obrigacao nao esta configurada para envio por e-mail.");
  }

  const requiredStatus = await determineInstanceDocumentStatus(supabaseAdmin, instance, template);
  if (requiredStatus !== "concluida") {
    throw new Error("A obrigacao ainda nao possui todos os documentos obrigatorios anexados.");
  }

  const { data: filesData, error: filesError } = await supabaseAdmin
    .from("obligation_instance_files")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("instance_id", instance.id)
    .in("triage_status", ["accepted", "reviewed"])
    .order("created_at", { ascending: true });
  if (filesError) throw filesError;
  const files = ((filesData || []) as Array<JsonRecord>).filter((file) => asTrimmedString(file.storage_path));
  if (files.length === 0) {
    throw new Error("Nao ha guia anexada para enviar ao cliente.");
  }

  const inboxItemId =
    asTrimmedString(payload.inbox_item_id) ||
    asTrimmedString(files[files.length - 1]?.inbox_item_id) ||
    instance.completed_by_inbox_item_id;
  let inboxItem: InboxRow | null = null;
  if (inboxItemId) {
    const { data: inboxData, error: inboxError } = await supabaseAdmin
      .from("document_inbox_items")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("id", inboxItemId)
      .maybeSingle();
    if (inboxError) throw inboxError;
    inboxItem = (inboxData || null) as InboxRow | null;
  }

  const recipientEmail = normalizeEmail(payload.recipient_email) || normalizeEmail(client.email);
  if (!recipientEmail) {
    throw new Error("O cliente nao possui e-mail valido cadastrado. Informe um destinatario revisado.");
  }

  const sender = await resolveDeliverySender(supabaseAdmin, actorId);
  const renderPayload = {
    clientName: client.name,
    obligationName: template.name,
    competence: instance.competence_label,
    sector: template.sector,
    technicalDueDate: instance.technical_due_date,
  };
  const subject = renderCompletionEmailTemplate(
    template.completion_email_subject || "{{obrigacao_nome}} - {{competencia}}",
    renderPayload,
  );
  const textBody = renderCompletionEmailTemplate(
    template.completion_email_body ||
      "Ola, {{cliente_nome}}.\n\nSegue anexa a guia da obrigacao {{obrigacao_nome}} referente a competencia {{competencia}}.\n\nSetor responsavel: {{setor}}.",
    renderPayload,
  );

  const warnings = [];
  if (recipientEmail !== normalizeEmail(client.email)) {
    warnings.push("Destinatario alterado manualmente em relacao ao e-mail principal do cliente.");
  }
  if (instance.status === "concluida") {
    warnings.push("Esta obrigacao ja esta concluida; confirme duplicidade antes de reenviar.");
  }

  return {
    organizationId,
    instance,
    template,
    client,
    inboxItem,
    files,
    sender,
    recipientEmail,
    subject,
    textBody,
    htmlBody: buildCompletionEmailBodyHtml(textBody),
    warnings,
  };
}

async function handlePrepareDelivery(
  supabaseAdmin: SupabaseAdmin,
  actorId: string,
  organizationId: string,
  payload: JsonRecord,
) {
  try {
    const prepared = await prepareObligationDelivery(supabaseAdmin, actorId, organizationId, payload);
    return jsonResponse({
      ok: true,
      delivery: {
        instance_id: prepared.instance.id,
        client_id: prepared.client.id,
        client_name: prepared.client.name,
        inbox_item_id: prepared.inboxItem?.id || null,
        recipient_email: prepared.recipientEmail,
        verified_from_email: prepared.sender.verifiedFrom,
        reply_to: prepared.sender.replyTo,
        display_sender_context: prepared.sender.displaySenderContext,
        subject: prepared.subject,
        message_body: prepared.textBody,
        attachments: prepared.files.map((file) => ({
          id: file.id,
          file_name: file.file_name,
          storage_bucket: file.storage_bucket,
          storage_path: file.storage_path,
          content_type: file.content_type,
          file_size: file.file_size,
        })),
        warnings: prepared.warnings,
      },
    });
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : "Falha ao preparar envio." }, 400);
  }
}

async function handleSendDelivery(
  supabaseAdmin: SupabaseAdmin,
  actorId: string,
  organizationId: string,
  payload: JsonRecord,
) {
  const humanConfirmed = asBoolean(payload.human_confirmed, false);
  if (!humanConfirmed) {
    return jsonResponse({ error: "Confirme manualmente o destinatario, mensagem e anexos antes de enviar." }, 400);
  }

  const prepared = await prepareObligationDelivery(supabaseAdmin, actorId, organizationId, payload);
  const duplicateConfirmed = asBoolean(payload.confirm_duplicate, false);
  const attachmentIds = prepared.files
    .map((file) => asTrimmedString(file.id))
    .filter((value): value is string => Boolean(value));
  const deliveryAttemptToken = new Date().toISOString();
  const idempotencyKey =
    asTrimmedString(payload.idempotency_key) ||
    `${buildDeliveryIdempotencyKey(prepared.instance.id, prepared.recipientEmail, attachmentIds)}:${deliveryAttemptToken}`;

  const { data: existingSent, error: existingError } = await supabaseAdmin
    .from("obligation_delivery_attempts")
    .select("id, sent_at, recipient_email")
    .eq("organization_id", organizationId)
    .eq("instance_id", prepared.instance.id)
    .eq("status", "sent")
    .limit(1)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existingSent && !duplicateConfirmed) {
    return jsonResponse({
      error: "Ja existe um envio bem-sucedido para esta obrigacao. Confirme o reenvio para continuar.",
      duplicate_delivery: existingSent,
    }, 409);
  }

  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) {
    return jsonResponse({ error: "RESEND_API_KEY nao configurada." }, 500);
  }

  const now = new Date().toISOString();
  const { data: attemptData, error: attemptError } = await supabaseAdmin
    .from("obligation_delivery_attempts")
    .insert({
      organization_id: organizationId,
      client_id: prepared.client.id,
      instance_id: prepared.instance.id,
      inbox_item_id: prepared.inboxItem?.id || null,
      sender_user_id: actorId,
      sender_email: prepared.sender.actorEmail,
      verified_from_email: prepared.sender.verifiedFrom,
      display_sender_context: prepared.sender.displaySenderContext,
      reply_to: prepared.sender.replyTo,
      recipient_email: prepared.recipientEmail,
      subject: prepared.subject,
      message_body: prepared.textBody,
      attachment_file_ids: attachmentIds,
      status: "sending",
      idempotency_key: idempotencyKey,
      human_confirmed_at: now,
      metadata: {
        duplicate_confirmed: duplicateConfirmed,
        attachment_count: attachmentIds.length,
      },
    })
    .select("*")
    .single();
  if (attemptError || !attemptData) {
    return jsonResponse({ error: attemptError?.message || "Falha ao registrar tentativa de envio." }, 400);
  }

  await supabaseAdmin
    .from("obligation_instances")
    .update({ status: "enviando", last_status_at: now })
    .eq("organization_id", organizationId)
    .eq("id", prepared.instance.id);

  let attachments: DeliveryAttachment[];
  try {
    attachments = await downloadDeliveryAttachments(supabaseAdmin, prepared.files);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao preparar anexos.";
    await supabaseAdmin
      .from("obligation_delivery_attempts")
      .update({ status: "failed", failure_reason: message, failed_at: new Date().toISOString() })
      .eq("id", String((attemptData as JsonRecord).id));
    await supabaseAdmin
      .from("obligation_instances")
      .update({ status: "falha_envio", last_status_at: new Date().toISOString() })
      .eq("organization_id", organizationId)
      .eq("id", prepared.instance.id);
    return jsonResponse({ error: message }, 400);
  }

  const sendResult = await sendEmailViaResend({
    apiKey,
    from: prepared.sender.verifiedFrom,
    replyTo: prepared.sender.replyTo,
    to: prepared.recipientEmail,
    subject: prepared.subject,
    html: prepared.htmlBody,
    text: prepared.textBody,
    idempotencyKey,
    attachments: attachments.map((attachment) => ({
      filename: attachment.filename,
      content: attachment.content,
      content_type: attachment.content_type || undefined,
    })),
  });

  if (!sendResult.ok) {
    const failureReason = sanitizeProviderMessage(sendResult.message);
    await supabaseAdmin
      .from("obligation_delivery_attempts")
      .update({
        status: "failed",
        provider_status: sendResult.status,
        failure_reason: failureReason,
        failed_at: new Date().toISOString(),
      })
      .eq("id", String((attemptData as JsonRecord).id));
    await supabaseAdmin
      .from("obligation_instances")
      .update({ status: "falha_envio", last_status_at: new Date().toISOString() })
      .eq("organization_id", organizationId)
      .eq("id", prepared.instance.id);
    await createInstanceEvent(
      supabaseAdmin,
      prepared.instance.id,
      actorId,
      "delivery_failed",
      prepared.instance.status,
      "falha_envio",
      "Falha no envio da guia por e-mail.",
      {
        attempt_id: String((attemptData as JsonRecord).id),
        provider_status: sendResult.status,
        failure_reason: failureReason,
      },
    );
    return jsonResponse({ error: "Falha ao enviar e-mail ao cliente.", detail: failureReason }, 502);
  }

  const sentAt = new Date().toISOString();
  await supabaseAdmin
    .from("obligation_delivery_attempts")
    .update({
      status: "sent",
      provider_message_id: sendResult.id,
      provider_status: 202,
      sent_at: sentAt,
    })
    .eq("id", String((attemptData as JsonRecord).id));

  const { data: updatedInstanceData, error: instanceUpdateError } = await supabaseAdmin
    .from("obligation_instances")
    .update({
      status: "concluida",
      completed_at: sentAt,
      completed_by_inbox_item_id: prepared.inboxItem?.id || prepared.instance.completed_by_inbox_item_id,
      delivery_review_required: false,
      delivery_review_reason: null,
      last_status_at: sentAt,
    })
    .eq("organization_id", organizationId)
    .eq("id", prepared.instance.id)
    .select("*")
    .single();
  if (instanceUpdateError || !updatedInstanceData) {
    throw instanceUpdateError || new Error("Falha ao concluir instancia apos envio.");
  }

  await Promise.all([
    prepared.inboxItem
      ? markInboxProcessingState(supabaseAdmin, prepared.inboxItem.id, {
        communication_status: "sent",
        publication_status: "published",
        execution_notes: "Guia enviada ao cliente por e-mail com confirmacao humana.",
        processed_automatically: true,
      })
      : Promise.resolve(),
    prepared.inboxItem?.ingestion_job_id
      ? updateIngestionJob(supabaseAdmin, prepared.inboxItem.ingestion_job_id, {
        communication_status: "sent",
        publication_status: "published",
        status: "completed",
        completed_at: sentAt,
      })
      : Promise.resolve(),
    supabaseAdmin
      .from("obligation_instance_files")
      .update({ publication_status: "published" })
      .eq("organization_id", organizationId)
      .eq("instance_id", prepared.instance.id),
  ]);

  await createInstanceEvent(
    supabaseAdmin,
    prepared.instance.id,
    actorId,
    "delivery_sent",
    prepared.instance.status,
    "concluida",
    `Guia enviada por e-mail para ${prepared.recipientEmail}.`,
    {
      attempt_id: String((attemptData as JsonRecord).id),
      recipient_email: prepared.recipientEmail,
      sender_email: prepared.sender.actorEmail,
      verified_from_email: prepared.sender.verifiedFrom,
      reply_to: prepared.sender.replyTo,
      resend_email_id: sendResult.id,
    },
  );

  await syncInstanceArtifacts(supabaseAdmin, updatedInstanceData as InstanceRow, prepared.template, prepared.client.name);

  return jsonResponse({
    ok: true,
    delivery_attempt: {
      id: String((attemptData as JsonRecord).id),
      status: "sent",
      provider_message_id: sendResult.id,
      sent_at: sentAt,
    },
    instance: updatedInstanceData,
  });
}

async function handleCancelDelivery(
  supabaseAdmin: SupabaseAdmin,
  actorId: string,
  organizationId: string,
  payload: JsonRecord,
) {
  const instanceId = asTrimmedString(payload.instance_id);
  const attemptId = asTrimmedString(payload.attempt_id);
  const reason = asTrimmedString(payload.reason) || "Envio cancelado manualmente.";
  if (!instanceId && !attemptId) {
    return jsonResponse({ error: "Informe a instancia ou tentativa de envio para cancelar." }, 400);
  }

  let query = supabaseAdmin
    .from("obligation_delivery_attempts")
    .select("*")
    .eq("organization_id", organizationId)
    .neq("status", "sent")
    .neq("status", "cancelled")
    .order("created_at", { ascending: false })
    .limit(1);
  if (attemptId) query = query.eq("id", attemptId);
  if (instanceId) query = query.eq("instance_id", instanceId);

  const { data: attempt, error: attemptError } = await query.maybeSingle();
  if (attemptError) return jsonResponse({ error: attemptError.message }, 400);
  if (!attempt) return jsonResponse({ error: "Nenhuma tentativa cancelavel encontrada." }, 404);

  const attemptRecord = attempt as JsonRecord;
  const targetInstanceId = String(attemptRecord.instance_id);
  const now = new Date().toISOString();
  const { error: cancelError } = await supabaseAdmin
    .from("obligation_delivery_attempts")
    .update({
      status: "cancelled",
      failure_reason: reason,
      cancelled_at: now,
      cancelled_by: actorId,
    })
    .eq("organization_id", organizationId)
    .eq("id", String(attemptRecord.id));
  if (cancelError) return jsonResponse({ error: cancelError.message }, 400);

  const { data: instanceData } = await supabaseAdmin
    .from("obligation_instances")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("id", targetInstanceId)
    .maybeSingle();
  const previousStatus = asTrimmedString((instanceData as JsonRecord | null)?.status);

  if (instanceData && !["concluida", "cancelada"].includes(previousStatus || "")) {
    await supabaseAdmin
      .from("obligation_instances")
      .update({ status: "pronto_para_envio", last_status_at: now })
      .eq("organization_id", organizationId)
      .eq("id", targetInstanceId);
  }

  await createInstanceEvent(
    supabaseAdmin,
    targetInstanceId,
    actorId,
    "delivery_cancelled",
    previousStatus,
    previousStatus && ["concluida", "cancelada"].includes(previousStatus) ? previousStatus : "pronto_para_envio",
    reason,
    { attempt_id: String(attemptRecord.id) },
  );

  return jsonResponse({ ok: true, delivery_attempt: { id: String(attemptRecord.id), status: "cancelled" } });
}

function buildCompletionEmailBodyHtml(body: string) {
  return `
    <div style="background:#f8fafc;padding:24px 12px;font-family:Arial,sans-serif;color:#0f172a;">
      <div style="max-width:680px;margin:0 auto;background:#ffffff;border-radius:14px;padding:24px;border:1px solid #e2e8f0;">
        <div style="white-space:pre-line;font-size:14px;line-height:1.6;">${escapeHtml(body)}</div>
      </div>
    </div>
  `;
}

async function sendEmailViaResend(params: {
  apiKey: string;
  from: string;
  replyTo?: string | null;
  to: string;
  subject: string;
  html: string;
  text: string;
  idempotencyKey?: string;
  attachments?: Array<{ filename: string; content: string; content_type?: string }>;
}) {
  const headers = new Headers({
    Authorization: `Bearer ${params.apiKey}`,
    "Content-Type": "application/json",
  });

  if (params.idempotencyKey) {
    headers.set("Idempotency-Key", params.idempotencyKey);
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers,
    body: JSON.stringify({
      from: params.from,
      to: [params.to],
      reply_to: params.replyTo || undefined,
      subject: params.subject,
      html: params.html,
      text: params.text,
      attachments: params.attachments?.length ? params.attachments : undefined,
    }),
  });

  if (response.ok) {
    const data = await response.json().catch(() => null);
    return { ok: true as const, id: asRecord(data)?.id || null };
  }

  const responseText = await response.text();
  return {
    ok: false as const,
    status: response.status,
    message: responseText || "Unknown provider error",
  };
}

async function resolveClientWhatsAppTarget(
  supabaseAdmin: SupabaseAdmin,
  client: ClientDeliveryContext,
) {
  const { data, error } = await supabaseAdmin
    .from("client_data")
    .select("field_name, field_value")
    .eq("client_id", client.id)
    .eq("category", "cadastro_clientes")
    .in("field_name", ["whatsapp", "telefone", "ddd"]);

  if (error) throw error;

  const entries = new Map<string, string>();
  for (const row of data || []) {
    const fieldName = asTrimmedString((row as JsonRecord).field_name)?.toLowerCase();
    const fieldValue = asTrimmedString((row as JsonRecord).field_value);
    if (!fieldName || !fieldValue) continue;
    entries.set(fieldName, fieldValue);
  }

  const cadastroWhatsApp = normalizePhoneDigits(entries.get("whatsapp"));
  if (cadastroWhatsApp) {
    return {
      phoneDigits: cadastroWhatsApp,
      source: "client_data.whatsapp",
    };
  }

  const cadastroPhone = combineDddAndPhone(entries.get("ddd"), entries.get("telefone"));
  if (cadastroPhone) {
    return {
      phoneDigits: cadastroPhone,
      source: "client_data.telefone",
    };
  }

  const clientPhone = normalizePhoneDigits(client.phone);
  if (clientPhone) {
    return {
      phoneDigits: clientPhone,
      source: "clients.phone",
    };
  }

  return {
    phoneDigits: null,
    source: null,
  };
}

async function maybeSendCompletionEmail(
  supabaseAdmin: SupabaseAdmin,
  actorId: string,
  template: TemplateRow,
  instance: InstanceRow,
  client: ClientDeliveryContext,
  inboxItem: InboxRow,
) {
  if (!template.completion_email_enabled) {
    return { attempted: false as const, sent: false as const, reason: "disabled" };
  }

  const recipientEmail = normalizeEmail(client.email);
  if (!recipientEmail) {
    await createInstanceEvent(
      supabaseAdmin,
      instance.id,
      actorId,
      "completion_email_failed",
      null,
      null,
      "Obrigação concluída, mas o cliente não possui e-mail válido cadastrado.",
      { inbox_item_id: inboxItem.id },
    );
    return { attempted: true as const, sent: false as const, reason: "missing_recipient" };
  }

  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const sender = await resolveActorEmailSender(supabaseAdmin, actorId);

  if (!resendApiKey) {
    await createInstanceEvent(
      supabaseAdmin,
      instance.id,
      actorId,
      "completion_email_failed",
      null,
      null,
      "Obrigação concluída, mas a chave de envio de e-mail não está configurada.",
      { inbox_item_id: inboxItem.id },
    );
    return { attempted: true as const, sent: false as const, reason: "missing_api_key" };
  }

  const renderPayload = {
    clientName: client.name,
    obligationName: template.name,
    competence: instance.competence_label,
    sector: template.sector,
    technicalDueDate: instance.technical_due_date,
  };

  const subject = renderCompletionEmailTemplate(
    template.completion_email_subject || "{{obrigacao_nome}} concluída - {{competencia}}",
    renderPayload,
  );
  const textBody = renderCompletionEmailTemplate(
    template.completion_email_body ||
      "Olá, {{cliente_nome}}.\n\nA obrigação {{obrigacao_nome}} referente à competência {{competencia}} foi concluída.\n\nSetor responsável: {{setor}}.\nPrazo técnico: {{prazo_tecnico}}.",
    renderPayload,
  );
  const htmlBody = buildCompletionEmailBodyHtml(textBody);

  const sendResult = await sendEmailViaResend({
    apiKey: resendApiKey,
    from: sender.from,
    replyTo: sender.replyTo,
    to: recipientEmail,
    subject,
    html: htmlBody,
    text: textBody,
    idempotencyKey: `obligation-completion:${instance.id}:${inboxItem.id}:${recipientEmail}`,
  });

  if (!sendResult.ok) {
    await createInstanceEvent(
      supabaseAdmin,
      instance.id,
      actorId,
      "completion_email_failed",
      null,
      null,
      "Obrigação concluída, mas houve falha no disparo do e-mail automático.",
      {
        inbox_item_id: inboxItem.id,
        provider_status: sendResult.status,
        provider_message: sendResult.message,
        recipient_email: recipientEmail,
        sender_email: sender.actorEmail,
        sender_from: sender.from,
        used_actor_as_from: sender.usedActorAsFrom,
      },
    );
    return { attempted: true as const, sent: false as const, reason: "provider_error" };
  }

  await createInstanceEvent(
    supabaseAdmin,
    instance.id,
    actorId,
    "completion_email_sent",
    null,
    null,
    `E-mail automático enviado para ${recipientEmail}.`,
    {
      inbox_item_id: inboxItem.id,
      recipient_email: recipientEmail,
      sender_email: sender.actorEmail,
      sender_from: sender.from,
      used_actor_as_from: sender.usedActorAsFrom,
      resend_email_id: sendResult.id,
      subject,
    },
  );

  return { attempted: true as const, sent: true as const, recipientEmail };
}

async function maybeSendCompletionWhatsApp(
  supabaseAdmin: SupabaseAdmin,
  actorId: string,
  template: TemplateRow,
  instance: InstanceRow,
  client: ClientDeliveryContext,
  inboxItem: InboxRow,
) {
  if (!template.completion_whatsapp_enabled) {
    return { attempted: false as const, sent: false as const, reason: "disabled_template" };
  }

  if (!client.obligation_completion_whatsapp_enabled) {
    return { attempted: false as const, sent: false as const, reason: "disabled_client" };
  }

  const target = await resolveClientWhatsAppTarget(supabaseAdmin, client);
  if (!target.phoneDigits) {
    await createInstanceEvent(
      supabaseAdmin,
      instance.id,
      actorId,
      "completion_whatsapp_failed",
      null,
      null,
      "ObrigaÃ§Ã£o concluÃ­da, mas o cliente nÃ£o possui WhatsApp vÃ¡lido cadastrado.",
      { inbox_item_id: inboxItem.id },
    );
    return { attempted: true as const, sent: false as const, reason: "missing_recipient" };
  }

  const renderPayload = {
    clientName: client.name,
    obligationName: template.name,
    competence: instance.competence_label,
    sector: template.sector,
    technicalDueDate: instance.technical_due_date,
  };

  const messageBody = renderCompletionEmailTemplate(
    template.completion_whatsapp_body ||
      "OlÃ¡, {{cliente_nome}}.\n\nA obrigaÃ§Ã£o {{obrigacao_nome}} referente Ã  competÃªncia {{competencia}} foi concluÃ­da.\n\nSetor responsÃ¡vel: {{setor}}.\nPrazo tÃ©cnico: {{prazo_tecnico}}.",
    renderPayload,
  );

  try {
    const sendResult = await sendWhatsAppTextMessage(target.phoneDigits, messageBody);
    if (!sendResult.sent) {
      await createInstanceEvent(
        supabaseAdmin,
        instance.id,
        actorId,
        "completion_whatsapp_failed",
        null,
        null,
        "ObrigaÃ§Ã£o concluÃ­da, mas o WhatsApp automÃ¡tico nÃ£o foi enviado porque a integraÃ§Ã£o nÃ£o estÃ¡ configurada.",
        {
          inbox_item_id: inboxItem.id,
          recipient_phone: target.phoneDigits,
          recipient_source: target.source,
        },
      );
      return { attempted: true as const, sent: false as const, reason: "missing_provider_config" };
    }

    await createInstanceEvent(
      supabaseAdmin,
      instance.id,
      actorId,
      "completion_whatsapp_sent",
      null,
      null,
      `WhatsApp automÃ¡tico enviado para ${target.phoneDigits}.`,
      {
        inbox_item_id: inboxItem.id,
        recipient_phone: target.phoneDigits,
        recipient_source: target.source,
      },
    );

    return { attempted: true as const, sent: true as const, recipientPhone: target.phoneDigits };
  } catch (error) {
    await createInstanceEvent(
      supabaseAdmin,
      instance.id,
      actorId,
      "completion_whatsapp_failed",
      null,
      null,
      "ObrigaÃ§Ã£o concluÃ­da, mas houve falha no disparo do WhatsApp automÃ¡tico.",
      {
        inbox_item_id: inboxItem.id,
        recipient_phone: target.phoneDigits,
        recipient_source: target.source,
        provider_message: error instanceof Error ? error.message : "Unknown provider error",
      },
    );
    return { attempted: true as const, sent: false as const, reason: "provider_error" };
  }
}

async function determineInstanceDocumentStatus(
  supabaseAdmin: SupabaseAdmin,
  instance: InstanceRow,
  template: TemplateRow,
) {
  if (instance.status === "concluida" || instance.status === "cancelada") {
    return instance.status;
  }

  const requiredDocuments = asExpectedDocuments(template.expected_documents)
    .filter((document) => document.active && document.required)
    .map((document) => document.document_type_key);

  if (requiredDocuments.length === 0) {
    return "concluida";
  }

  const { data: linkedRows, error } = await supabaseAdmin
    .from("document_inbox_items")
    .select("document_type_key, status")
    .eq("linked_instance_id", instance.id)
    .eq("status", "linked");

  if (error) throw error;

  const linkedDocumentTypes = new Set(
    (linkedRows || [])
      .map((row) => asTrimmedString((row as JsonRecord).document_type_key))
      .filter((value): value is string => Boolean(value)),
  );

  const allRequiredReceived = requiredDocuments.every((documentTypeKey) => linkedDocumentTypes.has(documentTypeKey));
  if (allRequiredReceived) {
    return "em_revisao";
  }

  return instance.status === "atrasada" ? "atrasada" : "aguardando_documento";
}

async function markInboxProcessingState(
  supabaseAdmin: SupabaseAdmin,
  inboxItemId: string,
  updates: JsonRecord,
) {
  const { error } = await supabaseAdmin
    .from("document_inbox_items")
    .update(updates)
    .eq("id", inboxItemId);

  if (error) throw error;
}

async function applyDocumentOperationalFlow(
  supabaseAdmin: SupabaseAdmin,
  actorId: string,
  inboxItem: InboxRow,
) {
  return await applyDocumentOperationalFlowV2(supabaseAdmin, actorId, inboxItem);
  const now = new Date().toISOString();
  if (nextStatus !== "aguardando_documento" && failedAutomaticDeliveries.length > 0) {
    executionNotes = `Documento anexado e obrigaÃ§Ã£o concluÃ­da automaticamente. ${failedAutomaticDeliveries.join(" e ")} nÃ£o pÃ´de ser enviado.`;
  }

  await markInboxProcessingState(supabaseAdmin, inboxItem.id, {
    processing_status: "processing",
    processing_attempts: (inboxItem.processing_attempts || 0) + 1,
    processing_started_at: now,
    last_processing_error: null,
  });

  if (inboxItem.status === "rejected") {
    await markInboxProcessingState(supabaseAdmin, inboxItem.id, {
      processing_status: "processed",
      processing_completed_at: now,
      execution_status: "skipped",
      execution_notes: "Documento rejeitado na triagem manual.",
      archive_path: null,
    });

    return { processed: false, reason: "rejected" };
  }

  if (!inboxItem.linked_instance_id) {
    await markInboxProcessingState(supabaseAdmin, inboxItem.id, {
      processing_status: "queued",
      processing_started_at: null,
      execution_status: "pending",
      classification_status: "classified",
      application_status: "pending",
      communication_status: "pending",
      publication_status: "pending",
      execution_notes: "Aguardando vinculação manual da instância.",
    });

    return { processed: false, reason: "awaiting_link" };
  }

  const { data: instanceData, error: instanceError } = await supabaseAdmin
    .from("obligation_instances")
    .select("*")
    .eq("id", inboxItem.linked_instance_id)
    .single();

  if (instanceError || !instanceData) {
    await markInboxProcessingState(supabaseAdmin, inboxItem.id, {
      processing_status: "failed",
      processing_completed_at: now,
      execution_status: "failed",
      last_processing_error: instanceError?.message || "Instância vinculada não encontrada.",
      execution_notes: "Falha ao localizar a instância vinculada para executar a obrigação.",
    });

    return { processed: false, reason: "missing_instance" };
  }

  const instance = instanceData as InstanceRow;
  const templatesMap = await loadTemplatesMap(supabaseAdmin);
  const clientsMap = await loadClientsMap(supabaseAdmin);
  const template = templatesMap.get(instance.template_id);
  const client = clientsMap.get(instance.client_id);

  if (!template || !client) {
    await markInboxProcessingState(supabaseAdmin, inboxItem.id, {
      processing_status: "failed",
      processing_completed_at: now,
      execution_status: "failed",
      last_processing_error: "Template ou cliente da instância não encontrado.",
      execution_notes: "Falha ao carregar o contexto operacional da obrigação.",
    });

    return { processed: false, reason: "missing_context" };
  }

  const archivePath = buildOperationalArchivePath(client, template, instance, inboxItem.file_name);
  const source = inboxItem.matched_by || "manual_review";
  const triageStatus = source === "manual_review" ? "reviewed" : "accepted";

  const { error: fileError } = await supabaseAdmin
    .from("obligation_instance_files")
    .upsert({
      organization_id: inboxItem.organization_id || instance.organization_id,
      instance_id: instance.id,
      inbox_item_id: inboxItem.id,
      file_name: inboxItem.file_name,
      storage_bucket: inboxItem.storage_bucket,
      storage_path: inboxItem.storage_path,
      content_type: inboxItem.content_type,
      file_size: inboxItem.file_size,
      triage_status: triageStatus,
      source,
      uploaded_by: actorId,
      identification_confidence: Number(inboxItem.match_score || inboxItem.identification_confidence || 1),
    }, { onConflict: "storage_bucket,storage_path" });

  if (fileError) {
    await markInboxProcessingState(supabaseAdmin, inboxItem.id, {
      processing_status: "failed",
      processing_completed_at: now,
      execution_status: "failed",
      last_processing_error: fileError.message,
      execution_notes: "Falha ao anexar o arquivo na instância da obrigação.",
    });

    return { processed: false, reason: "file_upsert_failed" };
  }

  await createInstanceEvent(
    supabaseAdmin,
    instance.id,
    actorId,
    "document_received",
    null,
    null,
    `Documento ${inboxItem.file_name} recebido pela Central de Documentos.`,
    {
      inbox_item_id: inboxItem.id,
      document_type_key: inboxItem.document_type_key,
      matched_by: inboxItem.matched_by,
      archive_path: archivePath,
    },
  );

  const nextStatus = await determineInstanceDocumentStatus(supabaseAdmin, instance, template);
  let updatedInstance = instance;
  const justCompleted = nextStatus === "concluida" && instance.status !== "concluida";

  if (nextStatus !== instance.status) {
    const { data: updatedInstanceData, error: updateError } = await supabaseAdmin
      .from("obligation_instances")
      .update({
        status: nextStatus,
        completed_at: nextStatus === "concluida" ? now : null,
        last_status_at: now,
      })
      .eq("id", instance.id)
      .select("*")
      .single();

    if (updateError || !updatedInstanceData) {
      await markInboxProcessingState(supabaseAdmin, inboxItem.id, {
        processing_status: "failed",
        processing_completed_at: now,
        execution_status: "failed",
        last_processing_error: updateError?.message || "Falha ao atualizar o status da obrigação.",
        execution_notes: "Documento anexado, mas a execução automática da obrigação falhou.",
      });

      return { processed: false, reason: "instance_update_failed" };
    }

    updatedInstance = updatedInstanceData as InstanceRow;
    await createInstanceEvent(
      supabaseAdmin,
      instance.id,
      actorId,
      "status_change",
      instance.status,
      nextStatus,
      "Status ajustado automaticamente após recebimento do documento.",
      { inbox_item_id: inboxItem.id },
    );
  }

  await syncInstanceArtifacts(supabaseAdmin, updatedInstance, template, client.name);

  const [emailResult, whatsappResult] = justCompleted
    ? await Promise.all([
      Promise.resolve({ attempted: false as const, sent: false as const, reason: "manual_delivery_required" }),
      Promise.resolve({ attempted: false as const, sent: false as const, reason: "manual_delivery_required" }),
    ])
    : [
      { attempted: false as const, sent: false as const, reason: "not_completed" },
      { attempted: false as const, sent: false as const, reason: "not_completed" },
    ];

  const failedAutomaticDeliveries = [
    emailResult.attempted && !emailResult.sent ? "o e-mail automÃ¡tico" : null,
    whatsappResult.attempted && !whatsappResult.sent ? "o WhatsApp automÃ¡tico" : null,
  ].filter((value): value is string => Boolean(value));

  let executionNotes = nextStatus === "aguardando_documento"
    ? "Documento anexado. A obrigação ainda aguarda outros documentos obrigatórios."
    : emailResult.attempted && !emailResult.sent
      ? "Documento anexado e obrigação concluída automaticamente. O e-mail automático não pôde ser enviado."
      : "Documento anexado e obrigação concluída automaticamente.";

  await markInboxProcessingState(supabaseAdmin, inboxItem.id, {
    processing_status: "processed",
    processing_completed_at: now,
    execution_status: "applied",
    execution_notes: executionNotes,
    archive_path: archivePath,
    last_processing_error: null,
  });

  return { processed: true, nextStatus, archivePath };
}

async function applyDocumentOperationalFlowV2(
  supabaseAdmin: SupabaseAdmin,
  actorId: string,
  inboxItem: InboxRow,
) {
  const now = new Date().toISOString();

  await markInboxProcessingState(supabaseAdmin, inboxItem.id, {
    processing_status: "processing",
    processing_attempts: (inboxItem.processing_attempts || 0) + 1,
    processing_started_at: now,
    last_processing_error: null,
  });
  await updateIngestionJob(supabaseAdmin, inboxItem.ingestion_job_id, {
    status: "processing",
    started_at: now,
    attempts: (inboxItem.processing_attempts || 0) + 1,
    last_error: null,
  });

  if (inboxItem.status === "rejected") {
    await markInboxProcessingState(supabaseAdmin, inboxItem.id, {
      processing_status: "processed",
      processing_completed_at: now,
      execution_status: "skipped",
      application_status: "skipped",
      communication_status: "not_applicable",
      publication_status: "not_applicable",
      execution_notes: "Documento rejeitado na triagem manual.",
      archive_path: null,
    });
    await updateIngestionJob(supabaseAdmin, inboxItem.ingestion_job_id, {
      status: "completed",
      classification_status: "review_required",
      application_status: "skipped",
      communication_status: "not_applicable",
      publication_status: "not_applicable",
      review_required: true,
      completed_at: now,
    });
    return { processed: false, reason: "rejected" };
  }

  if (!inboxItem.linked_instance_id) {
    await markInboxProcessingState(supabaseAdmin, inboxItem.id, {
      processing_status: "queued",
      processing_started_at: null,
      execution_status: "pending",
      classification_status: "review_required",
      application_status: "pending",
      execution_notes: "Aguardando vinculacao manual da instancia.",
    });
    await updateIngestionJob(supabaseAdmin, inboxItem.ingestion_job_id, {
      status: "review_required",
      classification_status: "review_required",
      review_required: true,
      started_at: null,
    });
    return { processed: false, reason: "awaiting_link" };
  }

  const { data: instanceData, error: instanceError } = await supabaseAdmin
    .from("obligation_instances")
    .select("*")
    .eq("id", inboxItem.linked_instance_id)
    .single();

  if (instanceError || !instanceData) {
    await markInboxProcessingState(supabaseAdmin, inboxItem.id, {
      processing_status: "failed",
      processing_completed_at: now,
      execution_status: "failed",
      application_status: "failed",
      last_processing_error: instanceError?.message || "Instancia vinculada nao encontrada.",
      execution_notes: "Falha ao localizar a instancia vinculada para executar a obrigacao.",
    });
    await updateIngestionJob(supabaseAdmin, inboxItem.ingestion_job_id, {
      status: "failed",
      application_status: "failed",
      last_error: instanceError?.message || "Instancia vinculada nao encontrada.",
      completed_at: now,
    });
    return { processed: false, reason: "missing_instance" };
  }

  const instance = instanceData as InstanceRow;
  const templatesMap = await loadTemplatesMap(supabaseAdmin);
  const clientsMap = await loadClientsMap(supabaseAdmin);
  const template = templatesMap.get(instance.template_id);
  const client = clientsMap.get(instance.client_id);

  if (!template || !client) {
    await markInboxProcessingState(supabaseAdmin, inboxItem.id, {
      processing_status: "failed",
      processing_completed_at: now,
      execution_status: "failed",
      application_status: "failed",
      last_processing_error: "Template ou cliente da instancia nao encontrado.",
      execution_notes: "Falha ao carregar o contexto operacional da obrigacao.",
    });
    await updateIngestionJob(supabaseAdmin, inboxItem.ingestion_job_id, {
      status: "failed",
      application_status: "failed",
      last_error: "Template ou cliente da instancia nao encontrado.",
      completed_at: now,
    });
    return { processed: false, reason: "missing_context" };
  }

  const archivePath = buildOperationalArchivePath(client, template, instance, inboxItem.file_name);
  const source = inboxItem.matched_by || "manual_review";
  const triageStatus = source === "manual_review" ? "reviewed" : "accepted";

  const { error: fileError } = await supabaseAdmin
    .from("obligation_instance_files")
    .upsert({
      organization_id: inboxItem.organization_id || instance.organization_id,
      instance_id: instance.id,
      inbox_item_id: inboxItem.id,
      file_name: inboxItem.file_name,
      storage_bucket: inboxItem.storage_bucket,
      storage_path: inboxItem.storage_path,
      content_type: inboxItem.content_type,
      file_size: inboxItem.file_size,
      triage_status: triageStatus,
      source,
      source_kind: inboxItem.source_kind || "web_manual",
      uploaded_by: actorId,
      identification_confidence: Number(inboxItem.match_score || inboxItem.identification_confidence || 1),
      publication_status: "pending",
    }, { onConflict: "storage_bucket,storage_path" });

  if (fileError) {
    await markInboxProcessingState(supabaseAdmin, inboxItem.id, {
      processing_status: "failed",
      processing_completed_at: now,
      execution_status: "failed",
      application_status: "failed",
      last_processing_error: fileError.message,
      execution_notes: "Falha ao anexar o arquivo na instancia da obrigacao.",
    });
    await updateIngestionJob(supabaseAdmin, inboxItem.ingestion_job_id, {
      status: "failed",
      application_status: "failed",
      last_error: fileError.message,
      completed_at: now,
    });
    return { processed: false, reason: "file_upsert_failed" };
  }

  await createInstanceEvent(
    supabaseAdmin,
    instance.id,
    actorId,
    "document_received",
    null,
    null,
    `Documento ${inboxItem.file_name} recebido pela Central de Documentos.`,
    {
      inbox_item_id: inboxItem.id,
      document_type_key: inboxItem.document_type_key,
      matched_by: inboxItem.matched_by,
      archive_path: archivePath,
      source_kind: inboxItem.source_kind,
    },
  );

  const documentStatus = await determineInstanceDocumentStatus(supabaseAdmin, instance, template);
  const deliveryRequired = documentStatus === "concluida" && template.completion_email_enabled;
  const nextStatus = deliveryRequired ? "pronto_para_envio" : documentStatus;
  let updatedInstance = instance;
  const justCompleted = nextStatus === "concluida" && instance.status !== "concluida";
  const justReadyForDelivery = nextStatus === "pronto_para_envio" && instance.status !== "pronto_para_envio";
  const protocolNumber = justCompleted
    ? (instance.protocol || buildProtocolNumber(instance, inboxItem.id))
    : (instance.protocol || inboxItem.protocol_number || null);
  const protocolIssuedAt = justCompleted ? now : instance.protocol_issued_at;

  if (nextStatus !== instance.status || (justCompleted && !instance.protocol) || justReadyForDelivery) {
    const { data: updatedInstanceData, error: updateError } = await supabaseAdmin
      .from("obligation_instances")
      .update({
        status: nextStatus,
        completed_at: nextStatus === "concluida" ? now : null,
        protocol: nextStatus === "concluida" ? protocolNumber : instance.protocol,
        protocol_issued_at: nextStatus === "concluida" ? protocolIssuedAt : instance.protocol_issued_at,
        completed_by_inbox_item_id: nextStatus === "concluida" ? inboxItem.id : instance.completed_by_inbox_item_id,
        processed_automatically: nextStatus === "concluida" ? true : instance.processed_automatically,
        ready_for_delivery_at: nextStatus === "pronto_para_envio" ? now : null,
        last_status_at: now,
      })
      .eq("id", instance.id)
      .select("*")
      .single();

    if (updateError || !updatedInstanceData) {
      await markInboxProcessingState(supabaseAdmin, inboxItem.id, {
        processing_status: "failed",
        processing_completed_at: now,
        execution_status: "failed",
        application_status: "failed",
        last_processing_error: updateError?.message || "Falha ao atualizar o status da obrigacao.",
        execution_notes: "Documento anexado, mas a execucao automatica da obrigacao falhou.",
      });
      await updateIngestionJob(supabaseAdmin, inboxItem.ingestion_job_id, {
        status: "failed",
        application_status: "failed",
        last_error: updateError?.message || "Falha ao atualizar o status da obrigacao.",
        completed_at: now,
      });
      return { processed: false, reason: "instance_update_failed" };
    }

    updatedInstance = updatedInstanceData as InstanceRow;
    await createInstanceEvent(
      supabaseAdmin,
      instance.id,
      actorId,
      "status_change",
      instance.status,
      nextStatus,
      nextStatus === "em_revisao"
        ? "Documentos obrigatorios anexados. Tarefa enviada automaticamente para revisao."
        : deliveryRequired
        ? "Documentos obrigatorios anexados. Aguardando confirmacao humana para envio ao cliente."
        : "Status ajustado automaticamente apos recebimento do documento.",
      { inbox_item_id: inboxItem.id, protocol_number: protocolNumber, delivery_required: deliveryRequired },
    );
  }

  if (justCompleted && protocolNumber) {
    await createInstanceEvent(
      supabaseAdmin,
      instance.id,
      actorId,
      "protocol_issued",
      null,
      null,
      `Protocolo digital ${protocolNumber} emitido automaticamente pela Grow.`,
      {
        inbox_item_id: inboxItem.id,
        protocol_number: protocolNumber,
        protocol_issued_at: protocolIssuedAt,
      },
    );
  }

  await syncInstanceArtifacts(supabaseAdmin, updatedInstance, template, client.name);

  const communicationStatus = deliveryRequired ? "pending" : "not_applicable";
  let executionNotes = nextStatus === "aguardando_documento"
    ? "Documento anexado. A obrigacao ainda aguarda outros documentos obrigatorios."
    : nextStatus === "em_revisao"
      ? "Documento esperado anexado na competencia correta. Tarefa enviada automaticamente para revisao."
      : deliveryRequired
        ? "Documento anexado. Obrigacao pronta para revisao e envio manual ao cliente."
        : "Documento anexado e obrigacao concluida automaticamente.";
  if (protocolNumber && nextStatus === "concluida") {
    executionNotes = `${executionNotes} Protocolo ${protocolNumber}.`;
  }

  await markInboxProcessingState(supabaseAdmin, inboxItem.id, {
    processing_status: "processed",
    processing_completed_at: now,
    execution_status: "applied",
    classification_status: "classified",
    application_status: "applied",
    communication_status: communicationStatus,
    publication_status: deliveryRequired ? "pending" : "published",
    execution_notes: executionNotes,
    archive_path: archivePath,
    last_processing_error: null,
    protocol_number: protocolNumber,
    protocol_issued_at: protocolIssuedAt,
    processed_automatically: true,
  });

  const { error: publishError } = await supabaseAdmin
    .from("obligation_instance_files")
    .update({
      protocol_number: protocolNumber,
      publication_status: deliveryRequired ? "pending" : "published",
    })
    .eq("storage_bucket", inboxItem.storage_bucket)
    .eq("storage_path", inboxItem.storage_path);

  if (publishError) throw publishError;

  await updateIngestionJob(supabaseAdmin, inboxItem.ingestion_job_id, {
    status: "completed",
    classification_status: "classified",
    application_status: "applied",
    communication_status: communicationStatus,
    publication_status: deliveryRequired ? "pending" : "published",
    protocol_number: protocolNumber,
    protocol_issued_at: protocolIssuedAt,
    review_required: false,
    instance_id: updatedInstance.id,
    detected_client_id: client.id,
    inbox_item_id: inboxItem.id,
    completed_at: now,
  });

  return { processed: true, nextStatus, archivePath, protocolNumber, communicationStatus, deliveryRequired };
}

async function syncInstanceArtifacts(
  supabaseAdmin: SupabaseAdmin,
  instance: InstanceRow,
  template: TemplateRow,
  clientName: string,
) {
  const obligationTitle = `${template.name} · ${clientName}`;
  const integrationKey = `instance:${instance.id}`;
  const taskIntegrationKey = `instance:${instance.id}`;
  const instanceDone = instance.status === "concluida" || instance.status === "cancelada";
  const dueDate = `${instance.technical_due_date}T09:00:00.000Z`;
  const organizationId = resolveRowOrganizationId(instance, template);
  if (!organizationId) {
    throw new Error("Organizacao da instancia de obrigacao nao encontrada para sincronizar calendario e tarefas.");
  }

  const payload = {
    organization_id: organizationId,
    title: `${template.name} · ${instance.competence_label}`,
    description: `${clientName}\nCompetência: ${instance.competence_label}`,
    entry_type: "obrigacao",
    priority: instance.priority,
    sector: template.sector,
    due_at: dueDate,
    all_day: true,
    status: instanceDone ? "completed" : "pending",
    integration_source: "grow_obligation",
    integration_key: integrationKey,
  };

  const { data: existingEvent, error: eventLookupError } = await supabaseAdmin
    .from("calendar_events")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("integration_source", "grow_obligation")
    .eq("integration_key", integrationKey)
    .maybeSingle();

  if (eventLookupError) throw eventLookupError;

  if (existingEvent?.id) {
    const { error } = await supabaseAdmin
      .from("calendar_events")
      .update(payload)
      .eq("id", existingEvent.id);
    if (error) throw error;
  } else {
    const { error } = await supabaseAdmin.from("calendar_events").insert(payload);
    if (error) throw error;
  }

  const { data: existingTask, error: taskLookupError } = await supabaseAdmin
    .from("kanban_tasks")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("integration_source", "grow_obligation_task")
    .eq("integration_task_id", taskIntegrationKey)
    .maybeSingle();

  if (taskLookupError) throw taskLookupError;

  const taskStatus =
    instance.status === "concluida" || instance.status === "cancelada"
      ? "done"
      : instance.status === "em_revisao"
        ? "review"
        : instance.status === "em_andamento"
          ? "doing"
          : instance.status === "atrasada"
            ? "todo"
            : "backlog";

  const taskPayload = {
    organization_id: organizationId,
    title: obligationTitle,
    description: `Obrigação Grow\nCompetência: ${instance.competence_label}`,
    sector: template.sector,
    client_name: clientName,
    assignee: instance.current_assignee,
    assigned_to_user_id: asUuid(instance.current_assignee),
    priority: instance.priority,
    status: taskStatus,
    due_date: instance.technical_due_date,
    integration_source: "grow_obligation_task",
    integration_task_id: taskIntegrationKey,
    integration_payload: {
      instance_id: instance.id,
      template_id: template.id,
      profile_id: instance.profile_id,
    },
  };

  if (existingTask?.id) {
    const { error } = await supabaseAdmin.from("kanban_tasks").update(taskPayload).eq("id", existingTask.id);
    if (error) throw error;
    return;
  }

  const { error } = await supabaseAdmin.from("kanban_tasks").insert(taskPayload);
  if (error) throw error;
}

async function ensureInstancesForProfiles(
  supabaseAdmin: SupabaseAdmin,
  profiles: ProfileRow[],
  templatesMap: Map<string, TemplateRow>,
  actorId: string,
  windowStart: Date,
  windowEnd: Date,
  targetCompetenceKey?: string,
) {
  if (profiles.length === 0) return { created: 0 };

  const profileIds = profiles.map((profile) => profile.id);
  const { data: existingRows, error: existingError } = await supabaseAdmin
    .from("obligation_instances")
    .select("id, client_id, template_id, competence_key")
    .in("profile_id", profileIds);

  if (existingError) throw existingError;

  const existingKeys = new Set(
    (existingRows || []).map((row) =>
      `${String((row as JsonRecord).client_id)}::${String((row as JsonRecord).template_id)}::${String((row as JsonRecord).competence_key)}`,
    ),
  );

  const inserts: JsonRecord[] = [];

  for (const profile of profiles) {
    if (!profile.is_active) continue;
    const template = templatesMap.get(profile.template_id);
    if (!template || !template.is_active) continue;

    const assignedStart = new Date(`${profile.start_date}T00:00:00.000Z`);
    const assignedStartMonth = new Date(Date.UTC(assignedStart.getUTCFullYear(), assignedStart.getUTCMonth(), 1));
    const assignedEnd = profile.end_date ? new Date(`${profile.end_date}T00:00:00.000Z`) : null;
    const assignedEndMonth = assignedEnd
      ? new Date(Date.UTC(assignedEnd.getUTCFullYear(), assignedEnd.getUTCMonth(), 1))
      : null;

    const cursor = new Date(Date.UTC(windowStart.getUTCFullYear(), windowStart.getUTCMonth(), 1));
    while (cursor <= windowEnd) {
      const currentCompetenceDate = computeCompetenceDate(
        template.periodicity,
        cursor,
        template.competence_reference,
        profile.yearly_due_month_override ?? template.yearly_due_month,
      );

      const currentCompetenceKey = competenceKey(currentCompetenceDate);
      const currentCompetenceLabel = monthLabel(currentCompetenceDate);
      const currentCompetenceTime = currentCompetenceDate.getTime();

      if (targetCompetenceKey && currentCompetenceKey !== targetCompetenceKey) {
        cursor.setUTCMonth(cursor.getUTCMonth() + 1);
        continue;
      }

      if (currentCompetenceTime < assignedStartMonth.getTime()) {
        cursor.setUTCMonth(cursor.getUTCMonth() + 1);
        continue;
      }

      if (assignedEndMonth && currentCompetenceTime > assignedEndMonth.getTime()) {
        cursor.setUTCMonth(cursor.getUTCMonth() + 1);
        continue;
      }

      if (template.periodicity === "quarterly" && ![0, 3, 6, 9].includes(currentCompetenceDate.getUTCMonth())) {
        cursor.setUTCMonth(cursor.getUTCMonth() + 1);
        continue;
      }

      if (template.periodicity === "yearly" && currentCompetenceDate.getUTCMonth() !== (profile.yearly_due_month_override ?? template.yearly_due_month ?? 1) - 1) {
        cursor.setUTCMonth(cursor.getUTCMonth() + 1);
        continue;
      }

      const uniqueKey = `${profile.client_id}::${profile.template_id}::${currentCompetenceKey}`;
      if (!existingKeys.has(uniqueKey)) {
        const technicalDueDate = computeDueDate(
          currentCompetenceDate,
          profile.due_day_override ?? template.due_day,
          normalizeMonthReference(template.technical_due_month_reference, "vigente"),
        );
        const legalDueDate = template.legal_due_day
          ? computeDueDate(currentCompetenceDate, profile.legal_due_day_override ?? template.legal_due_day)
          : null;

        inserts.push({
          organization_id: profile.organization_id || template.organization_id,
          client_id: profile.client_id,
          profile_id: profile.id,
          template_id: profile.template_id,
          competence_label: currentCompetenceLabel,
          competence_date: toIsoDate(currentCompetenceDate),
          competence_key: currentCompetenceKey,
          technical_due_date: toIsoDate(technicalDueDate),
          legal_due_date: legalDueDate ? toIsoDate(legalDueDate) : null,
          status: "pendente",
          priority: template.priority,
          current_assignee: profile.assigned_to,
          origin: "grow_native",
          document_required: true,
          created_by: actorId,
        });
        existingKeys.add(uniqueKey);
      }

      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }
  }

  if (inserts.length === 0) return { created: 0 };

  const { data: insertedInstances, error: insertError } = await supabaseAdmin
    .from("obligation_instances")
    .insert(inserts)
    .select("*");

  if (insertError) throw insertError;

  const clientsMap = await loadClientsMap(supabaseAdmin);
  for (const row of (insertedInstances || []) as InstanceRow[]) {
    const template = templatesMap.get(row.template_id);
    const client = clientsMap.get(row.client_id);
    if (!template || !client) continue;
    await createInstanceEvent(
      supabaseAdmin,
      row.id,
      actorId,
      "instance_created",
      null,
      row.status,
      `Competência ${row.competence_label} gerada automaticamente.`,
    );
    await syncInstanceArtifacts(supabaseAdmin, row, template, client.name);
  }

  return { created: inserts.length };
}

async function markOverdueInstances(supabaseAdmin: SupabaseAdmin, actorId: string) {
  const today = toIsoDate(new Date());
  const { data: dueRows, error } = await supabaseAdmin
    .from("obligation_instances")
    .select("*")
    .lt("technical_due_date", today)
    .in("status", ["pendente", "em_andamento", "aguardando_documento", "em_revisao"]);

  if (error) throw error;

  const rows = (dueRows || []) as InstanceRow[];
  if (rows.length === 0) return 0;

  const templatesMap = await loadTemplatesMap(supabaseAdmin);
  const clientsMap = await loadClientsMap(supabaseAdmin);

  for (const row of rows) {
    const { error: updateError } = await supabaseAdmin
      .from("obligation_instances")
      .update({ status: "atrasada", last_status_at: new Date().toISOString() })
      .eq("id", row.id);
    if (updateError) throw updateError;

    await createInstanceEvent(
      supabaseAdmin,
      row.id,
      actorId,
      "status_change",
      row.status,
      "atrasada",
      "Obrigação marcada como atrasada automaticamente.",
    );

    const template = templatesMap.get(row.template_id);
    const client = clientsMap.get(row.client_id);
    if (template && client) {
      await syncInstanceArtifacts(
        supabaseAdmin,
        { ...row, status: "atrasada" },
        template,
        client.name,
      );
    }
  }

  return rows.length;
}

async function buildOverview(
  supabaseAdmin: SupabaseAdmin,
  actorId: string,
  organizationId: string,
  filters: JsonRecord = {},
) {
  const skipOperationalSync = asBoolean(filters.skip_operational_sync, false);
  const templatesMap = new Map(
    filterByOrganization(Array.from((await loadTemplatesMap(supabaseAdmin, organizationId)).values()) as unknown as JsonRecord[], organizationId)
      .map((template) => [String(template.id), template as unknown as TemplateRow]),
  );
  const profilesMap = new Map(
    filterByOrganization(Array.from((await loadProfilesMap(supabaseAdmin, organizationId)).values()) as unknown as JsonRecord[], organizationId)
      .map((profile) => [String(profile.id), profile as unknown as ProfileRow]),
  );
  const clientsMap = new Map(
    filterByOrganization(Array.from((await loadClientsMap(supabaseAdmin, organizationId)).values()) as unknown as JsonRecord[], organizationId)
      .map((client) => [String(client.id), client]),
  );
  const referenceFiles = await loadReferenceFilesMap(supabaseAdmin, organizationId, {
    includeAnalysisPayload: !skipOperationalSync,
  });
  const overviewWarnings: string[] = [];

  const currentGenerationWindow = currentCompetenceGenerationWindow();

  if (!skipOperationalSync) {
    try {
      await ensureInstancesForProfiles(
        supabaseAdmin,
        Array.from(profilesMap.values()),
        templatesMap,
        actorId,
        currentGenerationWindow.cursorStart,
        currentGenerationWindow.cursorEnd,
        currentGenerationWindow.targetCompetenceKey,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao sincronizar competencias.";
      overviewWarnings.push(`Sincronizacao de competencias nao concluida: ${message}`);
      console.error("grow-obligations overview ensureInstancesForProfiles failed", { message });
    }

    try {
      await markOverdueInstances(supabaseAdmin, actorId);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao atualizar atrasos.";
      overviewWarnings.push(`Atualizacao de atrasos nao concluida: ${message}`);
      console.error("grow-obligations overview markOverdueInstances failed", { message });
    }
  }

  let documentsQuery = supabaseAdmin
    .from("document_inbox_items")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(120);
  const documentStatus = asTrimmedString(filters.document_status);
  const documentClientId = asTrimmedString(filters.document_client_id);
  const documentTemplateId = asTrimmedString(filters.document_template_id);
  const documentCompetence = asTrimmedString(filters.document_competence);
  const documentSenderUserId = asTrimmedString(filters.document_sender_user_id);
  if (documentStatus && documentStatus !== "all") documentsQuery = documentsQuery.eq("status", documentStatus);
  if (documentClientId && documentClientId !== "all") documentsQuery = documentsQuery.eq("client_id", documentClientId);
  if (documentTemplateId && documentTemplateId !== "all") documentsQuery = documentsQuery.eq("suggested_template_id", documentTemplateId);
  if (documentCompetence) documentsQuery = documentsQuery.ilike("suggested_competence_label", `%${documentCompetence}%`);
  if (documentSenderUserId && documentSenderUserId !== "all") documentsQuery = documentsQuery.eq("created_by", documentSenderUserId);

  const [
    { data: instancesData, error: instancesError },
    { data: docsData, error: docsError },
    { data: attemptsData, error: attemptsError },
    ingestionJobs,
  ] = await Promise.all([
    supabaseAdmin
      .from("obligation_instances")
      .select("*")
      .eq("organization_id", organizationId)
      .order("technical_due_date", { ascending: true })
      .limit(240),
    documentsQuery,
    supabaseAdmin
      .from("obligation_delivery_attempts")
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(200),
    loadIngestionJobs(supabaseAdmin, organizationId),
  ]);

  if (instancesError) throw instancesError;
  if (docsError) throw docsError;
  if (attemptsError) throw attemptsError;

  const templates = Array.from(templatesMap.values()).map((template) => ({
    ...template,
    expected_documents: enrichExpectedDocuments(template, referenceFiles.byTemplateDocument),
  }));

  const profiles = Array.from(profilesMap.values()).map((profile) => ({
    ...profile,
    expected_documents_override: profile.expected_documents_override
      ? asExpectedDocuments(profile.expected_documents_override)
      : null,
    template: templatesMap.get(profile.template_id) || null,
    client: clientsMap.get(profile.client_id) || null,
  }));

  const deliveryAttempts = ((attemptsData || []) as Array<JsonRecord>).map((attempt) => ({
    ...attempt,
    metadata: asJsonRecord(attempt.metadata),
  }));
  const attemptsByInstance = new Map<string, Array<JsonRecord>>();
  for (const attempt of deliveryAttempts) {
    const instanceId = String(attempt.instance_id || "");
    if (!instanceId) continue;
    const list = attemptsByInstance.get(instanceId) || [];
    list.push(attempt);
    attemptsByInstance.set(instanceId, list);
  }

  const instances = ((instancesData || []) as InstanceRow[]).map((instance) => ({
    ...instance,
    template: templatesMap.get(instance.template_id) || null,
    client: clientsMap.get(instance.client_id) || null,
    profile: profilesMap.get(instance.profile_id) || null,
    delivery_attempts: attemptsByInstance.get(instance.id) || [],
    latest_delivery_attempt: attemptsByInstance.get(instance.id)?.[0] || null,
  }));

  if (!skipOperationalSync) {
    try {
      for (const instance of instances) {
        const template = templatesMap.get(instance.template_id);
        const client = clientsMap.get(instance.client_id);
        if (!template || !client) continue;
        await syncInstanceArtifacts(supabaseAdmin, instance as InstanceRow, template, String((client as JsonRecord).name || "Cliente"));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao sincronizar calendario e tarefas.";
      overviewWarnings.push(`Sincronizacao de calendario/tarefas nao concluida: ${message}`);
      console.error("grow-obligations overview syncInstanceArtifacts failed", { message });
    }
  }

  const documents = (docsData || []).map((item) => {
    const row = item as JsonRecord;
    return {
      ...row,
      client: clientsMap.get(String(row.client_id || row.suggested_client_id || "")) || null,
      detected_client: clientsMap.get(String(row.detected_client_id || "")) || null,
      template: templatesMap.get(String(row.suggested_template_id || "")) || null,
      linked_instance: instances.find((instance) => instance.id === String(row.linked_instance_id || row.suggested_instance_id || "")) || null,
      document_definition: resolveExpectedDocument(
        templatesMap.get(String(row.suggested_template_id || "")) || null,
        asTrimmedString(row.document_type_key),
      ),
      match_reasons: asStringArray(row.match_reasons),
      matched_by: asTrimmedString(row.matched_by),
      match_score: Number(row.match_score || 0),
      detected_cnpj: normalizeCnpj(asTrimmedString(row.detected_cnpj)),
      competence_detected: asTrimmedString(row.competence_detected),
      reference_file_id: asTrimmedString(row.reference_file_id),
      reference_match_score: Number(row.reference_match_score || 0),
      reference_match_reasons: asStringArray(row.reference_match_reasons),
      review_required: asBoolean(row.review_required, true),
      text_extraction_status: asTrimmedString(row.text_extraction_status) || "pending",
      ocr_status: asTrimmedString(row.ocr_status) || "pending",
      extracted_text_preview: asTrimmedString(row.extracted_text_preview),
      auto_link_block_reason: asTrimmedString(row.auto_link_block_reason),
      processing_status: asTrimmedString(row.processing_status) || "queued",
      processing_attempts: asInteger(row.processing_attempts, 0) || 0,
      processing_started_at: asTrimmedString(row.processing_started_at),
      processing_completed_at: asTrimmedString(row.processing_completed_at),
      last_processing_error: asTrimmedString(row.last_processing_error),
      execution_status: asTrimmedString(row.execution_status) || "pending",
      classification_status: asTrimmedString(row.classification_status) || "queued",
      application_status: asTrimmedString(row.application_status) || "pending",
      communication_status: asTrimmedString(row.communication_status) || "pending",
      publication_status: asTrimmedString(row.publication_status) || "pending",
      execution_notes: asTrimmedString(row.execution_notes),
      archive_path: asTrimmedString(row.archive_path),
      ingestion_job_id: asTrimmedString(row.ingestion_job_id),
      source_kind: normalizeSourceKind(row.source_kind),
      file_hash: asTrimmedString(row.file_hash),
      robot_origin_path: asTrimmedString(row.robot_origin_path),
      robot_machine_id: asTrimmedString(row.robot_machine_id),
      protocol_number: asTrimmedString(row.protocol_number),
      protocol_issued_at: asTrimmedString(row.protocol_issued_at),
      processed_automatically: asBoolean(row.processed_automatically, false),
      reference_file: referenceFiles.byId.get(String(row.reference_file_id || "")) || null,
    };
  });

  const jobs = ingestionJobs.filter((job) => !job.organization_id || job.organization_id === organizationId).map((job) => ({
    ...job,
    source_kind: normalizeSourceKind(job.source_kind),
    metadata: asJsonRecord(job.metadata),
    review_required: asBoolean(job.review_required, false),
  }));

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const summary = {
    templates_total: templates.length,
    templates_active: templates.filter((template) => template.is_active).length,
    active_profiles: profiles.filter((profile) => profile.is_active).length,
    pending_instances: instances.filter((instance) => instance.status === "pendente").length,
    overdue_instances: instances.filter((instance) => instance.status === "atrasada").length,
    waiting_documents: instances.filter((instance) => instance.status === "aguardando_documento").length,
    done_instances: instances.filter((instance) => instance.status === "concluida").length,
    inbox_pending: documents.filter((item) => item.status === "pending_review").length,
    inbox_processing: documents.filter((item) => item.processing_status === "processing" || item.processing_status === "queued").length,
    inbox_failed: documents.filter((item) => item.processing_status === "failed").length,
    inbox_applied: documents.filter((item) => item.execution_status === "applied").length,
    robot_received_today: jobs.filter((job) => job.source_kind === "local_robot" && new Date(job.created_at) >= startOfToday).length,
    robot_completed_today: jobs.filter((job) => job.source_kind === "local_robot" && job.status === "completed" && job.completed_at && new Date(job.completed_at) >= startOfToday).length,
    robot_review_required: jobs.filter((job) => job.source_kind === "local_robot" && job.status === "review_required").length,
    robot_failed_total: jobs.filter((job) => job.source_kind === "local_robot" && job.status === "failed").length,
  };

  return {
    ok: true,
    summary,
    clients: Array.from(clientsMap.values()),
    templates,
    profiles,
    instances,
    documents,
    ingestion_jobs: jobs,
    delivery_attempts: deliveryAttempts,
    warnings: overviewWarnings,
  };
}

async function handleUpsertTemplate(
  supabaseAdmin: SupabaseAdmin,
  actorId: string,
  roles: string[],
  organizationId: string,
  payload: JsonRecord,
) {
  if (!roles.some((role) => templateManagerRoles.has(role))) {
    return jsonResponse({ error: "Only admin, director, or manager can manage templates" }, 403);
  }

  const id = asTrimmedString(payload.id);
  const name = asTrimmedString(payload.name);
  const codeSource = asTrimmedString(payload.code) || name;
  if (!name || !codeSource) {
    return jsonResponse({ error: "Nome e código da obrigação são obrigatórios." }, 400);
  }

  const expectedDocuments = asExpectedDocuments(payload.expected_documents);
  const activeDocumentKeys = expectedDocuments
    .filter((document) => document.active)
    .map((document) => document.document_type_key);
  if (new Set(activeDocumentKeys).size !== activeDocumentKeys.length) {
    return jsonResponse({ error: "Documentos esperados ativos nao podem ter chaves duplicadas." }, 400);
  }

  const emailEnabled = asBoolean(payload.completion_email_enabled, false);
  const emailSubject = asTrimmedString(payload.completion_email_subject);
  const emailBody = asTrimmedString(payload.completion_email_body);
  if (emailEnabled && (!emailSubject || !emailBody)) {
    return jsonResponse({ error: "Envio por e-mail exige assunto e mensagem padrao." }, 400);
  }

  if (id) {
    const { data: existingTemplateData, error: existingTemplateError } = await supabaseAdmin
      .from("obligation_templates")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("id", id)
      .maybeSingle();

    if (existingTemplateError) return jsonResponse({ error: existingTemplateError.message }, 400);
    if (!existingTemplateData) return jsonResponse({ error: "Obrigacao nao encontrada." }, 404);

    const existingTemplate = existingTemplateData as TemplateRow;
    const baselineSource = asTrimmedString(existingTemplate.baseline_source);
    if (baselineSource && baselineSource !== "manual") {
      const systemMessageUpdate = {
        completion_email_enabled: emailEnabled,
        completion_email_subject: emailSubject,
        completion_email_body: emailBody,
        completion_whatsapp_enabled: asBoolean(payload.completion_whatsapp_enabled, false),
        completion_whatsapp_body: asTrimmedString(payload.completion_whatsapp_body),
      };

      const { data: updatedSystemTemplate, error: updateSystemError } = await supabaseAdmin
        .from("obligation_templates")
        .update(systemMessageUpdate)
        .eq("organization_id", organizationId)
        .eq("id", id)
        .select("*")
        .single();

      if (updateSystemError) return jsonResponse({ error: updateSystemError.message }, 400);

      await auditObligationEvent(supabaseAdmin, {
        organizationId,
        templateId: id,
        action: "system_default_template_messages_updated",
        actorId,
        metadata: { baseline_source: baselineSource },
      });

      return jsonResponse({ ok: true, template: updatedSystemTemplate });
    }
  }

  const { data: duplicateTemplatesData, error: duplicateTemplatesError } = await supabaseAdmin
    .from("obligation_templates")
    .select("id, code, name, normalized_name, is_active, baseline_source")
    .eq("organization_id", organizationId)
    .eq("is_active", true);

  if (duplicateTemplatesError) return jsonResponse({ error: duplicateTemplatesError.message }, 400);

  const normalizedCode = normalizeDuplicateCode(codeSource);
  const normalizedName = normalizeDuplicateText(name);
  const duplicateMatches = ((duplicateTemplatesData || []) as Array<JsonRecord>)
    .filter((template) => asTrimmedString(template.id) !== id)
    .map((template) => {
      const templateCode = normalizeDuplicateCode(template.code);
      const templateName = normalizeDuplicateText(asTrimmedString(template.normalized_name) || template.name);
      if (normalizedCode && templateCode && normalizedCode === templateCode) {
        return {
          template_id: template.id,
          code: template.code,
          name: template.name,
          baseline_source: template.baseline_source,
          match_type: "code",
          severity: "block",
        };
      }
      if (normalizedName && templateName && normalizedName === templateName) {
        return {
          template_id: template.id,
          code: template.code,
          name: template.name,
          baseline_source: template.baseline_source,
          match_type: "normalized_name",
          severity: "block",
        };
      }
      if (normalizedName && templateName && (normalizedName.includes(templateName) || templateName.includes(normalizedName))) {
        return {
          template_id: template.id,
          code: template.code,
          name: template.name,
          baseline_source: template.baseline_source,
          match_type: "semantic",
          severity: "review",
        };
      }
      return null;
    })
    .filter(Boolean);

  const blockingDuplicates = duplicateMatches.filter((match) => asRecord(match)?.severity === "block");
  if (blockingDuplicates.length > 0 && !asBoolean(payload.confirm_duplicate, false)) {
    return jsonResponse(
      {
        error: "Ja existe uma obrigacao ativa com mesmo codigo ou nome normalizado.",
        duplicate_matches: blockingDuplicates,
      },
      409,
    );
  }

  const row = {
    organization_id: organizationId,
    code: normalizeTemplateCode(codeSource),
    name,
    sector: asTrimmedString(payload.sector) || "Geral",
    periodicity: asTrimmedString(payload.periodicity) || "monthly",
    competence_reference: asTrimmedString(payload.competence_reference) || "vigente",
    technical_due_month_reference: normalizeMonthReference(payload.technical_due_month_reference, "vigente"),
    due_day: asInteger(payload.due_day, 10),
    yearly_due_month: asInteger(payload.yearly_due_month, null),
    legal_due_day: asInteger(payload.legal_due_day, null),
    priority: asTrimmedString(payload.priority) || "media",
    expected_documents: expectedDocuments,
    is_active: asBoolean(payload.is_active, true),
    generates_calendar: true,
    generates_kanban: true,
    requires_document: true,
    operational_notes: asTrimmedString(payload.operational_notes),
    completion_email_enabled: emailEnabled,
    completion_email_subject: emailSubject,
    completion_email_body: emailBody,
    completion_whatsapp_enabled: asBoolean(payload.completion_whatsapp_enabled, false),
    completion_whatsapp_body: asTrimmedString(payload.completion_whatsapp_body),
    created_by: actorId,
    ...(id ? {} : { baseline_source: "manual", catalog_review_status: "approved" }),
  };

  const query = id
    ? supabaseAdmin.from("obligation_templates").update(row).eq("organization_id", organizationId).eq("id", id).select("*").single()
    : supabaseAdmin.from("obligation_templates").insert(row).select("*").single();

  const { data, error } = await query;
  if (error) return jsonResponse({ error: error.message }, 400);

  const template = data as TemplateRow;
  const linkedClientIds = Array.from(new Set(asStringArray(payload.linked_client_ids)));

  await auditObligationEvent(supabaseAdmin, {
    organizationId,
    templateId: template.id,
    action: id ? "manual_obligation_template_updated" : "manual_obligation_template_created",
    actorId,
    metadata: {
      linked_client_ids: linkedClientIds,
      duplicate_warnings: duplicateMatches.filter((match) => asRecord(match)?.severity === "review"),
    },
  });

  if ("linked_client_ids" in payload) {
    const { data: existingProfilesData, error: existingProfilesError } = await supabaseAdmin
      .from("client_obligation_profiles")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("template_id", template.id);

    if (existingProfilesError) return jsonResponse({ error: existingProfilesError.message }, 400);

    const existingProfiles = (existingProfilesData || []) as ProfileRow[];
    const existingProfilesByClientId = new Map(existingProfiles.map((profile) => [profile.client_id, profile]));
    const today = toIsoDate(new Date());
    const templatesMap = await loadTemplatesMap(supabaseAdmin);
    const activatedProfiles: ProfileRow[] = [];

    for (const clientId of linkedClientIds) {
      const existingProfile = existingProfilesByClientId.get(clientId);
      const profileRow = {
        organization_id: organizationId,
        client_id: clientId,
        template_id: template.id,
        assigned_to: existingProfile?.assigned_to || null,
        start_date: existingProfile?.start_date || today,
        end_date: null,
        is_active: true,
        due_day_override: existingProfile?.due_day_override ?? null,
        yearly_due_month_override: existingProfile?.yearly_due_month_override ?? null,
        legal_due_day_override: existingProfile?.legal_due_day_override ?? null,
        expected_documents_override: existingProfile?.expected_documents_override ?? null,
        notes: existingProfile?.notes || null,
        parameters: asRecord(existingProfile?.parameters) || {},
        source_kind: "manual",
        source_load_id: null,
        source_load_item_id: null,
        applied_regime: null,
        application_batch_id: null,
        inactivation_reason: null,
        sync_status: "current",
        conditional_review_reason: null,
        conditional_skip_reason: null,
        created_by: actorId,
      };

      const { data: syncedProfile, error: syncedProfileError } = await supabaseAdmin
        .from("client_obligation_profiles")
        .upsert(profileRow, { onConflict: "client_id,template_id" })
        .select("*")
        .single();

      if (syncedProfileError) return jsonResponse({ error: syncedProfileError.message }, 400);
      activatedProfiles.push(syncedProfile as ProfileRow);
      await auditObligationEvent(supabaseAdmin, {
        organizationId,
        clientId,
        templateId: template.id,
        action: "manual_obligation_linked_to_client",
        actorId,
        metadata: { source: "template_linked_client_ids" },
      });
    }

    const profilesToDeactivate = existingProfiles.filter(
      (profile) => profile.is_active && !linkedClientIds.includes(profile.client_id),
    );

    for (const profile of profilesToDeactivate) {
      const { error: deactivateError } = await supabaseAdmin
        .from("client_obligation_profiles")
        .update({
          is_active: false,
          end_date: profile.end_date || today,
        })
        .eq("id", profile.id);

      if (deactivateError) return jsonResponse({ error: deactivateError.message }, 400);
    }

    if (activatedProfiles.length > 0) {
      const currentGenerationWindow = currentCompetenceGenerationWindow();
      await ensureInstancesForProfiles(
        supabaseAdmin,
        activatedProfiles,
        templatesMap,
        actorId,
        currentGenerationWindow.cursorStart,
        currentGenerationWindow.cursorEnd,
        currentGenerationWindow.targetCompetenceKey,
      );
    }
  }

  return jsonResponse({ ok: true, template: data });
}

async function handleDeleteTemplate(
  supabaseAdmin: SupabaseAdmin,
  actorId: string,
  roles: string[],
  organizationId: string,
  payload: JsonRecord,
) {
  if (!roles.some((role) => templateManagerRoles.has(role))) {
    return jsonResponse({ error: "Only admin, director, or manager can delete templates" }, 403);
  }

  const templateId = asTrimmedString(payload.template_id || payload.id);
  if (!templateId) return jsonResponse({ error: "Obrigacao obrigatoria para exclusao." }, 400);

  const { data: templateData, error: templateError } = await supabaseAdmin
    .from("obligation_templates")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("id", templateId)
    .maybeSingle();

  if (templateError) return jsonResponse({ error: templateError.message }, 400);
  if (!templateData) return jsonResponse({ error: "Obrigacao nao encontrada." }, 404);

  const template = templateData as TemplateRow;
  const baselineSource = asTrimmedString(template.baseline_source);
  if (baselineSource && baselineSource !== "manual") {
    return jsonResponse(
      { error: "Obrigacoes padrao do sistema nao podem ser excluidas pela interface. Inative apenas obrigacoes manuais complementares." },
      403,
    );
  }

  const [profilesResult, instancesResult, documentsResult, referencesResult, loadItemsResult] = await Promise.all([
    supabaseAdmin
      .from("client_obligation_profiles")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("template_id", templateId),
    supabaseAdmin
      .from("obligation_instances")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("template_id", templateId),
    supabaseAdmin
      .from("document_inbox_items")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("suggested_template_id", templateId),
    supabaseAdmin
      .from("expected_document_reference_files")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("template_id", templateId),
    supabaseAdmin
      .from("obligation_regime_load_items")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("template_id", templateId),
  ]);

  const countError =
    profilesResult.error ||
    instancesResult.error ||
    documentsResult.error ||
    referencesResult.error ||
    loadItemsResult.error;
  if (countError) return jsonResponse({ error: countError.message }, 400);

  const usage = {
    profiles: profilesResult.count || 0,
    instances: instancesResult.count || 0,
    documents: documentsResult.count || 0,
    reference_files: referencesResult.count || 0,
    regime_load_items: loadItemsResult.count || 0,
  };
  const hasHistory = Object.values(usage).some((count) => count > 0);

  if (!hasHistory) {
    const { error: deleteError } = await supabaseAdmin
      .from("obligation_templates")
      .delete()
      .eq("organization_id", organizationId)
      .eq("id", templateId);

    if (deleteError) return jsonResponse({ error: deleteError.message }, 400);
    return jsonResponse({ ok: true, mode: "deleted", usage });
  }

  const now = new Date().toISOString();
  const today = toIsoDate(new Date());
  const deletionNote = `Excluida/inativada em ${today} por solicitacao operacional.`;
  const nextNotes = [asTrimmedString(template.operational_notes), deletionNote].filter(Boolean).join("\n\n");

  const { error: templateUpdateError } = await supabaseAdmin
    .from("obligation_templates")
    .update({
      is_active: false,
      catalog_review_status: "inactive",
      operational_notes: nextNotes,
      updated_at: now,
    })
    .eq("organization_id", organizationId)
    .eq("id", templateId);

  if (templateUpdateError) return jsonResponse({ error: templateUpdateError.message }, 400);

  const { error: profilesUpdateError } = await supabaseAdmin
    .from("client_obligation_profiles")
    .update({
      is_active: false,
      end_date: today,
      inactivation_reason: "template_deleted",
      sync_status: "not_applicable",
      updated_at: now,
    })
    .eq("organization_id", organizationId)
    .eq("template_id", templateId)
    .eq("is_active", true);

  if (profilesUpdateError) return jsonResponse({ error: profilesUpdateError.message }, 400);

  const { error: loadItemsUpdateError } = await supabaseAdmin
    .from("obligation_regime_load_items")
    .update({
      is_active: false,
      notes: deletionNote,
      updated_at: now,
    })
    .eq("organization_id", organizationId)
    .eq("template_id", templateId)
    .eq("is_active", true);

  if (loadItemsUpdateError) return jsonResponse({ error: loadItemsUpdateError.message }, 400);

  const { data: openInstancesData, error: openInstancesError } = await supabaseAdmin
    .from("obligation_instances")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("template_id", templateId)
    .not("status", "in", "(concluida,cancelada)");

  if (openInstancesError) return jsonResponse({ error: openInstancesError.message }, 400);

  const openInstances = (openInstancesData || []) as InstanceRow[];
  if (openInstances.length > 0) {
    const { data: cancelledInstancesData, error: cancelError } = await supabaseAdmin
      .from("obligation_instances")
      .update({
        status: "cancelada",
        completion_notes: deletionNote,
        last_status_at: now,
        updated_at: now,
      })
      .eq("organization_id", organizationId)
      .eq("template_id", templateId)
      .not("status", "in", "(concluida,cancelada)")
      .select("*");

    if (cancelError) return jsonResponse({ error: cancelError.message }, 400);

    const clientsMap = await loadClientsMap(supabaseAdmin);
    for (const instance of (cancelledInstancesData || []) as InstanceRow[]) {
      const previous = openInstances.find((current) => current.id === instance.id);
      await createInstanceEvent(
        supabaseAdmin,
        instance.id,
        actorId,
        "template_deleted",
        previous?.status || null,
        "cancelada",
        deletionNote,
        { template_id: templateId },
      );
      const client = clientsMap.get(instance.client_id);
      if (client) {
        await syncInstanceArtifacts(supabaseAdmin, instance, template, client.name);
      }
    }
  }

  return jsonResponse({ ok: true, mode: "deactivated", usage, cancelled_instances: openInstances.length });
}

async function handleUpsertProfile(
  supabaseAdmin: SupabaseAdmin,
  actorId: string,
  organizationId: string,
  payload: JsonRecord,
) {
  const id = asTrimmedString(payload.id);
  const clientId = asTrimmedString(payload.client_id);
  const templateId = asTrimmedString(payload.template_id);
  if (!clientId || !templateId) {
    return jsonResponse({ error: "Cliente e obrigação são obrigatórios." }, 400);
  }

  const row = {
    organization_id: organizationId,
    client_id: clientId,
    template_id: templateId,
    assigned_to: asTrimmedString(payload.assigned_to),
    start_date: asTrimmedString(payload.start_date) || toIsoDate(new Date()),
    end_date: asTrimmedString(payload.end_date),
    is_active: asBoolean(payload.is_active, true),
    due_day_override: asInteger(payload.due_day_override, null),
    yearly_due_month_override: asInteger(payload.yearly_due_month_override, null),
    legal_due_day_override: asInteger(payload.legal_due_day_override, null),
    expected_documents_override: payload.expected_documents_override
      ? asExpectedDocuments(payload.expected_documents_override)
      : null,
    notes: asTrimmedString(payload.notes),
    parameters: asRecord(payload.parameters) || {},
    source_kind: "manual",
    source_load_id: null,
    source_load_item_id: null,
    applied_regime: null,
    application_batch_id: null,
    inactivation_reason: null,
    sync_status: "current",
    conditional_review_reason: null,
    conditional_skip_reason: null,
    created_by: actorId,
  };

  const query = id
    ? supabaseAdmin.from("client_obligation_profiles").update(row).eq("organization_id", organizationId).eq("id", id).select("*").single()
    : supabaseAdmin.from("client_obligation_profiles").upsert(row, { onConflict: "client_id,template_id" }).select("*").single();

  const { data, error } = await query;
  if (error) return jsonResponse({ error: error.message }, 400);

  const templatesMap = await loadTemplatesMap(supabaseAdmin);
  const profile = data as ProfileRow;
  await auditObligationEvent(supabaseAdmin, {
    organizationId,
    clientId,
    templateId,
    action: id ? "manual_obligation_profile_updated" : "manual_obligation_linked_to_client",
    actorId,
    metadata: { profile_id: profile.id, source: "client_obligations_panel" },
  });
  const currentGenerationWindow = currentCompetenceGenerationWindow();
  await ensureInstancesForProfiles(
    supabaseAdmin,
    [profile],
    templatesMap,
    actorId,
    currentGenerationWindow.cursorStart,
    currentGenerationWindow.cursorEnd,
    currentGenerationWindow.targetCompetenceKey,
  );

  return jsonResponse({ ok: true, profile: data });
}

async function handleGenerateInstances(
  supabaseAdmin: SupabaseAdmin,
  actorId: string,
  organizationId: string,
  payload: JsonRecord,
) {
  const clientId = asTrimmedString(payload.client_id);

  let profilesQuery = supabaseAdmin
    .from("client_obligation_profiles")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("is_active", true);
  if (clientId) profilesQuery = profilesQuery.eq("client_id", clientId);

  const { data: profilesData, error: profilesError } = await profilesQuery;
  if (profilesError) return jsonResponse({ error: profilesError.message }, 400);

  const templatesMap = await loadTemplatesMap(supabaseAdmin);
  const currentGenerationWindow = currentCompetenceGenerationWindow();

  const result = await ensureInstancesForProfiles(
    supabaseAdmin,
    (profilesData || []) as ProfileRow[],
    templatesMap,
    actorId,
    currentGenerationWindow.cursorStart,
    currentGenerationWindow.cursorEnd,
    currentGenerationWindow.targetCompetenceKey,
  );

  return jsonResponse({ ok: true, created_instances: result.created });
}

async function handleUpdateInstance(
  supabaseAdmin: SupabaseAdmin,
  actorId: string,
  payload: JsonRecord,
) {
  const instanceId = asTrimmedString(payload.instance_id);
  if (!instanceId) return jsonResponse({ error: "Instância obrigatória." }, 400);

  const { data: currentData, error: currentError } = await supabaseAdmin
    .from("obligation_instances")
    .select("*")
    .eq("id", instanceId)
    .single();

  if (currentError || !currentData) {
    return jsonResponse({ error: "Instância não encontrada." }, 404);
  }

  const current = currentData as InstanceRow;
  const nextStatus = asTrimmedString(payload.status) || current.status;
  if (nextStatus === "concluida" && current.status !== "concluida") {
    const templatesMap = await loadTemplatesMap(supabaseAdmin);
    const template = templatesMap.get(current.template_id);
    if (!template) return jsonResponse({ error: "Obrigacao vinculada nao encontrada." }, 404);

    const documentStatus = await determineInstanceDocumentStatus(supabaseAdmin, current, template);
    if (!["em_revisao", "concluida"].includes(current.status) && !["em_revisao", "concluida"].includes(documentStatus)) {
      return jsonResponse({ error: "A obrigacao so pode ser concluida depois que o arquivo esperado for anexado na competencia correta." }, 400);
    }
  }
  const updates = {
    status: nextStatus,
    priority: asTrimmedString(payload.priority) || current.priority,
    current_assignee: asTrimmedString(payload.current_assignee) ?? current.current_assignee,
    completion_notes: asTrimmedString(payload.completion_notes) ?? current.completion_notes,
    completed_at: nextStatus === "concluida" ? new Date().toISOString() : null,
    last_status_at: current.status !== nextStatus ? new Date().toISOString() : current.updated_at,
  };

  const { data: updatedData, error: updateError } = await supabaseAdmin
    .from("obligation_instances")
    .update(updates)
    .eq("id", instanceId)
    .select("*")
    .single();

  if (updateError || !updatedData) {
    return jsonResponse({ error: updateError?.message || "Falha ao atualizar instância." }, 400);
  }

  const updated = updatedData as InstanceRow;
  await createInstanceEvent(
    supabaseAdmin,
    updated.id,
    actorId,
    "status_change",
    current.status,
    updated.status,
    asTrimmedString(payload.event_comment),
  );

  const templatesMap = await loadTemplatesMap(supabaseAdmin);
  const clientsMap = await loadClientsMap(supabaseAdmin);
  const template = templatesMap.get(updated.template_id);
  const client = clientsMap.get(updated.client_id);
  if (template && client) {
    await syncInstanceArtifacts(supabaseAdmin, updated, template, client.name);
  }

  return jsonResponse({ ok: true, instance: updated });
}

async function handleRegisterDocumentUpload(
  supabaseAdmin: SupabaseAdmin,
  actorId: string,
  payload: JsonRecord,
) {
  const fileName = asTrimmedString(payload.file_name);
  const storagePath = asTrimmedString(payload.storage_path);
  const storageBucket = asTrimmedString(payload.storage_bucket) || "obligation-files";
  if (!fileName || !storagePath) {
    return jsonResponse({ error: "Arquivo e caminho de storage são obrigatórios." }, 400);
  }

  const providedInstanceId = asTrimmedString(payload.instance_id);
  const clientId = asTrimmedString(payload.client_id);
  const templateId = asTrimmedString(payload.template_id);
  const suggestedCompetenceLabel = asTrimmedString(payload.suggested_competence_label);

  let resolvedInstanceId = providedInstanceId;
  let confidence = providedInstanceId ? 1 : 0.45;

  if (!resolvedInstanceId && clientId && templateId && suggestedCompetenceLabel) {
    const normalizedCompetenceKey = normalizeToken(suggestedCompetenceLabel).replace(/_/g, "-");
    const { data: exactInstances, error: instanceLookupError } = await supabaseAdmin
      .from("obligation_instances")
      .select("id")
      .eq("client_id", clientId)
      .eq("template_id", templateId)
      .or(`competence_label.eq.${suggestedCompetenceLabel},competence_key.eq.${normalizedCompetenceKey}`);

    if (instanceLookupError) throw instanceLookupError;

    if ((exactInstances || []).length === 1) {
      resolvedInstanceId = String((exactInstances?.[0] as JsonRecord).id);
      confidence = 0.9;
    }
  }

  const inboxRow = {
    client_id: clientId,
    suggested_client_id: clientId,
    suggested_template_id: templateId,
    suggested_instance_id: resolvedInstanceId,
    linked_instance_id: resolvedInstanceId,
    file_name: fileName,
    storage_bucket: storageBucket,
    storage_path: storagePath,
    content_type: asTrimmedString(payload.content_type),
    file_size: asInteger(payload.file_size, null),
    suggested_competence_label: suggestedCompetenceLabel,
    identification_confidence: confidence,
    status: resolvedInstanceId ? "linked" : "pending_review",
    blocking_reason: resolvedInstanceId ? null : "Aguardando validação humana para vincular o arquivo.",
    notes: asTrimmedString(payload.notes),
    created_by: actorId,
    reviewed_by: resolvedInstanceId ? actorId : null,
    reviewed_at: resolvedInstanceId ? new Date().toISOString() : null,
  };

  const { data: inboxItem, error: inboxError } = await supabaseAdmin
    .from("document_inbox_items")
    .insert(inboxRow)
    .select("*")
    .single();

  if (inboxError || !inboxItem) {
    await updateIngestionJob(supabaseAdmin, ingestionJob.id, {
      status: "failed",
      last_error: inboxError?.message || "Falha ao registrar documento na inbox.",
    });
    return jsonResponse({ error: inboxError?.message || "Falha ao registrar documento." }, 400);
  }

  if (resolvedInstanceId) {
    const { error: fileError } = await supabaseAdmin
      .from("obligation_instance_files")
      .insert({
        instance_id: resolvedInstanceId,
        inbox_item_id: String((inboxItem as JsonRecord).id),
        file_name: fileName,
        storage_bucket: storageBucket,
        storage_path: storagePath,
        content_type: asTrimmedString(payload.content_type),
        file_size: asInteger(payload.file_size, null),
        triage_status: "accepted",
        source: "manual_upload",
        uploaded_by: actorId,
        identification_confidence: confidence,
      });

    if (fileError) throw fileError;
  }

  return jsonResponse({ ok: true, inbox_item: inboxItem });
}

async function handleResolveDocument(
  supabaseAdmin: SupabaseAdmin,
  actorId: string,
  payload: JsonRecord,
) {
  const inboxItemId = asTrimmedString(payload.inbox_item_id);
  const decision = asTrimmedString(payload.decision);
  if (!inboxItemId || !decision) {
    return jsonResponse({ error: "Documento e decisão são obrigatórios." }, 400);
  }

  const { data: inboxItem, error: inboxError } = await supabaseAdmin
    .from("document_inbox_items")
    .select("*")
    .eq("id", inboxItemId)
    .single();

  if (inboxError || !inboxItem) {
    return jsonResponse({ error: "Documento não encontrado." }, 404);
  }

  if (decision === "reject") {
    const { error } = await supabaseAdmin
      .from("document_inbox_items")
      .update({
        status: "rejected",
        blocking_reason: asTrimmedString(payload.blocking_reason) || "Documento rejeitado manualmente.",
        notes: asTrimmedString(payload.notes) || asTrimmedString((inboxItem as JsonRecord).notes),
        reviewed_by: actorId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", inboxItemId);

    if (error) throw error;
    return jsonResponse({ ok: true });
  }

  const instanceId = asTrimmedString(payload.instance_id);
  if (!instanceId) {
    return jsonResponse({ error: "Selecione a instância de obrigação para vincular o documento." }, 400);
  }

  const { error: inboxUpdateError } = await supabaseAdmin
    .from("document_inbox_items")
    .update({
      status: "linked",
      linked_instance_id: instanceId,
      blocking_reason: null,
      notes: asTrimmedString(payload.notes) || asTrimmedString((inboxItem as JsonRecord).notes),
      reviewed_by: actorId,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", inboxItemId);

  if (inboxUpdateError) throw inboxUpdateError;

  const { error: fileError } = await supabaseAdmin
    .from("obligation_instance_files")
    .upsert({
      instance_id: instanceId,
      inbox_item_id: inboxItemId,
      file_name: asTrimmedString((inboxItem as JsonRecord).file_name),
      storage_bucket: asTrimmedString((inboxItem as JsonRecord).storage_bucket) || "obligation-files",
      storage_path: asTrimmedString((inboxItem as JsonRecord).storage_path),
      content_type: asTrimmedString((inboxItem as JsonRecord).content_type),
      file_size: asInteger((inboxItem as JsonRecord).file_size, null),
      triage_status: "reviewed",
      source: "manual_review",
      uploaded_by: actorId,
      identification_confidence: Number((inboxItem as JsonRecord).identification_confidence || 1),
    }, { onConflict: "storage_bucket,storage_path" });

  if (fileError) throw fileError;

  return jsonResponse({ ok: true });
}

async function handleRegisterDocumentUploadNative(
  supabaseAdmin: SupabaseAdmin,
  actorId: string,
  organizationId: string,
  payload: JsonRecord,
) {
  const fileName = asTrimmedString(payload.file_name);
  const storagePath = asTrimmedString(payload.storage_path);
  const storageBucket = asTrimmedString(payload.storage_bucket) || "obligation-files";
  if (!fileName || !storagePath) {
    return jsonResponse({ error: "Arquivo e caminho de storage sÃ£o obrigatÃ³rios." }, 400);
  }

  const clientId = asTrimmedString(payload.client_id);
  const sourceKind = normalizeSourceKind(payload.source_kind, "web_manual");
  const fileHash = asTrimmedString(payload.file_hash);
  const robotOriginPath = asTrimmedString(payload.robot_origin_path);
  const robotMachineId = asTrimmedString(payload.robot_machine_id);
  const analysis = parseDocumentAnalysisPayload(payload.analysis);
  const duplicateJob = await findDuplicateIngestionJob(supabaseAdmin, {
    sourceKind,
    fileHash,
    fileName,
    fileSize: asInteger(payload.file_size, null),
    robotMachineId,
  });
  if (duplicateJob && duplicateJob.status !== "failed") {
    return jsonResponse({
      ok: true,
      duplicate: true,
      ingestion_job: duplicateJob,
      match: null,
      processing_result: null,
    });
  }
  const match = await resolveDocumentReferenceMatch(supabaseAdmin, {
    clientId,
    instanceId: asTrimmedString(payload.instance_id),
    templateId: asTrimmedString(payload.template_id),
    documentTypeKey: asTrimmedString(payload.document_type_key),
    suggestedCompetenceLabel: asTrimmedString(payload.suggested_competence_label),
    fileName,
    analysis,
  });
  const autoLinked = Boolean(match.resolvedInstanceId && !match.reviewRequired && match.score >= 0.9);
  const ingestionJob = await upsertIngestionJob(supabaseAdmin, {
    organizationId,
    sourceKind,
    fileName,
    storageBucket,
    storagePath,
    fileHash,
    fileSize: asInteger(payload.file_size, null),
    clientId: match.detectedClientId || clientId,
    detectedClientId: match.detectedClientId || null,
    templateId: match.suggestedTemplateId || null,
    instanceId: autoLinked ? match.resolvedInstanceId : null,
    robotOriginPath,
    robotMachineId,
    createdBy: actorId,
    metadata: {
      detected_cnpj: match.detectedCnpj || null,
      competence_detected: match.competenceDetected || null,
      match_strategy: match.strategy,
      match_score: match.score,
    },
  });

  const inboxRow = {
    organization_id: organizationId,
    ingestion_job_id: ingestionJob.id,
    client_id: match.detectedClientId || clientId,
    suggested_client_id: clientId,
    detected_client_id: match.detectedClientId || null,
    suggested_template_id: match.suggestedTemplateId,
    suggested_instance_id: match.resolvedInstanceId,
    linked_instance_id: autoLinked ? match.resolvedInstanceId : null,
    document_type_key: match.documentTypeKey,
    file_name: fileName,
    storage_bucket: storageBucket,
    storage_path: storagePath,
    source_kind: sourceKind,
    file_hash: fileHash,
    content_type: asTrimmedString(payload.content_type),
    file_size: asInteger(payload.file_size, null),
    suggested_competence_label: asTrimmedString(payload.suggested_competence_label),
    detected_cnpj: match.detectedCnpj || null,
    competence_detected: match.competenceDetected || null,
    identification_confidence: match.score,
    matched_by: match.strategy,
    match_score: match.score,
    match_reasons: match.reasons,
    reference_file_id: match.referenceFileId || null,
    reference_match_score: match.referenceMatchScore || 0,
    reference_match_reasons: match.referenceMatchReasons || [],
    review_required: match.reviewRequired,
    classification_status: autoLinked ? "classified" : "review_required",
    status: autoLinked ? "linked" : "pending_review",
    blocking_reason: autoLinked ? null : "Aguardando validaÃ§Ã£o humana para vincular o arquivo.",
    text_extraction_status: match.textExtractionStatus || analysis.text_extraction_status,
    ocr_status: match.ocrStatus || analysis.ocr_status,
    extracted_text_preview: match.extractedTextPreview || analysis.extracted_text_preview,
    fingerprint_payload: match.fingerprintPayload || analysis.fingerprint_payload,
    auto_link_block_reason: match.autoLinkBlockReason || null,
    processing_status: autoLinked ? "queued" : "queued",
    processing_attempts: 0,
    processing_started_at: null,
    processing_completed_at: null,
    last_processing_error: null,
    execution_status: autoLinked ? "pending" : "pending",
    application_status: "pending",
    communication_status: "pending",
    publication_status: "pending",
    execution_notes: autoLinked
      ? "Documento aguardando aplicação automática na obrigação."
      : "Documento aguardando revisão humana para vinculação.",
    archive_path: null,
    robot_origin_path: robotOriginPath,
    robot_machine_id: robotMachineId,
    notes: asTrimmedString(payload.notes),
    created_by: actorId,
    reviewed_by: autoLinked ? actorId : null,
    reviewed_at: autoLinked ? new Date().toISOString() : null,
  };

  const { data: inboxItem, error: inboxError } = await supabaseAdmin
    .from("document_inbox_items")
    .insert(inboxRow)
    .select("*")
    .single();

  if (inboxError || !inboxItem) {
    await updateIngestionJob(supabaseAdmin, ingestionJob.id, {
      status: "failed",
      classification_status: "failed",
      application_status: "failed",
      communication_status: "not_applicable",
      publication_status: "failed",
      last_error: inboxError?.message || "Falha ao registrar documento.",
      completed_at: new Date().toISOString(),
    });
    return jsonResponse({ error: inboxError?.message || "Falha ao registrar documento." }, 400);
  }

  await updateIngestionJob(supabaseAdmin, ingestionJob.id, {
    inbox_item_id: String((inboxItem as JsonRecord).id),
    status: autoLinked ? "ingested" : "review_required",
    classification_status: autoLinked ? "classified" : "review_required",
    application_status: "pending",
    communication_status: "pending",
    publication_status: "pending",
    review_required: !autoLinked,
    instance_id: autoLinked ? match.resolvedInstanceId : null,
  });

  let processingResult: JsonRecord | null = null;
  if (autoLinked) {
    processingResult = await applyDocumentOperationalFlowV2(supabaseAdmin, actorId, inboxItem as InboxRow) as unknown as JsonRecord;
  }

  return jsonResponse({ ok: true, inbox_item: inboxItem, ingestion_job: ingestionJob, match, processing_result: processingResult });
}

async function handleResolveDocumentNative(
  supabaseAdmin: SupabaseAdmin,
  actorId: string,
  organizationId: string,
  payload: JsonRecord,
) {
  const inboxItemId = asTrimmedString(payload.inbox_item_id);
  const decision = asTrimmedString(payload.decision);
  if (!inboxItemId || !decision) {
    return jsonResponse({ error: "Documento e decisÃ£o sÃ£o obrigatÃ³rios." }, 400);
  }

  const { data: inboxItem, error: inboxError } = await supabaseAdmin
    .from("document_inbox_items")
    .select("*")
    .eq("id", inboxItemId)
    .eq("organization_id", organizationId)
    .single();

  if (inboxError || !inboxItem) {
    return jsonResponse({ error: "Documento nÃ£o encontrado." }, 404);
  }

  if (decision === "reject") {
    const { error } = await supabaseAdmin
      .from("document_inbox_items")
      .update({
        status: "rejected",
        matched_by: "manual_review",
        review_required: true,
        blocking_reason: asTrimmedString(payload.blocking_reason) || "Documento rejeitado manualmente.",
        processing_status: "processed",
        processing_completed_at: new Date().toISOString(),
        execution_status: "skipped",
        classification_status: "review_required",
        application_status: "skipped",
        communication_status: "not_applicable",
        publication_status: "not_applicable",
        execution_notes: "Documento rejeitado na triagem manual.",
        last_processing_error: null,
        notes: asTrimmedString(payload.notes) || asTrimmedString((inboxItem as JsonRecord).notes),
        reviewed_by: actorId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", inboxItemId)
      .eq("organization_id", organizationId);

    if (error) throw error;
    await updateIngestionJob(supabaseAdmin, asTrimmedString((inboxItem as JsonRecord).ingestion_job_id), {
      status: "completed",
      classification_status: "review_required",
      application_status: "skipped",
      communication_status: "not_applicable",
      publication_status: "not_applicable",
      review_required: true,
      completed_at: new Date().toISOString(),
    });
    return jsonResponse({ ok: true });
  }

  const instanceId = asTrimmedString(payload.instance_id);
  if (!instanceId) {
    return jsonResponse({ error: "Selecione a instÃ¢ncia de obrigaÃ§Ã£o para vincular o documento." }, 400);
  }

  const { error: inboxUpdateError } = await supabaseAdmin
    .from("document_inbox_items")
    .update({
      status: "linked",
      linked_instance_id: instanceId,
      matched_by: "manual_review",
      review_required: false,
      blocking_reason: null,
      processing_status: "queued",
      processing_started_at: null,
      processing_completed_at: null,
      execution_status: "pending",
      execution_notes: "Documento aguardando aplicação operacional após revisão manual.",
      last_processing_error: null,
      notes: asTrimmedString(payload.notes) || asTrimmedString((inboxItem as JsonRecord).notes),
      reviewed_by: actorId,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", inboxItemId)
    .eq("organization_id", organizationId);

  if (inboxUpdateError) throw inboxUpdateError;

  await updateIngestionJob(supabaseAdmin, asTrimmedString((inboxItem as JsonRecord).ingestion_job_id), {
    status: "ingested",
    classification_status: "classified",
    application_status: "pending",
    communication_status: "pending",
    publication_status: "pending",
    review_required: false,
    instance_id: instanceId,
    detected_client_id: asTrimmedString((inboxItem as JsonRecord).detected_client_id),
  });

  const refreshedInbox = {
    ...(inboxItem as InboxRow),
    status: "linked",
    linked_instance_id: instanceId,
    matched_by: "manual_review",
    review_required: false,
    classification_status: "classified",
    notes: asTrimmedString(payload.notes) || asTrimmedString((inboxItem as JsonRecord).notes),
    reviewed_by: actorId,
    reviewed_at: new Date().toISOString(),
    processing_status: "queued",
    execution_status: "pending",
    application_status: "pending",
    communication_status: "pending",
    publication_status: "pending",
    last_processing_error: null,
  } satisfies InboxRow;

  const processingResult = await applyDocumentOperationalFlowV2(supabaseAdmin, actorId, refreshedInbox);

  return jsonResponse({ ok: true, processing_result: processingResult });
}

async function handlePreviewDocumentMatch(
  supabaseAdmin: SupabaseAdmin,
  payload: JsonRecord,
) {
  const fileName = asTrimmedString(payload.file_name);
  if (!fileName) {
    return jsonResponse({ error: "Nome do arquivo Ã© obrigatÃ³rio para o preview." }, 400);
  }

  const analysis = parseDocumentAnalysisPayload(payload.analysis);
  try {
    const match = await resolveDocumentReferenceMatch(supabaseAdmin, {
      clientId: asTrimmedString(payload.client_id),
      instanceId: asTrimmedString(payload.instance_id),
      templateId: asTrimmedString(payload.template_id),
      documentTypeKey: asTrimmedString(payload.document_type_key),
      suggestedCompetenceLabel: asTrimmedString(payload.suggested_competence_label),
      fileName,
      analysis,
    });

    return jsonResponse({ ok: true, match });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao calcular preview.";
    console.error("grow-obligations preview_document_match failed", { message, fileName });
    return jsonResponse({
      ok: true,
      match: {
        resolvedInstanceId: null,
        suggestedTemplateId: asTrimmedString(payload.template_id),
        documentTypeKey: asTrimmedString(payload.document_type_key),
        strategy: "manual_review",
        score: 0.1,
        reasons: ["Nao foi possivel calcular o roteamento automatico. Selecione cliente, obrigacao e instancia manualmente."],
        reviewRequired: true,
        documentDefinition: null,
        candidateInstanceIds: [],
        detectedClientId: asTrimmedString(payload.client_id),
        detectedCnpj: analysis.detected_cnpj,
        competenceDetected: analysis.competence_detected || asTrimmedString(payload.suggested_competence_label),
        referenceFileId: null,
        referenceMatchScore: 0,
        referenceMatchReasons: [],
        textExtractionStatus: analysis.text_extraction_status,
        ocrStatus: analysis.ocr_status,
        extractedTextPreview: analysis.extracted_text_preview,
        fingerprintPayload: analysis.fingerprint_payload,
        autoLinkBlockReason: "Roteamento automatico indisponivel para este arquivo. Use a selecao manual.",
      },
    });
  }
}

async function handleUploadReferenceDocument(
  supabaseAdmin: SupabaseAdmin,
  actorId: string,
  organizationId: string,
  payload: JsonRecord,
) {
  const templateId = asTrimmedString(payload.template_id);
  const documentTypeKey = asTrimmedString(payload.document_type_key);
  const fileName = asTrimmedString(payload.file_name);
  const storagePath = asTrimmedString(payload.storage_path);
  if (!templateId || !documentTypeKey || !fileName || !storagePath) {
    return jsonResponse({ error: "Template, documento, arquivo e storage_path sao obrigatorios." }, 400);
  }

  const analysis = parseDocumentAnalysisPayload(payload.analysis);
  const row = {
    organization_id: organizationId,
    template_id: templateId,
    profile_id: asTrimmedString(payload.profile_id),
    document_type_key: documentTypeKey,
    file_name: fileName,
    storage_bucket: asTrimmedString(payload.storage_bucket) || "obligation-files",
    storage_path: storagePath,
    content_type: asTrimmedString(payload.content_type),
    file_size: asInteger(payload.file_size, null),
    is_active: asBoolean(payload.is_active, true),
    source_kind: asTrimmedString(payload.source_kind) || "template_reference",
    extracted_text: analysis.extracted_text,
    extracted_text_preview: analysis.extracted_text_preview,
    text_extraction_status: analysis.text_extraction_status,
    ocr_status: analysis.ocr_status,
    fingerprint_version: asInteger(payload.fingerprint_version, 1) || 1,
    fingerprint_payload: analysis.fingerprint_payload,
    keywords: analysis.keywords,
    primary_cues: analysis.primary_cues,
    created_by: actorId,
  };

  const { data, error } = await supabaseAdmin
    .from("expected_document_reference_files")
    .insert(row)
    .select("*")
    .single();

  if (error || !data) {
    return jsonResponse({ error: error?.message || "Falha ao registrar documento modelo." }, 400);
  }

  return jsonResponse({ ok: true, reference_file: data });
}

async function handleListReferenceDocuments(
  supabaseAdmin: SupabaseAdmin,
  organizationId: string,
  payload: JsonRecord,
) {
  const templateId = asTrimmedString(payload.template_id);
  const documentTypeKey = asTrimmedString(payload.document_type_key);
  let query = supabaseAdmin
    .from("expected_document_reference_files")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });
  if (templateId) query = query.eq("template_id", templateId);
  if (documentTypeKey) query = query.eq("document_type_key", documentTypeKey);
  const { data, error } = await query;
  if (error) return jsonResponse({ error: error.message }, 400);
  return jsonResponse({ ok: true, reference_files: data || [] });
}

async function handleDeleteReferenceDocument(
  supabaseAdmin: SupabaseAdmin,
  organizationId: string,
  payload: JsonRecord,
) {
  const referenceId = asTrimmedString(payload.reference_file_id);
  if (!referenceId) return jsonResponse({ error: "reference_file_id e obrigatorio." }, 400);
  const { error } = await supabaseAdmin
    .from("expected_document_reference_files")
    .delete()
    .eq("id", referenceId)
    .eq("organization_id", organizationId);
  if (error) return jsonResponse({ error: error.message }, 400);
  return jsonResponse({ ok: true });
}

async function handleReprocessReferenceDocument(
  supabaseAdmin: SupabaseAdmin,
  organizationId: string,
  payload: JsonRecord,
) {
  const referenceId = asTrimmedString(payload.reference_file_id);
  if (!referenceId) return jsonResponse({ error: "reference_file_id e obrigatorio." }, 400);
  const analysis = parseDocumentAnalysisPayload(payload.analysis);
  const updates = {
    extracted_text: analysis.extracted_text,
    extracted_text_preview: analysis.extracted_text_preview,
    text_extraction_status: analysis.text_extraction_status,
    ocr_status: analysis.ocr_status,
    fingerprint_payload: analysis.fingerprint_payload,
    keywords: analysis.keywords,
    primary_cues: analysis.primary_cues,
  };
  const { data, error } = await supabaseAdmin
    .from("expected_document_reference_files")
    .update(updates)
    .eq("id", referenceId)
    .eq("organization_id", organizationId)
    .select("*")
    .single();
  if (error || !data) return jsonResponse({ error: error?.message || "Falha ao reprocessar documento modelo." }, 400);
  return jsonResponse({ ok: true, reference_file: data });
}

async function handleProcessDocumentQueue(
  supabaseAdmin: SupabaseAdmin,
  actorId: string,
  payload: JsonRecord,
) {
  const force = asBoolean(payload.force, false);
  const inboxItemId = asTrimmedString(payload.inbox_item_id);
  let query = supabaseAdmin
    .from("document_inbox_items")
    .select("*")
    .eq("status", "linked")
    .order("created_at", { ascending: true })
    .limit(Math.min(50, Math.max(1, asInteger(payload.limit, 20) || 20)));

  if (inboxItemId) {
    query = query.eq("id", inboxItemId);
  } else if (!force) {
    query = query.in("processing_status", ["queued", "failed"]);
  }

  const { data, error } = await query;
  if (error) return jsonResponse({ error: error.message }, 400);

  const results = [];
  for (const row of (data || []) as InboxRow[]) {
    const result = await applyDocumentOperationalFlowV2(supabaseAdmin, actorId, row);
    results.push({
      inbox_item_id: row.id,
      file_name: row.file_name,
      result,
    });
  }

  return jsonResponse({
    ok: true,
    processed: results.filter((item) => (item.result as JsonRecord).processed === true).length,
    total: results.length,
    results,
  });
}

async function handleClientSnapshot(
  supabaseAdmin: SupabaseAdmin,
  actorId: string,
  organizationId: string,
  clientId: string,
) {
  const overview = await buildOverview(supabaseAdmin, actorId, organizationId);
  return jsonResponse({
    ok: true,
    client_id: clientId,
    profiles: overview.profiles.filter((profile) => String((profile.client || {}).id || profile.client_id) === clientId),
    instances: overview.instances.filter((instance) => String((instance.client || {}).id || instance.client_id) === clientId),
    templates: overview.templates,
  });
}

async function handleListClients(supabaseAdmin: SupabaseAdmin, organizationId: string) {
  const clients = filterByOrganization(
    Array.from((await loadClientsMap(supabaseAdmin)).values()) as unknown as JsonRecord[],
    organizationId,
  );

  return jsonResponse({
    ok: true,
    clients,
  });
}

function hasTemplateManagerRole(roles: string[]) {
  return roles.some((role) => templateManagerRoles.has(role));
}

function normalizeRegimeCode(value: unknown) {
  const normalized = (asTrimmedString(value) || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

  const aliases = new Map([
    ["simples", "simples_nacional"],
    ["simples nacional", "simples_nacional"],
    ["sn", "simples_nacional"],
    ["lucro presumido", "lucro_presumido"],
    ["presumido", "lucro_presumido"],
    ["lp", "lucro_presumido"],
    ["lucro real", "lucro_real"],
    ["real", "lucro_real"],
    ["lr", "lucro_real"],
    ["mei", "mei"],
    ["microempreendedor individual", "mei"],
    ["simei", "mei"],
  ]);

  return aliases.get(normalized) || normalized.replace(/\s+/g, "_");
}

function isSupportedTaxRegimeCode(value: string | null | undefined) {
  return value === "simples_nacional" || value === "lucro_presumido" || value === "lucro_real" || value === "mei";
}

function normalizeDuplicateText(value: unknown) {
  return (asTrimmedString(value) || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\bf\s*g\s*t\s*s\b/g, "fgts")
    .replace(/\bd\s*c\s*t\s*f\s*web\b/g, "dctfweb")
    .replace(/\be\s*social\b/g, "esocial")
    .trim();
}

function normalizeDuplicateCode(value: unknown) {
  return (asTrimmedString(value) || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

async function handleDetectObligationDuplicates(
  supabaseAdmin: SupabaseAdmin,
  organizationId: string,
  payload: JsonRecord,
) {
  const id = asTrimmedString(payload.id);
  const code = normalizeDuplicateCode(payload.code);
  const name = normalizeDuplicateText(payload.name);

  if (!code && !name) {
    return jsonResponse({ error: "Nome ou codigo da obrigacao e obrigatorio." }, 400);
  }

    const { data, error } = await supabaseAdmin
      .from("obligation_templates")
    .select("id, code, name, normalized_name, is_active, baseline_source")
    .eq("organization_id", organizationId)
    .eq("is_active", true);

  if (error) return jsonResponse({ error: error.message }, 400);

  const matches = ((data || []) as Array<JsonRecord>)
    .filter((template) => asTrimmedString(template.id) !== id)
    .map((template) => {
      const templateCode = normalizeDuplicateCode(template.code);
      const templateName = normalizeDuplicateText(asTrimmedString(template.normalized_name) || template.name);
      if (code && templateCode && code === templateCode) {
        return {
          template_id: template.id,
          code: template.code,
          name: template.name,
          baseline_source: template.baseline_source,
          match_type: "code",
          severity: "block",
        };
      }
      if (name && templateName && name === templateName) {
        return {
          template_id: template.id,
          code: template.code,
          name: template.name,
          baseline_source: template.baseline_source,
          match_type: "normalized_name",
          severity: "block",
        };
      }
      if (name && templateName && (name.includes(templateName) || templateName.includes(name))) {
        return {
          template_id: template.id,
          code: template.code,
          name: template.name,
          baseline_source: template.baseline_source,
          match_type: "semantic",
          severity: "review",
        };
      }
      return null;
    })
    .filter(Boolean);

  return jsonResponse({ ok: true, matches });
}

function asEvidence(payload: unknown): DefaultEvidence {
  const record = asRecord(payload) || {};
  const evidence: DefaultEvidence = {};
  for (const [key, value] of Object.entries(record)) {
    if (typeof value === "boolean" || value === null) evidence[key] = value;
  }
  return evidence;
}

function normalizeEvidenceText(value: unknown) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function isPositiveEvidenceText(value: unknown) {
  const token = normalizeEvidenceText(value);
  return ["sim", "s", "yes", "true", "1", "possui"].includes(token);
}

function hasEffectiveRegistrationText(value: unknown) {
  const token = normalizeEvidenceText(value);
  if (!token) return false;
  return !["nao", "n", "isento", "isenta", "sem inscricao", "nao possui", "nao consta", "nao localizado", "verificar"].includes(token);
}

function mergeDefaultEvidence(primary: DefaultEvidence, fallback: DefaultEvidence) {
  const merged: DefaultEvidence = { ...fallback };
  for (const [key, value] of Object.entries(primary)) {
    if (value === true || value === false) merged[key] = value;
  }
  return merged;
}

async function loadClientDefaultEvidence(
  supabaseAdmin: SupabaseAdmin,
  organizationId: string,
  clientId: string,
): Promise<DefaultEvidence> {
  const { data: clientData, error: clientError } = await supabaseAdmin
    .from("clients")
    .select("sector")
    .eq("organization_id", organizationId)
    .eq("id", clientId)
    .maybeSingle();
  if (clientError) throw clientError;

  const { data: rows, error } = await supabaseAdmin
    .from("client_data")
    .select("field_name, field_value")
    .eq("client_id", clientId)
    .in("field_name", [
      "perfil_atuacao",
      "inscricao_municipal",
      "inscricao_estadual",
      "possui_funcionarios",
      "contribuinte_icms",
      "regime_icms",
    ]);
  if (error) throw error;

  const values = new Map<string, unknown>();
  for (const row of (rows || []) as JsonRecord[]) {
    const fieldName = asTrimmedString(row.field_name);
    if (fieldName) values.set(fieldName, row.field_value);
  }

  const perfil = normalizeEvidenceText(values.get("perfil_atuacao"));
  const sector = normalizeEvidenceText((clientData as JsonRecord | null)?.sector);
  const serviceProvider = perfil.includes("serv") || sector.includes("serv");
  const hasEmployees = isPositiveEvidenceText(values.get("possui_funcionarios"));
  const icmsTaxpayer = isPositiveEvidenceText(values.get("contribuinte_icms")) || isPositiveEvidenceText(values.get("regime_icms"));
  const hasStateRegistration = icmsTaxpayer || hasEffectiveRegistrationText(values.get("inscricao_estadual"));
  const hasMunicipalRegistration = hasEffectiveRegistrationText(values.get("inscricao_municipal"));

  return {
    service_provider: serviceProvider || null,
    iss_applicable: serviceProvider || null,
    municipal_service_declaration_required: hasMunicipalRegistration || null,
    has_employees: hasEmployees || null,
    has_employees_or_retentions: hasEmployees || null,
    retentions_or_services: serviceProvider || null,
    state_registration: hasStateRegistration || null,
    state_registration_or_required: hasStateRegistration || null,
    icms_ipi_taxpayer: icmsTaxpayer || null,
    icms_taxpayer: icmsTaxpayer || null,
  };
}

const conditionEvidenceKey: Record<string, string> = {
  has_employees: "has_employees",
  iss_applicable: "service_provider",
  icms_taxpayer: "icms_ipi_taxpayer",
  service_provider: "service_provider",
  accounting_contracted: "ecd_applicable",
  municipal_service_declaration_required: "municipal_service_declaration_required",
  state_registration: "state_registration",
  state_registration_or_required: "state_registration_or_required",
  icms_ipi_taxpayer: "icms_ipi_taxpayer",
  icms_st_difal_anticipation: "icms_st_difal_anticipation",
  retentions_or_services: "retentions_or_services",
  has_employees_or_retentions: "has_employees_or_retentions",
  ecd_applicable: "ecd_applicable",
  efd_contribuicoes_applicable: "efd_contribuicoes_applicable",
  tax_benefit_or_incentive_usage: "tax_benefit_or_incentive_usage",
};

function emptyDefaultSummary(): DefaultApplicationSummary {
  return {
    created: 0,
    kept: 0,
    reactivated: 0,
    skipped: 0,
    blocked: 0,
    duplicate_risk: 0,
    conditional_skipped: 0,
    inactivated_prior_regime: 0,
    inactivated: 0,
    add: 0,
    keep: 0,
  };
}

function mergeDefaultSummary(target: DefaultApplicationSummary, source: Partial<DefaultApplicationSummary>) {
  target.created += source.created || 0;
  target.kept += source.kept || 0;
  target.reactivated += source.reactivated || 0;
  target.skipped += source.skipped || 0;
  target.blocked += source.blocked || 0;
  target.duplicate_risk += source.duplicate_risk || 0;
  target.conditional_skipped += source.conditional_skipped || 0;
  target.inactivated_prior_regime += source.inactivated_prior_regime || 0;
  target.inactivated += source.inactivated || 0;
  target.add += source.add || 0;
  target.keep += source.keep || 0;
  target.unsupported_clients = (target.unsupported_clients || 0) + (source.unsupported_clients || 0);
  target.processed_clients = (target.processed_clients || 0) + (source.processed_clients || 0);
}

function evaluateLoadItemApplicability(item: RegimeLoadItemRow, evidence: DefaultEvidence) {
  if (item.applicability !== "conditional") {
    return { apply: item.applicability === "required", evidenceSource: null, reason: "non_required_optional_default" };
  }
  const conditionKey = item.condition_key || "";
  const evidenceSource = conditionEvidenceKey[conditionKey] || conditionKey;
  const value = evidence[evidenceSource];
  if (value === true) return { apply: true, evidenceSource, reason: "client_evidence_indicates_applicability" };
  if (value === false) return { apply: false, evidenceSource, reason: "client_evidence_indicates_not_applicable" };
  return { apply: false, evidenceSource, reason: "insufficient_client_evidence" };
}

async function loadActiveDefaultLoad(supabaseAdmin: SupabaseAdmin, organizationId: string, taxRegimeCode: string) {
  const { data: loadData, error: loadError } = await supabaseAdmin
    .from("obligation_regime_loads")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("tax_regime_code", taxRegimeCode)
    .eq("status", "active")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (loadError) throw loadError;
  if (!loadData) return { load: null, items: [] as RegimeLoadItemRow[] };

  const load = loadData as RegimeLoadRow;
  const { data: itemsData, error: itemsError } = await supabaseAdmin
    .from("obligation_regime_load_items")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("load_id", load.id)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  if (itemsError) throw itemsError;
  return { load, items: (itemsData || []) as RegimeLoadItemRow[] };
}

async function insertDefaultDecision(
  supabaseAdmin: SupabaseAdmin,
  params: {
    organizationId: string;
    batchId: string;
    clientId: string;
    templateId: string | null;
    decisionType: string;
    reason: string;
    loadItemId?: string | null;
    currentProfileId?: string | null;
    evidenceSource?: string | null;
    syncEffect?: string;
    autoApplied?: boolean;
  },
) {
  const { data, error } = await supabaseAdmin
    .from("obligation_load_application_reviews")
    .insert({
      organization_id: params.organizationId,
      batch_id: params.batchId,
      client_id: params.clientId,
      template_id: params.templateId,
      load_item_id: params.loadItemId || null,
      current_profile_id: params.currentProfileId || null,
      decision_type: params.decisionType,
      reason: params.reason,
      requires_confirmation: false,
      selected: true,
      auto_applied: params.autoApplied ?? false,
      evidence_source: params.evidenceSource || null,
      sync_effect: params.syncEffect || "profile_only",
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as JsonRecord;
}

async function insertDefaultBatch(
  supabaseAdmin: SupabaseAdmin,
  params: {
    organizationId: string;
    clientId: string;
    taxRegimeCode: string;
    loadId: string | null;
    mode: string;
    actorId: string;
  },
) {
  const { data, error } = await supabaseAdmin
    .from("obligation_load_application_batches")
    .insert({
      organization_id: params.organizationId,
      client_id: params.clientId,
      tax_regime_code: params.taxRegimeCode,
      load_id: params.loadId,
      mode: params.mode,
      sync_scope: "single_client",
      status: "applied",
      summary: {},
      warnings: [],
      created_by: params.actorId,
      applied_by: params.actorId,
      applied_at: new Date().toISOString(),
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as JsonRecord;
}

async function updateDefaultBatch(
  supabaseAdmin: SupabaseAdmin,
  batchId: string,
  summary: DefaultApplicationSummary,
  warnings: string[],
) {
  const { error } = await supabaseAdmin
    .from("obligation_load_application_batches")
    .update({ summary, warnings })
    .eq("id", batchId);
  if (error) throw error;
}

async function auditDefaultApplication(
  supabaseAdmin: SupabaseAdmin,
  params: {
    organizationId: string;
    clientId: string;
    batchId: string;
    action: string;
    actorId: string;
    metadata: JsonRecord;
  },
) {
  const { error } = await supabaseAdmin.from("obligation_audit_events").insert({
    organization_id: params.organizationId,
    client_id: params.clientId,
    entity_type: "application_batch",
    entity_id: params.batchId,
    action: params.action,
    actor_id: params.actorId,
    metadata: params.metadata,
  });
  if (error) console.warn("default obligation audit failed", error.message);
}

async function auditObligationEvent(
  supabaseAdmin: SupabaseAdmin,
  params: {
    organizationId: string;
    clientId?: string | null;
    templateId?: string | null;
    action: string;
    actorId: string;
    metadata?: JsonRecord;
  },
) {
  const { error } = await supabaseAdmin.from("obligation_audit_events").insert({
    organization_id: params.organizationId,
    client_id: params.clientId || null,
    template_id: params.templateId || null,
    action: params.action,
    actor_id: params.actorId,
    metadata: params.metadata || {},
  });

  if (error) console.warn("obligation audit failed", error.message);
}

async function applyDefaultLoadForClient(
  supabaseAdmin: SupabaseAdmin,
  params: {
    organizationId: string;
    actorId: string;
    clientId: string;
    taxRegimeCode: string;
    mode: string;
    sourceKind: string;
    evidence: DefaultEvidence;
  },
) {
  const { load, items } = await loadActiveDefaultLoad(supabaseAdmin, params.organizationId, params.taxRegimeCode);
  const summary = emptyDefaultSummary();
  const warnings: string[] = [];
  const profiles: ProfileRow[] = [];
  const skippedItems: JsonRecord[] = [];
  const decisions: JsonRecord[] = [];

  const batch = await insertDefaultBatch(supabaseAdmin, {
    organizationId: params.organizationId,
    clientId: params.clientId,
    taxRegimeCode: params.taxRegimeCode,
    loadId: load?.id || null,
    mode: params.mode,
    actorId: params.actorId,
  });
  const batchId = String(batch.id);

  if (!load) {
    warnings.push("Nenhuma carga padrao ativa encontrada para o regime informado.");
    await updateDefaultBatch(supabaseAdmin, batchId, summary, warnings);
    return { batch: { ...batch, summary, warnings }, summary, warnings, profiles, skippedItems, decisions };
  }

  const { data: existingProfilesData, error: existingProfilesError } = await supabaseAdmin
    .from("client_obligation_profiles")
    .select("*")
    .eq("organization_id", params.organizationId)
    .eq("client_id", params.clientId);
  if (existingProfilesError) throw existingProfilesError;
  const existingProfiles = (existingProfilesData || []) as ProfileRow[];
  const existingByTemplate = new Map(existingProfiles.map((profile) => [profile.template_id, profile]));
  const today = toIsoDate(new Date());
  const applicableLoadTemplateIds = new Set(
    items
      .filter((item) => evaluateLoadItemApplicability(item, params.evidence).apply)
      .map((item) => item.template_id),
  );
  const staleDefaultProfiles = existingProfiles.filter((profile) => {
    if (!profile.is_active) return false;
    if (profile.source_kind !== "standard_load" && profile.source_kind !== "regime_migration") return false;
    if (!applicableLoadTemplateIds.has(profile.template_id)) return true;
    const appliedRegime = asTrimmedString(profile.applied_regime);
    return Boolean(appliedRegime && appliedRegime !== params.taxRegimeCode);
  });

  for (const profile of staleDefaultProfiles) {
    const { error: staleUpdateError } = await supabaseAdmin
      .from("client_obligation_profiles")
      .update({
        is_active: false,
        end_date: profile.end_date || today,
        inactivation_reason: "regime_reconciliation",
        sync_status: "not_applicable",
      })
      .eq("organization_id", params.organizationId)
      .eq("id", profile.id);
    if (staleUpdateError) throw staleUpdateError;
    summary.inactivated += 1;
    decisions.push(await insertDefaultDecision(supabaseAdmin, {
      organizationId: params.organizationId,
      batchId,
      clientId: params.clientId,
      templateId: profile.template_id,
      currentProfileId: profile.id,
      decisionType: "auto_inactivate_prior_regime",
      reason: "default_not_applicable_to_current_client_regime",
      syncEffect: "future_only",
      autoApplied: true,
    }));
  }

  for (const item of items) {
    const decision = evaluateLoadItemApplicability(item, params.evidence);
    if (!decision.apply) {
      summary.skipped += 1;
      if (item.applicability === "conditional") summary.conditional_skipped += 1;
      const row = await insertDefaultDecision(supabaseAdmin, {
        organizationId: params.organizationId,
        batchId,
        clientId: params.clientId,
        templateId: item.template_id,
        loadItemId: item.id,
        decisionType: "skip",
        reason: decision.reason,
        evidenceSource: decision.evidenceSource,
        syncEffect: "no_change",
      });
      decisions.push(row);
      skippedItems.push({ ...row, auto_apply_when_positive_evidence_exists: item.applicability === "conditional" });
      continue;
    }

    const existingProfile = existingByTemplate.get(item.template_id);
    if (existingProfile?.is_active) {
      const appliedRegime = asTrimmedString(existingProfile.applied_regime);
      if (appliedRegime && appliedRegime !== params.taxRegimeCode) {
        const { data: reconciledProfileData, error: reconciledProfileError } = await supabaseAdmin
          .from("client_obligation_profiles")
          .insert({
            organization_id: params.organizationId,
            client_id: params.clientId,
            template_id: item.template_id,
            source_kind: params.sourceKind,
            source_load_id: load.id,
            source_load_item_id: item.id,
            applied_regime: params.taxRegimeCode,
            application_batch_id: batchId,
            assigned_to: existingProfile.assigned_to || null,
            start_date: today,
            end_date: null,
            is_active: true,
            due_day_override: item.default_due_day_override ?? existingProfile.due_day_override ?? null,
            yearly_due_month_override: existingProfile.yearly_due_month_override ?? null,
            legal_due_day_override: existingProfile.legal_due_day_override ?? null,
            expected_documents_override: existingProfile.expected_documents_override ?? null,
            notes: existingProfile.notes || null,
            parameters: asRecord(existingProfile.parameters) || {},
            sync_status: "current",
            conditional_review_reason: null,
            conditional_skip_reason: null,
            created_by: params.actorId,
          })
          .select("*")
          .single();
        if (reconciledProfileError) throw reconciledProfileError;
        const reconciledProfile = reconciledProfileData as ProfileRow;
        summary.created += 1;
        summary.add += 1;
        profiles.push(reconciledProfile);
        decisions.push(await insertDefaultDecision(supabaseAdmin, {
          organizationId: params.organizationId,
          batchId,
          clientId: params.clientId,
          templateId: item.template_id,
          loadItemId: item.id,
          currentProfileId: reconciledProfile.id,
          decisionType: "add",
          reason: "default_obligation_recreated_for_current_client_regime",
          autoApplied: true,
        }));
        continue;
      }

      if (
        existingProfile.source_kind === "standard_load" &&
        (existingProfile.source_load_id !== load.id ||
          existingProfile.source_load_item_id !== item.id ||
          existingProfile.applied_regime !== params.taxRegimeCode)
      ) {
        const { error: refreshProfileError } = await supabaseAdmin
          .from("client_obligation_profiles")
          .update({
            source_load_id: load.id,
            source_load_item_id: item.id,
            applied_regime: params.taxRegimeCode,
            sync_status: "current",
          })
          .eq("organization_id", params.organizationId)
          .eq("id", existingProfile.id);
        if (refreshProfileError) throw refreshProfileError;
      }
      summary.kept += 1;
      summary.keep += 1;
      profiles.push(existingProfile);
      decisions.push(await insertDefaultDecision(supabaseAdmin, {
        organizationId: params.organizationId,
        batchId,
        clientId: params.clientId,
        templateId: item.template_id,
        loadItemId: item.id,
        currentProfileId: existingProfile.id,
        decisionType: "keep",
        reason: "active_profile_already_exists",
        autoApplied: true,
      }));
      continue;
    }

    if (existingProfile && existingProfile.source_kind !== "standard_load" && existingProfile.source_kind !== "regime_migration") {
      summary.duplicate_risk += 1;
      summary.blocked += 1;
      decisions.push(await insertDefaultDecision(supabaseAdmin, {
        organizationId: params.organizationId,
        batchId,
        clientId: params.clientId,
        templateId: item.template_id,
        loadItemId: item.id,
        currentProfileId: existingProfile.id,
        decisionType: "duplicate_risk",
        reason: "manual_or_non_default_profile_exists_for_template",
        syncEffect: "blocked",
      }));
      continue;
    }

    if (existingProfile && existingProfile.is_active === false) {
      const inactiveReason = asTrimmedString(existingProfile.inactivation_reason);
      if (
        existingProfile.source_kind === "standard_load" ||
        existingProfile.source_kind === "regime_migration" ||
        inactiveReason === "regime_reconciliation" ||
        inactiveReason === "regime_change"
      ) {
        const { data: reactivatedProfileData, error: reactivatedProfileError } = await supabaseAdmin
          .from("client_obligation_profiles")
          .update({
            source_kind: params.sourceKind,
            source_load_id: load.id,
            source_load_item_id: item.id,
            applied_regime: params.taxRegimeCode,
            application_batch_id: batchId,
            start_date: today,
            end_date: null,
            is_active: true,
            due_day_override: item.default_due_day_override ?? existingProfile.due_day_override ?? null,
            inactivation_reason: null,
            sync_status: "current",
            conditional_review_reason: null,
            conditional_skip_reason: null,
          })
          .eq("organization_id", params.organizationId)
          .eq("id", existingProfile.id)
          .select("*")
          .single();
        if (reactivatedProfileError) throw reactivatedProfileError;
        const reactivatedProfile = reactivatedProfileData as ProfileRow;
        summary.reactivated += 1;
        profiles.push(reactivatedProfile);
        decisions.push(await insertDefaultDecision(supabaseAdmin, {
          organizationId: params.organizationId,
          batchId,
          clientId: params.clientId,
          templateId: item.template_id,
          loadItemId: item.id,
          currentProfileId: reactivatedProfile.id,
          decisionType: "reactivate",
          reason: "default_obligation_reactivated_for_current_client_regime",
          autoApplied: true,
        }));
        continue;
      }

      summary.skipped += 1;
      decisions.push(await insertDefaultDecision(supabaseAdmin, {
        organizationId: params.organizationId,
        batchId,
        clientId: params.clientId,
        templateId: item.template_id,
        loadItemId: item.id,
        currentProfileId: existingProfile.id,
        decisionType: "skip",
        reason: "previously_inactivated_manual_or_exception_requires_visible_user_decision",
        syncEffect: "no_change",
      }));
      continue;
    }

    const { data: profileData, error: profileError } = await supabaseAdmin
      .from("client_obligation_profiles")
      .insert({
        organization_id: params.organizationId,
        client_id: params.clientId,
        template_id: item.template_id,
        source_kind: params.sourceKind,
        source_load_id: load.id,
        source_load_item_id: item.id,
        applied_regime: params.taxRegimeCode,
        application_batch_id: batchId,
        assigned_to: null,
        start_date: today,
        end_date: null,
        is_active: true,
        due_day_override: item.default_due_day_override ?? null,
        yearly_due_month_override: null,
        legal_due_day_override: null,
        expected_documents_override: null,
        notes: null,
        parameters: {},
        sync_status: "current",
        conditional_review_reason: null,
        conditional_skip_reason: null,
        created_by: params.actorId,
      })
      .select("*")
      .single();
    if (profileError) throw profileError;

    const profile = profileData as ProfileRow;
    summary.created += 1;
    summary.add += 1;
    profiles.push(profile);
    decisions.push(await insertDefaultDecision(supabaseAdmin, {
      organizationId: params.organizationId,
      batchId,
      clientId: params.clientId,
      templateId: item.template_id,
      loadItemId: item.id,
      currentProfileId: profile.id,
      decisionType: "add",
      reason: "default_obligation_applied",
      autoApplied: true,
    }));
  }

  await updateDefaultBatch(supabaseAdmin, batchId, summary, warnings);
  await auditDefaultApplication(supabaseAdmin, {
    organizationId: params.organizationId,
    clientId: params.clientId,
    batchId,
    action: params.mode === "regime_migration" ? "default_regime_migration_applied" : "default_obligations_applied",
    actorId: params.actorId,
    metadata: { tax_regime_code: params.taxRegimeCode, summary },
  });

  return { batch: { ...batch, summary, warnings }, summary, warnings, profiles, skippedItems, decisions };
}

async function handleApplyDefaultObligations(
  supabaseAdmin: SupabaseAdmin,
  actorId: string,
  organizationId: string,
  payload: JsonRecord,
) {
  const clientId = asTrimmedString(payload.client_id);
  if (!clientId) return jsonResponse({ error: "Cliente obrigatorio." }, 400);

  const { data: clientData, error: clientError } = await supabaseAdmin
    .from("clients")
    .select("id, regime")
    .eq("organization_id", organizationId)
    .eq("id", clientId)
    .maybeSingle();
  if (clientError) return jsonResponse({ error: clientError.message }, 400);
  if (!clientData) return jsonResponse({ error: "Cliente nao encontrado." }, 404);

  const taxRegimeCode = normalizeRegimeCode((clientData as JsonRecord).regime);
  if (!taxRegimeCode) return jsonResponse({ error: "Cliente sem regime tributario suportado." }, 400);
  if (!isSupportedTaxRegimeCode(taxRegimeCode)) return jsonResponse({ error: "Regime tributario nao suportado para obrigacoes padrao." }, 400);

  const storedEvidence = await loadClientDefaultEvidence(supabaseAdmin, organizationId, clientId);
  const evidence = mergeDefaultEvidence(storedEvidence, asEvidence(payload.evidence));

  const result = await applyDefaultLoadForClient(supabaseAdmin, {
    organizationId,
    actorId,
    clientId,
    taxRegimeCode,
    mode: asTrimmedString(payload.mode) || "new_client",
    sourceKind: "standard_load",
    evidence,
  });

  return jsonResponse({
    ok: true,
    batch_id: result.batch.id,
    summary: result.summary,
    warnings: result.warnings,
    profiles: result.profiles,
    skipped_items: result.skippedItems,
  });
}

async function handleApplyConditionalDefaultsAfterEvidenceUpdate(
  supabaseAdmin: SupabaseAdmin,
  actorId: string,
  organizationId: string,
  payload: JsonRecord,
) {
  const clientId = asTrimmedString(payload.client_id);
  if (!clientId) return jsonResponse({ error: "Cliente obrigatorio." }, 400);

  const { data: clientData, error: clientError } = await supabaseAdmin
    .from("clients")
    .select("id, regime")
    .eq("organization_id", organizationId)
    .eq("id", clientId)
    .maybeSingle();
  if (clientError) return jsonResponse({ error: clientError.message }, 400);
  if (!clientData) return jsonResponse({ error: "Cliente nao encontrado." }, 404);

  const taxRegimeCode = normalizeRegimeCode((clientData as JsonRecord).regime);
  if (!taxRegimeCode) return jsonResponse({ error: "Cliente sem regime tributario suportado." }, 400);
  if (!isSupportedTaxRegimeCode(taxRegimeCode)) return jsonResponse({ error: "Cliente sem regime tributario suportado." }, 400);

  const storedEvidence = await loadClientDefaultEvidence(supabaseAdmin, organizationId, clientId);
  const evidence = mergeDefaultEvidence(storedEvidence, asEvidence(payload.evidence));

  const result = await applyDefaultLoadForClient(supabaseAdmin, {
    organizationId,
    actorId,
    clientId,
    taxRegimeCode,
    mode: "reconcile_existing",
    sourceKind: "standard_load",
    evidence,
  });

  return jsonResponse({
    ok: true,
    batch_id: result.batch.id,
    summary: result.summary,
    warnings: result.warnings,
    profiles: result.profiles,
    skipped_items: result.skippedItems,
  });
}

async function handleSyncDefaultObligationsForExistingClients(
  supabaseAdmin: SupabaseAdmin,
  actorId: string,
  organizationId: string,
  payload: JsonRecord,
) {
  const onlyTaxRegimeCode = normalizeRegimeCode(payload.tax_regime_code);
  if (onlyTaxRegimeCode && !isSupportedTaxRegimeCode(onlyTaxRegimeCode)) {
    return jsonResponse({ error: "Regime tributario nao suportado para sincronizacao." }, 400);
  }

  const { data: clientsData, error: clientsError } = await supabaseAdmin
    .from("clients")
    .select("id, name, regime, status")
    .eq("organization_id", organizationId)
    .order("name", { ascending: true });

  if (clientsError) return jsonResponse({ error: clientsError.message }, 400);

  const summary = emptyDefaultSummary();
  const warnings: string[] = [];
  const clientResults: JsonRecord[] = [];

  for (const client of (clientsData || []) as JsonRecord[]) {
    const clientId = asTrimmedString(client.id);
    const status = (asTrimmedString(client.status) || "").toLowerCase();
    if (!clientId || status === "inativo") continue;

    const taxRegimeCode = normalizeRegimeCode(client.regime);
    if (!isSupportedTaxRegimeCode(taxRegimeCode)) {
      summary.unsupported_clients = (summary.unsupported_clients || 0) + 1;
      warnings.push(`Cliente ${asTrimmedString(client.name) || clientId} sem regime tributario suportado.`);
      continue;
    }
    if (onlyTaxRegimeCode && taxRegimeCode !== onlyTaxRegimeCode) continue;

    try {
      const storedEvidence = await loadClientDefaultEvidence(supabaseAdmin, organizationId, clientId);
      const evidence = mergeDefaultEvidence(storedEvidence, asEvidence(payload.evidence));
      const result = await applyDefaultLoadForClient(supabaseAdmin, {
        organizationId,
        actorId,
        clientId,
        taxRegimeCode,
        mode: "reconcile_existing",
        sourceKind: "standard_load",
        evidence,
      });

      summary.processed_clients = (summary.processed_clients || 0) + 1;
      mergeDefaultSummary(summary, result.summary);
      clientResults.push({
        client_id: clientId,
        client_name: asTrimmedString(client.name),
        tax_regime_code: taxRegimeCode,
        batch_id: result.batch.id,
        summary: result.summary,
        warnings: result.warnings,
      });
      warnings.push(...result.warnings.map((warning) => `${asTrimmedString(client.name) || clientId}: ${warning}`));
    } catch (error) {
      summary.blocked += 1;
      warnings.push(`${asTrimmedString(client.name) || clientId}: ${error instanceof Error ? error.message : "Falha ao sincronizar obrigacoes padrao."}`);
    }
  }

  await auditDefaultApplication(supabaseAdmin, {
    organizationId,
    clientId: null,
    batchId: crypto.randomUUID(),
    action: "existing_clients_default_obligations_synced",
    actorId,
    metadata: { tax_regime_code: onlyTaxRegimeCode || null, summary, clients: clientResults.length },
  });

  return jsonResponse({
    ok: true,
    summary,
    warnings,
    clients: clientResults,
  });
}

async function handleApplyRegimeChangeDefaultObligations(
  supabaseAdmin: SupabaseAdmin,
  actorId: string,
  organizationId: string,
  payload: JsonRecord,
) {
  const clientId = asTrimmedString(payload.client_id);
  const toTaxRegimeCode = normalizeRegimeCode(payload.to_tax_regime_code);
  const fromTaxRegimeCode = normalizeRegimeCode(payload.from_tax_regime_code);
  if (!clientId || !toTaxRegimeCode) return jsonResponse({ error: "Cliente e novo regime tributario sao obrigatorios." }, 400);
  if (!isSupportedTaxRegimeCode(toTaxRegimeCode)) return jsonResponse({ error: "Novo regime tributario nao suportado para obrigacoes padrao." }, 400);

  const { items: newItems } = await loadActiveDefaultLoad(supabaseAdmin, organizationId, toTaxRegimeCode);
  const newTemplateIds = new Set(newItems.map((item) => item.template_id));
  const storedEvidence = await loadClientDefaultEvidence(supabaseAdmin, organizationId, clientId);
  const evidence = mergeDefaultEvidence(storedEvidence, asEvidence(payload.evidence));
  const result = await applyDefaultLoadForClient(supabaseAdmin, {
    organizationId,
    actorId,
    clientId,
    taxRegimeCode: toTaxRegimeCode,
    mode: "regime_migration",
    sourceKind: "regime_migration",
    evidence,
  });

  const { data: profilesData, error: profilesError } = await supabaseAdmin
    .from("client_obligation_profiles")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("client_id", clientId)
    .eq("is_active", true)
    .in("source_kind", ["standard_load", "regime_migration"]);
  if (profilesError) return jsonResponse({ error: profilesError.message }, 400);

  const today = toIsoDate(new Date());
  const profilesToInactivate = ((profilesData || []) as ProfileRow[]).filter((profile) => {
    if (newTemplateIds.has(profile.template_id)) return false;
    if (!fromTaxRegimeCode) return profile.applied_regime !== toTaxRegimeCode;
    return profile.applied_regime === fromTaxRegimeCode;
  });

  for (const profile of profilesToInactivate) {
    const { error: updateError } = await supabaseAdmin
      .from("client_obligation_profiles")
      .update({
        is_active: false,
        end_date: profile.end_date || today,
        inactivation_reason: "regime_change",
        sync_status: "not_applicable",
      })
      .eq("organization_id", organizationId)
      .eq("id", profile.id);
    if (updateError) return jsonResponse({ error: updateError.message }, 400);
    result.decisions.push(await insertDefaultDecision(supabaseAdmin, {
      organizationId,
      batchId: String(result.batch.id),
      clientId,
      templateId: profile.template_id,
      currentProfileId: profile.id,
      decisionType: "auto_inactivate_prior_regime",
      reason: "default_belongs_only_to_prior_regime",
      syncEffect: "future_only",
      autoApplied: true,
    }));
  }

  result.summary.inactivated_prior_regime = profilesToInactivate.length;
  await updateDefaultBatch(supabaseAdmin, String(result.batch.id), result.summary, result.warnings);
  await auditDefaultApplication(supabaseAdmin, {
    organizationId,
    clientId,
    batchId: String(result.batch.id),
    action: "automatic_regime_change_defaults_applied",
    actorId,
    metadata: { from_tax_regime_code: fromTaxRegimeCode, to_tax_regime_code: toTaxRegimeCode, summary: result.summary },
  });

  return jsonResponse({
    ok: true,
    batch_id: result.batch.id,
    summary: result.summary,
    warnings: result.warnings,
    decisions: result.decisions,
    profiles: result.profiles,
  });
}

async function handleListRegimeLoads(
  supabaseAdmin: SupabaseAdmin,
  organizationId: string,
  payload: JsonRecord,
) {
  const taxRegimeCode = asTrimmedString(payload.tax_regime_code);
  const status = asTrimmedString(payload.status);

  const regimesQuery = supabaseAdmin
    .from("tax_regime_definitions")
    .select("*")
    .eq("organization_id", organizationId)
    .order("sort_order", { ascending: true });

  let loadsQuery = supabaseAdmin
    .from("obligation_regime_loads")
    .select("*")
    .eq("organization_id", organizationId)
    .order("tax_regime_code", { ascending: true })
    .order("version", { ascending: false });

  if (taxRegimeCode) loadsQuery = loadsQuery.eq("tax_regime_code", normalizeRegimeCode(taxRegimeCode));
  if (status) loadsQuery = loadsQuery.eq("status", status);

  const [{ data: regimes, error: regimesError }, { data: loads, error: loadsError }] = await Promise.all([
    regimesQuery,
    loadsQuery,
  ]);

  if (regimesError) return jsonResponse({ error: regimesError.message }, 400);
  if (loadsError) return jsonResponse({ error: loadsError.message }, 400);

  const loadIds = ((loads || []) as Array<JsonRecord>).map((load) => String(load.id));

  const [itemsResult, templatesResult, syncRunsResult] = await Promise.all([
    loadIds.length
      ? supabaseAdmin.from("obligation_regime_load_items").select("*").eq("organization_id", organizationId).in("load_id", loadIds)
      : Promise.resolve({ data: [], error: null }),
    supabaseAdmin.from("obligation_templates").select("*").eq("organization_id", organizationId).order("name", { ascending: true }),
    loadIds.length
      ? supabaseAdmin
          .from("obligation_load_sync_runs")
          .select("*")
          .eq("organization_id", organizationId)
          .in("load_id", loadIds)
          .order("started_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (itemsResult.error) return jsonResponse({ error: itemsResult.error.message }, 400);
  if (templatesResult.error) return jsonResponse({ error: templatesResult.error.message }, 400);
  if (syncRunsResult.error) return jsonResponse({ error: syncRunsResult.error.message }, 400);

  return jsonResponse({
    ok: true,
    regimes: regimes || [],
    loads: loads || [],
    items: itemsResult.data || [],
    templates: templatesResult.data || [],
    sync_runs: syncRunsResult.data || [],
    duplicate_warnings: [],
  });
}

async function handleUpsertRegimeLoad(
  supabaseAdmin: SupabaseAdmin,
  actorId: string,
  roles: string[],
  organizationId: string,
  payload: JsonRecord,
) {
  if (!hasTemplateManagerRole(roles)) {
    return jsonResponse({ error: "Only admin, director, or manager can manage regime loads" }, 403);
  }

  const id = asTrimmedString(payload.id);
  const taxRegimeCode = normalizeRegimeCode(payload.tax_regime_code);
  const name = asTrimmedString(payload.name);
  const status = asTrimmedString(payload.status) || "in_review";

  if (!taxRegimeCode || !name) {
    return jsonResponse({ error: "Regime e nome da carga sao obrigatorios." }, 400);
  }

  if (status === "active") {
    let activeQuery = supabaseAdmin
      .from("obligation_regime_loads")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("tax_regime_code", taxRegimeCode)
      .eq("status", "active")
      .limit(1);
    if (id) activeQuery = activeQuery.neq("id", id);
    const { data: activeLoads, error: activeError } = await activeQuery;
    if (activeError) return jsonResponse({ error: activeError.message }, 400);
    if ((activeLoads || []).length > 0) {
      return jsonResponse({ error: "Ja existe uma carga ativa para este regime." }, 409);
    }
  }

  const row = {
    organization_id: organizationId,
    tax_regime_code: taxRegimeCode,
    name,
    status,
    description: asTrimmedString(payload.description),
    owner_sector: asTrimmedString(payload.owner_sector),
    review_notes: asTrimmedString(payload.review_notes),
    effective_from: asTrimmedString(payload.effective_from) || toIsoDate(new Date()),
    effective_until: asTrimmedString(payload.effective_until),
    updated_by: actorId,
    ...(id ? {} : { created_by: actorId }),
  };

  const query = id
    ? supabaseAdmin.from("obligation_regime_loads").update(row).eq("organization_id", organizationId).eq("id", id).select("*").single()
    : supabaseAdmin.from("obligation_regime_loads").insert(row).select("*").single();

  const { data, error } = await query;
  if (error) return jsonResponse({ error: error.message }, 400);
  return jsonResponse({ ok: true, load: data });
}

async function handleUpsertRegimeLoadItem(
  supabaseAdmin: SupabaseAdmin,
  actorId: string,
  roles: string[],
  organizationId: string,
  payload: JsonRecord,
) {
  if (!hasTemplateManagerRole(roles)) {
    return jsonResponse({ error: "Only admin, director, or manager can manage regime load items" }, 403);
  }

  const id = asTrimmedString(payload.id);
  const loadId = asTrimmedString(payload.load_id);
  const templateId = asTrimmedString(payload.template_id);
  const applicability = asTrimmedString(payload.applicability) || "required";
  const conditionKey = asTrimmedString(payload.condition_key);

  if (!loadId || !templateId) {
    return jsonResponse({ error: "Carga e obrigacao mestre sao obrigatorias." }, 400);
  }

  if (applicability === "conditional" && !conditionKey) {
    return jsonResponse({ error: "Obrigacoes condicionais exigem condition_key." }, 400);
  }

  const row = {
    organization_id: organizationId,
    load_id: loadId,
    template_id: templateId,
    applicability,
    condition_key: applicability === "conditional" ? conditionKey : null,
    default_start_policy: asTrimmedString(payload.default_start_policy) || "client_created_at",
    default_due_day_override: asInteger(payload.default_due_day_override, null),
    notes: asTrimmedString(payload.notes),
    is_active: asBoolean(payload.is_active, true),
    sort_order: asInteger(payload.sort_order, 0),
    updated_by: actorId,
    ...(id ? {} : { created_by: actorId }),
  };

  const query = id
    ? supabaseAdmin
        .from("obligation_regime_load_items")
        .update(row)
        .eq("organization_id", organizationId)
        .eq("id", id)
        .select("*")
        .single()
    : supabaseAdmin.from("obligation_regime_load_items").insert(row).select("*").single();

  const { data, error } = await query;
  if (error) return jsonResponse({ error: error.message }, 400);
  return jsonResponse({ ok: true, item: data, warnings: [] });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const authContext = await buildAuthContext(req);
    if ("error" in authContext) return authContext.error;

    const { supabaseAdmin, user, roles, organizationIds } = authContext;
    const body = await req.json();
    const payload = asRecord(body);
    if (!payload) return jsonResponse({ error: "Invalid payload" }, 400);

    const action = asTrimmedString(payload.action);
    if (!action) return jsonResponse({ error: "Action is required" }, 400);

    const organizationId = resolveRequestedOrganizationId(payload, organizationIds);
    await assertOrganizationFeatureEnabled(supabaseAdmin, organizationId, "obrigacoes");
    if (
      action === "register_robot_document_upload" ||
      action === "process_document_queue" ||
      action === "resolve_document" ||
      action === "preview_reference_match" ||
      action === "upload_reference_document" ||
      action === "reprocess_reference_document"
    ) {
      await assertOrganizationFeatureEnabled(supabaseAdmin, organizationId, "robo_documentos");
    }

    if (action === "overview") {
      try {
        return jsonResponse(await buildOverview(supabaseAdmin, user.id, organizationId, payload));
      } catch (error) {
        const message = error instanceof Error ? error.message : "Falha ao carregar o modulo de obrigacoes.";
        console.error("grow-obligations overview failed", { message, organizationId });
        return jsonResponse(buildEmptyOverview([`Falha ao carregar dados de obrigacoes: ${message}`]));
      }
    }

    if (action === "list_clients") {
      return await handleListClients(supabaseAdmin, organizationId);
    }

    if (action === "upsert_template") {
      return await handleUpsertTemplate(supabaseAdmin, user.id, roles, organizationId, payload);
    }

    if (action === "delete_template") {
      return await handleDeleteTemplate(supabaseAdmin, user.id, roles, organizationId, payload);
    }

    if (action === "list_regime_loads") {
      return await handleListRegimeLoads(supabaseAdmin, organizationId, payload);
    }

    if (action === "upsert_regime_load") {
      return await handleUpsertRegimeLoad(supabaseAdmin, user.id, roles, organizationId, payload);
    }

    if (action === "upsert_regime_load_item") {
      return await handleUpsertRegimeLoadItem(supabaseAdmin, user.id, roles, organizationId, payload);
    }

    if (action === "apply_default_obligations") {
      return await handleApplyDefaultObligations(supabaseAdmin, user.id, organizationId, payload);
    }

    if (action === "apply_conditional_default_obligations_after_evidence_update") {
      return await handleApplyConditionalDefaultsAfterEvidenceUpdate(supabaseAdmin, user.id, organizationId, payload);
    }

    if (action === "sync_default_obligations_for_existing_clients") {
      return await handleSyncDefaultObligationsForExistingClients(supabaseAdmin, user.id, organizationId, payload);
    }

    if (action === "apply_regime_change_default_obligations") {
      return await handleApplyRegimeChangeDefaultObligations(supabaseAdmin, user.id, organizationId, payload);
    }

    if (action === "detect_obligation_duplicates") {
      return await handleDetectObligationDuplicates(supabaseAdmin, organizationId, payload);
    }

    if (action === "upsert_profile") {
      return await handleUpsertProfile(supabaseAdmin, user.id, organizationId, payload);
    }

    if (action === "generate_instances") {
      return await handleGenerateInstances(supabaseAdmin, user.id, organizationId, payload);
    }

    if (action === "update_instance") {
      return await handleUpdateInstance(supabaseAdmin, user.id, payload);
    }

    if (action === "register_document_upload" || action === "register_robot_document_upload") {
      return await handleRegisterDocumentUploadNative(supabaseAdmin, user.id, organizationId, payload);
    }

    if (action === "resolve_document") {
      return await handleResolveDocumentNative(supabaseAdmin, user.id, organizationId, payload);
    }

    if (action === "prepare_delivery") {
      return await handlePrepareDelivery(supabaseAdmin, user.id, organizationId, payload);
    }

    if (action === "send_delivery" || action === "retry_delivery") {
      return await handleSendDelivery(supabaseAdmin, user.id, organizationId, payload);
    }

    if (action === "cancel_delivery") {
      return await handleCancelDelivery(supabaseAdmin, user.id, organizationId, payload);
    }

    if (action === "preview_document_match") {
      return await handlePreviewDocumentMatch(supabaseAdmin, payload);
    }

    if (action === "preview_reference_match") {
      return await handlePreviewDocumentMatch(supabaseAdmin, payload);
    }

    if (action === "upload_reference_document") {
      return await handleUploadReferenceDocument(supabaseAdmin, user.id, organizationId, payload);
    }

    if (action === "list_reference_documents") {
      return await handleListReferenceDocuments(supabaseAdmin, organizationId, payload);
    }

    if (action === "delete_reference_document") {
      return await handleDeleteReferenceDocument(supabaseAdmin, organizationId, payload);
    }

    if (action === "reprocess_reference_document") {
      return await handleReprocessReferenceDocument(supabaseAdmin, organizationId, payload);
    }

    if (action === "process_document_queue") {
      return await handleProcessDocumentQueue(supabaseAdmin, user.id, payload);
    }

    if (action === "list_client_snapshot") {
      const clientId = asTrimmedString(payload.client_id);
      if (!clientId) return jsonResponse({ error: "Client id is required" }, 400);
      return await handleClientSnapshot(supabaseAdmin, user.id, organizationId, clientId);
    }

    return jsonResponse({ error: "Unknown action" }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    console.error("grow-obligations-module request failed", { message });
    return jsonResponse({ error: message }, 500);
  }
});
