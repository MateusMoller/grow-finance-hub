import { isProhibitedReportField } from "./classification";
import type { ReportDatasetDefinition } from "./types";

export interface CatalogValidationIssue {
  datasetId: string;
  fieldKey?: string;
  code:
    | "duplicate_dataset"
    | "duplicate_field"
    | "missing_classification"
    | "missing_permission"
    | "invalid_default"
    | "prohibited_available"
    | "missing_required_filter";
  message: string;
}

export function validateReportCatalog(datasets: readonly ReportDatasetDefinition[]) {
  const issues: CatalogValidationIssue[] = [];
  const datasetIds = new Set<string>();

  datasets.forEach((dataset) => {
    if (datasetIds.has(dataset.id)) {
      issues.push({ datasetId: dataset.id, code: "duplicate_dataset", message: `Duplicate dataset id ${dataset.id}.` });
    }
    datasetIds.add(dataset.id);

    if (dataset.minimumRoles.length === 0) {
      issues.push({ datasetId: dataset.id, code: "missing_permission", message: `Dataset ${dataset.id} has no minimum roles.` });
    }
    if (!dataset.requiredFilters.includes("organization_id")) {
      issues.push({ datasetId: dataset.id, code: "missing_required_filter", message: `Dataset ${dataset.id} must require organization_id.` });
    }

    const fieldKeys = new Set<string>();
    dataset.fields.forEach((field) => {
      if (fieldKeys.has(field.key)) {
        issues.push({ datasetId: dataset.id, fieldKey: field.key, code: "duplicate_field", message: `Duplicate field ${field.key}.` });
      }
      fieldKeys.add(field.key);

      if (!field.classification) {
        issues.push({ datasetId: dataset.id, fieldKey: field.key, code: "missing_classification", message: `Field ${field.key} has no classification.` });
      }
      if (field.defaultSelected && (!field.previewable || isProhibitedReportField(field))) {
        issues.push({ datasetId: dataset.id, fieldKey: field.key, code: "invalid_default", message: `Field ${field.key} cannot be default selected.` });
      }
      if (isProhibitedReportField(field) && (field.previewable || field.exportable)) {
        issues.push({ datasetId: dataset.id, fieldKey: field.key, code: "prohibited_available", message: `Field ${field.key} is prohibited but available.` });
      }
    });
  });

  return issues;
}

export function assertValidReportCatalog(datasets: readonly ReportDatasetDefinition[]) {
  const issues = validateReportCatalog(datasets);
  if (issues.length > 0) {
    throw new Error(issues.map((issue) => `${issue.datasetId}:${issue.fieldKey || "-"}:${issue.code}`).join(", "));
  }
}
