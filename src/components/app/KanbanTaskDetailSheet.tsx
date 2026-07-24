import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageBubble } from "@/components/whatsapp/MessageBubble";
import { MessageComposer } from "@/components/whatsapp/MessageComposer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import {
  CalendarDays,
  Building2,
  ChevronDown,
  Download,
  FileText,
  ExternalLink,
  Loader2,
  Link2,
  MessageSquare,
  Paperclip,
  Send,
  Unlink,
  User,
  X,
} from "lucide-react";
import { toast } from "sonner";
import type { ChangeHistoryEntry } from "@/lib/changeHistory";
import { whatsappConversationKeys } from "@/hooks/useWhatsAppConversations";
import { useWhatsAppMessages, whatsappMessageKeys } from "@/hooks/useWhatsAppMessages";
import { useWhatsAppRealtime } from "@/hooks/useWhatsAppRealtime";
import { useWhatsAppTicketMessages } from "@/hooks/useWhatsAppTickets";
import { useAuth } from "@/hooks/useAuth";
import {
  formatTaskAssigneeLabel,
  loadTaskAssignees,
  type TaskAssigneeOption,
} from "@/lib/taskAssignees";
import { normalizeSectorCode, type SectorCode } from "@/lib/userPermissions";
import type { RelatedTaskSummary } from "@/lib/taskRelations";
import { listWhatsAppConversations } from "@/lib/whatsappConversations";
import { sendWhatsAppAttachment } from "@/lib/whatsappMedia";
import { sendWhatsAppTextMessage } from "@/lib/whatsappMessages";
import type { WhatsAppConversationSummary, WhatsAppMessage } from "@/lib/whatsappTypes";

export type KanbanStatus =
  "backlog" | "todo" | "doing" | "review" | "done" | "archived";

interface TaskSubtask {
  title: string;
  done: boolean;
}

export interface KanbanTaskItem {
  id: string;
  title: string;
  description: string | null;
  client_name: string | null;
  assignee: string | null;
  assigned_to_user_id?: string | null;
  priority: string;
  sector: string;
  status: KanbanStatus;
  due_date: string | null;
  tags: string[];
  subtasks: TaskSubtask[];
  request_id: string | null;
  created_at: string;
  created_by?: string | null;
  updated_at?: string | null;
  integration_source?: string | null;
  integration_task_id?: string | null;
  integration_payload?: unknown;
}

type SavePayload = {
  description: string | null;
  client_name: string | null;
  assignee: string | null;
  assigned_to_user_id: string | null;
  priority: string;
  sector: string;
  status: KanbanStatus;
  due_date: string | null;
  tags: string[];
};

interface TaskComment {
  id: string;
  task_id: string;
  user_id: string;
  content: string;
  created_at: string;
  profile?: {
    display_name: string | null;
  } | null;
}

interface TaskRequestDocument {
  id: string;
  file_name: string;
  file_path: string;
  file_size: number | null;
  category: string | null;
  created_at: string;
}

type TaskCommentAttachmentType = "task_chat_attachment" | "task_internal_attachment";

interface TaskCommentAttachment {
  type: TaskCommentAttachmentType;
  text: string;
  file: {
    name: string;
    path: string;
    size: number;
    contentType: string;
  };
}

interface TaskInternalMessage {
  type: "task_internal_message";
  text: string;
}

interface TaskSectorAddedMessage {
  type: "task_sector_added";
  text: string;
  sectors: string[];
}

interface KanbanTaskDetailSheetProps {
  task: KanbanTaskItem | null;
  open: boolean;
  saving?: boolean;
  canArchive?: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (taskId: string, updates: SavePayload) => Promise<void>;
  onSubtaskToggle?: (taskId: string, subtaskIndex: number) => void;
  onHistory?: (taskId: string, action: string, details?: string) => void;
  onOpenRelatedTask?: (taskId: string) => void;
  onRemoveRelatedTask?: (relationId: string) => void;
  onCreateRelatedTask?: (sourceTaskId: string) => void;
  historyEntries?: ChangeHistoryEntry[];
  relatedTasks?: RelatedTaskSummary[];
}

const statusLabels: Record<KanbanStatus, string> = {
  backlog: "Backlog",
  todo: "A Fazer",
  doing: "Em Andamento",
  review: "Em Revisão",
  done: "Concluído",
  archived: "Arquivado",
};

const priorityOptions = ["Urgente", "Alta", "Média", "Baixa"];
const sectorOptions = [
  "Contábil",
  "Fiscal",
  "Departamento Pessoal",
  "Comercial",
  "Societário",
  "Geral",
];

const parseTaskCommentAttachment = (content: string): TaskCommentAttachment | null => {
  try {
    const parsed = JSON.parse(content) as Partial<TaskCommentAttachment>;
    if (
      (parsed.type !== "task_chat_attachment" && parsed.type !== "task_internal_attachment") ||
      !parsed.file ||
      typeof parsed.file.name !== "string" ||
      typeof parsed.file.path !== "string"
    ) {
      return null;
    }
    return {
      type: parsed.type,
      text: typeof parsed.text === "string" ? parsed.text : "",
      file: {
        name: parsed.file.name,
        path: parsed.file.path,
        size: typeof parsed.file.size === "number" ? parsed.file.size : 0,
        contentType: typeof parsed.file.contentType === "string" ? parsed.file.contentType : "application/octet-stream",
      },
    };
  } catch {
    return null;
  }
};

const parseInternalTaskMessage = (content: string): TaskInternalMessage | null => {
  try {
    const parsed = JSON.parse(content) as Partial<TaskInternalMessage>;
    if (parsed.type !== "task_internal_message" || typeof parsed.text !== "string") return null;
    return { type: "task_internal_message", text: parsed.text };
  } catch {
    return null;
  }
};

const parseSectorAddedMessage = (content: string): TaskSectorAddedMessage | null => {
  try {
    const parsed = JSON.parse(content) as Partial<TaskSectorAddedMessage>;
    if (parsed.type !== "task_sector_added") return null;
    return {
      type: "task_sector_added",
      text: typeof parsed.text === "string" ? parsed.text : "Setor adicionado à tarefa.",
      sectors: Array.isArray(parsed.sectors)
        ? parsed.sectors.filter((sector): sector is string => typeof sector === "string")
        : [],
    };
  } catch {
    return null;
  }
};

const isInternalTaskComment = (content: string) => {
  const attachment = parseTaskCommentAttachment(content);
  if (attachment?.type === "task_internal_attachment") return true;
  return parseInternalTaskMessage(content) !== null || parseSectorAddedMessage(content) !== null;
};

const formatFileSize = (bytes: number) => {
  if (!bytes) return "Tamanho não informado";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

const sanitizeStorageFileName = (name: string) =>
  name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120) || "arquivo";

const createClientMessageId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `task-wa-${Date.now()}-${Math.random().toString(36).slice(2)}`;

const initialsFor = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "WA";

const getWhatsAppConversationName = (conversation: WhatsAppConversationSummary | null, fallback: string) =>
  conversation?.client_name ||
  conversation?.contact?.display_name ||
  conversation?.contact?.profile_name ||
  conversation?.contact?.phone_number ||
  fallback ||
  "Cliente";

type TaskWhatsAppContextMessage = {
  id: string;
  direction?: string | null;
  body?: string | null;
  messageType?: string | null;
  createdAt?: string | null;
};

const getTaskWhatsAppContextMessages = (task: KanbanTaskItem | null): TaskWhatsAppContextMessage[] => {
  const payload = task?.integration_payload;
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return [];

  const contextMessages = (payload as { context_messages?: unknown }).context_messages;
  if (!Array.isArray(contextMessages)) return [];

  return contextMessages
    .filter((message): message is Record<string, unknown> =>
      Boolean(message) && typeof message === "object" && !Array.isArray(message),
    )
    .map((message) => ({
      id: typeof message.id === "string" ? message.id : "",
      direction: typeof message.direction === "string" ? message.direction : null,
      body: typeof message.body === "string" ? message.body : null,
      messageType: typeof message.messageType === "string" ? message.messageType : null,
      createdAt: typeof message.createdAt === "string" ? message.createdAt : null,
    }))
    .filter((message) => message.id);
};

const toContextOnlyWhatsAppMessage = (message: TaskWhatsAppContextMessage): WhatsAppMessage => ({
  id: message.id,
  conversation_id: "",
  direction: message.direction === "outbound" ? "outbound" : "inbound",
  sender_user_id: null,
  provider_message_id: null,
  message_type:
    message.messageType === "image" ||
    message.messageType === "audio" ||
    message.messageType === "video" ||
    message.messageType === "document" ||
    message.messageType === "text"
      ? message.messageType
      : "text",
  body: message.body || null,
  safe_preview: message.body || null,
  delivery_status: message.direction === "outbound" ? "sent" : "received",
  failure_reason: null,
  blocked_reason: null,
  sent_at: message.direction === "outbound" ? message.createdAt || null : null,
  received_at: message.direction === "outbound" ? null : message.createdAt || null,
  created_at: message.createdAt || new Date(0).toISOString(),
  attachments: [],
});

export function KanbanTaskDetailSheet({
  task,
  open,
  saving = false,
  canArchive = false,
  onOpenChange,
  onSave,
  onSubtaskToggle,
  onHistory,
  onOpenRelatedTask,
  onRemoveRelatedTask,
  onCreateRelatedTask,
  historyEntries = [],
  relatedTasks = [],
}: KanbanTaskDetailSheetProps) {
  const { user, currentOrganizationId } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    description: "",
    client_name: "",
    assignee: "",
    assigned_to_user_id: "",
    priority: "Média",
    sectors: [] as string[],
    status: "backlog" as KanbanStatus,
    due_date: "",
  });
  const [taskComments, setTaskComments] = useState<TaskComment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [sendingInternalComment, setSendingInternalComment] = useState(false);
  const [newInternalComment, setNewInternalComment] = useState("");
  const [selectedInternalFile, setSelectedInternalFile] = useState<File | null>(null);
  const [requiresCustomerResponse, setRequiresCustomerResponse] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [creatorName, setCreatorName] = useState<string | null>(null);
  const [assigneeOptions, setAssigneeOptions] = useState<TaskAssigneeOption[]>(
    [],
  );
  const internalCommentsBottomRef = useRef<HTMLDivElement | null>(null);
  const internalFileInputRef = useRef<HTMLInputElement | null>(null);
  const whatsappMessagesBottomRef = useRef<HTMLDivElement | null>(null);
  const taskClientName = task?.client_name?.trim() || "";

  const taskClientQuery = useQuery({
    queryKey: ["task-whatsapp-client", currentOrganizationId, taskClientName],
    enabled: open && Boolean(currentOrganizationId && taskClientName),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name")
        .eq("organization_id", currentOrganizationId)
        .eq("status", "Ativo")
        .eq("name", taskClientName)
        .maybeSingle();

      if (error) throw error;
      return data as { id: string; name: string } | null;
    },
  });

  const whatsappConversationQuery = useQuery({
    queryKey: ["task-whatsapp-conversation", taskClientQuery.data?.id || null],
    enabled: open && Boolean(taskClientQuery.data?.id),
    queryFn: async () => {
      const conversations = await listWhatsAppConversations({ clientId: taskClientQuery.data?.id || "" }, 0, 1);
      return conversations[0] || null;
    },
  });
  const whatsappConversation = whatsappConversationQuery.data || null;
  const whatsappConversationId = whatsappConversation?.id || null;
  const whatsappMessagesQuery = useWhatsAppMessages(whatsappConversationId);
  const taskLinkedMessagesQuery = useWhatsAppTicketMessages(task?.id || null);
  useWhatsAppRealtime(whatsappConversationId);

  const requestDocumentsQuery = useQuery({
    queryKey: ["task-request-documents", task?.request_id || "none"],
    enabled: open && Boolean(task?.request_id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_documents")
        .select("id, file_name, file_path, file_size, category, created_at")
        .eq("request_id", task?.request_id || "")
        .order("created_at", { ascending: true });

      if (error) throw error;
      return (data || []) as TaskRequestDocument[];
    },
  });
  const requestDocuments = requestDocumentsQuery.data || [];

  const sendWhatsAppTextMutation = useMutation({
    mutationFn: ({ text, clientMessageId, waitCustomer }: { text: string; clientMessageId: string; waitCustomer: boolean }) =>
      sendWhatsAppTextMessage(whatsappConversationId || "", text, clientMessageId, null, task?.id || null, null, waitCustomer),
    onSuccess: () => {
      setRequiresCustomerResponse(false);
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: whatsappConversationKeys.all }),
        queryClient.invalidateQueries({ queryKey: whatsappMessageKeys.conversation(whatsappConversationId) }),
        queryClient.invalidateQueries({ queryKey: ["whatsapp-tickets", "task-messages", task?.id || "none"] }),
      ]);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Não foi possível enviar a mensagem pelo WhatsApp.");
    },
  });

  const sendWhatsAppFileMutation = useMutation({
    mutationFn: ({ file, clientMessageId }: { file: File; clientMessageId: string }) =>
      sendWhatsAppAttachment(whatsappConversationId || "", file, "", clientMessageId, task?.id || null),
    onSuccess: () => {
      toast.success("Arquivo enviado para o WhatsApp.");
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: whatsappConversationKeys.all }),
        queryClient.invalidateQueries({ queryKey: whatsappMessageKeys.conversation(whatsappConversationId) }),
        queryClient.invalidateQueries({ queryKey: ["whatsapp-tickets", "task-messages", task?.id || "none"] }),
      ]);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Não foi possível enviar o arquivo pelo WhatsApp.");
    },
  });

  useEffect(() => {
    if (!task) return;

    const sectors =
      task.tags.length > 0 ? task.tags : task.sector ? [task.sector] : [];
    setForm({
      description: task.description || "",
      client_name: task.client_name || "",
      assignee: task.assignee || "",
      assigned_to_user_id: task.assigned_to_user_id || "",
      priority: task.priority || "Média",
      sectors,
      status: task.status,
      due_date: task.due_date || "",
    });
    setDetailsOpen(false);
    setSelectedInternalFile(null);
    setNewInternalComment("");
    if (internalFileInputRef.current) internalFileInputRef.current.value = "";
  }, [task]);

  useEffect(() => {
    if (!open || !currentOrganizationId) {
      setAssigneeOptions([]);
      return;
    }

    let cancelled = false;
    const loadAssignees = async () => {
      try {
        const assignees = await loadTaskAssignees(currentOrganizationId);
        if (!cancelled) setAssigneeOptions(assignees);
      } catch {
        if (!cancelled) {
          setAssigneeOptions([]);
          toast.error("Não foi possível carregar os responsáveis.");
        }
      }
    };
    void loadAssignees();
    return () => {
      cancelled = true;
    };
  }, [currentOrganizationId, open]);

  useEffect(() => {
    if (!open || !task?.created_by) {
      setCreatorName(null);
      return;
    }

    let cancelled = false;
    const loadCreatorName = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("user_id", task.created_by)
        .maybeSingle();

      if (!cancelled) {
        setCreatorName(data?.display_name?.trim() || null);
      }
    };

    void loadCreatorName();
    return () => {
      cancelled = true;
    };
  }, [open, task?.created_by]);

  const fetchTaskComments = useCallback(async () => {
    if (!task?.id) {
      setTaskComments([]);
      return;
    }

    setLoadingComments(true);
    const { data, error } = await supabase
      .from("kanban_task_comments")
      .select("id, task_id, user_id, content, created_at")
      .eq("task_id", task.id)
      .order("created_at", { ascending: true });

    if (error) {
      toast.error("Não foi possível carregar o chat da tarefa.");
      setTaskComments([]);
      setLoadingComments(false);
      return;
    }

    const rows = (data || []) as TaskComment[];
    const userIds = Array.from(
      new Set(rows.map((comment) => comment.user_id).filter(Boolean)),
    );
    let profileMap = new Map<string, { display_name: string | null }>();

    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .in("user_id", userIds);

      profileMap = new Map(
        (
          (profiles || []) as Array<{
            user_id: string;
            display_name: string | null;
          }>
        ).map((profile) => [
          profile.user_id,
          { display_name: profile.display_name },
        ]),
      );
    }

    setTaskComments(
      rows.map((comment) => ({
        ...comment,
        profile: profileMap.get(comment.user_id) || null,
      })),
    );
    setLoadingComments(false);
  }, [task?.id]);

  useEffect(() => {
    if (!open || !task?.id) return;
    void fetchTaskComments();

    const channel = supabase
      .channel(`kanban-task-comments-${task.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "kanban_task_comments",
          filter: `task_id=eq.${task.id}`,
        },
        () => {
          void fetchTaskComments();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchTaskComments, open, task?.id]);

  useEffect(() => {
    internalCommentsBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [taskComments.length]);

  useEffect(() => {
    whatsappMessagesBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [whatsappMessagesQuery.data?.length, whatsappConversationId]);

  const selectedSectorCodes = useMemo<SectorCode[]>(
    () =>
      form.sectors
        .map((sector) => normalizeSectorCode(sector))
        .filter((sector): sector is SectorCode => Boolean(sector)),
    [form.sectors],
  );
  const selectedSectorCodeSet = useMemo(
    () => new Set(selectedSectorCodes),
    [selectedSectorCodes],
  );
  const filteredAssigneeOptions = useMemo(
    () =>
      selectedSectorCodeSet.size === 0
        ? []
        : assigneeOptions.filter(
            (option) =>
              option.sectorCode && selectedSectorCodeSet.has(option.sectorCode),
          ),
    [assigneeOptions, selectedSectorCodeSet],
  );

  useEffect(() => {
    if (!form.assigned_to_user_id) return;

    const selected = assigneeOptions.find(
      (option) => option.id === form.assigned_to_user_id,
    );
    const isAllowed =
      Boolean(selected?.sectorCode) &&
      selectedSectorCodeSet.has(selected?.sectorCode as SectorCode);

    if (selectedSectorCodeSet.size === 0 || !selected || !isAllowed) {
      setForm((prev) => ({
        ...prev,
        assignee: "",
        assigned_to_user_id: "",
      }));
    }
  }, [assigneeOptions, form.assigned_to_user_id, selectedSectorCodeSet]);

  if (!task) return null;
  const internalTaskComments = taskComments.filter((comment) => isInternalTaskComment(comment.content));
  const subtaskDone = task.subtasks.filter((subtask) => subtask.done).length;
  const subtaskPct = task.subtasks.length
    ? Math.round((subtaskDone / task.subtasks.length) * 100)
    : 0;
  const whatsappMessages = whatsappMessagesQuery.data || [];
  const taskLinkedMessages = taskLinkedMessagesQuery.data || [];
  const taskWhatsAppContextMessages = getTaskWhatsAppContextMessages(task);
  const loadedWhatsAppMessagesById = new Map(whatsappMessages.map((message) => [message.id, message]));
  const linkedWhatsAppMessages = taskLinkedMessages
    .map((link) => loadedWhatsAppMessagesById.get(String(link.message_id)) || link.message)
    .filter((message): message is WhatsAppMessage => Boolean(message?.id));
  const fallbackTaskContextWhatsAppMessages = taskWhatsAppContextMessages.map(
    (contextMessage) => loadedWhatsAppMessagesById.get(contextMessage.id) || toContextOnlyWhatsAppMessage(contextMessage),
  );
  const taskContextWhatsAppMessages = linkedWhatsAppMessages.length > 0 ? linkedWhatsAppMessages : fallbackTaskContextWhatsAppMessages;
  const whatsappSending = sendWhatsAppTextMutation.isPending || sendWhatsAppFileMutation.isPending;
  const whatsappContactInitials = initialsFor(
    getWhatsAppConversationName(whatsappConversation, task.client_name || ""),
  );
  const whatsappLoading = taskClientQuery.isLoading || whatsappConversationQuery.isLoading || whatsappMessagesQuery.isLoading || taskLinkedMessagesQuery.isLoading;

  const toggleSector = (sector: string) => {
    setForm((prev) => {
      const selected = prev.sectors.includes(sector)
        ? prev.sectors.filter((item) => item !== sector)
        : [...prev.sectors, sector];
      return { ...prev, sectors: selected };
    });
  };

  const handleSave = async () => {
    if (form.sectors.length === 0) {
      toast.error("Selecione pelo menos um setor.");
      return;
    }

    await onSave(task.id, {
      description: form.description.trim() || null,
      client_name: task.client_name,
      assignee: form.assignee.trim() || null,
      assigned_to_user_id: form.assigned_to_user_id || null,
      priority: form.priority,
      sector: form.sectors[0],
      status: form.status,
      due_date: form.due_date || null,
      tags: form.sectors,
    });
  };

  const handleDownloadAttachment = async (filePath: string) => {
    const { data, error } = await supabase.storage
      .from("client-documents")
      .createSignedUrl(filePath, 60);
    if (error || !data?.signedUrl) {
      toast.error("Não foi possível gerar o link do anexo.");
      return;
    }
    window.open(data.signedUrl, "_blank");
  };

  const handleSendInternalTaskComment = async () => {
    const text = newInternalComment.trim();
    const file = selectedInternalFile;
    if (!task?.id || !user?.id || (!text && !file)) return;

    setSendingInternalComment(true);
    let content = JSON.stringify({
      type: "task_internal_message",
      text,
    } satisfies TaskInternalMessage);

    if (file) {
      const filePath = `${user.id}/task-internal/${task.id}/${Date.now()}-${sanitizeStorageFileName(file.name)}`;
      const { error: uploadError } = await supabase.storage
        .from("client-documents")
        .upload(filePath, file);

      if (uploadError) {
        setSendingInternalComment(false);
        toast.error("Não foi possível anexar o arquivo.");
        return;
      }

      content = JSON.stringify({
        type: "task_internal_attachment",
        text,
        file: {
          name: file.name,
          path: filePath,
          size: file.size,
          contentType: file.type || "application/octet-stream",
        },
      } satisfies TaskCommentAttachment);
    }

    const { error } = await supabase.from("kanban_task_comments").insert({
      task_id: task.id,
      user_id: user.id,
      content,
      ...(currentOrganizationId
        ? { organization_id: currentOrganizationId }
        : {}),
    });
    setSendingInternalComment(false);

    if (error) {
      toast.error("Não foi possível registrar o andamento da tarefa.");
      return;
    }

    setNewInternalComment("");
    setSelectedInternalFile(null);
    if (internalFileInputRef.current) internalFileInputRef.current.value = "";
    onHistory?.(
      task.id,
      file ? "Andamento interno com anexo registrado" : "Andamento interno registrado",
      text || file?.name,
    );
    void fetchTaskComments();
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <Tabs defaultValue="informacoes" className="space-y-4">
          <TabsList className="sticky top-0 z-20 grid w-full grid-cols-3 bg-muted/90 backdrop-blur">
            <TabsTrigger value="informacoes">Informações</TabsTrigger>
            <TabsTrigger value="chat">Cliente</TabsTrigger>
            <TabsTrigger value="historico">Histórico</TabsTrigger>
          </TabsList>

        <SheetHeader className="pb-4">
          <SheetTitle className="text-lg">{task.title}</SheetTitle>
        </SheetHeader>

        <div className="space-y-6 pb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Building2 className="h-3 w-3" /> Cliente
              </span>
              <span className="text-sm font-medium">
                {form.client_name || "Não informado"}
              </span>
            </div>
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <CalendarDays className="h-3 w-3" /> Prazo
              </span>
              <span className="text-sm font-medium">
                {form.due_date
                  ? new Date(form.due_date).toLocaleDateString("pt-BR")
                  : "Sem prazo"}
              </span>
            </div>
            <div className="space-y-1 sm:col-span-2">
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <User className="h-3 w-3" /> Criada por
              </span>
              <span className="text-xs text-muted-foreground">
                {creatorName || (task.created_by ? "Usuário registrado" : "Não informado")}
              </span>
            </div>
          </div>

          <Separator />

            <TabsContent value="informacoes" className="flex flex-col gap-4">
              <Collapsible
                open={detailsOpen}
                onOpenChange={setDetailsOpen}
                className="order-1 rounded-lg border bg-muted/20"
              >
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40"
                  >
                    <div className="min-w-0 space-y-1">
                      <p className="text-sm font-semibold">
                        Editar detalhes da tarefa
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {statusLabels[form.status]} - {form.priority} -{" "}
                        {form.due_date
                          ? new Date(form.due_date).toLocaleDateString("pt-BR")
                          : "Sem prazo"}
                      </p>
                    </div>
                    <ChevronDown
                      className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
                        detailsOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-4 border-t px-4 py-4">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(value) =>
                    setForm((prev) => ({
                      ...prev,
                      status: value as KanbanStatus,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="backlog">Backlog</SelectItem>
                    <SelectItem value="todo">A Fazer</SelectItem>
                    <SelectItem value="doing">Em Andamento</SelectItem>
                    <SelectItem value="review">Em Revisão</SelectItem>
                    <SelectItem value="done">Concluído</SelectItem>
                    {canArchive && (
                      <SelectItem value="archived">Arquivado</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Prioridade</Label>
                  <Select
                    value={form.priority}
                    onValueChange={(value) =>
                      setForm((prev) => ({ ...prev, priority: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {priorityOptions.map((priority) => (
                        <SelectItem key={priority} value={priority}>
                          {priority}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Prazo</Label>
                  <Input
                    type="date"
                    value={form.due_date}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        due_date: event.target.value,
                      }))
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Cliente</Label>
                  <Input
                    value={form.client_name}
                    readOnly
                    aria-readonly="true"
                    className="bg-muted/40 text-muted-foreground"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Responsável</Label>
                  <Select
                    value={form.assigned_to_user_id || "unassigned"}
                    onValueChange={(value) => {
                      const selected = filteredAssigneeOptions.find(
                        (option) => option.id === value,
                      );
                      setForm((prev) => ({
                        ...prev,
                        assigned_to_user_id:
                          value === "unassigned" ? "" : value,
                        assignee: selected?.name || "",
                      }));
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sem responsável" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned">
                        Sem responsável
                      </SelectItem>
                      {filteredAssigneeOptions.length > 0 && (
                        <SelectGroup>
                          <SelectLabel className="px-2 text-xs font-medium text-muted-foreground">
                            Responsáveis dos setores selecionados
                          </SelectLabel>
                          {filteredAssigneeOptions.map((option) => (
                            <SelectItem key={option.id} value={option.id}>
                              {formatTaskAssigneeLabel(option)}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      )}
                      {form.sectors.length === 0 && (
                        <SelectItem value="select-sector-first" disabled>
                          Selecione um setor primeiro
                        </SelectItem>
                      )}
                      {form.sectors.length > 0 &&
                        filteredAssigneeOptions.length === 0 && (
                          <SelectItem value="no-sector-assignees" disabled>
                            Nenhum responsável nos setores selecionados
                          </SelectItem>
                        )}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Setores (seleção múltipla)</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 rounded-lg border p-3">
                  {sectorOptions.map((sector) => (
                    <label
                      key={sector}
                      className="flex items-center gap-2 text-sm cursor-pointer"
                    >
                      <Checkbox
                        checked={form.sectors.includes(sector)}
                        onCheckedChange={() => toggleSector(sector)}
                      />
                      <span>{sector}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Descrição</Label>
                <Textarea
                  rows={4}
                  value={form.description}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      description: event.target.value,
                    }))
                  }
                  placeholder="Detalhes da tarefa..."
                />
              </div>

              <div className="space-y-2 rounded-lg border bg-muted/20 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Paperclip className="h-4 w-4 text-muted-foreground" />
                    <Label className="text-sm">Arquivos anexados na criacao</Label>
                  </div>
                  {requestDocuments.length > 0 && (
                    <Badge variant="secondary" className="rounded-full">
                      {requestDocuments.length}
                    </Badge>
                  )}
                </div>
                {requestDocumentsQuery.isLoading ? (
                  <div className="flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Carregando arquivos...
                  </div>
                ) : requestDocuments.length === 0 ? (
                  <div className="rounded-md border border-dashed bg-background px-3 py-3 text-xs text-muted-foreground">
                    Nenhum arquivo foi anexado na criacao desta tarefa.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {requestDocuments.map((document) => (
                      <button
                        key={document.id}
                        type="button"
                        className="flex w-full items-center gap-3 rounded-md border bg-background px-3 py-2 text-left transition-colors hover:bg-muted/50"
                        onClick={() => handleDownloadAttachment(document.file_path)}
                      >
                        <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{document.file_name}</span>
                          <span className="block truncate text-[11px] text-muted-foreground">
                            {document.category || "Arquivo da tarefa"} - {formatFileSize(document.file_size || 0)}
                          </span>
                        </span>
                        <Download className="h-4 w-4 shrink-0 text-muted-foreground" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {task.subtasks.length > 0 && (
                <div className="space-y-3 rounded-lg border p-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Empresas (subtarefas)</Label>
                    <span className="text-xs text-muted-foreground">
                      {subtaskDone}/{task.subtasks.length} concluídas (
                      {subtaskPct}%)
                    </span>
                  </div>
                  <Progress value={subtaskPct} className="h-2" />
                  <div className="space-y-2">
                    {task.subtasks.map((subtask, index) => (
                      <label
                        key={`${subtask.title}-${index}`}
                        className="flex items-center gap-2 text-sm cursor-pointer"
                      >
                        <Checkbox
                          checked={subtask.done}
                          onCheckedChange={() =>
                            onSubtaskToggle?.(task.id, index)
                          }
                        />
                        <span
                          className={
                            subtask.done
                              ? "line-through text-muted-foreground"
                              : ""
                          }
                        >
                          {subtask.title}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

                </CollapsibleContent>
              </Collapsible>

              <div className="order-2 space-y-3 rounded-lg border p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Link2 className="h-4 w-4" />
                    Tarefas relacionadas
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">
                      {relatedTasks.length}
                    </Badge>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1 text-xs"
                      onClick={() => onCreateRelatedTask?.(task.id)}
                    >
                      <Link2 className="h-3.5 w-3.5" />
                      Criar tarefa relacionada
                    </Button>
                  </div>
                </div>
                {relatedTasks.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Nenhuma tarefa relacionada. Relações são apenas informativas e não bloqueiam status, revisão ou conclusão.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {relatedTasks.map((relatedTask) => (
                      <div
                        key={relatedTask.relationId}
                        className="flex items-center gap-2 rounded-lg bg-muted/40 px-3 py-2"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium">
                            {relatedTask.title}
                          </div>
                          <div className="mt-0.5 flex flex-wrap gap-1.5 text-xs text-muted-foreground">
                            <span>{relatedTask.clientName || "Sem cliente"}</span>
                            {relatedTask.status && <span>â€¢ {relatedTask.status}</span>}
                            {relatedTask.priority && <span>â€¢ {relatedTask.priority}</span>}
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0"
                          onClick={() => onOpenRelatedTask?.(relatedTask.taskId)}
                          aria-label={`Abrir tarefa relacionada ${relatedTask.title}`}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                          onClick={() => onRemoveRelatedTask?.(relatedTask.relationId)}
                          aria-label={`Remover relação com ${relatedTask.title}`}
                        >
                          <Unlink className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="order-3 rounded-lg border">
                <div className="border-b px-3 py-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <MessageSquare className="h-4 w-4" />
                    Andamento
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Comunicação interna da equipe vinculada a esta tarefa. Use este espaço para registrar decisões, contexto operacional e arquivos internos.
                  </p>
                </div>

                <div className="h-[clamp(360px,52vh,640px)] space-y-3 overflow-y-auto p-4">
                  {loadingComments ? (
                    <div className="flex h-full min-h-[320px] items-center justify-center">
                      <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    </div>
                  ) : internalTaskComments.length === 0 ? (
                    <div className="flex h-full min-h-[320px] items-center justify-center text-center">
                      <div>
                        <MessageSquare className="mx-auto mb-2 h-7 w-7 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">
                          Nenhum andamento interno registrado.
                        </p>
                      </div>
                    </div>
                  ) : (
                    internalTaskComments.map((comment) => {
                      const isOwn = comment.user_id === user?.id;
                      const attachment = parseTaskCommentAttachment(comment.content);
                      const internalMessage = parseInternalTaskMessage(comment.content);
                      const sectorMessage = parseSectorAddedMessage(comment.content);
                      const displayName =
                        comment.profile?.display_name?.trim() ||
                        (isOwn ? "Você" : "Equipe");
                      const text = attachment?.text || internalMessage?.text || sectorMessage?.text || "";

                      return (
                        <div
                          key={comment.id}
                          className={`flex ${isOwn ? "justify-end" : "justify-start"}`}
                        >
                          <div
                              className={`max-w-[86%] rounded-2xl px-3 py-2 ${isOwn ? "rounded-br-md bg-muted text-foreground" : "rounded-bl-md bg-muted/70"}`}
                          >
                            <div className="mb-1 flex items-center justify-between gap-3">
                              <span className="text-xs font-semibold opacity-80">
                                {displayName}
                              </span>
                              <span className="text-[10px] text-muted-foreground">
                                {new Date(comment.created_at).toLocaleString(
                                  "pt-BR",
                                  {
                                    day: "2-digit",
                                    month: "2-digit",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  },
                                )}
                              </span>
                            </div>
                            <div className="space-y-2">
                              {text && (
                                <p className="whitespace-pre-wrap break-words text-sm leading-6">
                                  {text}
                                </p>
                              )}
                              {attachment && (
                                <button
                                  type="button"
                                  className="flex w-full items-center gap-2 rounded-lg border bg-background px-3 py-2 text-left text-xs transition-colors hover:bg-muted/70"
                                  onClick={() => handleDownloadAttachment(attachment.file.path)}
                                >
                                  <FileText className="h-4 w-4 shrink-0" />
                                  <span className="min-w-0 flex-1">
                                    <span className="block truncate font-medium">
                                      {attachment.file.name}
                                    </span>
                                    <span className="block text-muted-foreground">
                                      {formatFileSize(attachment.file.size)}
                                    </span>
                                  </span>
                                  <Download className="h-3.5 w-3.5 shrink-0" />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={internalCommentsBottomRef} />
                </div>

                <div className="border-t p-4">
                  {selectedInternalFile && (
                    <div className="mb-2 flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-xs">
                      <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="min-w-0 flex-1 truncate">
                        {selectedInternalFile.name}
                      </span>
                      <span className="text-muted-foreground">
                        {formatFileSize(selectedInternalFile.size)}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => {
                          setSelectedInternalFile(null);
                          if (internalFileInputRef.current) internalFileInputRef.current.value = "";
                        }}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                  <input
                    ref={internalFileInputRef}
                    type="file"
                    className="hidden"
                    onChange={(event) => setSelectedInternalFile(event.target.files?.[0] || null)}
                  />
                  <div className="flex items-end gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-12 w-12 shrink-0"
                      onClick={() => internalFileInputRef.current?.click()}
                      disabled={sendingInternalComment}
                    >
                      <Paperclip className="h-4 w-4" />
                    </Button>
                    <Textarea
                      rows={3}
                      value={newInternalComment}
                      onChange={(event) => setNewInternalComment(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && !event.shiftKey) {
                          event.preventDefault();
                          void handleSendInternalTaskComment();
                        }
                      }}
                      placeholder="Registre um andamento interno..."
                      className="min-h-[72px] resize-none text-sm"
                    />
                    <Button
                      type="button"
                      size="icon"
                      className="h-12 w-12 shrink-0"
                      onClick={() => void handleSendInternalTaskComment()}
                      disabled={sendingInternalComment || (!newInternalComment.trim() && !selectedInternalFile)}
                    >
                      {sendingInternalComment ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    Comunicação interna. Enter para enviar. Shift+Enter para nova linha.
                  </p>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="chat" className="space-y-4">
              <div className="overflow-hidden rounded-lg border">
                <div className="border-b px-3 py-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <MessageSquare className="h-4 w-4" />
                    WhatsApp do cliente
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Esta aba mostra somente as mensagens selecionadas como contexto desta tarefa.
                  </p>
                </div>

                {!task.client_name ? (
                  <div className="flex h-[360px] items-center justify-center p-4 text-center">
                    <p className="max-w-xs text-sm text-muted-foreground">
                      Esta tarefa ainda não possui cliente vinculado. Informe o cliente nos detalhes da tarefa para exibir o WhatsApp.
                    </p>
                  </div>
                ) : whatsappLoading ? (
                  <div className="flex h-[360px] items-center justify-center">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  </div>
                ) : !taskClientQuery.data ? (
                  <div className="flex h-[360px] items-center justify-center p-4 text-center">
                    <p className="max-w-xs text-sm text-muted-foreground">
                      Não encontrei um cliente ativo com este nome no cadastro. Ajuste o cliente da tarefa para conectar ao WhatsApp.
                    </p>
                  </div>
                ) : !whatsappConversation ? (
                  <div className="flex h-[360px] items-center justify-center p-4 text-center">
                    <p className="max-w-xs text-sm text-muted-foreground">
                      Este cliente ainda não possui conversa WhatsApp vinculada. Vincule uma conversa no modulo WhatsApp para usar este chat aqui.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="h-[clamp(360px,48vh,560px)] space-y-3 overflow-y-auto bg-[#efeae2] bg-[radial-gradient(circle_at_1px_1px,rgba(15,23,42,0.08)_1px,transparent_0)] bg-[size:22px_22px] p-4">
                      {taskContextWhatsAppMessages.length === 0 ? (
                        <div className="flex h-full min-h-[280px] items-center justify-center text-center">
                          <p className="rounded-lg bg-white/80 px-4 py-2 text-sm text-slate-500 shadow-sm">
                            Nenhuma mensagem foi selecionada como contexto desta tarefa.
                          </p>
                        </div>
                      ) : (
                        taskContextWhatsAppMessages.map((message) => (
                          <MessageBubble key={message.id} message={message} contactInitials={whatsappContactInitials} />
                        ))
                      )}
                      <div ref={whatsappMessagesBottomRef} />
                    </div>
                    <MessageComposer
                      conversation={whatsappConversation}
                      sending={whatsappSending}
                      onSendText={async (text) => {
                        if (!task) return;
                        await sendWhatsAppTextMutation.mutateAsync({
                          text,
                          clientMessageId: createClientMessageId(),
                          waitCustomer: requiresCustomerResponse,
                        });
                      }}
                      onSendFile={async (file) => {
                        await sendWhatsAppFileMutation.mutateAsync({ file, clientMessageId: createClientMessageId() });
                      }}
                    />
                    <label className="mt-2 flex items-center gap-2 rounded-lg bg-white/70 px-3 py-2 text-xs text-slate-600">
                      <Checkbox
                        checked={requiresCustomerResponse}
                        onCheckedChange={(checked) => setRequiresCustomerResponse(checked === true)}
                      />
                      Marcar ticket como aguardando retorno do cliente após enviar
                    </label>
                  </>
                )}
              </div>
            </TabsContent>
            <TabsContent value="historico" className="space-y-3">
              {historyEntries.length === 0 ? (
                <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                  Nenhuma alteração registrada para esta tarefa.
                </div>
              ) : (
                historyEntries.map((entry) => (
                  <div key={entry.id} className="rounded-lg border p-3">
                    <div className="text-sm font-medium">{entry.action}</div>
                    {entry.details && (
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {entry.details}
                      </div>
                    )}
                    <div className="text-[11px] text-muted-foreground mt-1">
                      {new Date(entry.createdAt).toLocaleString("pt-BR")} -{" "}
                      {entry.actor}
                    </div>
                  </div>
                ))
              )}
            </TabsContent>

          <Separator />

          <div className="flex gap-2">
            <Button className="flex-1" onClick={handleSave} disabled={saving}>
              {saving ? "Salvando..." : "Salvar alterações"}
            </Button>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
          </div>
        </div>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
