import { z } from "zod";
import type { IntegraContadorConnection } from "./types";

const rawConnectionSchema = z.object({
  id: z.string().uuid(), environment: z.enum(["development", "validation", "production"]),
  contractor_tax_id: z.string().regex(/^\d{14}$/),
  status: z.enum(["disabled", "pending", "validating", "active", "requires_action", "failed"]),
  certificate_filename: z.string().nullable(), certificate_fingerprint: z.string().nullable(),
  certificate_expires_at: z.string().nullable(), configured_at: z.string().nullable(),
  enabled_capabilities: z.array(z.string()).default([]), last_health_check_at: z.string().nullable(),
  last_success_at: z.string().nullable(), last_error_code: z.string().nullable(), updated_at: z.string(),
}).strict();

export const connectionResponseSchema = z.object({ connection: rawConnectionSchema.nullable() }).strict();
export const errorResponseSchema = z.object({ error: z.object({ code: z.string() }).strict() }).strict();

export function parseConnectionResponse(value: unknown): IntegraContadorConnection | null {
  const { connection } = connectionResponseSchema.parse(value);
  if (!connection) return null;
  return {
    id: connection.id, environment: connection.environment, contractorTaxId: connection.contractor_tax_id,
    status: connection.status, certificateFilename: connection.certificate_filename,
    certificateFingerprint: connection.certificate_fingerprint, certificateExpiresAt: connection.certificate_expires_at,
    configuredAt: connection.configured_at, enabledCapabilities: connection.enabled_capabilities,
    lastHealthCheckAt: connection.last_health_check_at, lastSuccessAt: connection.last_success_at,
    lastErrorCode: connection.last_error_code, updatedAt: connection.updated_at,
  };
}
