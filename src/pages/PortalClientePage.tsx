import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import { RequestChat } from "@/components/app/RequestChat";
import { ClientPortalOverview } from "@/components/portal/ClientPortalOverview";
import { GrowAssistantWidget } from "@/components/portal/GrowAssistantWidget";
import { PortalClienteSidebar, type PortalTab } from "@/components/portal/PortalClienteSidebar";
import {
  documentCategories,
  sectorOptions,
  type PortalActionItem,
  type PortalClientDocument,
  type PortalObligationDocument,
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
import { recordOperationalAuditLog } from "@/lib/operationalAudit";
import { buildPortalDataQueryKey, resolveSelectedPortalClient } from "@/lib/portalClientScope";
import {
  mergePortalRequestTypesWithDefaults,
  normalizePortalRequestType,
  portalRequestTypesTable,
  type PortalRequestType,
} from "@/lib/portalRequestTypes";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { toast } from "sonner";

const DEFAULT_PORTAL_ACCESS_MESSAGE =
  "Este usuário ainda não possui permissão de cliente para acessar o portal.";

const buildPortalClientStorageKey = (userId: string) => `grow-portal-client-${userId}`;

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

const asArray = <T,>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);

const normalizeLooseToken = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const DEFAULT_REQUEST_SECTOR = sectorOptions.includes("Geral") ? "Geral" : sectorOptions[0];

const isEcontinuoDocument = (document: PortalClientDocument) => {
  const categoryToken = normalizeLooseToken(document.category || "");
  if (categoryToken.includes("e_continuo") || categoryToken.includes("econtinuo")) return true;

  const pathToken = normalizeLooseToken(document.file_path || "");
  return pathToken.includes("envios_econtinuo") || pathToken.includes("econtinuo");
};

const obligationStatusLabels: Record<PortalObligationDocument["instance_status"], string> = {
  pendente: "Pendente",
  em_andamento: "Em andamento",
  aguardando_documento: "Aguardando documento",
  em_revisao: "Em revisão",
  concluida: "Concluída",
  atrasada: "Atrasada",
  cancelada: "Cancelada",
};

const obligationStatusVariants: Record<PortalObligationDocument["instance_status"], string> = {
  pendente: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  em_andamento: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  aguardando_documento: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  em_revisao: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300",
  concluida: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  atrasada: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  cancelada: "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
};

const formatFileSize = (size: number | null) => {
  if (!size || size <= 0) return null;
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

const formatCompetenceHeading = (competenceDate: string, competenceLabel: string) => {
  const parsedDate = new Date(`${competenceDate}T00:00:00`);
  if (Number.isNaN(parsedDate.getTime())) return competenceLabel;
  return new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
  }).format(parsedDate);
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
  const { user, session, loading: authLoading, signOut, effectiveAccess } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<PortalTab>("overview");
  const [loadingData, setLoadingData] = useState(true);
  const [portalAccessDenied, setPortalAccessDenied] = useState(false);
  const [portalAccessMessage, setPortalAccessMessage] = useState(DEFAULT_PORTAL_ACCESS_MESSAGE);

  const [clientProfile, setClientProfile] = useState<PortalClientProfile | null>(null);
  const [availableClientProfiles, setAvailableClientProfiles] = useState<PortalClientProfile[]>([]);
  const [selectedPortalClientId, setSelectedPortalClientId] = useState<string | null>(null);
  const [requests, setRequests] = useState<PortalClientRequest[]>([]);
  const [documents, setDocuments] = useState<PortalClientDocument[]>([]);
  const [portalObligationDocuments, setPortalObligationDocuments] = useState<PortalObligationDocument[]>([]);
  const [portalTasks, setPortalTasks] = useState<PortalClientTask[]>([]);
  const [messages, setMessages] = useState<PortalRequestMessage[]>([]);
  const [requestSearch, setRequestSearch] = useState("");
  const [requestStatusFilter, setRequestStatusFilter] = useState<string>("all");
  const [newRequestSector, setNewRequestSector] = useState(DEFAULT_REQUEST_SECTOR);
  const [newRequestTitle, setNewRequestTitle] = useState("");
  const [newRequestDescription, setNewRequestDescription] = useState("");
  const [selectedRequestTypeId, setSelectedRequestTypeId] = useState<string | null>(null);
  const [requestTypeFieldValues, setRequestTypeFieldValues] = useState<Record<string, string>>({});
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

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [changingPortalPassword, setChangingPortalPassword] = useState(false);
  const knownPortalTaskIdsRef = useRef<Set<string>>(new Set());
  const ensuredPortalProfileRef = useRef<string | null>(null);

  const requestTypesQuery = useQuery({
    queryKey: ["portal-request-types", clientProfile?.organization_id || effectiveAccess?.organizationId || "global"],
    queryFn: async () => {
      const organizationId = clientProfile?.organization_id || effectiveAccess?.organizationId || null;
      let query = portalRequestTypesTable()
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .order("title", { ascending: true });

      if (organizationId) {
        query = query.or(`organization_id.is.null,organization_id.eq.${organizationId}`);
      } else {
        query = query.is("organization_id", null);
      }

      const { data, error } = await query;
      if (error) throw error;
      return asArray<unknown>(data)
        .map(normalizePortalRequestType)
        .filter((item): item is PortalRequestType => Boolean(item));
    },
    enabled: Boolean(user),
    staleTime: 5 * 60 * 1000,
  });

  const portalRequestTypes = useMemo(
    () => mergePortalRequestTypesWithDefaults(requestTypesQuery.data || []),
    [requestTypesQuery.data],
  );

  const selectedRequestType = useMemo(
    () => portalRequestTypes.find((item) => item.id === selectedRequestTypeId) || null,
    [portalRequestTypes, selectedRequestTypeId],
  );

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/app/login");
    }
  }, [authLoading, user, navigate]);

  const resetPortalCollections = useCallback(() => {
    setClientProfile(null);
    setAvailableClientProfiles([]);
    setRequests([]);
    setDocuments([]);
    setPortalObligationDocuments([]);
    setPortalTasks([]);
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

    const fetchClientRole = async () => {
      if (effectiveAccess?.primaryRole === "cliente") {
        return { data: { user_id: user.id }, error: null };
      }
      return supabase
        .from("user_roles")
        .select("user_id")
        .eq("user_id", user.id)
        .eq("role", "client")
        .limit(1)
        .maybeSingle();
    };

    const fetchLinkedClients = async () => {
      const { data: linkRows, error: linkError } = await supabase
        .from("client_users")
        .select("client_id, organization_id, created_at")
        .eq("user_id", user.id)
        .eq("status", "active")
        .order("created_at", { ascending: false });

      if (linkError) {
        return { data: null, error: linkError };
      }

      const linkedClientIds = Array.from(
        new Set((linkRows || []).map((link) => String(link.client_id || "")).filter(Boolean)),
      );

      let linkedClients: PortalClientProfile[] = [];
      if (linkedClientIds.length > 0) {
        const { data, error } = await supabase
          .from("clients")
          .select("id, organization_id, name, contact, email, portal_user_id")
          .in("id", linkedClientIds)
          .order("created_at", { ascending: false });

        if (error) {
          return { data: null, error };
        }

        const clientMap = new Map(
          asArray<PortalClientProfile>(data).map((client) => [client.id, client]),
        );
        linkedClients = linkedClientIds
          .map((clientId) => clientMap.get(clientId))
          .filter((client): client is PortalClientProfile => Boolean(client));
      }

      return { data: linkedClients, error: null };
    };

    let [{ data: roleData, error: roleError }, clientRes] = await Promise.all([
      fetchClientRole(),
      fetchLinkedClients(),
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
          fetchLinkedClients(),
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

    const linkedClients = asArray<PortalClientProfile>(clientRes.data);
    const storedClientId = localStorage.getItem(buildPortalClientStorageKey(user.id));
    const client = resolveSelectedPortalClient(linkedClients, selectedPortalClientId, storedClientId);

    if (client?.id && selectedPortalClientId !== client.id) {
      setSelectedPortalClientId(client.id);
      localStorage.setItem(buildPortalClientStorageKey(user.id), client.id);
    }

    if (!client?.id) {
      setPortalAccessMessage(DEFAULT_PORTAL_ACCESS_MESSAGE);
      resetPortalCollections();
      setLoadingData(false);
      setPortalAccessDenied(true);
      return;
    }

    const [requestRes, docRes] = await Promise.all([
      supabase
        .from("client_requests")
        .select("id, user_id, client_id, title, description, category, sector, status, admin_notes, created_at, updated_at")
        .eq("user_id", user.id)
        .eq("client_id", client.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("client_documents")
        .select("id, user_id, client_id, request_id, file_name, file_path, file_size, category, created_at, processed_at, processed_by")
        .eq("user_id", user.id)
        .eq("client_id", client.id)
        .order("created_at", { ascending: false }),
    ]);

    if (clientRes.error) {
      setPortalAccessMessage("Não foi possível carregar os cadastros de cliente para este portal.");

      resetPortalCollections();
      setLoadingData(false);
      setPortalAccessDenied(true);
      return;
    }

    if (requestRes.error) toast.error("Erro ao carregar solicitações.");
    if (docRes.error) toast.error("Erro ao carregar documentos.");
    const fetchedRequests = asArray<PortalClientRequest>(requestRes.data);
    const fetchedDocuments = asArray<PortalClientDocument>(docRes.data);

    let fetchedTasks: PortalClientTask[] = [];
    let fetchedObligationDocuments: PortalObligationDocument[] = [];
    if (client?.id) {
      const [tasksRes, obligationInstancesRes] = await Promise.all([
        supabase
          .from("client_portal_tasks")
          .select("id, client_id, title, description, type, status, due_date, sector, request_id, created_by, created_at, updated_at")
          .eq("client_id", client.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("obligation_instances")
          .select(
            "id, template_id, competence_key, competence_label, competence_date, technical_due_date, legal_due_date, status, protocol, protocol_issued_at, processed_automatically, template:obligation_templates(name, sector), files:obligation_instance_files(id, file_name, storage_bucket, storage_path, file_size, content_type, triage_status, source, source_kind, protocol_number, created_at)",
          )
          .eq("client_id", client.id)
          .order("competence_date", { ascending: false }),
      ]);

      const { data: tasksData, error: tasksError } = tasksRes;

      if (tasksError) {
        toast.error("Erro ao carregar pendências.");
      } else {
        fetchedTasks = asArray<PortalClientTask>(tasksData);
      }

      if (obligationInstancesRes.error) {
        toast.error("Erro ao carregar documentos das obrigações.");
      } else {
        type ObligationInstanceRow = {
          id: string;
          template_id: string;
          competence_key: string;
          competence_label: string;
          competence_date: string;
          technical_due_date: string;
          legal_due_date: string | null;
          status: PortalObligationDocument["instance_status"];
          protocol: string | null;
          protocol_issued_at: string | null;
          processed_automatically: boolean;
          template: { name: string; sector: string | null } | null;
          files: Array<{
            id: string;
            file_name: string;
            storage_bucket: string;
            storage_path: string;
            file_size: number | null;
            content_type: string | null;
            triage_status: PortalObligationDocument["triage_status"];
            source: string;
            source_kind: PortalObligationDocument["source_kind"];
            protocol_number: string | null;
            created_at: string;
          }> | null;
        };

        const obligationInstances = asArray<ObligationInstanceRow>(obligationInstancesRes.data);
        fetchedObligationDocuments = obligationInstances.flatMap((instance) =>
          asArray<NonNullable<ObligationInstanceRow["files"]>[number]>(instance.files)
            .filter((file) => file.triage_status !== "rejected")
            .map((file) => ({
              id: file.id,
              instance_id: instance.id,
              template_id: instance.template_id,
              template_name: instance.template?.name || "Obrigação sem nome",
              template_sector: instance.template?.sector || null,
              competence_key: instance.competence_key,
              competence_label: instance.competence_label,
              competence_date: instance.competence_date,
              technical_due_date: instance.technical_due_date,
              legal_due_date: instance.legal_due_date,
              instance_status: instance.status,
              protocol: instance.protocol,
              protocol_issued_at: instance.protocol_issued_at,
              processed_automatically: instance.processed_automatically,
              file_name: file.file_name,
              storage_bucket: file.storage_bucket,
              storage_path: file.storage_path,
              file_size: file.file_size,
              content_type: file.content_type,
              triage_status: file.triage_status,
              source: file.source,
              source_kind: file.source_kind,
              protocol_number: file.protocol_number,
              created_at: file.created_at,
            })),
        );
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
        fetchedMessages = asArray<PortalRequestMessage>(messageData);
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

    setAvailableClientProfiles(linkedClients);
    setClientProfile(client);
    setRequests(fetchedRequests);
    setDocuments(fetchedDocuments);
    setPortalObligationDocuments(fetchedObligationDocuments);
    setPortalTasks(fetchedTasks);
    setMessages(fetchedMessages);

    setLoadingData(false);
  }, [effectiveAccess?.primaryRole, resetPortalCollections, selectedPortalClientId, session, user]);

  const portalQueryKey = useMemo(
    () => buildPortalDataQueryKey(user?.id, selectedPortalClientId, effectiveAccess?.primaryRole),
    [effectiveAccess?.primaryRole, selectedPortalClientId, user?.id],
  );

  const portalDataQuery = useQuery({
    queryKey: portalQueryKey,
    queryFn: fetchPortalData,
    enabled: Boolean(user && session?.access_token),
    staleTime: 15_000,
    refetchOnWindowFocus: false,
  });

  const refetchPortalData = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: portalQueryKey });
    await portalDataQuery.refetch();
  }, [portalDataQuery, portalQueryKey, queryClient]);

  useEffect(() => {
    setLoadingData(portalDataQuery.isPending || portalDataQuery.isFetching);
  }, [portalDataQuery.isFetching, portalDataQuery.isPending]);

  const handlePortalClientChange = (clientId: string) => {
    if (!user?.id) return;
    localStorage.setItem(buildPortalClientStorageKey(user.id), clientId);
    resetPortalCollections();
    setSelectedPortalClientId(clientId);
    setLoadingData(true);
  };

  useEffect(() => {
    knownPortalTaskIdsRef.current = new Set(asArray<PortalClientTask>(portalTasks).map((task) => task.id));
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

          void refetchPortalData();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [clientProfile?.id, refetchPortalData]);

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

  const obligationDocumentsByCompetence = useMemo(() => {
    const grouped = new Map<
      string,
      {
        competenceKey: string;
        competenceLabel: string;
        competenceDate: string;
        heading: string;
        items: PortalObligationDocument[];
      }
    >();

    portalObligationDocuments.forEach((document) => {
      const existingGroup = grouped.get(document.competence_key);
      if (existingGroup) {
        existingGroup.items.push(document);
        return;
      }

      grouped.set(document.competence_key, {
        competenceKey: document.competence_key,
        competenceLabel: document.competence_label,
        competenceDate: document.competence_date,
        heading: formatCompetenceHeading(document.competence_date, document.competence_label),
        items: [document],
      });
    });

    return Array.from(grouped.values())
      .map((group) => ({
        ...group,
        items: [...group.items].sort((left, right) => {
          const fileDateCompare = right.created_at.localeCompare(left.created_at);
          if (fileDateCompare !== 0) return fileDateCompare;
          return left.template_name.localeCompare(right.template_name, "pt-BR");
        }),
      }))
      .sort((left, right) => right.competenceDate.localeCompare(left.competenceDate));
  }, [portalObligationDocuments]);

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
  const openRequestDetailById = useCallback((requestId: string) => {
    const request = requests.find((item) => item.id === requestId);
    if (!request) {
      toast.error("Não foi possível abrir esta solicitação.");
      return;
    }
    setSelectedRequest(request);
    setRequestDetailOpen(true);
  }, [requests]);

  const resetNewRequestForm = () => {
    setNewRequestSector(DEFAULT_REQUEST_SECTOR);
    setNewRequestTitle("");
    setNewRequestDescription("");
    setSelectedRequestTypeId(null);
    setRequestTypeFieldValues({});
    setNewRequestFiles([]);
    if (requestFilesInputRef.current) requestFilesInputRef.current.value = "";
  };

  const focusRequestComposer = useCallback(() => {
    window.setTimeout(() => {
      requestComposerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 60);
  }, []);

  const openRequestsHub = (mode?: string) => {
    void mode;
    setActiveTab("requests");
    focusRequestComposer();
  };

  const prepareInlineRequest = (
    preset?: { sector?: string; reasonKey?: string; title?: string; description?: string },
    mode?: string,
  ) => {
    openRequestsHub(mode);

    const nextSector =
      preset?.sector && sectorOptions.includes(preset.sector) ? preset.sector : newRequestSector || DEFAULT_REQUEST_SECTOR;

    setNewRequestSector(nextSector);
    if (preset?.title) setNewRequestTitle(preset.title);
    if (preset?.description) setNewRequestDescription(preset.description);
  };

  const handleRequestSectorChange = (value: string) => {
    setNewRequestSector(value);
  };

  const handleRequestTypeSelect = (requestType: PortalRequestType) => {
    setSelectedRequestTypeId(requestType.id);
    setNewRequestSector(requestType.sector || DEFAULT_REQUEST_SECTOR);
    setNewRequestTitle(requestType.task_title_template || requestType.title);
    setNewRequestDescription(requestType.task_description_template || "");
    setRequestTypeFieldValues({});
    requestComposerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleRequestTypeFieldChange = (fieldId: string, value: string) => {
    setRequestTypeFieldValues((prev) => ({ ...prev, [fieldId]: value }));
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
    if (!user || !clientProfile?.id || files.length === 0) return { success: 0, failed: 0 };

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
        client_id: clientProfile.id,
        organization_id: clientProfile.organization_id,
        request_id: requestId,
        file_name: file.name,
        file_path: filePath,
        file_size: file.size,
        category,
      });

      if (dbError) {
        failed += 1;
      } else {
        await recordOperationalAuditLog({
          organizationId: clientProfile.organization_id,
          action: "portal_document_uploaded",
          entityType: "client_document",
          clientId: clientProfile.id,
          requestId,
          metadata: { fileName: file.name, category },
        });
        success += 1;
      }
    }

    return { success, failed };
  };

  const buildRequestDescription = () => {
    const description = newRequestDescription.trim();
    const fieldLines = selectedRequestType?.form_fields
      .map((field) => {
        const value = (requestTypeFieldValues[field.id] || "").trim();
        return value ? `${field.label}: ${value}` : null;
      })
      .filter(Boolean) || [];

    const sections = [
      selectedRequestType ? `Tipo de solicitação: ${selectedRequestType.title}` : null,
      description || null,
      fieldLines.length > 0 ? ["Dados adicionais:", ...fieldLines].join("\n") : null,
    ].filter(Boolean);

    return sections.length > 0 ? sections.join("\n\n") : null;
  };

  const handleCreateRequest = async () => {
    if (!user) return;
    if (!clientProfile?.id) {
      toast.error("Selecione uma empresa para enviar a solicitação.");
      return;
    }
    if (!newRequestSector) {
      toast.error("Selecione o setor responsavel.");
      return;
    }
    if (!newRequestTitle.trim()) {
      toast.error("Informe o título da solicitação.");
      return;
    }
    if (!newRequestDescription.trim()) {
      toast.error("Descreva o que precisa ser feito.");
      return;
    }
    const missingRequiredField = selectedRequestType?.form_fields.find(
      (field) => field.required && !(requestTypeFieldValues[field.id] || "").trim(),
    );
    if (missingRequiredField) {
      toast.error(`Preencha o campo obrigatório: ${missingRequiredField.label}.`);
      return;
    }

    setCreatingRequest(true);
    const requestCategory = selectedRequestType?.title || "Tarefa generica";
    const { data: createdRequest, error } = await supabase
      .from("client_requests")
      .insert({
        user_id: user.id,
        client_id: clientProfile.id,
        organization_id: clientProfile.organization_id,
        title: newRequestTitle.trim(),
        description: buildRequestDescription(),
        category: requestCategory,
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
      requestCategory
    );

    setCreatingRequest(false);
    resetNewRequestForm();

    await recordOperationalAuditLog({
      organizationId: clientProfile.organization_id,
      action: "portal_request_created",
      entityType: "client_request",
      entityId: createdRequest.id,
      clientId: clientProfile.id,
      metadata: {
        title: newRequestTitle.trim(),
        sector: newRequestSector,
        category: requestCategory,
        requestTypeId: selectedRequestTypeId,
        files: uploadResult.success,
      },
    });

    if (uploadResult.failed > 0) {
      toast.error(
        `Solicitação enviada. ${uploadResult.success} arquivo(s) anexado(s) e ${uploadResult.failed} com falha.`
      );
    } else {
      toast.success("Sua solicitação foi enviada ao setor responsável.");
    }

    setActiveTab("requests");
    await refetchPortalData();
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
    if (!user || !clientProfile?.id || uploadFiles.length === 0) {
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
        client_id: clientProfile.id,
        organization_id: clientProfile.organization_id,
        request_id: requestId,
        file_name: file.name,
        file_path: filePath,
        file_size: file.size,
        category: uploadCategory,
      });

      if (dbError) {
        failed += 1;
      } else {
        await recordOperationalAuditLog({
          organizationId: clientProfile.organization_id,
          action: "portal_document_uploaded",
          entityType: "client_document",
          clientId: clientProfile.id,
          requestId,
          metadata: { fileName: file.name, category: uploadCategory },
        });
        success += 1;
      }
    }

    setUploadingFiles(false);
    if (success > 0) {
      toast.success(`${success} arquivo(s) enviado(s) com sucesso.`);
      setUploadDialogOpen(false);
      setUploadFiles([]);
      if (uploadFilesInputRef.current) uploadFilesInputRef.current.value = "";
      await refetchPortalData();
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

    const { error: deleteError } = await supabase
      .from("client_documents")
      .delete()
      .eq("id", document.id)
      .eq("client_id", clientProfile?.id || "");
    if (deleteError) {
      toast.error("Erro ao remover arquivo do histórico.");
      return;
    }

    toast.success("Documento excluído com sucesso.");
    await refetchPortalData();
  };

  const handleDownloadStoredFile = async (bucket: string, filePath: string) => {
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(filePath, 120);

    if (error || !data?.signedUrl) {
      toast.error("Não foi possível gerar o link de download.");
      return;
    }

    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  const handleDownloadDocument = async (document: PortalClientDocument) =>
    handleDownloadStoredFile("client-documents", document.file_path);

  const handleDownloadObligationDocument = async (document: PortalObligationDocument) =>
    handleDownloadStoredFile(document.storage_bucket, document.storage_path);

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
              {availableClientProfiles.length > 1 ? (
                <Select value={clientProfile?.id || ""} onValueChange={handlePortalClientChange}>
                  <SelectTrigger className="h-9 w-[180px] text-xs sm:w-[240px]">
                    <SelectValue placeholder="Selecionar cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableClientProfiles.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.name || client.contact || client.email || "Cliente Grow"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : null}
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
              pendingNow={pendingNow}
              recentUpdates={recentUpdates}
              onOpenRequestDetail={openRequestDetailById}
              onNewRequest={() => openRequestsHub("freeform")}
              onOpenSupport={() => openRequestsHub("support")}
              onOpenHistory={() => setActiveTab("request-history")}
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
            <div className="mx-auto max-w-6xl space-y-4">
              <Card className="overflow-hidden border-primary/10 shadow-sm">
                <CardHeader className="pb-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-lg">Nova tarefa</CardTitle>
                      <p className="max-w-2xl text-sm text-muted-foreground">
                        Abra uma tarefa simples para a equipe acompanhar pelo portal.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full sm:w-auto"
                      onClick={() => setActiveTab("request-history")}
                    >
                      Ver historico
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 pt-0">
                  <div className="rounded-2xl border bg-muted/20 p-3">
                    <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                      <Sparkles className="h-3.5 w-3.5" />
                      Tipos de solicitação
                    </div>
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {portalRequestTypes.map((requestType) => {
                        const selected = selectedRequestTypeId === requestType.id;
                        return (
                          <button
                            key={requestType.id}
                            type="button"
                            className={`shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition ${
                              selected
                                ? "border-primary bg-primary text-primary-foreground shadow-sm"
                                : "border-border bg-white text-foreground hover:border-primary/40 hover:bg-primary/5"
                            }`}
                            onClick={() => handleRequestTypeSelect(requestType)}
                          >
                            {requestType.title}
                          </button>
                        );
                      })}
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Escolha uma opção para preencher o formulário com campos direcionados, ou envie uma tarefa genérica.
                    </p>
                  </div>
                  <div ref={requestComposerRef} className="rounded-2xl border bg-white p-4 shadow-sm sm:p-5">
                    <div className="space-y-4">
                        <div className="grid gap-3 md:grid-cols-2">
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
                            <label htmlFor="portal-request-title" className="text-sm font-medium">Titulo da tarefa</label>
                            <Input
                              id="portal-request-title"
                              name="portal_request_title"
                              autoComplete="off"
                              value={newRequestTitle}
                              onChange={(event) => setNewRequestTitle(event.target.value)}
                              placeholder="Ex.: Revisar documentos enviados"
                            />
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <label htmlFor="portal-request-description" className="text-sm font-medium">Descricao da tarefa</label>
                          <Textarea
                            id="portal-request-description"
                            name="portal_request_description"
                            rows={5}
                            autoComplete="off"
                            value={newRequestDescription}
                            onChange={(event) => setNewRequestDescription(event.target.value)}
                            placeholder="Descreva o contexto, o resultado esperado e qualquer prazo relevante."
                          />
                        </div>

                        {selectedRequestType && selectedRequestType.form_fields.length > 0 && (
                          <div className="rounded-2xl border bg-muted/20 p-4">
                            <div className="mb-3">
                              <p className="text-sm font-medium">Dados de {selectedRequestType.title}</p>
                              <p className="text-xs text-muted-foreground">
                                Campos configurados no módulo interno de solicitações.
                              </p>
                            </div>
                            <div className="grid gap-3 md:grid-cols-2">
                              {selectedRequestType.form_fields.map((field) => {
                                const fieldValue = requestTypeFieldValues[field.id] || "";
                                const commonProps = {
                                  id: `portal-request-type-field-${field.id}`,
                                  value: fieldValue,
                                  onChange: (
                                    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
                                  ) => handleRequestTypeFieldChange(field.id, event.target.value),
                                };

                                return (
                                  <div
                                    key={field.id}
                                    className={`space-y-1.5 ${field.type === "textarea" ? "md:col-span-2" : ""}`}
                                  >
                                    <label
                                      htmlFor={`portal-request-type-field-${field.id}`}
                                      className="text-sm font-medium"
                                    >
                                      {field.label}
                                      {field.required ? <span className="text-destructive"> *</span> : null}
                                    </label>
                                    {field.type === "textarea" ? (
                                      <Textarea {...commonProps} rows={3} />
                                    ) : (
                                      <Input
                                        {...commonProps}
                                        type={field.type === "date" ? "date" : field.type === "number" ? "number" : "text"}
                                      />
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mt-5 space-y-3 rounded-2xl border bg-muted/20 p-4">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-sm font-medium">Arquivos</p>
                          <p className="text-xs leading-relaxed text-muted-foreground">
                            Inclua apenas o material que acelera a leitura do pedido.
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="w-full sm:w-auto"
                          onClick={() => requestFilesInputRef.current?.click()}
                        >
                          <Paperclip className="mr-1 h-4 w-4" />
                          Adicionar
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
                        <div className="rounded-xl border bg-white px-3 py-4 text-sm text-muted-foreground">
                          Nenhum arquivo selecionado.
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {newRequestFiles.map((file, index) => (
                            <div
                              key={`${file.name}-${index}`}
                              className="flex items-center justify-between gap-3 rounded-xl border bg-white px-3 py-2"
                            >
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium">{file.name}</p>
                                <p className="text-[11px] text-muted-foreground">
                                  {(file.size / 1024).toFixed(1)} KB
                                </p>
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 shrink-0"
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

                    <div className="mt-5 flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-sm leading-relaxed text-muted-foreground">
                        A tarefa entra no historico do portal com status, mensagens e documentos vinculados.
                      </p>
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <Button
                          type="button"
                          variant="ghost"
                          className="w-full sm:w-auto"
                          onClick={() => setActiveTab("request-history")}
                        >
                          Acompanhar historico
                        </Button>
                        <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={resetNewRequestForm}>
                          Limpar
                        </Button>
                        <Button
                          type="button"
                          className="w-full gap-2 sm:w-auto"
                          onClick={() => void handleCreateRequest()}
                          disabled={creatingRequest}
                        >
                          {creatingRequest ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                          Enviar tarefa
                        </Button>
                      </div>
                    </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="request-history" className="space-y-4">
            <div className="mx-auto max-w-6xl space-y-4">
              <Card>
                <CardHeader className="pb-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-base">Historico de solicitacoes</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        Consulte andamento, retornos da equipe e documentos vinculados em um módulo separado do envio.
                      </p>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <Badge variant="outline" className="w-fit">
                        {filteredRequests.length} item(ns)
                      </Badge>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-full sm:w-auto"
                        onClick={() => openRequestsHub("freeform")}
                      >
                        Nova solicitacao
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 pt-0">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
                    <div className="flex items-center gap-2 rounded-xl border bg-background px-3 py-2">
                      <Search className="h-4 w-4 text-muted-foreground" />
                      <input
                        aria-label="Buscar solicitacoes"
                        name="portal_request_search"
                        autoComplete="off"
                        className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                        placeholder="Buscar por titulo, categoria ou setor…"
                        value={requestSearch}
                        onChange={(event) => setRequestSearch(event.target.value)}
                      />
                    </div>
                    <Select value={requestStatusFilter} onValueChange={setRequestStatusFilter}>
                      <SelectTrigger className="bg-background">
                        <Filter className="mr-1 h-4 w-4" />
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
                  </div>

                  {loadingData ? (
                    <div className="flex justify-center py-12" aria-live="polite">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                  ) : filteredRequests.length === 0 ? (
                    <div className="rounded-2xl border border-dashed p-10 text-center">
                      <MessageSquare className="mx-auto mb-2 h-10 w-10 text-muted-foreground" />
                      <p className="font-medium">Nenhuma solicitacao encontrada.</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Seus pedidos aparecem aqui com status, retorno da equipe e arquivos vinculados.
                      </p>
                    </div>
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
                            className="group w-full rounded-2xl border bg-background px-4 py-4 text-left transition-all hover:-translate-y-0.5 hover:border-primary/20 hover:bg-muted/10"
                            onClick={() => {
                              setSelectedRequest(request);
                              setRequestDetailOpen(true);
                            }}
                          >
                            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                              <div className="min-w-0 space-y-2">
                                <div className="flex flex-wrap items-center gap-2">
                                  <Badge variant="secondary" className="text-[10px]">
                                    {request.category}
                                  </Badge>
                                  <Badge variant="outline" className="text-[10px]">
                                    {request.sector}
                                  </Badge>
                                </div>
                                <p className="line-clamp-1 text-sm font-semibold sm:text-base">{request.title}</p>
                                <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                                  {request.description || "Sem descricao adicional."}
                                </p>
                              </div>
                              <div className="flex shrink-0 items-center gap-2 lg:justify-end">
                                <Badge variant="outline" className={`border-0 ${statusMeta.className}`}>
                                  <StatusIcon className="mr-1 h-3 w-3" />
                                  {statusMeta.label}
                                </Badge>
                                <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                              </div>
                            </div>

                            <div className="mt-4 grid gap-2 sm:grid-cols-3">
                              <div className="rounded-xl border bg-muted/20 px-3 py-2">
                                <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Atualizacao</p>
                                <p className="mt-1 text-sm font-medium">
                                  {new Date(request.updated_at).toLocaleDateString("pt-BR")}
                                </p>
                              </div>
                              <div className="rounded-xl border bg-muted/20 px-3 py-2">
                                <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Arquivos</p>
                                <p className="mt-1 text-sm font-medium">{requestDocs.length} vinculado(s)</p>
                              </div>
                              <div className="rounded-xl border bg-muted/20 px-3 py-2">
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
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          <TabsContent value="uploads" className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Envios por competência</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Consulte aqui os documentos anexados pela equipe nas suas obrigações, organizados mês a mês.
                </p>
              </CardHeader>
            </Card>

            {loadingData ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : obligationDocumentsByCompetence.length === 0 && econtinuoDocuments.length === 0 ? (
              <Card>
                <CardContent className="p-10 text-center">
                  <Upload className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
                  <p className="font-medium">Nenhum envio encontrado.</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Assim que a equipe anexar documentos às suas obrigações, eles aparecerão aqui por competência.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {obligationDocumentsByCompetence.map((group) => (
                  <Card key={group.competenceKey}>
                    <CardHeader className="pb-3">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <CardTitle className="text-base capitalize">{group.heading}</CardTitle>
                          <p className="text-sm text-muted-foreground">Competência {group.competenceLabel}</p>
                        </div>
                        <Badge variant="secondary">{group.items.length} arquivo(s)</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {group.items.map((document) => (
                        <div
                          key={document.id}
                          className="rounded-xl border bg-card px-4 py-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"
                        >
                          <div className="min-w-0 space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-medium truncate">{document.file_name}</p>
                              <Badge className={obligationStatusVariants[document.instance_status]}>
                                {obligationStatusLabels[document.instance_status]}
                              </Badge>
                              {document.processed_automatically ? (
                                <Badge variant="secondary">Processado automaticamente</Badge>
                              ) : null}
                            </div>
                            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                              <span>{document.template_name}</span>
                              {document.template_sector ? (
                                <>
                                  <span>•</span>
                                  <span>{document.template_sector}</span>
                                </>
                              ) : null}
                              <span>•</span>
                              <span>Anexado em {new Date(document.created_at).toLocaleString("pt-BR")}</span>
                              <span>•</span>
                              <span>Prazo técnico {new Date(`${document.technical_due_date}T00:00:00`).toLocaleDateString("pt-BR")}</span>
                              {formatFileSize(document.file_size) ? (
                                <>
                                  <span>•</span>
                                  <span>{formatFileSize(document.file_size)}</span>
                                </>
                              ) : null}
                              {document.protocol || document.protocol_number ? (
                                <>
                                  <span>•</span>
                                  <span>Protocolo {document.protocol_number || document.protocol}</span>
                                </>
                              ) : null}
                            </div>
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="gap-1.5 shrink-0"
                            onClick={() => void handleDownloadObligationDocument(document)}
                          >
                            <Download className="h-4 w-4" /> Baixar
                          </Button>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                ))}

                {econtinuoDocuments.length > 0 ? (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Histórico legado do e-contínuo</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        Esses arquivos pertencem ao histórico anterior do portal e continuam disponíveis para consulta.
                      </p>
                    </CardHeader>
                    <CardContent className="space-y-2">
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
                              {formatFileSize(document.file_size) ? (
                                <>
                                  <span>•</span>
                                  <span>{formatFileSize(document.file_size)}</span>
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
                    </CardContent>
                  </Card>
                ) : null}
              </div>
            )}
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
                  <SelectItem value="none">Não vincular agora</SelectItem>
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
                    <p className="text-xs text-muted-foreground">
                      Responda direto por aqui para manter tudo no mesmo histórico. Se precisar, anexe o documento no botão acima.
                    </p>
                    <RequestChat
                      requestId={selectedRequest.id}
                      isTeamMember={false}
                      inputPlaceholder="Escreva aqui a resposta da solicitação..."
                      quickReplies={[
                        {
                          label: "Estou enviando agora",
                          text: "Perfeito, estou enviando as informações solicitadas agora.",
                        },
                        {
                          label: "Preciso de prazo",
                          text: "Recebi a solicitação. Preciso de um prazo adicional para enviar tudo.",
                        },
                        {
                          label: "Não tenho este dado",
                          text: "No momento não tenho esse dado/documento. Podem me orientar a alternativa?",
                        },
                      ]}
                    />
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
