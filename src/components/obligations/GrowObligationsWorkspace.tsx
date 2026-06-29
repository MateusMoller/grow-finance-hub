import { useMemo, useRef, useState, type DragEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  FileText,
  FileSpreadsheet,
  FolderUp,
  Loader2,
  Mail,
  MessageCircle,
  Plus,
  RefreshCcw,
  Settings2,
  Sparkles,
  Trash2,
  UploadCloud,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { analyzePdfDocument, type AnalyzedDocument } from "@/lib/documentRecognition";
import { normalizeTaxRegime, taxRegimeDefinitions } from "@/lib/obligations/taxRegimes";
import type { TaxRegimeCode } from "@/lib/obligations/regimeLoadTypes";
import {
  buildSecureStoragePath,
  SECURE_DOCUMENT_ACCEPT,
  validateSecureDocument,
} from "@/lib/fileUploadSecurity";
import {
  growCompetenceReferenceLabel,
  growDueMonthReferenceLabel,
  growObligationStatusClass,
  growObligationStatusLabel,
  growPeriodicityLabel,
  growPriorityLabel,
  getStoredCurrentOrganizationId,
  invokeGrowObligations,
  type GrowDocumentInboxItem,
  type GrowDocumentIngestionJob,
  type GrowExpectedDocument,
  type GrowExpectedDocumentReferenceFile,
  type GrowObligationInstance,
  type GrowObligationTemplate,
  type GrowObligationsOverviewPayload,
} from "@/lib/growObligations";
import { supabase } from "@/integrations/supabase/client";

type WorkspaceTab = "catalogo" | "documentos";
type MatchStrategy = "manual_instance" | "direct_expected_doc" | "alias_match" | "single_open_instance" | "manual_review";

const showLocalRobotPanel = false;

interface GrowObligationsWorkspaceProps {
  defaultTab?: WorkspaceTab;
  initialClientId?: string | null;
}

interface TemplateExpectedDocumentDraft extends GrowExpectedDocument {
  aliases_text: string;
}

interface TemplateFormState {
  id: string | null;
  name: string;
  sector: string;
  periodicity: GrowObligationTemplate["periodicity"];
  competence_reference: GrowObligationTemplate["competence_reference"];
  technical_due_month_reference: GrowObligationTemplate["technical_due_month_reference"];
  due_day: string;
  legal_due_day: string;
  priority: GrowObligationInstance["priority"];
  expected_documents: TemplateExpectedDocumentDraft[];
  is_active: boolean;
  generates_calendar: boolean;
  generates_kanban: boolean;
  requires_document: boolean;
  operational_notes: string;
  linked_client_ids: string[];
  completion_email_enabled: boolean;
  completion_email_subject: string;
  completion_email_body: string;
  completion_whatsapp_enabled: boolean;
  completion_whatsapp_body: string;
}

interface InstanceFormState {
  instanceId: string;
  status: GrowObligationInstance["status"];
  priority: GrowObligationInstance["priority"];
  completion_notes: string;
  event_comment: string;
}

interface UploadQueueItem {
  id: string;
  file: File;
  analysis: AnalyzedDocument;
  client_id: string;
  template_id: string;
  document_type_key: string;
  instance_id: string;
  suggested_competence_label: string;
  notes: string;
  preview: ReferenceMatchPreview | null;
  previewError: string | null;
  isPreviewing: boolean;
}

interface ReferenceMatchPreview {
  ok: true;
  match: {
    resolvedInstanceId: string | null;
    suggestedTemplateId: string | null;
    documentTypeKey: string | null;
    strategy: MatchStrategy;
    score: number;
    reasons: string[];
    reviewRequired: boolean;
    candidateInstanceIds: string[];
    detectedClientId?: string | null;
    detectedCnpj?: string | null;
    competenceDetected?: string | null;
    referenceFileId?: string | null;
    referenceMatchScore?: number;
    referenceMatchReasons?: string[];
    autoLinkBlockReason?: string | null;
  };
}

const sectors = ["Contabil", "Fiscal", "Departamento Pessoal", "Financeiro", "Comercial", "Societario", "Geral"];
const periodicities: GrowObligationTemplate["periodicity"][] = ["monthly", "quarterly", "yearly", "custom"];
const priorities: GrowObligationInstance["priority"][] = ["baixa", "media", "alta", "urgente"];
const statusOptions: GrowObligationInstance["status"][] = [
  "pendente",
  "em_andamento",
  "aguardando_documento",
  "em_revisao",
  "atrasada",
  "cancelada",
];

function slugifyDocumentKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizeTemplateCode(value: string) {
  return slugifyDocumentKey(value).replace(/_+/g, "-");
}

function makeDocumentDraft(document?: GrowExpectedDocument): TemplateExpectedDocumentDraft {
  return {
    document_type_key: document?.document_type_key || "",
    label: document?.label || "",
    aliases: document?.aliases || [],
    aliases_text: (document?.aliases || []).join(", "),
    required: document?.required ?? true,
    active: document?.active ?? true,
    reference_files_count: document?.reference_files_count || 0,
    has_active_reference: document?.has_active_reference || false,
    reference_files: document?.reference_files || [],
  };
}

function makeTemplateForm(template?: GrowObligationTemplate | null): TemplateFormState {
  return {
    id: template?.id || null,
    name: template?.name || "",
    sector: template?.sector || "Geral",
    periodicity: template?.periodicity || "monthly",
    competence_reference: template?.competence_reference || "vigente",
    technical_due_month_reference: template?.technical_due_month_reference || "vigente",
    due_day: String(template?.due_day ?? 10),
    legal_due_day: template?.legal_due_day ? String(template.legal_due_day) : "",
    priority: template?.priority || "media",
    expected_documents: template?.expected_documents?.length
      ? template.expected_documents.map((item) => makeDocumentDraft(item))
      : [makeDocumentDraft()],
    is_active: template?.is_active ?? true,
    generates_calendar: true,
    generates_kanban: true,
    requires_document: true,
    operational_notes: template?.operational_notes || "",
    linked_client_ids: [],
    completion_email_enabled: template?.completion_email_enabled ?? false,
    completion_email_subject: template?.completion_email_subject || "",
    completion_email_body: template?.completion_email_body || "",
    completion_whatsapp_enabled: template?.completion_whatsapp_enabled ?? false,
    completion_whatsapp_body: template?.completion_whatsapp_body || "",
  };
}

function buildTemplateLinkedClientIds(
  profiles: GrowObligationsOverviewPayload["profiles"] | undefined,
  templateId: string | null | undefined,
) {
  if (!profiles || !templateId) return [];
  return Array.from(
    new Set(
      profiles
        .filter((profile) => profile.template_id === templateId && profile.is_active)
        .map((profile) => profile.client_id),
    ),
  );
}

function makeInstanceForm(instance: GrowObligationInstance): InstanceFormState {
  return {
    instanceId: instance.id,
    status: instance.status,
    priority: instance.priority,
    completion_notes: instance.completion_notes || "",
    event_comment: "",
  };
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("pt-BR");
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString("pt-BR");
}

function buildInstanceLabel(instance: GrowObligationInstance) {
  return `${instance.client?.name || "Cliente"} · ${instance.template?.name || "Obrigacao"} · ${instance.competence_label}`;
}

function sanitizeExpectedDocuments(documents: TemplateExpectedDocumentDraft[]): GrowExpectedDocument[] {
  const used = new Set<string>();
  return documents
    .map((document) => {
      const label = document.label.trim();
      const documentTypeKey = slugifyDocumentKey(document.document_type_key || label);
      return {
        document_type_key: documentTypeKey,
        label,
        aliases: document.aliases_text.split(",").map((item) => item.trim()).filter(Boolean),
        required: document.required,
        active: document.active,
      };
    })
    .filter((document) => {
      if (!document.label || !document.document_type_key || used.has(document.document_type_key)) return false;
      used.add(document.document_type_key);
      return true;
    });
}

function validateTemplateForm(form: TemplateFormState) {
  if (!form.name.trim()) return "Informe o nome da obrigação.";
  const documents = sanitizeExpectedDocuments(form.expected_documents);
  if (documents.length === 0) return "Cadastre pelo menos um documento esperado.";
  if (form.completion_email_enabled && !form.completion_email_subject.trim()) {
    return "Informe o assunto padrao do e-mail automatico.";
  }
  if (form.completion_email_enabled && !form.completion_email_body.trim()) {
    return "Informe o corpo padrao do e-mail automatico.";
  }
  if (form.completion_whatsapp_enabled && !form.completion_whatsapp_body.trim()) {
    return "Informe o corpo padrao do WhatsApp automatico.";
  }
  return null;
}

async function upsertTemplateDirectly(payload: TemplateFormState) {
  const organizationId = await getStoredCurrentOrganizationId();
  if (!organizationId) throw new Error("Organizacao ativa nao encontrada.");

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) throw new Error("Sessao invalida ou expirada.");

  const row = {
    organization_id: organizationId,
    code: normalizeTemplateCode(payload.name),
    name: payload.name.trim(),
    sector: payload.sector || "Geral",
    periodicity: payload.periodicity,
    competence_reference: payload.competence_reference,
    technical_due_month_reference: payload.technical_due_month_reference,
    due_day: Number(payload.due_day || 10),
    yearly_due_month: null,
    legal_due_day: payload.legal_due_day ? Number(payload.legal_due_day) : null,
    priority: payload.priority,
    expected_documents: sanitizeExpectedDocuments(payload.expected_documents),
    is_active: payload.is_active,
    generates_calendar: true,
    generates_kanban: true,
    requires_document: true,
    operational_notes: payload.operational_notes.trim() || null,
    completion_email_enabled: payload.completion_email_enabled,
    completion_email_subject: payload.completion_email_subject.trim() || null,
    completion_email_body: payload.completion_email_body.trim() || null,
    completion_whatsapp_enabled: payload.completion_whatsapp_enabled,
    completion_whatsapp_body: payload.completion_whatsapp_body.trim() || null,
    created_by: user.id,
  };

  const templateQuery = payload.id
    ? supabase
        .from("obligation_templates")
        .update(row)
        .eq("organization_id", organizationId)
        .eq("id", payload.id)
        .select("*")
        .single()
    : supabase.from("obligation_templates").insert(row).select("*").single();
  const { data: template, error: templateError } = await templateQuery;
  if (templateError) throw templateError;

  if ("linked_client_ids" in payload) {
    const templateId = String(template.id);
    const linkedClientIds = Array.from(new Set(payload.linked_client_ids));
    const { data: existingProfilesData, error: existingProfilesError } = await supabase
      .from("client_obligation_profiles")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("template_id", templateId);
    if (existingProfilesError) throw existingProfilesError;

    const existingProfiles = existingProfilesData || [];
    const existingProfilesByClientId = new Map(existingProfiles.map((profile) => [String(profile.client_id), profile]));
    const today = new Date().toISOString().slice(0, 10);

    if (linkedClientIds.length > 0) {
      const profileRows = linkedClientIds.map((clientId) => {
        const existingProfile = existingProfilesByClientId.get(clientId);
        return {
          organization_id: organizationId,
          client_id: clientId,
          template_id: templateId,
          assigned_to: existingProfile?.assigned_to || null,
          start_date: existingProfile?.start_date || today,
          end_date: null,
          is_active: true,
          due_day_override: existingProfile?.due_day_override ?? null,
          yearly_due_month_override: existingProfile?.yearly_due_month_override ?? null,
          legal_due_day_override: existingProfile?.legal_due_day_override ?? null,
          expected_documents_override: existingProfile?.expected_documents_override ?? null,
          notes: existingProfile?.notes || null,
          parameters: existingProfile?.parameters || {},
          created_by: user.id,
        };
      });
      const { error: profileUpsertError } = await supabase
        .from("client_obligation_profiles")
        .upsert(profileRows, { onConflict: "client_id,template_id" });
      if (profileUpsertError) throw profileUpsertError;
    }

    const profilesToDeactivate = existingProfiles.filter(
      (profile) => profile.is_active && !linkedClientIds.includes(String(profile.client_id)),
    );
    if (profilesToDeactivate.length > 0) {
      const { error: deactivateError } = await supabase
        .from("client_obligation_profiles")
        .update({ is_active: false, end_date: today })
        .in("id", profilesToDeactivate.map((profile) => profile.id));
      if (deactivateError) throw deactivateError;
    }
  }

  return { ok: true, template, fallback: "direct_rls" };
}

function validateUploadQueueItem(item: UploadQueueItem) {
  const validationError = validateSecureDocument(item.file);
  if (validationError) return validationError;
  if (!item.file?.name) return "Existe um arquivo invalido na fila.";
  if (!item.analysis) return `O arquivo ${item.file.name} ainda não foi analisado.`;
  if (item.isPreviewing) return `Aguarde o preview do arquivo ${item.file.name} terminar.`;
  if (item.document_type_key && !item.template_id) {
    return `O arquivo ${item.file.name} esta com documento esperado sem template vinculado.`;
  }
  if (item.template_id && !item.document_type_key) {
    return `Selecione o documento esperado do arquivo ${item.file.name}.`;
  }
  return null;
}

function matchStrategyLabel(strategy: MatchStrategy | null | undefined) {
  switch (strategy) {
    case "manual_instance":
      return "Instancia manual";
    case "direct_expected_doc":
      return "Documento modelo";
    case "alias_match":
      return "Alias";
    case "single_open_instance":
      return "Instancia aberta";
    case "manual_review":
    default:
      return "Revisao manual";
  }
}

function inboxStatusLabel(status: GrowDocumentInboxItem["status"]) {
  if (status === "linked") return "Vinculado";
  if (status === "rejected") return "Rejeitado";
  return "Em revisão";
}

function processingStatusLabel(status: GrowDocumentInboxItem["processing_status"]) {
  switch (status) {
    case "processing":
      return "Processando";
    case "processed":
      return "Processado";
    case "failed":
      return "Falhou";
    case "queued":
    default:
      return "Na fila";
  }
}

function executionStatusLabel(status: GrowDocumentInboxItem["execution_status"]) {
  switch (status) {
    case "applied":
      return "Aplicado";
    case "skipped":
      return "Ignorado";
    case "failed":
      return "Falhou";
    case "pending":
    default:
      return "Pendente";
  }
}

function classificationStatusLabel(status: GrowDocumentInboxItem["classification_status"] | GrowDocumentIngestionJob["classification_status"]) {
  switch (status) {
    case "classified":
      return "Classificado";
    case "review_required":
      return "Revisao";
    case "failed":
      return "Falhou";
    case "queued":
    default:
      return "Na fila";
  }
}

function communicationStatusLabel(status: GrowDocumentInboxItem["communication_status"] | GrowDocumentIngestionJob["communication_status"]) {
  switch (status) {
    case "sent":
      return "Enviado";
    case "partial":
      return "Parcial";
    case "failed":
      return "Falhou";
    case "not_applicable":
      return "Nao se aplica";
    case "pending":
    default:
      return "Pendente";
  }
}

function publicationStatusLabel(status: GrowDocumentInboxItem["publication_status"] | GrowDocumentIngestionJob["publication_status"]) {
  switch (status) {
    case "published":
      return "Publicado";
    case "failed":
      return "Falhou";
    case "not_applicable":
      return "Nao se aplica";
    case "pending":
    default:
      return "Pendente";
  }
}

function applyPreviewAutofill(item: UploadQueueItem, preview: ReferenceMatchPreview): UploadQueueItem {
  const { match } = preview;
  const nextClientId = match.detectedClientId || item.client_id;
  const nextTemplateId = match.suggestedTemplateId || item.template_id;
  const nextDocumentTypeKey = match.documentTypeKey || item.document_type_key;
  const nextInstanceId = match.resolvedInstanceId || item.instance_id;
  const nextCompetenceLabel = match.competenceDetected || item.analysis.competence_detected || item.suggested_competence_label;

  return {
    ...item,
    client_id: nextClientId || "",
    template_id: nextTemplateId || "",
    document_type_key: nextDocumentTypeKey || "",
    instance_id: nextInstanceId || "",
    suggested_competence_label: nextCompetenceLabel || "",
    preview,
    previewError: null,
    isPreviewing: false,
  };
}

const overviewQueryKey = ["grow-obligations-overview"];

export function GrowObligationsWorkspace({
  defaultTab = "documentos",
  initialClientId = null,
}: GrowObligationsWorkspaceProps) {
  const queryClient = useQueryClient();
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const [activeTab, setActiveTab] = useState<WorkspaceTab>(defaultTab);
  const [templateSearch, setTemplateSearch] = useState("");
  const [instanceSearch, setInstanceSearch] = useState("");
  const [instanceStatusFilter, setInstanceStatusFilter] = useState<string>("all");
  const [instanceClientFilter, setInstanceClientFilter] = useState<string>(initialClientId || "all");
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [templateForm, setTemplateForm] = useState<TemplateFormState>(makeTemplateForm());
  const [instanceDialogOpen, setInstanceDialogOpen] = useState(false);
  const [instanceForm, setInstanceForm] = useState<InstanceFormState | null>(null);
  const [documentResolutionId, setDocumentResolutionId] = useState<string | null>(null);
  const [documentResolutionInstanceId, setDocumentResolutionInstanceId] = useState("");
  const [documentResolutionNotes, setDocumentResolutionNotes] = useState("");
  const [uploadQueue, setUploadQueue] = useState<UploadQueueItem[]>([]);
  const [referenceUploadKey, setReferenceUploadKey] = useState<string | null>(null);
  const [isDraggingUpload, setIsDraggingUpload] = useState(false);
  const [templateClientSearch, setTemplateClientSearch] = useState("");

  const overviewQuery = useQuery({
    queryKey: overviewQueryKey,
    queryFn: () => invokeGrowObligations<GrowObligationsOverviewPayload>({ action: "overview" }),
  });

  const overview = overviewQuery.data;

  const templateMutation = useMutation({
    mutationFn: async (payload: TemplateFormState) => {
      const validationError = validateTemplateForm(payload);
      if (validationError) throw new Error(validationError);
      const requestPayload = {
        action: "upsert_template",
        id: payload.id,
        name: payload.name,
        sector: payload.sector,
        periodicity: payload.periodicity,
        competence_reference: payload.competence_reference,
        technical_due_month_reference: payload.technical_due_month_reference,
        due_day: Number(payload.due_day || 10),
        legal_due_day: payload.legal_due_day ? Number(payload.legal_due_day) : null,
        priority: payload.priority,
        expected_documents: sanitizeExpectedDocuments(payload.expected_documents),
        is_active: payload.is_active,
        generates_calendar: payload.generates_calendar,
        generates_kanban: payload.generates_kanban,
        requires_document: payload.requires_document,
        operational_notes: payload.operational_notes,
        linked_client_ids: payload.linked_client_ids,
        completion_email_enabled: payload.completion_email_enabled,
        completion_email_subject: payload.completion_email_subject || null,
        completion_email_body: payload.completion_email_body || null,
        completion_whatsapp_enabled: payload.completion_whatsapp_enabled,
        completion_whatsapp_body: payload.completion_whatsapp_body || null,
      };
      try {
        return await invokeGrowObligations(requestPayload);
      } catch (error) {
        console.warn("grow-obligations-module upsert_template failed, using RLS fallback", error);
        return await upsertTemplateDirectly(payload);
      }
    },
    onSuccess: async () => {
      toast.success("Obrigacao mestre salva.");
      setTemplateDialogOpen(false);
      setTemplateForm(makeTemplateForm());
      setTemplateClientSearch("");
      await queryClient.invalidateQueries({ queryKey: overviewQueryKey });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Falha ao salvar obrigação."),
  });

  const generateMutation = useMutation({
    mutationFn: () =>
      invokeGrowObligations({
        action: "generate_instances",
        client_id: instanceClientFilter !== "all" ? instanceClientFilter : null,
      }),
    onSuccess: async () => {
      toast.success("Competencias sincronizadas.");
      await queryClient.invalidateQueries({ queryKey: overviewQueryKey });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Falha ao gerar competências."),
  });

  const instanceMutation = useMutation({
    mutationFn: (payload: InstanceFormState) =>
      invokeGrowObligations({
        action: "update_instance",
        instance_id: payload.instanceId,
        status: payload.status,
        priority: payload.priority,
        completion_notes: payload.completion_notes,
        event_comment: payload.event_comment,
      }),
    onSuccess: async () => {
      toast.success("Instancia atualizada.");
      setInstanceDialogOpen(false);
      setInstanceForm(null);
      await queryClient.invalidateQueries({ queryKey: overviewQueryKey });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Falha ao atualizar instancia."),
  });

  const documentResolveMutation = useMutation({
    mutationFn: (payload: { inboxItemId: string; decision: "accept" | "reject"; instanceId?: string; notes?: string }) =>
      invokeGrowObligations({
        action: "resolve_document",
        inbox_item_id: payload.inboxItemId,
        decision: payload.decision,
        instance_id: payload.instanceId,
        notes: payload.notes,
        blocking_reason: payload.notes,
      }),
    onSuccess: async () => {
      toast.success("Documento processado.");
      setDocumentResolutionId(null);
      setDocumentResolutionInstanceId("");
      setDocumentResolutionNotes("");
      await queryClient.invalidateQueries({ queryKey: overviewQueryKey });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Falha ao processar documento."),
  });

  const uploadReferenceMutation = useMutation({
    mutationFn: async ({
      templateId,
      documentTypeKey,
      file,
    }: {
      templateId: string;
      documentTypeKey: string;
      file: File;
    }) => {
      if (!templateId) throw new Error("Salve o template antes de anexar documentos modelo.");
      if (!documentTypeKey) throw new Error("Defina o documento esperado antes de anexar o modelo.");
      const validationError = validateSecureDocument(file);
      if (validationError) throw new Error(validationError);
      const analysis = await analyzePdfDocument(file);
      const path = buildSecureStoragePath(["grow-obligations", "references", templateId, documentTypeKey], file.name);
      const { error: uploadError } = await supabase.storage.from("obligation-files").upload(path, file, {
        contentType: file.type || undefined,
        upsert: false,
      });
      if (uploadError) throw uploadError;
      return invokeGrowObligations<{ ok: true; reference_file: GrowExpectedDocumentReferenceFile }>({
        action: "upload_reference_document",
        template_id: templateId,
        document_type_key: documentTypeKey,
        file_name: file.name,
        storage_bucket: "obligation-files",
        storage_path: path,
        content_type: file.type || "application/pdf",
        file_size: file.size,
        analysis,
      });
    },
    onSuccess: async (response, variables) => {
      toast.success("Documento modelo anexado.");
      setTemplateForm((prev) => ({
        ...prev,
        expected_documents: prev.expected_documents.map((document) =>
          document.document_type_key === variables.documentTypeKey
            ? {
                ...document,
                reference_files: [response.reference_file, ...(document.reference_files || [])],
                reference_files_count: (document.reference_files_count || 0) + 1,
                has_active_reference: true,
              }
            : document,
        ),
      }));
      await queryClient.invalidateQueries({ queryKey: overviewQueryKey });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Falha ao anexar documento modelo."),
    onSettled: () => setReferenceUploadKey(null),
  });

  const deleteReferenceMutation = useMutation({
    mutationFn: (referenceFileId: string) =>
      invokeGrowObligations({
        action: "delete_reference_document",
        reference_file_id: referenceFileId,
      }),
    onSuccess: async (_, referenceFileId) => {
      toast.success("Documento modelo removido.");
      setTemplateForm((prev) => ({
        ...prev,
        expected_documents: prev.expected_documents.map((document) => {
          const nextRefs = (document.reference_files || []).filter((reference) => reference.id !== referenceFileId);
          return {
            ...document,
            reference_files: nextRefs,
            reference_files_count: nextRefs.length,
            has_active_reference: nextRefs.length > 0,
          };
        }),
      }));
      await queryClient.invalidateQueries({ queryKey: overviewQueryKey });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Falha ao remover documento modelo."),
  });

  const uploadQueueMutation = useMutation({
    mutationFn: async () => {
      if (uploadQueue.length === 0) {
        throw new Error("Adicione pelo menos um PDF antes de enviar.");
      }
      const results = [];
      for (const item of uploadQueue) {
        const validationError = validateUploadQueueItem(item);
        if (validationError) throw new Error(validationError);

        const path = buildSecureStoragePath(
          ["grow-obligations", item.client_id || item.preview?.match.detectedClientId || "sem-cliente", new Date().toISOString().slice(0, 7)],
          item.file.name,
        );

        const { error: uploadError } = await supabase.storage.from("obligation-files").upload(path, item.file, {
          contentType: item.file.type || undefined,
          upsert: false,
        });
        if (uploadError) throw uploadError;

        const response = await invokeGrowObligations<{
          ok: true;
          match: ReferenceMatchPreview["match"];
        }>({
          action: "register_document_upload",
          client_id: item.client_id || null,
          template_id: item.template_id || null,
          document_type_key: item.document_type_key || null,
          instance_id: item.instance_id || null,
          suggested_competence_label: item.suggested_competence_label || null,
          notes: item.notes || null,
          file_name: item.file.name,
          storage_bucket: "obligation-files",
          storage_path: path,
          content_type: item.file.type || "application/pdf",
          file_size: item.file.size,
          analysis: item.analysis,
        });
        results.push(response);
      }
      return results;
    },
    onSuccess: async (results) => {
      const autoLinked = results.filter((item) => !item.match.reviewRequired).length;
      toast.success(`${results.length} arquivo(s) enviados. ${autoLinked} com vinculo automatico.`);
      setUploadQueue([]);
      await queryClient.invalidateQueries({ queryKey: overviewQueryKey });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Falha ao enviar lote de documentos."),
  });

  const processQueueMutation = useMutation({
    mutationFn: () =>
      invokeGrowObligations<{
        ok: true;
        processed: number;
        total: number;
      }>({
        action: "process_document_queue",
        limit: 50,
      }),
    onSuccess: async (result) => {
      toast.success(`${result.processed} documento(s) processados automaticamente.`);
      await queryClient.invalidateQueries({ queryKey: overviewQueryKey });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Falha ao processar documentos vinculados."),
  });

  const templateValidationError = useMemo(() => validateTemplateForm(templateForm), [templateForm]);
  const uploadQueueValidationError = useMemo(
    () => uploadQueue.map((item) => validateUploadQueueItem(item)).find(Boolean) || null,
    [uploadQueue],
  );

  const filteredTemplates = useMemo(() => {
    const items = overview?.templates || [];
    const token = templateSearch.trim().toLowerCase();
    if (!token) return items;
    return items.filter((template) => `${template.name} ${template.sector}`.toLowerCase().includes(token));
  }, [overview?.templates, templateSearch]);

  const filteredInstances = useMemo(() => {
    const items = overview?.instances || [];
    const token = instanceSearch.trim().toLowerCase();
    return items.filter((instance) => {
      if (instanceStatusFilter !== "all" && instance.status !== instanceStatusFilter) return false;
      if (instanceClientFilter !== "all" && instance.client_id !== instanceClientFilter) return false;
      if (!token) return true;
      return `${instance.client?.name || ""} ${instance.template?.name || ""} ${instance.competence_label}`.toLowerCase().includes(token);
    });
  }, [instanceClientFilter, instanceSearch, instanceStatusFilter, overview?.instances]);

  const pendingDocuments = useMemo(
    () => (overview?.documents || []).filter((item) => item.status === "pending_review"),
    [overview?.documents],
  );

  const robotJobs = useMemo(
    () => (overview?.ingestion_jobs || []).filter((job) => job.source_kind === "local_robot"),
    [overview?.ingestion_jobs],
  );

  const robotRecentFailures = useMemo(
    () => robotJobs.filter((job) => job.status === "failed").slice(0, 6),
    [robotJobs],
  );

  const linkedDocumentsForProcessing = useMemo(
    () =>
      (overview?.documents || []).filter(
        (item) => item.status === "linked" && (item.processing_status === "queued" || item.processing_status === "failed"),
      ),
    [overview?.documents],
  );

  const documentInResolution = useMemo(
    () => pendingDocuments.find((item) => item.id === documentResolutionId) || null,
    [documentResolutionId, pendingDocuments],
  );

  const documentResolutionOptions = useMemo(() => {
    if (!documentInResolution) return overview?.instances || [];
    return (overview?.instances || []).filter((instance) => {
      const targetClientId = documentInResolution.detected_client_id || documentInResolution.client_id || documentInResolution.suggested_client_id;
      if (targetClientId && instance.client_id !== targetClientId) return false;
      if (documentInResolution.suggested_template_id && instance.template_id !== documentInResolution.suggested_template_id) return false;
      return true;
    });
  }, [documentInResolution, overview?.instances]);

  const allDocumentOptions = useMemo(
    () =>
      (overview?.templates || []).flatMap((template) =>
        template.expected_documents
          .filter((document) => document.active)
          .map((document) => ({
            optionKey: `${template.id}::${document.document_type_key}`,
            label: `${template.name} · ${document.label}`,
            templateId: template.id,
            documentTypeKey: document.document_type_key,
          })),
      ),
    [overview?.templates],
  );

  const activeTemplateClients = useMemo(
    () => (overview?.clients || []).filter((client) => client.status.toLowerCase() === "ativo"),
    [overview?.clients],
  );

  const filteredTemplateClients = useMemo(() => {
    const items = activeTemplateClients;
    const token = templateClientSearch.trim().toLowerCase();
    if (!token) return items;
    return items.filter((client) => `${client.name} ${client.cnpj || ""} ${client.regime || ""}`.toLowerCase().includes(token));
  }, [activeTemplateClients, templateClientSearch]);

  const templateClientsByRegime = useMemo(() => {
    const selectedIds = new Set(templateForm.linked_client_ids);

    return taxRegimeDefinitions
      .map((definition) => {
        const clientIds = activeTemplateClients
          .filter((client) => normalizeTaxRegime(client.tax_regime_code || client.regime) === definition.code)
          .map((client) => client.id);

        return {
          ...definition,
          clientIds,
          selectedCount: clientIds.filter((clientId) => selectedIds.has(clientId)).length,
        };
      })
      .filter((definition) => definition.clientIds.length > 0);
  }, [activeTemplateClients, templateForm.linked_client_ids]);

  function setTemplateRegimeClients(regimeCode: TaxRegimeCode, selected: boolean) {
    const targetClientIds = activeTemplateClients
      .filter((client) => normalizeTaxRegime(client.tax_regime_code || client.regime) === regimeCode)
      .map((client) => client.id);

    if (targetClientIds.length === 0) return;

    const targetSet = new Set(targetClientIds);
    setTemplateForm((prev) => ({
      ...prev,
      linked_client_ids: selected
        ? Array.from(new Set([...prev.linked_client_ids, ...targetClientIds]))
        : prev.linked_client_ids.filter((clientId) => !targetSet.has(clientId)),
    }));
  }

  async function runPreview(item: UploadQueueItem) {
    if (!item.file?.name) {
      setUploadQueue((prev) => prev.map((current) => (current.id === item.id ? { ...current, preview: null, previewError: "Arquivo invalido.", isPreviewing: false } : current)));
      return;
    }
    try {
      const preview = await invokeGrowObligations<ReferenceMatchPreview>({
        action: "preview_reference_match",
        client_id: item.client_id || null,
        template_id: item.template_id || null,
        document_type_key: item.document_type_key || null,
        instance_id: item.instance_id || null,
        suggested_competence_label: item.suggested_competence_label || null,
        file_name: item.file.name,
        analysis: item.analysis,
      });
      setUploadQueue((prev) =>
        prev.map((current) => (current.id === item.id ? applyPreviewAutofill(current, preview) : current)),
      );
    } catch (error) {
      setUploadQueue((prev) => prev.map((current) => (current.id === item.id ? { ...current, preview: null, previewError: error instanceof Error ? error.message : "Falha no preview.", isPreviewing: false } : current)));
    }
  }

  async function handleUploadFiles(files: FileList | File[]) {
    const list = Array.from(files);
    if (list.length === 0) return;
    const nextItems: UploadQueueItem[] = [];
    for (const file of list) {
      try {
        const validationError = validateSecureDocument(file);
        if (validationError) throw new Error(validationError);
        const analysis = await analyzePdfDocument(file);
        nextItems.push({
          id: `${Date.now()}-${file.name}-${Math.random().toString(16).slice(2, 8)}`,
          file,
          analysis,
          client_id: initialClientId || "",
          template_id: "",
          document_type_key: "",
          instance_id: "",
          suggested_competence_label: analysis.competence_detected || "",
          notes: "",
          preview: null,
          previewError: null,
          isPreviewing: true,
        });
      } catch (error) {
        toast.error(`${file.name}: ${error instanceof Error ? error.message : "Falha ao analisar o PDF."}`);
      }
    }

    setUploadQueue((prev) => [...prev, ...nextItems]);
    for (const item of nextItems) {
      void runPreview(item);
    }
  }

  function handleUploadDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  }

  function handleUploadDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDraggingUpload(false);
    if (event.dataTransfer.files?.length) {
      void handleUploadFiles(event.dataTransfer.files);
    }
  }

  function updateQueueItem(itemId: string, patch: Partial<UploadQueueItem>) {
    setUploadQueue((prev) => prev.map((item) => (item.id === itemId ? { ...item, ...patch, isPreviewing: true } : item)));
    const nextItem = uploadQueue.find((item) => item.id === itemId);
    if (!nextItem) return;
    void runPreview({ ...nextItem, ...patch, isPreviewing: true });
  }

  if (overviewQuery.isLoading) {
    return <div className="flex min-h-[40vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  if (overviewQuery.isError || !overview) {
    return (
      <Card className="rounded-3xl border-destructive/30">
        <CardHeader>
          <CardTitle>Falha ao carregar o módulo</CardTitle>
          <CardDescription>{overviewQuery.error instanceof Error ? overviewQuery.error.message : "Não foi possível consultar o domínio nativo da Grow."}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[2rem] border border-border/70 bg-card/95 p-6 shadow-sm">
        <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-r from-primary/8 via-primary/0 to-primary/10" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <Badge variant="secondary" className="rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.28em]">Grow Native</Badge>
            <div className="space-y-2">
              <h1 className="font-heading text-3xl font-bold tracking-tight">Obrigacoes Grow</h1>
              <p className="max-w-3xl text-sm text-muted-foreground">Domínio interno de obrigações, execução operacional e central de documentos com documentos modelo e matching por CNPJ.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" className="rounded-2xl" onClick={() => overviewQuery.refetch()}><RefreshCcw className="mr-2 h-4 w-4" />Atualizar visao</Button>
            <Button className="rounded-2xl" onClick={() => generateMutation.mutate()} disabled={generateMutation.isPending}>
              {generateMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CalendarClock className="mr-2 h-4 w-4" />}
              Gerar competências
            </Button>
          </div>
        </div>
      </section>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as WorkspaceTab)} className="space-y-4">
        <TabsList className="grid h-auto w-full grid-cols-2 rounded-2xl bg-muted/50 p-1">
          <TabsTrigger value="documentos" className="rounded-xl">Central de Documentos</TabsTrigger>
          <TabsTrigger value="catalogo" className="rounded-xl">Catalogo</TabsTrigger>
        </TabsList>

        <TabsContent value="catalogo" className="space-y-4">
          <Card className="rounded-3xl">
            <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div><CardTitle>Catalogo mestre</CardTitle><CardDescription>Cadastre os documentos esperados e anexe PDFs modelo para habilitar o envio inteligente.</CardDescription></div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Input value={templateSearch} onChange={(event) => setTemplateSearch(event.target.value)} placeholder="Buscar por nome ou setor" className="w-full sm:w-72" />
                <Button
                  className="rounded-2xl"
                  onClick={() => {
                    setTemplateForm(makeTemplateForm());
                    setTemplateClientSearch("");
                    setTemplateDialogOpen(true);
                  }}
                ><Plus className="mr-2 h-4 w-4" />Nova obrigação</Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {filteredTemplates.map((template) => (
                <div key={template.id} className="rounded-2xl border border-border/70 p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{template.name}</p>
                        <Badge variant="outline">{template.sector}</Badge>
                        {!template.is_active && <Badge variant="destructive">Inativa</Badge>}
                      </div>
                      <p className="text-sm text-muted-foreground">{growPeriodicityLabel[template.periodicity]} · vencimento técnico no dia {template.due_day} · mês base {growCompetenceReferenceLabel[template.competence_reference]}</p>
                      <div className="flex flex-wrap gap-2">
                        {template.expected_documents.map((document) => (
                          <Badge key={`${template.id}-${document.document_type_key}`} variant={document.has_active_reference ? "default" : "outline"}>
                            {document.label} · {document.reference_files_count || 0} modelo(s)
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      className="rounded-2xl"
                      onClick={() => {
                        setTemplateForm({
                          ...makeTemplateForm(template),
                          linked_client_ids: buildTemplateLinkedClientIds(overview?.profiles, template.id),
                        });
                        setTemplateClientSearch("");
                        setTemplateDialogOpen(true);
                      }}
                    >Editar</Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="execucao" className="space-y-4">
          <Card className="rounded-3xl">
            <CardHeader className="space-y-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div><CardTitle>Fila operacional</CardTitle><CardDescription>Competências geradas por cliente com integração automática ao calendário e ao kanban quando configurado.</CardDescription></div>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Input value={instanceSearch} onChange={(event) => setInstanceSearch(event.target.value)} placeholder="Buscar cliente, obrigação ou competência" className="sm:w-72" />
                  <Select value={instanceStatusFilter} onValueChange={setInstanceStatusFilter}>
                    <SelectTrigger className="sm:w-52"><SelectValue placeholder="Status" /></SelectTrigger>
                    <SelectContent><SelectItem value="all">Todos os status</SelectItem>{statusOptions.map((status) => <SelectItem key={status} value={status}>{growObligationStatusLabel[status]}</SelectItem>)}</SelectContent>
                  </Select>
                  <Select value={instanceClientFilter} onValueChange={setInstanceClientFilter}>
                    <SelectTrigger className="sm:w-64"><SelectValue placeholder="Cliente" /></SelectTrigger>
                    <SelectContent><SelectItem value="all">Todos os clientes</SelectItem>{overview.clients.map((client) => <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {filteredInstances.map((instance) => (
                <div key={instance.id} className="rounded-2xl border border-border/70 p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{instance.template?.name || "Obrigacao"}</p>
                        <Badge className={`border-0 ${growObligationStatusClass[instance.status]}`}>{growObligationStatusLabel[instance.status]}</Badge>
                        <Badge variant="outline">{growPriorityLabel[instance.priority]}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{instance.client?.name || "Cliente"} · competência {instance.competence_label}</p>
                      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                        <span>Vencimento técnico: {formatDate(instance.technical_due_date)}</span>
                        <span>Vencimento legal: {formatDate(instance.legal_due_date)}</span>
                        <span>Documento: {instance.document_required ? "obrigatorio" : "opcional"}</span>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      className="rounded-2xl"
                      disabled={instance.status === "concluida"}
                      onClick={() => { setInstanceForm(makeInstanceForm(instance)); setInstanceDialogOpen(true); }}
                    >
                      {instance.status === "concluida" ? "Concluida por documento" : "Atualizar execucao"}
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documentos" className="space-y-4">
          <Card className="rounded-3xl">
            <CardHeader>
              <CardTitle>Central de Documentos</CardTitle>
              <CardDescription>Arraste ou selecione PDFs para enviar.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div className="hidden">
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">Modo web</Badge>
                      <p className="text-sm font-medium">Funciona sem instalar nada</p>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Arraste os PDFs aqui, revise o preview e envie. O backend continua cuidando de vinculo, protocolo, conclusao e publicacao no portal.
                    </p>
                  </div>
                  <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">Modo robo local</Badge>
                      <p className="text-sm font-medium">Automacao continua no Windows</p>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Use esse modo quando quiser que uma pasta monitorada envie PDFs sozinha, sem depender da tela aberta.
                    </p>
                  </div>
                </div>
                <div
                  className={`min-h-[280px] rounded-3xl border border-dashed p-8 transition-colors ${
                    isDraggingUpload
                      ? "border-primary bg-primary/10 shadow-sm"
                      : "border-primary/30 bg-primary/5"
                  }`}
                  onDragEnter={(event) => {
                    event.preventDefault();
                    setIsDraggingUpload(true);
                  }}
                  onDragLeave={(event) => {
                    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                      setIsDraggingUpload(false);
                    }
                  }}
                  onDragOver={handleUploadDragOver}
                  onDrop={handleUploadDrop}
                  onClick={() => uploadInputRef.current?.click()}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      uploadInputRef.current?.click();
                    }
                  }}
                >
                  <div className="flex min-h-[220px] flex-col items-center justify-center gap-4 text-center">
                    <UploadCloud className="h-12 w-12 text-primary" />
                    <div>
                      <p className="text-lg font-medium">{isDraggingUpload ? "Solte os PDFs para adicionar" : "Arraste PDFs aqui"}</p>
                      <p className="mt-1 text-sm text-muted-foreground">PDFs serão adicionados à fila de envio.</p>
                    </div>
                    <input
                      ref={uploadInputRef}
                      type="file"
                      accept="application/pdf"
                      multiple
                      className="hidden"
                      onChange={(event) => {
                        if (event.target.files) {
                          void handleUploadFiles(event.target.files);
                        }
                        event.currentTarget.value = "";
                      }}
                    />
                    <Button type="button" variant="outline" className="rounded-2xl" onClick={(event) => {
                      event.stopPropagation();
                      uploadInputRef.current?.click();
                    }}>
                      <UploadCloud className="mr-2 h-4 w-4" />
                      Escolher arquivos
                    </Button>
                  </div>
                </div>

                <div className="hidden">
                  <div>
                    <p className="text-sm font-medium">Pós-processamento operacional</p>
                    <p className="text-xs text-muted-foreground">
                      {linkedDocumentsForProcessing.length} documento(s) vinculados aguardando aplicação automática. No modo web, isso só aparece quando algum item precisa de reprocessamento ou revisão complementar.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    className="rounded-2xl"
                    onClick={() => processQueueMutation.mutate()}
                    disabled={processQueueMutation.isPending || linkedDocumentsForProcessing.length === 0}
                  >
                    {processQueueMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                    Processar documentos vinculados
                  </Button>
                </div>

                {showLocalRobotPanel && (
                <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">RobÃ´ local Grow</p>
                      <p className="text-xs text-muted-foreground">Fila de ingestÃ£o contÃ­nua para pastas monitoradas no Windows.</p>
                    </div>
                    <Badge variant="secondary">{robotJobs.length} job(s)</Badge>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-xl border bg-background/80 p-3">
                      <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Recebidos hoje</p>
                      <p className="mt-2 text-2xl font-semibold">{overview.summary.robot_received_today}</p>
                    </div>
                    <div className="rounded-xl border bg-background/80 p-3">
                      <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Concluidos hoje</p>
                      <p className="mt-2 text-2xl font-semibold">{overview.summary.robot_completed_today}</p>
                    </div>
                    <div className="rounded-xl border bg-background/80 p-3">
                      <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Em revisao</p>
                      <p className="mt-2 text-2xl font-semibold">{overview.summary.robot_review_required}</p>
                    </div>
                    <div className="rounded-xl border bg-background/80 p-3">
                      <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Falhas</p>
                      <p className="mt-2 text-2xl font-semibold">{overview.summary.robot_failed_total}</p>
                    </div>
                  </div>
                  <div className="rounded-xl border bg-background/80 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium">Como ativar o robÃ´ na operaÃ§Ã£o</p>
                        <p className="text-xs text-muted-foreground">Guia curto para deixar a ingestÃ£o contÃ­nua funcionando sem depender da tela aberta.</p>
                      </div>
                      <Badge variant="outline">Automacao controlada</Badge>
                    </div>
                    <div className="mt-4 grid gap-3 lg:grid-cols-3">
                      <div className="rounded-xl border border-dashed p-3">
                        <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Entrada</p>
                        <p className="mt-2 text-sm font-medium">C:/Grow/Entrada-eContinuo</p>
                        <p className="mt-1 text-xs text-muted-foreground">O colaborador so precisa salvar o PDF nessa pasta. O robÃ´ detecta sozinho.</p>
                      </div>
                      <div className="rounded-xl border border-dashed p-3">
                        <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Config local</p>
                        <p className="mt-2 text-sm font-medium">tools/grow-document-robot/runtime/config.local.json</p>
                        <p className="mt-1 text-xs text-muted-foreground">Esse arquivo guarda maquina, pasta monitorada, credenciais e estado local do robÃ´.</p>
                      </div>
                      <div className="rounded-xl border border-dashed p-3">
                        <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Execucao</p>
                        <p className="mt-2 text-sm font-medium">npm.cmd run robot:start</p>
                        <p className="mt-1 text-xs text-muted-foreground">O backend classifica, conclui a obrigaÃ§Ã£o, gera protocolo e publica no portal quando houver match confiavel.</p>
                      </div>
                    </div>
                    <div className="mt-4 rounded-xl bg-muted/50 p-3 text-xs text-muted-foreground">
                      Se o documento nao for confiavel o bastante, ele nao conclui sozinho: cai em triagem manual para evitar erro operacional e fraude.
                    </div>
                  </div>
                  {robotRecentFailures.length > 0 ? (
                    <div className="space-y-2">
                      {robotRecentFailures.map((job) => (
                        <div key={job.id} className="rounded-xl border bg-background/80 p-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-sm font-medium">{job.file_name}</p>
                            <div className="flex flex-wrap gap-2">
                              <Badge variant="outline">{classificationStatusLabel(job.classification_status)}</Badge>
                              <Badge variant="outline">{job.status}</Badge>
                            </div>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {job.robot_machine_id || "maquina nao informada"} Â· {job.robot_origin_path || "origem local nao informada"} Â· {formatDateTime(job.created_at)}
                          </p>
                          {job.last_error ? <p className="mt-2 text-xs text-destructive">{job.last_error}</p> : null}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">Nenhuma falha recente do robÃ´ local.</p>
                  )}
                </div>

                )}

                <div className="space-y-3">
                  {uploadQueue.map((item) => {
                    const queueInstances = overview.instances.filter((instance) => {
                      const filterClientId = item.client_id || item.preview?.match.detectedClientId || "";
                      if (filterClientId && instance.client_id !== filterClientId) return false;
                      if (item.template_id && instance.template_id !== item.template_id) return false;
                      return true;
                    });

                    return (
                      <div key={item.id} className="rounded-3xl border border-border/70 p-4">
                        <div className="flex flex-col gap-4">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <p className="font-medium">{item.file.name}</p>
                              <p className="text-xs text-muted-foreground">
                                CNPJ: {item.analysis.detected_cnpj || "não detectado"} · Competência: {item.analysis.competence_detected || "não detectada"} · OCR: {item.analysis.ocr_status}
                              </p>
                            </div>
                            <Button variant="ghost" size="icon" className="rounded-xl text-destructive" onClick={() => setUploadQueue((prev) => prev.filter((current) => current.id !== item.id))}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>

                          <div className="grid gap-3 md:grid-cols-2">
                            <div className="space-y-2">
                              <Label>Cliente (auxilio manual)</Label>
                              <Select value={item.client_id || "none"} onValueChange={(value) => updateQueueItem(item.id, { client_id: value === "none" ? "" : value, instance_id: "" })}>
                                <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
                                <SelectContent><SelectItem value="none">Sem cliente manual</SelectItem>{overview.clients.map((client) => <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>)}</SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label>Documento esperado (auxilio manual)</Label>
                              <Select value={item.document_type_key ? `${item.template_id}::${item.document_type_key}` : "none"} onValueChange={(value) => {
                                if (value === "none") {
                                  updateQueueItem(item.id, { template_id: "", document_type_key: "", instance_id: "" });
                                  return;
                                }
                                const [templateId, documentTypeKey] = value.split("::");
                                updateQueueItem(item.id, { template_id: templateId, document_type_key: documentTypeKey, instance_id: "" });
                              }}>
                                <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
                                <SelectContent><SelectItem value="none">Sem documento manual</SelectItem>{allDocumentOptions.map((option) => <SelectItem key={option.optionKey} value={option.optionKey}>{option.label}</SelectItem>)}</SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label>Instancia opcional</Label>
                              <Select value={item.instance_id || "none"} onValueChange={(value) => updateQueueItem(item.id, { instance_id: value === "none" ? "" : value })}>
                                <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
                                <SelectContent><SelectItem value="none">Sem instancia manual</SelectItem>{queueInstances.map((instance) => <SelectItem key={instance.id} value={instance.id}>{buildInstanceLabel(instance)}</SelectItem>)}</SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label>Competencia sugerida</Label>
                              <Input value={item.suggested_competence_label} onChange={(event) => updateQueueItem(item.id, { suggested_competence_label: event.target.value })} />
                            </div>
                          </div>

                          <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
                            <div className="flex items-start gap-3">
                              <Sparkles className="mt-0.5 h-4 w-4 text-primary" />
                              <div className="space-y-2 text-sm">
                                <p className="font-medium">Preview do roteamento</p>
                                {item.isPreviewing ? (
                                  <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Calculando melhor destino...</div>
                                ) : item.preview ? (
                                  <>
                                    <div className="flex flex-wrap gap-2">
                                      <Badge variant={item.preview.match.reviewRequired ? "secondary" : "default"}>{item.preview.match.reviewRequired ? "Aguardando revisão" : "Vínculo automático"}</Badge>
                                      <Badge variant="outline">{matchStrategyLabel(item.preview.match.strategy)}</Badge>
                                      <Badge variant="outline">Score {item.preview.match.score.toFixed(2)}</Badge>
                                    </div>
                                    <p className="text-muted-foreground">{item.preview.match.reasons.join(" · ")}</p>
                                    {item.preview.match.autoLinkBlockReason && <p className="text-xs text-orange-600">{item.preview.match.autoLinkBlockReason}</p>}
                                  </>
                                ) : (
                                  <p className="text-destructive">{item.previewError || "Não foi possível gerar preview."}</p>
                                )}
                              </div>
                            </div>
                          </div>

                          <Textarea value={item.notes} onChange={(event) => setUploadQueue((prev) => prev.map((current) => current.id === item.id ? { ...current, notes: event.target.value } : current))} placeholder="Observacoes internas" rows={2} />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {uploadQueueValidationError && (
                  <p className="text-sm text-orange-600">{uploadQueueValidationError}</p>
                )}
                <Button
                  className={`rounded-2xl ${uploadQueue.length === 0 ? "hidden" : ""}`}
                  onClick={() => uploadQueueMutation.mutate()}
                  disabled={uploadQueueMutation.isPending || uploadQueue.length === 0 || Boolean(uploadQueueValidationError)}
                >
                  {uploadQueueMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FolderUp className="mr-2 h-4 w-4" />}
                  Enviar lote para a central
                </Button>
              </div>

              <div className="hidden">
                <div className="rounded-3xl border p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <div><p className="text-sm font-medium">Triagem pendente</p><p className="text-xs text-muted-foreground">{pendingDocuments.length} documentos aguardando analise</p></div>
                    <Badge variant="secondary">{overview.summary.inbox_pending}</Badge>
                  </div>
                  <div className="space-y-3">
                    {pendingDocuments.map((item) => (
                      <div key={item.id} className="rounded-2xl border border-border/60 p-3">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-medium">{item.file_name}</p>
                            <Badge variant="outline">Score {item.reference_match_score.toFixed(2)}</Badge>
                            <Badge variant="outline">{matchStrategyLabel(item.matched_by)}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">Cliente: {item.detected_client?.name || item.client?.name || "não identificado"} · CNPJ: {item.detected_cnpj || "não detectado"} · Documento: {item.document_definition?.label || item.document_type_key || "não identificado"}</p>
                          {item.auto_link_block_reason && <p className="text-[11px] text-orange-600">{item.auto_link_block_reason}</p>}
                          <p className="text-[11px] text-muted-foreground">{item.reference_match_reasons.join(" · ")}</p>
                          {item.execution_notes && <p className="text-[11px] text-muted-foreground">{item.execution_notes}</p>}
                          <div className="flex flex-wrap gap-2">
                            <Badge variant="outline">{classificationStatusLabel(item.classification_status)}</Badge>
                            <Badge variant="outline">{processingStatusLabel(item.processing_status)}</Badge>
                            <Badge variant="outline">{executionStatusLabel(item.execution_status)}</Badge>
                            <Button variant="outline" size="sm" className="rounded-xl" onClick={() => { setDocumentResolutionId(item.id); setDocumentResolutionInstanceId(item.linked_instance?.id || ""); setDocumentResolutionNotes(item.notes || ""); }}>Revisar vinculo</Button>
                            <Button variant="ghost" size="sm" className="rounded-xl text-destructive" onClick={() => documentResolveMutation.mutate({ inboxItemId: item.id, decision: "reject", notes: "Documento rejeitado manualmente." })}>Rejeitar</Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-3xl border p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <div><p className="text-sm font-medium">Ultimos documentos</p><p className="text-xs text-muted-foreground">Historico recente da central interna</p></div>
                    <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="space-y-3">
                    {overview.documents.slice(0, 8).map((item) => (
                      <div key={item.id} className="rounded-2xl border border-border/60 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1">
                            <p className="text-sm font-medium">{item.file_name}</p>
                            <p className="text-xs text-muted-foreground">{item.detected_client?.name || item.client?.name || "Sem cliente"} · {item.document_definition?.label || item.document_type_key || "Sem documento"}</p>
                            <p className="text-[11px] text-muted-foreground">{matchStrategyLabel(item.matched_by)} · {formatDateTime(item.created_at)}</p>
                            {item.execution_notes && <p className="text-[11px] text-muted-foreground">{item.execution_notes}</p>}
                            {item.archive_path && <p className="text-[11px] text-muted-foreground">Arquivo lógico: {item.archive_path}</p>}
                            {item.protocol_number && <p className="text-[11px] text-muted-foreground">Protocolo: {item.protocol_number}</p>}
                            <p className="text-[11px] text-muted-foreground">
                              Origem: {item.source_kind === "local_robot" ? "Robô local" : item.source_kind === "api" ? "API" : "Central web"} · Comunicação: {communicationStatusLabel(item.communication_status)} · Publicação: {publicationStatusLabel(item.publication_status)}
                            </p>
                            {item.last_processing_error && <p className="text-[11px] text-destructive">{item.last_processing_error}</p>}
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <Badge variant={item.status === "linked" ? "default" : item.status === "rejected" ? "destructive" : "secondary"}>{inboxStatusLabel(item.status)}</Badge>
                            <Badge variant="outline">{classificationStatusLabel(item.classification_status)}</Badge>
                            <Badge variant="outline">{processingStatusLabel(item.processing_status)}</Badge>
                            <Badge variant="outline">{executionStatusLabel(item.execution_status)}</Badge>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
        <DialogContent className="max-h-[92vh] max-w-6xl overflow-y-auto p-0">
          <DialogHeader className="border-b border-border/70 bg-muted/20 px-6 py-5">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
                <ClipboardList className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <DialogTitle className="text-xl">{templateForm.id ? "Editar obrigação" : "Nova obrigação"}</DialogTitle>
                <DialogDescription>Configure prazos, automacoes, clientes e documentos esperados em secoes recolhiveis.</DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <details open className="group mx-6 mt-5 rounded-xl border border-border/70 bg-card p-4 shadow-sm">
            <summary className="mb-4 flex cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
              <div className="flex items-center gap-2">
                <Settings2 className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold">Dados principais</h3>
              </div>
              <span className="text-xs text-muted-foreground group-open:hidden">Expandir</span>
              <span className="text-xs text-muted-foreground group-open:inline hidden">Recolher</span>
            </summary>
            <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2"><Label>Nome</Label><Input value={templateForm.name} onChange={(event) => setTemplateForm((prev) => ({ ...prev, name: event.target.value }))} /></div>
            <div className="space-y-2"><Label>Setor</Label><Select value={templateForm.sector} onValueChange={(value) => setTemplateForm((prev) => ({ ...prev, sector: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{sectors.map((sector) => <SelectItem key={sector} value={sector}>{sector}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>Periodicidade</Label><Select value={templateForm.periodicity} onValueChange={(value) => setTemplateForm((prev) => ({ ...prev, periodicity: value as GrowObligationTemplate["periodicity"] }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{periodicities.map((periodicity) => <SelectItem key={periodicity} value={periodicity}>{growPeriodicityLabel[periodicity]}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>Mes base</Label><Select value={templateForm.competence_reference} onValueChange={(value) => setTemplateForm((prev) => ({ ...prev, competence_reference: value as GrowObligationTemplate["competence_reference"] }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="vigente">{growCompetenceReferenceLabel.vigente}</SelectItem><SelectItem value="anterior">{growCompetenceReferenceLabel.anterior}</SelectItem></SelectContent></Select></div>
            <div className="space-y-2">
              <Label>Dia do vencimento técnico</Label>
              <div className="grid gap-2 sm:grid-cols-[120px_1fr]">
                <Input
                  value={templateForm.due_day}
                  onChange={(event) => setTemplateForm((prev) => ({ ...prev, due_day: event.target.value }))}
                  placeholder="Dia"
                  inputMode="numeric"
                />
                <Select
                  value={templateForm.technical_due_month_reference}
                  onValueChange={(value) =>
                    setTemplateForm((prev) => ({
                      ...prev,
                      technical_due_month_reference: value as GrowObligationTemplate["technical_due_month_reference"],
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="vigente">{growDueMonthReferenceLabel.vigente}</SelectItem>
                    <SelectItem value="anterior">{growDueMonthReferenceLabel.anterior}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2"><Label>Prioridade</Label><Select value={templateForm.priority} onValueChange={(value) => setTemplateForm((prev) => ({ ...prev, priority: value as GrowObligationInstance["priority"] }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{priorities.map((priority) => <SelectItem key={priority} value={priority}>{growPriorityLabel[priority]}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>Dia do vencimento legal</Label><Input value={templateForm.legal_due_day} onChange={(event) => setTemplateForm((prev) => ({ ...prev, legal_due_day: event.target.value }))} /></div>
            <div className="space-y-2 md:col-span-2"><Label>Observacoes operacionais</Label><Textarea value={templateForm.operational_notes} onChange={(event) => setTemplateForm((prev) => ({ ...prev, operational_notes: event.target.value }))} rows={3} /></div>
            </div>
          </details>

          <details className="group mx-6 mt-4 space-y-4 rounded-xl border border-border/70 bg-card p-4 shadow-sm">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 [&::-webkit-details-marker]:hidden">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
                  <MessageCircle className="h-4 w-4" />
                </div>
                <div>
                  <Label>WhatsApp automatico ao concluir</Label>
                  <p className="text-xs text-muted-foreground">
                    Dispara automaticamente para clientes com opt-in no cadastro quando a obrigação for concluída por documento válido.
                  </p>
                </div>
              </div>
              <span className="ml-auto text-xs text-muted-foreground group-open:hidden">Expandir</span>
              <span className="ml-auto hidden text-xs text-muted-foreground group-open:inline">Recolher</span>
              <input
                className="h-4 w-4 accent-primary"
                type="checkbox"
                onClick={(event) => event.stopPropagation()}
                checked={templateForm.completion_whatsapp_enabled}
                onChange={(event) =>
                  setTemplateForm((prev) => ({
                    ...prev,
                    completion_whatsapp_enabled: event.target.checked,
                  }))
                }
              />
            </summary>
            <div className="space-y-2">
              <Label>Mensagem padrao</Label>
              <Textarea
                value={templateForm.completion_whatsapp_body}
                onChange={(event) => setTemplateForm((prev) => ({ ...prev, completion_whatsapp_body: event.target.value }))}
                rows={6}
                placeholder={"Olá, {{cliente_nome}}.\n\nA obrigação {{obrigacao_nome}} referente à competência {{competencia}} foi concluída.\n\nSetor responsável: {{setor}}.\nPrazo técnico: {{prazo_tecnico}}."}
                disabled={!templateForm.completion_whatsapp_enabled}
              />
            </div>
            <div className="rounded-xl border border-border/60 bg-muted/30 p-3 text-xs text-muted-foreground">
              O número não é configurado aqui. A Grow usa primeiro `Cadastro Clientes &gt; WhatsApp` e, se estiver vazio, usa o telefone principal do cliente.
            </div>
          </details>

          <details className="group mx-6 mt-4 space-y-4 rounded-xl border border-border/70 bg-card p-4 shadow-sm">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 [&::-webkit-details-marker]:hidden">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
                  <Mail className="h-4 w-4" />
                </div>
                <div>
                  <Label>E-mail automatico ao concluir</Label>
                  <p className="text-xs text-muted-foreground">
                    Dispara automaticamente para o e-mail do cliente quando a obrigação for concluída por documento válido.
                  </p>
                </div>
              </div>
              <span className="ml-auto text-xs text-muted-foreground group-open:hidden">Expandir</span>
              <span className="ml-auto hidden text-xs text-muted-foreground group-open:inline">Recolher</span>
              <input
                className="h-4 w-4 accent-primary"
                type="checkbox"
                onClick={(event) => event.stopPropagation()}
                checked={templateForm.completion_email_enabled}
                onChange={(event) =>
                  setTemplateForm((prev) => ({
                    ...prev,
                    completion_email_enabled: event.target.checked,
                  }))
                }
              />
            </summary>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label>Assunto padrao</Label>
                <Input
                  value={templateForm.completion_email_subject}
                  onChange={(event) => setTemplateForm((prev) => ({ ...prev, completion_email_subject: event.target.value }))}
                  placeholder="Ex.: {{obrigacao_nome}} concluída - {{competencia}}"
                  disabled={!templateForm.completion_email_enabled}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Corpo padrao</Label>
                <Textarea
                  value={templateForm.completion_email_body}
                  onChange={(event) => setTemplateForm((prev) => ({ ...prev, completion_email_body: event.target.value }))}
                  rows={6}
                  placeholder={"Olá, {{cliente_nome}}.\n\nA obrigação {{obrigacao_nome}} referente à competência {{competencia}} foi concluída.\n\nSetor responsável: {{setor}}.\nPrazo técnico: {{prazo_tecnico}}."}
                  disabled={!templateForm.completion_email_enabled}
                />
              </div>
            </div>
            <div className="rounded-xl border border-border/60 bg-muted/30 p-3 text-xs text-muted-foreground">
              {"Placeholders disponíveis: {{cliente_nome}}, {{obrigacao_nome}}, {{competencia}}, {{setor}}, {{prazo_tecnico}}."}
            </div>
          </details>

          <details className="group mx-6 mt-4 space-y-4 rounded-xl border border-border/70 bg-card p-4 shadow-sm">
            <summary className="flex cursor-pointer list-none flex-col gap-3 lg:flex-row lg:items-center lg:justify-between [&::-webkit-details-marker]:hidden">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
                  <Users className="h-4 w-4" />
                </div>
                <div>
                  <Label>Clientes vinculados</Label>
                  <p className="text-xs text-muted-foreground">
                    Selecione apenas clientes ativos. Use os atalhos por tributacao para marcar grupos em massa.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground group-open:hidden">Expandir</span>
                <span className="hidden text-xs text-muted-foreground group-open:inline">Recolher</span>
              </div>
              <div className="w-full lg:w-80" onClick={(event) => event.stopPropagation()}>
                <Input
                  value={templateClientSearch}
                  onChange={(event) => setTemplateClientSearch(event.target.value)}
                  placeholder="Buscar cliente por nome ou CNPJ"
                />
              </div>
            </summary>
            <div className="rounded-xl border border-border/60 bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">
                {templateForm.linked_client_ids.length} cliente(s) ativo(s) selecionado(s) para vinculo automatico.
              </p>
            </div>
            {templateClientsByRegime.length > 0 ? (
              <div className="grid gap-2 rounded-xl border border-border/60 bg-background/70 p-3 md:grid-cols-2 xl:grid-cols-4">
                {templateClientsByRegime.map((regime) => (
                  <div key={regime.code} className="space-y-2 rounded-lg border border-border/50 bg-muted/20 p-3">
                    <div>
                      <p className="text-sm font-medium">{regime.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {regime.selectedCount}/{regime.clientIds.length} selecionado(s)
                      </p>
                    </div>
                    <div className="grid gap-2">
                      <Button type="button" variant="outline" size="sm" className="justify-start rounded-lg" onClick={() => setTemplateRegimeClients(regime.code, true)}>
                        Selecionar todos: {regime.label}
                      </Button>
                      <Button type="button" variant="ghost" size="sm" className="justify-start rounded-lg text-muted-foreground" onClick={() => setTemplateRegimeClients(regime.code, false)}>
                        Limpar {regime.label}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="rounded-xl border border-border/60 bg-muted/20 p-3 text-xs text-muted-foreground">
                Nenhum cliente ativo com tributação informada para seleção em massa.
              </p>
            )}
            <div className="grid max-h-72 gap-2 overflow-y-auto md:grid-cols-2">
              {filteredTemplateClients.map((client) => {
                const checked = templateForm.linked_client_ids.includes(client.id);
                return (
                  <label
                    key={client.id}
                    className="flex items-start justify-between gap-3 rounded-xl border border-border/60 bg-background/70 p-3 text-sm transition-colors hover:border-primary/40 hover:bg-muted/20"
                  >
                    <div className="space-y-1">
                      <p className="font-medium">{client.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {client.cnpj || "Sem CNPJ"} · {client.regime || "Sem tributação"} · {client.sector || "Sem setor"}
                      </p>
                    </div>
                    <input
                      className="mt-1 h-4 w-4 accent-primary"
                      type="checkbox"
                      checked={checked}
                      onChange={(event) =>
                        setTemplateForm((prev) => ({
                          ...prev,
                          linked_client_ids: event.target.checked
                            ? [...prev.linked_client_ids, client.id]
                            : prev.linked_client_ids.filter((clientId) => clientId !== client.id),
                        }))
                      }
                    />
                  </label>
                );
              })}
            </div>
            {filteredTemplateClients.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhum cliente encontrado para este filtro.</p>
            ) : null}
          </details>

          <details className="group mx-6 mt-4 space-y-4 rounded-xl border border-border/70 bg-card p-4 shadow-sm">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                <Label>Documentos esperados</Label>
              </div>
              <span className="ml-auto text-xs text-muted-foreground group-open:hidden">Expandir</span>
              <span className="ml-auto hidden text-xs text-muted-foreground group-open:inline">Recolher</span>
              <Button type="button" variant="outline" className="rounded-xl" onClick={(event) => { event.stopPropagation(); setTemplateForm((prev) => ({ ...prev, expected_documents: [...prev.expected_documents, makeDocumentDraft()] })); }}><Plus className="mr-2 h-4 w-4" />Adicionar documento esperado</Button>
            </summary>
            {templateForm.expected_documents.map((document, index) => (
              <div key={`${document.document_type_key || "novo"}-${index}`} className="rounded-xl border border-border/60 bg-background/70 p-4">
                <div className="grid gap-3 md:grid-cols-[1fr_1fr_120px_auto]">
                  <div className="space-y-2"><Label>Nome</Label><Input value={document.label} onChange={(event) => setTemplateForm((prev) => ({ ...prev, expected_documents: prev.expected_documents.map((current, currentIndex) => currentIndex === index ? { ...current, label: event.target.value, document_type_key: current.document_type_key || slugifyDocumentKey(event.target.value) } : current) }))} /></div>
                  <div className="space-y-2"><Label>Apelidos</Label><Input value={document.aliases_text} onChange={(event) => setTemplateForm((prev) => ({ ...prev, expected_documents: prev.expected_documents.map((current, currentIndex) => currentIndex === index ? { ...current, aliases_text: event.target.value } : current) }))} placeholder="folha, pagamento, holerite" /></div>
                  <div className="space-y-3">
                    <label className="flex items-center justify-between gap-4 text-sm"><span>Obrigatorio</span><input className="h-4 w-4 accent-primary" type="checkbox" checked={document.required} onChange={(event) => setTemplateForm((prev) => ({ ...prev, expected_documents: prev.expected_documents.map((current, currentIndex) => currentIndex === index ? { ...current, required: event.target.checked } : current) }))} /></label>
                    <label className="flex items-center justify-between gap-4 text-sm"><span>Ativo</span><input className="h-4 w-4 accent-primary" type="checkbox" checked={document.active} onChange={(event) => setTemplateForm((prev) => ({ ...prev, expected_documents: prev.expected_documents.map((current, currentIndex) => currentIndex === index ? { ...current, active: event.target.checked } : current) }))} /></label>
                  </div>
                  <div className="flex items-start justify-end">
                    <Button type="button" variant="ghost" size="icon" className="rounded-xl text-destructive" onClick={() => setTemplateForm((prev) => ({ ...prev, expected_documents: prev.expected_documents.length <= 1 ? [makeDocumentDraft()] : prev.expected_documents.filter((_, currentIndex) => currentIndex !== index) }))}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>

                <div className="mt-4 space-y-3 rounded-xl border border-dashed border-border/60 bg-muted/20 p-4">
                  <div className="flex items-center justify-between">
                    <div><p className="text-sm font-medium">Documentos modelo</p><p className="text-xs text-muted-foreground">{document.reference_files_count || 0} arquivo(s) de referencia anexados</p></div>
                    <Input
                      type="file"
                      accept="application/pdf"
                      disabled={!templateForm.id || !document.document_type_key || referenceUploadKey === `${index}`}
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (!file || !templateForm.id || !document.document_type_key) return;
                        setReferenceUploadKey(`${index}`);
                        uploadReferenceMutation.mutate({
                          templateId: templateForm.id,
                          documentTypeKey: document.document_type_key,
                          file,
                        });
                      }}
                    />
                  </div>
                  {(document.reference_files || []).length > 0 ? (
                    <div className="space-y-2">
                      {(document.reference_files || []).map((reference) => (
                        <div key={reference.id} className="flex items-center justify-between rounded-2xl border border-border/60 bg-background/70 p-3">
                          <div className="space-y-1">
                            <p className="text-sm font-medium">{reference.file_name}</p>
                            <p className="text-xs text-muted-foreground">Texto: {reference.text_extraction_status} · OCR: {reference.ocr_status}</p>
                          </div>
                          <Button variant="ghost" size="icon" className="rounded-xl text-destructive" onClick={() => deleteReferenceMutation.mutate(reference.id)}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">{templateForm.id ? "Anexe pelo menos um PDF modelo para habilitar o matching automatico." : "Salve o template para anexar PDFs modelo."}</p>
                  )}
                </div>
              </div>
            ))}
          </details>

          <details className="group mx-6 my-4 rounded-xl border border-border/70 bg-muted/20 p-4">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
              <p className="flex items-center gap-2 text-sm font-medium"><CheckCircle2 className="h-4 w-4 text-primary" />Regras fixas da obrigação</p>
              <span className="text-xs text-muted-foreground group-open:hidden">Expandir</span>
              <span className="hidden text-xs text-muted-foreground group-open:inline">Recolher</span>
            </summary>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">
                Toda obrigação gera tarefa automática para o setor, entra no calendário e exige documento anexado.
              </p>
            </div>
            <div className="grid gap-2 text-sm text-muted-foreground">
              <label className="flex items-center justify-between gap-4 text-sm">
                <span>Template ativo</span>
                <input
                  className="h-4 w-4 accent-primary"
                  type="checkbox"
                  checked={templateForm.is_active}
                  onChange={(event) => setTemplateForm((prev) => ({ ...prev, is_active: event.target.checked }))}
                />
              </label>
              <div className="flex items-center justify-between"><span>Tarefa no setor</span><span>Sempre</span></div>
              <div className="flex items-center justify-between"><span>Calendário</span><span>Sempre</span></div>
              <div className="flex items-center justify-between"><span>Documento anexado</span><span>Obrigatório</span></div>
            </div>
          </div>
          </details>

          <DialogFooter className="sticky bottom-0 border-t border-border/70 bg-background/95 px-6 py-4 backdrop-blur">
            <Button
              variant="outline"
              onClick={() => {
                setTemplateDialogOpen(false);
                setTemplateClientSearch("");
              }}
            >Cancelar</Button>
            {templateValidationError && <p className="mr-auto text-sm text-orange-600">{templateValidationError}</p>}
            <Button onClick={() => templateMutation.mutate(templateForm)} disabled={templateMutation.isPending || Boolean(templateValidationError)}>{templateMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Salvar template</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={instanceDialogOpen} onOpenChange={setInstanceDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Atualizar execução</DialogTitle><DialogDescription>Altere o status operacional e as observações da competência. A conclusão acontece apenas por documento válido anexado.</DialogDescription></DialogHeader>
          {instanceForm && (
            <div className="space-y-4 py-2">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2"><Label>Status</Label><Select value={instanceForm.status} onValueChange={(value) => setInstanceForm((prev) => prev ? { ...prev, status: value as GrowObligationInstance["status"] } : prev)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{statusOptions.map((status) => <SelectItem key={status} value={status}>{growObligationStatusLabel[status]}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-2"><Label>Prioridade</Label><Select value={instanceForm.priority} onValueChange={(value) => setInstanceForm((prev) => prev ? { ...prev, priority: value as GrowObligationInstance["priority"] } : prev)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{priorities.map((priority) => <SelectItem key={priority} value={priority}>{growPriorityLabel[priority]}</SelectItem>)}</SelectContent></Select></div>
              </div>
              <div className="space-y-2"><Label>Notas de conclusão</Label><Textarea value={instanceForm.completion_notes} onChange={(event) => setInstanceForm((prev) => prev ? { ...prev, completion_notes: event.target.value } : prev)} rows={3} /></div>
              <div className="space-y-2"><Label>Comentario do historico</Label><Textarea value={instanceForm.event_comment} onChange={(event) => setInstanceForm((prev) => prev ? { ...prev, event_comment: event.target.value } : prev)} rows={2} /></div>
            </div>
          )}
          <DialogFooter><Button variant="outline" onClick={() => setInstanceDialogOpen(false)}>Cancelar</Button><Button onClick={() => instanceForm && instanceMutation.mutate(instanceForm)} disabled={instanceMutation.isPending}>{instanceMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Salvar execucao</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(documentResolutionId)} onOpenChange={(open) => !open && setDocumentResolutionId(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Revisar vinculo do documento</DialogTitle><DialogDescription>Escolha a instancia correta para concluir a triagem.</DialogDescription></DialogHeader>
          {documentInResolution && (
            <div className="space-y-4 py-2">
              <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 text-sm">
                <p className="font-medium">{documentInResolution.file_name}</p>
                <p className="mt-1 text-muted-foreground">Cliente: {documentInResolution.detected_client?.name || documentInResolution.client?.name || "não identificado"} · Documento: {documentInResolution.document_definition?.label || documentInResolution.document_type_key || "não identificado"}</p>
                <p className="mt-1 text-muted-foreground">{matchStrategyLabel(documentInResolution.matched_by)} · Score {documentInResolution.reference_match_score.toFixed(2)}</p>
                {documentInResolution.auto_link_block_reason && <p className="mt-2 text-xs text-orange-600">{documentInResolution.auto_link_block_reason}</p>}
              </div>
              <div className="space-y-2">
                <Label>Competencia</Label>
                <Select value={documentResolutionInstanceId || "none"} onValueChange={(value) => setDocumentResolutionInstanceId(value === "none" ? "" : value)}>
                  <SelectTrigger><SelectValue placeholder="Selecione a competência" /></SelectTrigger>
                  <SelectContent><SelectItem value="none">Selecione</SelectItem>{documentResolutionOptions.map((instance) => <SelectItem key={instance.id} value={instance.id}>{buildInstanceLabel(instance)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Observacoes</Label><Textarea value={documentResolutionNotes} onChange={(event) => setDocumentResolutionNotes(event.target.value)} rows={3} /></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDocumentResolutionId(null)}>Cancelar</Button>
            <Button variant="ghost" className="text-destructive" onClick={() => documentResolutionId && documentResolveMutation.mutate({ inboxItemId: documentResolutionId, decision: "reject", notes: documentResolutionNotes || "Documento rejeitado manualmente." })}>Rejeitar</Button>
            <Button onClick={() => documentResolutionId && documentResolveMutation.mutate({ inboxItemId: documentResolutionId, decision: "accept", instanceId: documentResolutionInstanceId, notes: documentResolutionNotes })} disabled={documentResolveMutation.isPending}>{documentResolveMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Confirmar vinculo</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
