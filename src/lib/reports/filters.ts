import type { ReportFilters } from "./types";

const trimOrNull = (value: string | null | undefined) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

export function normalizeReportFilters(input: Partial<ReportFilters>): ReportFilters {
  return {
    organizationId: trimOrNull(input.organizationId),
    company: trimOrNull(input.company),
    clientId: trimOrNull(input.clientId),
    competence: trimOrNull(input.competence),
    period: trimOrNull(input.period),
    status: trimOrNull(input.status),
    sector: trimOrNull(input.sector),
    assignee: trimOrNull(input.assignee),
  };
}

export function requireReportOrganization(filters: ReportFilters) {
  if (!filters.organizationId) {
    throw new Error("organization_id is required for report operations.");
  }
}

export function buildActiveReportFilterLabels(filters: ReportFilters) {
  const labels: string[] = [];
  if (filters.company) labels.push(`Empresa: ${filters.company}`);
  if (filters.clientId) labels.push(`Cliente: ${filters.clientId}`);
  if (filters.competence) labels.push(`Competencia: ${filters.competence}`);
  if (filters.period) labels.push(`Periodo: ${filters.period}`);
  if (filters.status) labels.push(`Status: ${filters.status}`);
  if (filters.sector) labels.push(`Setor: ${filters.sector}`);
  if (filters.assignee) labels.push(`Responsavel: ${filters.assignee}`);
  return labels;
}

export function serializeReportFilters(filters: ReportFilters) {
  return {
    organization_id: filters.organizationId,
    company: filters.company || null,
    client_id: filters.clientId || null,
    competence: filters.competence || null,
    period: filters.period || null,
    status: filters.status || null,
    sector: filters.sector || null,
    assignee: filters.assignee || null,
  };
}
