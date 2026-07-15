import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  FolderOpen,
  Loader2,
  MessageSquare,
  Paperclip,
  Send,
  User,
  X,
} from "lucide-react";
import { toast } from "sonner";
import type { ChangeHistoryEntry } from "@/lib/changeHistory";
import { useAuth } from "@/hooks/useAuth";
import {
  formatTaskAssigneeLabel,
  loadTaskAssignees,
  type TaskAssigneeOption,
} from "@/lib/taskAssignees";
import { normalizeSectorCode, type SectorCode } from "@/lib/userPermissions";

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
  historyEntries?: ChangeHistoryEntry[];
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

export function KanbanTaskDetailSheet({
  task,
  open,
  saving = false,
  canArchive = false,
  onOpenChange,
  onSave,
  onSubtaskToggle,
  onHistory,
  historyEntries = [],
}: KanbanTaskDetailSheetProps) {
  const { user, currentOrganizationId } = useAuth();
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
  const [sendingComment, setSendingComment] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [selectedCommentFile, setSelectedCommentFile] = useState<File | null>(null);
  const [sendingInternalComment, setSendingInternalComment] = useState(false);
  const [newInternalComment, setNewInternalComment] = useState("");
  const [selectedInternalFile, setSelectedInternalFile] = useState<File | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [creatorName, setCreatorName] = useState<string | null>(null);
  const [assigneeOptions, setAssigneeOptions] = useState<TaskAssigneeOption[]>(
    [],
  );
  const commentsBottomRef = useRef<HTMLDivElement | null>(null);
  const commentFileInputRef = useRef<HTMLInputElement | null>(null);
  const internalCommentsBottomRef = useRef<HTMLDivElement | null>(null);
  const internalFileInputRef = useRef<HTMLInputElement | null>(null);

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
    setSelectedCommentFile(null);
    setSelectedInternalFile(null);
    setNewInternalComment("");
    setNewComment("");
    if (commentFileInputRef.current) commentFileInputRef.current.value = "";
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
    commentsBottomRef.current?.scrollIntoView({ behavior: "smooth" });
    internalCommentsBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [taskComments.length]);

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
  const clientTaskComments = taskComments.filter((comment) => !isInternalTaskComment(comment.content));
  const internalTaskComments = taskComments.filter((comment) => isInternalTaskComment(comment.content));
  const subtaskDone = task.subtasks.filter((subtask) => subtask.done).length;
  const subtaskPct = task.subtasks.length
    ? Math.round((subtaskDone / task.subtasks.length) * 100)
    : 0;

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

  const handleSendTaskComment = async () => {
    const text = newComment.trim();
    const file = selectedCommentFile;
    if (!task?.id || !user?.id || (!text && !file)) return;

    setSendingComment(true);
    let content = text;

    if (file) {
      const filePath = `${user.id}/task-chat/${task.id}/${Date.now()}-${sanitizeStorageFileName(file.name)}`;
      const { error: uploadError } = await supabase.storage
        .from("client-documents")
        .upload(filePath, file);

      if (uploadError) {
        setSendingComment(false);
        toast.error("Não foi possível anexar o arquivo.");
        return;
      }

      content = JSON.stringify({
        type: "task_chat_attachment",
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
    setSendingComment(false);

    if (error) {
      toast.error("Não foi possível enviar a mensagem da tarefa.");
      return;
    }

    setNewComment("");
    setSelectedCommentFile(null);
    if (commentFileInputRef.current) commentFileInputRef.current.value = "";
    onHistory?.(
      task.id,
      file ? "Mensagem/anexo enviado ao chat do cliente" : "Mensagem enviada ao chat do cliente",
      text || file?.name,
    );
    void fetchTaskComments();
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
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="pb-4">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="text-xs border-0 bg-muted">
              {form.priority}
            </Badge>
            <Badge
              variant="outline"
              className="text-xs border-0 bg-primary/10 text-primary"
            >
              {statusLabels[form.status]}
            </Badge>
          </div>
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
                <User className="h-3 w-3" /> Responsável
              </span>
              <span className="text-sm font-medium">
                {form.assignee || "Não informado"}
              </span>
            </div>
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <FolderOpen className="h-3 w-3" /> Setores
              </span>
              <span className="text-sm font-medium">
                {form.sectors.length > 0
                  ? form.sectors.join(", ")
                  : "Não informado"}
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

          <Tabs defaultValue="informacoes" className="space-y-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="informacoes">Informações</TabsTrigger>
              <TabsTrigger value="chat">Chat</TabsTrigger>
              <TabsTrigger value="historico">Histórico</TabsTrigger>
            </TabsList>

            <TabsContent value="informacoes" className="space-y-4">
              <Collapsible
                open={detailsOpen}
                onOpenChange={setDetailsOpen}
                className="rounded-lg border bg-muted/20"
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
                        <SelectLabel className="px-2 text-xs font-medium text-muted-foreground">
                          Responsáveis dos setores selecionados
                        </SelectLabel>
                      )}
                      {filteredAssigneeOptions.map((option) => (
                        <SelectItem key={option.id} value={option.id}>
                          {formatTaskAssigneeLabel(option)}
                        </SelectItem>
                      ))}
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

              <div className="rounded-lg border">
                <div className="border-b px-3 py-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <MessageSquare className="h-4 w-4" />
                    Andamento
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Comunicação interna da equipe vinculada a esta tarefa. Use este espaço para registrar decisões, contexto operacional e arquivos internos.
                  </p>
                </div>

                <div className="max-h-[420px] min-h-[260px] space-y-3 overflow-y-auto p-4">
                  {loadingComments ? (
                    <div className="flex h-[240px] items-center justify-center">
                      <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    </div>
                  ) : internalTaskComments.length === 0 ? (
                    <div className="flex h-[240px] items-center justify-center text-center">
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
              <div className="rounded-lg border">
                <div className="border-b px-3 py-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <MessageSquare className="h-4 w-4" />
                    Chat da tarefa
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Use este chat apenas para alinhamentos e arquivos de tarefas relacionadas ao cliente.
                  </p>
                </div>

                <div className="max-h-[320px] min-h-[220px] space-y-3 overflow-y-auto p-3">
                  {loadingComments ? (
                    <div className="flex h-[180px] items-center justify-center">
                      <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    </div>
                  ) : clientTaskComments.length === 0 ? (
                    <div className="flex h-[180px] items-center justify-center text-center">
                      <div>
                        <MessageSquare className="mx-auto mb-2 h-7 w-7 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">
                          Nenhuma mensagem nesta tarefa.
                        </p>
                      </div>
                    </div>
                  ) : (
                    clientTaskComments.map((comment) => {
                      const isOwn = comment.user_id === user?.id;
                      const attachment = parseTaskCommentAttachment(comment.content);
                      const displayName =
                        comment.profile?.display_name?.trim() ||
                        (isOwn ? "Você" : "Equipe");

                      return (
                        <div
                          key={comment.id}
                          className={`flex ${isOwn ? "justify-end" : "justify-start"}`}
                        >
                          <div
                            className={`max-w-[86%] rounded-2xl px-3 py-2 ${isOwn ? "rounded-br-md bg-primary text-primary-foreground" : "rounded-bl-md bg-muted"}`}
                          >
                            <div className="mb-1 flex items-center justify-between gap-3">
                              <span className="text-xs font-semibold opacity-80">
                                {displayName}
                              </span>
                              <span
                                className={`text-[10px] ${isOwn ? "text-primary-foreground/70" : "text-muted-foreground"}`}
                              >
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
                            {attachment ? (
                              <div className="space-y-2">
                                {attachment.text && (
                                  <p className="whitespace-pre-wrap break-words text-sm leading-6">
                                    {attachment.text}
                                  </p>
                                )}
                                <button
                                  type="button"
                                  className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs transition-colors ${
                                    isOwn
                                      ? "border-primary-foreground/25 bg-primary-foreground/10 hover:bg-primary-foreground/15"
                                      : "border-border bg-background hover:bg-muted/70"
                                  }`}
                                  onClick={() => handleDownloadAttachment(attachment.file.path)}
                                >
                                  <FileText className="h-4 w-4 shrink-0" />
                                  <span className="min-w-0 flex-1">
                                    <span className="block truncate font-medium">
                                      {attachment.file.name}
                                    </span>
                                    <span className="block opacity-70">
                                      {formatFileSize(attachment.file.size)}
                                    </span>
                                  </span>
                                  <Download className="h-3.5 w-3.5 shrink-0" />
                                </button>
                              </div>
                            ) : (
                              <p className="whitespace-pre-wrap break-words text-sm leading-6">
                                {comment.content}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={commentsBottomRef} />
                </div>

                <div className="border-t p-3">
                  {selectedCommentFile && (
                    <div className="mb-2 flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-xs">
                      <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="min-w-0 flex-1 truncate">
                        {selectedCommentFile.name}
                      </span>
                      <span className="text-muted-foreground">
                        {formatFileSize(selectedCommentFile.size)}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => {
                          setSelectedCommentFile(null);
                          if (commentFileInputRef.current) commentFileInputRef.current.value = "";
                        }}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                  <input
                    ref={commentFileInputRef}
                    type="file"
                    className="hidden"
                    onChange={(event) => setSelectedCommentFile(event.target.files?.[0] || null)}
                  />
                  <div className="flex items-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-10 w-10 shrink-0"
                      onClick={() => commentFileInputRef.current?.click()}
                      disabled={sendingComment}
                    >
                      <Paperclip className="h-4 w-4" />
                    </Button>
                    <Textarea
                      rows={2}
                      value={newComment}
                      onChange={(event) => setNewComment(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && !event.shiftKey) {
                          event.preventDefault();
                          void handleSendTaskComment();
                        }
                      }}
                      placeholder="Escreva uma mensagem sobre esta tarefa..."
                      className="resize-none text-sm"
                    />
                    <Button
                      type="button"
                      size="icon"
                      className="h-10 w-10 shrink-0"
                      onClick={() => void handleSendTaskComment()}
                      disabled={sendingComment || (!newComment.trim() && !selectedCommentFile)}
                    >
                      {sendingComment ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    Enter para enviar. Shift+Enter para nova linha.
                  </p>
                </div>
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
          </Tabs>

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
      </SheetContent>
    </Sheet>
  );
}
