import { filterAuthorizedReportFields } from "./permissions";
import type { ReportColumnWarning, ReportDatasetDefinition, ReportPreview, ReportRow } from "./types";

export function buildReportPreview(input: {
  dataset: ReportDatasetDefinition;
  rows: readonly ReportRow[];
  columnKeys: readonly string[];
  roles: readonly string[];
}): ReportPreview {
  const fieldByKey = new Map(input.dataset.fields.map((field) => [field.key, field]));
  const authorizedFieldKeys = new Set(
    filterAuthorizedReportFields(input.dataset, input.roles, { preview: true }).map((field) => field.key),
  );
  const selectedKeys = Array.from(new Set(input.columnKeys));
  const warnings: ReportColumnWarning[] = [];
  const columns = selectedKeys.flatMap((columnKey) => {
    const field = fieldByKey.get(columnKey);
    if (!field) {
      warnings.push({ columnKey, reason: "unknown" });
      return [];
    }
    if (field.classification === "prohibited") {
      warnings.push({ columnKey, reason: "prohibited" });
      return [];
    }
    if (!authorizedFieldKeys.has(columnKey)) {
      warnings.push({ columnKey, reason: "unauthorized" });
      return [];
    }
    if (!field.previewable) {
      warnings.push({ columnKey, reason: "not_previewable" });
      return [];
    }
    return [field];
  });

  const limitedRows = input.rows.slice(0, input.dataset.previewLimit).map((row) => {
    const output: ReportRow = { id: row.id };
    columns.forEach((column) => {
      output[column.key] = row[column.key];
    });
    return output;
  });

  return {
    datasetId: input.dataset.id,
    columns,
    rows: limitedRows,
    rowCount: input.rows.length,
    previewLimit: input.dataset.previewLimit,
    warnings,
    generatedAt: new Date().toISOString(),
  };
}
