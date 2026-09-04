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

export type MitDossierStatus = "draft"|"ready_for_validation"|"validated"|"submitting"|"processing"|"transmitted"|"verified"|"requires_action"|"transmission_unknown";
export interface MitDossier { id:string; client_id:string; client_name:string; client_cnpj:string|null; obligation_instance_id:string; competence_key:string; status:MitDossierStatus; data_version:number; validated_version:number|null; protocol_number:string|null; receipt_number:string|null; provider_state:Record<string,unknown>; transmitted_at:string|null; verified_at:string|null; updated_at:string }
export interface MitDebt { id?:string; revenue_code:string; description:string; debit_amount:number; due_date:string|null; establishment_cnpj:string|null; source?:"manual"|"accounting_import"|"serpro" }

export type InstallmentModality = "PARCSN" | "PARCSN-ESP" | "PERTSN" | "RELPSN" | "PARCMEI" | "PARCMEI-ESP" | "PERTMEI" | "RELPMEI";
export type InstallmentEntryStatus = "available" | "issued" | "paid" | "overdue" | "cancelled" | "unknown";
export interface InstallmentEntry { id:string; agreement_id:string; period_key:string; installment_number:string|null; amount:number|null; due_date:string|null; status:InstallmentEntryStatus; available_for_issue:boolean; issued_at:string|null; paid_at:string|null; task_id:string|null; fiscal_document_id:string|null; }
export interface InstallmentAgreement { id:string; organization_id:string; client_id:string; modality:InstallmentModality; agreement_number:string; requested_at:string|null; status:string; status_date:string|null; total_consolidated:number|null; installment_count:number|null; basic_installment_amount:number|null; remaining_installments:number|null; debt_details:Array<Record<string,unknown>>; debt_changes:Array<Record<string,unknown>>; last_synced_at:string; last_error_code:string|null; clients?:{name:string;cnpj:string|null}; fiscal_installment_entries?:InstallmentEntry[]; }
export interface InstallmentPayment { id:string; entry_id:string; period_key:string; das_number:string|null; installment_number:string|null; due_date:string|null; paid_at:string; bank_agency:string|null; amount_paid:number; tax_breakdown:Array<Record<string,unknown>>; }
export interface InstallmentDocument { id:string; document_type:string; period_key:string|null; storage_bucket:string; storage_path:string; created_at:string; }
