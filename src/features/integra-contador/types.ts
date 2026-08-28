export type FiscalConnectionStatus = "disabled" | "pending" | "validating" | "active" | "requires_action" | "failed";
export type FiscalEnvironment = "development" | "validation" | "production";

export interface IntegraContadorConnection {
  id: string;
  environment: FiscalEnvironment;
  contractorTaxId: string;
  status: FiscalConnectionStatus;
  certificateFilename: string | null;
  certificateFingerprint: string | null;
  certificateExpiresAt: string | null;
  configuredAt: string | null;
  enabledCapabilities: string[];
  lastHealthCheckAt: string | null;
  lastSuccessAt: string | null;
  lastErrorCode: string | null;
  updatedAt: string;
}

export interface ConfigureConnectionInput {
  organizationId: string;
  environment: FiscalEnvironment;
  contractorTaxId: string;
  consumerKey: string;
  consumerSecret: string;
  certificatePassword: string;
  certificate: File;
}

export type SimpleNationalObligationKind = "pgdasd" | "defis" | "regime_apuracao";
export type SimpleNationalDossierStatus = "collecting" | "validation_failed" | "ready_for_review" | "approved" | "transmission_blocked" | "queued" | "transmitting" | "transmitted" | "documents_issued" | "published" | "completed" | "requires_action";
export interface SimpleNationalValidationItem { code: string; message: string }
export interface SimpleNationalClient { id: string; name: string; cnpj: string | null; regime: string | null }
export interface SimpleNationalDossier {
  id: string;
  client_id: string;
  client_name: string;
  obligation_instance_id: string | null;
  obligation_kind: SimpleNationalObligationKind;
  competence_key: string;
  status: SimpleNationalDossierStatus;
  input_data: Record<string, unknown>;
  source_manifest: Array<{ type: string; reference: string }>;
  validation_summary: { valid?: boolean; blocking?: SimpleNationalValidationItem[]; warnings?: SimpleNationalValidationItem[] };
  preview_result: Record<string, unknown> | null;
  data_version: number;
  approved_at: string | null;
  external_declaration_id: string | null;
  external_transmitted_at: string | null;
  declaration_storage_path: string | null;
  receipt_storage_path: string | null;
  das_storage_path: string | null;
  das_number: string | null;
  das_due_date: string | null;
  das_total: number | null;
  provider_environment: "trial" | "production";
  updated_at: string;
}

export type DctfwebDossierStatus = "collecting"|"ready_for_review"|"approved"|"consulted"|"documents_issued"|"transmitting"|"transmitted"|"completed"|"requires_action"|"transmission_unknown";
export interface DctfwebDossier { id:string; client_id:string; client_name:string; obligation_instance_id:string; competence_key:string; category:string; status:DctfwebDossierStatus; data_version:number; approved_data_version:number|null; receipt_number:string|null; provider_state:Record<string,unknown>; xml_storage_path:string|null; receipt_storage_path:string|null; report_storage_path:string|null; darf_storage_path:string|null; updated_at:string }
