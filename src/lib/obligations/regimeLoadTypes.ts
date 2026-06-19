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
  | "accounting_contracted";

export type RegimeLoadDefaultStartPolicy = "client_created_at" | "current_month" | "next_month" | "custom";

export type ClientObligationSourceKind =
  | "standard_load"
  | "manual"
  | "regime_migration"
  | "legacy"
  | "exception";

export type ClientObligationSyncStatus = "current" | "pending_review" | "skipped" | "not_applicable";

export type RegimeLoadApplicationMode =
  | "new_client"
  | "manual_apply"
  | "regime_migration"
  | "reconcile_existing"
  | "standard_load_sync";

export type RegimeLoadSyncScope = "single_client" | "existing_clients_same_regime" | "branch_inherited_regime";
export type RegimeLoadBatchStatus = "previewed" | "applied" | "failed" | "cancelled";
export type RegimeLoadReviewDecision =
  | "add"
  | "keep"
  | "reactivate"
  | "suggest_inactivate"
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
  inactivated: number;
  duplicate_risk: number;
  blocked: number;
  skipped: number;
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
  match_type: DuplicateMatchType;
  severity: DuplicateSeverity;
}
