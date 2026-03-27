import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  Filter,
  FolderOpen,
  Loader2,
  MessageSquare,
  Paperclip,
  Search,
  Send,
  Upload,
  X,
} from "lucide-react";
import { RequestChat } from "@/components/app/RequestChat";
import { ClientPortalOverview } from "@/components/portal/ClientPortalOverview";
import { ClientPortalPendingList } from "@/components/portal/ClientPortalPendingList";
import { ClientPortalSupport } from "@/components/portal/ClientPortalSupport";
import {
  documentCategories,
  parsePortalFields,
  portalRequestTemplates,
  recommendedMonthlyUploads,
  sectorOptions,
  supportSectors,
  type PortalActionItem,
  type PortalClientDocument,
  type PortalClientProfile,
  type PortalClientRequest,
  type PortalClientTask,
  type PortalFormTemplate,
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
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import growIcon from "@/assets/grow-icon.png";

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

type PortalTab = "overview" | "pending" | "requests" | "documents" | "forms" | "support";

const getMonthKey = (dateString: string) => {
  const date = new Date(dateString);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
};

const toActionFromTask = (task: PortalClientTask): PortalActionItem => ({
  id: task.id,
  title: task.title,
  description: task.description || null,
  dueDate: task.due_date,
  sector: task.sector,
  requestId: task.request_id,
});

export default function PortalClientePage() {
  const { user, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<PortalTab>("overview");
  const [loadingData, setLoadingData] = useState(true);

  const [clientProfile, setClientProfile] = useState<PortalClientProfile | null>(null);
  const [requests, setRequests] = useState<PortalClientRequest[]>([]);
  const [documents, setDocuments] = useState<PortalClientDocument[]>([]);
  const [publishedForms, setPublishedForms] = useState<PortalFormTemplate[]>([]);
  const [portalTasks, setPortalTasks] = useState<PortalClientTask[]>([]);
  const [messages, setMessages] = useState<PortalRequestMessage[]>([]);

  const [requestSearch, setRequestSearch] = useState("");
  const [requestStatusFilter, setRequestStatusFilter] = useState<string>("all");
  const [documentCategoryFilter, setDocumentCategoryFilter] = useState<string>("all");
  const [documentMonthFilter, setDocumentMonthFilter] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  const [newRequestOpen, setNewRequestOpen] = useState(false);
  const [newRequestType, setNewRequestType] = useState(portalRequestTemplates[0].key);
  const [newRequestTitle, setNewRequestTitle] = useState("");
  const [newRequestDescription, setNewRequestDescription] = useState("");
  const [newRequestSector, setNewRequestSector] = useState(portalRequestTemplates[0].defaultSector);
  const [newRequestFiles, setNewRequestFiles] = useState<File[]>([]);
  const [creatingRequest, setCreatingRequest] = useState(false);
  const requestFilesInputRef = useRef<HTMLInputElement>(null);

  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploadCategory, setUploadCategory] = useState(documentCategories[0]);
  const [uploadRequestId, setUploadRequestId] = useState<string>("none");
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const uploadFilesInputRef = useRef<HTMLInputElement>(null);

  const [selectedRequest, setSelectedRequest] = useState<PortalClientRequest | null>(null);
  const [requestDetailOpen, setRequestDetailOpen] = useState(false);

  const [selectedFormTemplate, setSelectedFormTemplate] = useState<PortalFormTemplate | null>(null);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [submittingForm, setSubmittingForm] = useState(false);

  const [selectedSupportRequestId, setSelectedSupportRequestId] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/login");
    }
  }, [authLoading, user, navigate]);

  const fetchPortalData = useCallback(async () => {
    if (!user) return;

    setLoadingData(true);

    const [clientRes, requestRes, docRes, formsRes] = await Promise.all([
      supabase
        .from("clients")
        .select("id, name, contact, email, portal_user_id")
        .eq("portal_user_id", user.id)
        .maybeSingle(),
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
      supabase
        .from("form_templates")
        .select("id, title, description, sector, fields")
        .eq("is_published", true)
        .order("updated_at", { ascending: false }),
    ]);

    if (requestRes.error) toast.error("Erro ao carregar solicitações.");
    if (docRes.error) toast.error("Erro ao carregar documentos.");
    if (formsRes.error) toast.error("Erro ao carregar formulários publicados.");

    const client = (clientRes.data || null) as PortalClientProfile | null;
    const fetchedRequests = (requestRes.data || []) as PortalClientRequest[];
    const fetchedDocuments = (docRes.data || []) as PortalClientDocument[];
    const fetchedForms: PortalFormTemplate[] = (formsRes.data || []).map((form) => ({
      id: form.id,
      title: form.title,
      description: form.description,
      sector: form.sector,
      fields: parsePortalFields(form.fields),
    }));

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

    setClientProfile(client);
    setRequests(fetchedRequests);
    setDocuments(fetchedDocuments);
    setPublishedForms(fetchedForms);
    setPortalTasks(fetchedTasks);
    setMessages(fetchedMessages);
    setLoadingData(false);
  }, [user]);

  useEffect(() => {
    if (user) void fetchPortalData();
  }, [fetchPortalData, user]);
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

  const pendingGroups = useMemo(() => {
    const documentsAwaiting = portalTasks
      .filter((task) => task.type === "document" && task.status === "pending_client")
      .map(toActionFromTask);

    const requestReturnTasks = portalTasks
      .filter((task) => task.type === "request_return" && task.status === "pending_client")
      .map(toActionFromTask);

    const requestReturnFromChat = requestsAwaitingClient.map((request) => ({
      id: `awaiting-${request.id}`,
      title: request.title,
      description: "Solicitação aguardando seu retorno para seguir no fluxo.",
      dueDate: request.updated_at,
      sector: request.sector,
      requestId: request.id,
    }));

    const analysisItems = [
      ...portalTasks.filter((task) => task.status === "in_analysis").map(toActionFromTask),
      ...requests
        .filter((request) => request.status === "in_progress")
        .map((request) => ({
          id: `analysis-${request.id}`,
          title: request.title,
          description: "Nossa equipe está analisando esta demanda.",
          dueDate: request.updated_at,
          sector: request.sector,
          requestId: request.id,
        })),
    ];

    const completedItems = [
      ...portalTasks.filter((task) => task.status === "completed").map(toActionFromTask),
      ...requests
        .filter((request) => request.status === "completed")
        .map((request) => ({
          id: `completed-${request.id}`,
          title: request.title,
          description: "Finalizado pela equipe Grow.",
          dueDate: request.updated_at,
          sector: request.sector,
          requestId: request.id,
        })),
    ];

    return [
      {
        key: "documents",
        title: "Documentos aguardados",
        emptyText: "Não há documentos pendentes neste momento.",
        items: documentsAwaiting,
        icon: "document" as const,
      },
      {
        key: "awaiting-client",
        title: "Solicitações aguardando seu retorno",
        emptyText: "Nenhuma solicitação aguardando retorno do cliente.",
        items: [...requestReturnTasks, ...requestReturnFromChat],
        icon: "request" as const,
      },
      {
        key: "analysis",
        title: "Itens em análise",
        emptyText: "Sem itens em análise agora.",
        items: analysisItems,
        icon: "analysis" as const,
      },
      {
        key: "completed",
        title: "Itens concluídos",
        emptyText: "Ainda não há itens concluídos para exibir.",
        items: completedItems,
        icon: "done" as const,
      },
    ];
  }, [portalTasks, requests, requestsAwaitingClient]);

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

  const filteredDocuments = useMemo(
    () =>
      documents.filter((document) => {
        if (documentCategoryFilter !== "all" && document.category !== documentCategoryFilter) return false;
        if (documentMonthFilter && getMonthKey(document.created_at) !== documentMonthFilter) return false;
        return true;
      }),
    [documentCategoryFilter, documentMonthFilter, documents]
  );

  const currentMonthUploads = useMemo(() => {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    return documents.filter((document) => getMonthKey(document.created_at) === currentMonth);
  }, [documents]);

  const monthlyChecklist = useMemo(() => {
    const hasByKeyword = (keywords: string[]) =>
      currentMonthUploads.some((document) => {
        const source = `${document.file_name.toLowerCase()} ${document.category.toLowerCase()}`;
        return keywords.some((keyword) => source.includes(keyword));
      });

    return recommendedMonthlyUploads.map((item) => {
      let done = false;
      if (item.id === "extratos") done = hasByKeyword(["extrato", "banco"]);
      if (item.id === "notas") done = hasByKeyword(["xml", "nota", "nfe", "nf-e"]);
      if (item.id === "folha") done = hasByKeyword(["folha", "recibo", "holerite"]);
      if (item.id === "contratos") done = hasByKeyword(["contrato"]);
      if (item.id === "cadastro") done = hasByKeyword(["cadastro", "cnpj", "social"]);
      return { ...item, done };
    });
  }, [currentMonthUploads]);

  const selectedRequestDocuments = selectedRequest ? documentsByRequest.get(selectedRequest.id) || [] : [];

  const selectedTemplateDefinition = useMemo(
    () => portalRequestTemplates.find((template) => template.key === newRequestType) || portalRequestTemplates[0],
    [newRequestType]
  );

  const resetNewRequestForm = () => {
    setNewRequestType(portalRequestTemplates[0].key);
    setNewRequestTitle("");
    setNewRequestDescription("");
    setNewRequestSector(portalRequestTemplates[0].defaultSector);
    setNewRequestFiles([]);
    if (requestFilesInputRef.current) requestFilesInputRef.current.value = "";
  };

  const openNewRequestDialog = (preset?: { sector?: string; title?: string; description?: string }) => {
    setNewRequestOpen(true);
    if (preset?.sector) {
      const match =
        portalRequestTemplates.find((template) => template.defaultSector === preset.sector) ||
        portalRequestTemplates[portalRequestTemplates.length - 1];
      setNewRequestType(match.key);
      setNewRequestSector(preset.sector);
    }
    if (preset?.title) setNewRequestTitle(preset.title);
    if (preset?.description) setNewRequestDescription(preset.description);
  };

  const handleRequestTypeChange = (value: string) => {
    const template = portalRequestTemplates.find((item) => item.key === value);
    setNewRequestType(value);
    if (template) setNewRequestSector(template.defaultSector);
  };

  const handleRequestFileSelection = (event: React.ChangeEvent<HTMLInputElement>) => {
    setNewRequestFiles(Array.from(event.target.files || []));
  };

  const removeRequestFile = (index: number) => {
    setNewRequestFiles((prev) => prev.filter((_, fileIndex) => fileIndex !== index));
  };
  const uploadFilesToRequest = async (requestId: string, files: File[], category: string) => {
    if (!user || files.length === 0) return { success: 0, failed: 0 };

    let success = 0;
    let failed = 0;

    for (const file of files) {
      const filePath = `${user.id}/${requestId}/${Date.now()}_${file.name}`;
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

  const handleCreateRequest = async () => {
    if (!user) return;
    if (!newRequestTitle.trim()) {
      toast.error("Informe o título da solicitação.");
      return;
    }

    setCreatingRequest(true);
    const { data: createdRequest, error } = await supabase
      .from("client_requests")
      .insert({
        user_id: user.id,
        title: newRequestTitle.trim(),
        description: newRequestDescription.trim() || null,
        category: newRequestType,
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
      `Solicitação - ${newRequestType}`
    );

    setCreatingRequest(false);
    setNewRequestOpen(false);
    resetNewRequestForm();

    if (uploadResult.failed > 0) {
      toast.error(
        `Solicitação enviada. ${uploadResult.success} arquivo(s) anexado(s) e ${uploadResult.failed} com falha.`
      );
    } else {
      toast.success("Sua solicitação foi enviada ao setor responsável.");
    }

    setActiveTab("requests");
    await fetchPortalData();
  };

  const handleUploadFilesSelection = (event: React.ChangeEvent<HTMLInputElement>) => {
    setUploadFiles(Array.from(event.target.files || []));
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
      const filePath = `${user.id}/${Date.now()}_${file.name}`;
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

  const openFormTemplate = (template: PortalFormTemplate) => {
    setSelectedFormTemplate(template);
    setFormValues({});
  };

  const handleFormValueChange = (fieldName: string, value: string) => {
    setFormValues((prev) => ({ ...prev, [fieldName]: value }));
  };

  const buildFormRequestDescription = (template: PortalFormTemplate) => {
    const lines = template.fields
      .map((field) => {
        const value = formValues[field.name]?.trim();
        if (!value) return null;
        return `${field.label}: ${value}`;
      })
      .filter(Boolean) as string[];

    return [`Solicitação criada a partir do formulário "${template.title}".`, "", ...lines].join("\n");
  };

  const handleSubmitPortalForm = async () => {
    if (!user || !selectedFormTemplate) return;

    const missingRequired = selectedFormTemplate.fields.find(
      (field) => field.required && !formValues[field.name]?.trim()
    );
    if (missingRequired) {
      toast.error(`Preencha o campo obrigatório: ${missingRequired.label}`);
      return;
    }

    setSubmittingForm(true);
    const { data: createdRequest, error: requestError } = await supabase
      .from("client_requests")
      .insert({
        user_id: user.id,
        title: `Formulário: ${selectedFormTemplate.title}`,
        description: buildFormRequestDescription(selectedFormTemplate),
        category: "Formulário",
        sector: selectedFormTemplate.sector,
      })
      .select("id")
      .single();

    if (requestError || !createdRequest) {
      setSubmittingForm(false);
      toast.error("Erro ao enviar formulário.");
      return;
    }

    const { error: submissionError } = await supabase.from("form_submissions").insert({
      template_id: selectedFormTemplate.id,
      template_title: selectedFormTemplate.title,
      submitted_by: user.id,
      submitted_by_name: clientProfile?.contact || clientProfile?.name || user.email || null,
      data: formValues,
      status: "pending",
      client_id: clientProfile?.id || null,
      request_id: createdRequest.id,
    });

    setSubmittingForm(false);
    if (submissionError) {
      toast.error("Formulário enviado, mas houve falha ao registrar os dados estruturados.");
    } else {
      toast.success("Formulário enviado com sucesso para o setor responsável.");
    }

    setSelectedFormTemplate(null);
    setFormValues({});
    setActiveTab("requests");
    await fetchPortalData();
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
  return (
    <div className="min-h-screen bg-muted/20">
      <header className="bg-card border-b sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg overflow-hidden shrink-0">
              <img src={growIcon} alt="Grow" className="h-full w-full object-cover" />
            </div>
            <div>
              <span className="font-semibold text-sm">Portal do Cliente Grow</span>
              <span className="text-xs text-muted-foreground block -mt-0.5">Central de atendimento e pendências</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground hidden sm:inline">{user.email}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                void signOut();
                navigate("/login");
              }}
            >
              Sair
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as PortalTab)} className="space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <TabsList className="flex flex-wrap h-auto">
              <TabsTrigger value="overview">Visão Geral</TabsTrigger>
              <TabsTrigger value="pending">Pendências</TabsTrigger>
              <TabsTrigger value="requests">Solicitações</TabsTrigger>
              <TabsTrigger value="documents">Documentos</TabsTrigger>
              <TabsTrigger value="forms">Formulários</TabsTrigger>
              <TabsTrigger value="support">Atendimento</TabsTrigger>
            </TabsList>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" className="gap-1.5" onClick={() => openNewRequestDialog()}>
                <MessageSquare className="h-4 w-4" /> Nova solicitação
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setUploadDialogOpen(true)}>
                <Upload className="h-4 w-4" /> Enviar documentos
              </Button>
            </div>
          </div>

          <TabsContent value="overview" className="space-y-4">
            <ClientPortalOverview
              clientName={clientProfile?.name || clientProfile?.contact || "Cliente Grow"}
              monthLabel={currentMonthLabel}
              metrics={overviewMetrics}
              pendingNow={pendingNow}
              recentUpdates={recentUpdates}
              onNewRequest={() => openNewRequestDialog()}
              onUploadDocument={() => setUploadDialogOpen(true)}
              onOpenForms={() => setActiveTab("forms")}
              onOpenSupport={() => setActiveTab("support")}
            />
          </TabsContent>

          <TabsContent value="pending" className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Pendências do cliente</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Aqui você acompanha o que está aguardando sua ação, o que está em análise e o que já foi concluído.
                </p>
              </CardHeader>
            </Card>
            <ClientPortalPendingList loading={loadingData} groups={pendingGroups} />
          </TabsContent>

          <TabsContent value="requests" className="space-y-4">
            <Card>
              <CardContent className="p-4 grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_220px] gap-3">
                <div className="flex items-center gap-2 rounded-lg border px-3 py-2">
                  <Search className="h-4 w-4 text-muted-foreground" />
                  <input
                    className="bg-transparent text-sm outline-none w-full placeholder:text-muted-foreground"
                    placeholder="Buscar por título, categoria ou setor..."
                    value={requestSearch}
                    onChange={(event) => setRequestSearch(event.target.value)}
                  />
                </div>
                <Select value={requestStatusFilter} onValueChange={setRequestStatusFilter}>
                  <SelectTrigger>
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
                      className="w-full text-left rounded-xl border bg-card p-4 hover:shadow-md transition-shadow"
                      onClick={() => {
                        setSelectedRequest(request);
                        setRequestDetailOpen(true);
                      }}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-medium">{request.title}</p>
                        <Badge variant="outline" className={`border-0 ${statusMeta.className}`}>
                          <StatusIcon className="h-3 w-3 mr-1" /> {statusMeta.label}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mt-2">
                        <span>{request.category}</span>
                        <span>•</span>
                        <span>{request.sector}</span>
                        <span>•</span>
                        <span>Aberta em {new Date(request.created_at).toLocaleDateString("pt-BR")}</span>
                        <span>•</span>
                        <span>Atualizada em {new Date(request.updated_at).toLocaleDateString("pt-BR")}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        <Badge variant="secondary" className="text-[10px]">
                          {requestDocs.length} documento(s) vinculado(s)
                        </Badge>
                        <Badge variant="outline" className="text-[10px]">
                          Última interação: {latest ? new Date(latest.created_at).toLocaleDateString("pt-BR") : "sem mensagens"}
                        </Badge>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </TabsContent>
          <TabsContent value="documents" className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Central de documentos</CardTitle>
                <p className="text-sm text-muted-foreground">Envie seus documentos de forma rápida e organizada.</p>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Select value={documentCategoryFilter} onValueChange={setDocumentCategoryFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as categorias</SelectItem>
                    {documentCategories.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input type="month" value={documentMonthFilter} onChange={(event) => setDocumentMonthFilter(event.target.value)} />
                <Button variant="outline" className="gap-2" onClick={() => setUploadDialogOpen(true)}>
                  <Upload className="h-4 w-4" /> Novo envio
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Envios recomendados do mês</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {monthlyChecklist.map((item) => (
                  <div
                    key={item.id}
                    className={`rounded-lg border px-3 py-2 text-sm flex items-center justify-between ${item.done ? "border-primary/40 bg-primary/5" : "bg-card"}`}
                  >
                    <span>{item.label}</span>
                    {item.done ? (
                      <Badge variant="outline" className="text-[10px] text-primary border-primary/40">Enviado</Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[10px]">Pendente</Badge>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>

            {filteredDocuments.length === 0 ? (
              <Card>
                <CardContent className="p-10 text-center">
                  <FolderOpen className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
                  <p className="font-medium">Nenhum documento encontrado para os filtros atuais.</p>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-0 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/40">
                        <th className="text-left p-4">Arquivo</th>
                        <th className="text-left p-4 hidden md:table-cell">Categoria</th>
                        <th className="text-left p-4 hidden md:table-cell">Data</th>
                        <th className="text-left p-4">Status</th>
                        <th className="text-right p-4">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {filteredDocuments.map((document) => {
                        const canDelete = !document.processed_at;
                        return (
                          <tr key={document.id} className="hover:bg-muted/20">
                            <td className="p-4">
                              <div className="flex items-center gap-2 min-w-0">
                                <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                                <div className="min-w-0">
                                  <p className="font-medium truncate max-w-[240px]">{document.file_name}</p>
                                  {document.request_id && (
                                    <Badge variant="outline" className="text-[10px] mt-1">Vinculado a solicitação</Badge>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="p-4 hidden md:table-cell text-muted-foreground">{document.category}</td>
                            <td className="p-4 hidden md:table-cell text-muted-foreground">
                              {new Date(document.created_at).toLocaleDateString("pt-BR")}
                            </td>
                            <td className="p-4">
                              {document.processed_at ? (
                                <Badge variant="outline" className="text-[10px] border-primary/40 text-primary">Processado</Badge>
                              ) : (
                                <Badge variant="secondary" className="text-[10px]">Recebido</Badge>
                              )}
                            </td>
                            <td className="p-4">
                              <div className="flex items-center justify-end gap-1">
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => void handleDownloadDocument(document)}>
                                  <Download className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive"
                                  disabled={!canDelete}
                                  title={canDelete ? "Excluir arquivo" : "Arquivo já processado e bloqueado para exclusão"}
                                  onClick={() => void handleDeleteDocument(document)}
                                >
                                  <X className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="forms" className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Formulários do portal</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Preencha e envie. O conteúdo estruturado vai para o time interno junto da solicitação.
                </p>
              </CardHeader>
            </Card>

            {selectedFormTemplate ? (
              <Card>
                <CardContent className="p-6 space-y-4 max-w-3xl">
                  <div className="flex items-start gap-3">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => {
                        setSelectedFormTemplate(null);
                        setFormValues({});
                      }}
                    >
                      <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div>
                      <h3 className="font-semibold">{selectedFormTemplate.title}</h3>
                      <p className="text-sm text-muted-foreground">{selectedFormTemplate.description || "Sem descrição"}</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {selectedFormTemplate.fields.map((field) => (
                      <div key={field.name} className="space-y-1.5">
                        <label className="text-sm font-medium">
                          {field.label}
                          {field.required && <span className="text-destructive ml-1">*</span>}
                        </label>
                        {field.type === "select" ? (
                          <Select value={formValues[field.name] || ""} onValueChange={(value) => handleFormValueChange(field.name, value)}>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione..." />
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
                            rows={4}
                            value={formValues[field.name] || ""}
                            onChange={(event) => handleFormValueChange(field.name, event.target.value)}
                            placeholder={field.placeholder}
                          />
                        ) : (
                          <Input
                            type={field.type === "date" ? "date" : field.type === "email" ? "email" : "text"}
                            value={formValues[field.name] || ""}
                            onChange={(event) => handleFormValueChange(field.name, event.target.value)}
                            placeholder={field.placeholder}
                          />
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setSelectedFormTemplate(null);
                        setFormValues({});
                      }}
                    >
                      Cancelar
                    </Button>
                    <Button type="button" onClick={() => void handleSubmitPortalForm()} disabled={submittingForm}>
                      {submittingForm ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enviar formulário"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : publishedForms.length === 0 ? (
              <Card>
                <CardContent className="p-10 text-center">
                  <FileText className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
                  <p className="font-medium">Nenhum formulário publicado no momento.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {publishedForms.map((template) => (
                  <button
                    type="button"
                    key={template.id}
                    className="text-left rounded-xl border bg-card p-4 hover:shadow-md transition-shadow"
                    onClick={() => openFormTemplate(template)}
                  >
                    <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-3">
                      <FileText className="h-4 w-4" />
                    </div>
                    <p className="font-medium">{template.title}</p>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{template.description || "Sem descrição"}</p>
                    <p className="text-xs text-muted-foreground mt-2">{template.fields.length} campo(s)</p>
                  </button>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="support" className="space-y-4">
            <ClientPortalSupport
              requests={requests}
              messages={messages}
              selectedRequestId={selectedSupportRequestId}
              statusConfig={statusConfig}
              sectors={supportSectors}
              onOpenRequestWithSector={(sector) => {
                openNewRequestDialog({
                  sector,
                  title: `Atendimento ${sector}`,
                  description: "Explique aqui sua necessidade para que a equipe possa agir rapidamente.",
                });
              }}
              onSelectRequest={setSelectedSupportRequestId}
            />
          </TabsContent>
        </Tabs>
      </main>

      <Dialog
        open={newRequestOpen}
        onOpenChange={(open) => {
          setNewRequestOpen(open);
          if (!open) resetNewRequestForm();
        }}
      >
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nova solicitacao</DialogTitle>
            <DialogDescription>
              Sua solicitacao sera direcionada ao setor responsavel.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Tipo da solicitacao</label>
              <Select value={newRequestType} onValueChange={handleRequestTypeChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {portalRequestTemplates.map((template) => (
                    <SelectItem key={template.key} value={template.key}>
                      {template.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{selectedTemplateDefinition.description}</p>
              <div className="rounded-lg border bg-muted/30 p-2">
                <p className="text-xs font-medium">Exemplos rapidos:</p>
                <ul className="mt-1 space-y-1 text-xs text-muted-foreground">
                  {selectedTemplateDefinition.examples.map((example) => (
                    <li key={example}>• {example}</li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Titulo</label>
                <Input
                  value={newRequestTitle}
                  onChange={(event) => setNewRequestTitle(event.target.value)}
                  placeholder="Ex.: Conferencia de impostos do mes"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Setor responsavel</label>
                <Select value={newRequestSector} onValueChange={setNewRequestSector}>
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
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Descreva a necessidade</label>
              <Textarea
                rows={5}
                value={newRequestDescription}
                onChange={(event) => setNewRequestDescription(event.target.value)}
                placeholder="Descreva o contexto e, se puder, informe prazo ou urgencia."
              />
            </div>

            <Separator />

            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium">Arquivos no mesmo envio</p>
                <Button type="button" variant="outline" size="sm" onClick={() => requestFilesInputRef.current?.click()}>
                  <Paperclip className="h-4 w-4 mr-1" /> Anexar arquivos
                </Button>
              </div>
              <input
                ref={requestFilesInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={handleRequestFileSelection}
              />
              {newRequestFiles.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nenhum arquivo selecionado.</p>
              ) : (
                <div className="space-y-2">
                  {newRequestFiles.map((file, index) => (
                    <div key={`${file.name}-${index}`} className="flex items-center justify-between rounded-md border px-3 py-2">
                      <div className="min-w-0">
                        <p className="text-sm truncate">{file.name}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {(file.size / 1024).toFixed(1)} KB
                        </p>
                      </div>
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeRequestFile(index)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setNewRequestOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" className="gap-2" onClick={() => void handleCreateRequest()} disabled={creatingRequest}>
              {creatingRequest ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Enviar solicitacao
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Enviar documentos</DialogTitle>
            <DialogDescription>Envie seus documentos de forma rapida e organizada.</DialogDescription>
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
              <label className="text-sm font-medium">Vincular a solicitacao (opcional)</label>
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
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium">Arquivos</p>
                <Button type="button" variant="outline" size="sm" onClick={() => uploadFilesInputRef.current?.click()}>
                  <Upload className="h-4 w-4 mr-1" /> Selecionar arquivos
                </Button>
              </div>
              <input
                ref={uploadFilesInputRef}
                type="file"
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

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setUploadDialogOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" className="gap-2" onClick={() => void handleUploadDocuments()} disabled={uploadingFiles}>
              {uploadingFiles ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Enviar arquivos
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet open={requestDetailOpen} onOpenChange={setRequestDetailOpen}>
        <SheetContent className="sm:max-w-2xl overflow-y-auto">
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
                      <p className="text-sm font-medium">Resumo da solicitacao</p>
                      <p className="text-sm text-muted-foreground">
                        {selectedRequest.description || "Sem descricao informada."}
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
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-medium">Conversa com a equipe</h4>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setRequestDetailOpen(false);
                          setUploadRequestId(selectedRequest.id);
                          setUploadDialogOpen(true);
                        }}
                      >
                        <Upload className="h-3.5 w-3.5 mr-1" />
                        Enviar documento para esta solicitacao
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
                          <div key={document.id} className="flex items-center justify-between rounded-lg border px-3 py-2">
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
    </div>
  );
}
