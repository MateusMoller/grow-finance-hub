import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

export type ChangeHistoryEntityType = "task" | "crm";

export interface ChangeHistoryEntry {
  id: string;
  entityType: ChangeHistoryEntityType;
  entityId: string;
  action: string;
  details?: string;
  actor: string;
  createdAt: string;
}

interface NewHistoryEntry {
  entityType: ChangeHistoryEntityType;
  entityId: string;
  action: string;
  details?: string;
  actor: string;
}

const buildStorageKey = (userId: string) => `grow-change-history-${userId}`;

const safeParse = (value: string | null): ChangeHistoryEntry[] => {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is ChangeHistoryEntry => {
      if (!item || typeof item !== "object") return false;
      return (
        typeof item.id === "string" &&
        typeof item.entityType === "string" &&
        typeof item.entityId === "string" &&
        typeof item.action === "string" &&
        typeof item.actor === "string" &&
        typeof item.createdAt === "string"
      );
    });
  } catch {
    return [];
  }
};

const loadAllEntries = (userId: string): ChangeHistoryEntry[] => {
  if (!userId) return [];
  return safeParse(localStorage.getItem(buildStorageKey(userId)));
};

const saveAllEntries = (userId: string, entries: ChangeHistoryEntry[]) => {
  if (!userId) return;
  localStorage.setItem(buildStorageKey(userId), JSON.stringify(entries.slice(0, 1000)));
};

const createId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

export const addHistoryEntry = (userId: string, entry: NewHistoryEntry) => {
  if (!userId) return;
  const nextEntry: ChangeHistoryEntry = {
    id: createId(),
    entityType: entry.entityType,
    entityId: entry.entityId,
    action: entry.action,
    details: entry.details,
    actor: entry.actor,
    createdAt: new Date().toISOString(),
  };

  const current = loadAllEntries(userId);
  saveAllEntries(userId, [nextEntry, ...current]);
};

export const getEntityHistory = (
  userId: string,
  entityType: ChangeHistoryEntityType,
  entityId: string,
  limit = 20,
) => {
  if (!userId || !entityId) return [] as ChangeHistoryEntry[];
  return loadAllEntries(userId)
    .filter((entry) => entry.entityType === entityType && entry.entityId === entityId)
    .slice(0, limit);
};

export interface TaskHistoryInput {
  organizationId: string | null | undefined;
  taskId: string;
  action: string;
  details?: string;
  actor?: string;
  metadata?: Record<string, Json>;
}

type AuditLogRow = {
  id: string;
  action: string;
  actor_user_id: string | null;
  created_at: string;
  metadata: Json;
};

const getMetadataString = (metadata: Json, key: string) => {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const value = metadata[key];
  return typeof value === "string" && value.trim() ? value : null;
};

export async function recordTaskHistoryEntry(input: TaskHistoryInput) {
  if (!input.organizationId || !input.taskId) return;

  const metadata: Record<string, Json> = {
    ...(input.metadata || {}),
  };
  if (input.details) metadata.details = input.details;
  if (input.actor) metadata.actor_label = input.actor;

  const { error } = await supabase.rpc("record_operational_audit_log", {
    _organization_id: input.organizationId,
    _action: input.action,
    _entity_type: "task",
    _entity_id: input.taskId,
    _result: "success",
    _metadata: metadata,
    _client_id: null,
    _request_id: null,
  });

  if (error) {
    console.warn("Failed to record task history", error);
  }
}

export async function getTaskHistoryEntries(
  organizationId: string | null | undefined,
  taskId: string,
  limit = 20,
): Promise<ChangeHistoryEntry[]> {
  if (!organizationId || !taskId) return [];

  const { data, error } = await supabase
    .from("operational_audit_logs")
    .select("id, action, actor_user_id, created_at, metadata")
    .eq("organization_id", organizationId)
    .eq("entity_type", "task")
    .eq("entity_id", taskId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.warn("Failed to load task history", error);
    return [];
  }

  const rows = (data || []) as AuditLogRow[];
  const actorIds = Array.from(
    new Set(rows.map((row) => row.actor_user_id).filter((id): id is string => Boolean(id))),
  );
  let actorNames = new Map<string, string>();

  if (actorIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, display_name")
      .in("user_id", actorIds);

    actorNames = new Map(
      ((profiles || []) as Array<{ user_id: string; display_name: string | null }>).map((profile) => [
        profile.user_id,
        profile.display_name?.trim() || profile.user_id,
      ]),
    );
  }

  return rows.map((row) => ({
    id: row.id,
    entityType: "task",
    entityId: taskId,
    action: row.action,
    details: getMetadataString(row.metadata, "details") || undefined,
    actor:
      (row.actor_user_id ? actorNames.get(row.actor_user_id) : null) ||
      getMetadataString(row.metadata, "actor_label") ||
      "Usuario registrado",
    createdAt: row.created_at,
  }));
}
