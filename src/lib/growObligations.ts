import { supabase } from "@/integrations/supabase/client";

export type GrowExpectedDocument = {
  document_type_key: string;
  label: string;
  aliases: string[];
  required: boolean;
  active: boolean;
  reference_files_count?: number;
  has_active_reference?: boolean;
  reference_files?: GrowExpectedDocumentReferenceFile[];
};

export type GrowExpectedDocumentReferenceFile = {
  id: string;
  template_id: string;
  profile_id: string | null;
  document_type_key: string;
  file_name: string;
  storage_bucket: string;
  storage_path: string;
  content_type: string | null;
  file_size: number | null;
  is_active: boolean;
  source_kind: "template_reference" | "profile_override";
  extracted_text_preview: string | null;
  text_extraction_status: "pending" | "completed" | "failed";
  ocr_status: "pending" | "not_needed" | "completed" | "failed";
  fingerprint_version: number;
  fingerprint_payload: Record<string, unknown>;
  keywords: string[];
  primary_cues: string[];
  created_at: string;
};

export type GrowObligationTemplate = {
  id: string;
  code: string;
  name: string;
  sector: string;
  periodicity: "monthly" | "quarterly" | "yearly" | "custom";
  competence_reference: "vigente" | "anterior";
  due_day: number;
  yearly_due_month: number | null;
  legal_due_day: number | null;
  priority: "baixa" | "media" | "alta" | "urgente";
  expected_documents: GrowExpectedDocument[];
  is_active: boolean;
  generates_calendar: boolean;
  generates_kanban: boolean;
  requires_document: boolean;
  operational_notes: string | null;
};

export const growPeriodicityLabel: Record<GrowObligationTemplate["periodicity"], string> = {
  monthly: "Mensal",
  quarterly: "Trimestral",
  yearly: "Anual",
  custom: "Personalizada",
};

export const growCompetenceReferenceLabel: Record<GrowObligationTemplate["competence_reference"], string> = {
  vigente: "Vigente",
  anterior: "Anterior",
};

export type GrowClientSummary = {
  id: string;
  name: string;
  cnpj: string | null;
  sector: string;
  status: string;
};

export type GrowObligationProfile = {
  id: string;
  client_id: string;
  template_id: string;
  assigned_to: string | null;
  start_date: string;
  end_date: string | null;
  is_active: boolean;
  due_day_override: number | null;
  yearly_due_month_override: number | null;
  legal_due_day_override: number | null;
  expected_documents_override: GrowExpectedDocument[] | null;
  notes: string | null;
  template: GrowObligationTemplate | null;
  client: GrowClientSummary | null;
};

export type GrowObligationInstance = {
  id: string;
  client_id: string;
  profile_id: string;
  template_id: string;
  competence_label: string;
  competence_date: string;
  competence_key: string;
  technical_due_date: string;
  legal_due_date: string | null;
  status: "pendente" | "em_andamento" | "aguardando_documento" | "em_revisao" | "concluida" | "atrasada" | "cancelada";
  priority: "baixa" | "media" | "alta" | "urgente";
  current_assignee: string | null;
  completion_notes: string | null;
  document_required: boolean;
  completed_at: string | null;
  updated_at: string;
  created_at: string;
  template: GrowObligationTemplate | null;
  client: GrowClientSummary | null;
  profile: GrowObligationProfile | null;
};

export type GrowDocumentInboxItem = {
  id: string;
  client_id: string | null;
  suggested_client_id: string | null;
  detected_client_id: string | null;
  suggested_template_id: string | null;
  suggested_instance_id: string | null;
  linked_instance_id: string | null;
  document_type_key: string | null;
  file_name: string;
  storage_bucket: string;
  storage_path: string;
  content_type: string | null;
  file_size: number | null;
  suggested_competence_label: string | null;
  detected_cnpj: string | null;
  competence_detected: string | null;
  identification_confidence: number;
  matched_by:
    | "manual_instance"
    | "direct_expected_doc"
    | "alias_match"
    | "single_open_instance"
    | "manual_review"
    | null;
  match_score: number;
  match_reasons: string[];
  reference_file_id: string | null;
  reference_match_score: number;
  reference_match_reasons: string[];
  review_required: boolean;
  status: "pending_review" | "linked" | "rejected";
  blocking_reason: string | null;
  text_extraction_status: "pending" | "completed" | "failed";
  ocr_status: "pending" | "not_needed" | "completed" | "failed";
  extracted_text_preview: string | null;
  auto_link_block_reason: string | null;
  notes: string | null;
  created_at: string;
  client: GrowClientSummary | null;
  detected_client: GrowClientSummary | null;
  template: GrowObligationTemplate | null;
  linked_instance: GrowObligationInstance | null;
  document_definition: GrowExpectedDocument | null;
  reference_file: GrowExpectedDocumentReferenceFile | null;
};

export type GrowObligationsOverviewPayload = {
  ok: boolean;
  summary: {
    templates_total: number;
    templates_active: number;
    active_profiles: number;
    pending_instances: number;
    overdue_instances: number;
    waiting_documents: number;
    done_instances: number;
    inbox_pending: number;
  };
  clients: GrowClientSummary[];
  templates: GrowObligationTemplate[];
  profiles: GrowObligationProfile[];
  instances: GrowObligationInstance[];
  documents: GrowDocumentInboxItem[];
};

export type GrowClientSnapshotPayload = {
  ok: boolean;
  client_id: string;
  profiles: GrowObligationProfile[];
  instances: GrowObligationInstance[];
  templates: GrowObligationTemplate[];
};

export async function invokeGrowObligations<T>(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke<T>("grow-obligations-module", { body });

  if (error) {
    const errorWithContext = error as Error & { context?: Response };
    const response = errorWithContext.context;
    if (response) {
      try {
        const payload = await response.clone().json() as { error?: string };
        if (payload?.error) {
          throw new Error(payload.error);
        }
      } catch {
        try {
          const text = await response.clone().text();
          if (text) {
            throw new Error(text);
          }
        } catch {
          // fall through to original error
        }
      }
    }
    throw errorWithContext;
  }

  return data as T;
}

export const growObligationStatusLabel: Record<GrowObligationInstance["status"], string> = {
  pendente: "Pendente",
  em_andamento: "Em andamento",
  aguardando_documento: "Aguardando documento",
  em_revisao: "Em revisão",
  concluida: "Concluída",
  atrasada: "Atrasada",
  cancelada: "Cancelada",
};

export const growObligationStatusClass: Record<GrowObligationInstance["status"], string> = {
  pendente: "bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300",
  em_andamento: "bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300",
  aguardando_documento: "bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-300",
  em_revisao: "bg-violet-100 text-violet-700 dark:bg-violet-900/20 dark:text-violet-300",
  concluida: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300",
  atrasada: "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-300",
  cancelada: "bg-muted text-muted-foreground",
};

export const growPriorityLabel: Record<GrowObligationInstance["priority"], string> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
  urgente: "Urgente",
};
