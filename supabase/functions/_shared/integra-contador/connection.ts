export const MAX_CERTIFICATE_BYTES = 2 * 1024 * 1024;
export const CONNECTION_ENVIRONMENTS = ["development", "validation", "production"] as const;

export type ConnectionEnvironment = typeof CONNECTION_ENVIRONMENTS[number];

export class ConnectionInputError extends Error {
  constructor(public readonly code: string) { super(code); }
}

export function validateCertificate(file: File) {
  const extension = file.name.toLowerCase().split(".").pop();
  if (!extension || !["p12", "pfx"].includes(extension)) throw new ConnectionInputError("certificate_invalid");
  if (file.size === 0 || file.size > MAX_CERTIFICATE_BYTES) throw new ConnectionInputError("certificate_invalid");
}

export function requiredFormText(form: FormData, key: string, maxLength = 4096) {
  const value = form.get(key);
  if (typeof value !== "string" || !value.trim() || value.length > maxLength) {
    throw new ConnectionInputError("invalid_request");
  }
  return value.trim();
}

export function sanitizeConnection(row: Record<string, unknown> | null) {
  if (!row) return null;
  const allowed = ["id", "environment", "contractor_tax_id", "status", "certificate_filename",
    "certificate_fingerprint", "certificate_expires_at", "configured_at", "enabled_capabilities",
    "last_health_check_at", "last_success_at", "last_error_code", "updated_at"];
  return Object.fromEntries(allowed.map((key) => [key, row[key] ?? null]));
}
