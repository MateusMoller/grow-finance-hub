import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  getManualAdoptionSnapshot as getManualAdoptionSnapshotService,
  getManualProgress,
  saveManualState as saveManualStateService,
  upsertLessonProgress as upsertLessonProgressService,
} from "@/lib/manual/service";
import type {
  ManualAdoptionSnapshotRow,
  ManualContextKey,
  ManualLessonStatus,
  ManualProgressRecord,
  ManualUserStateRecord,
} from "@/lib/manual/types";

interface AdoptionFilters {
  contextKey?: ManualContextKey | "all";
  profile?: string | "all";
  periodDays?: number;
}

interface UpsertLessonProgressPayload {
  contextKey: ManualContextKey;
  moduleKey: string;
  lessonKey: string;
  status: ManualLessonStatus;
}

const toProgressKey = (contextKey: ManualContextKey, moduleKey: string, lessonKey: string) =>
  `${contextKey}__${moduleKey}__${lessonKey}`;

export function useManualProgress() {
  const { user, role } = useAuth();
  const [progress, setProgress] = useState<Record<string, ManualProgressRecord>>({});
  const [userState, setUserState] = useState<ManualUserStateRecord>({
    onboarding_dismissed_at: null,
    last_context_key: null,
    last_module_key: null,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const canReadAdoption = useMemo(
    () => role === "admin" || role === "director" || role === "manager",
    [role],
  );

  const fetchManualState = useCallback(async () => {
    if (!user?.id) {
      setProgress({});
      setUserState({
        onboarding_dismissed_at: null,
        last_context_key: null,
        last_module_key: null,
      });
      setLoading(false);
      return;
    }

    setLoading(true);

    const data = await getManualProgress(user.id);
    const progressRows = data.progress as ManualProgressRecord[];
    const nextMap: Record<string, ManualProgressRecord> = {};

    progressRows.forEach((row) => {
      const key = toProgressKey(row.context_key, row.module_key, row.lesson_key);
      nextMap[key] = row;
    });

    setProgress(nextMap);

    if (data.state) {
      setUserState({
        onboarding_dismissed_at: data.state.onboarding_dismissed_at || null,
        last_context_key: data.state.last_context_key || null,
        last_module_key: data.state.last_module_key || null,
      });
    } else {
      setUserState({
        onboarding_dismissed_at: null,
        last_context_key: null,
        last_module_key: null,
      });
    }

    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    void fetchManualState();
  }, [fetchManualState]);

  const upsertLessonProgress = useCallback(async (payload: UpsertLessonProgressPayload) => {
    if (!user?.id) return;
    setSaving(true);
    const nowIso = new Date().toISOString();

    const { error } = await upsertLessonProgressService(user.id, payload);

    if (!error) {
      const key = toProgressKey(payload.contextKey, payload.moduleKey, payload.lessonKey);
      setProgress((prev) => ({
        ...prev,
        [key]: {
          context_key: payload.contextKey,
          module_key: payload.moduleKey,
          lesson_key: payload.lessonKey,
          status: payload.status,
          started_at: nowIso,
          completed_at: payload.status === "completed" ? nowIso : null,
          updated_at: nowIso,
        },
      }));
    }

    setSaving(false);
    return { error };
  }, [user?.id]);

  const saveManualState = useCallback(async (patch: Partial<ManualUserStateRecord>) => {
    if (!user?.id) return;
    const { error } = await saveManualStateService(user.id, {
      onboarding_dismissed_at: patch.onboarding_dismissed_at ?? userState.onboarding_dismissed_at,
      last_context_key: patch.last_context_key ?? userState.last_context_key,
      last_module_key: patch.last_module_key ?? userState.last_module_key,
    });

    if (!error) {
      setUserState((prev) => ({
        onboarding_dismissed_at: patch.onboarding_dismissed_at ?? prev.onboarding_dismissed_at,
        last_context_key: patch.last_context_key ?? prev.last_context_key,
        last_module_key: patch.last_module_key ?? prev.last_module_key,
      }));
    }

    return { error };
  }, [user?.id, userState.last_context_key, userState.last_module_key, userState.onboarding_dismissed_at]);

  const dismissManualOnboarding = useCallback(async () => {
    return saveManualState({ onboarding_dismissed_at: new Date().toISOString() });
  }, [saveManualState]);

  const saveLastModule = useCallback(async (contextKey: ManualContextKey, moduleKey: string) => {
    return saveManualState({ last_context_key: contextKey, last_module_key: moduleKey });
  }, [saveManualState]);

  const getLessonStatus = useCallback((contextKey: ManualContextKey, moduleKey: string, lessonKey: string): ManualLessonStatus | null => {
    const key = toProgressKey(contextKey, moduleKey, lessonKey);
    return progress[key]?.status || null;
  }, [progress]);

  const getManualAdoptionSnapshot = useCallback(async (filters?: AdoptionFilters) => {
    const { data, error } = await getManualAdoptionSnapshotService(filters);
    return { data: (data || []) as ManualAdoptionSnapshotRow[], error };
  }, []);

  return {
    loading,
    saving,
    progress,
    userState,
    canReadAdoption,
    refresh: fetchManualState,
    getLessonStatus,
    upsertLessonProgress,
    dismissManualOnboarding,
    saveLastModule,
    getManualAdoptionSnapshot,
  };
}
