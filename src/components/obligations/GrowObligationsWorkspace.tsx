import { useMemo, useRef, useState, type DragEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
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

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  sanitizeStorageFilename,
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
  baseline_source: GrowObligationTemplate["baseline_source"];
}

interface TemplateSaveResult {
  ok: true;
  template?: GrowObligationTemplate;
}

interface TemplateDeleteResult {
  ok: true;
  mode: "deleted" | "deactivated";
  cancelled_instances?: number;
}

interface ClientListResult {
  ok: true;
  clients: GrowObligationsOverviewPayload["clients"];
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

interface UploadQueueResult {
  ok: true;
  inbox_item?: {
    id?: string | null;
    linked_instance_id?: string | null;
    communication_status?: string | null;
  } | null;
  match: ReferenceMatchPreview["match"];
}

const sectors = ["Contabil", "Fiscal", "Departamento Pessoal", "Comercial", "Societario", "Geral"];
const periodicities: GrowObligationTemplate["periodicity"][] = ["monthly", "quarterly", "yearly", "custom"];
const priorities: GrowObligationInstance["priority"][] = ["baixa", "media", "alta", "urgente"];
const statusOptions: GrowObligationInstance["status"][] = [
  "pendente",
  "em_andamento",
  "aguardando_documento",
  "em_revisao",
  "pronto_para_envio",
  "enviando",
  "falha_envio",
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

function fileNameWithoutExtension(fileName: string) {
  return fileName.replace(/\.[^/.]+$/, "").trim();
}

function buildUniqueReferenceFileName(fileName: string) {
  const safeName = sanitizeStorageFilename(fileName);
  const dotIndex = safeName.lastIndexOf(".");
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  if (dotIndex <= 0) return `${suffix}-${safeName}`;
  return `${safeName.slice(0, dotIndex)}-${suffix}${safeName.slice(dotIndex)}`;
}

function parseCompetenceInput(value: string | null | undefined) {
  const raw = String(value || "").trim();
  const yearMonth = raw.match(/^(\d{4})[-/](\d{1,2})$/);
  if (yearMonth) {
    const year = Number(yearMonth[1]);
    const monthIndex = Number(yearMonth[2]) - 1;
    if (monthIndex >= 0 && monthIndex <= 11) return new Date(Date.UTC(year, monthIndex, 1));
  }

  const monthYear = raw.match(/^(\d{1,2})[-/](\d{4})$/);
  if (monthYear) {
    const monthIndex = Number(monthYear[1]) - 1;
    const year = Number(monthYear[2]);
    if (monthIndex >= 0 && monthIndex <= 11) return new Date(Date.UTC(year, monthIndex, 1));
  }

  return null;
}

function formatCompetenceKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function formatCompetenceLabel(date: Date) {
  return `${String(date.getUTCMonth() + 1).padStart(2, "0")}/${date.getUTCFullYear()}`;
}

function toDateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

function dueDateForCompetence(competenceDate: Date, day: number) {
  const year = competenceDate.getUTCFullYear();
  const month = competenceDate.getUTCMonth();
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, Math.max(1, Math.min(day || 10, lastDay))));
}

function normalizeClientStatus(value: string | null | undefined) {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function isActiveClientStatus(value: string | null | undefined) {
  const normalized = normalizeClientStatus(value);
  return normalized === "ativo" || normalized === "active";
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
    baseline_source: template?.baseline_source || "manual",
  };
}

function isSystemDefaultTemplate(template: GrowObligationTemplate) {
  const source = (template.baseline_source || "").trim();
  return Boolean(source && source !== "manual");
}

function isSystemDefaultTemplateForm(form: TemplateFormState) {
  const source = String(form.baseline_source || "").trim();
  return Boolean(source && source !== "manual");
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

function validateTemplateForm(form: TemplateFormState, options?: { allowMissingDocuments?: boolean }) {
  if (!form.name.trim()) return "Informe o nome da obrigação.";
  const documents = sanitizeExpectedDocuments(form.expected_documents);
  if (documents.length === 0 && !options?.allowMissingDocuments) return "Cadastre pelo menos um documento esperado.";
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

  let resolvedTemplateId = payload.id;
  if (!resolvedTemplateId) {
    const { data: existingTemplate, error: existingTemplateError } = await supabase
      .from("obligation_templates")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("code", row.code)
      .maybeSingle();
    if (existingTemplateError) throw existingTemplateError;
    resolvedTemplateId = existingTemplate?.id ? String(existingTemplate.id) : null;
  }

  const templateQuery = resolvedTemplateId
    ? supabase
        .from("obligation_templates")
        .update(row)
        .eq("organization_id", organizationId)
        .eq("id", resolvedTemplateId)
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

async function updateTemplateMessagesDirectly(payload: TemplateFormState) {
  const organizationId = await getStoredCurrentOrganizationId();
  if (!organizationId || !payload.id) throw new Error("Organizacao ativa ou obrigacao nao encontrada.");

  const messageUpdates = {
    completion_email_enabled: payload.completion_email_enabled,
    completion_email_subject: payload.completion_email_subject.trim() || null,
    completion_email_body: payload.completion_email_body.trim() || null,
    completion_whatsapp_enabled: payload.completion_whatsapp_enabled,
    completion_whatsapp_body: payload.completion_whatsapp_body.trim() || null,
  };

  const { data, error } = await supabase
    .from("obligation_templates")
    .update(messageUpdates)
    .eq("organization_id", organizationId)
    .eq("id", payload.id)
    .select("*")
    .single();

  if (error) throw error;
  return { ok: true, template: data, fallback: "direct_message_rls" };
}

async function listTemplateClientsDirectly(): Promise<ClientListResult> {
  const organizationId = await getStoredCurrentOrganizationId();
  if (!organizationId) throw new Error("Organizacao ativa nao encontrada.");

  const { data, error } = await supabase
    .from("clients")
    .select("id, name, cnpj, regime, sector, status, email, phone, contact, obligation_completion_whatsapp_enabled")
    .eq("organization_id", organizationId)
    .order("name");

  if (error) throw error;

  return {
    ok: true,
    clients: (data || []).map((client) => ({
      id: String(client.id),
      name: String(client.name || ""),
      cnpj: client.cnpj ? String(client.cnpj) : null,
      regime: client.regime ? String(client.regime) : null,
      tax_regime_code: normalizeTaxRegime(client.regime ? String(client.regime) : null),
      sector: String(client.sector || "Geral"),
      status: String(client.status || "Ativo"),
      email: client.email ? String(client.email) : null,
      contact: client.contact ? String(client.contact) : null,
      phone: client.phone ? String(client.phone) : null,
      obligation_completion_whatsapp_enabled: Boolean(client.obligation_completion_whatsapp_enabled),
    })),
  };
}

async function listTemplateClientsForSelection(): Promise<ClientListResult> {
  try {
    const response = await invokeGrowObligations<ClientListResult>({ action: "list_clients" });
    if (response.clients?.length) return response;
  } catch (error) {
    console.warn("grow-obligations-module list_clients failed, using RLS fallback", error);
  }

  return listTemplateClientsDirectly();
}

async function listCatalogTemplatesDirectly(): Promise<GrowObligationTemplate[]> {
  const organizationId = await getStoredCurrentOrganizationId();
  if (!organizationId) throw new Error("Organizacao ativa nao encontrada.");

  const [{ data, error }, { data: referenceData, error: referenceError }] = await Promise.all([
    supabase
      .from("obligation_templates")
      .select("*")
      .eq("organization_id", organizationId)
      .order("name"),
    supabase
      .from("expected_document_reference_files")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("is_active", true)
      .order("created_at", { ascending: false }),
  ]);

  if (error) throw error;
  if (referenceError) throw referenceError;

  const referencesByDocument = new Map<string, GrowExpectedDocumentReferenceFile[]>();
  for (const reference of referenceData || []) {
    const key = `${reference.template_id}::${reference.document_type_key}`;
    const current = referencesByDocument.get(key) || [];
    current.push(reference as GrowExpectedDocumentReferenceFile);
    referencesByDocument.set(key, current);
  }

  return (data || []).map((template) => ({
    ...template,
    expected_documents: (Array.isArray(template.expected_documents)
      ? template.expected_documents as GrowExpectedDocument[]
      : []).map((document) => {
        const references = referencesByDocument.get(`${template.id}::${document.document_type_key}`) || [];
        return {
          ...document,
          reference_files: references,
          reference_files_count: references.length,
          has_active_reference: references.length > 0,
        };
      }),
  })) as GrowObligationTemplate[];
}

async function registerReferenceDocumentDirectly({
  templateId,
  documentTypeKey,
  file,
  storagePath,
  analysis,
}: {
  templateId: string;
  documentTypeKey: string;
  file: File;
  storagePath: string;
  analysis: AnalyzedDocument;
}) {
  const organizationId = await getStoredCurrentOrganizationId();
  if (!organizationId) throw new Error("Organizacao ativa nao encontrada.");

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) throw new Error("Sessao invalida ou expirada.");

  const { data, error } = await supabase
    .from("expected_document_reference_files")
    .insert({
      organization_id: organizationId,
      template_id: templateId,
      profile_id: null,
      document_type_key: documentTypeKey,
      file_name: file.name,
      storage_bucket: "obligation-files",
      storage_path: storagePath,
      content_type: file.type || "application/pdf",
      file_size: file.size,
      is_active: true,
      source_kind: "template_reference",
      extracted_text: analysis.extracted_text,
      extracted_text_preview: analysis.extracted_text_preview,
      text_extraction_status: analysis.text_extraction_status,
      ocr_status: analysis.ocr_status,
      fingerprint_version: 1,
      fingerprint_payload: analysis.fingerprint_payload,
      keywords: analysis.keywords,
      primary_cues: analysis.primary_cues,
      created_by: user.id,
    })
    .select("*")
    .single();

  if (error || !data) throw error || new Error("Falha ao registrar documento modelo.");
  return { ok: true as const, reference_file: data as GrowExpectedDocumentReferenceFile, fallback: "direct_rls" };
}

async function uploadTemplateReferenceFile({
  templateId,
  documentTypeKey,
  file,
}: {
  templateId: string;
  documentTypeKey: string;
  file: File;
}) {
  if (!templateId) throw new Error("Salve o template antes de anexar documentos modelo.");
  if (!documentTypeKey) throw new Error("Defina o documento esperado antes de anexar o modelo.");
  const validationError = validateSecureDocument(file);
  if (validationError) throw new Error(validationError);
  const analysis = await analyzePdfDocument(file);
  const path = buildSecureStoragePath(
    ["grow-obligations", "references", templateId, documentTypeKey],
    buildUniqueReferenceFileName(file.name),
  );
  const { error: uploadError } = await supabase.storage.from("obligation-files").upload(path, file, {
    contentType: file.type || undefined,
    upsert: false,
  });
  if (uploadError) throw uploadError;
  try {
    return await invokeGrowObligations<{ ok: true; reference_file: GrowExpectedDocumentReferenceFile }>({
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
  } catch (error) {
    console.warn("grow-obligations-module upload_reference_document failed, using RLS fallback", error);
    try {
      return await registerReferenceDocumentDirectly({
        templateId,
        documentTypeKey,
        file,
        storagePath: path,
        analysis,
      });
    } catch (fallbackError) {
      await supabase.storage.from("obligation-files").remove([path]);
      throw fallbackError;
    }
  }
}

async function ensureDetectedInstanceForUpload({
  organizationId,
  clientId,
  templateId,
  competenceLabel,
  userId,
}: {
  organizationId: string;
  clientId: string | null;
  templateId: string | null;
  competenceLabel: string | null;
  userId: string;
}) {
  if (!clientId || !templateId || !competenceLabel) return null;

  const competenceDate = parseCompetenceInput(competenceLabel);
  if (!competenceDate) return null;

  const competenceKey = formatCompetenceKey(competenceDate);
  const { data: existingInstance, error: existingError } = await supabase
    .from("obligation_instances")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("client_id", clientId)
    .eq("template_id", templateId)
    .eq("competence_key", competenceKey)
    .maybeSingle();

  if (existingError) throw existingError;
  if (existingInstance?.id) return String(existingInstance.id);

  const [{ data: profile, error: profileError }, { data: template, error: templateError }] = await Promise.all([
    supabase
      .from("client_obligation_profiles")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("client_id", clientId)
      .eq("template_id", templateId)
      .eq("is_active", true)
      .maybeSingle(),
    supabase
      .from("obligation_templates")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("id", templateId)
      .eq("is_active", true)
      .maybeSingle(),
  ]);

  if (profileError) throw profileError;
  if (templateError) throw templateError;
  if (!profile?.id || !template?.id) return null;

  const technicalDueDate = dueDateForCompetence(competenceDate, Number(profile.due_day_override ?? template.due_day ?? 10));
  const legalDueDate = template.legal_due_day
    ? dueDateForCompetence(competenceDate, Number(profile.legal_due_day_override ?? template.legal_due_day))
    : null;

  const { data: createdInstance, error: createError } = await supabase
    .from("obligation_instances")
    .insert({
      organization_id: organizationId,
      client_id: clientId,
      profile_id: profile.id,
      template_id: templateId,
      competence_label: formatCompetenceLabel(competenceDate),
      competence_date: toDateOnly(competenceDate),
      competence_key: competenceKey,
      technical_due_date: toDateOnly(technicalDueDate),
      legal_due_date: legalDueDate ? toDateOnly(legalDueDate) : null,
      status: "pendente",
      priority: template.priority || "media",
      current_assignee: profile.assigned_to || null,
      origin: "grow_native",
      document_required: true,
      created_by: userId,
    })
    .select("id")
    .single();

  if (createError) throw createError;
  return createdInstance?.id ? String(createdInstance.id) : null;
}

async function registerDocumentUploadDirectly({
  item,
  storagePath,
}: {
  item: UploadQueueItem;
  storagePath: string;
}) {
  const organizationId = await getStoredCurrentOrganizationId();
  if (!organizationId) throw new Error("Organizacao ativa nao encontrada.");

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) throw new Error("Sessao invalida ou expirada.");

  const previewMatch = item.preview?.match;
  const match: ReferenceMatchPreview["match"] = previewMatch || {
    resolvedInstanceId: item.instance_id || null,
    suggestedTemplateId: item.template_id || null,
    documentTypeKey: item.document_type_key || null,
    strategy: item.instance_id ? "manual_instance" : "manual_review",
    score: item.instance_id ? 1 : 0.35,
    reasons: item.instance_id
      ? ["Instancia definida manualmente pelo usuario."]
      : ["Aguardando validacao humana para vincular o arquivo."],
    reviewRequired: !item.instance_id,
    candidateInstanceIds: item.instance_id ? [item.instance_id] : [],
    detectedClientId: item.client_id || null,
    detectedCnpj: item.analysis.detected_cnpj,
    competenceDetected: item.analysis.competence_detected,
    referenceFileId: null,
    referenceMatchScore: 0,
    referenceMatchReasons: [],
    autoLinkBlockReason: item.instance_id ? null : "Candidato insuficiente para auto-vinculo.",
  };
  let linkedInstanceId = item.instance_id || match.resolvedInstanceId || null;
  if (!linkedInstanceId && match.detectedClientId && (match.suggestedTemplateId || item.template_id)) {
    linkedInstanceId = await ensureDetectedInstanceForUpload({
      organizationId,
      clientId: match.detectedClientId || item.client_id || null,
      templateId: match.suggestedTemplateId || item.template_id || null,
      competenceLabel: match.competenceDetected || item.suggested_competence_label || item.analysis.competence_detected || null,
      userId: user.id,
    });
  }
  const isLinked = Boolean(linkedInstanceId);
  const effectiveMatch = linkedInstanceId
    ? { ...match, resolvedInstanceId: linkedInstanceId, reviewRequired: false, autoLinkBlockReason: null }
    : match;

  const { data: ingestionJob, error: ingestionJobError } = await supabase
    .from("document_ingestion_jobs")
    .upsert(
      {
        organization_id: organizationId,
        source_kind: "web_manual",
        file_name: item.file.name,
        storage_bucket: "obligation-files",
        storage_path: storagePath,
        file_hash: null,
        file_size: item.file.size,
        client_id: effectiveMatch.detectedClientId || item.client_id || null,
        detected_client_id: effectiveMatch.detectedClientId || null,
        template_id: effectiveMatch.suggestedTemplateId || item.template_id || null,
        instance_id: isLinked ? linkedInstanceId : null,
        status: isLinked ? "ingested" : "review_required",
        classification_status: isLinked ? "classified" : "review_required",
        application_status: "pending",
        communication_status: "pending",
        publication_status: "pending",
        review_required: !isLinked,
        metadata: {
          detected_cnpj: effectiveMatch.detectedCnpj || item.analysis.detected_cnpj,
          competence_detected: effectiveMatch.competenceDetected || item.analysis.competence_detected,
          match_strategy: effectiveMatch.strategy,
          match_score: effectiveMatch.score,
        },
        created_by: user.id,
      },
      { onConflict: "storage_bucket,storage_path" },
    )
    .select("*")
    .single();

  if (ingestionJobError || !ingestionJob) {
    throw ingestionJobError || new Error("Falha ao registrar job de ingestao do documento.");
  }

  const { data: inboxItem, error: inboxError } = await supabase
    .from("document_inbox_items")
    .insert({
      organization_id: organizationId,
      ingestion_job_id: ingestionJob.id,
      client_id: effectiveMatch.detectedClientId || item.client_id || null,
      suggested_client_id: item.client_id || null,
      detected_client_id: effectiveMatch.detectedClientId || null,
      suggested_template_id: effectiveMatch.suggestedTemplateId || item.template_id || null,
      suggested_instance_id: effectiveMatch.resolvedInstanceId || item.instance_id || null,
      linked_instance_id: isLinked ? linkedInstanceId : null,
      document_type_key: effectiveMatch.documentTypeKey || item.document_type_key || null,
      file_name: item.file.name,
      storage_bucket: "obligation-files",
      storage_path: storagePath,
      source_kind: "web_manual",
      content_type: item.file.type || "application/pdf",
      file_size: item.file.size,
      suggested_competence_label: item.suggested_competence_label || null,
      detected_cnpj: effectiveMatch.detectedCnpj || item.analysis.detected_cnpj,
      competence_detected: effectiveMatch.competenceDetected || item.analysis.competence_detected,
      identification_confidence: effectiveMatch.score,
      matched_by: effectiveMatch.strategy,
      match_score: effectiveMatch.score,
      match_reasons: effectiveMatch.reasons,
      reference_file_id: effectiveMatch.referenceFileId || null,
      reference_match_score: effectiveMatch.referenceMatchScore || 0,
      reference_match_reasons: effectiveMatch.referenceMatchReasons || [],
      review_required: !isLinked,
      classification_status: isLinked ? "classified" : "review_required",
      status: isLinked ? "linked" : "pending_review",
      blocking_reason: isLinked ? null : "Aguardando validacao humana para vincular o arquivo.",
      text_extraction_status: item.analysis.text_extraction_status,
      ocr_status: item.analysis.ocr_status,
      extracted_text_preview: item.analysis.extracted_text_preview,
      fingerprint_payload: item.analysis.fingerprint_payload,
      auto_link_block_reason: effectiveMatch.autoLinkBlockReason || null,
      processing_status: "queued",
      processing_attempts: 0,
      execution_status: "pending",
      application_status: "pending",
      communication_status: "pending",
      publication_status: "pending",
      execution_notes: isLinked
        ? "Documento aguardando aplicacao operacional na obrigacao."
        : "Documento aguardando revisao humana para vinculacao.",
      notes: item.notes || null,
      created_by: user.id,
      reviewed_by: isLinked ? user.id : null,
      reviewed_at: isLinked ? new Date().toISOString() : null,
    })
    .select("*")
    .single();

  if (inboxError || !inboxItem) throw inboxError || new Error("Falha ao registrar documento.");

  const { error: ingestionJobUpdateError } = await supabase
    .from("document_ingestion_jobs")
    .update({ inbox_item_id: inboxItem.id })
    .eq("id", ingestionJob.id)
    .eq("organization_id", organizationId);
  if (ingestionJobUpdateError) throw ingestionJobUpdateError;

  if (isLinked && linkedInstanceId) {
    const { error: instanceFileError } = await supabase
      .from("obligation_instance_files")
      .upsert(
        {
          organization_id: organizationId,
          instance_id: linkedInstanceId,
          inbox_item_id: inboxItem.id,
          file_name: item.file.name,
          storage_bucket: "obligation-files",
          storage_path: storagePath,
          content_type: item.file.type || "application/pdf",
          file_size: item.file.size,
          triage_status: "reviewed",
          source: "manual_upload",
          source_kind: "web_manual",
          uploaded_by: user.id,
          identification_confidence: effectiveMatch.score,
        },
        { onConflict: "storage_bucket,storage_path" },
      );
    if (instanceFileError) throw instanceFileError;
  }

  return { ok: true as const, inbox_item: inboxItem, match: effectiveMatch, fallback: "direct_rls" };
}

async function processAndSendLinkedDocument({
  organizationId,
  inboxItemId,
  instanceId,
}: {
  organizationId: string;
  inboxItemId: string;
  instanceId: string;
}) {
  const { error: processError } = await supabase.functions.invoke("obligation-document-processor", {
    body: {
      organization_id: organizationId,
      inbox_item_id: inboxItemId,
      limit: 1,
    },
  });
  if (processError) throw processError;

  return invokeGrowObligations({
    action: "send_delivery",
    instance_id: instanceId,
    inbox_item_id: inboxItemId,
    human_confirmed: true,
    confirm_duplicate: false,
  });
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

function buildLocalDocumentPreview(
  item: UploadQueueItem,
  overview: GrowObligationsOverviewPayload | undefined,
  fallback?: {
    clients?: GrowObligationsOverviewPayload["clients"];
    templates?: GrowObligationTemplate[];
  },
): ReferenceMatchPreview {
  const clients = overview?.clients?.length ? overview.clients : fallback?.clients || [];
  const templates = overview?.templates?.length ? overview.templates : fallback?.templates || [];
  const instances = overview?.instances || [];
  const detectedClient = item.analysis.detected_cnpj
    ? clients.find((client) => client.cnpj?.replace(/\D/g, "") === item.analysis.detected_cnpj)
    : null;
  const effectiveClientId = item.client_id || detectedClient?.id || null;
  const searchableText = `${item.file.name} ${item.analysis.extracted_text_preview || ""} ${item.analysis.extracted_text || ""}`.toLowerCase();
  const inferredTemplate =
    templates.find((template) => {
      const tokens = [
        template.code,
        template.name,
        ...template.expected_documents.flatMap((document) => [document.label, ...document.aliases]),
      ]
        .map((value) => String(value || "").trim().toLowerCase())
        .filter((value) => value.length >= 2);
      return tokens.some((token) => searchableText.includes(token));
    }) || null;
  const effectiveTemplate = templates.find((template) => template.id === item.template_id) || inferredTemplate;
  const documentDefinition =
    effectiveTemplate?.expected_documents.find((document) => document.document_type_key === item.document_type_key) ||
    effectiveTemplate?.expected_documents.find((document) => {
      const tokens = [document.label, ...document.aliases]
        .map((value) => String(value || "").trim().toLowerCase())
        .filter((value) => value.length >= 2);
      return tokens.some((token) => searchableText.includes(token));
    }) ||
    effectiveTemplate?.expected_documents.find((document) => document.active) ||
    null;
  const effectiveCompetence = item.suggested_competence_label || item.analysis.competence_detected || null;
  const manuallySelectedInstance = item.instance_id
    ? instances.find((instance) => instance.id === item.instance_id) || null
    : null;
  const matchingInstance =
    manuallySelectedInstance ||
    instances.find((instance) => {
      if (!effectiveClientId || instance.client_id !== effectiveClientId) return false;
      if (item.template_id && instance.template_id !== item.template_id) return false;
      if (effectiveCompetence && instance.competence_label !== effectiveCompetence) return false;
      return !["concluida", "cancelada"].includes(instance.status);
    }) ||
    null;
  const hasManualDefinition = Boolean(item.client_id || item.template_id || item.document_type_key || item.instance_id);
  const canCreateDetectedInstance = Boolean(effectiveClientId && effectiveTemplate && documentDefinition && effectiveCompetence);
  const reviewRequired = !documentDefinition || (!matchingInstance && !canCreateDetectedInstance);

  return {
    ok: true,
    match: {
      resolvedInstanceId: matchingInstance?.id || null,
      suggestedTemplateId: item.template_id || matchingInstance?.template_id || effectiveTemplate?.id || null,
      documentTypeKey: item.document_type_key || documentDefinition?.document_type_key || null,
      strategy: matchingInstance ? "manual_instance" : canCreateDetectedInstance ? "direct_expected_doc" : "manual_review",
      score: matchingInstance && documentDefinition ? 1 : canCreateDetectedInstance ? 0.85 : effectiveClientId && effectiveTemplate && documentDefinition ? 0.75 : hasManualDefinition ? 0.65 : 0.35,
      reasons: reviewRequired
        ? ["Preview local: revise cliente, obrigacao, competencia e documento antes de enviar."]
        : [matchingInstance ? "Preview local: arquivo sera vinculado com base na selecao informada." : "Preview local: a competencia detectada sera criada e vinculada no envio."],
      reviewRequired,
      candidateInstanceIds: matchingInstance ? [matchingInstance.id] : [],
      detectedClientId: effectiveClientId,
      detectedCnpj: item.analysis.detected_cnpj,
      competenceDetected: effectiveCompetence,
      referenceFileId: null,
      referenceMatchScore: 0,
      referenceMatchReasons: [],
      autoLinkBlockReason: reviewRequired ? "Selecao insuficiente para vinculo automatico." : null,
    },
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
  const [templateDeleteTarget, setTemplateDeleteTarget] = useState<GrowObligationTemplate | null>(null);
  const [instanceDialogOpen, setInstanceDialogOpen] = useState(false);
  const [instanceForm, setInstanceForm] = useState<InstanceFormState | null>(null);
  const [documentResolutionId, setDocumentResolutionId] = useState<string | null>(null);
  const [documentResolutionInstanceId, setDocumentResolutionInstanceId] = useState("");
  const [documentResolutionNotes, setDocumentResolutionNotes] = useState("");
  const [uploadQueue, setUploadQueue] = useState<UploadQueueItem[]>([]);
  const [referenceUploadKey, setReferenceUploadKey] = useState<string | null>(null);
  const [pendingReferenceFiles, setPendingReferenceFiles] = useState<Record<string, File[]>>({});
  const [isDraggingUpload, setIsDraggingUpload] = useState(false);
  const [templateClientSearch, setTemplateClientSearch] = useState("");
  const [deliveryRecipientByInstance, setDeliveryRecipientByInstance] = useState<Record<string, string>>({});
  const documentStatusFilter = "all";
  const documentClientFilter = initialClientId || "all";
  const documentTemplateFilter = "all";
  const documentCompetenceFilter = "";

  const overviewQuery = useQuery({
    queryKey: [
      ...overviewQueryKey,
      documentStatusFilter,
      documentClientFilter,
      documentTemplateFilter,
      documentCompetenceFilter,
    ],
    queryFn: () =>
      invokeGrowObligations<GrowObligationsOverviewPayload>({
        action: "overview",
        document_status: documentStatusFilter,
        document_client_id: documentClientFilter,
        document_template_id: documentTemplateFilter,
        document_competence: documentCompetenceFilter || null,
      }),
  });

  const overview = overviewQuery.data;

  const templateClientsQuery = useQuery({
    queryKey: ["grow-obligations", "template-clients"],
    queryFn: listTemplateClientsForSelection,
    staleTime: 60_000,
  });

  const catalogTemplatesQuery = useQuery({
    queryKey: ["grow-obligations", "catalog-templates"],
    queryFn: listCatalogTemplatesDirectly,
    staleTime: 30_000,
  });

  const templateMutation = useMutation({
    mutationFn: async (payload: TemplateFormState) => {
      const isSystemDefault = isSystemDefaultTemplateForm(payload);
      const validationError = validateTemplateForm(payload, { allowMissingDocuments: isSystemDefault });
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
        if (isSystemDefault) {
          console.warn("grow-obligations-module system default message update failed, using safe RLS fallback", error);
          return await updateTemplateMessagesDirectly(payload);
        }
        console.warn("grow-obligations-module upsert_template failed, using RLS fallback", error);
        return await upsertTemplateDirectly(payload);
      }
    },
    onSuccess: async (response, savedPayload) => {
      const savedTemplate = (response as TemplateSaveResult | undefined)?.template;
      const savedTemplateId = savedTemplate?.id || savedPayload.id;
      const pendingEntries = Object.entries(pendingReferenceFiles).filter(([, files]) => files.length > 0);
      toast.success(
        savedPayload.id
          ? "Obrigacao mestre salva."
          : pendingEntries.length > 0
            ? "Obrigacao mestre salva. Anexando PDFs modelo..."
            : "Obrigacao mestre salva. Agora anexe os PDFs modelo.",
      );
      if (savedTemplate) {
        setTemplateForm({
          ...makeTemplateForm(savedTemplate),
          linked_client_ids: savedPayload.linked_client_ids,
        });
      }
      if (savedTemplateId && pendingEntries.length > 0) {
        const uploadedReferences: Array<{ documentTypeKey: string; reference: GrowExpectedDocumentReferenceFile }> = [];
        for (const [documentTypeKey, files] of pendingEntries) {
          for (const file of files) {
            const result = await uploadTemplateReferenceFile({ templateId: savedTemplateId, documentTypeKey, file });
            uploadedReferences.push({ documentTypeKey, reference: result.reference_file });
          }
        }
        setPendingReferenceFiles({});
        setTemplateForm((prev) => ({
          ...prev,
          expected_documents: prev.expected_documents.map((document) => {
            const references = uploadedReferences
              .filter((item) => item.documentTypeKey === document.document_type_key)
              .map((item) => item.reference);
            if (references.length === 0) return document;
            return {
              ...document,
              reference_files: [...references, ...(document.reference_files || [])],
              reference_files_count: (document.reference_files_count || 0) + references.length,
              has_active_reference: true,
            };
          }),
        }));
        toast.success(`${uploadedReferences.length} PDF(s) modelo anexado(s).`);
      }
      await queryClient.invalidateQueries({ queryKey: overviewQueryKey });
      await queryClient.invalidateQueries({ queryKey: ["grow-obligations", "template-clients"] });
      await queryClient.invalidateQueries({ queryKey: ["grow-obligations", "catalog-templates"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Falha ao salvar obrigação."),
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: (templateId: string) =>
      invokeGrowObligations<TemplateDeleteResult>({
        action: "delete_template",
        template_id: templateId,
      }),
    onSuccess: async (response) => {
      toast.success(
        response.mode === "deleted"
          ? "Obrigacao excluida."
          : `Obrigacao inativada${response.cancelled_instances ? ` e ${response.cancelled_instances} competencia(s) aberta(s) cancelada(s)` : ""}.`,
      );
      setTemplateDeleteTarget(null);
      await queryClient.invalidateQueries({ queryKey: overviewQueryKey });
      await queryClient.invalidateQueries({ queryKey: ["grow-obligations", "template-clients"] });
      await queryClient.invalidateQueries({ queryKey: ["grow-obligations", "catalog-templates"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Falha ao excluir obrigacao."),
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
    mutationFn: uploadTemplateReferenceFile,
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
      await queryClient.invalidateQueries({ queryKey: ["grow-obligations", "catalog-templates"] });
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
      await queryClient.invalidateQueries({ queryKey: ["grow-obligations", "catalog-templates"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Falha ao remover documento modelo."),
  });

  const uploadQueueMutation = useMutation({
    mutationFn: async () => {
      if (uploadQueue.length === 0) {
        throw new Error("Adicione pelo menos um PDF antes de enviar.");
      }
      const organizationId = await getStoredCurrentOrganizationId();
      if (!organizationId) throw new Error("Organizacao ativa nao encontrada.");

      const results: Array<UploadQueueResult & { deliverySent?: boolean; deliveryError?: string | null }> = [];
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

        let response: UploadQueueResult;
        try {
          response = await registerDocumentUploadDirectly({ item, storagePath: path });
        } catch (error) {
          await supabase.storage.from("obligation-files").remove([path]);
          throw error;
        }

        const inboxItemId = response.inbox_item?.id ? String(response.inbox_item.id) : "";
        const instanceId =
          response.inbox_item?.linked_instance_id ||
          response.match.resolvedInstanceId ||
          item.instance_id ||
          "";
        if (inboxItemId && instanceId && !response.match.reviewRequired) {
          try {
            await processAndSendLinkedDocument({
              organizationId,
              inboxItemId,
              instanceId,
            });
            results.push({ ...response, deliverySent: true, deliveryError: null });
            continue;
          } catch (error) {
            results.push({
              ...response,
              deliverySent: false,
              deliveryError: error instanceof Error ? error.message : "Falha ao enviar e-mail ao cliente.",
            });
            continue;
          }
        }

        results.push(response);
      }
      return results;
    },
    onSuccess: async (results) => {
      const autoLinked = results.filter((item) => !item.match.reviewRequired).length;
      const deliverySent = results.filter((item) => item.deliverySent).length;
      const deliveryErrors = results
        .map((item) => item.deliveryError)
        .filter((message): message is string => Boolean(message));
      if (deliveryErrors.length > 0) {
        toast.error(`${results.length} arquivo(s) enviados. ${autoLinked} vinculado(s). ${deliverySent} e-mail(s) enviado(s). ${deliveryErrors[0]}`);
      } else {
        toast.success(`${results.length} arquivo(s) enviados. ${autoLinked} vinculado(s). ${deliverySent} e-mail(s) enviado(s).`);
      }
      setUploadQueue([]);
      await queryClient.invalidateQueries({ queryKey: overviewQueryKey });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Falha ao enviar lote de documentos."),
  });

  const processQueueMutation = useMutation({
    mutationFn: async () => {
      const organizationId = await getStoredCurrentOrganizationId();
      if (!organizationId) throw new Error("Organizacao ativa nao encontrada.");
      const { data, error } = await supabase.functions.invoke<{
        ok: true;
        processed: number;
        total: number;
      }>("obligation-document-processor", {
        body: {
          organization_id: organizationId,
          limit: 50,
        },
      });
      if (error) throw error;
      return data as { ok: true; processed: number; total: number };
    },
    onSuccess: async (result) => {
      toast.success(`${result.processed} documento(s) processados automaticamente.`);
      await queryClient.invalidateQueries({ queryKey: overviewQueryKey });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Falha ao processar documentos vinculados."),
  });

  const sendDeliveryMutation = useMutation({
    mutationFn: (payload: { instanceId: string; recipientEmail?: string; retry?: boolean; confirmDuplicate?: boolean }) =>
      invokeGrowObligations({
        action: payload.retry ? "retry_delivery" : "send_delivery",
        instance_id: payload.instanceId,
        recipient_email: payload.recipientEmail || null,
        human_confirmed: true,
        confirm_duplicate: payload.confirmDuplicate || false,
      }),
    onSuccess: async () => {
      toast.success("Guia enviada ao cliente e obrigacao concluida.");
      await queryClient.invalidateQueries({ queryKey: overviewQueryKey });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Falha ao enviar guia ao cliente."),
  });

  const cancelDeliveryMutation = useMutation({
    mutationFn: (payload: { instanceId: string; attemptId?: string; reason?: string }) =>
      invokeGrowObligations({
        action: "cancel_delivery",
        instance_id: payload.instanceId,
        attempt_id: payload.attemptId || null,
        reason: payload.reason || "Envio cancelado pela Central de Documentos.",
      }),
    onSuccess: async () => {
      toast.success("Envio cancelado.");
      await queryClient.invalidateQueries({ queryKey: overviewQueryKey });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Falha ao cancelar envio."),
  });

  const templateIsSystemDefault = isSystemDefaultTemplateForm(templateForm);
  const templateValidationError = useMemo(
    () => validateTemplateForm(templateForm, { allowMissingDocuments: templateIsSystemDefault }),
    [templateForm, templateIsSystemDefault],
  );
  const uploadQueueValidationError = useMemo(
    () => uploadQueue.map((item) => validateUploadQueueItem(item)).find(Boolean) || null,
    [uploadQueue],
  );

  const catalogTemplates = useMemo(
    () => overview?.templates?.length ? overview.templates : catalogTemplatesQuery.data || [],
    [catalogTemplatesQuery.data, overview?.templates],
  );

  const filteredTemplates = useMemo(() => {
    const items = catalogTemplates;
    const token = templateSearch.trim().toLowerCase();
    if (!token) return items;
    return items.filter((template) => `${template.name} ${template.sector}`.toLowerCase().includes(token));
  }, [catalogTemplates, templateSearch]);

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

  const readyDeliveryInstances = useMemo(
    () =>
      (overview?.instances || []).filter((instance) =>
        instance.status === "pronto_para_envio" || instance.status === "falha_envio",
      ),
    [overview?.instances],
  );

  const deliveryAttempts = useMemo(
    () => overview?.delivery_attempts || [],
    [overview?.delivery_attempts],
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
      catalogTemplates.flatMap((template) =>
        template.expected_documents
          .filter((document) => document.active)
          .map((document) => ({
            optionKey: `${template.id}::${document.document_type_key}`,
            label: `${template.name} · ${document.label}`,
            templateId: template.id,
            documentTypeKey: document.document_type_key,
          })),
      ),
    [catalogTemplates],
  );

  const activeTemplateClients = useMemo(
    () => {
      const clients = templateClientsQuery.data?.clients?.length
        ? templateClientsQuery.data.clients
        : overview?.clients || [];
      return clients.filter((client) => isActiveClientStatus(client.status));
    },
    [overview?.clients, templateClientsQuery.data?.clients],
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
      const preview = buildLocalDocumentPreview(item, overview, {
        clients: activeTemplateClients,
        templates: catalogTemplates,
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
    <div className="mx-auto w-full max-w-none space-y-5 px-1 sm:px-2 xl:px-4">
      <section className="relative overflow-hidden rounded-[1.75rem] border border-border/70 bg-card p-6 shadow-sm">
        <div className="absolute inset-y-0 left-0 w-1 bg-primary" />
        <div className="absolute right-8 top-6 h-24 w-24 rounded-full bg-primary/5 blur-2xl" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0 space-y-3">
            <Badge variant="secondary" className="rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.28em]">Grow Native</Badge>
            <div className="space-y-1">
              <h1 className="font-heading text-3xl font-bold tracking-tight">Obrigações Grow</h1>
              <p className="max-w-3xl text-sm text-muted-foreground">
                Central operacional para envio de guias, documentos esperados e gestão do catálogo padrão.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" className="rounded-xl" onClick={() => overviewQuery.refetch()}>
              <RefreshCcw className="mr-2 h-4 w-4" />
              Atualizar visão
            </Button>
          </div>
        </div>
      </section>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as WorkspaceTab)} className="space-y-5">
        <TabsList className="grid h-auto w-full grid-cols-2 rounded-2xl border bg-card p-1 shadow-sm">
          <TabsTrigger value="documentos" className="rounded-xl py-2.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            Central de Documentos
          </TabsTrigger>
          <TabsTrigger value="catalogo" className="rounded-xl py-2.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            Catálogo
          </TabsTrigger>
        </TabsList>

        <TabsContent value="catalogo" className="space-y-4">
          <Card className="rounded-3xl">
            <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div><CardTitle>Catalogo mestre</CardTitle></div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Input value={templateSearch} onChange={(event) => setTemplateSearch(event.target.value)} placeholder="Buscar por nome ou setor" className="w-full sm:w-72" />
                <Button
                  className="rounded-2xl"
                  onClick={() => {
                    setTemplateForm(makeTemplateForm());
                    setTemplateClientSearch("");
                    setPendingReferenceFiles({});
                    setTemplateDialogOpen(true);
                  }}
                ><Plus className="mr-2 h-4 w-4" />Nova obrigação</Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {overviewQuery.isFetching || catalogTemplatesQuery.isFetching ? (
                <div className="flex items-center gap-2 rounded-2xl border border-border/70 p-4 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Carregando catalogo...
                </div>
              ) : null}
              {filteredTemplates.map((template) => (
                <div key={template.id} className="rounded-2xl border border-border/70 p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{template.name}</p>
                        <Badge variant="outline">{template.sector}</Badge>
                        {isSystemDefaultTemplate(template) ? <Badge variant="secondary">Padrao do sistema</Badge> : null}
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
                    <div className="flex flex-wrap gap-2 lg:justify-end">
                      {isSystemDefaultTemplate(template) ? (
                        <Button
                          variant="outline"
                          className="rounded-2xl"
                          onClick={() => {
                            setTemplateForm({
                              ...makeTemplateForm(template),
                              linked_client_ids: buildTemplateLinkedClientIds(overview?.profiles, template.id),
                            });
                            setTemplateClientSearch("");
                            setPendingReferenceFiles({});
                            setTemplateDialogOpen(true);
                          }}
                        >
                          Editar mensagens
                        </Button>
                      ) : (
                        <>
                          <Button
                            variant="outline"
                            className="rounded-2xl"
                            onClick={() => {
                              setTemplateForm({
                                ...makeTemplateForm(template),
                                linked_client_ids: buildTemplateLinkedClientIds(overview?.profiles, template.id),
                              });
                              setTemplateClientSearch("");
                              setPendingReferenceFiles({});
                              setTemplateDialogOpen(true);
                            }}
                          >
                            Editar
                          </Button>
                          <Button
                            variant="outline"
                            className="rounded-2xl border-destructive/40 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                            disabled={deleteTemplateMutation.isPending && templateDeleteTarget?.id === template.id}
                            onClick={() => setTemplateDeleteTarget(template)}
                          >
                            {deleteTemplateMutation.isPending && templateDeleteTarget?.id === template.id ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="mr-2 h-4 w-4" />
                            )}
                            Excluir
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {!overviewQuery.isFetching && !catalogTemplatesQuery.isFetching && filteredTemplates.length === 0 ? (
                <div className="rounded-2xl border border-border/70 p-4 text-sm text-muted-foreground">
                  Nenhuma obrigacao encontrada para este filtro.
                </div>
              ) : null}
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
          <Card className="overflow-hidden rounded-3xl border-border/70 shadow-sm">
            <CardHeader className="border-b bg-muted/20">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <CardTitle>Central de Documentos</CardTitle>
                  <CardDescription>Envie PDFs das obrigações e acompanhe a fila de processamento.</CardDescription>
                </div>
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline" className="rounded-full">PDF</Badge>
                  <Badge variant="outline" className="rounded-full">Leitura automática</Badge>
                  <Badge variant="outline" className="rounded-full">Auditoria preservada</Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5 p-6">
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
                {readyDeliveryInstances.length > 0 && (
                  <div className="rounded-2xl border border-cyan-200 bg-cyan-50/60 p-4 dark:border-cyan-900/50 dark:bg-cyan-950/20">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium">Guias prontas para envio</p>
                        <p className="text-xs text-muted-foreground">
                          {readyDeliveryInstances.length} obrigacao(oes) aguardando revisao do destinatario e confirmacao.
                        </p>
                      </div>
                      <Badge variant="secondary">{readyDeliveryInstances.length}</Badge>
                    </div>
                    <div className="grid gap-3 xl:grid-cols-2">
                      {readyDeliveryInstances.map((instance) => {
                        const recipient = deliveryRecipientByInstance[instance.id] ?? instance.client?.email ?? "";
                        const latestAttempt = instance.latest_delivery_attempt;
                        return (
                          <div key={instance.id} className="rounded-xl border bg-background/90 p-4">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="min-w-0 space-y-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="truncate text-sm font-medium">{instance.template?.name || "Obrigacao"}</p>
                                  <Badge className={`border-0 ${growObligationStatusClass[instance.status]}`}>
                                    {growObligationStatusLabel[instance.status]}
                                  </Badge>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  {instance.client?.name || "Cliente"} · competencia {instance.competence_label}
                                </p>
                              </div>
                            </div>
                            <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
                              <Input
                                value={recipient}
                                onChange={(event) =>
                                  setDeliveryRecipientByInstance((prev) => ({
                                    ...prev,
                                    [instance.id]: event.target.value,
                                  }))
                                }
                                placeholder="email@cliente.com"
                                type="email"
                              />
                              <Button
                                className="rounded-xl"
                                disabled={sendDeliveryMutation.isPending}
                                onClick={() => {
                                  const reviewedRecipient = deliveryRecipientByInstance[instance.id] ?? instance.client?.email ?? "";
                                  if (!window.confirm(`Enviar guia para ${reviewedRecipient}?`)) return;
                                  sendDeliveryMutation.mutate({
                                    instanceId: instance.id,
                                    recipientEmail: reviewedRecipient,
                                    retry: instance.status === "falha_envio",
                                  });
                                }}
                              >
                                {sendDeliveryMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
                                {instance.status === "falha_envio" ? "Tentar novamente" : "Enviar"}
                              </Button>
                            </div>
                            {latestAttempt ? (
                              <div className="mt-3 rounded-lg border border-border/60 bg-muted/30 p-3 text-xs text-muted-foreground">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <span>Ultima tentativa: {latestAttempt.status}</span>
                                  {latestAttempt.sent_at ? <span>{formatDateTime(latestAttempt.sent_at)}</span> : null}
                                </div>
                                {latestAttempt.failure_reason ? <p className="mt-1 text-destructive">{latestAttempt.failure_reason}</p> : null}
                                {latestAttempt.status !== "sent" && latestAttempt.status !== "cancelled" ? (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="mt-2 h-8 rounded-lg px-2 text-destructive"
                                    disabled={cancelDeliveryMutation.isPending}
                                    onClick={() => cancelDeliveryMutation.mutate({
                                      instanceId: instance.id,
                                      attemptId: latestAttempt.id,
                                    })}
                                  >
                                    Cancelar tentativa
                                  </Button>
                                ) : null}
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                <div
                  className={`group relative overflow-hidden rounded-3xl border border-dashed p-8 transition-all ${
                    isDraggingUpload
                      ? "border-primary bg-primary/10 shadow-md"
                      : "border-border bg-muted/20 hover:border-primary/50 hover:bg-primary/[0.03]"
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
                  <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
                  <div className="grid min-h-[260px] items-center gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
                    <div className="flex flex-col items-center justify-center text-center lg:items-start lg:text-left">
                      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/15">
                        <UploadCloud className="h-8 w-8" />
                      </div>
                      <p className="text-2xl font-semibold tracking-tight">
                        {isDraggingUpload ? "Solte os PDFs para adicionar" : "Arraste PDFs para importar"}
                      </p>
                      <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
                        Os arquivos entram na fila de envio para identificar cliente, competência e obrigação correspondente.
                      </p>
                      <div className="mt-5 flex flex-wrap justify-center gap-2 lg:justify-start">
                        <Badge variant="secondary" className="rounded-full">PDFs múltiplos</Badge>
                        <Badge variant="outline" className="rounded-full">Pré-validação</Badge>
                        <Badge variant="outline" className="rounded-full">Baixa operacional</Badge>
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
                      <Button type="button" className="mt-6 rounded-xl" onClick={(event) => {
                        event.stopPropagation();
                        uploadInputRef.current?.click();
                      }}>
                        <UploadCloud className="mr-2 h-4 w-4" />
                        Escolher arquivos
                      </Button>
                    </div>
                    <div className="rounded-2xl border bg-background/80 p-4 shadow-sm">
                      <p className="text-sm font-medium">Como funciona</p>
                      <div className="mt-4 space-y-3 text-sm text-muted-foreground">
                        <div className="flex gap-3">
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">1</span>
                          <span>Selecione ou arraste um ou mais PDFs para a central.</span>
                        </div>
                        <div className="flex gap-3">
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">2</span>
                          <span>O sistema cruza os dados com cliente, competência e obrigação.</span>
                        </div>
                        <div className="flex gap-3">
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">3</span>
                          <span>Documentos reconhecidos dão baixa operacional na tarefa correta.</span>
                        </div>
                      </div>
                    </div>
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
                                <SelectContent><SelectItem value="none">Sem cliente manual</SelectItem>{activeTemplateClients.map((client) => <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>)}</SelectContent>
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

              <div className="space-y-4">
                <div className="rounded-3xl border border-border/70 bg-muted/10 p-5">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">Histórico de envios</p>
                      <p className="text-xs text-muted-foreground">Tentativas recentes preservadas para auditoria.</p>
                    </div>
                    <Badge variant="secondary" className="rounded-full px-3">{deliveryAttempts.length}</Badge>
                  </div>
                  <div className="grid gap-3 lg:grid-cols-2">
                    {deliveryAttempts.slice(0, 12).map((attempt) => (
                      <div key={attempt.id} className="rounded-2xl border border-border/60 bg-background/80 p-3 shadow-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-medium">{attempt.recipient_email}</p>
                          <Badge className="rounded-full" variant={attempt.status === "sent" ? "default" : attempt.status === "failed" ? "destructive" : "outline"}>
                            {attempt.status}
                          </Badge>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">{attempt.subject}</p>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          De: {attempt.verified_from_email} · Reply-to: {attempt.reply_to || "-"} · {formatDateTime(attempt.created_at)}
                        </p>
                        {attempt.failure_reason ? <p className="mt-2 text-xs text-destructive">{attempt.failure_reason}</p> : null}
                      </div>
                    ))}
                    {deliveryAttempts.length === 0 ? (
                      <div className="rounded-2xl border border-dashed bg-background/70 p-6 text-center lg:col-span-2">
                        <p className="text-sm font-medium">Nenhum envio registrado</p>
                        <p className="mt-1 text-xs text-muted-foreground">Quando houver tentativa de envio, ela aparecerá aqui.</p>
                      </div>
                    ) : null}
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
                {templateIsSystemDefault ? (
                  <p className="text-xs text-muted-foreground">
                    Obrigacao padrao do sistema: apenas as mensagens automaticas podem ser editadas. Os demais campos ficam visiveis para conferencia.
                  </p>
                ) : null}
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
            <fieldset disabled={templateIsSystemDefault} className="grid gap-4 md:grid-cols-2 disabled:opacity-80">
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
            </fieldset>
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
                  disabled={templateIsSystemDefault}
                />
              </div>
            </summary>
            <div className="rounded-xl border border-border/60 bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">
                {templateForm.linked_client_ids.length} cliente(s) ativo(s) selecionado(s) para vinculo automatico.
              </p>
            </div>
            {templateClientsQuery.isError ? (
              <p className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
                {templateClientsQuery.error instanceof Error
                  ? templateClientsQuery.error.message
                  : "Nao foi possivel carregar os clientes ativos."}
              </p>
            ) : null}
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
                      <Button type="button" variant="outline" size="sm" className="justify-start rounded-lg" disabled={templateIsSystemDefault} onClick={() => setTemplateRegimeClients(regime.code, true)}>
                        Selecionar todos: {regime.label}
                      </Button>
                      <Button type="button" variant="ghost" size="sm" className="justify-start rounded-lg text-muted-foreground" disabled={templateIsSystemDefault} onClick={() => setTemplateRegimeClients(regime.code, false)}>
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
                      disabled={templateIsSystemDefault}
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
              <Button type="button" variant="outline" className="rounded-xl" disabled={templateIsSystemDefault} onClick={(event) => { event.stopPropagation(); setTemplateForm((prev) => ({ ...prev, expected_documents: [...prev.expected_documents, makeDocumentDraft()] })); }}><Plus className="mr-2 h-4 w-4" />Adicionar documento esperado</Button>
            </summary>
            {templateForm.expected_documents.map((document, index) => (
              <div key={`${document.document_type_key || "novo"}-${index}`} className="rounded-xl border border-border/60 bg-background/70 p-4">
                <div className="grid gap-3 md:grid-cols-[1fr_1fr_120px_auto]">
                  <div className="space-y-2"><Label>Nome</Label><Input value={document.label} disabled={templateIsSystemDefault} onChange={(event) => setTemplateForm((prev) => ({ ...prev, expected_documents: prev.expected_documents.map((current, currentIndex) => currentIndex === index ? { ...current, label: event.target.value, document_type_key: current.document_type_key || slugifyDocumentKey(event.target.value) } : current) }))} /></div>
                  <div className="space-y-2"><Label>Apelidos</Label><Input value={document.aliases_text} disabled={templateIsSystemDefault} onChange={(event) => setTemplateForm((prev) => ({ ...prev, expected_documents: prev.expected_documents.map((current, currentIndex) => currentIndex === index ? { ...current, aliases_text: event.target.value } : current) }))} placeholder="folha, pagamento, holerite" /></div>
                  <div className="space-y-3">
                    <label className="flex items-center justify-between gap-4 text-sm"><span>Obrigatorio</span><input className="h-4 w-4 accent-primary" type="checkbox" checked={document.required} disabled={templateIsSystemDefault} onChange={(event) => setTemplateForm((prev) => ({ ...prev, expected_documents: prev.expected_documents.map((current, currentIndex) => currentIndex === index ? { ...current, required: event.target.checked } : current) }))} /></label>
                    <label className="flex items-center justify-between gap-4 text-sm"><span>Ativo</span><input className="h-4 w-4 accent-primary" type="checkbox" checked={document.active} disabled={templateIsSystemDefault} onChange={(event) => setTemplateForm((prev) => ({ ...prev, expected_documents: prev.expected_documents.map((current, currentIndex) => currentIndex === index ? { ...current, active: event.target.checked } : current) }))} /></label>
                  </div>
                  <div className="flex items-start justify-end">
                    <Button type="button" variant="ghost" size="icon" className="rounded-xl text-destructive" disabled={templateIsSystemDefault} onClick={() => setTemplateForm((prev) => ({ ...prev, expected_documents: prev.expected_documents.length <= 1 ? [makeDocumentDraft()] : prev.expected_documents.filter((_, currentIndex) => currentIndex !== index) }))}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>

                <div className="mt-4 space-y-3 rounded-xl border border-dashed border-border/60 bg-muted/20 p-4">
                  <div className="flex items-center justify-between">
                    <div><p className="text-sm font-medium">Documentos modelo</p><p className="text-xs text-muted-foreground">{document.reference_files_count || 0} arquivo(s) de referencia anexados</p></div>
                    <Input
                      type="file"
                      accept="application/pdf"
                      disabled={templateIsSystemDefault || referenceUploadKey === `${index}`}
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (!file) return;
                        const validationError = validateSecureDocument(file);
                        if (validationError) {
                          toast.error(validationError);
                          event.target.value = "";
                          return;
                        }
                        const inferredLabel = document.label.trim() || fileNameWithoutExtension(file.name);
                        const documentTypeKey = document.document_type_key || slugifyDocumentKey(inferredLabel);
                        if (!document.document_type_key || !document.label.trim()) {
                          setTemplateForm((prev) => ({
                            ...prev,
                            expected_documents: prev.expected_documents.map((current, currentIndex) =>
                              currentIndex === index
                                ? {
                                    ...current,
                                    label: current.label.trim() || inferredLabel,
                                    document_type_key: current.document_type_key || documentTypeKey,
                                  }
                                : current,
                            ),
                          }));
                        }
                        if (!templateForm.id || !document.document_type_key) {
                          setPendingReferenceFiles((prev) => ({
                            ...prev,
                            [documentTypeKey]: [file],
                          }));
                          toast.success("PDF modelo selecionado. Ele sera anexado ao salvar a obrigacao.");
                          event.target.value = "";
                          return;
                        }
                        setReferenceUploadKey(`${index}`);
                        uploadReferenceMutation.mutate({
                          templateId: templateForm.id,
                          documentTypeKey,
                          file,
                        });
                      }}
                    />
                  </div>
                  {(pendingReferenceFiles[document.document_type_key || slugifyDocumentKey(document.label)] || []).length > 0 ? (
                    <div className="space-y-2">
                      {(pendingReferenceFiles[document.document_type_key || slugifyDocumentKey(document.label)] || []).map((file) => (
                        <div key={`${document.document_type_key || slugifyDocumentKey(document.label)}-${file.name}`} className="flex items-center justify-between rounded-2xl border border-primary/30 bg-primary/10 p-3">
                          <div className="space-y-1">
                            <p className="text-sm font-medium">{file.name}</p>
                            <p className="text-xs text-muted-foreground">Pendente para anexar ao salvar a obrigacao.</p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="rounded-xl text-destructive"
                            onClick={() =>
                              setPendingReferenceFiles((prev) => {
                                const next = { ...prev };
                                delete next[document.document_type_key || slugifyDocumentKey(document.label)];
                                return next;
                              })
                            }
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {(document.reference_files || []).length > 0 ? (
                    <div className="space-y-2">
                      {(document.reference_files || []).map((reference) => (
                        <div key={reference.id} className="flex items-center justify-between rounded-2xl border border-border/60 bg-background/70 p-3">
                          <div className="space-y-1">
                            <p className="text-sm font-medium">{reference.file_name}</p>
                            <p className="text-xs text-muted-foreground">Texto: {reference.text_extraction_status} · OCR: {reference.ocr_status}</p>
                          </div>
                          <Button variant="ghost" size="icon" className="rounded-xl text-destructive" disabled={templateIsSystemDefault} onClick={() => deleteReferenceMutation.mutate(reference.id)}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      ))}
                    </div>
                  ) : (pendingReferenceFiles[document.document_type_key || slugifyDocumentKey(document.label)] || []).length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      {templateForm.id
                        ? "Anexe pelo menos um PDF modelo para habilitar o matching automatico."
                        : "Escolha o PDF modelo agora; ele sera anexado automaticamente ao salvar a obrigacao."}
                    </p>
                  ) : null}
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
                  disabled={templateIsSystemDefault}
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
                setPendingReferenceFiles({});
              }}
            >Cancelar</Button>
            {templateValidationError && <p className="mr-auto text-sm text-orange-600">{templateValidationError}</p>}
            <Button onClick={() => templateMutation.mutate(templateForm)} disabled={templateMutation.isPending || Boolean(templateValidationError)}>{templateMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Salvar template</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(templateDeleteTarget)} onOpenChange={(open) => !open && setTemplateDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir obrigacao?</AlertDialogTitle>
            <AlertDialogDescription>
              {templateDeleteTarget ? (
                <>
                  A obrigacao "{templateDeleteTarget.name}" sera removida do controle ativo. Se houver historico, ela sera inativada,
                  os vinculos com clientes serao encerrados e as competencias abertas serao canceladas.
                </>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {templateDeleteTarget ? (
            <div className="rounded-xl border border-border/70 bg-muted/30 p-3 text-sm text-muted-foreground">
              Clientes vinculados: {buildTemplateLinkedClientIds(overview?.profiles, templateDeleteTarget.id).length}
            </div>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteTemplateMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteTemplateMutation.isPending || !templateDeleteTarget}
              onClick={(event) => {
                event.preventDefault();
                if (templateDeleteTarget) deleteTemplateMutation.mutate(templateDeleteTarget.id);
              }}
            >
              {deleteTemplateMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
              Excluir obrigacao
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
