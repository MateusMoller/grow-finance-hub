import { normalizeReportToken } from "./classification";
import type { ReportDatasetDefinition, ReportExportFormat, ReportFieldDefinition, SavedReportValidationResult } from "./types";

export function normalizeSavedReportName(name: string) {
  return normalizeReportToken(name).replace(/_/g, " ").replace(/\s+/g, " ").trim();
}

export function buildSavedReportConflictKey(input: {
  organizationId: string;
  userId: string;
  datasetId: string;
  name: string;
}) {
  return [
    input.organizationId,
    input.userId,
    input.datasetId,
    normalizeSavedReportName(input.name),
  ].join(":");
}

export function sanitizeSavedReportFormat(value: unknown): ReportExportFormat {
  return value === "xlsx" ? "xlsx" : "xlsx";
}

export function validateSavedReportColumns(
  dataset: ReportDatasetDefinition,
  columnKeys: readonly unknown[],
  options: { export?: boolean; preview?: boolean } = {},
): SavedReportValidationResult {
  const fieldByKey = new Map<string, ReportFieldDefinition>(dataset.fields.map((field) => [field.key, field]));
  const seen = new Set<string>();
  const validColumnKeys: string[] = [];
  const warnings: SavedReportValidationResult["warnings"] = [];

  columnKeys.forEach((rawKey) => {
    if (typeof rawKey !== "string" || seen.has(rawKey)) return;
    seen.add(rawKey);
    const field = fieldByKey.get(rawKey);

    if (!field) {
      warnings.push({ columnKey: rawKey, reason: "unknown" });
      return;
    }
    if (field.classification === "prohibited") {
      warnings.push({ columnKey: rawKey, reason: "prohibited" });
      return;
    }
    if (options.export && !field.exportable) {
      warnings.push({ columnKey: rawKey, reason: "not_exportable" });
      return;
    }
    if (options.preview && !field.previewable) {
      warnings.push({ columnKey: rawKey, reason: "not_previewable" });
      return;
    }
    if (field.deprecated) {
      warnings.push({ columnKey: rawKey, reason: "deprecated" });
    }
    validColumnKeys.push(rawKey);
  });

  return { validColumnKeys, warnings };
}
