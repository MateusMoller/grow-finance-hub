import { serializeReportFilters } from "./filters";
import type { ReportAuditMetadata, ReportDataClassification, ReportDatasetId, ReportExportFormat, ReportFilters } from "./types";

const sensitiveFilterKeys = new Set(["token", "secret", "password", "senha", "credential", "key"]);

function redactSensitiveValue(key: string, value: unknown) {
  const normalizedKey = key.toLowerCase();
  if ([...sensitiveFilterKeys].some((pattern) => normalizedKey.includes(pattern))) {
    return "[redacted]";
  }
  if (typeof value === "string" && value.length > 120) {
    return `${value.slice(0, 117)}...`;
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean" || value === null) {
    return value;
  }
  return null;
}

export function buildReportAuditMetadata(input: {
  datasetId: ReportDatasetId;
  filters: ReportFilters;
  columnKeys: readonly string[];
  rowCount?: number;
  format: ReportExportFormat;
  classification: ReportDataClassification;
  failureCode?: string;
}): ReportAuditMetadata {
  const serializedFilters = serializeReportFilters(input.filters);
  const redactedFilters = Object.fromEntries(
    Object.entries(serializedFilters).map(([key, value]) => [key, redactSensitiveValue(key, value)]),
  ) as ReportAuditMetadata["filters"];

  return {
    dataset_id: input.datasetId,
    filters: redactedFilters,
    column_keys: [...input.columnKeys],
    row_count: input.rowCount,
    format: input.format,
    classification: input.classification,
    failure_code: input.failureCode,
  };
}
