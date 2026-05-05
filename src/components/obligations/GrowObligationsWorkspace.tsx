import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  CalendarClock,
  ClipboardList,
  FileArchive,
  FileSpreadsheet,
  FolderUp,
  Loader2,
  Plus,
  RefreshCcw,
  ShieldCheck,
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
import { supabase } from "@/integrations/supabase/client";
import {
  growCompetenceReferenceLabel,
  growObligationStatusClass,
  growObligationStatusLabel,
  growPeriodicityLabel,
  growPriorityLabel,
  invokeGrowObligations,
  type GrowObligationInstance,
  type GrowObligationTemplate,
  type GrowObligationsOverviewPayload,
} from "@/lib/growObligations";
import {
  buildSecureStoragePath,
  SECURE_DOCUMENT_ACCEPT,
  validateSecureDocument,
} from "@/lib/fileUploadSecurity";

type WorkspaceTab = "catalogo" | "execucao" | "documentos";

interface GrowObligationsWorkspaceProps {
  defaultTab?: WorkspaceTab;
  initialClientId?: string | null;
}

interface TemplateFormState {
  id: string | null;
  name: string;
  sector: string;
  periodicity: GrowObligationTemplate["periodicity"];
  competence_reference: GrowObligationTemplate["competence_reference"];
  due_day: string;
  legal_due_day: string;
  priority: GrowObligationInstance["priority"];
  expected_documents: string;
  is_active: boolean;
  generates_calendar: boolean;
  generates_kanban: boolean;
  requires_protocol: boolean;
  requires_document: boolean;
  operational_notes: string;
}

interface InstanceFormState {
  instanceId: string;
  status: GrowObligationInstance["status"];
  priority: GrowObligationInstance["priority"];
  protocol: string;
  completion_notes: string;
  event_comment: string;
}

interface UploadDraft {
  client_id: string;
  template_id: string;
  instance_id: string;
  suggested_competence_label: string;
  notes: string;
}

const sectors = ["Contábil", "Fiscal", "Departamento Pessoal", "Financeiro", "Comercial", "Societário", "Geral"];
const periodicities: GrowObligationTemplate["periodicity"][] = ["monthly", "quarterly", "yearly", "custom"];
const priorities: GrowObligationInstance["priority"][] = ["baixa", "media", "alta", "urgente"];
const statusOptions: GrowObligationInstance["status"][] = [
  "pendente",
  "em_andamento",
  "aguardando_documento",
  "em_revisao",
  "concluida",
  "atrasada",
  "cancelada",
];

const makeTemplateForm = (template?: GrowObligationTemplate | null): TemplateFormState => ({
  id: template?.id || null,
  name: template?.name || "",
  sector: template?.sector || "Geral",
  periodicity: template?.periodicity || "monthly",
  competence_reference: template?.competence_reference || "vigente",
  due_day: String(template?.due_day ?? 10),
  legal_due_day: template?.legal_due_day ? String(template.legal_due_day) : "",
  priority: template?.priority || "media",
  expected_documents: (template?.expected_documents || []).join(", "),
  is_active: template?.is_active ?? true,
  generates_calendar: template?.generates_calendar ?? true,
  generates_kanban: template?.generates_kanban ?? false,
  requires_protocol: template?.requires_protocol ?? false,
  requires_document: template?.requires_document ?? true,
  operational_notes: template?.operational_notes || "",
});

const makeInstanceForm = (instance: GrowObligationInstance): InstanceFormState => ({
  instanceId: instance.id,
  status: instance.status,
  priority: instance.priority,
  protocol: instance.protocol || "",
  completion_notes: instance.completion_notes || "",
  event_comment: "",
});

const overviewQueryKey = ["grow-obligations-overview"];

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
  const clientName = instance.client?.name || "Cliente";
  const templateName = instance.template?.name || "Obrigação";
  return `${clientName} · ${templateName} · ${instance.competence_label}`;
}

export function GrowObligationsWorkspace({
  defaultTab = "execucao",
  initialClientId = null,
}: GrowObligationsWorkspaceProps) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<WorkspaceTab>(defaultTab);
  const [templateSearch, setTemplateSearch] = useState("");
  const [instanceSearch, setInstanceSearch] = useState("");
  const [instanceStatusFilter, setInstanceStatusFilter] = useState<string>("all");
  const [instanceClientFilter, setInstanceClientFilter] = useState<string>(initialClientId || "all");
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [templateForm, setTemplateForm] = useState<TemplateFormState>(makeTemplateForm());
  const [instanceDialogOpen, setInstanceDialogOpen] = useState(false);
  const [instanceForm, setInstanceForm] = useState<InstanceFormState | null>(null);
  const [uploadDraft, setUploadDraft] = useState<UploadDraft>({
    client_id: initialClientId || "",
    template_id: "",
    instance_id: "",
    suggested_competence_label: "",
    notes: "",
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [documentResolutionId, setDocumentResolutionId] = useState<string | null>(null);
  const [documentResolutionInstanceId, setDocumentResolutionInstanceId] = useState<string>("");
  const [documentResolutionNotes, setDocumentResolutionNotes] = useState("");

  const overviewQuery = useQuery({
    queryKey: overviewQueryKey,
    queryFn: () => invokeGrowObligations<GrowObligationsOverviewPayload>({ action: "overview" }),
  });

  const overview = overviewQuery.data;

  const filteredTemplates = useMemo(() => {
    const items = overview?.templates || [];
    const token = templateSearch.trim().toLowerCase();
    if (!token) return items;
    return items.filter((template) =>
      `${template.name} ${template.sector}`.toLowerCase().includes(token),
    );
  }, [overview?.templates, templateSearch]);

  const filteredInstances = useMemo(() => {
    const items = overview?.instances || [];
    const token = instanceSearch.trim().toLowerCase();
    return items.filter((instance) => {
      if (instanceStatusFilter !== "all" && instance.status !== instanceStatusFilter) return false;
      if (instanceClientFilter !== "all" && instance.client_id !== instanceClientFilter) return false;
      if (!token) return true;
      return `${instance.client?.name || ""} ${instance.template?.name || ""} ${instance.competence_label}`
        .toLowerCase()
        .includes(token);
    });
  }, [instanceClientFilter, instanceSearch, instanceStatusFilter, overview?.instances]);

  const pendingDocuments = useMemo(
    () => (overview?.documents || []).filter((item) => item.status === "pending_review"),
    [overview?.documents],
  );

  const templateMutation = useMutation({
    mutationFn: (payload: TemplateFormState) =>
      invokeGrowObligations({
        action: "upsert_template",
        id: payload.id,
        name: payload.name,
        sector: payload.sector,
        periodicity: payload.periodicity,
        competence_reference: payload.competence_reference,
        due_day: Number(payload.due_day || 10),
        legal_due_day: payload.legal_due_day ? Number(payload.legal_due_day) : null,
        priority: payload.priority,
        expected_documents: payload.expected_documents
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
        is_active: payload.is_active,
        generates_calendar: payload.generates_calendar,
        generates_kanban: payload.generates_kanban,
        requires_protocol: payload.requires_protocol,
        requires_document: payload.requires_document,
        operational_notes: payload.operational_notes,
      }),
    onSuccess: async () => {
      toast.success("Obrigação mestre salva.");
      setTemplateDialogOpen(false);
      setTemplateForm(makeTemplateForm());
      await queryClient.invalidateQueries({ queryKey: overviewQueryKey });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Falha ao salvar obrigação.");
    },
  });

  const generateMutation = useMutation({
    mutationFn: () =>
      invokeGrowObligations({
        action: "generate_instances",
        client_id: instanceClientFilter !== "all" ? instanceClientFilter : null,
      }),
    onSuccess: async () => {
      toast.success("Competências sincronizadas.");
      await queryClient.invalidateQueries({ queryKey: overviewQueryKey });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Falha ao gerar competências.");
    },
  });

  const instanceMutation = useMutation({
    mutationFn: (payload: InstanceFormState) =>
      invokeGrowObligations({
        action: "update_instance",
        instance_id: payload.instanceId,
        status: payload.status,
        priority: payload.priority,
        protocol: payload.protocol,
        completion_notes: payload.completion_notes,
        event_comment: payload.event_comment,
      }),
    onSuccess: async () => {
      toast.success("Instância atualizada.");
      setInstanceDialogOpen(false);
      setInstanceForm(null);
      await queryClient.invalidateQueries({ queryKey: overviewQueryKey });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Falha ao atualizar instância.");
    },
  });

  const documentResolveMutation = useMutation({
    mutationFn: ({
      inboxItemId,
      decision,
      instanceId,
      notes,
    }: {
      inboxItemId: string;
      decision: "accept" | "reject";
      instanceId?: string;
      notes?: string;
    }) =>
      invokeGrowObligations({
        action: "resolve_document",
        inbox_item_id: inboxItemId,
        decision,
        instance_id: instanceId,
        notes,
        blocking_reason: notes,
      }),
    onSuccess: async () => {
      toast.success("Documento processado.");
      setDocumentResolutionId(null);
      setDocumentResolutionInstanceId("");
      setDocumentResolutionNotes("");
      await queryClient.invalidateQueries({ queryKey: overviewQueryKey });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Falha ao processar documento.");
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!selectedFile) {
        throw new Error("Selecione um arquivo.");
      }

      const validationError = validateSecureDocument(selectedFile);
      if (validationError) {
        throw new Error(validationError);
      }

      const path = buildSecureStoragePath(
        ["grow-obligations", uploadDraft.client_id || "sem-cliente", new Date().toISOString().slice(0, 7)],
        selectedFile.name,
      );

      const { error: uploadError } = await supabase.storage
        .from("obligation-files")
        .upload(path, selectedFile, {
          contentType: selectedFile.type || undefined,
          upsert: false,
        });

      if (uploadError) {
        throw uploadError;
      }

      return invokeGrowObligations({
        action: "register_document_upload",
        client_id: uploadDraft.client_id || null,
        template_id: uploadDraft.template_id || null,
        instance_id: uploadDraft.instance_id || null,
        suggested_competence_label: uploadDraft.suggested_competence_label || null,
        notes: uploadDraft.notes || null,
        file_name: selectedFile.name,
        storage_bucket: "obligation-files",
        storage_path: path,
        content_type: selectedFile.type || null,
        file_size: selectedFile.size,
      });
    },
    onSuccess: async () => {
      toast.success("Documento enviado para a central da Grow.");
      setSelectedFile(null);
      setUploadDraft({
        client_id: initialClientId || "",
        template_id: "",
        instance_id: "",
        suggested_competence_label: "",
        notes: "",
      });
      await queryClient.invalidateQueries({ queryKey: overviewQueryKey });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Falha ao enviar documento.");
    },
  });

  const documentResolutionOptions = useMemo(() => {
    const document = pendingDocuments.find((item) => item.id === documentResolutionId);
    if (!document) return overview?.instances || [];

    return (overview?.instances || []).filter((instance) => {
      if (document.client_id && instance.client_id !== document.client_id) return false;
      if (document.suggested_template_id && instance.template_id !== document.suggested_template_id) return false;
      return true;
    });
  }, [documentResolutionId, overview?.instances, pendingDocuments]);

  const selectedClientTemplates = useMemo(() => {
    if (!uploadDraft.client_id) return overview?.templates || [];
    const templateIds = new Set(
      (overview?.profiles || [])
        .filter((profile) => profile.client_id === uploadDraft.client_id && profile.is_active)
        .map((profile) => profile.template_id),
    );
    return (overview?.templates || []).filter((template) => templateIds.has(template.id));
  }, [overview?.profiles, overview?.templates, uploadDraft.client_id]);

  const selectedClientInstances = useMemo(() => {
    return (overview?.instances || []).filter((instance) => {
      if (uploadDraft.client_id && instance.client_id !== uploadDraft.client_id) return false;
      if (uploadDraft.template_id && instance.template_id !== uploadDraft.template_id) return false;
      return true;
    });
  }, [overview?.instances, uploadDraft.client_id, uploadDraft.template_id]);

  const openTemplateDialog = (template?: GrowObligationTemplate) => {
    setTemplateForm(makeTemplateForm(template));
    setTemplateDialogOpen(true);
  };

  const openInstanceDialog = (instance: GrowObligationInstance) => {
    setInstanceForm(makeInstanceForm(instance));
    setInstanceDialogOpen(true);
  };

  const handleSelectClient = (clientId: string) => {
    setUploadDraft((prev) => ({
      ...prev,
      client_id: clientId,
      template_id: "",
      instance_id: "",
    }));
  };

  if (overviewQuery.isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (overviewQuery.isError || !overview) {
    return (
      <Card className="rounded-3xl border-destructive/30">
        <CardHeader>
          <CardTitle>Falha ao carregar o módulo</CardTitle>
          <CardDescription>
            {overviewQuery.error instanceof Error ? overviewQuery.error.message : "Não foi possível consultar o domínio nativo da Grow."}
          </CardDescription>
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
            <Badge variant="secondary" className="rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.28em]">
              Grow Native
            </Badge>
            <div className="space-y-2">
              <h1 className="font-heading text-3xl font-bold tracking-tight">Obrigações Grow</h1>
              <p className="max-w-3xl text-sm text-muted-foreground">
                Domínio interno de obrigações, execução operacional e central de documentos sem dependência do Acessórias.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" className="rounded-2xl" onClick={() => overviewQuery.refetch()}>
              <RefreshCcw className="mr-2 h-4 w-4" />
              Atualizar visão
            </Button>
            <Button className="rounded-2xl" onClick={() => generateMutation.mutate()} disabled={generateMutation.isPending}>
              {generateMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CalendarClock className="mr-2 h-4 w-4" />}
              Gerar competências
            </Button>
          </div>
        </div>

        <div className="relative mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            {
              label: "Pendentes",
              value: overview.summary.pending_instances,
              icon: ClipboardList,
              accent: "text-amber-600",
            },
            {
              label: "Atrasadas",
              value: overview.summary.overdue_instances,
              icon: AlertTriangle,
              accent: "text-red-600",
            },
            {
              label: "Aguardando documento",
              value: overview.summary.waiting_documents + overview.summary.inbox_pending,
              icon: FileArchive,
              accent: "text-orange-600",
            },
            {
              label: "Templates ativos",
              value: overview.summary.templates_active,
              icon: ShieldCheck,
              accent: "text-primary",
            },
          ].map((item) => (
            <motion.div
              key={item.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18 }}
              className="rounded-3xl border border-border/60 bg-background/75 p-4"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{item.label}</p>
                  <p className="mt-3 text-3xl font-semibold">{item.value}</p>
                </div>
                <item.icon className={`h-5 w-5 ${item.accent}`} />
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as WorkspaceTab)} className="space-y-4">
        <TabsList className="grid h-auto w-full grid-cols-3 rounded-2xl bg-muted/50 p-1">
          <TabsTrigger value="catalogo" className="rounded-xl">Catálogo</TabsTrigger>
          <TabsTrigger value="execucao" className="rounded-xl">Execução</TabsTrigger>
          <TabsTrigger value="documentos" className="rounded-xl">Central de Documentos</TabsTrigger>
        </TabsList>

        <TabsContent value="catalogo" className="space-y-4">
          <Card className="rounded-3xl">
            <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <CardTitle>Catálogo mestre</CardTitle>
                <CardDescription>
                  Defina a obrigação uma vez e use o mesmo template em todos os clientes.
                </CardDescription>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Input
                  value={templateSearch}
                  onChange={(event) => setTemplateSearch(event.target.value)}
                  placeholder="Buscar por nome, código ou setor"
                  className="w-full sm:w-72"
                />
                <Button className="rounded-2xl" onClick={() => openTemplateDialog()}>
                  <Plus className="mr-2 h-4 w-4" />
                  Nova obrigação
                </Button>
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
                      <p className="text-sm text-muted-foreground">
                        {growPeriodicityLabel[template.periodicity]} · vencimento técnico no dia {template.due_day}
                        {` · mês base ${growCompetenceReferenceLabel[template.competence_reference]}`}
                        {template.legal_due_day ? ` · vencimento legal ${template.legal_due_day}` : ""}
                      </p>
                      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                        <span>Calendário: {template.generates_calendar ? "sim" : "não"}</span>
                        <span>Kanban: {template.generates_kanban ? "sim" : "não"}</span>
                        <span>Protocolo: {template.requires_protocol ? "obrigatório" : "opcional"}</span>
                        <span>Documento: {template.requires_document ? "obrigatório" : "opcional"}</span>
                      </div>
                      {template.expected_documents.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {template.expected_documents.map((item) => (
                            <Badge key={item} variant="outline">{item}</Badge>
                          ))}
                        </div>
                      )}
                    </div>

                    <Button variant="outline" className="rounded-2xl" onClick={() => openTemplateDialog(template)}>
                      Editar
                    </Button>
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
                <div>
                  <CardTitle>Fila operacional</CardTitle>
                  <CardDescription>
                    Competências geradas por cliente com integração automática ao calendário e ao kanban quando configurado.
                  </CardDescription>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Input
                    value={instanceSearch}
                    onChange={(event) => setInstanceSearch(event.target.value)}
                    placeholder="Buscar cliente, obrigação ou competência"
                    className="sm:w-72"
                  />
                  <Select value={instanceStatusFilter} onValueChange={setInstanceStatusFilter}>
                    <SelectTrigger className="sm:w-52">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os status</SelectItem>
                      {statusOptions.map((status) => (
                        <SelectItem key={status} value={status}>
                          {growObligationStatusLabel[status]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={instanceClientFilter} onValueChange={setInstanceClientFilter}>
                    <SelectTrigger className="sm:w-64">
                      <SelectValue placeholder="Cliente" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os clientes</SelectItem>
                      {overview.clients.map((client) => (
                        <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>
                      ))}
                    </SelectContent>
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
                        <p className="font-medium">{instance.template?.name || "Obrigação"}</p>
                        <Badge className={`border-0 ${growObligationStatusClass[instance.status]}`}>
                          {growObligationStatusLabel[instance.status]}
                        </Badge>
                        <Badge variant="outline">{growPriorityLabel[instance.priority]}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {instance.client?.name || "Cliente"} · competência {instance.competence_label}
                      </p>
                      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                        <span>Vencimento técnico: {formatDate(instance.technical_due_date)}</span>
                        <span>Vencimento legal: {formatDate(instance.legal_due_date)}</span>
                        <span>Protocolo: {instance.protocol || "-"}</span>
                      </div>
                    </div>
                    <Button variant="outline" className="rounded-2xl" onClick={() => openInstanceDialog(instance)}>
                      Atualizar execução
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
              <CardDescription>
                Envie arquivos direto para a Grow, vincule manualmente quando necessário e mantenha rastreabilidade no histórico da obrigação.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
              <div className="space-y-4 rounded-3xl border border-dashed border-primary/30 bg-primary/5 p-5">
                <div className="space-y-1">
                  <p className="text-sm font-medium">Novo envio</p>
                  <p className="text-xs text-muted-foreground">
                    Associação manual direta quando você já sabe a competência, ou triagem assistida quando ainda precisa revisar.
                  </p>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Cliente</Label>
                    <Select value={uploadDraft.client_id || "none"} onValueChange={(value) => handleSelectClient(value === "none" ? "" : value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o cliente" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sem cliente definido</SelectItem>
                        {overview.clients.map((client) => (
                          <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Obrigação sugerida</Label>
                    <Select value={uploadDraft.template_id || "none"} onValueChange={(value) => setUploadDraft((prev) => ({ ...prev, template_id: value === "none" ? "" : value, instance_id: "" }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a obrigação" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sem obrigação definida</SelectItem>
                        {selectedClientTemplates.map((template) => (
                          <SelectItem key={template.id} value={template.id}>{template.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label>Vincular direto a uma competência</Label>
                    <Select value={uploadDraft.instance_id || "none"} onValueChange={(value) => setUploadDraft((prev) => ({ ...prev, instance_id: value === "none" ? "" : value }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione uma competência para anexação imediata" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sem vínculo direto</SelectItem>
                        {selectedClientInstances.map((instance) => (
                          <SelectItem key={instance.id} value={instance.id}>{buildInstanceLabel(instance)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Competência sugerida</Label>
                    <Input
                      value={uploadDraft.suggested_competence_label}
                      onChange={(event) => setUploadDraft((prev) => ({ ...prev, suggested_competence_label: event.target.value }))}
                      placeholder="Ex.: 04/2026"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Arquivo</Label>
                    <Input
                      type="file"
                      accept={SECURE_DOCUMENT_ACCEPT}
                      onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Observações</Label>
                  <Textarea
                    value={uploadDraft.notes}
                    onChange={(event) => setUploadDraft((prev) => ({ ...prev, notes: event.target.value }))}
                    placeholder="Contexto do envio, pendência ou observação interna"
                    rows={4}
                  />
                </div>

                <Button className="rounded-2xl" onClick={() => uploadMutation.mutate()} disabled={uploadMutation.isPending}>
                  {uploadMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FolderUp className="mr-2 h-4 w-4" />}
                  Enviar para a central
                </Button>
              </div>

              <div className="space-y-4">
                <div className="rounded-3xl border p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Triagem pendente</p>
                      <p className="text-xs text-muted-foreground">{pendingDocuments.length} documentos aguardando análise</p>
                    </div>
                    <Badge variant="secondary">{overview.summary.inbox_pending}</Badge>
                  </div>

                  <div className="space-y-3">
                    {pendingDocuments.map((item) => (
                      <div key={item.id} className="rounded-2xl border border-border/60 p-3">
                        <div className="flex flex-col gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-medium">{item.file_name}</p>
                            <Badge variant="outline">{Math.round((item.identification_confidence || 0) * 100) / 100}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Cliente: {item.client?.name || "não identificado"} · Obrigação: {item.template?.name || "não identificada"} · Competência: {item.suggested_competence_label || "-"}
                          </p>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="rounded-xl"
                              onClick={() => {
                                setDocumentResolutionId(item.id);
                                setDocumentResolutionInstanceId(item.linked_instance?.id || "");
                                setDocumentResolutionNotes(item.notes || "");
                              }}
                            >
                              Revisar vínculo
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="rounded-xl text-destructive"
                              onClick={() => documentResolveMutation.mutate({ inboxItemId: item.id, decision: "reject", notes: "Documento rejeitado manualmente." })}
                            >
                              Rejeitar
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-3xl border p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Últimos documentos</p>
                      <p className="text-xs text-muted-foreground">Histórico recente da central interna</p>
                    </div>
                    <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="space-y-3">
                    {overview.documents.slice(0, 8).map((item) => (
                      <div key={item.id} className="rounded-2xl border border-border/60 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1">
                            <p className="text-sm font-medium">{item.file_name}</p>
                            <p className="text-xs text-muted-foreground">
                              {item.linked_instance ? buildInstanceLabel(item.linked_instance) : item.client?.name || "Sem cliente"}
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              {formatDateTime(item.created_at)}
                            </p>
                          </div>
                          <Badge variant={item.status === "linked" ? "default" : item.status === "rejected" ? "destructive" : "secondary"}>
                            {item.status === "linked" ? "Vinculado" : item.status === "rejected" ? "Rejeitado" : "Em revisão"}
                          </Badge>
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
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{templateForm.id ? "Editar obrigação" : "Nova obrigação"}</DialogTitle>
            <DialogDescription>
              O template define a regra central da obrigação para todos os clientes.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={templateForm.name} onChange={(event) => setTemplateForm((prev) => ({ ...prev, name: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Setor</Label>
              <Select value={templateForm.sector} onValueChange={(value) => setTemplateForm((prev) => ({ ...prev, sector: value }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{sectors.map((sector) => <SelectItem key={sector} value={sector}>{sector}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Periodicidade</Label>
              <Select value={templateForm.periodicity} onValueChange={(value) => setTemplateForm((prev) => ({ ...prev, periodicity: value as GrowObligationTemplate["periodicity"] }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{periodicities.map((periodicity) => <SelectItem key={periodicity} value={periodicity}>{growPeriodicityLabel[periodicity]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Mês base</Label>
              <Select value={templateForm.competence_reference} onValueChange={(value) => setTemplateForm((prev) => ({ ...prev, competence_reference: value as GrowObligationTemplate["competence_reference"] }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="vigente">{growCompetenceReferenceLabel.vigente}</SelectItem>
                  <SelectItem value="anterior">{growCompetenceReferenceLabel.anterior}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Dia do vencimento técnico</Label>
              <Input value={templateForm.due_day} onChange={(event) => setTemplateForm((prev) => ({ ...prev, due_day: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Prioridade</Label>
              <Select value={templateForm.priority} onValueChange={(value) => setTemplateForm((prev) => ({ ...prev, priority: value as GrowObligationInstance["priority"] }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{priorities.map((priority) => <SelectItem key={priority} value={priority}>{growPriorityLabel[priority]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Dia do vencimento legal</Label>
              <Input value={templateForm.legal_due_day} onChange={(event) => setTemplateForm((prev) => ({ ...prev, legal_due_day: event.target.value }))} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Documentos esperados</Label>
              <Input
                value={templateForm.expected_documents}
                onChange={(event) => setTemplateForm((prev) => ({ ...prev, expected_documents: event.target.value }))}
                placeholder="Ex.: extrato bancário, relatório fiscal, folha de pagamento"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Observações operacionais</Label>
              <Textarea value={templateForm.operational_notes} onChange={(event) => setTemplateForm((prev) => ({ ...prev, operational_notes: event.target.value }))} rows={4} />
            </div>
          </div>

          <div className="grid gap-3 rounded-2xl border border-border/70 p-4 md:grid-cols-2">
            {[
              ["is_active", "Template ativo"],
              ["generates_calendar", "Gerar no calendário"],
              ["generates_kanban", "Gerar no kanban"],
              ["requires_protocol", "Exigir protocolo"],
              ["requires_document", "Exigir documento"],
            ].map(([field, label]) => (
              <label key={field} className="flex items-center justify-between gap-4 text-sm">
                <span>{label}</span>
                <input
                  type="checkbox"
                  checked={Boolean(templateForm[field as keyof TemplateFormState])}
                  onChange={(event) =>
                    setTemplateForm((prev) => ({ ...prev, [field]: event.target.checked }))
                  }
                />
              </label>
            ))}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setTemplateDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => templateMutation.mutate(templateForm)} disabled={templateMutation.isPending}>
              {templateMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Salvar template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={instanceDialogOpen} onOpenChange={setInstanceDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Atualizar execução</DialogTitle>
            <DialogDescription>Altere o status operacional, protocolo e observações da competência.</DialogDescription>
          </DialogHeader>
          {instanceForm && (
            <div className="space-y-4 py-2">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={instanceForm.status} onValueChange={(value) => setInstanceForm((prev) => prev ? { ...prev, status: value as GrowObligationInstance["status"] } : prev)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {statusOptions.map((status) => (
                        <SelectItem key={status} value={status}>{growObligationStatusLabel[status]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Prioridade</Label>
                  <Select value={instanceForm.priority} onValueChange={(value) => setInstanceForm((prev) => prev ? { ...prev, priority: value as GrowObligationInstance["priority"] } : prev)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {priorities.map((priority) => (
                        <SelectItem key={priority} value={priority}>{growPriorityLabel[priority]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Protocolo</Label>
                <Input value={instanceForm.protocol} onChange={(event) => setInstanceForm((prev) => prev ? { ...prev, protocol: event.target.value } : prev)} />
              </div>
              <div className="space-y-2">
                <Label>Notas de conclusão</Label>
                <Textarea value={instanceForm.completion_notes} onChange={(event) => setInstanceForm((prev) => prev ? { ...prev, completion_notes: event.target.value } : prev)} rows={3} />
              </div>
              <div className="space-y-2">
                <Label>Comentário do histórico</Label>
                <Textarea value={instanceForm.event_comment} onChange={(event) => setInstanceForm((prev) => prev ? { ...prev, event_comment: event.target.value } : prev)} rows={2} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setInstanceDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => instanceForm && instanceMutation.mutate(instanceForm)} disabled={instanceMutation.isPending}>
              {instanceMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Salvar execução
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(documentResolutionId)} onOpenChange={(open) => !open && setDocumentResolutionId(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Revisar vínculo do documento</DialogTitle>
            <DialogDescription>
              Selecione a competência correta para concluir a triagem e anexar o arquivo ao histórico operacional.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Competência</Label>
              <Select value={documentResolutionInstanceId || "none"} onValueChange={(value) => setDocumentResolutionInstanceId(value === "none" ? "" : value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a competência" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Selecione</SelectItem>
                  {documentResolutionOptions.map((instance) => (
                    <SelectItem key={instance.id} value={instance.id}>
                      {buildInstanceLabel(instance)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea value={documentResolutionNotes} onChange={(event) => setDocumentResolutionNotes(event.target.value)} rows={3} />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              className="text-destructive"
              onClick={() =>
                documentResolutionId &&
                documentResolveMutation.mutate({
                  inboxItemId: documentResolutionId,
                  decision: "reject",
                  notes: documentResolutionNotes || "Documento rejeitado manualmente.",
                })
              }
            >
              Rejeitar
            </Button>
            <Button
              onClick={() =>
                documentResolutionId &&
                documentResolveMutation.mutate({
                  inboxItemId: documentResolutionId,
                  decision: "accept",
                  instanceId: documentResolutionInstanceId,
                  notes: documentResolutionNotes,
                })
              }
              disabled={!documentResolutionInstanceId || documentResolveMutation.isPending}
            >
              {documentResolveMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Vincular documento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
