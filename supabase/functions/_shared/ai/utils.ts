import type { JsonRecord } from "./types.ts";

export function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    },
  });
}

export function asRecord(value: unknown): JsonRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as JsonRecord;
}

export function asTrimmedString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function asBoolean(value: unknown, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

export function parseJsonString<TValue>(value: string, fallback: TValue): TValue {
  try {
    return JSON.parse(value) as TValue;
  } catch {
    return fallback;
  }
}

export function stripMarkdownCodeFence(value: string | null | undefined) {
  const text = String(value || "").trim();
  if (!text.startsWith("```")) return text;

  return text
    .replace(/^```[a-zA-Z0-9_-]*\s*/, "")
    .replace(/\s*```$/, "")
    .trim();
}

export function extractFirstJsonObject(value: string | null | undefined) {
  const text = stripMarkdownCodeFence(value);
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  return text.slice(start, end + 1);
}

export function normalizeRole(value: string | null | undefined) {
  return String(value || "").trim().toLowerCase();
}

export function normalizeRoles(values: string[]) {
  return Array.from(new Set(values.map((value) => normalizeRole(value)).filter(Boolean)));
}

export function normalizeText(value: string | null | undefined) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenizeText(value: string | null | undefined) {
  return normalizeText(value)
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length >= 3);
}

export function calculateTokenOverlap(left: string[], right: string[]) {
  if (left.length === 0 || right.length === 0) return 0;
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  let shared = 0;

  for (const token of leftSet) {
    if (rightSet.has(token)) shared += 1;
  }

  return (2 * shared) / (leftSet.size + rightSet.size);
}

export function normalizeCompetencia(value: string | null | undefined) {
  const text = asTrimmedString(value);
  if (!text) return null;

  const yyyyMm = text.match(/^(\d{4})-(\d{2})$/);
  if (yyyyMm) return `${yyyyMm[1]}-${yyyyMm[2]}`;

  const mmYyyy = text.match(/^(\d{2})\/(\d{4})$/);
  if (mmYyyy) return `${mmYyyy[2]}-${mmYyyy[1]}`;

  return null;
}

export function competenciaMatches(candidate: string | null | undefined, competencia: string | null | undefined) {
  const normalizedCompetencia = normalizeCompetencia(competencia);
  if (!normalizedCompetencia) return true;

  const candidateText = asTrimmedString(candidate);
  if (!candidateText) return false;

  return candidateText.includes(normalizedCompetencia);
}

export function maskCnpj(cnpj: string | null | undefined) {
  const digits = String(cnpj || "").replace(/\D/g, "");
  if (digits.length !== 14) return null;
  return `${digits.slice(0, 2)}.***.***/****-${digits.slice(-2)}`;
}

export function normalizePhoneDigits(value: string | null | undefined) {
  const digits = String(value || "").replace(/\D/g, "");
  return digits.length > 0 ? digits : null;
}

export function isOpenStatus(status: string | null | undefined) {
  const normalized = normalizeText(status);
  return !["completed", "cancelled", "concluido", "cancelado"].includes(normalized);
}

export function coerceErrorMessage(error: unknown, fallback = "Unknown error") {
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
  ) {
    return (error as { message: string }).message;
  }

  return fallback;
}

export function isMissingRelationError(error: unknown) {
  const message = coerceErrorMessage(error, "").toLowerCase();
  return message.includes("does not exist") || message.includes("relation") || message.includes("schema cache");
}
