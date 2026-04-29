import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

import { coerceErrorMessage, isMissingRelationError } from "./utils.ts";

type BestEffortInsertResult = {
  id: string | null;
};

async function bestEffortInsert(
  supabaseAdmin: SupabaseClient,
  table: string,
  payload: Record<string, unknown>,
): Promise<BestEffortInsertResult> {
  const { data, error } = await supabaseAdmin.from(table).insert(payload).select("id").maybeSingle();
  if (error) {
    if (isMissingRelationError(error)) {
      console.warn(`[grow-assistant] audit table unavailable for ${table}: ${coerceErrorMessage(error)}`);
      return { id: null };
    }

    throw error;
  }

  const id =
    data &&
    typeof data === "object" &&
    "id" in data &&
    typeof (data as { id?: unknown }).id === "string"
      ? (data as { id: string }).id
      : null;

  return { id };
}

export async function logAiInteractionStart(
  supabaseAdmin: SupabaseClient,
  payload: Record<string, unknown>,
) {
  return await bestEffortInsert(supabaseAdmin, "ai_interactions", payload);
}

export async function finalizeAiInteraction(
  supabaseAdmin: SupabaseClient,
  interactionId: string | null,
  payload: Record<string, unknown>,
) {
  if (!interactionId) return;

  const { error } = await supabaseAdmin
    .from("ai_interactions")
    .update(payload)
    .eq("id", interactionId);

  if (error && !isMissingRelationError(error)) {
    throw error;
  }
}

export async function logAiAction(
  supabaseAdmin: SupabaseClient,
  payload: Record<string, unknown>,
) {
  return await bestEffortInsert(supabaseAdmin, "ai_action_logs", payload);
}

export async function updateAiActionLog(
  supabaseAdmin: SupabaseClient,
  actionId: string | null,
  payload: Record<string, unknown>,
) {
  if (!actionId) return;

  const { error } = await supabaseAdmin
    .from("ai_action_logs")
    .update(payload)
    .eq("id", actionId);

  if (error && !isMissingRelationError(error)) {
    throw error;
  }
}

export async function logAiDuplicateCheck(
  supabaseAdmin: SupabaseClient,
  payload: Record<string, unknown>,
) {
  return await bestEffortInsert(supabaseAdmin, "ai_duplicate_checks", payload);
}

export async function logWhatsAppWebhookEvent(
  supabaseAdmin: SupabaseClient,
  payload: Record<string, unknown>,
) {
  return await bestEffortInsert(supabaseAdmin, "whatsapp_webhook_logs", payload);
}
