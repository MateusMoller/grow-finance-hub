export type TaxRegimeCode = "simples_nacional" | "lucro_presumido" | "lucro_real" | "mei";

export type BranchRegimeResolution =
  | { status: "own_regime"; taxRegimeCode: TaxRegimeCode }
  | { status: "inherited_requires_review"; taxRegimeCode: TaxRegimeCode; reason: string }
  | { status: "unsupported"; taxRegimeCode: null; reason: string };

export type RegimeLoadStatus = "active" | "inactive" | "in_review";
export type RegimeLoadApplicability = "required" | "optional" | "conditional";
export type RegimeLoadConditionKey =
  | "has_employees"
  | "iss_applicable"
  | "icms_taxpayer"
  | "service_provider"
  | "accounting_contracted"
  | "municipal_service_declaration_required"
  | "state_registration"
  | "state_registration_or_required"
  | "icms_ipi_taxpayer"
  | "icms_st_difal_anticipation"
  | "retentions_or_services"
  | "has_employees_or_retentions"
  | "ecd_applicable"
  | "efd_contribuicoes_applicable"
  | "tax_benefit_or_incentive_usage";

export type RegimeLoadDefaultStartPolicy = "client_created_at" | "current_month" | "next_month" | "custom";

export type ClientObligationSourceKind =
  | "standard_load"
  | "manual"
  | "regime_migration"
  | "legacy"
  | "exception";

export type ClientObligationSyncStatus = "current" | "skipped" | "not_applicable";

export type RegimeLoadApplicationMode =
  | "new_client"
  | "manual_apply"
  | "regime_migration"
  | "reconcile_existing"
  | "standard_load_sync";

export type RegimeLoadSyncScope = "single_client" | "existing_clients_same_regime" | "branch_inherited_regime";
export type RegimeLoadBatchStatus = "initialized" | "previewed" | "applied" | "failed" | "cancelled";
export type RegimeLoadReviewDecision =
  | "add"
  | "keep"
  | "reactivate"
  | "suggest_inactivate"
  | "auto_inactivate_prior_regime"
  | "inactivate_prior_regime"
  | "skip"
  | "duplicate_risk"
  | "blocked";

export type RegimeLoadSyncRunStatus =
  | "queued"
  | "processing"
  | "completed"
  | "completed_with_warnings"
  | "failed"
  | "cancelled";

export interface TaxRegimeDefinition {
  id?: string;
  organization_id?: string;
  code: TaxRegimeCode;
  label: string;
  aliases: string[];
  is_active: boolean;
  sort_order: number;
}

export interface RegimeLoad {
  id: string;
  organization_id: string;
  tax_regime_code: TaxRegimeCode;
  name: string;
  status: RegimeLoadStatus;
  version: number;
  description: string | null;
  owner_sector: string | null;
  review_notes: string | null;
  effective_from: string;
  effective_until: string | null;
}

export interface RegimeLoadItem {
  id: string;
  organization_id: string;
  load_id: string;
  template_id: string;
  applicability: RegimeLoadApplicability;
  condition_key: RegimeLoadConditionKey | null;
  default_start_policy: RegimeLoadDefaultStartPolicy;
  default_due_day_override: number | null;
  notes: string | null;
  is_active: boolean;
  sort_order: number;
}

export interface RegimeLoadApplicationSummary {
  add: number;
  keep: number;
  created: number;
  reactivated: number;
  suggest_inactivate: number;
  inactivated_prior_regime: number;
  inactivated: number;
  duplicate_risk: number;
  blocked: number;
  skipped: number;
  conditional_skipped: number;
  review_required: number;
}

export interface RegimeLoadApplicationBatch {
  id: string;
  organization_id: string;
  client_id: string;
  tax_regime_code: TaxRegimeCode;
  load_id: string | null;
  mode: RegimeLoadApplicationMode;
  sync_scope: RegimeLoadSyncScope;
  status: RegimeLoadBatchStatus;
  summary: Partial<RegimeLoadApplicationSummary>;
  warnings: string[];
}

export interface RegimeLoadApplicationReview {
  id: string;
  organization_id: string;
  batch_id: string;
  client_id: string;
  template_id: string;
  load_item_id: string | null;
  decision_type: RegimeLoadReviewDecision;
  current_profile_id: string | null;
  reason: string;
  requires_confirmation: boolean;
  selected: boolean;
  auto_applied?: boolean;
  evidence_source: string | null;
  sync_effect: "profile_only" | "future_only" | "no_change" | "blocked";
}

export interface RegimeLoadSyncRun {
  id: string;
  organization_id: string;
  load_id: string;
  tax_regime_code: TaxRegimeCode;
  status: RegimeLoadSyncRunStatus;
  scope: "existing_clients_same_regime";
  clients_total: number;
  clients_processed: number;
  profiles_created: number;
  profiles_reactivated: number;
  profiles_inactivated_future: number;
  profiles_skipped: number;
  review_required: number;
  warnings: string[];
}

export type DuplicateMatchType = "code" | "normalized_name" | "semantic";
export type DuplicateSeverity = "block" | "review";

export interface ObligationDuplicateMatch {
  template_id: string;
  code: string | null;
  name: string;
  normalized_name: string;
  source_kind?: "standard_load" | "manual" | "regime_migration" | "legacy" | "exception" | null;
  baseline_source?: string | null;
  match_type: DuplicateMatchType;
  severity: DuplicateSeverity;
}

export type ObligationDeliveryAttemptStatus = "queued" | "sending" | "sent" | "failed" | "cancelled";

export interface ObligationDeliveryAttachmentPreview {
  id: string;
  file_name: string;
  storage_bucket: string;
  storage_path: string;
  content_type: string | null;
  file_size: number | null;
}

export interface ObligationDeliveryPreparation {
  instance_id: string;
  client_id: string;
  client_name: string;
  inbox_item_id: string | null;
  recipient_email: string;
  verified_from_email: string;
  reply_to: string;
  display_sender_context: string;
  subject: string;
  message_body: string;
  attachments: ObligationDeliveryAttachmentPreview[];
  warnings: string[];
}

export interface ObligationDeliveryAttemptResponse {
  id: string;
  status: Extract<ObligationDeliveryAttemptStatus, "sent" | "failed" | "cancelled">;
  provider_message_id: string | null;
  sent_at: string | null;
}
