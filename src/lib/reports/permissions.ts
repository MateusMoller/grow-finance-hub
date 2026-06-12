import type { ReportDatasetDefinition, ReportFieldDefinition, ReportRole } from "./types";

export function normalizeReportRoles(roles: readonly string[] | null | undefined): ReportRole[] {
  const allowedRoles = new Set<ReportRole>([
    "admin",
    "director",
    "manager",
    "employee",
    "commercial",
    "partner",
    "departamento_pessoal",
    "fiscal",
    "contabil",
    "client",
  ]);

  return Array.from(
    new Set(
      (roles || [])
        .map((role) => role.trim().toLowerCase() as ReportRole)
        .filter((role): role is ReportRole => allowedRoles.has(role)),
    ),
  );
}

export function hasAnyReportRole(userRoles: readonly ReportRole[], requiredRoles: readonly ReportRole[]) {
  if (requiredRoles.length === 0) return true;
  const userRoleSet = new Set(userRoles);
  return requiredRoles.some((role) => userRoleSet.has(role));
}

export function canAccessReportDataset(dataset: ReportDatasetDefinition, roles: readonly string[]) {
  const normalizedRoles = normalizeReportRoles(roles);
  if (!dataset.enabled) return false;
  if (dataset.blockedRoles.some((role) => normalizedRoles.includes(role))) return false;
  return hasAnyReportRole(normalizedRoles, dataset.minimumRoles);
}

export function canAccessReportField(
  dataset: ReportDatasetDefinition,
  field: ReportFieldDefinition,
  roles: readonly string[],
) {
  if (!canAccessReportDataset(dataset, roles)) return false;
  if (field.classification === "prohibited") return false;
  return hasAnyReportRole(normalizeReportRoles(roles), field.minimumRoles || dataset.minimumRoles);
}

export function filterAuthorizedReportDatasets(
  datasets: readonly ReportDatasetDefinition[],
  roles: readonly string[],
) {
  return datasets.filter((dataset) => canAccessReportDataset(dataset, roles));
}

export function filterAuthorizedReportFields(
  dataset: ReportDatasetDefinition,
  roles: readonly string[],
  options: { preview?: boolean; export?: boolean } = {},
) {
  return dataset.fields.filter((field) => {
    if (!canAccessReportField(dataset, field, roles)) return false;
    if (options.preview && !field.previewable) return false;
    if (options.export && !field.exportable) return false;
    return true;
  });
}
