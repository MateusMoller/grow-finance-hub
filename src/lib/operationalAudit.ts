import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

type AuditResult = "success" | "error" | "warning";

type AuditInput = {
  organizationId: string | null | undefined;
  action: string;
  entityType?: string;
  entityId?: string | null;
  clientId?: string | null;
  result?: AuditResult;
  metadata?: Record<string, Json>;
  requestId?: string | null;
};

export async function recordOperationalAuditLog(input: AuditInput) {
  if (!input.organizationId) return;

  const { error } = await supabase.rpc("record_operational_audit_log", {
    _organization_id: input.organizationId,
    _action: input.action,
    _entity_type: input.entityType || null,
    _entity_id: input.entityId || null,
    _client_id: input.clientId || null,
    _result: input.result || "success",
    _metadata: input.metadata || {},
    _request_id: input.requestId || null,
  });

  if (error) {
    console.warn("Failed to record operational audit log", error);
  }
}
