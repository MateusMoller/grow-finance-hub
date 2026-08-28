import { describe, expect, it } from "vitest";
import { errorResponseSchema, parseConnectionResponse } from "@/features/integra-contador/schemas";

describe("Integra Contador API schemas", () => {
  it("accepts sanitized connections and rejects secret fields", () => {
    const safe = { id: "550e8400-e29b-41d4-a716-446655440000", environment: "validation", contractor_tax_id: "12345678000199", status: "active", certificate_filename: "client.p12", certificate_fingerprint: "abc", certificate_expires_at: null, configured_at: null, enabled_capabilities: [], last_health_check_at: null, last_success_at: null, last_error_code: null, updated_at: "2026-08-14T00:00:00Z" };
    expect(parseConnectionResponse({ connection: safe })?.status).toBe("active");
    expect(() => parseConnectionResponse({ connection: { ...safe, credential_secret_ref: "secret" } })).toThrow();
  });
  it("parses stable error codes", () => expect(errorResponseSchema.parse({ error: { code: "forbidden" } }).error.code).toBe("forbidden"));
});
