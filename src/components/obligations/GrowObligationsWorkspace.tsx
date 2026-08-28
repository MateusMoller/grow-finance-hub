import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  LayoutDashboard,
  LibraryBig,
  Download,
  Eye,
  FileText,
  FileSpreadsheet,
  FolderUp,
  Loader2,
  Mail,
  MessageCircle,
  MousePointer2,
  Paperclip,
  Plus,
  RefreshCcw,
  Search,
  Settings2,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  UploadCloud,
  Users,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { toast } from "sonner";

import { ModuleContextPill } from "@/components/app/ModuleContextPill";
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
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { analyzePdfDocument, type AnalyzedDocument } from "@/lib/documentRecognition";
import { loadPdfJsClient } from "@/lib/pdfJsClient";
import {
  groupCentralDeliveries,
  type ProcessedCentralDocument,
} from "@/lib/obligationCentralDelivery";
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
  type GrowObligationDeliveryAttempt,
  type GrowObligationTemplate,
  type GrowObligationsOverviewPayload,
} from "@/lib/growObligations";
import { supabase } from "@/integrations/supabase/client";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { TemplateMessageAssetsField } from "@/components/obligations/TemplateMessageAssetsField";
import { ObligationsDashboard } from "@/components/obligations/ObligationsDashboard";
import { FactorRObligationAlert } from "@/components/obligations/FactorRObligationAlert";

type WorkspaceTab = "dashboard" | "catalogo" | "documentos" | "entregas";
type MatchStrategy = "manual_instance" | "direct_expected_doc" | "alias_match" | "single_open_instance" | "manual_review";

const showLocalRobotPanel = false;
const robotInstallerDownloadUrl = `${import.meta.env.BASE_URL}downloads/instalar-robo-grow.cmd`;

interface GrowObligationsWorkspaceProps {
  defaultTab?: WorkspaceTab;
  initialClientId?: string | null;
  initialInstanceId?: string | null;
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
  due_rule_type: GrowObligationTemplate["due_rule_type"];
  due_date_adjustment_policy: GrowObligationTemplate["due_date_adjustment_policy"];
  due_business_day_index: string;
  due_fixed_month: string;
  due_fixed_day: string;
  due_fixed_dates: Array<{ month: string; day: string; label: string }>;
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
  linked_profiles?: number;
  generation_warnings?: string[];
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
  competenceManuallyEdited: boolean;
  notes: string;
  preview: ReferenceMatchPreview | null;
  previewError: string | null;
  isPreviewing: boolean;
  obligationSelectionConfirmed: boolean;
}

const DOCUMENT_LINK_PLACEHOLDER = "{{documento_link}}";

function hasRequiredDocumentLinkPlaceholder(message: string) {
  return message.includes(DOCUMENT_LINK_PLACEHOLDER);
}

const workspaceTabs = [
  { value: "dashboard" as const, label: "Dashboard", description: "Visão geral e próximos prazos", icon: LayoutDashboard },
  { value: "catalogo" as const, label: "Catálogo", description: "Regras e obrigações padrão", icon: LibraryBig },
  { value: "documentos" as const, label: "Central de documentos", description: "Reconhecimento e envio de arquivos", icon: FolderUp },
  { value: "entregas" as const, label: "Lista de entregas", description: "Acompanhamento por cliente", icon: ClipboardList },
];

interface ObligationMatchCandidate {
  templateId: string;
  templateName: string;
  documentTypeKey: string;
  documentLabel: string;
  score: number;
  reasons: string[];
  candidateInstanceIds: string[];
}

interface DocumentSelectOption {
  optionKey: string;
  label: string;
  templateId: string;
  documentTypeKey: string;
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
    obligationCandidates?: ObligationMatchCandidate[];
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

type ExtractionZoneField = "cpf" | "cnpj" | "competence" | "title";

interface ExtractionZoneCircle {
  field: ExtractionZoneField;
  label: string;
  page: number;
  shape: "rounded_rect";
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ReferenceExtractionZones {
  version: number;
  zones: ExtractionZoneCircle[];
}

type ReferencePreviewTarget =
  | {
      kind: "pending";
      documentTypeKey: string;
      fileName: string;
      file: File;
      zones: ReferenceExtractionZones;
    }
  | {
      kind: "saved";
      documentTypeKey: string;
      reference: GrowExpectedDocumentReferenceFile;
      zones: ReferenceExtractionZones;
    };

const sectors = ["Contabil", "Fiscal", "Departamento Pessoal", "Comercial", "Societario", "Geral"];
const periodicities: GrowObligationTemplate["periodicity"][] = ["monthly", "quarterly", "yearly", "custom"];
const priorities: GrowObligationInstance["priority"][] = ["baixa", "media", "alta", "urgente"];
const dueRuleTypes: GrowObligationTemplate["due_rule_type"][] = [
  "calendar_day",
  "business_day_from_month_start",
  "last_business_day",
  "fixed_date",
];
const dueRuleTypeLabel: Record<GrowObligationTemplate["due_rule_type"], string> = {
  calendar_day: "Dia corrido do mês",
  business_day_from_month_start: "Dia útil a partir do início do mês",
  last_business_day: "Último dia útil do mês",
  fixed_date: "Data fixa anual",
};
const dueRuleTypeDescription: Record<GrowObligationTemplate["due_rule_type"], string> = {
  calendar_day: "Use para vencimentos em uma data numérica do mês, como dia 10 ou dia 20.",
  business_day_from_month_start: "Use para regras como 5º dia útil. Sábados e domingos são ignorados.",
  last_business_day: "Use quando o prazo vence no último dia útil do mês.",
  fixed_date: "Use para obrigações anuais com dia e mês específicos, como 31 de maio.",
};
const monthOptions = [
  { value: "1", label: "Janeiro" },
  { value: "2", label: "Fevereiro" },
  { value: "3", label: "Março" },
  { value: "4", label: "Abril" },
  { value: "5", label: "Maio" },
  { value: "6", label: "Junho" },
  { value: "7", label: "Julho" },
  { value: "8", label: "Agosto" },
  { value: "9", label: "Setembro" },
  { value: "10", label: "Outubro" },
  { value: "11", label: "Novembro" },
  { value: "12", label: "Dezembro" },
];
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

const extractionZoneFieldLabels: Record<ExtractionZoneField, string> = {
  cpf: "CPF",
  cnpj: "CNPJ",
  competence: "Competência",
  title: "Título",
};
const dueDateAdjustmentPolicyLabels: Record<GrowObligationTemplate["due_date_adjustment_policy"], string> = {
  none: "Manter a data cadastrada",
  previous_business_day: "Antecipar para o dia útil anterior",
  next_business_day: "Postergar para o próximo dia útil",
};

const defaultExtractionZones: ReferenceExtractionZones = {
  version: 1,
  zones: [
    { field: "cpf", label: "CPF", page: 1, shape: "rounded_rect", x: 0.3, y: 0.22, width: 0.24, height: 0.08 },
    { field: "competence", label: "Competência", page: 1, shape: "rounded_rect", x: 0.68, y: 0.22, width: 0.22, height: 0.08 },
    { field: "title", label: "Título", page: 1, shape: "rounded_rect", x: 0.5, y: 0.1, width: 0.5, height: 0.08 },
  ],
};

function cloneExtractionZones(zones: ReferenceExtractionZones): ReferenceExtractionZones {
  return {
    version: zones.version || 1,
    zones: zones.zones.map((zone) => ({ ...zone })),
  };
}

function clampNormalized(value: number, min = 0, max = 1) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function normalizeExtractionZones(value: unknown): ReferenceExtractionZones {
  const record = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const rawZones = Array.isArray(record.zones) ? record.zones : [];
  const zonesByField = new Map<ExtractionZoneField, ExtractionZoneCircle>();

  for (const item of rawZones) {
    if (!item || typeof item !== "object") continue;
    const zone = item as Record<string, unknown>;
    const field = zone.field === "cpf" || zone.field === "cnpj" || zone.field === "competence" || zone.field === "title" ? zone.field : null;
    if (!field) continue;
    const legacyRadius = Number(zone.r);
    const width = Number(zone.width);
    const height = Number(zone.height);
    zonesByField.set(field, {
      field,
      label: typeof zone.label === "string" && zone.label.trim() ? zone.label.trim() : extractionZoneFieldLabels[field],
      page: Math.max(1, Math.round(Number(zone.page) || 1)),
      shape: "rounded_rect",
      x: clampNormalized(Number(zone.x), 0.02, 0.98),
      y: clampNormalized(Number(zone.y), 0.02, 0.98),
      width: clampNormalized(Number.isFinite(width) ? width : legacyRadius * 2 || 0.24, 0.06, 0.7),
      height: clampNormalized(Number.isFinite(height) ? height : legacyRadius * 2 || 0.08, 0.02, 0.35),
    });
  }

  return {
    version: 1,
    zones: defaultExtractionZones.zones.map((fallback) =>
      zonesByField.get(fallback.field) || (fallback.field === "cpf" ? zonesByField.get("cnpj") : undefined) || { ...fallback },
    ),
  };
}

function getReferenceExtractionZones(reference: GrowExpectedDocumentReferenceFile): ReferenceExtractionZones {
  const payload = reference.fingerprint_payload || {};
  return normalizeExtractionZones((payload as Record<string, unknown>).extraction_zones);
}

function mergeExtractionZonesIntoFingerprint(
  fingerprintPayload: Record<string, unknown>,
  zones?: ReferenceExtractionZones | null,
) {
  if (!zones) return fingerprintPayload;
  return {
    ...fingerprintPayload,
    extraction_zones: cloneExtractionZones(zones),
  };
}

async function renderPdfFirstPageToCanvas(fileData: ArrayBuffer, canvas: HTMLCanvasElement) {
  const pdfModule = await loadPdfJsClient();

  const documentTask = pdfModule.getDocument({ data: new Uint8Array(fileData) });
  const pdf = await documentTask.promise;
  try {
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 1.35 });
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas indisponível para pré-visualização.");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    canvas.style.width = "100%";
    canvas.style.height = "auto";
    await page.render({ canvasContext: context, viewport }).promise;
    return { width: canvas.width, height: canvas.height };
  } finally {
    await pdf.destroy();
  }
}

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

type LocalDocumentFamily = "salary_receipt" | "fgts" | "inss" | "pis_cofins" | "irpj_csll" | "icms";

const localDocumentFamilyAliases: Array<{ family: LocalDocumentFamily; aliases: string[] }> = [
  {
    family: "salary_receipt",
    aliases: [
      "recibo_salario",
      "recibo_de_salario",
      "recsal",
      "rec_sal",
      "recibo",
      "holerite",
      "contracheque",
      "demonstrativo_pagamento",
      "demonstrativo_de_pagamento",
      "recibo_pagamento_salario",
      "salario",
      "folha_pagamento",
      "folha_de_pagamento",
    ],
  },
  { family: "fgts", aliases: ["fgts", "guia_fgts", "fgts_digital", "grf", "guia_recolhimento_fgts"] },
  { family: "inss", aliases: ["inss", "gps", "guia_inss", "previdencia_social", "contribuicao_previdenciaria"] },
  { family: "pis_cofins", aliases: ["pis", "cofins", "pis_cofins", "darf_pis", "darf_cofins"] },
  { family: "irpj_csll", aliases: ["irpj", "csll", "irpj_csll", "darf_irpj", "darf_csll"] },
  { family: "icms", aliases: ["icms", "efd_icms", "gia", "guia_icms"] },
];

function detectLocalDocumentFamilies(...sources: unknown[]) {
  const haystack = sources
    .flatMap((source) => Array.isArray(source) ? source : [source])
    .map((source) => slugifyDocumentKey(String(source || "")))
    .filter(Boolean)
    .join("_");
  const families = new Set<LocalDocumentFamily>();
  if (!haystack) return families;

  for (const entry of localDocumentFamilyAliases) {
    if (entry.aliases.some((alias) => haystack.includes(slugifyDocumentKey(alias)))) {
      families.add(entry.family);
    }
  }
  return families;
}

function hasFamilyOverlap(left: Set<LocalDocumentFamily>, right: Set<LocalDocumentFamily>) {
  for (const family of left) {
    if (right.has(family)) return true;
  }
  return false;
}

function scoreLocalDocumentCandidate(
  template: GrowObligationTemplate,
  document: GrowExpectedDocument,
  searchableText: string,
  detectedFamilies: Set<LocalDocumentFamily>,
) {
  const documentTokens = [document.label, document.document_type_key, ...document.aliases]
    .map((value) => slugifyDocumentKey(String(value || "")))
    .filter((value) => value.length >= 2);
  const templateTokens = [template.code, template.name]
    .map((value) => slugifyDocumentKey(String(value || "")))
    .filter((value) => value.length >= 2);
  const candidateFamilies = detectLocalDocumentFamilies(
    template.code,
    template.name,
    document.label,
    document.document_type_key,
    document.aliases,
  );
  const familyMatched = hasFamilyOverlap(detectedFamilies, candidateFamilies);
  const familyMismatched = detectedFamilies.size > 0 && candidateFamilies.size > 0 && !familyMatched;
  const familyRequiredButUnknown = detectedFamilies.size > 0 && candidateFamilies.size === 0;
  const documentTokenMatched = documentTokens.some((token) => searchableText.includes(token));
  const templateTokenMatched = templateTokens.some((token) => searchableText.includes(token));

  let score = 0;
  if (familyMatched) score += 100;
  if (documentTokenMatched) score += 30;
  if (templateTokenMatched) score += 8;
  if (document.has_active_reference) score += 4;
  if (document.active) score += 2;
  if (familyMismatched) score -= 1_000;
  if (familyRequiredButUnknown) score -= 500;

  return { score, familyMatched, documentTokenMatched };
}

function makeFixedDateDraft(month = "", day = "", label = "") {
  return { month, day, label };
}

function normalizeFixedDateDrafts(template?: GrowObligationTemplate | null) {
  const fixedDates = Array.isArray(template?.due_fixed_dates)
    ? template.due_fixed_dates
        .map((item) => ({
          month: Number(item?.month || 0),
          day: Number(item?.day || 0),
          label: String(item?.label || ""),
        }))
        .filter((item) => item.month >= 1 && item.month <= 12 && item.day >= 1 && item.day <= 31)
    : [];

  if (fixedDates.length > 0) {
    return fixedDates.map((item) => makeFixedDateDraft(String(item.month), String(item.day), item.label));
  }

  if (template?.due_fixed_month || template?.due_fixed_day || template?.yearly_due_month) {
    return [
      makeFixedDateDraft(
        template?.due_fixed_month ? String(template.due_fixed_month) : template?.yearly_due_month ? String(template.yearly_due_month) : "",
        template?.due_fixed_day ? String(template.due_fixed_day) : template?.due_day ? String(template.due_day) : "",
      ),
    ];
  }

  return [makeFixedDateDraft()];
}

function sanitizeFixedDates(dates: TemplateFormState["due_fixed_dates"]) {
  const used = new Set<string>();
  return dates
    .map((date) => ({
      month: Number(date.month || 0),
      day: Number(date.day || 0),
      label: date.label.trim(),
    }))
    .filter((date) => {
      if (date.month < 1 || date.month > 12 || date.day < 1 || date.day > 31) return false;
      const key = `${date.month}-${date.day}`;
      if (used.has(key)) return false;
      used.add(key);
      return true;
    })
    .sort((left, right) => left.month - right.month || left.day - right.day)
    .map((date) => ({
      month: date.month,
      day: date.day,
      ...(date.label ? { label: date.label } : {}),
    }));
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

function ReferenceDocumentPreviewDialog({
  target,
  open,
  saving,
  onOpenChange,
  onSave,
}: {
  target: ReferencePreviewTarget | null;
  open: boolean;
  saving: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (zones: ReferenceExtractionZones) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<{ field: ExtractionZoneField; mode: "move" | "resize" } | null>(null);
  const [zones, setZones] = useState<ReferenceExtractionZones>(() => cloneExtractionZones(defaultExtractionZones));
  const [activeField, setActiveField] = useState<ExtractionZoneField>("cnpj");
  const [renderError, setRenderError] = useState<string | null>(null);
  const [isRendering, setIsRendering] = useState(false);
  const [, setPageSize] = useState({ width: 1, height: 1 });
  const [previewZoom, setPreviewZoom] = useState(100);

  useEffect(() => {
    if (!target || !open) return;
    setZones(cloneExtractionZones(target.zones));
    setActiveField("cnpj");
    setPreviewZoom(100);
  }, [open, target]);

  useEffect(() => {
    if (!target || !open) return;
    let cancelled = false;

    async function loadPreview() {
      setIsRendering(true);
      setRenderError(null);
      try {
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        const canvas = canvasRef.current;
        if (!canvas) throw new Error("Área de pré-visualização ainda não está pronta. Tente abrir novamente.");
        let data: ArrayBuffer;
        if (target.kind === "pending") {
          data = await target.file.arrayBuffer();
        } else {
          const { data: blob, error } = await supabase.storage
            .from(target.reference.storage_bucket || "obligation-files")
            .download(target.reference.storage_path);
          if (error || !blob) throw error || new Error("Não foi possível abrir o PDF modelo.");
          data = await blob.arrayBuffer();
        }
        const renderedSize = await renderPdfFirstPageToCanvas(data, canvas);
        if (!cancelled) setPageSize(renderedSize);
      } catch (error) {
        if (!cancelled) {
          setRenderError(error instanceof Error ? error.message : "Falha ao carregar a pré-visualização.");
        }
      } finally {
        if (!cancelled) setIsRendering(false);
      }
    }

    void loadPreview();
    return () => {
      cancelled = true;
    };
  }, [open, target]);

  const activeZone = zones.zones.find((zone) => zone.field === activeField) || zones.zones[0];

  const updateZone = (field: ExtractionZoneField, updater: (zone: ExtractionZoneCircle) => ExtractionZoneCircle) => {
    setZones((current) => ({
      ...current,
      zones: current.zones.map((zone) => (zone.field === field ? updater(zone) : zone)),
    }));
  };

  const pointerPositionToNormalized = (event: PointerEvent | ReactPointerEvent) => {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) return null;
    return {
      x: clampNormalized((event.clientX - rect.left) / rect.width, 0.02, 0.98),
      y: clampNormalized((event.clientY - rect.top) / rect.height, 0.02, 0.98),
      rect,
    };
  };

  const handlePointerMove = (event: PointerEvent) => {
    const dragState = dragStateRef.current;
    if (!dragState) return;
    const position = pointerPositionToNormalized(event);
    if (!position) return;
    updateZone(dragState.field, (zone) => {
      if (dragState.mode === "move") {
        return {
          ...zone,
          x: clampNormalized(position.x, zone.width / 2, 1 - zone.width / 2),
          y: clampNormalized(position.y, zone.height / 2, 1 - zone.height / 2),
        };
      }
      const nextWidth = Math.abs(position.x - zone.x) * 2;
      const nextHeight = Math.abs(position.y - zone.y) * 2;
      return {
        ...zone,
        width: clampNormalized(nextWidth, 0.06, 0.7),
        height: clampNormalized(nextHeight, 0.02, 0.35),
      };
    });
  };

  const stopDrag = () => {
    dragStateRef.current = null;
    window.removeEventListener("pointermove", handlePointerMove);
    window.removeEventListener("pointerup", stopDrag);
  };

  const startDrag = (event: ReactPointerEvent, field: ExtractionZoneField, mode: "move" | "resize") => {
    event.preventDefault();
    event.stopPropagation();
    setActiveField(field);
    dragStateRef.current = { field, mode };
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopDrag);
  };

  const handlePreviewWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    if (!event.ctrlKey) return;
    event.preventDefault();
    const direction = event.deltaY > 0 ? -25 : 25;
    setPreviewZoom((value) => Math.max(75, Math.min(200, value + direction)));
  };

  useEffect(
    () => () => {
      dragStateRef.current = null;
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", stopDrag);
    },
    // The cleanup only protects an active pointer drag during unmount; live handlers are registered per drag gesture.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex h-[94vh] max-w-6xl flex-col overflow-hidden p-0"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
        onWheel={(event) => event.stopPropagation()}
      >
        <DialogHeader className="shrink-0 border-b border-border/70 bg-background px-6 py-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <DialogTitle>Marcação de leitura do documento</DialogTitle>
              <DialogDescription className="mt-1 max-w-2xl">
                Defina onde o robô deve ler CNPJ, competência e título. O título auxilia a reconhecer a obrigação correta.
              </DialogDescription>
            </div>
            <div className="flex shrink-0 items-center gap-2 rounded-full border border-border/70 bg-muted/40 px-3 py-1 text-xs text-muted-foreground">
              <span className="h-2 w-2 rounded-full bg-sky-500" />
              CNPJ
              <span className="ml-2 h-2 w-2 rounded-full bg-amber-500" />
              Competência
              <span className="ml-2 h-2 w-2 rounded-full bg-violet-500" />
              Título
            </div>
          </div>
        </DialogHeader>
        <div className="grid min-h-0 flex-1 gap-0 overflow-hidden md:grid-cols-[minmax(0,1fr)_260px]">
          <div className="h-full min-h-0 overflow-auto overscroll-contain bg-slate-100/70 p-5" onWheel={handlePreviewWheel}>
            <div
              ref={stageRef}
              className="relative mx-auto rounded-xl border border-border bg-white shadow-sm"
              style={{
                width: `${previewZoom}%`,
                minWidth: previewZoom > 100 ? "760px" : undefined,
                maxWidth: previewZoom <= 100 ? "760px" : "none",
              }}
            >
              <canvas ref={canvasRef} className="block rounded-xl" />
              {isRendering ? (
                <div className="absolute inset-0 grid place-items-center rounded-xl bg-background/70 text-sm text-muted-foreground">
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                  Carregando prévia...
                </div>
              ) : null}
              {renderError ? (
                <div className="absolute inset-0 grid place-items-center rounded-xl bg-background/90 p-6 text-center text-sm text-destructive">
                  {renderError}
                </div>
              ) : null}
              {!renderError
                ? zones.zones.map((zone) => {
                    const selected = zone.field === activeField;
                    return (
                      <div
                        key={zone.field}
                        className={`absolute cursor-move rounded-lg border-2 transition-shadow ${
                          zone.field === "cnpj"
                            ? "border-sky-500 bg-sky-500/10 shadow-[0_0_0_9999px_rgba(14,165,233,0.015)]"
                            : zone.field === "competence"
                              ? "border-amber-500 bg-amber-500/10 shadow-[0_0_0_9999px_rgba(245,158,11,0.015)]"
                              : "border-violet-500 bg-violet-500/10 shadow-[0_0_0_9999px_rgba(139,92,246,0.015)]"
                        } ${selected ? "ring-4 ring-primary/20" : "hover:ring-2 hover:ring-primary/10"}`}
                        style={{
                          left: `${(zone.x - zone.width / 2) * 100}%`,
                          top: `${(zone.y - zone.height / 2) * 100}%`,
                          width: `${zone.width * 100}%`,
                          height: `${zone.height * 100}%`,
                        }}
                        onPointerDown={(event) => startDrag(event, zone.field, "move")}
                      >
                        <span
                          className={`absolute -top-7 left-0 rounded-full px-2 py-0.5 text-xs font-medium text-white shadow-sm ${
                            zone.field === "cnpj" ? "bg-sky-600" : zone.field === "competence" ? "bg-amber-600" : "bg-violet-600"
                          }`}
                        >
                          {zone.label}
                        </span>
                        <button
                          type="button"
                          aria-label={`Redimensionar ${zone.label}`}
                          className="absolute bottom-0 right-0 h-4 w-4 translate-x-1/2 translate-y-1/2 cursor-nwse-resize rounded-md border border-background bg-primary shadow"
                          onPointerDown={(event) => startDrag(event, zone.field, "resize")}
                        />
                      </div>
                    );
                  })
                : null}
            </div>
          </div>
          <aside className="h-full min-h-0 space-y-3 overflow-y-auto overscroll-contain border-t border-border/70 bg-background p-3 md:border-l md:border-t-0">
            <div className="rounded-xl border border-border/70 bg-muted/25 px-3 py-2">
              <p className="truncate text-sm font-medium" title={target?.kind === "saved" ? target.reference.file_name : target?.fileName}>
                {target?.kind === "saved" ? target.reference.file_name : target?.fileName}
              </p>
            </div>
            <div className="space-y-1.5">
              <p className="px-1 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Leitura</p>
              {zones.zones.map((zone) => (
                <Button
                  key={zone.field}
                  type="button"
                  variant={activeField === zone.field ? "default" : "outline"}
                  className="h-11 w-full justify-start rounded-xl px-3"
                  onClick={() => setActiveField(zone.field)}
                >
                  <span className={`mr-2 h-2.5 w-2.5 rounded-full ${zone.field === "cnpj" ? "bg-sky-500" : zone.field === "competence" ? "bg-amber-500" : "bg-violet-500"}`} />
                  <span className="flex flex-col items-start">
                    <span className="text-sm">{zone.label}</span>
                    <span className="text-xs font-normal opacity-75">
                      {Math.round(zone.width * 100)}% x {Math.round(zone.height * 100)}%
                    </span>
                  </span>
                </Button>
              ))}
            </div>
            <div className="rounded-xl border border-border/70 bg-background p-3">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                <ZoomIn className="h-4 w-4 text-primary" />
                Zoom
              </div>
              <div className="mb-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 rounded-lg"
                    onClick={() => setPreviewZoom((value) => Math.max(75, value - 25))}
                    disabled={previewZoom <= 75}
                    aria-label="Reduzir zoom"
                  >
                    <ZoomOut className="h-4 w-4" />
                  </Button>
                  <Slider
                    value={[previewZoom]}
                    min={75}
                    max={200}
                    step={25}
                    onValueChange={([value]) => setPreviewZoom(value)}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 rounded-lg"
                    onClick={() => setPreviewZoom((value) => Math.min(200, value + 25))}
                    disabled={previewZoom >= 200}
                    aria-label="Aumentar zoom"
                  >
                    <ZoomIn className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                <MousePointer2 className="h-4 w-4 text-primary" />
                Ajuste
              </div>
              <div className="space-y-3">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Largura</span>
                    <span>{Math.round((activeZone?.width || 0) * 100)}%</span>
                  </div>
                  <Slider
                    value={[Math.round((activeZone?.width || 0.24) * 100)]}
                    min={6}
                    max={70}
                    step={1}
                    onValueChange={([value]) =>
                      updateZone(activeField, (zone) => ({
                        ...zone,
                        width: clampNormalized(value / 100, 0.06, 0.7),
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Altura</span>
                    <span>{Math.round((activeZone?.height || 0) * 100)}%</span>
                  </div>
                  <Slider
                    value={[Math.round((activeZone?.height || 0.08) * 100)]}
                    min={2}
                    max={35}
                    step={1}
                    onValueChange={([value]) =>
                      updateZone(activeField, (zone) => ({
                        ...zone,
                        height: clampNormalized(value / 100, 0.02, 0.35),
                      }))
                    }
                  />
                </div>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full rounded-xl"
              onClick={() => {
                setZones(cloneExtractionZones(defaultExtractionZones));
                setActiveField("cnpj");
                setPreviewZoom(100);
              }}
            >
              <RefreshCcw className="mr-2 h-4 w-4" />
              Restaurar padrão
            </Button>
          </aside>
        </div>
        <DialogFooter className="shrink-0 border-t border-border/70 px-6 py-4">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" onClick={() => onSave(zones)} disabled={saving || Boolean(renderError)}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Salvar marcações
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
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
    due_rule_type: template?.due_rule_type || "calendar_day",
    due_date_adjustment_policy: template?.due_date_adjustment_policy || "none",
    due_business_day_index: template?.due_business_day_index ? String(template.due_business_day_index) : "",
    due_fixed_month: template?.due_fixed_month ? String(template.due_fixed_month) : template?.yearly_due_month ? String(template.yearly_due_month) : "",
    due_fixed_day: template?.due_fixed_day ? String(template.due_fixed_day) : "",
    due_fixed_dates: normalizeFixedDateDrafts(template),
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

function configuredExtractionZoneFields(reference: GrowExpectedDocumentReferenceFile) {
  const extractionZones = reference.fingerprint_payload?.extraction_zones;
  if (!extractionZones || typeof extractionZones !== "object") return new Set<ExtractionZoneField>();
  const rawZones = Array.isArray((extractionZones as Record<string, unknown>).zones)
    ? (extractionZones as Record<string, unknown>).zones as unknown[]
    : [];
  return new Set(rawZones.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const field = (item as Record<string, unknown>).field;
    return field === "cpf" || field === "cnpj" || field === "competence" || field === "title"
      ? [field]
      : [];
  }));
}

type DeliveryInstanceFile = {
  id: string;
  file_name: string;
  file_size: number | null;
  storage_bucket: string;
  storage_path: string;
  protocol_number: string | null;
  publication_status: string;
  triage_status: string;
  created_at: string;
};

type DeliveryInstanceEvent = {
  id: string;
  event_type: string;
  from_status: string | null;
  to_status: string | null;
  comment: string | null;
  created_at: string;
};

type DeliveryDocumentAccess = {
  id: string;
  file_id: string;
  access_type: string;
  access_channel: string;
  user_agent: string | null;
  accessed_at: string;
};

type DeliveryInstanceDetails = {
  files: DeliveryInstanceFile[];
  events: DeliveryInstanceEvent[];
  accessEvents: DeliveryDocumentAccess[];
};

const deliveryAttemptStatusLabel: Record<GrowObligationDeliveryAttempt["status"], string> = {
  queued: "Na fila",
  sending: "Enviando",
  sent: "Enviado",
  failed: "Falhou",
  cancelled: "Cancelado",
};

async function loadDeliveryInstanceDetails(instanceId: string): Promise<DeliveryInstanceDetails> {
  const organizationId = await getStoredCurrentOrganizationId();
  if (!organizationId) throw new Error("Organização ativa não encontrada.");

  const [filesResult, eventsResult, accessResult] = await Promise.all([
    supabase
      .from("obligation_instance_files")
      .select("id, file_name, file_size, storage_bucket, storage_path, protocol_number, publication_status, triage_status, created_at")
      .eq("organization_id", organizationId)
      .eq("instance_id", instanceId)
      .order("created_at", { ascending: false }),
    supabase
      .from("obligation_instance_events")
      .select("id, event_type, from_status, to_status, comment, created_at")
      .eq("organization_id", organizationId)
      .eq("instance_id", instanceId)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("obligation_document_access_events")
      .select("id, file_id, access_type, access_channel, user_agent, accessed_at")
      .eq("organization_id", organizationId)
      .eq("instance_id", instanceId)
      .order("accessed_at", { ascending: false })
      .limit(30),
  ]);

  if (filesResult.error) throw filesResult.error;
  if (eventsResult.error) throw eventsResult.error;
  if (accessResult.error) {
    console.warn("Histórico de leitura indisponível; carregando os demais detalhes da entrega.", accessResult.error);
  }
  return {
    files: (filesResult.data || []) as DeliveryInstanceFile[],
    events: (eventsResult.data || []) as DeliveryInstanceEvent[],
    accessEvents: accessResult.error ? [] : (accessResult.data || []) as DeliveryDocumentAccess[],
  };
}

function documentAccessChannelLabel(channel: string) {
  if (channel === "email_link") return "Link por e-mail";
  if (channel === "whatsapp_link") return "Link pelo WhatsApp";
  if (channel === "direct_link") return "Link direto";
  return "Portal do cliente";
}

function accessDeviceLabel(userAgent: string | null) {
  if (!userAgent) return "Dispositivo não identificado";
  const browser = /Edg\//.test(userAgent) ? "Edge" : /Chrome\//.test(userAgent) ? "Chrome" : /Firefox\//.test(userAgent) ? "Firefox" : /Safari\//.test(userAgent) ? "Safari" : "Navegador";
  const device = /Android|iPhone|iPad|Mobile/i.test(userAgent) ? "celular" : "computador";
  return `${browser} em ${device}`;
}

async function openDeliveryFile(file: DeliveryInstanceFile) {
  const { data, error } = await supabase.storage.from(file.storage_bucket).createSignedUrl(file.storage_path, 60);
  if (error || !data?.signedUrl) throw error || new Error("Não foi possível abrir o arquivo.");
  window.open(data.signedUrl, "_blank", "noopener,noreferrer");
}

function DeliveryListItem({
  instance,
  onEdit,
  initiallyOpen = false,
}: {
  instance: GrowObligationInstance;
  onEdit: (instance: GrowObligationInstance) => void;
  initiallyOpen?: boolean;
}) {
  const [open, setOpen] = useState(initiallyOpen);
  const detailQuery = useQuery({
    queryKey: ["grow-obligations", "delivery-detail", instance.id],
    queryFn: () => loadDeliveryInstanceDetails(instance.id),
    enabled: open,
    staleTime: 60_000,
  });
  const attempts = instance.delivery_attempts || [];
  const latestAttempt = instance.latest_delivery_attempt || attempts[0] || null;

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm transition-all hover:border-primary/20 hover:shadow-md">
      <CollapsibleTrigger className="group flex w-full flex-col gap-3 p-4 text-left transition-colors hover:bg-primary/[0.025] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:p-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><FileText className="h-4 w-4" aria-hidden="true" /></span>
            <p className="font-semibold">{instance.template?.name || "Obrigação"}</p>
            <Badge className={`border-0 ${growObligationStatusClass[instance.status]}`}>{growObligationStatusLabel[instance.status]}</Badge>
            <Badge variant="outline">{growPriorityLabel[instance.priority]}</Badge>
          </div>
          <p className="pl-0 text-sm text-muted-foreground sm:pl-12">{instance.client?.name || "Cliente"} · competência {instance.competence_label}</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 pl-0 text-xs text-muted-foreground sm:pl-12">
            <span>Vencimento: {formatDate(instance.technical_due_date)}</span>
            <span>Setor: {instance.template?.sector || "Geral"}</span>
            <span>Envio: {latestAttempt ? deliveryAttemptStatusLabel[latestAttempt.status] : "Não realizado"}</span>
          </div>
        </div>
        <span className="flex shrink-0 items-center gap-2 text-sm font-medium text-primary">
          {open ? "Ocultar informações" : "Ver informações de envio"}
          <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]:rotate-180" />
        </span>
      </CollapsibleTrigger>

      <div className="px-4 pb-3 sm:px-5">
        <FactorRObligationAlert instance={instance} compact />
      </div>

      <CollapsibleContent className="border-t border-border/70 bg-muted/10">
        <div className="space-y-5 p-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border bg-background p-3"><p className="text-xs text-muted-foreground">Protocolo</p><p className="mt-1 text-sm font-medium">{instance.protocol || "Não informado"}</p></div>
            <div className="rounded-xl border bg-background p-3"><p className="text-xs text-muted-foreground">Destinatário</p><p className="mt-1 truncate text-sm font-medium">{latestAttempt?.recipient_email || "Não definido"}</p></div>
            <div className="rounded-xl border bg-background p-3"><p className="text-xs text-muted-foreground">Último envio</p><p className="mt-1 text-sm font-medium">{formatDateTime(latestAttempt?.sent_at || latestAttempt?.failed_at || latestAttempt?.created_at)}</p></div>
            <div className="rounded-xl border bg-background p-3"><p className="text-xs text-muted-foreground">Documento</p><p className="mt-1 text-sm font-medium">{instance.document_required ? "Obrigatório" : "Opcional"}</p></div>
          </div>

          {detailQuery.isLoading ? (
            <div className="flex items-center gap-2 py-5 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando informações de envio...</div>
          ) : detailQuery.isError ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{detailQuery.error instanceof Error ? detailQuery.error.message : "Falha ao carregar detalhes."}</div>
          ) : (
            <div className="grid gap-5 lg:grid-cols-2">
              <section className="space-y-3 lg:col-span-2">
                <div className="flex items-center gap-2"><Paperclip className="h-4 w-4 text-primary" /><h4 className="text-sm font-semibold">Arquivos anexados</h4></div>
                {(detailQuery.data?.files || []).length === 0 ? <p className="text-sm text-muted-foreground">Nenhum arquivo anexado.</p> : (
                  <div className="space-y-2">
                    {detailQuery.data?.files.map((file) => (
                      <button key={file.id} type="button" className="flex w-full items-center justify-between gap-3 rounded-xl border bg-background p-3 text-left hover:bg-muted/40" onClick={() => void openDeliveryFile(file).catch((error) => toast.error(error instanceof Error ? error.message : "Falha ao abrir arquivo."))}>
                        <span className="min-w-0"><span className="block truncate text-sm font-medium">{file.file_name}</span><span className="text-xs text-muted-foreground">{formatDateTime(file.created_at)}{file.protocol_number ? ` · protocolo ${file.protocol_number}` : ""}</span></span>
                        <Download className="h-4 w-4 shrink-0 text-primary" />
                      </button>
                    ))}
                  </div>
                )}
              </section>

              <section className="space-y-3 lg:col-span-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2"><Eye className="h-4 w-4 text-primary" /><h4 className="text-sm font-semibold">Leitura do cliente</h4></div>
                  <Badge variant={(detailQuery.data?.accessEvents || []).length > 0 ? "default" : "secondary"}>
                    {(detailQuery.data?.accessEvents || []).length > 0 ? "Acesso confirmado" : "Ainda não acessado"}
                  </Badge>
                </div>
                {(detailQuery.data?.accessEvents || []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">O link seguro enviado por e-mail ainda não foi acessado pelo cliente.</p>
                ) : (
                  <div className="space-y-2">
                    {detailQuery.data?.accessEvents.map((access) => {
                      const file = detailQuery.data?.files.find((item) => item.id === access.file_id);
                      return (
                        <div key={access.id} className="flex flex-col gap-1 rounded-xl border bg-background p-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0"><p className="truncate text-sm font-medium">{file?.file_name || "Documento da obrigação"}</p><p className="text-xs text-muted-foreground">{documentAccessChannelLabel(access.access_channel)} · {accessDeviceLabel(access.user_agent)}</p></div>
                          <div className="shrink-0 text-left sm:text-right"><p className="text-sm font-medium">{formatDateTime(access.accessed_at)}</p><p className="text-xs text-muted-foreground">{access.access_type === "download" ? "Abriu ou baixou o arquivo" : "Visualizou o arquivo"}</p></div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

              <section className="space-y-3 lg:col-span-2">
                <h4 className="text-sm font-semibold">Andamento da entrega</h4>
                {(detailQuery.data?.events || []).length === 0 ? <p className="text-sm text-muted-foreground">Nenhum evento registrado.</p> : (
                  <div className="space-y-2 border-l border-border pl-4">
                    {detailQuery.data?.events.map((event) => (
                      <div key={event.id} className="text-sm"><p className="font-medium">{event.comment || event.event_type}</p><p className="text-xs text-muted-foreground">{formatDateTime(event.created_at)}{event.from_status || event.to_status ? ` · ${event.from_status || "início"} → ${event.to_status || "sem alteração"}` : ""}</p></div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}

          <div className="flex justify-end">
            <Button variant="outline" className="rounded-xl" disabled={instance.status === "concluida"} onClick={() => onEdit(instance)}>
              {instance.status === "concluida" ? "Entrega concluída" : "Atualizar entrega"}
            </Button>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
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
  const dueDay = Number(form.due_day || 0);
  if (form.due_rule_type === "calendar_day" && (!Number.isFinite(dueDay) || dueDay < 1 || dueDay > 31)) {
    return "Informe um dia corrido entre 1 e 31 para o vencimento técnico.";
  }
  const businessDayIndex = Number(form.due_business_day_index || 0);
  if (
    form.due_rule_type === "business_day_from_month_start" &&
    (!Number.isFinite(businessDayIndex) || businessDayIndex < 1 || businessDayIndex > 23)
  ) {
    return "Informe qual dia útil deve ser usado, entre 1 e 23.";
  }
  const fixedDates = sanitizeFixedDates(form.due_fixed_dates);
  if (form.due_rule_type === "fixed_date" && fixedDates.length === 0) {
    return "Informe pelo menos uma data fixa anual válida.";
  }
  const documents = sanitizeExpectedDocuments(form.expected_documents);
  if (documents.length === 0 && !options?.allowMissingDocuments) return "Cadastre pelo menos um documento esperado.";
  if (form.completion_email_enabled && !form.completion_email_subject.trim()) {
    return "Informe o assunto padrao do e-mail automatico.";
  }
  if (form.completion_email_enabled && !form.completion_email_body.trim()) {
    return "Informe o corpo padrao do e-mail automatico.";
  }
  if (form.completion_email_enabled && !hasRequiredDocumentLinkPlaceholder(form.completion_email_body)) {
    return `Inclua ${DOCUMENT_LINK_PLACEHOLDER} no corpo do e-mail para definir onde o link do documento sera exibido.`;
  }
  if (form.completion_whatsapp_enabled && !form.completion_whatsapp_body.trim()) {
    return "Informe o corpo padrao do WhatsApp automatico.";
  }
  if (form.completion_whatsapp_enabled && !hasRequiredDocumentLinkPlaceholder(form.completion_whatsapp_body)) {
    return `Inclua ${DOCUMENT_LINK_PLACEHOLDER} na mensagem do WhatsApp para definir onde o link do documento sera exibido.`;
  }
  return null;
}

async function upsertTemplateDirectly(payload: TemplateFormState) {
  const organizationId = await getStoredCurrentOrganizationId();
  if (!organizationId) throw new Error("Organizacao ativa nao encontrada.");
  const fixedDates = sanitizeFixedDates(payload.due_fixed_dates);
  const firstFixedDate = fixedDates[0] || null;

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
    due_rule_type: payload.due_rule_type,
    due_date_adjustment_policy: payload.due_date_adjustment_policy,
    due_business_day_index: payload.due_business_day_index ? Number(payload.due_business_day_index) : null,
    due_fixed_month: firstFixedDate?.month ?? null,
    due_fixed_day: firstFixedDate?.day ?? null,
    due_fixed_dates: fixedDates,
    yearly_due_month: firstFixedDate?.month ?? null,
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
  extractionZones,
}: {
  templateId: string;
  documentTypeKey: string;
  file: File;
  storagePath: string;
  analysis: AnalyzedDocument;
  extractionZones?: ReferenceExtractionZones | null;
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
      fingerprint_version: analysis.fingerprint_payload.version || 2,
      fingerprint_payload: mergeExtractionZonesIntoFingerprint(analysis.fingerprint_payload, extractionZones),
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
  extractionZones,
}: {
  templateId: string;
  documentTypeKey: string;
  file: File;
  extractionZones?: ReferenceExtractionZones | null;
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
      analysis: {
        ...analysis,
        fingerprint_payload: mergeExtractionZonesIntoFingerprint(analysis.fingerprint_payload, extractionZones),
      },
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
        extractionZones,
      });
    } catch (fallbackError) {
      await supabase.storage.from("obligation-files").remove([path]);
      throw fallbackError;
    }
  }
}

async function updateReferenceExtractionZonesDirectly(referenceFileId: string, zones: ReferenceExtractionZones) {
  const currentFingerprint = await supabase
    .from("expected_document_reference_files")
    .select("fingerprint_payload")
    .eq("id", referenceFileId)
    .single();
  if (currentFingerprint.error) throw currentFingerprint.error;
  const fingerprintPayload =
    currentFingerprint.data?.fingerprint_payload && typeof currentFingerprint.data.fingerprint_payload === "object"
      ? (currentFingerprint.data.fingerprint_payload as Record<string, unknown>)
      : {};
  const { data, error } = await supabase
    .from("expected_document_reference_files")
    .update({
      fingerprint_payload: mergeExtractionZonesIntoFingerprint(fingerprintPayload, zones),
    })
    .eq("id", referenceFileId)
    .select("*")
    .single();
  if (error || !data) throw error || new Error("Falha ao salvar marcações do documento modelo.");
  return { ok: true as const, reference_file: data as GrowExpectedDocumentReferenceFile };
}

async function updateReferenceExtractionZones(referenceFileId: string, zones: ReferenceExtractionZones) {
  try {
    return await invokeGrowObligations<{ ok: true; reference_file: GrowExpectedDocumentReferenceFile }>({
      action: "update_reference_extraction_zones",
      reference_file_id: referenceFileId,
      extraction_zones: zones,
    });
  } catch (error) {
    console.warn("grow-obligations-module update_reference_extraction_zones failed, using RLS fallback", error);
    return updateReferenceExtractionZonesDirectly(referenceFileId, zones);
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
      ? ["Competência definida manualmente pelo usuário."]
      : ["Aguardando validação humana para vincular o arquivo."],
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
      competence_detected: item.competenceManuallyEdited
        ? item.suggested_competence_label || null
        : effectiveMatch.competenceDetected || item.analysis.competence_detected,
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

async function processLinkedDocument({
  organizationId,
  inboxItemId,
}: {
  organizationId: string;
  inboxItemId: string;
}) {
  const { data, error: processError } = await supabase.functions.invoke<{
    ok: boolean;
    processed: number;
    results?: Array<{ result?: { processed?: boolean; reason?: string } }>;
  }>("obligation-document-processor", {
    body: {
      organization_id: organizationId,
      inbox_item_id: inboxItemId,
      limit: 1,
    },
  });
  if (processError) throw processError;
  const result = data?.results?.[0]?.result;
  if (!data?.ok || !result?.processed) {
    throw new Error(result?.reason || "O documento não pôde ser processado pela Central.");
  }
}

function validateUploadQueueItem(item: UploadQueueItem) {
  const validationError = validateSecureDocument(item.file);
  if (validationError) return validationError;
  if (!item.file?.name) return "Existe um arquivo invalido na fila.";
  if (!item.analysis) return `O arquivo ${item.file.name} ainda não foi analisado.`;
  if (item.isPreviewing) return `Aguarde o preview do arquivo ${item.file.name} terminar.`;
  if (
    item.preview?.match.reviewRequired &&
    (item.preview.match.obligationCandidates?.length || 0) > 0 &&
    !item.obligationSelectionConfirmed
  ) {
    return `Confirme uma das obrigações sugeridas para o arquivo ${item.file.name}.`;
  }
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
      return "Competência manual";
    case "direct_expected_doc":
      return "Documento modelo";
    case "alias_match":
      return "Alias";
    case "single_open_instance":
      return "Competência aberta";
    case "manual_review":
    default:
      return "Revisao manual";
  }
}

function documentOptionsForUpload(item: UploadQueueItem, allOptions: DocumentSelectOption[]) {
  const candidates = item.preview?.match.reviewRequired ? item.preview.match.obligationCandidates || [] : [];
  if (candidates.length === 0) return allOptions;
  const allowedKeys = new Set(candidates.map((candidate) => `${candidate.templateId}::${candidate.documentTypeKey}`));
  return allOptions.filter((option) => allowedKeys.has(option.optionKey));
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
  const nextCompetenceLabel = item.competenceManuallyEdited
    ? item.suggested_competence_label
    : match.competenceDetected || item.analysis.competence_detected || item.suggested_competence_label;

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
  const searchableText = slugifyDocumentKey(
    `${item.file.name} ${item.analysis.extracted_text_preview || ""} ${item.analysis.extracted_text || ""} ${item.analysis.keywords.join(" ")}`,
  );
  const fileNameFamilies = detectLocalDocumentFamilies(item.file.name);
  const detectedFamiliesFromContent = detectLocalDocumentFamilies(
    item.file.name,
    item.analysis.extracted_text_preview,
    item.analysis.extracted_text,
    item.analysis.keywords,
    item.analysis.primary_cues,
  );
  const detectedFamilies = fileNameFamilies.size > 0 ? fileNameFamilies : detectedFamiliesFromContent;
  const rankedDocuments = templates
    .flatMap((template) => template.expected_documents
      .filter((document) => document.active)
      .map((document) => ({
        template,
        document,
        ...scoreLocalDocumentCandidate(template, document, searchableText, detectedFamilies),
      })))
    .filter((candidate) => detectedFamilies.size === 0 || candidate.familyMatched)
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => right.score - left.score);
  const inferredDocumentCandidate = rankedDocuments[0] || null;
  const effectiveTemplate =
    templates.find((template) => template.id === item.template_id) ||
    inferredDocumentCandidate?.template ||
    null;
  const documentDefinition =
    effectiveTemplate?.expected_documents.find((document) => document.document_type_key === item.document_type_key) ||
    (inferredDocumentCandidate?.template.id === effectiveTemplate?.id ? inferredDocumentCandidate.document : null) ||
    effectiveTemplate?.expected_documents.find((document) => {
      const tokens = [document.label, document.document_type_key, ...document.aliases]
        .map((value) => slugifyDocumentKey(String(value || "")))
        .filter((value) => value.length >= 2);
      return tokens.some((token) => searchableText.includes(token));
    }) ||
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
      obligationCandidates: reviewRequired
        ? rankedDocuments.slice(0, 5).map((candidate) => ({
            templateId: candidate.template.id,
            templateName: candidate.template.name,
            documentTypeKey: candidate.document.document_type_key,
            documentLabel: candidate.document.label,
            score: Math.min(0.95, Math.max(0.25, candidate.score / 140)),
            reasons: [
              candidate.familyMatched ? "Tipo documental compatível." : "Palavras do documento compatíveis.",
              candidate.documentTokenMatched ? "Título ou identificação do documento encontrado." : "Obrigação relacionada ao conteúdo lido.",
            ],
            candidateInstanceIds: [],
          }))
        : [],
    },
  };
}

const overviewQueryKey = ["grow-obligations-overview"];

export function GrowObligationsWorkspace({
  defaultTab = "dashboard",
  initialClientId = null,
  initialInstanceId = null,
}: GrowObligationsWorkspaceProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const [activeTab, setActiveTab] = useState<WorkspaceTab>(defaultTab);
  const [templateSearch, setTemplateSearch] = useState("");
  const [instanceSearch, setInstanceSearch] = useState("");
  const [instanceStatusFilter, setInstanceStatusFilter] = useState<string>("all");
  const [instanceClientFilter, setInstanceClientFilter] = useState<string>(initialClientId || "all");
  const [instanceSectorFilter, setInstanceSectorFilter] = useState("all");
  const [instancePriorityFilter, setInstancePriorityFilter] = useState("all");
  const [instanceCompetenceFilter, setInstanceCompetenceFilter] = useState("");
  const [instanceDueFrom, setInstanceDueFrom] = useState("");
  const [instanceDueTo, setInstanceDueTo] = useState("");
  const [instanceTargetId, setInstanceTargetId] = useState<string | null>(initialInstanceId);
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
  const [pendingReferenceZones, setPendingReferenceZones] = useState<Record<string, ReferenceExtractionZones>>({});
  const [referencePreviewTarget, setReferencePreviewTarget] = useState<ReferencePreviewTarget | null>(null);
  const [isDraggingUpload, setIsDraggingUpload] = useState(false);
  const [templateClientSearch, setTemplateClientSearch] = useState("");
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
      instanceStatusFilter,
      instanceClientFilter,
      instanceSectorFilter,
      instancePriorityFilter,
      instanceCompetenceFilter,
      instanceDueFrom,
      instanceDueTo,
      activeTab,
    ],
    queryFn: () =>
      invokeGrowObligations<GrowObligationsOverviewPayload>({
        action: "overview",
        document_status: documentStatusFilter,
        document_client_id: documentClientFilter,
        document_template_id: documentTemplateFilter,
        document_competence: documentCompetenceFilter || null,
        instance_status: activeTab === "entregas" ? instanceStatusFilter : "all",
        instance_client_id: activeTab === "entregas" ? instanceClientFilter : initialClientId || "all",
        instance_sector: activeTab === "entregas" ? instanceSectorFilter : "all",
        instance_priority: activeTab === "entregas" ? instancePriorityFilter : "all",
        instance_competence: activeTab === "entregas" ? instanceCompetenceFilter || null : null,
        instance_due_from: activeTab === "entregas" ? instanceDueFrom || null : null,
        instance_due_to: activeTab === "entregas" ? instanceDueTo || null : null,
        skip_operational_sync: true,
      }),
    staleTime: 30_000,
    refetchInterval: activeTab === "documentos" ? 10_000 : false,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });

  const overview = overviewQuery.data;

  const templateClientsQuery = useQuery({
    queryKey: ["grow-obligations", "template-clients"],
    queryFn: listTemplateClientsForSelection,
    enabled: overviewQuery.isError || Boolean(overview?.warnings?.length && overview.clients.length === 0),
    staleTime: 60_000,
  });

  const catalogTemplatesQuery = useQuery({
    queryKey: ["grow-obligations", "catalog-templates"],
    queryFn: listCatalogTemplatesDirectly,
    enabled: overviewQuery.isError || Boolean(overview?.warnings?.length && overview.templates.length === 0),
    staleTime: 30_000,
  });

  const templateMutation = useMutation({
    mutationFn: async (payload: TemplateFormState) => {
      const isSystemDefault = isSystemDefaultTemplateForm(payload);
      const validationError = validateTemplateForm(payload, { allowMissingDocuments: isSystemDefault });
      if (validationError) throw new Error(validationError);
      const fixedDates = sanitizeFixedDates(payload.due_fixed_dates);
      const firstFixedDate = fixedDates[0] || null;
      const requestPayload = {
        action: "upsert_template",
        id: payload.id,
        name: payload.name,
        sector: payload.sector,
        periodicity: payload.periodicity,
        competence_reference: payload.competence_reference,
        technical_due_month_reference: payload.technical_due_month_reference,
        due_day: Number(payload.due_day || 10),
        due_rule_type: payload.due_rule_type,
        due_date_adjustment_policy: payload.due_date_adjustment_policy,
        due_business_day_index: payload.due_business_day_index ? Number(payload.due_business_day_index) : null,
        due_fixed_month: firstFixedDate?.month ?? null,
        due_fixed_day: firstFixedDate?.day ?? null,
        due_fixed_dates: fixedDates,
        yearly_due_month: firstFixedDate?.month ?? null,
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
      return await invokeGrowObligations<TemplateSaveResult>(requestPayload);
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
            const result = await uploadTemplateReferenceFile({
              templateId: savedTemplateId,
              documentTypeKey,
              file,
              extractionZones: pendingReferenceZones[documentTypeKey] || normalizeExtractionZones(null),
            });
            uploadedReferences.push({ documentTypeKey, reference: result.reference_file });
          }
        }
        setPendingReferenceFiles({});
        setPendingReferenceZones({});
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
      toast.success("Competência atualizada.");
      setInstanceDialogOpen(false);
      setInstanceForm(null);
      await queryClient.invalidateQueries({ queryKey: overviewQueryKey });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Falha ao atualizar competência."),
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
      setPendingReferenceFiles((prev) => {
        const next = { ...prev };
        delete next[variables.documentTypeKey];
        return next;
      });
      setPendingReferenceZones((prev) => {
        const next = { ...prev };
        delete next[variables.documentTypeKey];
        return next;
      });
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

  const updateReferenceZonesMutation = useMutation({
    mutationFn: ({ referenceFileId, zones }: { referenceFileId: string; zones: ReferenceExtractionZones }) =>
      updateReferenceExtractionZones(referenceFileId, zones),
    onSuccess: async (response) => {
      toast.success("Marcações do documento modelo salvas.");
      const updatedReference = response.reference_file;
      setReferencePreviewTarget(null);
      setTemplateForm((prev) => ({
        ...prev,
        expected_documents: prev.expected_documents.map((document) => ({
          ...document,
          reference_files: (document.reference_files || []).map((reference) =>
            reference.id === updatedReference.id ? updatedReference : reference,
          ),
        })),
      }));
      await queryClient.invalidateQueries({ queryKey: overviewQueryKey });
      await queryClient.invalidateQueries({ queryKey: ["grow-obligations", "catalog-templates"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Falha ao salvar marcações."),
  });

  const uploadQueueMutation = useMutation({
    mutationFn: async () => {
      if (uploadQueue.length === 0) {
        throw new Error("Adicione pelo menos um PDF antes de enviar.");
      }
      const organizationId = await getStoredCurrentOrganizationId();
      if (!organizationId) throw new Error("Organizacao ativa nao encontrada.");

      const results: Array<UploadQueueResult & { deliveryError?: string | null; deliverySent?: boolean }> = [];
      const processedDocuments: ProcessedCentralDocument[] = [];
      for (const item of uploadQueue) {
        const validationError = validateUploadQueueItem(item);
        if (validationError) throw new Error(validationError);

        const path = buildSecureStoragePath(
          ["grow-obligations", item.client_id || item.preview?.match.detectedClientId || "sem-cliente", new Date().toISOString().slice(0, 7)],
          buildUniqueReferenceFileName(item.file.name),
        );

        const { error: uploadError } = await supabase.storage.from("obligation-files").upload(path, item.file, {
          contentType: item.file.type || undefined,
          upsert: false,
        });
        if (uploadError) {
          throw new Error(`Falha ao anexar ${item.file.name}: ${uploadError.message}`);
        }

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
            await processLinkedDocument({
              organizationId,
              inboxItemId,
            });
            const resultIndex = results.length;
            results.push({ ...response, deliveryError: null, deliverySent: false });
            processedDocuments.push({ instanceId, inboxItemId, resultIndex });
            continue;
          } catch (error) {
            results.push({
              ...response,
              deliveryError: error instanceof Error ? error.message : "Falha ao processar documento vinculado.",
            });
            continue;
          }
        }

        results.push(response);
      }
      for (const delivery of groupCentralDeliveries(processedDocuments)) {
        try {
          const deliveryResult = await invokeGrowObligations<{
            ok: true;
            channels?: Array<{ ok?: boolean; delivery_attempt?: { id?: string; status?: string } }>;
          }>({
            action: "send_configured_delivery",
            instance_id: delivery.instanceId,
            inbox_item_ids: delivery.inboxItemIds,
            confirm_duplicate: true,
            idempotency_key: `central:${delivery.inboxItemIds.slice().sort().join(":")}`,
          });
          const recordedDelivery = deliveryResult.channels?.some(
            (channel) => channel.ok === true && Boolean(channel.delivery_attempt?.id),
          );
          if (!recordedDelivery) throw new Error("A entrega não gerou registro no histórico. Tente novamente.");
          for (const resultIndex of delivery.resultIndexes) results[resultIndex].deliverySent = true;
        } catch (error) {
          const message = error instanceof Error ? error.message : "Falha ao enviar os documentos ao cliente.";
          for (const resultIndex of delivery.resultIndexes) results[resultIndex].deliveryError = message;
        }
      }
      return results;
    },
    onSuccess: async (results) => {
      const autoLinked = results.filter((item) => !item.match.reviewRequired).length;
      const sent = results.filter((item) => item.deliverySent).length;
      const deliveryErrors = results
        .map((item) => item.deliveryError)
        .filter((message): message is string => Boolean(message));
      if (deliveryErrors.length > 0) {
        toast.error(`${results.length} arquivo(s) anexados. ${autoLinked} vinculado(s). ${deliveryErrors[0]}`);
      } else if (sent > 0) {
        toast.success(`${results.length} arquivo(s) anexados. ${sent} entrega(s) registrada(s) e enviada(s).`);
      } else {
        toast.success(`${results.length} arquivo(s) anexados e ${autoLinked} vinculado(s). Nenhum envio era aplicavel neste momento.`);
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
    mutationFn: (payload: { instanceId: string; retry?: boolean; confirmDuplicate?: boolean }) =>
      invokeGrowObligations({
        action: "send_configured_delivery",
        instance_id: payload.instanceId,
        confirm_duplicate: payload.confirmDuplicate || false,
      }),
    onSuccess: async () => {
      toast.success("Link seguro da guia enviado ao cliente e obrigacao concluida.");
      await queryClient.invalidateQueries({ queryKey: overviewQueryKey });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Falha ao enviar guia ao cliente."),
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: overviewQueryKey });
    },
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

  const modelsMissingReadAreas = useMemo(() => catalogTemplates.flatMap((template) =>
    template.expected_documents.flatMap((document) => (document.reference_files || [])
      .filter((reference) => reference.is_active)
      .flatMap((reference) => {
        const fields = configuredExtractionZoneFields(reference);
        const missingAreas = [
          !fields.has("cpf") && !fields.has("cnpj") ? "CPF/CNPJ" : null,
          !fields.has("competence") ? "Competência" : null,
          !fields.has("title") ? "Título (auxiliar)" : null,
        ].filter((area): area is string => Boolean(area));
        return missingAreas.length > 0 ? [{
          referenceId: reference.id,
          templateName: template.name,
          documentName: document.label,
          fileName: reference.file_name,
          missingAreas,
        }] : [];
      })),
  ), [catalogTemplates]);

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
      if (instanceTargetId && instance.id !== instanceTargetId) return false;
      if (instanceStatusFilter !== "all" && instance.status !== instanceStatusFilter) return false;
      if (instanceClientFilter !== "all" && instance.client_id !== instanceClientFilter) return false;
      if (instanceSectorFilter !== "all" && instance.template?.sector !== instanceSectorFilter) return false;
      if (instancePriorityFilter !== "all" && instance.priority !== instancePriorityFilter) return false;
      if (instanceCompetenceFilter && !instance.competence_date.startsWith(instanceCompetenceFilter)) return false;
      if (instanceDueFrom && instance.technical_due_date < instanceDueFrom) return false;
      if (instanceDueTo && instance.technical_due_date > instanceDueTo) return false;
      if (!token) return true;
      return `${instance.client?.name || ""} ${instance.template?.name || ""} ${instance.competence_label}`.toLowerCase().includes(token);
    });
  }, [
    instanceClientFilter,
    instanceCompetenceFilter,
    instanceDueFrom,
    instanceDueTo,
    instancePriorityFilter,
    instanceSearch,
    instanceSectorFilter,
    instanceStatusFilter,
    instanceTargetId,
    overview?.instances,
  ]);

  const instanceSectorOptions = useMemo(
    () => Array.from(new Set(catalogTemplates.map((template) => template.sector).filter(Boolean))).sort((a, b) => a.localeCompare(b, "pt-BR")),
    [catalogTemplates],
  );

  const clearInstanceFilters = () => {
    if (instanceTargetId) navigate("/app/obrigacoes?tab=entregas", { replace: true });
    setInstanceTargetId(null);
    setInstanceSearch("");
    setInstanceStatusFilter("all");
    setInstanceClientFilter(initialClientId || "all");
    setInstanceSectorFilter("all");
    setInstancePriorityFilter("all");
    setInstanceCompetenceFilter("");
    setInstanceDueFrom("");
    setInstanceDueTo("");
  };

  const handleEditDeliveryInstance = useCallback((selectedInstance: GrowObligationInstance) => {
    setInstanceForm(makeInstanceForm(selectedInstance));
    setInstanceDialogOpen(true);
  }, []);

  const handleOpenDashboardDelivery = useCallback((selectedInstance: GrowObligationInstance) => {
    navigate(`/app/obrigacoes?tab=entregas&instance_id=${encodeURIComponent(selectedInstance.id)}`);
  }, [navigate]);

  const handleViewAllDeliveries = useCallback(() => {
    navigate("/app/obrigacoes?tab=entregas");
  }, [navigate]);

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
        instance.latest_delivery_attempt?.status !== "sent" &&
        (instance.status === "pronto_para_envio" || instance.status === "falha_envio"),
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
      const preview = await invokeGrowObligations<ReferenceMatchPreview>({
        action: "preview_document_match",
        client_id: item.client_id || initialClientId || null,
        instance_id: item.instance_id || null,
        template_id: item.template_id || null,
        document_type_key: item.document_type_key || null,
        suggested_competence_label: item.suggested_competence_label || item.analysis.competence_detected || null,
        competence_manually_edited: item.competenceManuallyEdited,
        file_name: item.file.name,
        analysis: item.analysis,
      });
      setUploadQueue((prev) =>
        prev.map((current) => (current.id === item.id ? applyPreviewAutofill(current, preview) : current)),
      );
    } catch (error) {
      console.warn("grow-obligations preview_document_match failed, using local fallback", error);
      try {
        const preview = buildLocalDocumentPreview(item, overview, {
          clients: activeTemplateClients,
          templates: catalogTemplates,
        });
        setUploadQueue((prev) =>
          prev.map((current) => (current.id === item.id ? applyPreviewAutofill(current, preview) : current)),
        );
      } catch (fallbackError) {
        setUploadQueue((prev) => prev.map((current) => (current.id === item.id ? { ...current, preview: null, previewError: fallbackError instanceof Error ? fallbackError.message : "Falha no preview.", isPreviewing: false } : current)));
      }
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
          competenceManuallyEdited: false,
          notes: "",
          preview: null,
          previewError: null,
          isPreviewing: true,
          obligationSelectionConfirmed: false,
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
    <div className="mx-auto w-full max-w-none space-y-5 px-1 pb-8 sm:px-2 xl:px-4">
      <section className="relative overflow-hidden rounded-[1.75rem] border border-primary/15 bg-gradient-to-br from-card via-card to-primary/[0.06] p-5 shadow-[0_18px_50px_-32px_hsl(var(--primary)/0.45)] sm:p-7">
        <div className="absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b from-primary via-primary/70 to-primary/20" />
        <div className="pointer-events-none absolute -right-12 -top-16 h-52 w-52 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0 space-y-3">
            <ModuleContextPill icon={FileSpreadsheet} label="Obrigações padrão" />
            <div className="space-y-1">
              <h1 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">Obrigações Grow</h1>
              <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
                Central operacional para envio de guias, documentos esperados e gestão do catálogo padrão.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" className="rounded-xl bg-background/80 shadow-sm backdrop-blur" onClick={() => overviewQuery.refetch()}>
              <RefreshCcw className="mr-2 h-4 w-4" />
              Atualizar visão
            </Button>
          </div>
        </div>
      </section>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as WorkspaceTab)} className="space-y-5">
        <TabsList className="grid h-auto w-full grid-cols-2 gap-2 rounded-2xl border border-border/70 bg-card p-2 shadow-sm lg:grid-cols-4">
          {workspaceTabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="group h-auto min-h-16 justify-start gap-3 rounded-xl px-3 py-3 text-left transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md sm:px-4"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground transition-colors group-data-[state=active]:bg-primary-foreground/15 group-data-[state=active]:text-primary-foreground">
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{tab.label}</span>
                  <span className="mt-0.5 hidden truncate text-xs font-normal opacity-70 sm:block">{tab.description}</span>
                </span>
              </TabsTrigger>
            );
          })}
        </TabsList>
        <TabsContent value="dashboard" className="space-y-4">
          <ObligationsDashboard
            instances={overview.instances}
            onOpenInstance={handleOpenDashboardDelivery}
            onViewAll={handleViewAllDeliveries}
          />
        </TabsContent>

        <TabsContent value="catalogo" className="space-y-4">
          <Card className="overflow-hidden rounded-3xl border-border/70 shadow-sm">
            <CardHeader className="border-b border-border/60 bg-gradient-to-r from-muted/30 via-card to-primary/[0.04] p-5 sm:p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2"><CardTitle>Catálogo mestre</CardTitle><Badge variant="secondary">{filteredTemplates.length} obrigações</Badge></div>
                  <CardDescription>Configure prazos, documentos esperados e clientes vinculados.</CardDescription>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <div className="relative w-full sm:w-80">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                    <Input value={templateSearch} onChange={(event) => setTemplateSearch(event.target.value)} placeholder="Buscar por nome ou setor" className="h-11 rounded-xl bg-background pl-9 shadow-sm" />
                  </div>
                <Button
                  className="h-11 rounded-xl shadow-sm"
                  onClick={() => {
                    setTemplateForm(makeTemplateForm());
                    setTemplateClientSearch("");
                    setPendingReferenceFiles({});
                    setTemplateDialogOpen(true);
                  }}
                ><Plus className="mr-2 h-4 w-4" />Nova obrigação</Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 p-4 sm:p-6">
              {overviewQuery.isFetching || catalogTemplatesQuery.isFetching ? (
                <div className="flex items-center gap-2 rounded-2xl border border-border/70 p-4 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Carregando catalogo...
                </div>
              ) : null}
              {filteredTemplates.map((template) => (
                <div key={template.id} className="group rounded-2xl border border-border/70 bg-card p-4 shadow-sm transition-all hover:border-primary/25 hover:shadow-md sm:p-5">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold">{template.name}</p>
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
                      {!isSystemDefaultTemplate(template) ? (
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
                      ) : null}
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

        <TabsContent value="entregas" className="space-y-4">
          <Card className="overflow-hidden rounded-3xl border-border/70 shadow-sm">
            <CardHeader className="space-y-4 border-b border-border/60 bg-gradient-to-r from-muted/30 via-card to-primary/[0.04] p-5 sm:p-6">
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><ClipboardList className="h-5 w-5" aria-hidden="true" /></span>
                  <div><div className="flex flex-wrap items-center gap-2"><CardTitle>Lista de entregas</CardTitle><Badge variant="secondary">{filteredInstances.length}</Badge></div><CardDescription className="mt-1">Visão simplificada das obrigações geradas que precisam ser acompanhadas e concluídas.</CardDescription></div>
                </div>
                <div className="grid gap-3 rounded-2xl border border-border/70 bg-background/80 p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="delivery-search">Busca</Label>
                    <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" /><Input id="delivery-search" value={instanceSearch} onChange={(event) => setInstanceSearch(event.target.value)} placeholder="Cliente, obrigação ou competência" className="rounded-xl pl-9" /></div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Status</Label>
                    <Select value={instanceStatusFilter} onValueChange={setInstanceStatusFilter}>
                      <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                      <SelectContent><SelectItem value="all">Todos os status</SelectItem>{statusOptions.map((status) => <SelectItem key={status} value={status}>{growObligationStatusLabel[status]}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Cliente</Label>
                    <Select value={instanceClientFilter} onValueChange={setInstanceClientFilter}>
                      <SelectTrigger><SelectValue placeholder="Cliente" /></SelectTrigger>
                      <SelectContent><SelectItem value="all">Todos os clientes</SelectItem>{overview.clients.map((client) => <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Setor</Label>
                    <Select value={instanceSectorFilter} onValueChange={setInstanceSectorFilter}>
                      <SelectTrigger><SelectValue placeholder="Setor" /></SelectTrigger>
                      <SelectContent><SelectItem value="all">Todos os setores</SelectItem>{instanceSectorOptions.map((sector) => <SelectItem key={sector} value={sector}>{sector}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Prioridade</Label>
                    <Select value={instancePriorityFilter} onValueChange={setInstancePriorityFilter}>
                      <SelectTrigger><SelectValue placeholder="Prioridade" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas as prioridades</SelectItem>
                        {(["baixa", "media", "alta", "urgente"] as const).map((priority) => <SelectItem key={priority} value={priority}>{growPriorityLabel[priority]}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="delivery-competence">Competência</Label>
                    <Input id="delivery-competence" type="month" value={instanceCompetenceFilter} onChange={(event) => setInstanceCompetenceFilter(event.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="delivery-due-from">Vencimento inicial</Label>
                    <Input id="delivery-due-from" type="date" value={instanceDueFrom} onChange={(event) => setInstanceDueFrom(event.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="delivery-due-to">Vencimento final</Label>
                    <Input id="delivery-due-to" type="date" value={instanceDueTo} min={instanceDueFrom || undefined} onChange={(event) => setInstanceDueTo(event.target.value)} />
                  </div>
                  <div className="flex items-end">
                    <Button type="button" variant="outline" className="w-full rounded-xl" onClick={clearInstanceFilters}><SlidersHorizontal className="mr-2 h-4 w-4" aria-hidden="true" />Limpar filtros</Button>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 p-4 sm:p-6">
              {instanceTargetId ? (
                <div className="flex flex-col gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
                  <span>Exibindo a entrega selecionada no Dashboard.</span>
                  <Button type="button" variant="outline" size="sm" onClick={clearInstanceFilters}>
                    Mostrar todas as entregas
                  </Button>
                </div>
              ) : null}
              <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
                <span>{filteredInstances.length} entrega{filteredInstances.length === 1 ? "" : "s"} encontrada{filteredInstances.length === 1 ? "" : "s"}</span>
                {overviewQuery.isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              </div>
              {filteredInstances.map((instance) => (
                <DeliveryListItem
                  key={instance.id}
                  instance={instance}
                  onEdit={handleEditDeliveryInstance}
                  initiallyOpen={instance.id === instanceTargetId}
                />
              ))}
              {!overviewQuery.isFetching && filteredInstances.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                  Nenhuma entrega encontrada para os filtros selecionados.
                </div>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documentos" className="space-y-4">
          <Card className="overflow-hidden rounded-3xl border-border/70 shadow-sm">
            <CardHeader className="border-b border-border/60 bg-gradient-to-r from-muted/30 via-card to-primary/[0.04] p-5 sm:p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><FolderUp className="h-5 w-5" aria-hidden="true" /></span>
                  <div>
                  <CardTitle>Central de Documentos</CardTitle>
                  <CardDescription className="mt-1">Envie documentos manualmente ou instale o robô para monitorar uma pasta no Windows.</CardDescription>
                  </div>
                </div>
                <div className="flex flex-col items-stretch gap-1 sm:items-end">
                  <Button asChild variant="outline" className="h-11 gap-2 rounded-xl bg-background shadow-sm">
                    <a href={robotInstallerDownloadUrl} download="instalar-robo-grow.cmd">
                      <Download className="h-4 w-4" aria-hidden="true" />
                      Baixar robô para Windows
                    </a>
                  </Button>
                  <span className="text-xs text-muted-foreground">Instalador guiado · configuração única</span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5 p-4 sm:p-6">
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
                                  {instance.template?.completion_email_enabled ? <Badge variant="outline"><Mail className="mr-1 h-3 w-3" />E-mail</Badge> : null}
                                  {instance.template?.completion_whatsapp_enabled ? <Badge variant="outline"><MessageCircle className="mr-1 h-3 w-3" />WhatsApp</Badge> : null}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  {instance.client?.name || "Cliente"} · competencia {instance.competence_label}
                                </p>
                              </div>
                            </div>
                            <div className="mt-3 flex justify-end">
                              <Button
                                className="rounded-xl"
                                disabled={sendDeliveryMutation.isPending}
                                onClick={() => {
                                  sendDeliveryMutation.mutate({
                                    instanceId: instance.id,
                                    retry: instance.status === "falha_envio",
                                  });
                                }}
                              >
                                {sendDeliveryMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MessageCircle className="mr-2 h-4 w-4" />}
                                {instance.status === "falha_envio" ? "Tentar canais pendentes" : "Enviar pelos canais configurados"}
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
                  className={`group relative overflow-hidden rounded-3xl border-2 border-dashed p-5 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:p-8 ${
                    isDraggingUpload
                      ? "border-primary bg-primary/10 shadow-md"
                      : "border-border/80 bg-gradient-to-br from-muted/25 via-background to-primary/[0.03] hover:border-primary/50 hover:shadow-md"
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
                  <div className="grid min-h-[280px] items-center gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
                    <div className="flex flex-col items-center justify-center text-center lg:items-start lg:text-left">
                      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-sm ring-1 ring-primary/15 transition-transform group-hover:-translate-y-0.5 group-hover:scale-105">
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
                    <div className="rounded-2xl border border-border/70 bg-background/90 p-5 shadow-sm backdrop-blur">
                      <p className="text-sm font-semibold">Como funciona</p>
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

                <section className="rounded-2xl border border-border/60 bg-muted/20 p-4" aria-labelledby="document-model-coverage-title">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p id="document-model-coverage-title" className="text-sm font-medium">Cobertura dos modelos de leitura</p>
                      <p className="text-xs text-muted-foreground">
                        O vinculo automatico so e liberado apos cinco validacoes reais, ao menos quatro acertos e nenhum falso positivo.
                      </p>
                    </div>
                    <Badge variant={overview.summary.document_models_approved > 0 ? "default" : "secondary"}>
                      {overview.summary.document_models_approved} aprovado(s)
                    </Badge>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-xl border bg-background/80 p-3">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Modelos</p>
                      <p className="mt-2 text-2xl font-semibold">{overview.summary.document_models_total}</p>
                    </div>
                    <div className="rounded-xl border bg-background/80 p-3">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Areas configuradas</p>
                      <p className="mt-2 text-2xl font-semibold">{overview.summary.document_models_configured}</p>
                    </div>
                    <div className="rounded-xl border bg-background/80 p-3">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Em validacao</p>
                      <p className="mt-2 text-2xl font-semibold">{overview.summary.document_models_validating}</p>
                    </div>
                    <div className="rounded-xl border bg-background/80 p-3">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Correcoes manuais</p>
                      <p className="mt-2 text-2xl font-semibold">{overview.summary.recognition_corrected}</p>
                    </div>
                  </div>
                  {modelsMissingReadAreas.length > 0 ? (
                    <details className="group mt-3 rounded-xl border border-orange-300/60 bg-orange-50 text-xs text-orange-900">
                      <summary className="flex cursor-pointer list-none items-center gap-3 p-3 [&::-webkit-details-marker]:hidden">
                        <ChevronDown className="h-4 w-4 shrink-0 -rotate-90 transition-transform group-open:rotate-0" aria-hidden="true" />
                        <span className="font-medium">
                          {modelsMissingReadAreas.length} modelo(s) ainda precisam de áreas de leitura
                        </span>
                        <span className="ml-auto text-orange-800/80 group-open:hidden">Ver quais</span>
                        <span className="ml-auto hidden text-orange-800/80 group-open:inline">Recolher</span>
                      </summary>
                      <div className="border-t border-orange-300/60 px-3 py-2">
                        <p className="mb-2 text-orange-800">
                          CPF/CNPJ e competência são obrigatórios. O título melhora o reconhecimento da obrigação.
                        </p>
                        <ul className="divide-y divide-orange-200/80" aria-label="Modelos com áreas de leitura pendentes">
                          {modelsMissingReadAreas.map((model) => (
                            <li key={model.referenceId} className="grid gap-1 py-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-4">
                              <span className="min-w-0">
                                <span className="font-medium">{model.templateName}</span>
                                <span className="text-orange-800/75"> · {model.documentName} · {model.fileName}</span>
                              </span>
                              <span className="text-orange-800">Falta: {model.missingAreas.join(", ")}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </details>
                  ) : null}
                </section>

                {showLocalRobotPanel && (
                <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">Robô local Grow</p>
                      <p className="text-xs text-muted-foreground">Fila de ingestão contínua para pastas monitoradas no Windows.</p>
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
                        <p className="text-sm font-medium">Como ativar o robô na operação</p>
                        <p className="text-xs text-muted-foreground">Guia curto para deixar a ingestão contínua funcionando sem depender da tela aberta.</p>
                      </div>
                      <Badge variant="outline">Automacao controlada</Badge>
                    </div>
                    <div className="mt-4 grid gap-3 lg:grid-cols-3">
                      <div className="rounded-xl border border-dashed p-3">
                        <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Entrada</p>
                        <p className="mt-2 text-sm font-medium">C:/Grow/Entrada-eContinuo</p>
                        <p className="mt-1 text-xs text-muted-foreground">O colaborador so precisa salvar o PDF nessa pasta. O robô detecta sozinho.</p>
                      </div>
                      <div className="rounded-xl border border-dashed p-3">
                        <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Config local</p>
                        <p className="mt-2 text-sm font-medium">tools/grow-document-robot/runtime/config.local.json</p>
                        <p className="mt-1 text-xs text-muted-foreground">Esse arquivo guarda maquina, pasta monitorada, credenciais e estado local do robô.</p>
                      </div>
                      <div className="rounded-xl border border-dashed p-3">
                        <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Execucao</p>
                        <p className="mt-2 text-sm font-medium">npm.cmd run robot:start</p>
                        <p className="mt-1 text-xs text-muted-foreground">O backend classifica, conclui a obrigação, gera protocolo e publica no portal quando houver match confiavel.</p>
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
                            {job.robot_machine_id || "maquina nao informada"} · {job.robot_origin_path || "origem local nao informada"} · {formatDateTime(job.created_at)}
                          </p>
                          {job.last_error ? <p className="mt-2 text-xs text-destructive">{job.last_error}</p> : null}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">Nenhuma falha recente do robô local.</p>
                  )}
                </div>

                )}

                <div className="space-y-3">
                  {uploadQueue.map((item) => (
                      <div key={item.id} className="rounded-3xl border border-border/70 p-4">
                        <div className="flex flex-col gap-4">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <p className="font-medium">{item.file.name}</p>
                              <p className="text-xs text-muted-foreground">
                                CPF/CNPJ: {item.analysis.detected_cnpj || "não detectado"} · OCR: {item.analysis.ocr_status}
                              </p>
                            </div>
                            <Button variant="ghost" size="icon" className="rounded-xl text-destructive" onClick={() => setUploadQueue((prev) => prev.filter((current) => current.id !== item.id))}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>

                          {item.preview?.match.reviewRequired && (item.preview.match.obligationCandidates?.length || 0) > 0 ? (
                            <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
                              <div className="mb-3">
                                <p className="text-sm font-medium">Possíveis obrigações</p>
                                <p className="text-xs text-muted-foreground">
                                  O sistema ficou em dúvida e filtrou somente as opções compatíveis. Confirme uma delas para continuar.
                                </p>
                              </div>
                              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                                {item.preview.match.obligationCandidates?.map((candidate) => {
                                  const selected = item.obligationSelectionConfirmed && item.template_id === candidate.templateId && item.document_type_key === candidate.documentTypeKey;
                                  return (
                                    <button
                                      key={`${candidate.templateId}::${candidate.documentTypeKey}`}
                                      type="button"
                                      className={`rounded-xl border p-3 text-left transition-colors ${selected ? "border-primary bg-background ring-2 ring-primary/20" : "border-border/70 bg-background/80 hover:border-primary/50"}`}
                                      onClick={() => updateQueueItem(item.id, {
                                        template_id: candidate.templateId,
                                        document_type_key: candidate.documentTypeKey,
                                        instance_id: candidate.candidateInstanceIds.length === 1 ? candidate.candidateInstanceIds[0] : "",
                                        obligationSelectionConfirmed: true,
                                      })}
                                    >
                                      <div className="flex items-start justify-between gap-2">
                                        <span className="text-sm font-medium">{candidate.templateName}</span>
                                        <Badge variant="outline">{Math.round(candidate.score * 100)}%</Badge>
                                      </div>
                                      <p className="mt-1 text-xs text-muted-foreground">{candidate.documentLabel}</p>
                                      <p className="mt-2 line-clamp-2 text-[11px] text-muted-foreground">{candidate.reasons.join(" · ")}</p>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          ) : null}

                          <div className="grid gap-3 md:grid-cols-3">
                            <div className="space-y-2">
                              <Label>Cliente</Label>
                              <Select value={item.client_id || "none"} onValueChange={(value) => updateQueueItem(item.id, { client_id: value === "none" ? "" : value, instance_id: "" })}>
                                <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
                                <SelectContent><SelectItem value="none">Sem cliente manual</SelectItem>{activeTemplateClients.map((client) => <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>)}</SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label>Documento esperado</Label>
                              <Select value={item.document_type_key ? `${item.template_id}::${item.document_type_key}` : "none"} onValueChange={(value) => {
                                if (value === "none") {
                                  updateQueueItem(item.id, { template_id: "", document_type_key: "", instance_id: "", obligationSelectionConfirmed: false });
                                  return;
                                }
                                const [templateId, documentTypeKey] = value.split("::");
                                const candidate = item.preview?.match.obligationCandidates?.find((option) => option.templateId === templateId && option.documentTypeKey === documentTypeKey);
                                updateQueueItem(item.id, {
                                  template_id: templateId,
                                  document_type_key: documentTypeKey,
                                  instance_id: candidate?.candidateInstanceIds.length === 1 ? candidate.candidateInstanceIds[0] : "",
                                  obligationSelectionConfirmed: true,
                                });
                              }}>
                                <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
                                <SelectContent><SelectItem value="none">Sem documento manual</SelectItem>{documentOptionsForUpload(item, allDocumentOptions).map((option) => <SelectItem key={option.optionKey} value={option.optionKey}>{option.label}</SelectItem>)}</SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label>Competência da obrigação</Label>
                              <Input
                                value={item.suggested_competence_label}
                                onChange={(event) => updateQueueItem(item.id, {
                                  suggested_competence_label: event.target.value,
                                  competenceManuallyEdited: true,
                                })}
                              />
                              <p className="text-xs text-muted-foreground">
                                Você pode corrigir este valor após a leitura. A edição manual tem prioridade sobre a detecção automática.
                              </p>
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
                    ))}
                </div>

                {uploadQueueValidationError && (
                  <p className="text-sm text-orange-600">{uploadQueueValidationError}</p>
                )}
                <div className={`flex flex-wrap items-end gap-3 ${uploadQueue.length === 0 ? "hidden" : ""}`}>
                  <Button
                    className="rounded-2xl"
                    onClick={() => uploadQueueMutation.mutate()}
                    disabled={uploadQueueMutation.isPending || uploadQueue.length === 0 || Boolean(uploadQueueValidationError)}
                  >
                    {uploadQueueMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FolderUp className="mr-2 h-4 w-4" />}
                    Enviar para a central
                  </Button>
                </div>
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
                  <div className="overflow-hidden rounded-2xl border border-border/70 bg-background/80">
                    {deliveryAttempts.slice(0, 12).map((attempt) => (
                      <div
                        key={attempt.id}
                        className="grid min-w-0 grid-cols-[72px_128px_minmax(220px,1.1fr)_minmax(210px,1fr)_minmax(280px,1.4fr)] items-center gap-4 border-b border-border/60 px-4 py-2.5 text-xs last:border-b-0"
                      >
                        <Badge className="h-5 w-fit rounded-full px-2 text-[10px]" variant={attempt.status === "sent" ? "default" : attempt.status === "failed" ? "destructive" : "outline"}>
                          {attempt.status}
                        </Badge>
                        <span className="truncate text-[11px] text-muted-foreground" title={formatDateTime(attempt.created_at)}>
                          {formatDateTime(attempt.created_at)}
                        </span>
                        <p className="truncate font-medium" title={attempt.recipient_email || attempt.recipient_phone || undefined}>
                          {attempt.delivery_channel === "whatsapp" ? "WhatsApp: " : "E-mail: "}{attempt.recipient_email || attempt.recipient_phone || "Destinatario nao informado"}
                        </p>
                        <p className="truncate text-muted-foreground" title={attempt.subject}>{attempt.subject}</p>
                        <p
                          className={`truncate ${attempt.failure_reason ? "text-destructive" : "text-muted-foreground"}`}
                          title={attempt.failure_reason || `De: ${attempt.verified_from_email} | Reply-to: ${attempt.reply_to || "-"}`}
                        >
                          {attempt.failure_reason || `De: ${attempt.verified_from_email} | Reply-to: ${attempt.reply_to || "-"}`}
                        </p>
                      </div>
                    ))}
                    {deliveryAttempts.length === 0 ? (
                      <div className="p-6 text-center">
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
                    Obrigacao padrao do sistema: todos os campos podem ser ajustados. A origem padrao sera preservada e a exclusao permanece protegida.
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
            <fieldset className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Nome da obrigação</Label>
                <Input value={templateForm.name} onChange={(event) => setTemplateForm((prev) => ({ ...prev, name: event.target.value }))} placeholder="Ex.: DASN-SIMEI" />
                <p className="text-xs text-muted-foreground">Nome que aparecerá no catálogo, nas tarefas e nas competências geradas.</p>
              </div>
              <div className="space-y-2">
                <Label>Setor responsável</Label>
                <Select value={templateForm.sector} onValueChange={(value) => setTemplateForm((prev) => ({ ...prev, sector: value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{sectors.map((sector) => <SelectItem key={sector} value={sector}>{sector}</SelectItem>)}</SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Define qual setor visualizará e conduzirá as tarefas desta obrigação.</p>
              </div>
              <div className="space-y-2">
                <Label>Periodicidade</Label>
                <Select
                  value={templateForm.periodicity}
                  onValueChange={(value) =>
                    setTemplateForm((prev) => ({
                      ...prev,
                      periodicity: value as GrowObligationTemplate["periodicity"],
                      due_rule_type: value === "yearly" && prev.due_rule_type === "calendar_day" ? "fixed_date" : prev.due_rule_type,
                    }))
                  }
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{periodicities.map((periodicity) => <SelectItem key={periodicity} value={periodicity}>{growPeriodicityLabel[periodicity]}</SelectItem>)}</SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Mensal, trimestral ou anual. Obrigações anuais podem usar data fixa.</p>
              </div>
              <div className="space-y-2">
                <Label>Competência considerada</Label>
                <Select value={templateForm.competence_reference} onValueChange={(value) => setTemplateForm((prev) => ({ ...prev, competence_reference: value as GrowObligationTemplate["competence_reference"] }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="vigente">{growCompetenceReferenceLabel.vigente}</SelectItem>
                    <SelectItem value="anterior">{growCompetenceReferenceLabel.anterior}</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Use ?anterior? quando a obrigação de um mês se refere ao movimento do mês anterior.</p>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Regra do vencimento técnico</Label>
                <Select
                  value={templateForm.due_rule_type}
                  onValueChange={(value) =>
                    setTemplateForm((prev) => ({
                      ...prev,
                      due_rule_type: value as GrowObligationTemplate["due_rule_type"],
                    }))
                  }
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {dueRuleTypes.map((type) => (
                      <SelectItem key={type} value={type}>{dueRuleTypeLabel[type]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">{dueRuleTypeDescription[templateForm.due_rule_type]}</p>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Ajuste quando o vencimento cair em dia não útil</Label>
                <Select
                  value={templateForm.due_date_adjustment_policy}
                  onValueChange={(value) =>
                    setTemplateForm((prev) => ({
                      ...prev,
                      due_date_adjustment_policy: value as GrowObligationTemplate["due_date_adjustment_policy"],
                    }))
                  }
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(dueDateAdjustmentPolicyLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Se a data cair em sábado, domingo ou feriado cadastrado, o sistema antecipa ou posterga conforme esta opção.
                </p>
              </div>
              {templateForm.due_rule_type === "calendar_day" && (
                <div className="space-y-2">
                  <Label>Dia corrido do vencimento</Label>
                  <Input
                    value={templateForm.due_day}
                    onChange={(event) => setTemplateForm((prev) => ({ ...prev, due_day: event.target.value }))}
                    placeholder="Ex.: 20"
                    inputMode="numeric"
                  />
                  <p className="text-xs text-muted-foreground">Se o mês tiver menos dias, o sistema usa o último dia do mês.</p>
                </div>
              )}
              {templateForm.due_rule_type === "business_day_from_month_start" && (
                <div className="space-y-2">
                  <Label>Nº dia útil</Label>
                  <Input
                    value={templateForm.due_business_day_index}
                    onChange={(event) => setTemplateForm((prev) => ({ ...prev, due_business_day_index: event.target.value }))}
                    placeholder="Ex.: 5"
                    inputMode="numeric"
                  />
                  <p className="text-xs text-muted-foreground">Exemplo: informe 5 para vencer no 5º dia útil do mês.</p>
                </div>
              )}
              {templateForm.due_rule_type === "fixed_date" && (
                <div className="space-y-3 md:col-span-2">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <Label>Datas fixas anuais</Label>
                      <p className="text-xs text-muted-foreground">
                        Adicione uma ou mais datas. O sistema gera uma competência/tarefa anual para cada data cadastrada.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={() =>
                        setTemplateForm((prev) => ({
                          ...prev,
                          due_fixed_dates: [...prev.due_fixed_dates, makeFixedDateDraft()],
                        }))
                      }
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Adicionar data
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {templateForm.due_fixed_dates.map((fixedDate, index) => (
                      <div key={index} className="grid gap-2 rounded-lg border border-border/70 bg-muted/20 p-3 md:grid-cols-[1fr_110px_1fr_auto]">
                        <div className="space-y-1">
                          <Label className="text-xs">Mês</Label>
                          <Select
                            value={fixedDate.month}
                            onValueChange={(value) =>
                              setTemplateForm((prev) => ({
                                ...prev,
                                due_fixed_dates: prev.due_fixed_dates.map((item, itemIndex) =>
                                  itemIndex === index ? { ...item, month: value } : item,
                                ),
                              }))
                            }
                          >
                            <SelectTrigger><SelectValue placeholder="Mês" /></SelectTrigger>
                            <SelectContent>
                              {monthOptions.map((month) => <SelectItem key={month.value} value={month.value}>{month.label}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Dia</Label>
                          <Input
                            value={fixedDate.day}
                            onChange={(event) =>
                              setTemplateForm((prev) => ({
                                ...prev,
                                due_fixed_dates: prev.due_fixed_dates.map((item, itemIndex) =>
                                  itemIndex === index ? { ...item, day: event.target.value } : item,
                                ),
                                due_day: index === 0 ? event.target.value : prev.due_day,
                              }))
                            }
                            placeholder="31"
                            inputMode="numeric"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Identificação opcional</Label>
                          <Input
                            value={fixedDate.label}
                            onChange={(event) =>
                              setTemplateForm((prev) => ({
                                ...prev,
                                due_fixed_dates: prev.due_fixed_dates.map((item, itemIndex) =>
                                  itemIndex === index ? { ...item, label: event.target.value } : item,
                                ),
                              }))
                            }
                            placeholder="Ex.: 1ª parcela, quota única"
                          />
                        </div>
                        <div className="flex items-end">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-10 w-10 text-muted-foreground hover:text-destructive"
                            disabled={templateForm.due_fixed_dates.length === 1}
                            onClick={() =>
                              setTemplateForm((prev) => ({
                                ...prev,
                                due_fixed_dates: prev.due_fixed_dates.filter((_, itemIndex) => itemIndex !== index),
                              }))
                            }
                            aria-label="Remover data fixa anual"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Exemplo: uma obrigação anual pode ter 31/05 e 30/11, cada uma gerando sua própria tarefa no mês correspondente.
                  </p>
                </div>
              )}
              <div className="space-y-2">
                <Label>Mês usado para calcular o prazo</Label>
                <Select
                  value={templateForm.technical_due_month_reference}
                  onValueChange={(value) =>
                    setTemplateForm((prev) => ({
                      ...prev,
                      technical_due_month_reference: value as GrowObligationTemplate["technical_due_month_reference"],
                    }))
                  }
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="vigente">{growDueMonthReferenceLabel.vigente}</SelectItem>
                    <SelectItem value="anterior">{growDueMonthReferenceLabel.anterior}</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Normalmente é o mês vigente. Use anterior apenas quando o prazo cai no mês anterior à competência.</p>
              </div>
              <div className="space-y-2">
                <Label>Prioridade operacional</Label>
                <Select value={templateForm.priority} onValueChange={(value) => setTemplateForm((prev) => ({ ...prev, priority: value as GrowObligationInstance["priority"] }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{priorities.map((priority) => <SelectItem key={priority} value={priority}>{growPriorityLabel[priority]}</SelectItem>)}</SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Define o destaque inicial da tarefa gerada para essa obrigação.</p>
              </div>
              <div className="space-y-2">
                <Label>Dia do vencimento legal</Label>
                <Input value={templateForm.legal_due_day} onChange={(event) => setTemplateForm((prev) => ({ ...prev, legal_due_day: event.target.value }))} placeholder="Opcional" inputMode="numeric" />
                <p className="text-xs text-muted-foreground">Use quando o prazo legal for diferente do prazo técnico interno.</p>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Observações operacionais</Label>
                <Textarea value={templateForm.operational_notes} onChange={(event) => setTemplateForm((prev) => ({ ...prev, operational_notes: event.target.value }))} rows={3} />
                <p className="text-xs text-muted-foreground">Inclua regras fiscais, exceções e orientações que ajudem a equipe a conferir o vencimento.</p>
              </div>
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
                placeholder={"Olá, {{cliente_nome}}.\n\nA obrigação {{obrigacao_nome}} referente à competência {{competencia}} foi concluída.\n\nAcesse o documento: {{documento_link}}\n\nSetor responsável: {{setor}}.\nPrazo técnico: {{prazo_tecnico}}."}
                disabled={!templateForm.completion_whatsapp_enabled}
              />
              <p className="text-xs text-muted-foreground">
                Posicione <code>{DOCUMENT_LINK_PLACEHOLDER}</code> onde o link deve aparecer. Essa variável é obrigatória na mensagem.
              </p>
              <TemplateMessageAssetsField
                templateId={templateForm.id}
                channel="whatsapp"
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
                  placeholder={"Olá, {{cliente_nome}}.\n\nA obrigação {{obrigacao_nome}} referente à competência {{competencia}} foi concluída.\n\nAcesse o documento: {{documento_link}}\n\nSetor responsável: {{setor}}.\nPrazo técnico: {{prazo_tecnico}}."}
                  disabled={!templateForm.completion_email_enabled}
                />
                <p className="text-xs text-muted-foreground">
                  Para aplicar negrito no e-mail, envolva o texto com <code>**</code>. Exemplo: <code>**texto importante**</code>.
                </p>
                <TemplateMessageAssetsField
                  templateId={templateForm.id}
                  channel="email"
                  disabled={!templateForm.completion_email_enabled}
                />
              </div>
            </div>
            <div className="rounded-xl border border-border/60 bg-muted/30 p-3 text-xs text-muted-foreground">
              {"Variáveis disponíveis: {{cliente_nome}}, {{obrigacao_nome}}, {{competencia}}, {{setor}}, {{prazo_tecnico}}, {{documento_link}}. A variável {{documento_link}} é obrigatória no corpo da mensagem."}
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
                      disabled={referenceUploadKey === `${index}`}
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
                        if (file) {
                          const zones = pendingReferenceZones[documentTypeKey] || normalizeExtractionZones(null);
                          setPendingReferenceFiles((prev) => ({
                            ...prev,
                            [documentTypeKey]: [file],
                          }));
                          setPendingReferenceZones((prev) => ({
                            ...prev,
                            [documentTypeKey]: zones,
                          }));
                          setReferencePreviewTarget({
                            kind: "pending",
                            documentTypeKey,
                            fileName: file.name,
                            file,
                            zones,
                          });
                          toast.success("PDF modelo selecionado. Ajuste as marcações antes de salvar a obrigação.");
                          event.target.value = "";
                          return;
                        }
                        setReferenceUploadKey(`${index}`);
                        uploadReferenceMutation.mutate({
                          templateId: templateForm.id,
                          documentTypeKey,
                          file,
                          extractionZones: pendingReferenceZones[documentTypeKey] || normalizeExtractionZones(null),
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
                            <p className="text-xs text-muted-foreground">Pendente para anexar ao salvar a obrigação.</p>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="rounded-xl"
                              onClick={() => {
                                const documentTypeKey = document.document_type_key || slugifyDocumentKey(document.label);
                                setReferencePreviewTarget({
                                  kind: "pending",
                                  documentTypeKey,
                                  fileName: file.name,
                                  file,
                                  zones: pendingReferenceZones[documentTypeKey] || normalizeExtractionZones(null),
                                });
                              }}
                            >
                              Ajustar leitura
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="rounded-xl text-destructive"
                              onClick={() => {
                                const documentTypeKey = document.document_type_key || slugifyDocumentKey(document.label);
                                setPendingReferenceFiles((prev) => {
                                  const next = { ...prev };
                                  delete next[documentTypeKey];
                                  return next;
                                });
                                setPendingReferenceZones((prev) => {
                                  const next = { ...prev };
                                  delete next[documentTypeKey];
                                  return next;
                                });
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
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
                            <div className="flex flex-wrap gap-1.5 pt-1">
                              <Badge variant={reference.validation_status === "approved" ? "default" : "secondary"}>
                                {reference.validation_status === "approved" ? "Modelo aprovado" : reference.validation_status === "validating" ? "Em validação" : "Rascunho"}
                              </Badge>
                              <Badge variant="outline">v{reference.model_version}</Badge>
                              <Badge variant="outline">{reference.validation_correct_count}/{reference.validation_sample_count} acertos</Badge>
                              {reference.validation_false_positive_count > 0 ? (
                                <Badge variant="destructive">{reference.validation_false_positive_count} falso(s) positivo(s)</Badge>
                              ) : null}
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="rounded-xl"
                              onClick={() =>
                                setReferencePreviewTarget({
                                  kind: "saved",
                                  documentTypeKey: reference.document_type_key,
                                  reference,
                                  zones: getReferenceExtractionZones(reference),
                                })
                              }
                            >
                              Ajustar leitura
                            </Button>
                            <Button variant="ghost" size="icon" className="rounded-xl text-destructive" onClick={() => deleteReferenceMutation.mutate(reference.id)}><Trash2 className="h-4 w-4" /></Button>
                          </div>
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
                setPendingReferenceZones({});
              }}
            >Cancelar</Button>
            {templateValidationError && <p className="mr-auto text-sm text-orange-600">{templateValidationError}</p>}
            <Button onClick={() => templateMutation.mutate(templateForm)} disabled={templateMutation.isPending || Boolean(templateValidationError)}>{templateMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Salvar template</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ReferenceDocumentPreviewDialog
        open={Boolean(referencePreviewTarget)}
        target={referencePreviewTarget}
        saving={updateReferenceZonesMutation.isPending || uploadReferenceMutation.isPending}
        onOpenChange={(open) => {
          if (!open && !updateReferenceZonesMutation.isPending) setReferencePreviewTarget(null);
        }}
        onSave={(zones) => {
          if (!referencePreviewTarget) return;
          const normalizedZones = normalizeExtractionZones(zones);
          if (referencePreviewTarget.kind === "pending") {
            setPendingReferenceZones((prev) => ({
              ...prev,
              [referencePreviewTarget.documentTypeKey]: normalizedZones,
            }));
            if (templateForm.id) {
              setReferenceUploadKey(referencePreviewTarget.documentTypeKey);
              uploadReferenceMutation.mutate({
                templateId: templateForm.id,
                documentTypeKey: referencePreviewTarget.documentTypeKey,
                file: referencePreviewTarget.file,
                extractionZones: normalizedZones,
              });
              setReferencePreviewTarget(null);
              return;
            }
            setReferencePreviewTarget(null);
            toast.success("Marcações salvas para anexar junto com a obrigação.");
            return;
          }
          updateReferenceZonesMutation.mutate({
            referenceFileId: referencePreviewTarget.reference.id,
            zones: normalizedZones,
          });
        }}
      />

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
          <DialogHeader><DialogTitle>Revisar vínculo do documento</DialogTitle><DialogDescription>Escolha a competência correta para concluir a triagem.</DialogDescription></DialogHeader>
          {documentInResolution && (
            <div className="space-y-4 py-2">
              <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 text-sm">
                <p className="font-medium">{documentInResolution.file_name}</p>
                <p className="mt-1 text-muted-foreground">Cliente: {documentInResolution.detected_client?.name || documentInResolution.client?.name || "não identificado"} · Documento: {documentInResolution.document_definition?.label || documentInResolution.document_type_key || "não identificado"}</p>
                <p className="mt-1 text-muted-foreground">{matchStrategyLabel(documentInResolution.matched_by)} · Score {documentInResolution.reference_match_score.toFixed(2)}</p>
                {documentInResolution.auto_link_block_reason && <p className="mt-2 text-xs text-orange-600">{documentInResolution.auto_link_block_reason}</p>}
              </div>
              <div className="rounded-2xl border border-border/60 p-4 text-sm">
                <p className="font-medium">Evidencias da leitura</p>
                <div className="mt-2 grid gap-1 text-muted-foreground sm:grid-cols-2">
                  <p>CPF/CNPJ detectado: <span className="text-foreground">{documentInResolution.detected_cnpj || "nao encontrado"}</span></p>
                  <p>Competencia detectada: <span className="text-foreground">{documentInResolution.competence_detected || "nao encontrada"}</span></p>
                  <p>Modelo: <span className="text-foreground">{documentInResolution.reference_file?.file_name || "nao identificado"}</span></p>
                  <p>Decisao: <span className="text-foreground">{documentInResolution.recognition_decision || "revisao manual"}</span></p>
                </div>
                {documentInResolution.reference_match_reasons.length > 0 && (
                  <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                    {documentInResolution.reference_match_reasons.map((reason) => <li key={reason}>{reason}</li>)}
                  </ul>
                )}
              </div>
              <div className="space-y-2">
                <Label>Competencia</Label>
                <Select value={documentResolutionInstanceId || "none"} onValueChange={(value) => setDocumentResolutionInstanceId(value === "none" ? "" : value)}>
                  <SelectTrigger><SelectValue placeholder="Selecione a competência" /></SelectTrigger>
                  <SelectContent><SelectItem value="none">Selecione</SelectItem>{documentResolutionOptions.map((instance) => <SelectItem key={instance.id} value={instance.id}>{buildInstanceLabel(instance)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Motivo da decisao</Label><Textarea value={documentResolutionNotes} onChange={(event) => setDocumentResolutionNotes(event.target.value)} placeholder="Descreva por que o vinculo foi confirmado ou corrigido." rows={3} /></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDocumentResolutionId(null)}>Cancelar</Button>
            <Button variant="ghost" className="text-destructive" onClick={() => documentResolutionId && documentResolveMutation.mutate({ inboxItemId: documentResolutionId, decision: "reject", notes: documentResolutionNotes || "Documento rejeitado manualmente." })}>Rejeitar</Button>
            <Button onClick={() => documentResolutionId && documentResolveMutation.mutate({ inboxItemId: documentResolutionId, decision: "accept", instanceId: documentResolutionInstanceId, notes: documentResolutionNotes })} disabled={documentResolveMutation.isPending || !documentResolutionInstanceId || !documentResolutionNotes.trim()}>{documentResolveMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Confirmar vinculo</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

