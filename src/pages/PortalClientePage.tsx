import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Download,
  Filter,
  Loader2,
  MessageSquare,
  Paperclip,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import { RequestChat } from "@/components/app/RequestChat";
import { ClientPortalCashflow } from "@/components/portal/ClientPortalCashflow";
import { ClientPortalOverview } from "@/components/portal/ClientPortalOverview";
import { GrowAssistantWidget } from "@/components/portal/GrowAssistantWidget";
import { PortalClienteSidebar, type PortalTab } from "@/components/portal/PortalClienteSidebar";
import {
  documentCategories,
  sectorOptions,
  type NewPortalCashflowEntryPayload,
  type PortalActionItem,
  type PortalCashflowEntry,
  type PortalClientDocument,
  type PortalClientProfile,
  type PortalClientRequest,
  type PortalClientTask,
  type PortalRequestMessage,
  type RequestStatus,
  type RequestStatusMeta,
} from "@/components/portal/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  buildSecureStoragePath,
  filterSecureDocuments,
  SECURE_DOCUMENT_ACCEPT,
} from "@/lib/fileUploadSecurity";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { toast } from "sonner";

const DEFAULT_PORTAL_ACCESS_MESSAGE =
  "Este usuário ainda não possui permissão de cliente para acessar o portal.";

const parseFunctionError = async (error: unknown): Promise<{ message: string; status: number | null }> => {
  const fallbackMessage = error instanceof Error ? error.message : "Erro desconhecido ao sincronizar acesso";
  if (!(error instanceof FunctionsHttpError)) {
    return { message: fallbackMessage, status: null };
  }

  try {
    const payload = await error.context.json();
    const payloadMessage =
      payload && typeof payload === "object" && "error" in payload
        ? String((payload as { error: unknown }).error || fallbackMessage)
        : fallbackMessage;
    return { message: payloadMessage, status: error.context.status };
  } catch {
    return { message: fallbackMessage, status: error.context.status };
  }
};

const statusConfig: Record<RequestStatus, RequestStatusMeta> = {
  pending: {
    label: "Pendente",
    icon: Clock,
    className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  },
  in_progress: {
    label: "Em andamento",
    icon: AlertCircle,
    className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  },
  completed: {
    label: "Concluída",
    icon: CheckCircle2,
    className: "bg-primary/10 text-primary",
  },
  cancelled: {
    label: "Cancelada",
    icon: X,
    className: "bg-destructive/10 text-destructive",
  },
};

const getMonthKey = (dateString: string) => {
  const date = new Date(dateString);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
};

const normalizeLooseToken = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

interface PortalGuidedField {
  name: string;
  label: string;
  type: "text" | "email" | "date" | "select" | "textarea";
  required?: boolean;
  options?: string[];
  placeholder?: string;
}

interface PortalGuidedReason {
  key: string;
  label: string;
  sector: string;
  description: string;
  defaultTitle: string;
  fields: PortalGuidedField[];
}

const DEFAULT_REQUEST_SECTOR = sectorOptions.includes("Geral") ? "Geral" : sectorOptions[0];

const guidedReasonsBySector: Record<string, PortalGuidedReason[]> = {
  departamento_pessoal: [
    {
      key: "folha_pagamento",
      label: "Folha de pagamento",
      sector: "Departamento Pessoal",
      description: "Use quando precisar tratar fechamento, conferencia ou ajustes da folha.",
      defaultTitle: "Folha de pagamento",
      fields: [
        { name: "competencia", label: "Competencia", type: "text", required: true, placeholder: "Ex.: 04/2026" },
        {
          name: "solicitacao_folha",
          label: "O que precisa nesta folha",
          type: "select",
          required: true,
          options: ["Conferencia", "Inclusao de variaveis", "Ajuste", "Envio de informacoes"],
        },
        {
          name: "observacao_folha",
          label: "Ponto principal",
          type: "textarea",
          placeholder: "Informe os eventos, colaboradores ou pontos que precisam de atencao.",
        },
      ],
    },
    {
      key: "admissao",
      label: "Admissao",
      sector: "Departamento Pessoal",
      description: "Fluxo para admissao de colaborador com dados iniciais e documentacao.",
      defaultTitle: "Admissao de colaborador",
      fields: [
        { name: "nome_colaborador", label: "Nome do colaborador", type: "text", required: true },
        { name: "data_inicio", label: "Data de inicio", type: "date", required: true },
        { name: "cargo", label: "Cargo", type: "text", required: true },
        { name: "salario", label: "Salario", type: "text", placeholder: "Ex.: R$ 2.500,00" },
      ],
    },
    {
      key: "demissao",
      label: "Demissao",
      sector: "Departamento Pessoal",
      description: "Fluxo para desligamento com dados base para calculo rescisorio.",
      defaultTitle: "Demissao de colaborador",
      fields: [
        { name: "nome_desligamento", label: "Nome do colaborador", type: "text", required: true },
        { name: "data_desligamento", label: "Data do desligamento", type: "date", required: true },
        {
          name: "tipo_aviso",
          label: "Tipo de aviso",
          type: "select",
          required: true,
          options: ["Trabalhado", "Indenizado", "Sem aviso"],
        },
        { name: "motivo_desligamento", label: "Motivo", type: "text", placeholder: "Ex.: Pedido do colaborador" },
      ],
    },
    {
      key: "ferias",
      label: "Ferias",
      sector: "Departamento Pessoal",
      description: "Solicite programacao, alteracao ou conferencia de ferias.",
      defaultTitle: "Solicitacao de ferias",
      fields: [
        { name: "colaborador_ferias", label: "Colaborador", type: "text", required: true },
        { name: "inicio_ferias", label: "Inicio das ferias", type: "date", required: true },
        { name: "dias_ferias", label: "Quantidade de dias", type: "text", required: true, placeholder: "Ex.: 30" },
        { name: "observacao_ferias", label: "Observacoes", type: "textarea", placeholder: "Divisao de periodos, abono, urgencia, etc." },
      ],
    },
    {
      key: "beneficios",
      label: "Beneficios e pro-labore",
      sector: "Departamento Pessoal",
      description: "Centralize ajustes relacionados a beneficios, pro-labore e rotinas recorrentes do time.",
      defaultTitle: "Ajuste de beneficios ou pro-labore",
      fields: [
        {
          name: "tipo_beneficio",
          label: "Assunto principal",
          type: "select",
          required: true,
          options: ["Beneficios", "Pro-labore", "Vale transporte", "Vale refeicao", "Outro"],
        },
        { name: "pessoas_envolvidas", label: "Colaboradores ou socios envolvidos", type: "textarea", required: true },
      ],
    },
  ],
  fiscal: [
    {
      key: "guias_impostos",
      label: "Guias e impostos",
      sector: "Fiscal",
      description: "Para duvidas, revisoes e regularizacoes ligadas a impostos e obrigacoes fiscais.",
      defaultTitle: "Guias e impostos",
      fields: [
        { name: "competencia_fiscal", label: "Competencia", type: "text", placeholder: "Ex.: 04/2026" },
        {
          name: "tipo_demanda_fiscal",
          label: "Tipo de demanda",
          type: "select",
          required: true,
          options: ["Apuracao", "Guia em atraso", "Reenvio de guia", "Regularizacao", "Duvida fiscal"],
        },
        { name: "detalhe_fiscal", label: "Detalhe da solicitacao", type: "textarea", required: true },
      ],
    },
    {
      key: "nota_fiscal",
      label: "Notas fiscais",
      sector: "Fiscal",
      description: "Use para emissao, cancelamento, correcao ou duvidas sobre notas fiscais.",
      defaultTitle: "Solicitacao sobre nota fiscal",
      fields: [
        {
          name: "tipo_nota",
          label: "Assunto da nota",
          type: "select",
          required: true,
          options: ["Emissao", "Cancelamento", "Carta de correcao", "Tributacao", "Outro"],
        },
        { name: "numero_nota", label: "Numero da nota (se houver)", type: "text" },
        { name: "detalhe_nota", label: "Contexto", type: "textarea", required: true },
      ],
    },
    {
      key: "certidao_fiscal",
      label: "Certidoes e regularidade",
      sector: "Fiscal",
      description: "Solicite certidoes, conferencias de regularidade ou apoio em pendencias fiscais.",
      defaultTitle: "Certidoes e regularidade fiscal",
      fields: [
        {
          name: "tipo_certidao",
          label: "Necessidade",
          type: "select",
          required: true,
          options: ["Emissao de certidao", "Consulta de pendencia", "Regularizacao", "Outro"],
        },
        { name: "uso_certidao", label: "Finalidade", type: "text", placeholder: "Ex.: licitacao, banco, cadastro" },
      ],
    },
  ],
  contabil: [
    {
      key: "fechamento_contabil",
      label: "Fechamento contabil",
      sector: "Contabil",
      description: "Use para fechamento mensal, ajustes contabilisticos e alinhamentos de lancamentos.",
      defaultTitle: "Fechamento contabil",
      fields: [
        { name: "competencia_contabil", label: "Competencia", type: "text", required: true },
        {
          name: "tipo_rotina_contabil",
          label: "Etapa",
          type: "select",
          required: true,
          options: ["Fechamento", "Ajuste de lancamentos", "Balancete", "DRE", "Outro"],
        },
        { name: "detalhe_contabil", label: "Detalhe", type: "textarea", required: true },
      ],
    },
    {
      key: "balancete_relatorio",
      label: "Balancete e relatorios",
      sector: "Contabil",
      description: "Solicite demonstracoes, relatorios ou leituras contabeis especificas.",
      defaultTitle: "Balancete ou relatorio contabil",
      fields: [
        {
          name: "tipo_relatorio_contabil",
          label: "Relatorio desejado",
          type: "select",
          required: true,
          options: ["Balancete", "DRE", "Razao", "Livro diario", "Outro"],
        },
        { name: "periodo_contabil", label: "Periodo", type: "text", placeholder: "Ex.: Jan a Mar/2026" },
      ],
    },
  ],
  financeiro: [
    {
      key: "controle_caixa",
      label: "Controle de caixa",
      sector: "Financeiro",
      description: "Solicite liberacao, apoio ou ajustes no modulo de caixa do portal.",
      defaultTitle: "Controle de caixa no portal",
      fields: [
        {
          name: "tipo_caixa",
          label: "O que voce precisa",
          type: "select",
          required: true,
          options: ["Liberacao do modulo", "Ajuste de configuracao", "Suporte de uso", "Conferencia de lancamentos"],
        },
        { name: "periodo_caixa", label: "Periodo ou referencia", type: "text", placeholder: "Opcional" },
      ],
    },
    {
      key: "conciliacao_financeira",
      label: "Conciliacao financeira",
      sector: "Financeiro",
      description: "Use para alinhar extratos, lancamentos e divergencias financeiras.",
      defaultTitle: "Conciliacao financeira",
      fields: [
        { name: "conta_conciliacao", label: "Conta ou banco", type: "text", required: true },
        { name: "periodo_conciliacao", label: "Periodo", type: "text", required: true },
        { name: "detalhe_conciliacao", label: "Divergencia ou necessidade", type: "textarea", required: true },
      ],
    },
  ],
  societario: [
    {
      key: "alteracao_contratual",
      label: "Alteracao contratual",
      sector: "Societario",
      description: "Fluxo para alteracoes societarias, cadastrais e de quadro societario.",
      defaultTitle: "Alteracao contratual",
      fields: [
        {
          name: "tipo_alteracao",
          label: "Tipo de alteracao",
          type: "select",
          required: true,
          options: ["Endereco", "Atividade", "Capital social", "Entrada/Saida de socio", "Outro"],
        },
        { name: "resumo_alteracao", label: "Resumo do pedido", type: "textarea", required: true },
      ],
    },
    {
      key: "certificado_licenca",
      label: "Certificado, licenca ou cadastro",
      sector: "Societario",
      description: "Use para certificados digitais, licencas e cadastros ligados a regularidade da empresa.",
      defaultTitle: "Certificado, licenca ou cadastro",
      fields: [
        {
          name: "tipo_documento_societario",
          label: "Assunto",
          type: "select",
          required: true,
          options: ["Certificado digital", "Licenca", "Inscricao", "Cadastro", "Outro"],
        },
        { name: "detalhe_societario", label: "Detalhe", type: "textarea", required: true },
      ],
    },
  ],
  comercial: [
    {
      key: "proposta_ou_plano",
      label: "Proposta, plano ou escopo",
      sector: "Comercial",
      description: "Use para falar de proposta comercial, ajuste de escopo ou revisao de plano.",
      defaultTitle: "Proposta, plano ou escopo",
      fields: [
        {
          name: "assunto_comercial",
          label: "Assunto",
          type: "select",
          required: true,
          options: ["Nova proposta", "Revisao de plano", "Aditivo de escopo", "Duvida comercial"],
        },
        { name: "detalhe_comercial", label: "Contexto", type: "textarea", required: true },
      ],
    },
  ],
  geral: [
    {
      key: "acesso_portal",
      label: "Acesso ao portal",
      sector: "Geral",
      description: "Use para suporte de acesso, permissao, senha ou navegacao no portal.",
      defaultTitle: "Suporte de acesso ao portal",
      fields: [
        {
          name: "tipo_suporte_portal",
          label: "Tipo de suporte",
          type: "select",
          required: true,
          options: ["Login", "Senha", "Permissao", "Erro na tela", "Duvida de uso"],
        },
        { name: "detalhe_portal", label: "O que aconteceu", type: "textarea", required: true },
      ],
    },
    {
      key: "atualizacao_cadastral",
      label: "Atualizacao cadastral",
      sector: "Geral",
      description: "Use para atualizar contatos, email, responsaveis e dados basicos do cadastro.",
      defaultTitle: "Atualizacao cadastral",
      fields: [
        { name: "dados_para_atualizar", label: "Quais dados precisam ser atualizados", type: "textarea", required: true },
      ],
    },
    {
      key: "outro_assunto",
      label: "Outro assunto",
      sector: "Geral",
      description: "Se o pedido nao encaixar nas categorias acima, use este caminho e detalhe o contexto.",
      defaultTitle: "Solicitacao geral",
      fields: [
        {
          name: "objetivo_solicitacao",
          label: "Objetivo principal",
          type: "textarea",
          required: true,
          placeholder: "Explique o que precisa e como a equipe pode ajudar.",
        },
      ],
    },
  ],
};

const getGuidedReasonsForSector = (sector: string) =>
  guidedReasonsBySector[normalizeLooseToken(sector)] || guidedReasonsBySector[normalizeLooseToken(DEFAULT_REQUEST_SECTOR)] || [];

const getDefaultReasonKey = (sector: string) => getGuidedReasonsForSector(sector)[0]?.key || "";

const isEcontinuoDocument = (document: PortalClientDocument) => {
  const categoryToken = normalizeLooseToken(document.category || "");
  if (categoryToken.includes("e_continuo") || categoryToken.includes("econtinuo")) return true;

  const pathToken = normalizeLooseToken(document.file_path || "");
  return pathToken.includes("envios_econtinuo") || pathToken.includes("econtinuo");
};

const toActionFromTask = (task: PortalClientTask): PortalActionItem => ({
  id: task.id,
  title: task.title,
  description: task.description || null,
  dueDate: task.due_date,
  sector: task.sector,
  requestId: task.request_id,
});

type PortalRequestEntryMode = "freeform" | "support";

const portalRequestShortcuts = [
  {
    label: "Admissao",
    hint: "Novo colaborador",
    sector: "Departamento Pessoal",
    reasonKey: "admissao",
    title: "Admissao de colaborador",
  },
  {
    label: "Demissao",
    hint: "Encerramento de vinculo",
    sector: "Departamento Pessoal",
    reasonKey: "demissao",
    title: "Demissao de colaborador",
  },
  {
    label: "Folha",
    hint: "Conferencia e ajustes",
    sector: "Departamento Pessoal",
    reasonKey: "folha_pagamento",
    title: "Folha de pagamento",
  },
  {
    label: "Acesso",
    hint: "Portal e permissao",
    sector: "Geral",
    reasonKey: "acesso_portal",
    title: "Suporte de acesso ao portal",
  },
  {
    label: "Caixa",
    hint: "Rotina financeira",
    sector: "Financeiro",
    reasonKey: "controle_caixa",
    title: "Controle de caixa no portal",
  },
] as const;

export default function PortalClientePage() {
  const { user, session, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<PortalTab>("overview");
  const [loadingData, setLoadingData] = useState(true);
  const [portalAccessDenied, setPortalAccessDenied] = useState(false);
  const [portalAccessMessage, setPortalAccessMessage] = useState(DEFAULT_PORTAL_ACCESS_MESSAGE);

  const [clientProfile, setClientProfile] = useState<PortalClientProfile | null>(null);
  const [requests, setRequests] = useState<PortalClientRequest[]>([]);
  const [documents, setDocuments] = useState<PortalClientDocument[]>([]);
  const [portalTasks, setPortalTasks] = useState<PortalClientTask[]>([]);
  const [messages, setMessages] = useState<PortalRequestMessage[]>([]);
  const [cashflowEntries, setCashflowEntries] = useState<PortalCashflowEntry[]>([]);
  const [creatingCashflowEntry, setCreatingCashflowEntry] = useState(false);

  const [requestSearch, setRequestSearch] = useState("");
  const [requestStatusFilter, setRequestStatusFilter] = useState<string>("all");
  const [requestEntryMode, setRequestEntryMode] = useState<PortalRequestEntryMode>("freeform");

  const [newRequestSector, setNewRequestSector] = useState(DEFAULT_REQUEST_SECTOR);
  const [newRequestReasonKey, setNewRequestReasonKey] = useState(getDefaultReasonKey(DEFAULT_REQUEST_SECTOR));
  const [newRequestTitle, setNewRequestTitle] = useState("");
  const [newRequestDescription, setNewRequestDescription] = useState("");
  const [newRequestFiles, setNewRequestFiles] = useState<File[]>([]);
  const [creatingRequest, setCreatingRequest] = useState(false);
  const requestFilesInputRef = useRef<HTMLInputElement>(null);
  const requestComposerRef = useRef<HTMLDivElement>(null);

  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploadCategory, setUploadCategory] = useState(documentCategories[0]);
  const [uploadRequestId, setUploadRequestId] = useState<string>("none");
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const uploadFilesInputRef = useRef<HTMLInputElement>(null);

  const [selectedRequest, setSelectedRequest] = useState<PortalClientRequest | null>(null);
  const [requestDetailOpen, setRequestDetailOpen] = useState(false);

  const [requestFieldValues, setRequestFieldValues] = useState<Record<string, string>>({});

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [changingPortalPassword, setChangingPortalPassword] = useState(false);
  const knownPortalTaskIdsRef = useRef<Set<string>>(new Set());
  const ensuredPortalProfileRef = useRef<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/app/login");
    }
  }, [authLoading, user, navigate]);

  const resetPortalCollections = useCallback(() => {
    setClientProfile(null);
    setRequests([]);
    setDocuments([]);
    setPortalTasks([]);
    setCashflowEntries([]);
    setMessages([]);
  }, []);

  const fetchPortalData = useCallback(async () => {
    if (!user) return;

    const activeSession = session ?? (await supabase.auth.getSession()).data.session;
    if (!activeSession?.access_token) {
      setLoadingData(false);
      return;
    }

    setLoadingData(true);
    setPortalAccessDenied(false);
    setPortalAccessMessage(DEFAULT_PORTAL_ACCESS_MESSAGE);

    let ensureStatus: number | null = null;
    let ensureMessage = DEFAULT_PORTAL_ACCESS_MESSAGE;

    const fetchClientRole = async () =>
      supabase
        .from("user_roles")
        .select("user_id")
        .eq("user_id", user.id)
        .eq("role", "client")
        .maybeSingle();

    const fetchLinkedClient = async () =>
      supabase
        .from("clients")
        .select("id, name, contact, email, portal_user_id, portal_cashflow_enabled")
        .eq("portal_user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

    let [{ data: roleData, error: roleError }, clientRes] = await Promise.all([
      fetchClientRole(),
      fetchLinkedClient(),
    ]);

    if (roleError) {
      toast.error("Não foi possível validar a permissão de acesso ao portal.");
      setPortalAccessMessage("Não foi possível validar a permissão de acesso ao portal.");
      resetPortalCollections();
      setLoadingData(false);
      setPortalAccessDenied(true);
      return;
    }

    if ((!roleData || !clientRes.data) && ensuredPortalProfileRef.current !== user.id) {
      ensuredPortalProfileRef.current = user.id;

      const { error: ensurePortalError } = await supabase.functions.invoke("ensure-client-portal-profile", {
        body: {},
      });

      if (ensurePortalError) {
        const parsedEnsureError = await parseFunctionError(ensurePortalError);
        ensureStatus = parsedEnsureError.status;
        ensureMessage = parsedEnsureError.message || DEFAULT_PORTAL_ACCESS_MESSAGE;

        if (ensureStatus === 401) {
          ensuredPortalProfileRef.current = null;
        } else if (ensureStatus !== 403 && ensureStatus !== 409) {
          toast.error("Não foi possível sincronizar automaticamente o acesso do portal.");
        }
      } else {
        [{ data: roleData, error: roleError }, clientRes] = await Promise.all([
          fetchClientRole(),
          fetchLinkedClient(),
        ]);
      }
    }

    if (roleError) {
      toast.error("Não foi possível validar a permissão de acesso ao portal.");
      setPortalAccessMessage("Não foi possível validar a permissão de acesso ao portal.");
      resetPortalCollections();
      setLoadingData(false);
      setPortalAccessDenied(true);
      return;
    }

    if (!roleData) {
      setPortalAccessMessage(ensureMessage);
      resetPortalCollections();
      setLoadingData(false);
      setPortalAccessDenied(true);
      return;
    }

    const [requestRes, docRes] = await Promise.all([
      supabase
        .from("client_requests")
        .select("id, user_id, title, description, category, sector, status, admin_notes, created_at, updated_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("client_documents")
        .select("id, user_id, request_id, file_name, file_path, file_size, category, created_at, processed_at, processed_by")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
    ]);

    if (clientRes.error) {
      const isMultipleClientsForPortalUser = String(clientRes.error.message || "")
        .toLowerCase()
        .includes("multiple");

      if (isMultipleClientsForPortalUser) {
        setPortalAccessMessage(
          "Encontramos mais de um cadastro de cliente para este portal. Solicite ajuste ao admin.",
        );
      } else {
        setPortalAccessMessage("Não foi possível carregar o cadastro do cliente para este portal.");
      }

      resetPortalCollections();
      setLoadingData(false);
      setPortalAccessDenied(true);
      return;
    }

    if (requestRes.error) toast.error("Erro ao carregar solicitações.");
    if (docRes.error) toast.error("Erro ao carregar documentos.");
    const client = (clientRes.data || null) as PortalClientProfile | null;
    const fetchedRequests = (requestRes.data || []) as PortalClientRequest[];
    const fetchedDocuments = (docRes.data || []) as PortalClientDocument[];

    let fetchedTasks: PortalClientTask[] = [];
    if (client?.id) {
      const { data: tasksData, error: tasksError } = await supabase
        .from("client_portal_tasks")
        .select("id, client_id, title, description, type, status, due_date, sector, request_id, created_by, created_at, updated_at")
        .eq("client_id", client.id)
        .order("created_at", { ascending: false });

      if (tasksError) {
        toast.error("Erro ao carregar pendências.");
      } else {
        fetchedTasks = (tasksData || []) as PortalClientTask[];
      }
    }

    let fetchedCashflowEntries: PortalCashflowEntry[] = [];
    if (client?.id && client.portal_cashflow_enabled) {
      const { data: cashflowData, error: cashflowError } = await supabase
        .from("client_cashflow_entries")
        .select("id, client_id, entry_date, entry_type, category, description, amount, status, created_by, created_at, updated_at")
        .eq("client_id", client.id)
        .order("entry_date", { ascending: false })
        .order("created_at", { ascending: false });

      if (cashflowError) {
        toast.error("Erro ao carregar controle de caixa.");
      } else {
        fetchedCashflowEntries = (cashflowData || []) as PortalCashflowEntry[];
      }
    }

    let fetchedMessages: PortalRequestMessage[] = [];
    if (fetchedRequests.length > 0) {
      const requestIds = fetchedRequests.map((request) => request.id);
      const { data: messageData, error: messageError } = await supabase
        .from("request_messages")
        .select("id, request_id, user_id, content, is_from_team, created_at")
        .in("request_id", requestIds)
        .order("created_at", { ascending: false });

      if (messageError) {
        toast.error("Erro ao carregar mensagens.");
      } else {
        fetchedMessages = (messageData || []) as PortalRequestMessage[];
      }
    }

    if (!client) {
      const fallbackMessage =
        ensureStatus === 403 || ensureStatus === 409
          ? ensureMessage
          : "Conta autenticada, mas sem cadastro de cliente vinculado ao portal.";
      setPortalAccessMessage(fallbackMessage);
      resetPortalCollections();
      setLoadingData(false);
      setPortalAccessDenied(true);
      return;
    }

    setClientProfile(client);
    setRequests(fetchedRequests);
    setDocuments(fetchedDocuments);
    setPortalTasks(fetchedTasks);
    setCashflowEntries(fetchedCashflowEntries);
    setMessages(fetchedMessages);
    setLoadingData(false);
  }, [resetPortalCollections, session, user]);

  useEffect(() => {
    if (user && session?.access_token) void fetchPortalData();
  }, [fetchPortalData, session?.access_token, user]);

  useEffect(() => {
    knownPortalTaskIdsRef.current = new Set(portalTasks.map((task) => task.id));
  }, [portalTasks]);

  useEffect(() => {
    if (!clientProfile?.id) return;

    const channel = supabase
      .channel(`portal-client-tasks-${clientProfile.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "client_portal_tasks",
          filter: `client_id=eq.${clientProfile.id}`,
        },
        (payload) => {
          const eventType = payload.eventType;
          const insertedTaskId = eventType === "INSERT" ? String((payload.new as { id?: string })?.id || "") : "";

          if (eventType === "INSERT" && insertedTaskId && !knownPortalTaskIdsRef.current.has(insertedTaskId)) {
            toast.success("Nova pendencia recebida da equipe.");
          }

          if (eventType === "UPDATE") {
            const nextStatus = String((payload.new as { status?: string })?.status || "");
            if (nextStatus === "completed") {
              toast.success("Uma pendencia foi concluída pela equipe.");
            }
          }

          void fetchPortalData();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [clientProfile?.id, fetchPortalData]);

  const latestMessageByRequest = useMemo(() => {
    const map = new Map<string, PortalRequestMessage>();
    messages.forEach((message) => {
      if (!map.has(message.request_id)) map.set(message.request_id, message);
    });
    return map;
  }, [messages]);

  const documentsByRequest = useMemo(() => {
    const map = new Map<string, PortalClientDocument[]>();
    documents.forEach((document) => {
      if (!document.request_id) return;
      const list = map.get(document.request_id) || [];
      list.push(document);
      map.set(document.request_id, list);
    });
    return map;
  }, [documents]);

  const econtinuoDocuments = useMemo(
    () => documents.filter((document) => isEcontinuoDocument(document)),
    [documents],
  );

  const requestsAwaitingClient = useMemo(
    () =>
      requests.filter((request) => {
        if (request.status !== "pending") return false;
        const latest = latestMessageByRequest.get(request.id);
        return Boolean(latest?.is_from_team);
      }),
    [latestMessageByRequest, requests]
  );

  const pendingNow = useMemo(() => {
    const taskItems = portalTasks.filter((task) => task.status === "pending_client").map(toActionFromTask);
    const requestItems = requestsAwaitingClient.map((request) => ({
      id: `request-${request.id}`,
      title: `Responder: ${request.title}`,
      description: "Nossa equipe está aguardando seu retorno para continuar.",
      dueDate: request.updated_at,
      sector: request.sector,
      requestId: request.id,
    }));
    return [...taskItems, ...requestItems].slice(0, 6);
  }, [portalTasks, requestsAwaitingClient]);

  const recentUpdates = useMemo(() => {
    const sorted = [...requests].sort(
      (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    );
    return sorted.slice(0, 6).map((request) => {
      const latest = latestMessageByRequest.get(request.id);
      const statusMeta = statusConfig[request.status];
      return {
        id: request.id,
        title: request.title,
        description: latest?.is_from_team ? `Atualização da equipe: ${latest.content}` : `Status atual: ${statusMeta.label}`,
        dueDate: request.updated_at,
        sector: request.sector,
        requestId: request.id,
      } as PortalActionItem;
    });
  }, [latestMessageByRequest, requests]);

  const overviewMetrics = useMemo(() => {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const docsThisMonth = documents.filter((document) => getMonthKey(document.created_at) === currentMonth).length;
    const recentlyCompleted =
      requests.filter((request) => request.status === "completed").length +
      portalTasks.filter((task) => task.status === "completed").length;

    return [
      {
        label: "Solicitações pendentes",
        value: requests.filter((request) => request.status === "pending").length,
        helper: "Aguardando avanço",
      },
      {
        label: "Solicitações em andamento",
        value: requests.filter((request) => request.status === "in_progress").length,
        helper: "Em tratamento pela Grow",
      },
      {
        label: "Documentos enviados no mês",
        value: docsThisMonth,
        helper: "Envios deste mês",
      },
      {
        label: "Pendências da Grow",
        value: pendingNow.length,
        helper: "O que precisamos de você",
      },
      {
        label: "Itens concluídos recentemente",
        value: recentlyCompleted,
        helper: "Entregas já finalizadas",
      },
    ];
  }, [documents, pendingNow.length, portalTasks, requests]);

  const filteredRequests = useMemo(() => {
    const term = requestSearch.trim().toLowerCase();
    return requests.filter((request) => {
      if (requestStatusFilter !== "all" && request.status !== requestStatusFilter) return false;
      if (!term) return true;
      return (
        request.title.toLowerCase().includes(term) ||
        (request.description || "").toLowerCase().includes(term) ||
        request.category.toLowerCase().includes(term) ||
        request.sector.toLowerCase().includes(term)
      );
    });
  }, [requestSearch, requestStatusFilter, requests]);

  const selectedRequestDocuments = selectedRequest ? documentsByRequest.get(selectedRequest.id) || [] : [];

  const availableReasons = useMemo(() => getGuidedReasonsForSector(newRequestSector), [newRequestSector]);

  const selectedRequestReason = useMemo(
    () => availableReasons.find((reason) => reason.key === newRequestReasonKey) || availableReasons[0] || null,
    [availableReasons, newRequestReasonKey]
  );

  const activeStructuredFields = useMemo(
    () => selectedRequestReason?.fields || [],
    [selectedRequestReason],
  );
  const completedStructuredFieldCount = useMemo(
    () => activeStructuredFields.filter((field) => requestFieldValues[field.name]?.trim()).length,
    [activeStructuredFields, requestFieldValues],
  );

  useEffect(() => {
    if (!availableReasons.some((reason) => reason.key === newRequestReasonKey)) {
      setNewRequestReasonKey(getDefaultReasonKey(newRequestSector));
    }
  }, [availableReasons, newRequestReasonKey, newRequestSector]);

  const resetNewRequestForm = () => {
    setNewRequestSector(DEFAULT_REQUEST_SECTOR);
    setNewRequestReasonKey(getDefaultReasonKey(DEFAULT_REQUEST_SECTOR));
    setNewRequestTitle("");
    setNewRequestDescription("");
    setNewRequestFiles([]);
    setRequestFieldValues({});
    if (requestFilesInputRef.current) requestFilesInputRef.current.value = "";
  };

  const focusRequestComposer = useCallback(() => {
    window.setTimeout(() => {
      requestComposerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 60);
  }, []);

  const openRequestsHub = (mode: PortalRequestEntryMode = "freeform") => {
    setActiveTab("requests");
    setRequestEntryMode(mode);
    focusRequestComposer();
  };

  const prepareInlineRequest = (
    preset?: { sector?: string; reasonKey?: string; title?: string; description?: string },
    mode: PortalRequestEntryMode = "freeform",
  ) => {
    openRequestsHub(mode);
    setRequestFieldValues({});

    const nextSector =
      preset?.sector && sectorOptions.includes(preset.sector) ? preset.sector : newRequestSector || DEFAULT_REQUEST_SECTOR;
    const sectorReasons = getGuidedReasonsForSector(nextSector);
    const nextReasonKey =
      preset?.reasonKey && sectorReasons.some((reason) => reason.key === preset.reasonKey)
        ? preset.reasonKey
        : sectorReasons[0]?.key || "";

    setNewRequestSector(nextSector);
    setNewRequestReasonKey(nextReasonKey);
    if (preset?.title) setNewRequestTitle(preset.title);
    if (preset?.description) setNewRequestDescription(preset.description);
  };

  const handleRequestSectorChange = (value: string) => {
    setRequestFieldValues({});
    setNewRequestSector(value);
    setNewRequestReasonKey(getDefaultReasonKey(value));
  };

  const handleRequestReasonChange = (value: string) => {
    const reason = availableReasons.find((item) => item.key === value);
    setRequestFieldValues({});
    setNewRequestReasonKey(value);
    if (reason && !newRequestTitle.trim()) {
      setNewRequestTitle(reason.defaultTitle);
    }
  };

  const handleRequestFileSelection = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selection = Array.from(event.target.files || []);
    const { accepted, rejected } = filterSecureDocuments(selection);
    setNewRequestFiles(accepted);
    if (rejected.length > 0) {
      toast.error(rejected[0]);
    }
  };

  const removeRequestFile = (index: number) => {
    setNewRequestFiles((prev) => prev.filter((_, fileIndex) => fileIndex !== index));
  };
  const uploadFilesToRequest = async (requestId: string, files: File[], category: string) => {
    if (!user || files.length === 0) return { success: 0, failed: 0 };

    let success = 0;
    let failed = 0;

    for (const file of files) {
      const { accepted } = filterSecureDocuments([file]);
      if (accepted.length === 0) {
        failed += 1;
        continue;
      }

      const filePath = buildSecureStoragePath(
        [user.id, requestId, `${Date.now()}_${crypto.randomUUID()}`],
        file.name,
      );
      const { error: uploadError } = await supabase.storage.from("client-documents").upload(filePath, file);
      if (uploadError) {
        failed += 1;
        continue;
      }

      const { error: dbError } = await supabase.from("client_documents").insert({
        user_id: user.id,
        request_id: requestId,
        file_name: file.name,
        file_path: filePath,
        file_size: file.size,
        category,
      });

      if (dbError) {
        failed += 1;
      } else {
        success += 1;
      }
    }

    return { success, failed };
  };

  const buildStructuredLines = (fields: PortalGuidedField[]) =>
    fields
      .map((field) => {
        const value = requestFieldValues[field.name]?.trim();
        if (!value) return null;
        return `${field.label}: ${value}`;
      })
      .filter(Boolean) as string[];

  const buildRequestDescription = () => {
    const sections: string[] = [];

    if (selectedRequestReason?.description) {
      sections.push(selectedRequestReason.description);
    }

    if (activeStructuredFields.length > 0) {
      const lines = buildStructuredLines(activeStructuredFields);
      if (lines.length > 0) {
        sections.push(lines.join("\n"));
      }
    }

    if (newRequestDescription.trim()) {
      sections.push(`Contexto adicional:\n${newRequestDescription.trim()}`);
    }

    return sections.filter(Boolean).join("\n\n") || null;
  };

  const handleCreateRequest = async () => {
    if (!user) return;
    if (!newRequestSector) {
      toast.error("Selecione o setor responsavel.");
      return;
    }
    if (!selectedRequestReason) {
      toast.error("Selecione o motivo da solicitacao.");
      return;
    }
    if (!newRequestTitle.trim()) {
      toast.error("Informe o título da solicitação.");
      return;
    }

    const missingRequired = activeStructuredFields.find((field) => field.required && !requestFieldValues[field.name]?.trim());
    if (missingRequired) {
      toast.error(`Preencha o campo obrigatorio: ${missingRequired.label}`);
      return;
    }

    setCreatingRequest(true);
    const { data: createdRequest, error } = await supabase
      .from("client_requests")
      .insert({
        user_id: user.id,
        title: newRequestTitle.trim(),
        description: buildRequestDescription(),
        category: selectedRequestReason?.label || "Solicitacao",
        sector: newRequestSector,
      })
      .select("id")
      .single();

    if (error || !createdRequest) {
      setCreatingRequest(false);
      toast.error("Não foi possível enviar sua solicitação.");
      return;
    }

    const uploadResult = await uploadFilesToRequest(
      createdRequest.id,
      newRequestFiles,
      `Solicitacao - ${selectedRequestReason?.label || "Geral"}`
    );

    setCreatingRequest(false);
    resetNewRequestForm();

    if (uploadResult.failed > 0) {
      toast.error(
        `Solicitação enviada. ${uploadResult.success} arquivo(s) anexado(s) e ${uploadResult.failed} com falha.`
      );
    } else {
      toast.success("Sua solicitação foi enviada ao setor responsável.");
    }

    setActiveTab("requests");
    setRequestEntryMode("freeform");
    await fetchPortalData();
  };

  const handleUploadFilesSelection = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selection = Array.from(event.target.files || []);
    const { accepted, rejected } = filterSecureDocuments(selection);
    setUploadFiles(accepted);
    if (rejected.length > 0) {
      toast.error(rejected[0]);
    }
  };

  const removeUploadFile = (index: number) => {
    setUploadFiles((prev) => prev.filter((_, fileIndex) => fileIndex !== index));
  };

  const handleUploadDocuments = async () => {
    if (!user || uploadFiles.length === 0) {
      toast.error("Selecione ao menos um arquivo para envio.");
      return;
    }

    setUploadingFiles(true);
    const requestId = uploadRequestId !== "none" ? uploadRequestId : null;
    let success = 0;
    let failed = 0;

    for (const file of uploadFiles) {
      const { accepted } = filterSecureDocuments([file]);
      if (accepted.length === 0) {
        failed += 1;
        continue;
      }

      const filePath = buildSecureStoragePath(
        [user.id, `${Date.now()}_${crypto.randomUUID()}`],
        file.name,
      );
      const { error: uploadError } = await supabase.storage.from("client-documents").upload(filePath, file);
      if (uploadError) {
        failed += 1;
        continue;
      }

      const { error: dbError } = await supabase.from("client_documents").insert({
        user_id: user.id,
        request_id: requestId,
        file_name: file.name,
        file_path: filePath,
        file_size: file.size,
        category: uploadCategory,
      });

      if (dbError) {
        failed += 1;
      } else {
        success += 1;
      }
    }

    setUploadingFiles(false);
    if (success > 0) {
      toast.success(`${success} arquivo(s) enviado(s) com sucesso.`);
      setUploadDialogOpen(false);
      setUploadFiles([]);
      if (uploadFilesInputRef.current) uploadFilesInputRef.current.value = "";
      await fetchPortalData();
    }
    if (failed > 0) toast.error(`${failed} arquivo(s) não puderam ser enviados.`);
  };

  const handleDeleteDocument = async (document: PortalClientDocument) => {
    if (document.processed_at) {
      toast.error("Este arquivo já foi processado pela equipe e não pode ser excluído.");
      return;
    }

    const { error: storageError } = await supabase.storage.from("client-documents").remove([document.file_path]);
    if (storageError) {
      toast.error("Erro ao remover arquivo do armazenamento.");
      return;
    }

    const { error: deleteError } = await supabase.from("client_documents").delete().eq("id", document.id);
    if (deleteError) {
      toast.error("Erro ao remover arquivo do histórico.");
      return;
    }

    toast.success("Documento excluído com sucesso.");
    await fetchPortalData();
  };

  const handleDownloadDocument = async (document: PortalClientDocument) => {
    const { data, error } = await supabase.storage
      .from("client-documents")
      .createSignedUrl(document.file_path, 120);

    if (error || !data?.signedUrl) {
      toast.error("Não foi possível gerar o link de download.");
      return;
    }

    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  const handleRequestFieldValueChange = (fieldName: string, value: string) => {
    setRequestFieldValues((prev) => ({ ...prev, [fieldName]: value }));
  };

  const handleCreateCashflowEntry = async (payload: NewPortalCashflowEntryPayload) => {
    if (!user || !clientProfile?.id) {
      toast.error("Cliente não vinculado ao portal para registrar lançamentos.");
      return false;
    }

    if (!clientProfile.portal_cashflow_enabled) {
      toast.error("Controle de caixa ainda não liberado para este cliente.");
      return false;
    }

    setCreatingCashflowEntry(true);
    const { error } = await supabase.from("client_cashflow_entries").insert({
      client_id: clientProfile.id,
      entry_date: payload.entry_date,
      entry_type: payload.entry_type,
      category: payload.category,
      description: payload.description,
      amount: payload.amount,
      status: payload.status,
      created_by: user.id,
    });
    setCreatingCashflowEntry(false);

    if (error) {
      toast.error("Não foi possível registrar o lançamento no caixa.");
      return false;
    }

    toast.success("Lançamento registrado no controle de caixa.");
    await fetchPortalData();
    return true;
  };

  const handleCreateCashflowEntriesBatch = async (payloads: NewPortalCashflowEntryPayload[]) => {
    if (!user || !clientProfile?.id) {
      toast.error("Cliente não vinculado ao portal para registrar lançamentos.");
      return { success: false, inserted: 0 };
    }

    if (!clientProfile.portal_cashflow_enabled) {
      toast.error("Controle de caixa ainda não liberado para este cliente.");
      return { success: false, inserted: 0 };
    }

    if (payloads.length === 0) {
      toast.error("Nenhum lançamento selecionado para importacao.");
      return { success: false, inserted: 0 };
    }

    setCreatingCashflowEntry(true);
    const { error } = await supabase.from("client_cashflow_entries").insert(
      payloads.map((payload) => ({
        client_id: clientProfile.id,
        entry_date: payload.entry_date,
        entry_type: payload.entry_type,
        category: payload.category,
        description: payload.description,
        amount: payload.amount,
        status: payload.status,
        created_by: user.id,
      })),
    );
    setCreatingCashflowEntry(false);

    if (error) {
      toast.error("Não foi possível importar os lançamentos no controle de caixa.");
      return { success: false, inserted: 0 };
    }

    await fetchPortalData();
    return { success: true, inserted: payloads.length };
  };

  const handlePortalPasswordChange = async () => {
    const accountEmail = user?.email?.trim().toLowerCase();
    if (!accountEmail) {
      toast.error("Não foi possível identificar o e-mail da conta.");
      return;
    }

    if (!passwordForm.currentPassword) {
      toast.error("Informe a senha atual.");
      return;
    }

    if (passwordForm.newPassword.length < 8) {
      toast.error("A nova senha precisa ter no mínimo 8 caracteres.");
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error("A confirmação da nova senha não confere.");
      return;
    }

    setChangingPortalPassword(true);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: accountEmail,
      password: passwordForm.currentPassword,
    });

    if (signInError) {
      setChangingPortalPassword(false);
      toast.error("Senha atual invalida.");
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({
      password: passwordForm.newPassword,
    });

    setChangingPortalPassword(false);

    if (updateError) {
      toast.error("Não foi possível alterar a senha do portal.");
      return;
    }

    setPasswordForm({
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    });
    toast.success("Senha do portal alterada com sucesso.");
  };

  const currentMonthLabel = useMemo(
    () => new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" }),
    []
  );

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!loadingData && (portalAccessDenied || !clientProfile)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <Card className="w-full max-w-xl">
          <CardHeader>
            <CardTitle className="text-base">Acesso ao portal não liberado</CardTitle>
            <p className="text-sm text-muted-foreground">
              {portalAccessMessage}
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Se o problema persistir, peca ao administrador para validar e liberar o acesso no cadastro do cliente.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  void signOut();
                  navigate("/app/login");
                }}
              >
                Sair
              </Button>
              <Button onClick={() => navigate("/app/login")}>Voltar ao login</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <PortalClienteSidebar activeTab={activeTab} onChangeTab={setActiveTab} />

        <div className="flex-1 flex min-w-0 flex-col">
          <header className="flex min-h-16 items-center justify-between border-b bg-card px-3 py-2.5 shrink-0 md:px-4">
            <div className="flex min-w-0 items-center gap-2 md:gap-3">
              <SidebarTrigger />
              <div className="min-w-0">
                <p className="font-semibold text-sm">Portal do Cliente</p>
                <p className="hidden text-xs text-muted-foreground sm:block">Solicitacoes, documentos, atendimento e caixa</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground hidden sm:inline">{user.email}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  void signOut();
                  navigate("/app/login");
                }}
              >
                Sair
              </Button>
            </div>
          </header>

          <main className="flex-1 overflow-auto bg-muted/20 p-2.5 sm:p-4 lg:p-6">
            <div className="mx-auto w-full max-w-7xl space-y-4 sm:space-y-5">
              <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as PortalTab)} className="space-y-4">

          <TabsContent value="overview" className="space-y-4">
            <ClientPortalOverview
              clientName={clientProfile?.name || clientProfile?.contact || "Cliente Grow"}
              monthLabel={currentMonthLabel}
              metrics={overviewMetrics}
              pendingNow={pendingNow}
              recentUpdates={recentUpdates}
              onNewRequest={() => openRequestsHub("freeform")}
              onUploadDocument={() => setUploadDialogOpen(true)}
              onOpenSupport={() => openRequestsHub("support")}
            />

            {clientProfile?.id ? (
              <GrowAssistantWidget
                clientId={clientProfile.id}
                clientName={clientProfile.name || clientProfile.contact || "Cliente Grow"}
                onRequestHumanSupport={() =>
                  prepareInlineRequest(
                    {
                      sector: "Geral",
                      reasonKey: "outro_assunto",
                      title: "Encaminhamento para atendimento humano",
                      description: "Quero encaminhar esta demanda para atendimento humano após a triagem da assistente Grow.",
                    },
                    "support",
                  )}
              />
            ) : null}
          </TabsContent>

          <TabsContent value="requests" className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Central de solicitações</CardTitle>
              </CardHeader>
              <CardContent className="pt-4 sm:pt-5">
                <div className="mx-auto max-w-6xl space-y-4">
                  <div className="rounded-[1.4rem] border bg-background p-3.5 shadow-sm sm:p-5">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-semibold">Abrir nova solicitacao</h3>
                            <Badge variant="secondary">
                              {requestEntryMode === "support" ? "atendimento por setor" : "fluxo guiado"}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Escolha o tipo do pedido e preencha em uma ordem natural, sem menus laterais ou blocos soltos.
                          </p>
                        </div>
                        <Button type="button" variant="ghost" size="sm" onClick={resetNewRequestForm}>
                          Limpar
                        </Button>
                      </div>

                      <div className="mt-4 rounded-2xl border border-dashed bg-muted/15 p-3 sm:p-4">
                        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                          <Sparkles className="h-3.5 w-3.5" />
                          Atalhos frequentes
                        </div>
                        <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                          {portalRequestShortcuts.map((shortcut) => (
                            <Button
                              key={shortcut.label}
                              type="button"
                              variant="outline"
                              className="h-auto min-h-16 justify-start rounded-xl border bg-background px-3 py-3 text-left transition-transform hover:-translate-y-0.5 hover:border-primary/30 hover:bg-background"
                              onClick={() =>
                                prepareInlineRequest(
                                  {
                                    sector: shortcut.sector,
                                    reasonKey: shortcut.reasonKey,
                                    title: shortcut.title,
                                  },
                                  "support",
                                )
                              }
                            >
                              <div className="space-y-0.5">
                                <div className="text-sm font-medium">{shortcut.label}</div>
                                <div className="text-xs text-muted-foreground">{shortcut.hint}</div>
                              </div>
                            </Button>
                          ))}
                        </div>
                      </div>

                      <div ref={requestComposerRef} className="mt-5 space-y-4">
                        <div className="rounded-2xl border bg-muted/10 p-4">
                          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <div className="space-y-1.5">
                              <label htmlFor="portal-request-sector" className="text-sm font-medium">Setor</label>
                              <Select value={newRequestSector} onValueChange={handleRequestSectorChange}>
                                <SelectTrigger id="portal-request-sector" className="bg-background">
                                  <SelectValue placeholder="Selecione o setor" />
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
                              <label htmlFor="portal-request-reason" className="text-sm font-medium">Motivo da solicitacao</label>
                              <Select value={selectedRequestReason?.key || ""} onValueChange={handleRequestReasonChange}>
                                <SelectTrigger id="portal-request-reason" className="bg-background">
                                  <SelectValue placeholder="Selecione o motivo" />
                                </SelectTrigger>
                                <SelectContent>
                                  {availableReasons.map((reason) => (
                                    <SelectItem key={reason.key} value={reason.key}>
                                      {reason.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          <div className="mt-4 space-y-1.5">
                            <label htmlFor="portal-request-title" className="text-sm font-medium">Assunto</label>
                            <Input
                              id="portal-request-title"
                              name="portal_request_title"
                              autoComplete="off"
                              value={newRequestTitle}
                              onChange={(event) => setNewRequestTitle(event.target.value)}
                              placeholder={selectedRequestReason?.defaultTitle || "Ex.: Revisao da folha do mes"}
                            />
                          </div>
                        </div>

                        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.18fr)_minmax(280px,0.82fr)]">
                          <div className="order-2 space-y-4 xl:order-1">
                            {selectedRequestReason ? (
                              <div className="rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/[0.08] via-background to-background p-4">
                                <div className="flex flex-wrap items-center gap-2">
                                  <Badge variant="outline" className="border-primary/20 bg-background/80 text-primary">
                                    {selectedRequestReason.sector}
                                  </Badge>
                                  <p className="text-sm font-semibold">{selectedRequestReason.label}</p>
                                </div>
                                <p className="mt-2 text-sm text-muted-foreground">{selectedRequestReason.description}</p>
                              </div>
                            ) : null}

                            {activeStructuredFields.length > 0 ? (
                              <div className="rounded-2xl border bg-muted/15 p-4 space-y-3">
                                <div className="space-y-1">
                                  <p className="text-sm font-medium">Campos da solicitacao</p>
                                  <p className="text-xs text-muted-foreground">
                                    O portal libera apenas os dados que ajudam a equipe a entender o pedido sem excesso de preenchimento.
                                  </p>
                                </div>

                                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                  {activeStructuredFields.map((field) => (
                                    <div
                                      key={field.name}
                                      className={`space-y-1.5 ${field.type === "textarea" ? "md:col-span-2" : ""}`}
                                    >
                                      <label htmlFor={`portal-field-${field.name}`} className="text-sm font-medium">
                                        {field.label}
                                        {field.required ? <span className="ml-1 text-destructive">*</span> : null}
                                      </label>
                                      {field.type === "select" ? (
                                        <Select value={requestFieldValues[field.name] || ""} onValueChange={(value) => handleRequestFieldValueChange(field.name, value)}>
                                          <SelectTrigger id={`portal-field-${field.name}`} className="bg-background">
                                            <SelectValue placeholder="Selecione…" />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {(field.options || []).map((option) => (
                                              <SelectItem key={option} value={option}>
                                                {option}
                                              </SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      ) : field.type === "textarea" ? (
                                        <Textarea
                                          id={`portal-field-${field.name}`}
                                          name={field.name}
                                          rows={4}
                                          autoComplete="off"
                                          value={requestFieldValues[field.name] || ""}
                                          onChange={(event) => handleRequestFieldValueChange(field.name, event.target.value)}
                                          placeholder={field.placeholder}
                                        />
                                      ) : (
                                        <Input
                                          id={`portal-field-${field.name}`}
                                          name={field.name}
                                          autoComplete={field.type === "email" ? "email" : "off"}
                                          spellCheck={field.type === "email" ? false : undefined}
                                          type={field.type === "date" ? "date" : field.type === "email" ? "email" : "text"}
                                          value={requestFieldValues[field.name] || ""}
                                          onChange={(event) => handleRequestFieldValueChange(field.name, event.target.value)}
                                          placeholder={field.placeholder}
                                        />
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : null}

                            <div className="space-y-1.5 rounded-2xl border bg-background p-4">
                              <label htmlFor="portal-request-description" className="text-sm font-medium">Contexto adicional</label>
                              <Textarea
                                id="portal-request-description"
                                name="portal_request_description"
                                rows={7}
                                autoComplete="off"
                                value={newRequestDescription}
                                onChange={(event) => setNewRequestDescription(event.target.value)}
                                placeholder="Descreva prazo, urgencia, observacoes ou qualquer detalhe que ajude a equipe."
                              />
                            </div>
                          </div>

                          <div className="order-1 space-y-4 xl:order-2">
                            <div className="rounded-2xl border bg-card p-4 shadow-sm">
                              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                <div className="space-y-1">
                                  <p className="text-sm font-medium">Leitura do pedido</p>
                                  <p className="text-xs text-muted-foreground">
                                    Um resumo rapido do que ja esta pronto para envio.
                                  </p>
                                </div>
                                <ShieldCheck className="h-4 w-4 text-primary" />
                              </div>

                              <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
                                <div className="rounded-xl border bg-background px-3 py-2">
                                  <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Setor</p>
                                  <p className="mt-1 text-sm font-medium">{newRequestSector}</p>
                                </div>
                                <div className="rounded-xl border bg-background px-3 py-2">
                                  <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Motivo</p>
                                  <p className="mt-1 text-sm font-medium">{selectedRequestReason?.label || "Selecione o motivo"}</p>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                  <div className="rounded-xl border bg-background px-3 py-2">
                                    <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Campos</p>
                                    <p className="mt-1 text-sm font-medium">
                                      {completedStructuredFieldCount}/{activeStructuredFields.length || 0}
                                    </p>
                                  </div>
                                  <div className="rounded-xl border bg-background px-3 py-2">
                                    <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Anexos</p>
                                    <p className="mt-1 text-sm font-medium">{newRequestFiles.length}</p>
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="space-y-2 rounded-2xl border bg-card p-4 shadow-sm">
                              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                  <p className="text-sm font-medium">Arquivos</p>
                                  <p className="text-xs text-muted-foreground">
                                    Envie apenas o material que acelera a analise.
                                  </p>
                                </div>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="w-full sm:w-auto"
                                  onClick={() => requestFilesInputRef.current?.click()}
                                >
                                  <Paperclip className="mr-1 h-4 w-4" /> Anexar
                                </Button>
                              </div>
                              <input
                                ref={requestFilesInputRef}
                                type="file"
                                accept={SECURE_DOCUMENT_ACCEPT}
                                multiple
                                className="hidden"
                                onChange={handleRequestFileSelection}
                              />
                              {newRequestFiles.length === 0 ? (
                                <div className="rounded-xl border border-dashed bg-background px-3 py-6 text-center text-xs text-muted-foreground">
                                  Nenhum arquivo selecionado.
                                </div>
                              ) : (
                                <div className="space-y-2">
                                  {newRequestFiles.map((file, index) => (
                                    <div key={`${file.name}-${index}`} className="flex items-center justify-between rounded-xl border bg-background px-3 py-2">
                                      <div className="min-w-0">
                                        <p className="truncate text-sm">{file.name}</p>
                                        <p className="text-[11px] text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
                                      </div>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8"
                                        aria-label={`Remover arquivo ${file.name}`}
                                        onClick={() => removeRequestFile(index)}
                                      >
                                        <X className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>

                            <div className="rounded-2xl border border-primary/15 bg-gradient-to-br from-primary to-primary/80 p-4 text-primary-foreground shadow-sm">
                              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <div className="space-y-1">
                                  <p className="text-sm font-semibold">Pronto para enviar</p>
                                  <p className="text-xs text-primary-foreground/80">
                                    O pedido entra no mesmo fluxo do portal e aparece no historico com status e atualizacoes da equipe.
                                  </p>
                                </div>
                                <Button
                                  type="button"
                                  variant="secondary"
                                  className="w-full gap-2 bg-background text-foreground hover:bg-background/90 sm:w-auto"
                                  onClick={() => void handleCreateRequest()}
                                  disabled={creatingRequest}
                                >
                                  {creatingRequest ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                                  Enviar solicitacao
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-base">Historico de solicitacoes</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Consulte status, retornos da equipe e documentos vinculados em uma leitura mais limpa.
                    </p>
                  </div>
                  <Badge variant="outline" className="w-fit">
                    {filteredRequests.length} item(ns)
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-3 pt-0 md:grid-cols-[minmax(0,1fr)_220px]">
                <div className="flex items-center gap-2 rounded-lg border bg-background px-3 py-2">
                  <Search className="h-4 w-4 text-muted-foreground" />
                  <input
                    aria-label="Buscar solicitacoes"
                    name="portal_request_search"
                    autoComplete="off"
                    className="bg-transparent text-sm outline-none w-full placeholder:text-muted-foreground"
                    placeholder="Buscar por titulo, categoria ou setor…"
                    value={requestSearch}
                    onChange={(event) => setRequestSearch(event.target.value)}
                  />
                </div>
                <Select value={requestStatusFilter} onValueChange={setRequestStatusFilter}>
                  <SelectTrigger className="bg-background">
                    <Filter className="h-4 w-4 mr-1" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os status</SelectItem>
                    <SelectItem value="pending">Pendentes</SelectItem>
                    <SelectItem value="in_progress">Em andamento</SelectItem>
                    <SelectItem value="completed">Concluídas</SelectItem>
                    <SelectItem value="cancelled">Canceladas</SelectItem>
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            {loadingData ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : filteredRequests.length === 0 ? (
              <Card>
                <CardContent className="p-10 text-center">
                  <MessageSquare className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
                  <p className="font-medium">Nenhuma solicitação encontrada.</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Sua solicitação será direcionada ao setor responsável e aparecerá aqui com o status atualizado.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {filteredRequests.map((request) => {
                  const statusMeta = statusConfig[request.status];
                  const StatusIcon = statusMeta.icon;
                  const requestDocs = documentsByRequest.get(request.id) || [];
                  const latest = latestMessageByRequest.get(request.id);

                  return (
                    <button
                      type="button"
                      key={request.id}
                      className="w-full text-left rounded-2xl border bg-card px-4 py-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/20 hover:bg-muted/20"
                      onClick={() => {
                        setSelectedRequest(request);
                        setRequestDetailOpen(true);
                      }}
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="secondary" className="text-[10px]">
                              {request.category}
                            </Badge>
                            <Badge variant="outline" className="text-[10px]">
                              {request.sector}
                            </Badge>
                          </div>
                          <p className="font-medium line-clamp-1">{request.title}</p>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <span>{request.category}</span>
                            <span>•</span>
                            <span>{request.sector}</span>
                            <span>•</span>
                            <span>Atualizada em {new Date(request.updated_at).toLocaleDateString("pt-BR")}</span>
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-2 sm:justify-end">
                          <Badge variant="outline" className={`border-0 ${statusMeta.className}`}>
                            <StatusIcon className="h-3 w-3 mr-1" /> {statusMeta.label}
                          </Badge>
                          <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </div>
                      <div className="mt-4 grid gap-2 sm:grid-cols-2">
                        <div className="rounded-xl border bg-background px-3 py-2">
                          <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Arquivos</p>
                          <p className="mt-1 text-sm font-medium">
                            {requestDocs.length} documento(s) vinculado(s)
                          </p>
                        </div>
                        <div className="rounded-xl border bg-background px-3 py-2">
                          <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Ultima interacao</p>
                          <p className="mt-1 text-sm font-medium">
                            {latest ? new Date(latest.created_at).toLocaleDateString("pt-BR") : "Sem mensagens"}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </TabsContent>
          <TabsContent value="uploads" className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Envios do e-continuo</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Historico automatico dos arquivos enviados pela equipe para este cliente.
                </p>
              </CardHeader>
            </Card>

            {loadingData ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : econtinuoDocuments.length === 0 ? (
              <Card>
                <CardContent className="p-10 text-center">
                  <Upload className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
                  <p className="font-medium">Nenhum envio do e-continuo encontrado.</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Assim que houver envios, eles serao listados automaticamente aqui.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {econtinuoDocuments.map((document) => (
                  <div
                    key={document.id}
                    className="rounded-xl border bg-card px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="font-medium truncate">{document.file_name}</p>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mt-1">
                        <span>Enviado em {new Date(document.created_at).toLocaleString("pt-BR")}</span>
                        <span>•</span>
                        <span>{document.category}</span>
                        {document.file_size ? (
                          <>
                            <span>•</span>
                            <span>{(document.file_size / 1024).toFixed(1)} KB</span>
                          </>
                        ) : null}
                      </div>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="gap-1.5 shrink-0"
                      onClick={() => void handleDownloadDocument(document)}
                    >
                      <Download className="h-4 w-4" /> Baixar
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
          <TabsContent value="cashflow" className="space-y-4">
            <ClientPortalCashflow
              enabled={Boolean(clientProfile?.portal_cashflow_enabled)}
              loading={loadingData}
              entries={cashflowEntries}
              creating={creatingCashflowEntry}
              onCreateEntry={handleCreateCashflowEntry}
              onCreateEntriesBatch={handleCreateCashflowEntriesBatch}
              onRequestEnable={() =>
                prepareInlineRequest({
                  sector: "Financeiro",
                  reasonKey: "controle_caixa",
                  title: "Liberacao do controle de caixa no portal",
                  description: "Solicito a liberacao do modulo de controle de caixa para uso no portal do cliente.",
                })
              }
            />
          </TabsContent>

          <TabsContent value="manual" className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Manual do usuário</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Passo a passo rápido para usar o portal no dia a dia.
                </p>
              </CardHeader>
            </Card>

            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="rounded-lg border bg-card p-4 space-y-2">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-medium">1. Abra uma solicitação</p>
                      <p className="text-sm text-muted-foreground">
                        Use a aba de solicitacoes para escolher setor, motivo e preencher os campos certos na propria pagina.
                      </p>
                    </div>
                    <Button type="button" variant="outline" size="sm" className="w-full sm:w-auto" onClick={() => openRequestsHub("freeform")}>
                      Ir para solicitações
                    </Button>
                  </div>
                </div>

                <div className="rounded-lg border bg-card p-4 space-y-2">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-medium">2. Envie documentos</p>
                      <p className="text-sm text-muted-foreground">
                        Use o botao de envio para anexar os arquivos do mes de forma rápida e organizada.
                      </p>
                    </div>
                    <Button type="button" variant="outline" size="sm" className="w-full sm:w-auto" onClick={() => setUploadDialogOpen(true)}>
                      Enviar documentos
                    </Button>
                  </div>
                </div>

                <div className="rounded-lg border bg-card p-4 space-y-2">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-medium">3. Escolha o motivo certo</p>
                      <p className="text-sm text-muted-foreground">
                        O setor e o motivo definem automaticamente os campos necessarios para cada tipo de pedido.
                      </p>
                    </div>
                    <Button type="button" variant="outline" size="sm" className="w-full sm:w-auto" onClick={() => openRequestsHub("support")}>
                      Ir para solicitações
                    </Button>
                  </div>
                </div>

                <div className="rounded-lg border bg-card p-4 space-y-2">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-medium">4. Acompanhe o controle de caixa (quando liberado)</p>
                      <p className="text-sm text-muted-foreground">
                        Se o admin liberar este modulo, voce pode registrar entradas e saidas e acompanhar os indicadores de caixa.
                      </p>
                    </div>
                    <Button type="button" variant="outline" size="sm" className="w-full sm:w-auto" onClick={() => setActiveTab("cashflow")}>
                      Ir para controle de caixa
                    </Button>
                  </div>
                </div>

                <div className="rounded-lg border bg-card p-4 space-y-2">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-medium">5. Fale com a equipe pelo mesmo fluxo</p>
                      <p className="text-sm text-muted-foreground">
                        Demandas por setor e acompanhamentos também nascem dentro da central de solicitações.
                      </p>
                    </div>
                    <Button type="button" variant="outline" size="sm" className="w-full sm:w-auto" onClick={() => openRequestsHub("support")}>
                      Ir para solicitações
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Dicas rápidas</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-2 text-sm text-muted-foreground">
                <p>• Mantenha títulos objetivos nas solicitações para facilitar o retorno da equipe.</p>
                <p>• Sempre que possível, vincule documentos a uma solicitação específica.</p>
                <p>• O painel geral resume o que está aguardando sua ação imediata.</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Configurações do portal</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Gerencie seus dados e acione a equipe quando precisar de alterações de acesso.
                </p>
              </CardHeader>
            </Card>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Dados da conta</CardTitle>
                </CardHeader>
                <CardContent className="pt-0 space-y-3">
                  <div className="rounded-lg border bg-muted/20 px-3 py-2">
                    <p className="text-xs text-muted-foreground">Nome</p>
                    <p className="text-sm font-medium">{clientProfile?.name || clientProfile?.contact || "Não informado"}</p>
                  </div>
                  <div className="rounded-lg border bg-muted/20 px-3 py-2">
                    <p className="text-xs text-muted-foreground">Contato</p>
                    <p className="text-sm font-medium">{clientProfile?.contact || "Não informado"}</p>
                  </div>
                  <div className="rounded-lg border bg-muted/20 px-3 py-2">
                    <p className="text-xs text-muted-foreground">Email de acesso</p>
                    <p className="text-sm font-medium">{clientProfile?.email?.toLowerCase() || user?.email?.toLowerCase() || "Não informado"}</p>
                  </div>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full sm:w-auto"
                      onClick={() =>
                        prepareInlineRequest({
                          sector: "Geral",
                          reasonKey: "atualizacao_cadastral",
                          title: "Atualizacao de dados cadastrais",
                          description: "Preciso atualizar meus dados no portal do cliente.",
                        })
                      }
                    >
                    Solicitar atualização cadastral
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Acesso e segurança</CardTitle>
                </CardHeader>
                <CardContent className="pt-0 space-y-3">
                  <div className="rounded-lg border bg-muted/20 px-3 py-2">
                    <p className="text-sm font-medium">Troca de senha</p>
                    <p className="text-sm text-muted-foreground">
                      Altere sua senha de acesso ao portal diretamente nesta tela.
                    </p>
                  </div>
                  <div className="rounded-lg border bg-muted/20 px-3 py-3 space-y-2">
                    <div className="grid grid-cols-1 gap-2">
                      <Input
                        type="password"
                        placeholder="Senha atual"
                        value={passwordForm.currentPassword}
                        onChange={(event) =>
                          setPasswordForm((prev) => ({ ...prev, currentPassword: event.target.value }))
                        }
                      />
                      <Input
                        type="password"
                        placeholder="Nova senha (mínimo 6 caracteres)"
                        value={passwordForm.newPassword}
                        onChange={(event) =>
                          setPasswordForm((prev) => ({ ...prev, newPassword: event.target.value }))
                        }
                      />
                      <Input
                        type="password"
                        placeholder="Confirmar nova senha"
                        value={passwordForm.confirmPassword}
                        onChange={(event) =>
                          setPasswordForm((prev) => ({ ...prev, confirmPassword: event.target.value }))
                        }
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Dica: use uma senha forte com letras, numeros e simbolos.
                    </p>
                  </div>
                  <div className="rounded-lg border bg-muted/20 px-3 py-2">
                    <p className="text-sm font-medium">Controle de acesso</p>
                    <p className="text-sm text-muted-foreground">
                      Alterações de usuários e permissões são feitas pela equipe para garantir segurança no processo.
                    </p>
                  </div>
                  <div className="rounded-lg border bg-muted/20 px-3 py-2">
                    <p className="text-sm font-medium">Modulo de controle de caixa</p>
                    <p className="text-sm text-muted-foreground">
                      Status atual: {clientProfile?.portal_cashflow_enabled ? "liberado pelo admin" : "aguardando liberação do admin"}.
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                    <Button
                      type="button"
                      className="w-full sm:w-auto"
                      onClick={() => void handlePortalPasswordChange()}
                      disabled={changingPortalPassword}
                    >
                      {changingPortalPassword ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
                      Alterar senha
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full sm:w-auto"
                      onClick={() =>
                        prepareInlineRequest({
                          sector: "Geral",
                          reasonKey: "acesso_portal",
                          title: "Solicitacao de suporte de acesso ao portal",
                          description: "Preciso de suporte com acesso e seguranca no portal do cliente.",
                        }, "support")
                      }
                    >
                      Abrir solicitação de suporte
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

              </Tabs>
            </div>
          </main>
        </div>
      </div>

      <Dialog
        open={uploadDialogOpen}
        onOpenChange={(open) => {
          setUploadDialogOpen(open);
          if (!open) {
            setUploadFiles([]);
            if (uploadFilesInputRef.current) uploadFilesInputRef.current.value = "";
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Enviar documentos</DialogTitle>
            <DialogDescription>Envie seus documentos de forma rápida e organizada.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Categoria</label>
              <Select value={uploadCategory} onValueChange={setUploadCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {documentCategories.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Vincular a solicitação (opcional)</label>
              <Select value={uploadRequestId} onValueChange={setUploadRequestId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nao vincular agora</SelectItem>
                  {requests.map((request) => (
                    <SelectItem key={request.id} value={request.id}>
                      {request.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm font-medium">Arquivos</p>
                <Button type="button" variant="outline" size="sm" className="w-full sm:w-auto" onClick={() => uploadFilesInputRef.current?.click()}>
                  <Upload className="h-4 w-4 mr-1" /> Selecionar arquivos
                </Button>
              </div>
              <input
                ref={uploadFilesInputRef}
                type="file"
                accept={SECURE_DOCUMENT_ACCEPT}
                multiple
                className="hidden"
                onChange={handleUploadFilesSelection}
              />
              {uploadFiles.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nenhum arquivo selecionado.</p>
              ) : (
                <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                  {uploadFiles.map((file, index) => (
                    <div key={`${file.name}-${index}`} className="flex items-center justify-between rounded-md border px-3 py-2">
                      <p className="text-sm truncate">{file.name}</p>
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeUploadFile(index)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => setUploadDialogOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" className="w-full gap-2 sm:w-auto" onClick={() => void handleUploadDocuments()} disabled={uploadingFiles}>
              {uploadingFiles ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Enviar arquivos
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet open={requestDetailOpen} onOpenChange={setRequestDetailOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
          {selectedRequest && (() => {
            const statusMeta = statusConfig[selectedRequest.status];
            const StatusIcon = statusMeta.icon;
            const latest = latestMessageByRequest.get(selectedRequest.id);

            return (
              <>
                <SheetHeader>
                  <SheetTitle className="text-left">{selectedRequest.title}</SheetTitle>
                </SheetHeader>

                <div className="space-y-5 mt-6">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className={`border-0 ${statusMeta.className}`}>
                      <StatusIcon className="h-3 w-3 mr-1" />
                      {statusMeta.label}
                    </Badge>
                    <Badge variant="secondary" className="text-[10px]">
                      {selectedRequest.sector}
                    </Badge>
                    <Badge variant="outline" className="text-[10px]">
                      {selectedRequest.category}
                    </Badge>
                  </div>

                  <Card>
                    <CardContent className="p-4 space-y-3">
                      <p className="text-sm font-medium">Resumo da solicitação</p>
                      <p className="text-sm text-muted-foreground">
                        {selectedRequest.description || "Sem descrição informada."}
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-muted-foreground">
                        <span>Aberta em {new Date(selectedRequest.created_at).toLocaleDateString("pt-BR")}</span>
                        <span>Ultima atualizacao em {new Date(selectedRequest.updated_at).toLocaleDateString("pt-BR")}</span>
                        <span>Ultima interacao: {latest ? new Date(latest.created_at).toLocaleDateString("pt-BR") : "sem mensagens"}</span>
                      </div>
                      {selectedRequest.admin_notes && (
                        <div className="rounded-lg border bg-muted/40 p-3">
                          <p className="text-xs font-medium">Observacao da equipe</p>
                          <p className="text-xs text-muted-foreground mt-1">{selectedRequest.admin_notes}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <div className="space-y-2">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <h4 className="text-sm font-medium">Conversa com a equipe</h4>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-full sm:w-auto"
                        onClick={() => {
                          setRequestDetailOpen(false);
                          setUploadRequestId(selectedRequest.id);
                          setUploadDialogOpen(true);
                        }}
                      >
                        <Upload className="h-3.5 w-3.5 mr-1" />
                        Enviar documento para esta solicitação
                      </Button>
                    </div>
                    <RequestChat requestId={selectedRequest.id} isTeamMember={false} />
                  </div>

                  <div className="space-y-2">
                    <h4 className="text-sm font-medium">
                      Documentos vinculados ({selectedRequestDocuments.length})
                    </h4>
                    {selectedRequestDocuments.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        Nenhum documento vinculado ate o momento.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {selectedRequestDocuments.map((document) => (
                          <div key={document.id} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">{document.file_name}</p>
                              <p className="text-[11px] text-muted-foreground">
                                {document.category} • {new Date(document.created_at).toLocaleDateString("pt-BR")}
                              </p>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => void handleDownloadDocument(document)}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </>
            );
          })()}
        </SheetContent>
      </Sheet>
    </SidebarProvider>
  );
}
