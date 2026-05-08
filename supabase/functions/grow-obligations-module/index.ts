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
  code: string;
  name: string;
  sector: string;
  periodicity: string;
  competence_reference: string;
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
};

type ProfileRow = {
  id: string;
  client_id: string;
  template_id: string;
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
  completed_at: string | null;
  updated_at: string;
  created_at: string;
};

type InboxRow = {
  id: string;
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
  notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
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

function normalizeToken(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizeTemplateCode(value: string) {
  return normalizeToken(value).replace(/_+/g, "-");
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

function computeDueDate(competenceDate: Date, dueDay: number) {
  const year = competenceDate.getUTCFullYear();
  const monthIndex = competenceDate.getUTCMonth();
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

  const { data: roleRows, error: roleError } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);

  if (roleError) throw roleError;

  const roles = (roleRows || [])
    .map((row) => asTrimmedString((row as JsonRecord).role))
    .filter((role): role is string => Boolean(role));
  const internal = roles.some((role) => internalRoles.has(role));

  if (!internal) {
    return { error: jsonResponse({ error: "Only internal users can access this module" }, 403) };
  }

  return { supabaseAdmin, user, roles };
}

async function loadClientsMap(supabaseAdmin: SupabaseAdmin) {
  const { data, error } = await supabaseAdmin
    .from("clients")
    .select("id, name, cnpj, sector, status")
    .order("name");

  if (error) throw error;

  return new Map(
    (data || []).map((row) => [
      String((row as JsonRecord).id),
      {
        id: String((row as JsonRecord).id),
        name: String((row as JsonRecord).name || ""),
        cnpj: normalizeCnpj(asTrimmedString((row as JsonRecord).cnpj)),
        sector: asTrimmedString((row as JsonRecord).sector) || "Geral",
        status: asTrimmedString((row as JsonRecord).status) || "Ativo",
      },
    ]),
  );
}

async function loadTemplatesMap(supabaseAdmin: SupabaseAdmin) {
  const { data, error } = await supabaseAdmin
    .from("obligation_templates")
    .select("*")
    .order("name");

  if (error) throw error;
  return new Map((data || []).map((row) => [String((row as JsonRecord).id), row as TemplateRow]));
}

async function loadProfilesMap(supabaseAdmin: SupabaseAdmin) {
  const { data, error } = await supabaseAdmin
    .from("client_obligation_profiles")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return new Map((data || []).map((row) => [String((row as JsonRecord).id), row as ProfileRow]));
}

async function loadReferenceFilesMap(supabaseAdmin: SupabaseAdmin) {
  const { data, error } = await supabaseAdmin
    .from("expected_document_reference_files")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: false });

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
    return {
      ...emptyResult,
      detectedClientId: effectiveClientId,
      reasons: ["Cliente identificado, mas nenhuma obrigacao ativa com documento modelo correspondente foi encontrada."],
      autoLinkBlockReason: "Nao existe documento modelo ativo para as obrigacoes vinculadas.",
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

  if (template.generates_calendar) {
    const payload = {
      title: `${template.name} · ${instance.competence_label}`,
      description: `${clientName}\nCompetência: ${instance.competence_label}`,
      entry_type: "obrigação",
      priority: instance.priority,
      sector: template.sector,
      due_at: dueDate,
      all_day: true,
      status: instanceDone ? "completed" : "pending",
      client_name: clientName,
      integration_source: "grow_obligation",
      integration_key: integrationKey,
    };

    const { data: existingEvent, error: eventLookupError } = await supabaseAdmin
      .from("calendar_events")
      .select("id")
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
  }

  const { data: existingTask, error: taskLookupError } = await supabaseAdmin
    .from("kanban_tasks")
    .select("id")
    .eq("integration_source", "grow_obligation_task")
    .eq("integration_task_id", taskIntegrationKey)
    .maybeSingle();

  if (taskLookupError) throw taskLookupError;

  if (!template.generates_kanban) {
    if (existingTask?.id) {
      const { error } = await supabaseAdmin
        .from("kanban_tasks")
        .delete()
        .eq("id", existingTask.id);
      if (error) throw error;
    }
    return;
  }

  const taskStatus =
    instance.status === "concluida"
      ? "done"
      : instance.status === "em_revisao"
        ? "review"
        : instance.status === "em_andamento"
          ? "doing"
          : instance.status === "atrasada"
            ? "todo"
            : "backlog";

  const taskPayload = {
    title: obligationTitle,
    description: `Obrigação Grow\nCompetência: ${instance.competence_label}`,
    sector: template.sector,
    client_name: clientName,
    assignee: instance.current_assignee,
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
    const assignedEnd = profile.end_date ? new Date(`${profile.end_date}T00:00:00.000Z`) : null;

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

      if (currentCompetenceTime < assignedStart.getTime()) {
        cursor.setUTCMonth(cursor.getUTCMonth() + 1);
        continue;
      }

      if (assignedEnd && currentCompetenceTime > assignedEnd.getTime()) {
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
        );
        const legalDueDate = template.legal_due_day
          ? computeDueDate(currentCompetenceDate, profile.legal_due_day_override ?? template.legal_due_day)
          : null;

        inserts.push({
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
          document_required: template.requires_document,
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

async function buildOverview(supabaseAdmin: SupabaseAdmin, actorId: string) {
  const templatesMap = await loadTemplatesMap(supabaseAdmin);
  const profilesMap = await loadProfilesMap(supabaseAdmin);
  const clientsMap = await loadClientsMap(supabaseAdmin);
  const referenceFiles = await loadReferenceFilesMap(supabaseAdmin);

  const windowStart = new Date();
  windowStart.setUTCMonth(windowStart.getUTCMonth() - 1);
  windowStart.setUTCDate(1);
  const windowEnd = new Date();
  windowEnd.setUTCMonth(windowEnd.getUTCMonth() + 2);
  windowEnd.setUTCDate(1);

  await ensureInstancesForProfiles(
    supabaseAdmin,
    Array.from(profilesMap.values()),
    templatesMap,
    actorId,
    windowStart,
    windowEnd,
  );
  await markOverdueInstances(supabaseAdmin, actorId);

  const [{ data: instancesData, error: instancesError }, { data: docsData, error: docsError }] = await Promise.all([
    supabaseAdmin
      .from("obligation_instances")
      .select("*")
      .order("technical_due_date", { ascending: true })
      .limit(240),
    supabaseAdmin
      .from("document_inbox_items")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(120),
  ]);

  if (instancesError) throw instancesError;
  if (docsError) throw docsError;

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

  const instances = ((instancesData || []) as InstanceRow[]).map((instance) => ({
    ...instance,
    template: templatesMap.get(instance.template_id) || null,
    client: clientsMap.get(instance.client_id) || null,
    profile: profilesMap.get(instance.profile_id) || null,
  }));

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
      reference_file: referenceFiles.byId.get(String(row.reference_file_id || "")) || null,
    };
  });

  const summary = {
    templates_total: templates.length,
    templates_active: templates.filter((template) => template.is_active).length,
    active_profiles: profiles.filter((profile) => profile.is_active).length,
    pending_instances: instances.filter((instance) => instance.status === "pendente").length,
    overdue_instances: instances.filter((instance) => instance.status === "atrasada").length,
    waiting_documents: instances.filter((instance) => instance.status === "aguardando_documento").length,
    done_instances: instances.filter((instance) => instance.status === "concluida").length,
    inbox_pending: documents.filter((item) => item.status === "pending_review").length,
  };

  return {
    ok: true,
    summary,
    clients: Array.from(clientsMap.values()),
    templates,
    profiles,
    instances,
    documents,
  };
}

async function handleUpsertTemplate(
  supabaseAdmin: SupabaseAdmin,
  actorId: string,
  roles: string[],
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

  const row = {
    code: normalizeTemplateCode(codeSource),
    name,
    sector: asTrimmedString(payload.sector) || "Geral",
    periodicity: asTrimmedString(payload.periodicity) || "monthly",
    competence_reference: asTrimmedString(payload.competence_reference) || "vigente",
    due_day: asInteger(payload.due_day, 10),
    yearly_due_month: asInteger(payload.yearly_due_month, null),
    legal_due_day: asInteger(payload.legal_due_day, null),
    priority: asTrimmedString(payload.priority) || "media",
    expected_documents: asExpectedDocuments(payload.expected_documents),
    is_active: asBoolean(payload.is_active, true),
    generates_calendar: asBoolean(payload.generates_calendar, true),
    generates_kanban: asBoolean(payload.generates_kanban, false),
    requires_document: asBoolean(payload.requires_document, true),
    operational_notes: asTrimmedString(payload.operational_notes),
    created_by: actorId,
  };

  const query = id
    ? supabaseAdmin.from("obligation_templates").update(row).eq("id", id).select("*").single()
    : supabaseAdmin.from("obligation_templates").insert(row).select("*").single();

  const { data, error } = await query;
  if (error) return jsonResponse({ error: error.message }, 400);

  return jsonResponse({ ok: true, template: data });
}

async function handleUpsertProfile(
  supabaseAdmin: SupabaseAdmin,
  actorId: string,
  payload: JsonRecord,
) {
  const id = asTrimmedString(payload.id);
  const clientId = asTrimmedString(payload.client_id);
  const templateId = asTrimmedString(payload.template_id);
  if (!clientId || !templateId) {
    return jsonResponse({ error: "Cliente e obrigação são obrigatórios." }, 400);
  }

  const row = {
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
    created_by: actorId,
  };

  const query = id
    ? supabaseAdmin.from("client_obligation_profiles").update(row).eq("id", id).select("*").single()
    : supabaseAdmin.from("client_obligation_profiles").upsert(row, { onConflict: "client_id,template_id" }).select("*").single();

  const { data, error } = await query;
  if (error) return jsonResponse({ error: error.message }, 400);

  const templatesMap = await loadTemplatesMap(supabaseAdmin);
  const profile = data as ProfileRow;
  await ensureInstancesForProfiles(
    supabaseAdmin,
    [profile],
    templatesMap,
    actorId,
    new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() - 1, 1)),
    new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() + 2, 1)),
  );

  return jsonResponse({ ok: true, profile: data });
}

async function handleGenerateInstances(
  supabaseAdmin: SupabaseAdmin,
  actorId: string,
  payload: JsonRecord,
) {
  const clientId = asTrimmedString(payload.client_id);
  const monthsBack = Math.max(0, asInteger(payload.months_back, 1) || 1);
  const monthsForward = Math.max(0, asInteger(payload.months_forward, 2) || 2);

  let profilesQuery = supabaseAdmin.from("client_obligation_profiles").select("*").eq("is_active", true);
  if (clientId) profilesQuery = profilesQuery.eq("client_id", clientId);

  const { data: profilesData, error: profilesError } = await profilesQuery;
  if (profilesError) return jsonResponse({ error: profilesError.message }, 400);

  const templatesMap = await loadTemplatesMap(supabaseAdmin);
  const start = new Date();
  start.setUTCMonth(start.getUTCMonth() - monthsBack);
  start.setUTCDate(1);
  const end = new Date();
  end.setUTCMonth(end.getUTCMonth() + monthsForward);
  end.setUTCDate(1);

  const result = await ensureInstancesForProfiles(
    supabaseAdmin,
    (profilesData || []) as ProfileRow[],
    templatesMap,
    actorId,
    start,
    end,
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
  payload: JsonRecord,
) {
  const fileName = asTrimmedString(payload.file_name);
  const storagePath = asTrimmedString(payload.storage_path);
  const storageBucket = asTrimmedString(payload.storage_bucket) || "obligation-files";
  if (!fileName || !storagePath) {
    return jsonResponse({ error: "Arquivo e caminho de storage sÃ£o obrigatÃ³rios." }, 400);
  }

  const clientId = asTrimmedString(payload.client_id);
  const analysis = parseDocumentAnalysisPayload(payload.analysis);
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

  const inboxRow = {
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
    status: autoLinked ? "linked" : "pending_review",
    blocking_reason: autoLinked ? null : "Aguardando validaÃ§Ã£o humana para vincular o arquivo.",
    text_extraction_status: match.textExtractionStatus || analysis.text_extraction_status,
    ocr_status: match.ocrStatus || analysis.ocr_status,
    extracted_text_preview: match.extractedTextPreview || analysis.extracted_text_preview,
    fingerprint_payload: match.fingerprintPayload || analysis.fingerprint_payload,
    auto_link_block_reason: match.autoLinkBlockReason || null,
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
    return jsonResponse({ error: inboxError?.message || "Falha ao registrar documento." }, 400);
  }

  if (autoLinked && match.resolvedInstanceId) {
    const { error: fileError } = await supabaseAdmin
      .from("obligation_instance_files")
      .insert({
        instance_id: match.resolvedInstanceId,
        inbox_item_id: String((inboxItem as JsonRecord).id),
        file_name: fileName,
        storage_bucket: storageBucket,
        storage_path: storagePath,
        content_type: asTrimmedString(payload.content_type),
        file_size: asInteger(payload.file_size, null),
        triage_status: "accepted",
        source: match.strategy,
        uploaded_by: actorId,
        identification_confidence: match.score,
      });

    if (fileError) throw fileError;
  }

  return jsonResponse({ ok: true, inbox_item: inboxItem, match });
}

async function handleResolveDocumentNative(
  supabaseAdmin: SupabaseAdmin,
  actorId: string,
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
      identification_confidence: Number((inboxItem as JsonRecord).match_score || (inboxItem as JsonRecord).identification_confidence || 1),
    }, { onConflict: "storage_bucket,storage_path" });

  if (fileError) throw fileError;

  return jsonResponse({ ok: true });
}

async function handlePreviewDocumentMatch(
  supabaseAdmin: SupabaseAdmin,
  payload: JsonRecord,
) {
  const fileName = asTrimmedString(payload.file_name);
  if (!fileName) {
    return jsonResponse({ error: "Nome do arquivo Ã© obrigatÃ³rio para o preview." }, 400);
  }

  const match = await resolveDocumentReferenceMatch(supabaseAdmin, {
    clientId: asTrimmedString(payload.client_id),
    instanceId: asTrimmedString(payload.instance_id),
    templateId: asTrimmedString(payload.template_id),
    documentTypeKey: asTrimmedString(payload.document_type_key),
    suggestedCompetenceLabel: asTrimmedString(payload.suggested_competence_label),
    fileName,
    analysis: parseDocumentAnalysisPayload(payload.analysis),
  });

  return jsonResponse({ ok: true, match });
}

async function handleUploadReferenceDocument(
  supabaseAdmin: SupabaseAdmin,
  actorId: string,
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
  payload: JsonRecord,
) {
  const templateId = asTrimmedString(payload.template_id);
  const documentTypeKey = asTrimmedString(payload.document_type_key);
  let query = supabaseAdmin.from("expected_document_reference_files").select("*").order("created_at", { ascending: false });
  if (templateId) query = query.eq("template_id", templateId);
  if (documentTypeKey) query = query.eq("document_type_key", documentTypeKey);
  const { data, error } = await query;
  if (error) return jsonResponse({ error: error.message }, 400);
  return jsonResponse({ ok: true, reference_files: data || [] });
}

async function handleDeleteReferenceDocument(
  supabaseAdmin: SupabaseAdmin,
  payload: JsonRecord,
) {
  const referenceId = asTrimmedString(payload.reference_file_id);
  if (!referenceId) return jsonResponse({ error: "reference_file_id e obrigatorio." }, 400);
  const { error } = await supabaseAdmin.from("expected_document_reference_files").delete().eq("id", referenceId);
  if (error) return jsonResponse({ error: error.message }, 400);
  return jsonResponse({ ok: true });
}

async function handleReprocessReferenceDocument(
  supabaseAdmin: SupabaseAdmin,
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
    .select("*")
    .single();
  if (error || !data) return jsonResponse({ error: error?.message || "Falha ao reprocessar documento modelo." }, 400);
  return jsonResponse({ ok: true, reference_file: data });
}

async function handleClientSnapshot(supabaseAdmin: SupabaseAdmin, actorId: string, clientId: string) {
  const overview = await buildOverview(supabaseAdmin, actorId);
  return jsonResponse({
    ok: true,
    client_id: clientId,
    profiles: overview.profiles.filter((profile) => String((profile.client || {}).id || profile.client_id) === clientId),
    instances: overview.instances.filter((instance) => String((instance.client || {}).id || instance.client_id) === clientId),
    templates: overview.templates,
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
    const authContext = await buildAuthContext(req);
    if ("error" in authContext) return authContext.error;

    const { supabaseAdmin, user, roles } = authContext;
    const body = await req.json();
    const payload = asRecord(body);
    if (!payload) return jsonResponse({ error: "Invalid payload" }, 400);

    const action = asTrimmedString(payload.action);
    if (!action) return jsonResponse({ error: "Action is required" }, 400);

    if (action === "overview") {
      return jsonResponse(await buildOverview(supabaseAdmin, user.id));
    }

    if (action === "upsert_template") {
      return await handleUpsertTemplate(supabaseAdmin, user.id, roles, payload);
    }

    if (action === "upsert_profile") {
      return await handleUpsertProfile(supabaseAdmin, user.id, payload);
    }

    if (action === "generate_instances") {
      return await handleGenerateInstances(supabaseAdmin, user.id, payload);
    }

    if (action === "update_instance") {
      return await handleUpdateInstance(supabaseAdmin, user.id, payload);
    }

    if (action === "register_document_upload") {
      return await handleRegisterDocumentUploadNative(supabaseAdmin, user.id, payload);
    }

    if (action === "resolve_document") {
      return await handleResolveDocumentNative(supabaseAdmin, user.id, payload);
    }

    if (action === "preview_document_match") {
      return await handlePreviewDocumentMatch(supabaseAdmin, payload);
    }

    if (action === "preview_reference_match") {
      return await handlePreviewDocumentMatch(supabaseAdmin, payload);
    }

    if (action === "upload_reference_document") {
      return await handleUploadReferenceDocument(supabaseAdmin, user.id, payload);
    }

    if (action === "list_reference_documents") {
      return await handleListReferenceDocuments(supabaseAdmin, payload);
    }

    if (action === "delete_reference_document") {
      return await handleDeleteReferenceDocument(supabaseAdmin, payload);
    }

    if (action === "reprocess_reference_document") {
      return await handleReprocessReferenceDocument(supabaseAdmin, payload);
    }

    if (action === "list_client_snapshot") {
      const clientId = asTrimmedString(payload.client_id);
      if (!clientId) return jsonResponse({ error: "Client id is required" }, 400);
      return await handleClientSnapshot(supabaseAdmin, user.id, clientId);
    }

    return jsonResponse({ error: "Unknown action" }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return jsonResponse({ error: message }, 500);
  }
});
