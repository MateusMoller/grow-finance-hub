import type { ReportDataClassification, ReportFieldDefinition } from "./types";

const classificationRank: Record<ReportDataClassification, number> = {
  internal: 1,
  sensitive: 2,
  regulated: 3,
  prohibited: 4,
};

const prohibitedFieldPatterns = [
  "password",
  "senha",
  "senha_gov",
  "token",
  "secret",
  "segredo",
  "credential",
  "credencial",
  "private_key",
  "api_key",
  "webhook_secret",
  "raw_document",
  "conteudo_documento",
] as const;

export function normalizeReportToken(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\w]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

export function isCredentialLikeField(value: string) {
  const normalized = normalizeReportToken(value);
  return prohibitedFieldPatterns.some((pattern) => normalized.includes(pattern));
}

export function isProhibitedReportField(field: Pick<ReportFieldDefinition, "key" | "label" | "sourcePath" | "classification">) {
  return (
    field.classification === "prohibited" ||
    isCredentialLikeField(field.key) ||
    isCredentialLikeField(field.label) ||
    isCredentialLikeField(field.sourcePath)
  );
}

export function maxReportClassification(classifications: readonly ReportDataClassification[]) {
  return classifications.reduce<ReportDataClassification>(
    (highest, current) => (classificationRank[current] > classificationRank[highest] ? current : highest),
    "internal",
  );
}

export function requiresAuditForClassification(classification: ReportDataClassification) {
  return classification === "sensitive" || classification === "regulated" || classification === "prohibited";
}
