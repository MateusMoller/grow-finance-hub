export type ManualContextKey = "institutional" | "internal" | "portal";

export type ManualAudienceKey =
  | "public_visitor"
  | "internal_team"
  | "leadership"
  | "admin"
  | "client";

export interface ManualAction {
  label: string;
  actionKey: string;
  description?: string;
}

export interface ManualLesson {
  key: string;
  title: string;
  summary: string;
  estimatedMinutes: number;
  steps: string[];
  tips?: string[];
  commonMistakes?: string[];
  actions?: ManualAction[];
  tags?: string[];
}

export interface ManualModule {
  key: string;
  contextKey: ManualContextKey;
  audience: ManualAudienceKey[];
  title: string;
  objective: string;
  lessons: ManualLesson[];
  order: number;
}

export interface ManualContextMeta {
  key: ManualContextKey;
  title: string;
  description: string;
}

export type ManualLessonStatus = "in_progress" | "completed";

export interface ManualProgressRecord {
  context_key: ManualContextKey;
  module_key: string;
  lesson_key: string;
  status: ManualLessonStatus;
  started_at: string;
  completed_at: string | null;
  updated_at: string;
}

export interface ManualUserStateRecord {
  onboarding_dismissed_at: string | null;
  last_context_key: ManualContextKey | null;
  last_module_key: string | null;
}

export interface ManualAdoptionSnapshotRow {
  context_key: ManualContextKey;
  module_key: string;
  profile: string;
  total_users: number;
  completed_users: number;
  pending_users: number;
  avg_completion: number;
}
