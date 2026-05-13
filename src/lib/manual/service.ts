import { supabase } from "@/integrations/supabase/client";
import type {
  ManualAdoptionSnapshotRow,
  ManualContextKey,
  ManualLessonStatus,
  ManualProgressRecord,
  ManualUserStateRecord,
} from "@/lib/manual/types";

type LooseQueryResult = Promise<{ data: unknown; error: unknown }>;

interface LooseFilterBuilder extends PromiseLike<{ data: unknown; error: unknown }> {
  eq: (column: string, value: unknown) => LooseFilterBuilder;
  maybeSingle: () => LooseQueryResult;
}

interface LooseSelectBuilder {
  select: (columns: string) => LooseFilterBuilder;
  upsert: (row: unknown, options?: Record<string, unknown>) => Promise<{ error: unknown }>;
}

interface LooseSupabase {
  from: (table: string) => LooseSelectBuilder;
  rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
}

const supabaseLoose = supabase as unknown as LooseSupabase;

export async function getManualProgress(userId: string) {
  const [progressRes, stateRes] = await Promise.all([
    supabaseLoose
      .from("manual_user_progress")
      .select("context_key,module_key,lesson_key,status,started_at,completed_at,updated_at")
      .eq("user_id", userId),
    supabaseLoose
      .from("manual_user_state")
      .select("onboarding_dismissed_at,last_context_key,last_module_key")
      .eq("user_id", userId)
      .maybeSingle(),
  ]);

  return {
    progress: (progressRes?.data || []) as ManualProgressRecord[],
    state: (stateRes?.data || null) as ManualUserStateRecord | null,
    progressError: progressRes?.error,
    stateError: stateRes?.error,
  };
}

export async function upsertLessonProgress(userId: string, payload: {
  contextKey: ManualContextKey;
  moduleKey: string;
  lessonKey: string;
  status: ManualLessonStatus;
}) {
  const nowIso = new Date().toISOString();
  const row = {
    user_id: userId,
    context_key: payload.contextKey,
    module_key: payload.moduleKey,
    lesson_key: payload.lessonKey,
    status: payload.status,
    started_at: nowIso,
    completed_at: payload.status === "completed" ? nowIso : null,
    updated_at: nowIso,
  };

  const { error } = await supabaseLoose
    .from("manual_user_progress")
    .upsert(row, { onConflict: "user_id,context_key,module_key,lesson_key" });

  return { error, row };
}

export async function saveManualState(userId: string, payload: {
  onboarding_dismissed_at?: string | null;
  last_context_key?: ManualContextKey | null;
  last_module_key?: string | null;
}) {
  const row = {
    user_id: userId,
    onboarding_dismissed_at: payload.onboarding_dismissed_at ?? null,
    last_context_key: payload.last_context_key ?? null,
    last_module_key: payload.last_module_key ?? null,
  };
  const { error } = await supabaseLoose
    .from("manual_user_state")
    .upsert(row, { onConflict: "user_id" });
  return { error };
}

export async function dismissManualOnboarding(userId: string) {
  return saveManualState(userId, { onboarding_dismissed_at: new Date().toISOString() });
}

export async function getManualAdoptionSnapshot(filters?: {
  contextKey?: ManualContextKey | "all";
  profile?: string | "all";
  periodDays?: number;
}) {
  const { data, error } = await supabaseLoose.rpc("get_manual_adoption_snapshot", {
    p_context_key: !filters?.contextKey || filters.contextKey === "all" ? null : filters.contextKey,
    p_profile: !filters?.profile || filters.profile === "all" ? null : filters.profile,
    p_period_days: filters?.periodDays || 90,
  });

  return { data: (data || []) as ManualAdoptionSnapshotRow[], error };
}
