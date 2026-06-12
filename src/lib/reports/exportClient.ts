import { supabase } from "@/integrations/supabase/client";
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
    const { data, error } = await supabase.functions.invoke<ReportExportResult>("report-exports", {
      body: {
        organizationId: input.organizationId,
        datasetId: input.dataset.id,
        filters: input.filters,
        columnKeys: input.fields.map((field) => field.key),
        format: "xlsx",
        modelId: input.modelId || null,
      },
    });

    if (error) {
      return {
        status: "failed",
        reason: "backend_export_failed",
        message: error.message,
        rowCount: input.rows.length,
        classification: policy.classification,
        warnings: [],
      } satisfies ReportExportResult;
    }

    return data || {
      status: "failed",
      reason: "empty_backend_response",
      message: "A exportacao nao retornou resposta valida.",
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
