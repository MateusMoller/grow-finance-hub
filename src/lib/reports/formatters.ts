import type { ReportFieldDefinition } from "./types";

export function parseReportNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;

  const cleaned = value.trim().replace(/\s+/g, "").replace(/r\$/gi, "");
  if (!cleaned) return null;

  const normalized = cleaned.includes(",") && cleaned.includes(".")
    ? cleaned.replace(/\./g, "").replace(",", ".")
    : cleaned.replace(",", ".");

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function formatReportDateTime(value: unknown) {
  if (typeof value !== "string" || !value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("pt-BR");
}

export function formatReportDate(value: unknown) {
  if (typeof value !== "string" || !value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("pt-BR");
}

export function formatReportCurrency(value: unknown) {
  const numeric = parseReportNumber(value);
  if (numeric === null) return "-";
  return numeric.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatReportPercent(value: unknown) {
  const numeric = parseReportNumber(value);
  if (numeric === null) return "-";
  return `${numeric.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}

export function formatReportRole(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return "-";
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

export function formatReportCell(value: unknown, field?: Pick<ReportFieldDefinition, "formatter">) {
  if (field?.formatter === "datetime") return formatReportDateTime(value);
  if (field?.formatter === "date") return formatReportDate(value);
  if (field?.formatter === "currency") return formatReportCurrency(value);
  if (field?.formatter === "percent") return formatReportPercent(value);
  if (field?.formatter === "role") return formatReportRole(value);
  if (value === null || value === undefined || value === "") return "-";
  return String(value);
}
