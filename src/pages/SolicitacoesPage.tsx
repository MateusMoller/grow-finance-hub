import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Clock,
  Download,
  FileText,
  Filter,
  FolderOpen,
  Headset,
  Loader2,
  MessageSquare,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  User,
  X,
} from "lucide-react";
import { AppLayout } from "@/components/app/AppLayout";
import { RequestChat } from "@/components/app/RequestChat";
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
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

type RequestStatus = Database["public"]["Enums"]["request_status"];
type RequestRow = Database["public"]["Tables"]["client_requests"]["Row"];
type RequestMessageRow = Database["public"]["Tables"]["request_messages"]["Row"];
type ClientRow = Database["public"]["Tables"]["clients"]["Row"];
type DocumentRow = Database["public"]["Tables"]["client_documents"]["Row"];
type PortalTaskRow = Database["public"]["Tables"]["client_portal_tasks"]["Row"];
type FormSubmissionRow = Database["public"]["Tables"]["form_submissions"]["Row"];
type Json = Database["public"]["Tables"]["form_submissions"]["Row"]["data"];

type PortalTab = "requests" | "tasks" | "forms";
type TaskStatus = "pending_client" | "in_analysis" | "completed" | "cancelled";
type TaskType = "document" | "request_return" | "operational" | "deadline" | "other";
type WaitingSide = "cliente" | "equipe" | "analise" | "concluido" | "cancelado";

type ProfileSummary = Pick<Database["public"]["Tables"]["profiles"]["Row"], "user_id" | "display_name">;
type ClientSummary = Pick<ClientRow, "id" | "name" | "contact" | "email" | "portal_user_id">;
type DocumentSummary = Pick<DocumentRow, "id" | "request_id" | "file_name" | "file_path" | "category" | "created_at" | "processed_at">;
type RequestSummary = Pick<RequestRow, "id" | "title" | "status" | "sector" | "user_id">;

interface EnrichedClientRequest extends RequestRow {
  profileName: string | null;
  client: ClientSummary | null;
  documents: DocumentSummary[];
  lastMessage: RequestMessageRow | null;
  waitingSide: WaitingSide;
}

interface PortalTaskView extends PortalTaskRow {
  client: ClientSummary | null;
  request: RequestSummary | null;
}

interface FormSubmissionView extends FormSubmissionRow {
  client: ClientSummary | null;
  request: RequestSummary | null;
}

interface TaskDraft {
  clientId: string;
  requestId: string;
  title: string;
  description: string;
  type: TaskType;
  status: TaskStatus;
  dueDate: string;
  sector: string;
}

const statusConfig: Record<RequestStatus, { label: string; icon: typeof Clock; className: string }> = {
  pending: {
    label: "Pendente",
    icon: Clock,
    className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  },
  in_progress: {
    label: "Em andamento",
    icon: AlertCircle,
    className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  },
  completed: {
    label: "Concluida",
    icon: CheckCircle2,
    className: "bg-primary/10 text-primary",
  },
  cancelled: {
    label: "Cancelada",
    icon: X,
    className: "bg-destructive/10 text-destructive",
  },
};

const waitingConfig: Record<WaitingSide, { label: string; className: string }> = {
  cliente: {
    label: "Aguardando cliente",
    className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  },
  equipe: {
    label: "Aguardando equipe",
    className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  },
  analise: {
    label: "Em analise",
    className: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300",
  },
  concluido: {
    label: "Concluido",
    className: "bg-primary/10 text-primary",
  },
  cancelado: {
    label: "Cancelado",
    className: "bg-destructive/10 text-destructive",
  },
};

const taskStatusConfig: Record<TaskStatus, { label: string; className: string }> = {
  pending_client: { label: "Aguardando cliente", className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" },
  in_analysis: { label: "Em analise", className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
  completed: { label: "Concluida", className: "bg-primary/10 text-primary" },
  cancelled: { label: "Cancelada", className: "bg-destructive/10 text-destructive" },
};

const taskTypeLabel: Record<TaskType, string> = {
  document: "Documento",
  request_return: "Retorno de solicitacao",
  operational: "Operacional",
  deadline: "Prazo",
  other: "Outro",
};

const taskTypeOptions: TaskType[] = ["document", "request_return", "operational", "deadline", "other"];
const taskStatusOptions: TaskStatus[] = ["pending_client", "in_analysis", "completed", "cancelled"];
const submissionStatusOptions = ["pending", "in_review", "completed"];

const sectorOptions = [
  "Contabil",
  "Fiscal",
  "Departamento Pessoal",
  "Financeiro",
  "Comercial",
  "Societario",
  "Geral",
];

const createEmptyTaskDraft = (): TaskDraft => ({
  clientId: "",
  requestId: "none",
  title: "",
  description: "",
  type: "operational",
  status: "pending_client",
  dueDate: "",
  sector: "Geral",
});

const deriveWaitingSide = (status: RequestStatus, lastMessage: RequestMessageRow | null): WaitingSide => {
  if (status === "completed") return "concluido";
  if (status === "cancelled") return "cancelado";
  if (status === "in_progress") return "analise";
  if (lastMessage?.is_from_team) return "cliente";
  return "equipe";
};

const mapClientByUserId = (clients: ClientSummary[]) =>
  new Map(
    clients
      .filter((client) => Boolean(client.portal_user_id))
      .map((client) => [client.portal_user_id as string, client])
  );

const parseSubmissionEntries = (data: Json): Array<{ key: string; value: string }> => {
  if (!data || typeof data !== "object" || Array.isArray(data)) return [];
  const source = data as Record<string, unknown>;
  return Object.entries(source).map(([key, value]) => {
    if (value === null || value === undefined) return { key, value: "-" };
    if (typeof value === "string") return { key, value };
    if (typeof value === "number" || typeof value === "boolean") return { key, value: String(value) };
    return { key, value: JSON.stringify(value) };
  });
};

export default function SolicitacoesPage() {
  const { user, role } = useAuth();

  const [activeTab, setActiveTab] = useState<PortalTab>("requests");

  const [clients, setClients] = useState<ClientSummary[]>([]);
  const [requests, setRequests] = useState<EnrichedClientRequest[]>([]);
  const [tasks, setTasks] = useState<PortalTaskView[]>([]);
  const [submissions, setSubmissions] = useState<FormSubmissionView[]>([]);

  const [loadingRequests, setLoadingRequests] = useState(true);
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [loadingSubmissions, setLoadingSubmissions] = useState(true);
  const [loadingClients, setLoadingClients] = useState(true);

  const [requestSearch, setRequestSearch] = useState("");
  const [requestStatusFilter, setRequestStatusFilter] = useState<string>("all");

  const [taskSearch, setTaskSearch] = useState("");
  const [taskStatusFilter, setTaskStatusFilter] = useState<string>("all");
  const [taskTypeFilter, setTaskTypeFilter] = useState<string>("all");

  const [submissionSearch, setSubmissionSearch] = useState("");
  const [submissionStatusFilter, setSubmissionStatusFilter] = useState<string>("all");

  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [updatingRequestStatus, setUpdatingRequestStatus] = useState(false);
  const [updatingDocumentId, setUpdatingDocumentId] = useState<string | null>(null);

  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [taskDraft, setTaskDraft] = useState<TaskDraft>(createEmptyTaskDraft());
  const [creatingTask, setCreatingTask] = useState(false);
  const [changingTaskId, setChangingTaskId] = useState<string | null>(null);
  const [deletingTaskId, setDeletingTaskId] = useState<string | null>(null);

  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string | null>(null);
  const [submissionSheetOpen, setSubmissionSheetOpen] = useState(false);
  const [submissionNotes, setSubmissionNotes] = useState("");
  const [savingSubmissionStatusId, setSavingSubmissionStatusId] = useState<string | null>(null);
  const [savingSubmissionNotes, setSavingSubmissionNotes] = useState(false);
  const fetchClients = useCallback(async () => {
    setLoadingClients(true);
    const { data, error } = await supabase
      .from("clients")
      .select("id, name, contact, email, portal_user_id")
      .order("name", { ascending: true });

    if (error) {
      toast.error("Erro ao carregar clientes.");
      setLoadingClients(false);
      return;
    }

    setClients((data || []) as ClientSummary[]);
    setLoadingClients(false);
  }, []);

  const fetchRequests = useCallback(async () => {
    setLoadingRequests(true);

    const { data: requestData, error: requestError } = await supabase
      .from("client_requests")
      .select("id, title, description, category, sector, status, admin_notes, created_at, updated_at, user_id")
      .order("created_at", { ascending: false });

    if (requestError) {
      toast.error("Erro ao carregar solicitacoes.");
      setLoadingRequests(false);
      return;
    }

    const requestRows = (requestData || []) as RequestRow[];
    const requestIds = requestRows.map((request) => request.id);
    const userIds = [...new Set(requestRows.map((request) => request.user_id))];

    let profilesData: ProfileSummary[] = [];
    if (userIds.length > 0) {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .in("user_id", userIds);
      if (!error) profilesData = (data || []) as ProfileSummary[];
    }

    let clientsData: ClientSummary[] = [];
    if (userIds.length > 0) {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name, contact, email, portal_user_id")
        .in("portal_user_id", userIds);
      if (!error) clientsData = (data || []) as ClientSummary[];
    }

    let documentsData: DocumentSummary[] = [];
    if (requestIds.length > 0) {
      const { data, error } = await supabase
        .from("client_documents")
        .select("id, request_id, file_name, file_path, category, created_at, processed_at")
        .in("request_id", requestIds)
        .order("created_at", { ascending: false });
      if (!error) documentsData = (data || []) as DocumentSummary[];
    }

    let messagesData: RequestMessageRow[] = [];
    if (requestIds.length > 0) {
      const { data, error } = await supabase
        .from("request_messages")
        .select("id, request_id, user_id, content, is_from_team, created_at")
        .in("request_id", requestIds)
        .order("created_at", { ascending: false });
      if (!error) messagesData = (data || []) as RequestMessageRow[];
    }

    const profileMap = new Map(profilesData.map((profile) => [profile.user_id, profile]));
    const clientMap = mapClientByUserId(clientsData);

    const documentMap = new Map<string, DocumentSummary[]>();
    documentsData.forEach((document) => {
      if (!document.request_id) return;
      const current = documentMap.get(document.request_id) || [];
      current.push(document);
      documentMap.set(document.request_id, current);
    });

    const lastMessageMap = new Map<string, RequestMessageRow>();
    messagesData.forEach((message) => {
      if (!lastMessageMap.has(message.request_id)) {
        lastMessageMap.set(message.request_id, message);
      }
    });

    const enriched: EnrichedClientRequest[] = requestRows.map((request) => {
      const lastMessage = lastMessageMap.get(request.id) || null;
      const documents = documentMap.get(request.id) || [];
      return {
        ...request,
        profileName: profileMap.get(request.user_id)?.display_name || null,
        client: clientMap.get(request.user_id) || null,
        documents,
        lastMessage,
        waitingSide: deriveWaitingSide(request.status, lastMessage),
      };
    });

    setRequests(enriched);
    setLoadingRequests(false);
  }, []);

  const fetchTasks = useCallback(async () => {
    setLoadingTasks(true);
    const { data, error } = await supabase
      .from("client_portal_tasks")
      .select("id, client_id, title, description, type, status, due_date, sector, request_id, created_by, created_at, updated_at")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Erro ao carregar pendencias do portal.");
      setLoadingTasks(false);
      return;
    }

    const rows = (data || []) as PortalTaskRow[];
    const clientIds = [...new Set(rows.map((row) => row.client_id))];
    const requestIds = [...new Set(rows.map((row) => row.request_id).filter(Boolean) as string[])];

    let clientsData: ClientSummary[] = [];
    if (clientIds.length > 0) {
      const { data: clientsRows, error: clientsError } = await supabase
        .from("clients")
        .select("id, name, contact, email, portal_user_id")
        .in("id", clientIds);
      if (!clientsError) clientsData = (clientsRows || []) as ClientSummary[];
    }

    let requestsData: RequestSummary[] = [];
    if (requestIds.length > 0) {
      const { data: requestRows, error: requestError } = await supabase
        .from("client_requests")
        .select("id, title, status, sector, user_id")
        .in("id", requestIds);
      if (!requestError) requestsData = (requestRows || []) as RequestSummary[];
    }

    const clientMap = new Map(clientsData.map((client) => [client.id, client]));
    const requestMap = new Map(requestsData.map((request) => [request.id, request]));

    const mapped: PortalTaskView[] = rows.map((row) => ({
      ...row,
      client: clientMap.get(row.client_id) || null,
      request: row.request_id ? requestMap.get(row.request_id) || null : null,
    }));

    setTasks(mapped);
    setLoadingTasks(false);
  }, []);

  const fetchSubmissions = useCallback(async () => {
    setLoadingSubmissions(true);
    const { data, error } = await supabase
      .from("form_submissions")
      .select("id, template_id, template_title, submitted_by, submitted_by_name, data, status, notes, client_id, request_id, created_at, updated_at")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Erro ao carregar formularios recebidos.");
      setLoadingSubmissions(false);
      return;
    }

    const rows = (data || []) as FormSubmissionRow[];
    const clientIds = [...new Set(rows.map((row) => row.client_id).filter(Boolean) as string[])];
    const requestIds = [...new Set(rows.map((row) => row.request_id).filter(Boolean) as string[])];

    let clientsData: ClientSummary[] = [];
    if (clientIds.length > 0) {
      const { data: clientsRows, error: clientsError } = await supabase
        .from("clients")
        .select("id, name, contact, email, portal_user_id")
        .in("id", clientIds);
      if (!clientsError) clientsData = (clientsRows || []) as ClientSummary[];
    }

    let requestsData: RequestSummary[] = [];
    if (requestIds.length > 0) {
      const { data: requestRows, error: requestError } = await supabase
        .from("client_requests")
        .select("id, title, status, sector, user_id")
        .in("id", requestIds);
      if (!requestError) requestsData = (requestRows || []) as RequestSummary[];
    }

    const clientMap = new Map(clientsData.map((client) => [client.id, client]));
    const requestMap = new Map(requestsData.map((request) => [request.id, request]));

    const mapped: FormSubmissionView[] = rows.map((row) => ({
      ...row,
      client: row.client_id ? clientMap.get(row.client_id) || null : null,
      request: row.request_id ? requestMap.get(row.request_id) || null : null,
    }));

    setSubmissions(mapped);
    setLoadingSubmissions(false);
  }, []);

  useEffect(() => {
    void Promise.all([fetchClients(), fetchRequests(), fetchTasks(), fetchSubmissions()]);
  }, [fetchClients, fetchRequests, fetchTasks, fetchSubmissions]);

  const selectedRequest = useMemo(
    () => requests.find((request) => request.id === selectedRequestId) || null,
    [requests, selectedRequestId]
  );

  const selectedSubmission = useMemo(
    () => submissions.find((submission) => submission.id === selectedSubmissionId) || null,
    [selectedSubmissionId, submissions]
  );

  useEffect(() => {
    setSubmissionNotes(selectedSubmission?.notes || "");
  }, [selectedSubmission]);

  const filteredRequests = useMemo(() => {
    const term = requestSearch.trim().toLowerCase();
    return requests.filter((request) => {
      if (requestStatusFilter !== "all" && request.status !== requestStatusFilter) return false;
      if (!term) return true;
      const source = [
        request.title,
        request.description || "",
        request.category,
        request.sector,
        request.profileName || "",
        request.client?.name || "",
        request.client?.contact || "",
        request.client?.email || "",
      ]
        .join(" ")
        .toLowerCase();
      return source.includes(term);
    });
  }, [requestSearch, requestStatusFilter, requests]);

  const filteredTasks = useMemo(() => {
    const term = taskSearch.trim().toLowerCase();
    return tasks.filter((task) => {
      if (taskStatusFilter !== "all" && task.status !== taskStatusFilter) return false;
      if (taskTypeFilter !== "all" && task.type !== taskTypeFilter) return false;
      if (!term) return true;
      const source = [
        task.title,
        task.description || "",
        task.client?.name || "",
        task.request?.title || "",
        task.sector,
        task.type,
      ]
        .join(" ")
        .toLowerCase();
      return source.includes(term);
    });
  }, [taskSearch, taskStatusFilter, taskTypeFilter, tasks]);

  const filteredSubmissions = useMemo(() => {
    const term = submissionSearch.trim().toLowerCase();
    return submissions.filter((submission) => {
      if (submissionStatusFilter !== "all" && (submission.status || "pending") !== submissionStatusFilter) return false;
      if (!term) return true;
      const source = [
        submission.template_title,
        submission.submitted_by_name || "",
        submission.client?.name || "",
        submission.request?.title || "",
      ]
        .join(" ")
        .toLowerCase();
      return source.includes(term);
    });
  }, [submissionSearch, submissionStatusFilter, submissions]);

  const requestStats = useMemo(() => {
    const awaitingClient = requests.filter((request) => request.waitingSide === "cliente").length;
    const awaitingTeam = requests.filter((request) => request.waitingSide === "equipe").length;
    const inAnalysis = requests.filter((request) => request.waitingSide === "analise").length;
    const withDocuments = requests.filter((request) => request.documents.length > 0).length;
    return {
      total: requests.length,
      awaitingClient,
      awaitingTeam,
      inAnalysis,
      withDocuments,
    };
  }, [requests]);

  const taskStats = useMemo(
    () => ({
      total: tasks.length,
      pendingClient: tasks.filter((task) => task.status === "pending_client").length,
      inAnalysis: tasks.filter((task) => task.status === "in_analysis").length,
      completed: tasks.filter((task) => task.status === "completed").length,
    }),
    [tasks]
  );

  const submissionStats = useMemo(
    () => ({
      total: submissions.length,
      pending: submissions.filter((submission) => (submission.status || "pending") === "pending").length,
      inReview: submissions.filter((submission) => (submission.status || "pending") === "in_review").length,
      completed: submissions.filter((submission) => (submission.status || "pending") === "completed").length,
    }),
    [submissions]
  );

  const requestOptionsForTaskClient = useMemo(() => {
    if (!taskDraft.clientId) return [];
    return requests
      .filter((request) => request.client?.id === taskDraft.clientId)
      .map((request) => ({ id: request.id, title: request.title }));
  }, [requests, taskDraft.clientId]);

  const openRequestDetail = (requestId: string) => {
    setActiveTab("requests");
    setSelectedRequestId(requestId);
    setDetailOpen(true);
  };

  const openTaskDialogForRequest = (request: EnrichedClientRequest) => {
    if (!request.client?.id) {
      toast.error("Esta solicitacao nao possui cliente vinculado para criar pendencia.");
      return;
    }

    setTaskDraft({
      clientId: request.client.id,
      requestId: request.id,
      title: `Retorno necessario: ${request.title}`,
      description: "Detalhe aqui o que o cliente precisa enviar ou responder para continuarmos.",
      type: "request_return",
      status: "pending_client",
      dueDate: "",
      sector: request.sector || "Geral",
    });
    setTaskDialogOpen(true);
  };

  const resetTaskDialog = () => {
    setTaskDraft(createEmptyTaskDraft());
    setTaskDialogOpen(false);
  };

  const handleCreateTask = async () => {
    if (!user) return;
    if (!taskDraft.clientId) {
      toast.error("Selecione o cliente da pendencia.");
      return;
    }
    if (!taskDraft.title.trim()) {
      toast.error("Informe o titulo da pendencia.");
      return;
    }

    setCreatingTask(true);
    const { error } = await supabase.from("client_portal_tasks").insert({
      client_id: taskDraft.clientId,
      request_id: taskDraft.requestId !== "none" ? taskDraft.requestId : null,
      title: taskDraft.title.trim(),
      description: taskDraft.description.trim() || null,
      type: taskDraft.type,
      status: taskDraft.status,
      due_date: taskDraft.dueDate || null,
      sector: taskDraft.sector,
      created_by: user.id,
    });
    setCreatingTask(false);

    if (error) {
      toast.error("Erro ao criar pendencia do portal.");
      return;
    }

    toast.success("Pendencia publicada para o cliente.");
    resetTaskDialog();
    await fetchTasks();
  };

  const handleTaskStatusChange = async (task: PortalTaskView, status: TaskStatus) => {
    setChangingTaskId(task.id);
    const { error } = await supabase
      .from("client_portal_tasks")
      .update({ status })
      .eq("id", task.id);
    setChangingTaskId(null);

    if (error) {
      toast.error("Nao foi possivel atualizar o status da pendencia.");
      return;
    }

    setTasks((previous) =>
      previous.map((item) => (item.id === task.id ? { ...item, status } : item))
    );
  };

  const handleDeleteTask = async (taskId: string) => {
    const confirmed = window.confirm("Deseja excluir esta pendencia do portal?");
    if (!confirmed) return;

    setDeletingTaskId(taskId);
    const { error } = await supabase.from("client_portal_tasks").delete().eq("id", taskId);
    setDeletingTaskId(null);

    if (error) {
      toast.error("Erro ao excluir pendencia.");
      return;
    }

    setTasks((previous) => previous.filter((task) => task.id !== taskId));
    toast.success("Pendencia removida.");
  };

  const handleRequestStatusChange = async (requestId: string, newStatus: RequestStatus) => {
    setUpdatingRequestStatus(true);
    const { error } = await supabase
      .from("client_requests")
      .update({ status: newStatus })
      .eq("id", requestId);
    setUpdatingRequestStatus(false);

    if (error) {
      toast.error("Erro ao atualizar status da solicitacao.");
      return;
    }

    setRequests((previous) =>
      previous.map((request) =>
        request.id === requestId
          ? { ...request, status: newStatus, waitingSide: deriveWaitingSide(newStatus, request.lastMessage) }
          : request
      )
    );
    toast.success("Status da solicitacao atualizado.");
  };

  const handleDownloadDocument = async (document: DocumentSummary) => {
    const { data, error } = await supabase.storage
      .from("client-documents")
      .createSignedUrl(document.file_path, 120);
    if (error || !data?.signedUrl) {
      toast.error("Nao foi possivel gerar o link de download.");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  const handleToggleDocumentProcessed = async (document: DocumentSummary, processed: boolean) => {
    if (!user) return;
    setUpdatingDocumentId(document.id);
    const { error } = await supabase
      .from("client_documents")
      .update({
        processed_at: processed ? new Date().toISOString() : null,
        processed_by: processed ? user.id : null,
      })
      .eq("id", document.id);
    setUpdatingDocumentId(null);

    if (error) {
      toast.error("Nao foi possivel atualizar o processamento do documento.");
      return;
    }

    setRequests((previous) =>
      previous.map((request) => ({
        ...request,
        documents: request.documents.map((item) =>
          item.id === document.id
            ? { ...item, processed_at: processed ? new Date().toISOString() : null }
            : item
        ),
      }))
    );
    toast.success(processed ? "Documento marcado como processado." : "Documento voltou para nao processado.");
  };

  const handleSubmissionStatusChange = async (submissionId: string, status: string) => {
    setSavingSubmissionStatusId(submissionId);
    const { error } = await supabase
      .from("form_submissions")
      .update({ status })
      .eq("id", submissionId);
    setSavingSubmissionStatusId(null);

    if (error) {
      toast.error("Erro ao atualizar status do formulario recebido.");
      return;
    }

    setSubmissions((previous) =>
      previous.map((submission) =>
        submission.id === submissionId ? { ...submission, status } : submission
      )
    );
    toast.success("Status do formulario atualizado.");
  };

  const handleSaveSubmissionNotes = async () => {
    if (!selectedSubmission) return;
    setSavingSubmissionNotes(true);
    const { error } = await supabase
      .from("form_submissions")
      .update({ notes: submissionNotes.trim() || null })
      .eq("id", selectedSubmission.id);
    setSavingSubmissionNotes(false);

    if (error) {
      toast.error("Erro ao salvar observacoes da submissao.");
      return;
    }

    setSubmissions((previous) =>
      previous.map((submission) =>
        submission.id === selectedSubmission.id
          ? { ...submission, notes: submissionNotes.trim() || null }
          : submission
      )
    );
    toast.success("Observacoes atualizadas.");
  };

  const openSubmissionSheet = (submission: FormSubmissionView) => {
    setSelectedSubmissionId(submission.id);
    setSubmissionSheetOpen(true);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl font-bold">Central de atendimento do portal</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Tudo que o cliente envia ou acompanha no portal esta centralizado aqui com fluxo operacional real.
          </p>
          {role && <p className="text-xs text-muted-foreground mt-1">Perfil interno: {role}</p>}
        </motion.div>

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as PortalTab)} className="space-y-4">
          <TabsList className="flex flex-wrap h-auto">
            <TabsTrigger value="requests">Solicitacoes e chat</TabsTrigger>
            <TabsTrigger value="tasks">Pendencias do portal</TabsTrigger>
            <TabsTrigger value="forms">Formularios recebidos</TabsTrigger>
          </TabsList>

          <TabsContent value="requests" className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
              {[
                { label: "Total", value: requestStats.total, icon: MessageSquare },
                { label: "Aguardando cliente", value: requestStats.awaitingClient, icon: Clock, color: "text-amber-600" },
                { label: "Aguardando equipe", value: requestStats.awaitingTeam, icon: Headset, color: "text-blue-600" },
                { label: "Em analise", value: requestStats.inAnalysis, icon: AlertCircle, color: "text-violet-600" },
                { label: "Com anexos", value: requestStats.withDocuments, icon: FolderOpen, color: "text-primary" },
              ].map((item, index) => (
                <motion.div
                  key={item.label}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03 }}
                  className="rounded-xl border bg-card p-4"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <item.icon className={`h-4 w-4 ${item.color || "text-foreground"}`} />
                    <span className="text-xs text-muted-foreground">{item.label}</span>
                  </div>
                  <p className="text-2xl font-semibold">{item.value}</p>
                </motion.div>
              ))}
            </div>

            <Card>
              <CardContent className="p-4 grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_220px] gap-3">
                <div className="flex items-center gap-2 rounded-lg border px-3 py-2">
                  <Search className="h-4 w-4 text-muted-foreground" />
                  <input
                    className="bg-transparent text-sm outline-none w-full placeholder:text-muted-foreground"
                    placeholder="Buscar por titulo, cliente, setor ou empresa..."
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
                    <SelectItem value="completed">Concluidas</SelectItem>
                    <SelectItem value="cancelled">Canceladas</SelectItem>
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            {loadingRequests ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : filteredRequests.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <MessageSquare className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                  <p className="font-medium">Nenhuma solicitacao encontrada.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {filteredRequests.map((request, index) => {
                  const statusMeta = statusConfig[request.status];
                  const waitingMeta = waitingConfig[request.waitingSide];
                  const StatusIcon = statusMeta.icon;

                  return (
                    <motion.button
                      type="button"
                      key={request.id}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.02 }}
                      className="w-full text-left rounded-xl border bg-card p-4 hover:shadow-md transition-shadow"
                      onClick={() => {
                        setSelectedRequestId(request.id);
                        setDetailOpen(true);
                      }}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-medium truncate">{request.title}</p>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mt-1">
                            <span className="inline-flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {request.client?.name || request.profileName || "Cliente sem cadastro"}
                            </span>
                            <span>•</span>
                            <span>{request.sector}</span>
                            <span>•</span>
                            <span>{request.category}</span>
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
                      </div>

                      <div className="flex flex-wrap items-center gap-2 mt-3">
                        <Badge variant="outline" className={`border-0 ${statusMeta.className}`}>
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {statusMeta.label}
                        </Badge>
                        <Badge variant="outline" className={`border-0 ${waitingMeta.className}`}>
                          {waitingMeta.label}
                        </Badge>
                        <Badge variant="secondary" className="text-[10px]">
                          {request.documents.length} documento(s)
                        </Badge>
                        <Badge variant="outline" className="text-[10px]">
                          Ultima interacao:{" "}
                          {request.lastMessage
                            ? new Date(request.lastMessage.created_at).toLocaleDateString("pt-BR")
                            : "sem mensagens"}
                        </Badge>
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="tasks" className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
              {[
                { label: "Pendencias totais", value: taskStats.total, icon: MessageSquare },
                { label: "Aguardando cliente", value: taskStats.pendingClient, icon: Clock, color: "text-amber-600" },
                { label: "Em analise", value: taskStats.inAnalysis, icon: AlertCircle, color: "text-blue-600" },
                { label: "Concluidas", value: taskStats.completed, icon: ShieldCheck, color: "text-primary" },
              ].map((item) => (
                <Card key={item.label}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <item.icon className={`h-4 w-4 ${item.color || "text-foreground"}`} />
                      <span className="text-xs text-muted-foreground">{item.label}</span>
                    </div>
                    <p className="text-2xl font-semibold">{item.value}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_220px_220px] gap-3">
                  <div className="flex items-center gap-2 rounded-lg border px-3 py-2">
                    <Search className="h-4 w-4 text-muted-foreground" />
                    <input
                      className="bg-transparent text-sm outline-none w-full placeholder:text-muted-foreground"
                      placeholder="Buscar pendencia por cliente, titulo ou solicitacao..."
                      value={taskSearch}
                      onChange={(event) => setTaskSearch(event.target.value)}
                    />
                  </div>
                  <Select value={taskStatusFilter} onValueChange={setTaskStatusFilter}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os status</SelectItem>
                      {taskStatusOptions.map((status) => (
                        <SelectItem key={status} value={status}>
                          {taskStatusConfig[status].label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={taskTypeFilter} onValueChange={setTaskTypeFilter}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os tipos</SelectItem>
                      {taskTypeOptions.map((type) => (
                        <SelectItem key={type} value={type}>
                          {taskTypeLabel[type]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex justify-end">
                  <Button
                    className="gap-2"
                    onClick={() => {
                      setTaskDraft(createEmptyTaskDraft());
                      setTaskDialogOpen(true);
                    }}
                    disabled={loadingClients}
                  >
                    <Plus className="h-4 w-4" />
                    Nova pendencia para cliente
                  </Button>
                </div>
              </CardContent>
            </Card>

            {loadingTasks ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : filteredTasks.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <FileText className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                  <p className="font-medium">Nenhuma pendencia encontrada.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {filteredTasks.map((task) => (
                  <Card key={task.id}>
                    <CardContent className="p-4 space-y-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium">{task.title}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {task.client?.name || "Cliente nao encontrado"} • {taskTypeLabel[(task.type as TaskType) || "other"]}
                          </p>
                        </div>
                        <Badge variant="outline" className={`border-0 ${taskStatusConfig[(task.status as TaskStatus) || "pending_client"]?.className || ""}`}>
                          {taskStatusConfig[(task.status as TaskStatus) || "pending_client"]?.label || task.status}
                        </Badge>
                      </div>

                      {task.description && <p className="text-sm text-muted-foreground">{task.description}</p>}

                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span>Setor: {task.sector}</span>
                        {task.due_date && (
                          <>
                            <span>•</span>
                            <span>Prazo: {new Date(task.due_date).toLocaleDateString("pt-BR")}</span>
                          </>
                        )}
                        {task.request && (
                          <>
                            <span>•</span>
                            <button
                              type="button"
                              className="text-primary hover:underline"
                              onClick={() => openRequestDetail(task.request!.id)}
                            >
                              Solicitação vinculada: {task.request.title}
                            </button>
                          </>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="w-full sm:w-[240px]">
                          <Select
                            value={(task.status as TaskStatus) || "pending_client"}
                            onValueChange={(value) => void handleTaskStatusChange(task, value as TaskStatus)}
                            disabled={changingTaskId === task.id}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {taskStatusOptions.map((status) => (
                                <SelectItem key={status} value={status}>
                                  {taskStatusConfig[status].label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                          onClick={() => void handleDeleteTask(task.id)}
                          disabled={deletingTaskId === task.id}
                        >
                          {deletingTaskId === task.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <>
                              <Trash2 className="h-3.5 w-3.5 mr-1" />
                              Excluir
                            </>
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
          <TabsContent value="forms" className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
              {[
                { label: "Total recebido", value: submissionStats.total, icon: FileText },
                { label: "Pendentes", value: submissionStats.pending, icon: Clock, color: "text-amber-600" },
                { label: "Em revisao", value: submissionStats.inReview, icon: AlertCircle, color: "text-blue-600" },
                { label: "Concluidos", value: submissionStats.completed, icon: CheckCircle2, color: "text-primary" },
              ].map((item) => (
                <Card key={item.label}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <item.icon className={`h-4 w-4 ${item.color || "text-foreground"}`} />
                      <span className="text-xs text-muted-foreground">{item.label}</span>
                    </div>
                    <p className="text-2xl font-semibold">{item.value}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card>
              <CardContent className="p-4 grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_220px] gap-3">
                <div className="flex items-center gap-2 rounded-lg border px-3 py-2">
                  <Search className="h-4 w-4 text-muted-foreground" />
                  <input
                    className="bg-transparent text-sm outline-none w-full placeholder:text-muted-foreground"
                    placeholder="Buscar por formulario, cliente ou solicitacao..."
                    value={submissionSearch}
                    onChange={(event) => setSubmissionSearch(event.target.value)}
                  />
                </div>
                <Select value={submissionStatusFilter} onValueChange={setSubmissionStatusFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os status</SelectItem>
                    <SelectItem value="pending">Pendente</SelectItem>
                    <SelectItem value="in_review">Em revisao</SelectItem>
                    <SelectItem value="completed">Concluido</SelectItem>
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            {loadingSubmissions ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : filteredSubmissions.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <FileText className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                  <p className="font-medium">Nenhum formulario recebido.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {filteredSubmissions.map((submission) => (
                  <Card key={submission.id}>
                    <CardContent className="p-4 space-y-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="font-medium">{submission.template_title}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {submission.client?.name || "Cliente nao vinculado"} •{" "}
                            {submission.submitted_by_name || "Sem nome informado"}
                          </p>
                        </div>
                        <Badge variant="outline" className="border-primary/30 text-primary">
                          {submission.status || "pending"}
                        </Badge>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span>Enviado em {new Date(submission.created_at).toLocaleString("pt-BR")}</span>
                        {submission.request && (
                          <>
                            <span>•</span>
                            <button
                              type="button"
                              className="text-primary hover:underline"
                              onClick={() => openRequestDetail(submission.request!.id)}
                            >
                              Solicitação: {submission.request.title}
                            </button>
                          </>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="w-full sm:w-[220px]">
                          <Select
                            value={submission.status || "pending"}
                            onValueChange={(value) => void handleSubmissionStatusChange(submission.id, value)}
                            disabled={savingSubmissionStatusId === submission.id}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {submissionStatusOptions.map((status) => (
                                <SelectItem key={status} value={status}>
                                  {status}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <Button type="button" variant="outline" size="sm" onClick={() => openSubmissionSheet(submission)}>
                          Ver detalhes
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
          <SheetContent className="sm:max-w-2xl overflow-y-auto">
            {selectedRequest && (() => {
              const statusMeta = statusConfig[selectedRequest.status];
              const waitingMeta = waitingConfig[selectedRequest.waitingSide];
              const StatusIcon = statusMeta.icon;

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
                      <Badge variant="outline" className={`border-0 ${waitingMeta.className}`}>
                        {waitingMeta.label}
                      </Badge>
                      <Badge variant="secondary" className="text-[10px]">
                        Setor: {selectedRequest.sector}
                      </Badge>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={() => openTaskDialogForRequest(selectedRequest)}>
                        <Plus className="h-3.5 w-3.5 mr-1" />
                        Criar pendencia para cliente
                      </Button>
                    </div>

                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">Cliente e contexto</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2 text-sm">
                        <p>
                          <span className="text-muted-foreground">Empresa:</span>{" "}
                          {selectedRequest.client?.name || "Nao vinculada"}
                        </p>
                        <p>
                          <span className="text-muted-foreground">Contato:</span>{" "}
                          {selectedRequest.client?.contact || selectedRequest.profileName || "Nao informado"}
                        </p>
                        <p>
                          <span className="text-muted-foreground">Email:</span>{" "}
                          {selectedRequest.client?.email || "Nao informado"}
                        </p>
                        <p>
                          <span className="text-muted-foreground">Categoria:</span> {selectedRequest.category}
                        </p>
                      </CardContent>
                    </Card>

                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Alterar status</label>
                      <Select
                        value={selectedRequest.status}
                        onValueChange={(value) => void handleRequestStatusChange(selectedRequest.id, value as RequestStatus)}
                        disabled={updatingRequestStatus}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pendente</SelectItem>
                          <SelectItem value="in_progress">Em andamento</SelectItem>
                          <SelectItem value="completed">Concluida</SelectItem>
                          <SelectItem value="cancelled">Cancelada</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <h4 className="text-sm font-medium">Descricao</h4>
                      <p className="text-sm text-muted-foreground">
                        {selectedRequest.description || "Sem descricao informada."}
                      </p>
                    </div>

                    {selectedRequest.admin_notes && (
                      <div className="rounded-lg border bg-muted/40 p-3">
                        <p className="text-xs font-medium">Observacoes internas</p>
                        <p className="text-sm text-muted-foreground mt-1">{selectedRequest.admin_notes}</p>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="text-muted-foreground block">Criada em</span>
                        <span className="font-medium">
                          {new Date(selectedRequest.created_at).toLocaleString("pt-BR")}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block">Atualizada em</span>
                        <span className="font-medium">
                          {new Date(selectedRequest.updated_at).toLocaleString("pt-BR")}
                        </span>
                      </div>
                    </div>

                    <div className="rounded-lg border bg-muted/30 p-3 text-sm">
                      <p className="text-xs font-medium mb-1">Ultima interacao</p>
                      {selectedRequest.lastMessage ? (
                        <>
                          <p className="text-muted-foreground">
                            {selectedRequest.lastMessage.is_from_team ? "Equipe Grow" : "Cliente"}:{" "}
                            {selectedRequest.lastMessage.content}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(selectedRequest.lastMessage.created_at).toLocaleString("pt-BR")}
                          </p>
                        </>
                      ) : (
                        <p className="text-muted-foreground">Sem mensagens registradas.</p>
                      )}
                    </div>

                    <Separator />
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium">Documentos vinculados ({selectedRequest.documents.length})</h4>
                      {selectedRequest.documents.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Nenhum documento anexado nesta solicitacao.</p>
                      ) : (
                        <div className="space-y-2">
                          {selectedRequest.documents.map((document) => (
                            <div key={document.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2">
                              <div className="min-w-0">
                                <p className="text-sm font-medium truncate">{document.file_name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {document.category} • {new Date(document.created_at).toLocaleDateString("pt-BR")}
                                </p>
                              </div>
                              <div className="flex items-center gap-1">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => void handleDownloadDocument(document)}
                                >
                                  <Download className="h-4 w-4" />
                                </Button>
                                <Button
                                  type="button"
                                  variant={document.processed_at ? "secondary" : "outline"}
                                  size="sm"
                                  onClick={() => void handleToggleDocumentProcessed(document, !document.processed_at)}
                                  disabled={updatingDocumentId === document.id}
                                >
                                  {updatingDocumentId === document.id ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : document.processed_at ? (
                                    "Processado"
                                  ) : (
                                    "Marcar processado"
                                  )}
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div>
                      <h4 className="text-sm font-medium mb-2 flex items-center gap-1.5">
                        <Headset className="h-4 w-4" />
                        Conversa com o cliente
                      </h4>
                      <RequestChat requestId={selectedRequest.id} isTeamMember />
                    </div>
                  </div>
                </>
              );
            })()}
          </SheetContent>
        </Sheet>

        <Dialog open={taskDialogOpen} onOpenChange={setTaskDialogOpen}>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Nova pendencia do portal</DialogTitle>
              <DialogDescription>
                Esta pendencia aparecera para o cliente na aba de pendencias e na visao geral.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Cliente</label>
                  <Select
                    value={taskDraft.clientId || "none"}
                    onValueChange={(value) =>
                      setTaskDraft((previous) => ({
                        ...previous,
                        clientId: value === "none" ? "" : value,
                        requestId: "none",
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={loadingClients ? "Carregando clientes..." : "Selecione um cliente"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Selecione um cliente</SelectItem>
                      {clients.map((client) => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Solicitacao vinculada (opcional)</label>
                  <Select
                    value={taskDraft.requestId}
                    onValueChange={(value) => setTaskDraft((previous) => ({ ...previous, requestId: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nao vincular</SelectItem>
                      {requestOptionsForTaskClient.map((request) => (
                        <SelectItem key={request.id} value={request.id}>
                          {request.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">Titulo</label>
                <Input
                  value={taskDraft.title}
                  onChange={(event) => setTaskDraft((previous) => ({ ...previous, title: event.target.value }))}
                  placeholder="Ex: Enviar extrato bancario do mes"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">Descricao</label>
                <Textarea
                  rows={4}
                  value={taskDraft.description}
                  onChange={(event) => setTaskDraft((previous) => ({ ...previous, description: event.target.value }))}
                  placeholder="Explique com objetividade o que o cliente precisa enviar ou responder."
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Tipo</label>
                  <Select
                    value={taskDraft.type}
                    onValueChange={(value) => setTaskDraft((previous) => ({ ...previous, type: value as TaskType }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {taskTypeOptions.map((type) => (
                        <SelectItem key={type} value={type}>
                          {taskTypeLabel[type]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Status inicial</label>
                  <Select
                    value={taskDraft.status}
                    onValueChange={(value) => setTaskDraft((previous) => ({ ...previous, status: value as TaskStatus }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {taskStatusOptions.map((status) => (
                        <SelectItem key={status} value={status}>
                          {taskStatusConfig[status].label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Setor</label>
                  <Select
                    value={taskDraft.sector}
                    onValueChange={(value) => setTaskDraft((previous) => ({ ...previous, sector: value }))}
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
                  <label className="text-sm font-medium">Prazo</label>
                  <Input
                    type="date"
                    value={taskDraft.dueDate}
                    onChange={(event) => setTaskDraft((previous) => ({ ...previous, dueDate: event.target.value }))}
                  />
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={resetTaskDialog}>
                Cancelar
              </Button>
              <Button type="button" onClick={() => void handleCreateTask()} disabled={creatingTask}>
                {creatingTask ? <Loader2 className="h-4 w-4 animate-spin" /> : "Publicar pendencia"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Sheet open={submissionSheetOpen} onOpenChange={setSubmissionSheetOpen}>
          <SheetContent className="sm:max-w-2xl overflow-y-auto">
            {selectedSubmission && (
              <>
                <SheetHeader>
                  <SheetTitle className="text-left">{selectedSubmission.template_title}</SheetTitle>
                </SheetHeader>

                <div className="space-y-5 mt-6">
                  <Card>
                    <CardContent className="p-4 space-y-2 text-sm">
                      <p>
                        <span className="text-muted-foreground">Cliente:</span>{" "}
                        {selectedSubmission.client?.name || "Nao vinculado"}
                      </p>
                      <p>
                        <span className="text-muted-foreground">Enviado por:</span>{" "}
                        {selectedSubmission.submitted_by_name || "Sem nome"}
                      </p>
                      <p>
                        <span className="text-muted-foreground">Data:</span>{" "}
                        {new Date(selectedSubmission.created_at).toLocaleString("pt-BR")}
                      </p>
                      {selectedSubmission.request && (
                        <p>
                          <span className="text-muted-foreground">Solicitacao:</span>{" "}
                          <button
                            type="button"
                            className="text-primary hover:underline"
                            onClick={() => openRequestDetail(selectedSubmission.request!.id)}
                          >
                            {selectedSubmission.request.title}
                          </button>
                        </p>
                      )}
                    </CardContent>
                  </Card>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Status operacional</label>
                    <Select
                      value={selectedSubmission.status || "pending"}
                      onValueChange={(value) => void handleSubmissionStatusChange(selectedSubmission.id, value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {submissionStatusOptions.map((status) => (
                          <SelectItem key={status} value={status}>
                            {status}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Dados estruturados enviados</label>
                    {parseSubmissionEntries(selectedSubmission.data).length === 0 ? (
                      <p className="text-sm text-muted-foreground">Sem dados estruturados para exibir.</p>
                    ) : (
                      <div className="space-y-2">
                        {parseSubmissionEntries(selectedSubmission.data).map((entry) => (
                          <div key={entry.key} className="rounded-lg border p-3">
                            <p className="text-xs text-muted-foreground">{entry.key}</p>
                            <p className="text-sm mt-1 break-words">{entry.value}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Observacoes internas</label>
                    <Textarea
                      rows={4}
                      value={submissionNotes}
                      onChange={(event) => setSubmissionNotes(event.target.value)}
                      placeholder="Registre aqui orientacoes internas ou proximos passos."
                    />
                    <div className="flex justify-end">
                      <Button type="button" onClick={() => void handleSaveSubmissionNotes()} disabled={savingSubmissionNotes}>
                        {savingSubmissionNotes ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar observacoes"}
                      </Button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </SheetContent>
        </Sheet>
      </div>
    </AppLayout>
  );
}

