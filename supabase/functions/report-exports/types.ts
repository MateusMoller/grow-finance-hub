export type ReportDatasetId = "clientes" | "leads_crm" | "tarefas" | "equipe";
export type ReportExportFormat = "xlsx";
export type ReportExportStatus = "completed" | "blocked" | "failed";

export interface ReportExportRequest {
  organizationId?: string;
  datasetId?: ReportDatasetId;
  filters?: Record<string, unknown>;
  columnKeys?: string[];
  format?: ReportExportFormat;
  modelId?: string | null;
}

export interface ReportExportResponse {
  status: ReportExportStatus;
  fileName?: string;
  rowCount?: number;
  classification?: "internal" | "sensitive" | "regulated" | "prohibited";
  reason?: string;
  message?: string;
  warnings: Array<{ columnKey: string; reason: string }>;
}
