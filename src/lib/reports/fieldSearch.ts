import { normalizeReportToken } from "./classification";
import type { ReportFieldDefinition } from "./types";

export interface ReportFieldGroup {
  id: string;
  label: string;
  fields: ReportFieldDefinition[];
}

export function buildReportFieldSearchText(field: ReportFieldDefinition) {
  return normalizeReportToken([
    field.key,
    field.label,
    field.description || "",
    field.sourcePath,
    field.module || "",
    field.group || "",
    field.classification,
  ].join(" "));
}

export function filterReportFields(fields: readonly ReportFieldDefinition[], search: string) {
  const term = normalizeReportToken(search);
  if (!term) return [...fields];
  return fields.filter((field) => buildReportFieldSearchText(field).includes(term));
}

export function groupReportFields(fields: readonly ReportFieldDefinition[]) {
  const groups = new Map<string, ReportFieldGroup>();

  fields.forEach((field) => {
    const label = field.group || field.module || "Outros";
    const id = normalizeReportToken(label);
    const current = groups.get(id) || { id, label, fields: [] };
    current.fields.push(field);
    groups.set(id, current);
  });

  return Array.from(groups.values()).sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
}
