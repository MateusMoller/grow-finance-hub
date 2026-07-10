import type {
  ObligationDuplicateMatch,
  RegimeLoad,
  RegimeLoadApplicationBatch,
  RegimeLoadApplicationMode,
  RegimeLoadApplicationReview,
  RegimeLoadItem,
  RegimeLoadSyncRun,
  TaxRegimeCode,
  TaxRegimeDefinition,
} from "./regimeLoadTypes";

export type RegimeLoadAction =
  | "list_regime_loads"
  | "upsert_regime_load"
  | "upsert_regime_load_item"
  | "apply_default_obligations"
  | "apply_conditional_default_obligations_after_evidence_update"
  | "apply_regime_change_default_obligations"
  | "sync_default_obligations_for_existing_clients"
  | "preview_apply_regime_load"
  | "apply_regime_load"
  | "sync_regime_load_existing_clients"
  | "detect_obligation_duplicates";

export interface DefaultObligationEvidence {
  has_employees?: boolean | null;
  service_provider?: boolean | null;
  municipal_service_declaration_required?: boolean | null;
  state_registration?: boolean | null;
  state_registration_or_required?: boolean | null;
  icms_ipi_taxpayer?: boolean | null;
  icms_st_difal_anticipation?: boolean | null;
  retentions_or_services?: boolean | null;
  has_employees_or_retentions?: boolean | null;
  ecd_applicable?: boolean | null;
  efd_contribuicoes_applicable?: boolean | null;
  tax_benefit_or_incentive_usage?: boolean | null;
}

export interface DefaultObligationSummary {
  created: number;
  kept: number;
  reactivated: number;
  skipped: number;
  blocked: number;
  duplicate_risk: number;
  conditional_skipped: number;
  inactivated_prior_regime?: number;
}

export interface DefaultObligationSkippedItem {
  template_id: string;
  load_item_id?: string | null;
  decision_type: "skip";
  reason: string;
  evidence_source: string | null;
  auto_apply_when_positive_evidence_exists: boolean;
}

export interface ApplyDefaultObligationsRequest {
  action: "apply_default_obligations";
  organization_id?: string;
  client_id: string;
  tax_regime_code: TaxRegimeCode;
  mode: Extract<RegimeLoadApplicationMode, "new_client" | "manual_apply" | "reconcile_existing">;
  evidence?: DefaultObligationEvidence;
}

export interface ApplyDefaultObligationsResponse {
  ok: true;
  batch_id: string;
  summary: DefaultObligationSummary;
  warnings: string[];
  profiles: unknown[];
  skipped_items: DefaultObligationSkippedItem[];
}

export interface ApplyConditionalDefaultsAfterEvidenceUpdateRequest {
  action: "apply_conditional_default_obligations_after_evidence_update";
  organization_id?: string;
  client_id: string;
  changed_evidence_keys: Array<keyof DefaultObligationEvidence>;
  evidence?: DefaultObligationEvidence;
}

export interface ApplyRegimeChangeDefaultObligationsRequest {
  action: "apply_regime_change_default_obligations";
  organization_id?: string;
  client_id: string;
  from_tax_regime_code?: TaxRegimeCode | null;
  to_tax_regime_code: TaxRegimeCode;
  evidence?: DefaultObligationEvidence;
}

export interface ApplyRegimeChangeDefaultObligationsResponse {
  ok: true;
  batch_id: string;
  summary: DefaultObligationSummary & { add?: number; keep?: number };
  warnings: string[];
  decisions: RegimeLoadApplicationReview[];
  profiles: unknown[];
}

export interface SyncDefaultObligationsForExistingClientsRequest {
  action: "sync_default_obligations_for_existing_clients";
  organization_id?: string;
  tax_regime_code?: TaxRegimeCode;
  evidence?: DefaultObligationEvidence;
}

export interface SyncDefaultObligationsForExistingClientsResponse {
  ok: true;
  summary: DefaultObligationSummary & {
    inactivated?: number;
    processed_clients?: number;
    unsupported_clients?: number;
  };
  warnings: string[];
  clients: unknown[];
}

export interface ListRegimeLoadsRequest {
  action: "list_regime_loads";
  organization_id?: string;
  tax_regime_code?: TaxRegimeCode;
  status?: RegimeLoad["status"];
}

export interface ListRegimeLoadsResponse {
  ok: true;
  regimes: TaxRegimeDefinition[];
  loads: RegimeLoad[];
  items: RegimeLoadItem[];
  templates: unknown[];
  duplicate_warnings: ObligationDuplicateMatch[];
  sync_runs?: RegimeLoadSyncRun[];
}

export interface PreviewApplyRegimeLoadRequest {
  action: "preview_apply_regime_load";
  organization_id?: string;
  client_id: string;
  tax_regime_code: TaxRegimeCode;
  mode: Extract<RegimeLoadApplicationMode, "regime_migration" | "reconcile_existing" | "manual_apply">;
}

export interface ApplyRegimeLoadRequest {
  action: "apply_regime_load";
  organization_id?: string;
  client_id: string;
  tax_regime_code: TaxRegimeCode;
  mode: RegimeLoadApplicationMode;
  batch_id?: string | null;
  confirmed_review_ids?: string[];
  auto_generate_instances?: false;
}

export interface ApplyRegimeLoadResponse {
  ok: true;
  batch: RegimeLoadApplicationBatch;
  reviews?: RegimeLoadApplicationReview[];
  profiles: unknown[];
  warnings: string[];
}

export interface SyncRegimeLoadExistingClientsRequest {
  action: "sync_regime_load_existing_clients";
  organization_id?: string;
  load_id: string;
  tax_regime_code: TaxRegimeCode;
  mode: "published_load_change";
}

export interface SyncRegimeLoadExistingClientsResponse {
  ok: true;
  sync_run: RegimeLoadSyncRun;
  warnings: string[];
}

export interface DetectObligationDuplicatesRequest {
  action: "detect_obligation_duplicates";
  organization_id?: string;
  id?: string | null;
  name: string;
  code?: string | null;
}

export interface DetectObligationDuplicatesResponse {
  ok: true;
  matches: ObligationDuplicateMatch[];
}
