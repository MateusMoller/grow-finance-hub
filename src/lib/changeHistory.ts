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
