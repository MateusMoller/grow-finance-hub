import { useCallback, useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/app/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ArrowLeft, Building2, Save, Upload, FileText, Trash2, Download,
  Loader2, Plus, Calculator, Receipt, Users, FolderOpen, CalendarDays, ClipboardList, Wallet,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/useAuth";
import { getClientSegmentOptions } from "@/lib/clientSegments";
import { sectorOptions } from "@/components/portal/types";
import { toast } from "sonner";
import { motion } from "framer-motion";

interface ClientRecord {
  id: string;
  code: string | null;
  name: string;
  trade_name: string | null;
  cnpj: string | null;
  state_registration: string | null;
  municipal_registration: string | null;
  cnae_main: string | null;
  regime: string | null;
  simples_annex: string | null;
  opened_at: string | null;
  cnpj_status: string | null;
  city: string | null;
  state: string | null;
  sector: string | null;
  status: string | null;
  contact: string | null;
  email: string | null;
  ddd: string | null;
  phone: string | null;
  whatsapp: string | null;
  address: string | null;
  has_digital_certificate: boolean | null;
  certificate_type: string | null;
  certificate_expires_on: string | null;
  notes: string | null;
  gov_password: string | null;
  portal_user_id: string | null;
  portal_cashflow_enabled: boolean;
}

interface ClientDataEntry {
  id: string;
  field_name: string;
  field_value: string | null;
  category: string;
  period: string | null;
}

type ClientDataRow = Database["public"]["Tables"]["client_data"]["Row"];
type ClientPortalTaskRow = Database["public"]["Tables"]["client_portal_tasks"]["Row"];
type PortalTaskStatus = "pending_client" | "in_analysis" | "completed" | "cancelled";
type PortalTaskType = "document" | "request_return" | "analysis" | "deliverable" | "general";

interface ClientFile {
  id: string;
  file_name: string;
  file_path: string;
  file_size: number | null;
  category: string;
  created_at: string;
}

// Field definitions for each category
const contabilidadeFields = [
  { name: "obrigacao_contabil", label: "Obrigacao Contabil" },
  { name: "envia_extratos_bancarios", label: "Envia Extratos Bancarios" },
  { name: "envia_notas_fiscais", label: "Envia Notas Fiscais" },
  { name: "controle_financeiro", label: "Controle Financeiro" },
  { name: "sistema_financeiro", label: "Sistema Financeiro" },
  { name: "integracao_contabil", label: "Integracao Contabil" },
  { name: "balanco_anual", label: "Balanco Anual" },
  { name: "responsavel_contabil_grow", label: "Responsavel Contabil Grow" },
  { name: "periodicidade_relatorios", label: "Periodicidade Relatorios" },
  { name: "observacoes_contabeis", label: "Observacoes Contabeis" },
];

const fiscalFields = [
  { name: "regime_icms", label: "Regime ICMS" },
  { name: "contribuinte_icms", label: "Contribuinte ICMS" },
  { name: "contribuinte_ipi", label: "Contribuinte IPI" },
  { name: "tipo_operacao", label: "Tipo de Operacao" },
  { name: "emite_nfe", label: "Emite NF-e" },
  { name: "emite_nfse", label: "Emite NFS-e" },
  { name: "portal_nf_utilizado", label: "Portal NF utilizado" },
  { name: "possui_st", label: "Possui ST" },
  { name: "estados_que_opera", label: "Estados que Opera" },
  { name: "controle_estoque", label: "Controle de Estoque" },
  { name: "sistema_vendas", label: "Sistema de Vendas" },
  { name: "integracao_contabil", label: "Integracao Contabil" },
  { name: "entrega_gia", label: "Entrega GIA" },
  { name: "entrega_sped_fiscal", label: "Entrega SPED Fiscal" },
  { name: "entrega_efd_contribuicoes", label: "Entrega EFD Contribuicoes" },
  { name: "observacoes_fiscais", label: "Observacoes Fiscais" },
];

const dpFields = [
  { name: "possui_funcionarios", label: "Possui Funcionarios" },
  { name: "quantidade_funcionarios", label: "Quantidade Funcionarios" },
  { name: "possui_pro_labore", label: "Possui Pro-labore" },
  { name: "quantidade_socios", label: "Quantidade Socios" },
  { name: "convencao_coletiva", label: "Convencao Coletiva" },
  { name: "rat_percentual", label: "RAT (%)" },
  { name: "fgts_digital", label: "FGTS Digital" },
  { name: "envia_ponto", label: "Envia Ponto" },
  { name: "tipo_ponto", label: "Tipo de Ponto" },
  { name: "beneficios", label: "Beneficios" },
  { name: "sistema_folha", label: "Sistema de Folha" },
  { name: "responsavel_envio_documentos", label: "Responsavel Envio Documentos" },
  { name: "data_envio_folha", label: "Data Envio Folha" },
  { name: "observacoes_dp", label: "Observacoes DP" },
];

const obrigacoesFields = [
  { name: "pgdas", label: "PGDAS" },
  { name: "gia", label: "GIA" },
  { name: "sped_fiscal", label: "SPED Fiscal" },
  { name: "efd_contribuicoes", label: "EFD Contribuicoes" },
  { name: "dctf", label: "DCTF" },
  { name: "defis", label: "DEFIS" },
  { name: "ecd", label: "ECD" },
  { name: "ecf", label: "ECF" },
];

const honorariosFields = [
  { name: "plano", label: "Plano" },
  { name: "valor_mensal", label: "Valor Mensal (R$)" },
  { name: "forma_pagamento", label: "Forma de Pagamento" },
  { name: "vencimento", label: "Vencimento" },
  { name: "situacao", label: "Situacao" },
];

const documentosFields = [
  { name: "contrato", label: "Contrato" },
  { name: "procuracao", label: "Procuracao" },
  { name: "certificado_digital", label: "Certificado Digital" },
  { name: "contrato_social", label: "Contrato Social" },
  { name: "alteracoes_contratuais", label: "Alteracoes Contratuais" },
  { name: "outros_documentos", label: "Outros Documentos" },
];

const categoryConfig = {
  contabilidade: { fields: contabilidadeFields, icon: Calculator, label: "Contabil", color: "text-primary" },
  fiscal: { fields: fiscalFields, icon: Receipt, label: "Fiscal", color: "text-amber-600" },
  dp: { fields: dpFields, icon: Users, label: "Dept. Pessoal", color: "text-emerald-600" },
  obrigacoes: { fields: obrigacoesFields, icon: ClipboardList, label: "Obrigacoes", color: "text-violet-600" },
  honorarios: { fields: honorariosFields, icon: Wallet, label: "Honorarios", color: "text-sky-600" },
  documentos: { fields: documentosFields, icon: FolderOpen, label: "Documentos", color: "text-rose-600" },
};

type ClientDataCategory = keyof typeof categoryConfig;

const categoryOrder: ClientDataCategory[] = [
  "contabilidade",
  "fiscal",
  "dp",
  "obrigacoes",
  "honorarios",
  "documentos",
];

const portalTaskStatusOptions: PortalTaskStatus[] = [
  "pending_client",
  "in_analysis",
  "completed",
  "cancelled",
];

const portalTaskStatusLabel: Record<PortalTaskStatus, string> = {
  pending_client: "Aguardando cliente",
  in_analysis: "Em analise",
  completed: "Concluida",
  cancelled: "Cancelada",
};

const portalTaskStatusClass: Record<PortalTaskStatus, string> = {
  pending_client: "bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300",
  in_analysis: "bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300",
  completed: "bg-primary/10 text-primary",
  cancelled: "bg-muted text-muted-foreground",
};

const portalTaskTypeOptions: PortalTaskType[] = [
  "document",
  "request_return",
  "analysis",
  "deliverable",
  "general",
];

const portalTaskTypeLabel: Record<PortalTaskType, string> = {
  document: "Documento",
  request_return: "Informacao",
  analysis: "Analise",
  deliverable: "Entrega",
  general: "Geral",
};

const normalizeEmail = (value: string | null | undefined) => (value || "").trim().toLowerCase();

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [client, setClient] = useState<ClientRecord | null>(null);
  const [clientForm, setClientForm] = useState<Partial<ClientRecord>>({});
  const [dataEntries, setDataEntries] = useState<Record<string, string>>({});
  const [files, setFiles] = useState<ClientFile[]>([]);
  const [portalTasks, setPortalTasks] = useState<ClientPortalTaskRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingData, setSavingData] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadCategory, setUploadCategory] = useState<ClientDataCategory>("contabilidade");
  const [portalAccessEnabled, setPortalAccessEnabled] = useState(false);
  const [checkingPortalAccess, setCheckingPortalAccess] = useState(false);
  const [savingPortalAccess, setSavingPortalAccess] = useState(false);
  const [period, setPeriod] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [portalTaskDraft, setPortalTaskDraft] = useState({
    title: "",
    description: "",
    type: "document" as PortalTaskType,
    sector: "Geral",
    dueDate: "",
  });
  const [creatingPortalTask, setCreatingPortalTask] = useState(false);
  const [updatingPortalTaskId, setUpdatingPortalTaskId] = useState<string | null>(null);
  const [deletingPortalTaskId, setDeletingPortalTaskId] = useState<string | null>(null);
  const canManageCashflowAccess = role === "admin";

  const loadClient = useCallback(async () => {
    if (!id) return;
    setLoading(true);

    const [clientRes, dataRes, filesRes, tasksRes] = await Promise.all([
      supabase.from("clients").select("*").eq("id", id).single(),
      supabase.from("client_data").select("*").eq("client_id", id),
      supabase.from("client_files").select("*").eq("client_id", id).order("created_at", { ascending: false }),
      supabase.from("client_portal_tasks").select("*").eq("client_id", id).order("created_at", { ascending: false }),
    ]);

    if (clientRes.error || !clientRes.data) {
      toast.error("Cliente nao encontrado");
      navigate("/app/clientes");
      return;
    }

    const c = clientRes.data;
    const normalizedClient: ClientRecord = {
      ...(c as ClientRecord),
      email: c.email ? normalizeEmail(c.email) : c.email,
    };
    setClient(normalizedClient);
    setClientForm(normalizedClient);

    // Build data map: category__field_name -> value
    const map: Record<string, string> = {};
    (dataRes.data || []).forEach((d: ClientDataRow) => {
      map[`${d.category}__${d.field_name}`] = d.field_value || "";
    });
    setDataEntries(map);

    setFiles((filesRes.data || []) as ClientFile[]);
    setPortalTasks((tasksRes.data || []) as ClientPortalTaskRow[]);

    if (tasksRes.error) {
      toast.error("Nao foi possivel carregar as pendencias do cliente.");
    }

    if (normalizedClient.portal_user_id) {
      const { data: roleData, error: roleError } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("user_id", normalizedClient.portal_user_id)
        .eq("role", "client")
        .maybeSingle();

      if (roleError) {
        toast.error("Nao foi possivel validar a permissao atual do portal.");
        setPortalAccessEnabled(false);
      } else {
        setPortalAccessEnabled(Boolean(roleData));
      }
    } else {
      setPortalAccessEnabled(false);
    }

    setLoading(false);
  }, [id, navigate]);

  useEffect(() => {
    if (id) {
      void loadClient();
    }
  }, [id, loadClient]);

  const saveClientInfo = async () => {
    if (!id) return;
    const normalizedEmail = normalizeEmail(clientForm.email);
    setSaving(true);
    const { error } = await supabase.from("clients").update({
      code: clientForm.code,
      name: clientForm.name,
      trade_name: clientForm.trade_name,
      cnpj: clientForm.cnpj,
      state_registration: clientForm.state_registration,
      municipal_registration: clientForm.municipal_registration,
      cnae_main: clientForm.cnae_main,
      regime: clientForm.regime,
      simples_annex: clientForm.simples_annex,
      opened_at: clientForm.opened_at,
      cnpj_status: clientForm.cnpj_status,
      city: clientForm.city,
      state: clientForm.state,
      ddd: clientForm.ddd,
      sector: clientForm.sector,
      status: clientForm.status,
      contact: clientForm.contact,
      email: normalizedEmail || null,
      phone: clientForm.phone,
      whatsapp: clientForm.whatsapp,
      address: clientForm.address,
      has_digital_certificate: clientForm.has_digital_certificate,
      certificate_type: clientForm.certificate_type,
      certificate_expires_on: clientForm.certificate_expires_on,
      notes: clientForm.notes,
      gov_password: clientForm.gov_password,
      portal_cashflow_enabled: Boolean(clientForm.portal_cashflow_enabled),
    }).eq("id", id);
    setSaving(false);
    if (error) return toast.error("Erro ao salvar dados do cliente");
    toast.success("Dados do cliente salvos");
    setClient({ ...client!, ...clientForm, email: normalizedEmail || null } as ClientRecord);
    setClientForm((prev) => ({ ...prev, email: normalizedEmail || null }));
  };

  const handleValidateAndAllowPortalAccess = async () => {
    if (!canManageCashflowAccess) {
      toast.error("Apenas usuario admin pode validar este acesso.");
      return;
    }

    if (!client?.portal_user_id) {
      toast.error("Cliente sem usuario do portal vinculado. Cadastre pelo fluxo de cliente com acesso ao portal.");
      return;
    }

    setCheckingPortalAccess(true);
    const { data: existingRole, error: existingRoleError } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("user_id", client.portal_user_id)
      .eq("role", "client")
      .maybeSingle();

    if (existingRoleError) {
      setCheckingPortalAccess(false);
      toast.error("Nao foi possivel validar a permissao atual do portal.");
      return;
    }

    if (existingRole) {
      setPortalAccessEnabled(true);
      setCheckingPortalAccess(false);
      toast.success("Acesso ao portal ja estava liberado.");
      return;
    }

    const { error: upsertError } = await supabase.from("user_roles").upsert(
      {
        user_id: client.portal_user_id,
        role: "client" as Database["public"]["Enums"]["app_role"],
      },
      { onConflict: "user_id,role" },
    );

    setCheckingPortalAccess(false);

    if (upsertError) {
      toast.error("Nao foi possivel liberar o acesso ao portal.");
      return;
    }

    setPortalAccessEnabled(true);
    toast.success("Acesso ao portal validado e liberado.");
  };

  const handlePortalAccessChange = async (checked: boolean) => {
    if (!canManageCashflowAccess) {
      toast.error("Apenas usuario admin pode alterar este acesso.");
      return;
    }

    if (!client?.portal_user_id) {
      toast.error("Cliente sem usuario do portal vinculado. Cadastre pelo fluxo de cliente com acesso ao portal.");
      return;
    }

    setSavingPortalAccess(true);

    if (checked) {
      const { error: upsertError } = await supabase.from("user_roles").upsert(
        {
          user_id: client.portal_user_id,
          role: "client" as Database["public"]["Enums"]["app_role"],
        },
        { onConflict: "user_id,role" },
      );

      setSavingPortalAccess(false);

      if (upsertError) {
        toast.error("Nao foi possivel liberar acesso ao portal.");
        return;
      }

      setPortalAccessEnabled(true);
      toast.success("Acesso ao portal liberado para o cliente.");
      return;
    }

    const { error: deleteError } = await supabase
      .from("user_roles")
      .delete()
      .eq("user_id", client.portal_user_id)
      .eq("role", "client");

    setSavingPortalAccess(false);

    if (deleteError) {
      toast.error("Nao foi possivel bloquear acesso ao portal.");
      return;
    }

    setPortalAccessEnabled(false);
    toast.success("Acesso ao portal bloqueado para o cliente.");
  };

  const resetPortalTaskDraft = () => {
    setPortalTaskDraft({
      title: "",
      description: "",
      type: "document",
      sector: "Geral",
      dueDate: "",
    });
  };

  const handleCreatePortalTask = async () => {
    if (!id || !user?.id) return;

    if (!client?.portal_user_id || !portalAccessEnabled) {
      toast.error("Libere o acesso ao portal deste cliente antes de criar pendencias.");
      return;
    }

    if (!portalTaskDraft.title.trim()) {
      toast.error("Informe o titulo da pendencia.");
      return;
    }

    setCreatingPortalTask(true);
    const { data, error } = await supabase
      .from("client_portal_tasks")
      .insert({
        client_id: id,
        title: portalTaskDraft.title.trim(),
        description: portalTaskDraft.description.trim() || null,
        type: portalTaskDraft.type,
        status: "pending_client",
        due_date: portalTaskDraft.dueDate || null,
        sector: portalTaskDraft.sector || "Geral",
        created_by: user.id,
      })
      .select("*")
      .single();
    setCreatingPortalTask(false);

    if (error) {
      toast.error("Nao foi possivel criar a pendencia.");
      return;
    }

    setPortalTasks((prev) => [data as ClientPortalTaskRow, ...prev]);
    resetPortalTaskDraft();
    toast.success("Pendencia criada e publicada para o cliente.");
  };

  const handlePortalTaskStatusChange = async (taskId: string, status: PortalTaskStatus) => {
    setUpdatingPortalTaskId(taskId);
    const { error } = await supabase.from("client_portal_tasks").update({ status }).eq("id", taskId);
    setUpdatingPortalTaskId(null);

    if (error) {
      toast.error("Nao foi possivel atualizar o status da pendencia.");
      return;
    }

    setPortalTasks((prev) => prev.map((task) => (task.id === taskId ? { ...task, status } : task)));
    toast.success("Status da pendencia atualizado.");
  };

  const handleDeletePortalTask = async (taskId: string) => {
    const confirmed = window.confirm("Deseja excluir esta pendencia?");
    if (!confirmed) return;

    setDeletingPortalTaskId(taskId);
    const { error } = await supabase.from("client_portal_tasks").delete().eq("id", taskId);
    setDeletingPortalTaskId(null);

    if (error) {
      toast.error("Nao foi possivel excluir a pendencia.");
      return;
    }

    setPortalTasks((prev) => prev.filter((task) => task.id !== taskId));
    toast.success("Pendencia removida.");
  };

  const saveCategoryData = async (category: ClientDataCategory) => {
    if (!id || !user) return;
    setSavingData(category);

    const config = categoryConfig[category];
    const entries = config.fields.map((f) => ({
      client_id: id,
      category,
      field_name: f.name,
      field_value: dataEntries[`${category}__${f.name}`] || null,
      period,
      created_by: user.id,
    }));

    const fieldNames = config.fields.map((field) => field.name);
    await supabase.from("client_data")
      .delete()
      .eq("client_id", id)
      .eq("category", category)
      .eq("period", period)
      .in("field_name", fieldNames);

    const { error } = await supabase.from("client_data").insert(entries);
    setSavingData(null);
    if (error) return toast.error("Erro ao salvar dados");
    toast.success(`Dados de ${config.label} salvos`);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !id || !user) return;

    setUploading(true);
    const filePath = `${id}/${uploadCategory}/${Date.now()}_${file.name}`;

    const { error: uploadError } = await supabase.storage
      .from("client-files")
      .upload(filePath, file);

    if (uploadError) {
      setUploading(false);
      return toast.error("Erro ao enviar arquivo");
    }

    const { error: dbError } = await supabase.from("client_files").insert([{
      client_id: id,
      category: uploadCategory,
      file_name: file.name,
      file_path: filePath,
      file_size: file.size,
      uploaded_by: user.id,
    }]);

    setUploading(false);
    if (dbError) return toast.error("Erro ao registrar arquivo");
    toast.success("Arquivo enviado");
    void loadClient();
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const deleteFile = async (fileId: string, filePath: string) => {
    if (!confirm("Excluir este arquivo?")) return;
    await supabase.storage.from("client-files").remove([filePath]);
    await supabase.from("client_files").delete().eq("id", fileId);
    toast.success("Arquivo excluido");
    setFiles((prev) => prev.filter((f) => f.id !== fileId));
  };

  const downloadFile = async (filePath: string, fileName: string) => {
    const { data } = await supabase.storage.from("client-files").download(filePath);
    if (!data) return toast.error("Erro ao baixar arquivo");
    const url = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatBytes = (bytes: number | null) => {
    if (!bytes) return "-";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (!client) return null;

  const renderDataFields = (category: ClientDataCategory) => {
    const config = categoryConfig[category];
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <config.icon className={`h-5 w-5 ${config.color}`} />
            <h3 className="font-semibold">{config.label}</h3>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-border/70 bg-muted/35 px-2 py-1.5 shadow-sm">
            <div className="inline-flex items-center gap-1.5 rounded-md bg-background px-2 py-1 text-[11px] font-medium text-muted-foreground">
              <CalendarDays className="h-3.5 w-3.5 text-primary" />
              <Label className="cursor-default text-[11px] font-medium leading-none text-muted-foreground">Periodo</Label>
            </div>
            <Input
              type="month"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="h-9 w-44 border-primary/20 bg-background/80 text-sm font-medium shadow-sm transition-all focus-visible:ring-2 focus-visible:ring-primary/35"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {config.fields.map((field) => {
            const key = `${category}__${field.name}`;
            return (
              <div key={key} className="space-y-1.5">
                <Label className="text-xs">{field.label}</Label>
                <Input
                  value={dataEntries[key] || ""}
                  onChange={(e) => setDataEntries((prev) => ({ ...prev, [key]: e.target.value }))}
                  placeholder="-"
                  className="h-9"
                />
              </div>
            );
          })}
        </div>

        <div className="flex justify-end">
          <Button onClick={() => saveCategoryData(category)} disabled={savingData === category} size="sm">
            {savingData === category ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
            Salvar {config.label}
          </Button>
        </div>

        <Separator />

        {/* Files section for this category */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <FolderOpen className="h-4 w-4" /> Documentos - {config.label}
            </h4>
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setUploadCategory(category); fileInputRef.current?.click(); }}
              disabled={uploading}
            >
              {uploading && uploadCategory === category ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Upload className="h-3.5 w-3.5 mr-1" />}
              Enviar Arquivo
            </Button>
          </div>

          {files.filter((f) => f.category === category).length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Nenhum documento nesta categoria</p>
          ) : (
            <div className="space-y-2">
              {files.filter((f) => f.category === category).map((file) => (
                <motion.div
                  key={file.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card"
                >
                  <div className="flex items-center gap-3">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{file.file_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatBytes(file.file_size)} - {new Date(file.created_at).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => downloadFile(file.file_path, file.file_name)}>
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteFile(file.id, file.file_path)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  const statusColors: Record<string, string> = {
    Ativo: "bg-primary/10 text-primary",
    Onboarding: "bg-amber-100 text-amber-700 dark:bg-amber-900/20",
    Inativo: "bg-muted text-muted-foreground",
  };

  return (
    <AppLayout>
      <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileUpload} />

      <div className="space-y-6 max-w-5xl">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/app/clientes")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <Building2 className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1">
            <h1 className="font-heading text-xl font-bold">{client.name}</h1>
            <div className="flex items-center gap-2 mt-0.5">
              {client.cnpj && <span className="text-sm text-muted-foreground">{client.cnpj}</span>}
              <Badge variant="outline" className={`text-xs border-0 ${statusColors[client.status || ""] || "bg-muted"}`}>
                {client.status}
              </Badge>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="info" className="space-y-4">
          <div className="overflow-x-auto pb-1">
            <TabsList className="inline-flex w-max min-w-full justify-start">
              <TabsTrigger value="info">Dados Gerais</TabsTrigger>
              <TabsTrigger value="contabilidade">Contabil</TabsTrigger>
              <TabsTrigger value="fiscal">Fiscal</TabsTrigger>
              <TabsTrigger value="dp">Dept. Pessoal</TabsTrigger>
              <TabsTrigger value="obrigacoes">Obrigacoes</TabsTrigger>
              <TabsTrigger value="honorarios">Honorarios</TabsTrigger>
              <TabsTrigger value="documentos">Documentos</TabsTrigger>
              <TabsTrigger value="pendencias">Pendencias</TabsTrigger>
            </TabsList>
          </div>

          {/* General Info */}
          <TabsContent value="info" className="space-y-4">
            <div className="rounded-xl border bg-card p-6 space-y-4">
              <h3 className="font-semibold flex items-center gap-2">
                <Building2 className="h-4 w-4" /> Informacoes do Cliente
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Codigo</Label>
                  <Input value={clientForm.code || ""} onChange={(e) => setClientForm((p) => ({ ...p, code: e.target.value }))} />
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <Label className="text-xs">Razao Social</Label>
                  <Input value={clientForm.name || ""} onChange={(e) => setClientForm((p) => ({ ...p, name: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Nome Fantasia</Label>
                  <Input value={clientForm.trade_name || ""} onChange={(e) => setClientForm((p) => ({ ...p, trade_name: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">CNPJ</Label>
                  <Input value={clientForm.cnpj || ""} onChange={(e) => setClientForm((p) => ({ ...p, cnpj: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Situacao CNPJ</Label>
                  <Input value={clientForm.cnpj_status || ""} onChange={(e) => setClientForm((p) => ({ ...p, cnpj_status: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Inscricao Estadual</Label>
                  <Input value={clientForm.state_registration || ""} onChange={(e) => setClientForm((p) => ({ ...p, state_registration: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Inscricao Municipal</Label>
                  <Input value={clientForm.municipal_registration || ""} onChange={(e) => setClientForm((p) => ({ ...p, municipal_registration: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">CNAE Principal</Label>
                  <Input value={clientForm.cnae_main || ""} onChange={(e) => setClientForm((p) => ({ ...p, cnae_main: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Regime Tributario</Label>
                  <select className="w-full text-sm bg-background border rounded-lg px-3 py-2" value={clientForm.regime || ""} onChange={(e) => setClientForm((p) => ({ ...p, regime: e.target.value }))}>
                    {["Simples Nacional", "Lucro Presumido", "Lucro Real", "MEI"].map((r) => <option key={r}>{r}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Anexo Simples</Label>
                  <Input value={clientForm.simples_annex || ""} onChange={(e) => setClientForm((p) => ({ ...p, simples_annex: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Data de Abertura</Label>
                  <Input type="date" value={clientForm.opened_at || ""} onChange={(e) => setClientForm((p) => ({ ...p, opened_at: e.target.value || null }))} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Status</Label>
                  <select className="w-full text-sm bg-background border rounded-lg px-3 py-2" value={clientForm.status || ""} onChange={(e) => setClientForm((p) => ({ ...p, status: e.target.value }))}>
                    {["Ativo", "Onboarding", "Inativo"].map((s) => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Segmento do Cliente</Label>
                  <select className="w-full text-sm bg-background border rounded-lg px-3 py-2" value={clientForm.sector || ""} onChange={(e) => setClientForm((p) => ({ ...p, sector: e.target.value }))}>
                    {getClientSegmentOptions(clientForm.sector).map((segment) => <option key={segment}>{segment}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Contato Principal</Label>
                  <Input value={clientForm.contact || ""} onChange={(e) => setClientForm((p) => ({ ...p, contact: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Cidade</Label>
                  <Input value={clientForm.city || ""} onChange={(e) => setClientForm((p) => ({ ...p, city: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Estado</Label>
                  <Input value={clientForm.state || ""} onChange={(e) => setClientForm((p) => ({ ...p, state: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">DDD</Label>
                  <Input value={clientForm.ddd || ""} onChange={(e) => setClientForm((p) => ({ ...p, ddd: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Telefone</Label>
                  <Input value={clientForm.phone || ""} onChange={(e) => setClientForm((p) => ({ ...p, phone: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">WhatsApp</Label>
                  <Input value={clientForm.whatsapp || ""} onChange={(e) => setClientForm((p) => ({ ...p, whatsapp: e.target.value }))} />
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <Label className="text-xs">E-mail</Label>
                  <Input type="email" value={clientForm.email || ""} onChange={(e) => setClientForm((p) => ({ ...p, email: e.target.value.toLowerCase() }))} />
                </div>
                <div className="space-y-1.5 md:col-span-3">
                  <Label className="text-xs">Endereco</Label>
                  <Input value={clientForm.address || ""} onChange={(e) => setClientForm((p) => ({ ...p, address: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Certificado Digital</Label>
                  <select
                    className="w-full text-sm bg-background border rounded-lg px-3 py-2"
                    value={
                      clientForm.has_digital_certificate === null || clientForm.has_digital_certificate === undefined
                        ? ""
                        : clientForm.has_digital_certificate
                          ? "sim"
                          : "nao"
                    }
                    onChange={(e) => {
                      const nextValue = e.target.value;
                      setClientForm((prev) => ({
                        ...prev,
                        has_digital_certificate: nextValue === "" ? null : nextValue === "sim",
                      }));
                    }}
                  >
                    <option value="">Nao informado</option>
                    <option value="sim">Sim</option>
                    <option value="nao">Nao</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Tipo Certificado</Label>
                  <Input value={clientForm.certificate_type || ""} onChange={(e) => setClientForm((p) => ({ ...p, certificate_type: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Vencimento Certificado</Label>
                  <Input type="date" value={clientForm.certificate_expires_on || ""} onChange={(e) => setClientForm((p) => ({ ...p, certificate_expires_on: e.target.value || null }))} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Senha do gov</Label>
                  <Input value={clientForm.gov_password || ""} onChange={(e) => setClientForm((p) => ({ ...p, gov_password: e.target.value }))} />
                </div>
                <div className="space-y-1.5 md:col-span-2 lg:col-span-3">
                  <Label className="text-xs">Observacoes</Label>
                  <Textarea value={clientForm.notes || ""} onChange={(e) => setClientForm((p) => ({ ...p, notes: e.target.value }))} rows={3} />
                </div>
                <div className="md:col-span-2 lg:col-span-3 rounded-lg border bg-muted/20 px-4 py-3 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">Acesso ao portal do cliente</p>
                      <p className="text-xs text-muted-foreground">
                        Valide o vinculo e libere o login do cliente no portal.
                      </p>
                      <p className="text-xs mt-1">
                        Status atual:{" "}
                        <span className={portalAccessEnabled ? "text-primary font-medium" : "text-muted-foreground"}>
                          {portalAccessEnabled ? "liberado" : "bloqueado"}
                        </span>
                      </p>
                    </div>
                    <Switch
                      checked={portalAccessEnabled}
                      disabled={!canManageCashflowAccess || savingPortalAccess}
                      onCheckedChange={(checked) => void handlePortalAccessChange(checked)}
                      aria-label="Liberar acesso ao portal do cliente"
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void handleValidateAndAllowPortalAccess()}
                      disabled={!canManageCashflowAccess || checkingPortalAccess || savingPortalAccess}
                    >
                      {checkingPortalAccess ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Plus className="h-3.5 w-3.5 mr-1" />}
                      Validar e permitir acesso
                    </Button>
                    {client?.portal_user_id ? (
                      <p className="text-xs text-muted-foreground">
                        Usuario do portal vinculado: {client.portal_user_id.slice(0, 8)}...
                      </p>
                    ) : (
                      <p className="text-xs text-amber-700 dark:text-amber-300">
                        Cliente sem usuario de portal vinculado.
                      </p>
                    )}
                  </div>
                </div>
                <div className="md:col-span-2 lg:col-span-3 rounded-lg border bg-muted/20 px-4 py-3 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">Liberar controle de caixa no portal</p>
                      <p className="text-xs text-muted-foreground">
                        Define se este cliente pode acessar a nova aba de controle de caixa no portal.
                      </p>
                    </div>
                    <Switch
                      checked={Boolean(clientForm.portal_cashflow_enabled)}
                      disabled={!canManageCashflowAccess}
                      onCheckedChange={(checked) => setClientForm((prev) => ({ ...prev, portal_cashflow_enabled: checked }))}
                      aria-label="Liberar controle de caixa no portal"
                    />
                  </div>
                  {!canManageCashflowAccess && (
                    <p className="text-xs text-amber-700 dark:text-amber-300">
                      Apenas usuario admin pode alterar esta liberacao.
                    </p>
                  )}
                </div>
              </div>
              <div className="flex justify-end">
                <Button onClick={saveClientInfo} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
                  Salvar Informacoes
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="pendencias" className="space-y-4">
            <div className="rounded-xl border bg-card p-6 space-y-5">
              <h3 className="font-semibold flex items-center gap-2">
                <ClipboardList className="h-4 w-4" /> Pendencias do cliente
              </h3>

              {(!client?.portal_user_id || !portalAccessEnabled) && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-300">
                  Este cliente ainda nao tem acesso ativo ao portal. Libere o acesso para que as pendencias sejam exibidas para ele.
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5 md:col-span-2">
                  <Label className="text-xs">Titulo da pendencia</Label>
                  <Input
                    value={portalTaskDraft.title}
                    onChange={(event) => setPortalTaskDraft((prev) => ({ ...prev, title: event.target.value }))}
                    placeholder="Ex.: Enviar extrato bancario do mes"
                  />
                </div>

                <div className="space-y-1.5 md:col-span-2">
                  <Label className="text-xs">Descricao</Label>
                  <Textarea
                    rows={3}
                    value={portalTaskDraft.description}
                    onChange={(event) => setPortalTaskDraft((prev) => ({ ...prev, description: event.target.value }))}
                    placeholder="Descreva as informacoes ou documentos que o cliente precisa enviar."
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Tipo</Label>
                  <Select
                    value={portalTaskDraft.type}
                    onValueChange={(value) => setPortalTaskDraft((prev) => ({ ...prev, type: value as PortalTaskType }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {portalTaskTypeOptions.map((type) => (
                        <SelectItem key={type} value={type}>
                          {portalTaskTypeLabel[type]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Setor</Label>
                  <Select
                    value={portalTaskDraft.sector}
                    onValueChange={(value) => setPortalTaskDraft((prev) => ({ ...prev, sector: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {sectorOptions.map((sector) => (
                        <SelectItem key={sector} value={sector}>
                          {sector}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Prazo (opcional)</Label>
                  <Input
                    type="date"
                    value={portalTaskDraft.dueDate}
                    onChange={(event) => setPortalTaskDraft((prev) => ({ ...prev, dueDate: event.target.value }))}
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button onClick={() => void handleCreatePortalTask()} disabled={creatingPortalTask}>
                  {creatingPortalTask ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
                  Criar pendencia
                </Button>
                <Button type="button" variant="outline" onClick={resetPortalTaskDraft} disabled={creatingPortalTask}>
                  Limpar campos
                </Button>
                <p className="text-xs text-muted-foreground">
                  A pendencia aparece no portal do cliente em "Pendencias" e na visao geral.
                </p>
              </div>
            </div>

            <div className="rounded-xl border bg-card p-6 space-y-4">
              <h3 className="font-semibold">Pendencias cadastradas</h3>

              {portalTasks.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma pendencia cadastrada para este cliente.</p>
              ) : (
                <div className="space-y-3">
                  {portalTasks.map((task) => {
                    const status = (portalTaskStatusOptions.includes(task.status as PortalTaskStatus)
                      ? (task.status as PortalTaskStatus)
                      : "pending_client");
                    const type = (portalTaskTypeOptions.includes(task.type as PortalTaskType)
                      ? (task.type as PortalTaskType)
                      : "general");

                    return (
                      <div key={task.id} className="rounded-lg border p-3 space-y-2">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="space-y-1">
                            <p className="text-sm font-medium">{task.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {task.description || "Sem descricao"} {task.due_date ? `- prazo: ${new Date(task.due_date).toLocaleDateString("pt-BR")}` : ""}
                            </p>
                          </div>
                          <Badge variant="outline" className={`border-0 ${portalTaskStatusClass[status]}`}>
                            {portalTaskStatusLabel[status]}
                          </Badge>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="secondary" className="text-[11px]">
                            Tipo: {portalTaskTypeLabel[type]}
                          </Badge>
                          <Badge variant="outline" className="text-[11px]">
                            Setor: {task.sector}
                          </Badge>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <Select
                            value={status}
                            onValueChange={(value) => void handlePortalTaskStatusChange(task.id, value as PortalTaskStatus)}
                          >
                            <SelectTrigger className="h-8 w-[220px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {portalTaskStatusOptions.map((statusOption) => (
                                <SelectItem key={statusOption} value={statusOption}>
                                  {portalTaskStatusLabel[statusOption]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>

                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={updatingPortalTaskId === task.id}
                            onClick={() => void handlePortalTaskStatusChange(task.id, "completed")}
                          >
                            {updatingPortalTaskId === task.id ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
                            Marcar concluida
                          </Button>

                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-destructive"
                            disabled={deletingPortalTaskId === task.id}
                            onClick={() => void handleDeletePortalTask(task.id)}
                          >
                            {deletingPortalTaskId === task.id ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
                            Excluir
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </TabsContent>

          {/* Category tabs */}
          {categoryOrder.map((cat) => (
            <TabsContent key={cat} value={cat}>
              <div className="rounded-xl border bg-card p-6">
                {renderDataFields(cat)}
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </AppLayout>
  );
}


