export type ReportDatasetId = "clientes" | "leads_crm" | "tarefas" | "equipe";

export type ReportExportFormat = "xlsx";

export type ReportDataClassification = "internal" | "sensitive" | "regulated" | "prohibited";

export type ReportRole =
  | "admin"
  | "director"
  | "manager"
  | "employee"
  | "commercial"
  | "partner"
  | "departamento_pessoal"
  | "fiscal"
  | "contabil"
  | "client";

export type ReportFieldDataType =
  | "text"
  | "number"
  | "date"
  | "datetime"
  | "currency"
  | "percent"
  | "boolean"
  | "enum";

export interface ReportFieldDefinition {
  key: string;
  label: string;
  description?: string;
  sourcePath: string;
  dataType: ReportFieldDataType;
  classification: ReportDataClassification;
  minimumRoles?: ReportRole[];
  formatter?: "date" | "datetime" | "currency" | "percent" | "decimal" | "role";
  defaultSelected?: boolean;
  exportable: boolean;
  previewable: boolean;
  deprecated?: boolean;
  module?: string;
  group?: string;
}

export interface ReportDatasetDefinition {
  id: ReportDatasetId;
  name: string;
  description: string;
  sourceOwner: string;
  sourceTablesOrViews: string[];
  defaultFilters: ReportFilterKey[];
  requiredFilters: ReportFilterKey[];
  defaultSort: string;
  previewLimit: number;
  exportLimit: number;
  minimumRoles: ReportRole[];
  blockedRoles: ReportRole[];
  classification: ReportDataClassification;
  enabled: boolean;
  fields: ReportFieldDefinition[];
}

export type ReportFilterKey =
  | "organization_id"
  | "company"
  | "client_id"
  | "competence"
  | "period"
  | "status"
  | "sector"
  | "assignee";

export interface ReportFilters {
  organizationId: string | null;
  company?: string | null;
  clientId?: string | null;
  competence?: string | null;
  period?: string | null;
  status?: string | null;
  sector?: string | null;
  assignee?: string | null;
}

export interface ReportColumnWarning {
  columnKey: string;
  reason: "unknown" | "unauthorized" | "deprecated" | "prohibited" | "not_exportable" | "not_previewable";
}

export type ReportRow = Record<string, unknown>;

export interface ReportPreview {
  datasetId: ReportDatasetId;
  columns: ReportFieldDefinition[];
  rows: ReportRow[];
  rowCount: number;
  previewLimit: number;
  warnings: ReportColumnWarning[];
  generatedAt: string;
}

export interface SavedReportModel {
  id: string;
  organizationId: string;
  userId: string;
  name: string;
  normalizedName: string;
  datasetId: ReportDatasetId;
  columnKeys: string[];
  format: ReportExportFormat;
  autoGenerate: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SavedReportValidationResult {
  validColumnKeys: string[];
  warnings: ReportColumnWarning[];
}

export type ReportExportStatus = "requested" | "running" | "completed" | "blocked" | "failed";

export interface ReportExportRequest {
  organizationId: string;
  datasetId: ReportDatasetId;
  filters: ReportFilters;
  columnKeys: string[];
  format: ReportExportFormat;
  modelId?: string | null;
}

export interface ReportExportResult {
  status: ReportExportStatus;
  fileName?: string;
  rowCount?: number;
  classification?: ReportDataClassification;
  reason?: string;
  message?: string;
  warnings: ReportColumnWarning[];
}

export interface ReportAuditMetadata {
  dataset_id: ReportDatasetId;
  filters: Record<string, string | number | boolean | null>;
  column_keys: string[];
  row_count?: number;
  format: ReportExportFormat;
  classification: ReportDataClassification;
  failure_code?: string;
}
