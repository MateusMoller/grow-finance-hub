export type ObligationAuditEntityType =
  | "template"
  | "regime_load"
  | "load_item"
  | "client_profile"
  | "application_batch"
  | "sync_run";

export interface ObligationAuditMetadataInput {
  entityType: ObligationAuditEntityType;
  action: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  summary?: Record<string, unknown> | null;
  warnings?: string[];
}

const sensitiveKeys = new Set(["password", "token", "secret", "service_role", "access_token", "refresh_token", "document_content"]);

export function buildObligationAuditMetadata(input: ObligationAuditMetadataInput): Record<string, unknown> {
  return {
    entity_type: input.entityType,
    action: input.action,
    before: redactRecord(input.before),
    after: redactRecord(input.after),
    summary: redactRecord(input.summary),
    warnings: input.warnings ?? [],
  };
}

export function buildSyncRunAuditSummary(input: {
  clientsProcessed: number;
  profilesCreated: number;
  profilesReactivated: number;
  profilesInactivatedFuture: number;
  profilesSkipped: number;
  reviewRequired: number;
}): Record<string, number | boolean> {
  return {
    clients_processed: input.clientsProcessed,
    profiles_created: input.profilesCreated,
    profiles_reactivated: input.profilesReactivated,
    profiles_inactivated_future: input.profilesInactivatedFuture,
    profiles_skipped: input.profilesSkipped,
    review_required: input.reviewRequired,
    generated_history_unchanged: true,
  };
}

function redactRecord(record: Record<string, unknown> | null | undefined): Record<string, unknown> | null {
  if (!record) return null;
  return Object.fromEntries(
    Object.entries(record).map(([key, value]) => {
      if (sensitiveKeys.has(key.toLowerCase())) return [key, "[redacted]"];
      if (value && typeof value === "object" && !Array.isArray(value)) {
        return [key, redactRecord(value as Record<string, unknown>)];
      }
      return [key, value];
    }),
  );
}
