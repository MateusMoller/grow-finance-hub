export type JsonRecord = Record<string, unknown>;

export function asRecord(value: unknown): JsonRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as JsonRecord;
}

export function asString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(",", "."));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function pickFirstString(record: JsonRecord, keys: string[]): string | null {
  for (const key of keys) {
    const value = asString(record[key]);
    if (value) return value;
  }
  return null;
}

export function pickFirstNumber(record: JsonRecord, keys: string[]): number | null {
  for (const key of keys) {
    const value = asNumber(record[key]);
    if (value !== null) return value;
  }
  return null;
}

export async function fetchJson<T = JsonRecord>(
  url: string,
  init?: RequestInit,
): Promise<{ status: number; data: T }> {
  const response = await fetch(url, init);
  const text = await response.text();
  let data: unknown = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }
  }

  if (!response.ok) {
    const message =
      asRecord(data)?.message ||
      asRecord(data)?.error ||
      `HTTP ${response.status} calling ${url}`;
    throw new Error(typeof message === "string" ? message : `HTTP ${response.status} calling ${url}`);
  }

  return { status: response.status, data: data as T };
}

export function toIso(value: string | null): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

export function normalizeDirection(amount: number, rawDirection?: string | null): "in" | "out" {
  const token = String(rawDirection || "").trim().toLowerCase();
  if (token === "in" || token === "credit" || token === "income" || token === "entrada") return "in";
  if (token === "out" || token === "debit" || token === "expense" || token === "saida") return "out";
  return amount >= 0 ? "in" : "out";
}

export function toPositiveMoney(amount: number): number {
  return Math.abs(Number(amount.toFixed(2)));
}

export function buildWebhookPublicUrl(supabaseUrl: string): string {
  const base = supabaseUrl.replace(/\/$/, "");
  return `${base}/functions/v1/open-finance-webhook`;
}
