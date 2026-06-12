import { requiresAuditForClassification } from "./classification";
import type { ReportDatasetDefinition, ReportExportResult, ReportFieldDefinition } from "./types";

export function getHighestFieldClassification(fields: readonly ReportFieldDefinition[]) {
  if (fields.some((field) => field.classification === "prohibited")) return "prohibited";
  if (fields.some((field) => field.classification === "regulated")) return "regulated";
  if (fields.some((field) => field.classification === "sensitive")) return "sensitive";
  return "internal";
}

export function evaluateReportExport(input: {
  dataset: ReportDatasetDefinition;
  fields: readonly ReportFieldDefinition[];
  rowCount: number;
}): ReportExportResult {
  const prohibitedField = input.fields.find((field) => field.classification === "prohibited" || !field.exportable);
  const classification = getHighestFieldClassification(input.fields);

  if (prohibitedField) {
    return {
      status: "blocked",
      reason: "prohibited_field",
      message: "Uma ou mais colunas selecionadas nao podem ser exportadas.",
      rowCount: input.rowCount,
      classification,
      warnings: [{ columnKey: prohibitedField.key, reason: prohibitedField.classification === "prohibited" ? "prohibited" : "not_exportable" }],
    };
  }

  if (input.rowCount === 0) {
    return {
      status: "blocked",
      reason: "empty_export",
      message: "Nao ha dados para exportar nos filtros atuais.",
      rowCount: 0,
      classification,
      warnings: [],
    };
  }

  if (input.rowCount > input.dataset.exportLimit) {
    return {
      status: "blocked",
      reason: "export_limit_exceeded",
      message: "Reduza os filtros ou solicite fluxo aprovado para exportacao maior.",
      rowCount: input.rowCount,
      classification,
      warnings: [],
    };
  }

  return {
    status: "completed",
    rowCount: input.rowCount,
    classification,
    warnings: [],
  };
}

export function requiresBackendReportExport(input: {
  dataset: ReportDatasetDefinition;
  fields: readonly ReportFieldDefinition[];
  rowCount: number;
}) {
  const classification = getHighestFieldClassification(input.fields);
  return requiresAuditForClassification(classification) || input.rowCount > input.dataset.exportLimit;
}
