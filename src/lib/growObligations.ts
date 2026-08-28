import { supabase } from "@/integrations/supabase/client";

export type GrowExpectedDocument = {
  document_type_key: string;
  label: string;
  aliases: string[];
  required: boolean;
  active: boolean;
  reference_files_count?: number;
  has_active_reference?: boolean;
  reference_files?: GrowExpectedDocumentReferenceFile[];
};

export type GrowExpectedDocumentReferenceFile = {
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
  source_kind: "template_reference" | "profile_override";
  extracted_text_preview: string | null;
  text_extraction_status: "pending" | "completed" | "failed";
  ocr_status: "pending" | "not_needed" | "completed" | "failed";
  fingerprint_version: number;
  fingerprint_payload: Record<string, unknown>;
  keywords: string[];
  primary_cues: string[];
  model_version: number;
  validation_status: "draft" | "validating" | "approved" | "inactive";
  validation_sample_count: number;
  validation_correct_count: number;
  validation_false_positive_count: number;
  last_validated_at: string | null;
  created_at: string;
};

export type GrowObligationTemplate = {
  id: string;
  code: string;
  name: string;
  normalized_name?: string | null;
  duplicate_group_key?: string | null;
  baseline_source?: "manual" | "seed" | "migration" | "legacy_import" | "default_regime_matrix_20260710" | string | null;
  catalog_review_status?: "approved" | "needs_review" | "duplicate_candidate" | "inactive";
  sector: string;
  periodicity: "monthly" | "quarterly" | "yearly" | "custom";
  competence_reference: "vigente" | "anterior";
  technical_due_month_reference: "vigente" | "anterior";
  due_day: number;
  due_rule_type: "calendar_day" | "business_day_from_month_start" | "last_business_day" | "fixed_date";
  due_date_adjustment_policy: "none" | "previous_business_day" | "next_business_day";
  due_business_day_index: number | null;
  due_fixed_month: number | null;
  due_fixed_day: number | null;
  due_fixed_dates: Array<{ month: number; day: number; label?: string | null }> | null;
  yearly_due_month: number | null;
  legal_due_day: number | null;
  priority: "baixa" | "media" | "alta" | "urgente";
  expected_documents: GrowExpectedDocument[];
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
};

export const growPeriodicityLabel: Record<GrowObligationTemplate["periodicity"], string> = {
  monthly: "Mensal",
  quarterly: "Trimestral",
  yearly: "Anual",
  custom: "Personalizada",
};

export const growCompetenceReferenceLabel: Record<GrowObligationTemplate["competence_reference"], string> = {
  vigente: "Vigente",
  anterior: "Anterior",
};

export const growDueMonthReferenceLabel: Record<GrowObligationTemplate["technical_due_month_reference"], string> = {
  vigente: "Mês vigente",
  anterior: "Mês anterior",
};

export type GrowClientSummary = {
  id: string;
  name: string;
  cnpj: string | null;
  regime?: string | null;
  tax_regime_code?: string | null;
  sector: string;
  status: string;
  email?: string | null;
  contact?: string | null;
  phone?: string | null;
  obligation_completion_whatsapp_enabled?: boolean;
};

export type GrowObligationProfile = {
  id: string;
  client_id: string;
  template_id: string;
  source_kind?: "standard_load" | "manual" | "regime_migration" | "legacy" | "exception";
  source_load_id?: string | null;
  source_load_item_id?: string | null;
  applied_regime?: string | null;
  application_batch_id?: string | null;
  inactivation_reason?: string | null;
  sync_status?: "current" | "skipped" | "not_applicable";
  conditional_review_reason?: string | null;
  conditional_skip_reason?: string | null;
  assigned_to: string | null;
  start_date: string;
  end_date: string | null;
  is_active: boolean;
  due_day_override: number | null;
  yearly_due_month_override: number | null;
  legal_due_day_override: number | null;
  expected_documents_override: GrowExpectedDocument[] | null;
  notes: string | null;
  template: GrowObligationTemplate | null;
  client: GrowClientSummary | null;
};

export const growObligationSourceLabel: Record<NonNullable<GrowObligationProfile["source_kind"]>, string> = {
  standard_load: "Padrão por regime",
  manual: "Manual",
  regime_migration: "Migração de regime",
  legacy: "Legado",
  exception: "Exceção",
};

export type GrowObligationInstance = {
  id: string;
  client_id: string;
  profile_id: string;
  template_id: string;
  competence_label: string;
  competence_date: string;
  competence_key: string;
  technical_due_date: string;
  legal_due_date: string | null;
  status:
    | "pendente"
    | "em_andamento"
    | "aguardando_documento"
    | "em_revisao"
    | "pronto_para_envio"
    | "enviando"
    | "falha_envio"
    | "concluida"
    | "atrasada"
    | "cancelada";
  priority: "baixa" | "media" | "alta" | "urgente";
  current_assignee: string | null;
  protocol: string | null;
  protocol_issued_at: string | null;
  processed_automatically: boolean;
  ready_for_delivery_at?: string | null;
  delivery_review_required?: boolean;
  delivery_review_reason?: string | null;
  completion_notes: string | null;
  document_required: boolean;
  completed_at: string | null;
  updated_at: string;
  created_at: string;
  template: GrowObligationTemplate | null;
  client: GrowClientSummary | null;
  profile: GrowObligationProfile | null;
  delivery_attempts?: GrowObligationDeliveryAttempt[];
  latest_delivery_attempt?: GrowObligationDeliveryAttempt | null;
};

export type GrowObligationDeliveryAttemptStatus = "queued" | "sending" | "sent" | "failed" | "cancelled";

export type GrowObligationDeliveryAttempt = {
  id: string;
  organization_id: string;
  client_id: string | null;
  instance_id: string;
  inbox_item_id: string | null;
  sender_user_id: string;
  sender_email: string;
  verified_from_email: string;
  display_sender_context: string | null;
  reply_to: string | null;
  delivery_channel?: "email" | "whatsapp";
  recipient_email: string | null;
  recipient_phone?: string | null;
  subject: string;
  message_body: string;
  attachment_file_ids: string[];
  status: GrowObligationDeliveryAttemptStatus;
  provider_message_id: string | null;
  provider_status: number | null;
  failure_reason: string | null;
  human_confirmed_at: string | null;
  sent_at: string | null;
  failed_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
};

export type GrowDocumentInboxItem = {
  id: string;
  ingestion_job_id: string | null;
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
  source_kind: "web_manual" | "local_robot" | "api";
  file_hash: string | null;
  content_type: string | null;
  file_size: number | null;
  suggested_competence_label: string | null;
  detected_cnpj: string | null;
  competence_detected: string | null;
  identification_confidence: number;
  matched_by:
    | "manual_instance"
    | "direct_expected_doc"
    | "alias_match"
    | "single_open_instance"
    | "manual_review"
    | null;
  match_score: number;
  match_reasons: string[];
  reference_file_id: string | null;
  reference_match_score: number;
  reference_match_reasons: string[];
  review_required: boolean;
  status: "pending_review" | "linked" | "rejected";
  blocking_reason: string | null;
  text_extraction_status: "pending" | "completed" | "failed";
  ocr_status: "pending" | "not_needed" | "completed" | "failed";
  extracted_text_preview: string | null;
  auto_link_block_reason: string | null;
  processing_status: "queued" | "processing" | "processed" | "failed";
  processing_attempts: number;
  processing_started_at: string | null;
  processing_completed_at: string | null;
  last_processing_error: string | null;
  classification_status: "queued" | "classified" | "review_required" | "failed";
  application_status: "pending" | "applied" | "skipped" | "failed";
  communication_status: "pending" | "sent" | "partial" | "failed" | "not_applicable";
  publication_status: "pending" | "published" | "failed" | "not_applicable";
  execution_status: "pending" | "applied" | "skipped" | "failed";
  execution_notes: string | null;
  archive_path: string | null;
  robot_origin_path: string | null;
  robot_machine_id: string | null;
  protocol_number: string | null;
  protocol_issued_at: string | null;
  processed_automatically: boolean;
  recognition_evidence: Record<string, unknown>;
  original_match_snapshot: Record<string, unknown>;
  correction_reason: string | null;
  corrected_by: string | null;
  corrected_at: string | null;
  recognition_decision: "pending" | "automatic" | "manual_review" | "manual_corrected" | "rejected";
  notes: string | null;
  created_at: string;
  client: GrowClientSummary | null;
  detected_client: GrowClientSummary | null;
  template: GrowObligationTemplate | null;
  linked_instance: GrowObligationInstance | null;
  document_definition: GrowExpectedDocument | null;
  reference_file: GrowExpectedDocumentReferenceFile | null;
};

export type GrowDocumentIngestionJob = {
  id: string;
  source_kind: "web_manual" | "local_robot" | "api";
  status: "queued" | "ingested" | "review_required" | "processing" | "completed" | "failed";
  classification_status: "queued" | "classified" | "review_required" | "failed";
  application_status: "pending" | "applied" | "skipped" | "failed";
  communication_status: "pending" | "sent" | "partial" | "failed" | "not_applicable";
  publication_status: "pending" | "published" | "failed" | "not_applicable";
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
  metadata: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type GrowObligationsOverviewPayload = {
  ok: boolean;
  summary: {
    templates_total: number;
    templates_active: number;
    active_profiles: number;
    pending_instances: number;
    overdue_instances: number;
    waiting_documents: number;
    done_instances: number;
    inbox_pending: number;
    inbox_processing: number;
    inbox_failed: number;
    inbox_applied: number;
    robot_received_today: number;
    robot_completed_today: number;
    robot_review_required: number;
    robot_failed_total: number;
    document_models_total: number;
    document_models_configured: number;
    document_models_approved: number;
    document_models_validating: number;
    recognition_automatic: number;
    recognition_corrected: number;
    recognition_rejected: number;
  };
  clients: GrowClientSummary[];
  templates: GrowObligationTemplate[];
  profiles: GrowObligationProfile[];
  instances: GrowObligationInstance[];
  documents: GrowDocumentInboxItem[];
  ingestion_jobs: GrowDocumentIngestionJob[];
  delivery_attempts?: GrowObligationDeliveryAttempt[];
  regime_loads?: unknown[];
  regime_load_items?: unknown[];
  obligation_load_sync_runs?: unknown[];
};

export type GrowClientSnapshotPayload = {
  ok: boolean;
  client_id: string;
  profiles: GrowObligationProfile[];
  instances: GrowObligationInstance[];
  templates: GrowObligationTemplate[];
};

export async function getStoredCurrentOrganizationId() {
  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user?.id;
  if (!userId) return null;

  const storageKey = `grow-current-organization-${userId}`;
  const storedOrganizationId = localStorage.getItem(storageKey);
  if (storedOrganizationId) return storedOrganizationId;

  const { data: accessRows, error: accessError } = await supabase
    .from("organization_user_access")
    .select("organization_id, organizations(id, slug, is_active)")
    .eq("user_id", userId)
    .eq("status", "active");

  if (accessError) return null;

  const rows = (accessRows || [])
    .map((row) => {
      const organization = Array.isArray(row.organizations) ? row.organizations[0] : row.organizations;
      return {
        organizationId: row.organization_id ? String(row.organization_id) : "",
        slug: organization?.slug ? String(organization.slug) : "",
        isActive: organization?.is_active !== false,
      };
    })
    .filter((row) => row.organizationId && row.isActive);

  const resolvedOrganizationId =
    rows.find((row) => row.slug === "grow")?.organizationId ||
    rows[0]?.organizationId ||
    null;

  if (resolvedOrganizationId) {
    localStorage.setItem(storageKey, resolvedOrganizationId);
  }

  return resolvedOrganizationId;
}

export async function invokeGrowObligations<T>(body: Record<string, unknown>) {
  const organizationId =
    typeof body.organization_id === "string" || typeof body.organizationId === "string"
      ? null
      : await getStoredCurrentOrganizationId();
  const scopedBody = organizationId ? { ...body, organization_id: organizationId } : body;
  const { data, error } = await supabase.functions.invoke<T>("grow-obligations-module", { body: scopedBody });

  if (error) {
    const errorWithContext = error as Error & { context?: Response };
    const response = errorWithContext.context;
    if (response) {
      let parsedErrorMessage: string | null = null;
      try {
        const payload = await response.clone().json() as { error?: string; detail?: string };
        parsedErrorMessage = [payload?.error, payload?.detail].filter(Boolean).join(" Detalhe: ") || null;
      } catch {
        // Response is not JSON; try text below.
      }
      if (parsedErrorMessage) {
        throw new Error(parsedErrorMessage);
      }
      let textErrorMessage: string | null = null;
      try {
        const text = await response.clone().text();
        textErrorMessage = text || null;
      } catch {
        // fall through to original error
      }
      if (textErrorMessage) {
        throw new Error(textErrorMessage);
      }
    }
    throw errorWithContext;
  }

  return data as T;
}

export const growObligationStatusLabel: Record<GrowObligationInstance["status"], string> = {
  pronto_para_envio: "Pronta para envio",
  enviando: "Enviando",
  falha_envio: "Falha no envio",
  pendente: "Pendente",
  em_andamento: "Em andamento",
  aguardando_documento: "Aguardando documento",
  em_revisao: "Em revisão",
  concluida: "Concluída",
  atrasada: "Atrasada",
  cancelada: "Cancelada",
};

export const growObligationStatusClass: Record<GrowObligationInstance["status"], string> = {
  pronto_para_envio: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/20 dark:text-cyan-300",
  enviando: "bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300",
  falha_envio: "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-300",
  pendente: "bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300",
  em_andamento: "bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300",
  aguardando_documento: "bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-300",
  em_revisao: "bg-violet-100 text-violet-700 dark:bg-violet-900/20 dark:text-violet-300",
  concluida: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300",
  atrasada: "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-300",
  cancelada: "bg-muted text-muted-foreground",
};

export const growPriorityLabel: Record<GrowObligationInstance["priority"], string> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
  urgente: "Urgente",
};
