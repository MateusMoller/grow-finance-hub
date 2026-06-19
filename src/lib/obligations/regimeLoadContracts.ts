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
  | "preview_apply_regime_load"
  | "apply_regime_load"
  | "sync_regime_load_existing_clients"
  | "detect_obligation_duplicates";

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
