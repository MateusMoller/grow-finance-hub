import { evaluateReportExport, requiresBackendReportExport } from "./exportPolicy";
import { writeReportXlsx } from "./xlsxExport";
import type { ReportDatasetDefinition, ReportExportResult, ReportFieldDefinition, ReportFilters, ReportRow } from "./types";

export async function exportReport(input: {
  organizationId: string;
  dataset: ReportDatasetDefinition;
  filters: ReportFilters;
  fields: readonly ReportFieldDefinition[];
  rows: readonly ReportRow[];
  modelId?: string | null;
}) {
  const policy = evaluateReportExport({ dataset: input.dataset, fields: input.fields, rowCount: input.rows.length });
  if (policy.status === "blocked") return policy;

  if (requiresBackendReportExport({ dataset: input.dataset, fields: input.fields, rowCount: input.rows.length })) {
    return {
      status: "blocked",
      reason: "export_limit_exceeded",
      message: "Reduza os filtros ou solicite fluxo aprovado para exportacao maior.",
      rowCount: input.rows.length,
      classification: policy.classification,
      warnings: [],
    } satisfies ReportExportResult;
  }

  const fileName = await writeReportXlsx({
    dataset: input.dataset,
    fields: input.fields,
    rows: input.rows,
    scopeLabel: "personalizado",
  });

  return {
    status: "completed",
    fileName,
    rowCount: input.rows.length,
    classification: policy.classification,
    warnings: [],
  } satisfies ReportExportResult;
}
