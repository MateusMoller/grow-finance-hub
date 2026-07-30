import { AppLayout } from "@/components/app/AppLayout";
import { ModuleContextPill } from "@/components/app/ModuleContextPill";
import {
  KanbanTaskDetailSheet,
  type KanbanStatus,
  type KanbanTaskItem,
} from "@/components/app/KanbanTaskDetailSheet";
import { TaskOriginLegend } from "@/components/app/TaskOriginLegend";
import { TaskOriginRibbon } from "@/components/app/TaskOriginRibbon";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useGlobalFilters } from "@/hooks/useGlobalFilters";
import { invokeGrowObligations } from "@/lib/growObligations";
import { motion } from "framer-motion";
import { Archive, CalendarDays, Check, ChevronDown, ChevronsUpDown, Filter, KanbanSquare, Loader2, Plus, Search, X } from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type DragEvent,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  getTaskCompetence,
  matchesSelectedCompany,
  matchesSelectedCompetence,
} from "@/lib/globalFilters";
import {
  getTaskHistoryEntries,
  recordTaskHistoryEntry,
  type ChangeHistoryEntry,
} from "@/lib/changeHistory";
import {
  canCreateTaskInSector,
  canViewTaskByCanonicalScope,
  getCanonicalTaskSectorAccess,
  normalizeTaskSectorLabel,
} from "@/lib/taskSectorAccess";
import {
  formatTaskAssigneeLabel,
  loadTaskAssignees,
  type TaskAssigneeOption,
} from "@/lib/taskAssignees";
import { normalizeSectorCode, type SectorCode } from "@/lib/userPermissions";
import {
  createTaskRelations,
  deleteTaskRelation,
  loadRelatedTasks,
  type RelatedTaskSummary,
} from "@/lib/taskRelations";

const baseColumns: { id: KanbanStatus; label: string; color: string }[] = [
  { id: "backlog", label: "Backlog", color: "bg-muted-foreground" },
  { id: "todo", label: "A Fazer", color: "bg-amber-500" },
  { id: "doing", label: "Em Andamento", color: "bg-primary" },
  { id: "review", label: "Revisão", color: "bg-purple-500" },
  { id: "done", label: "Concluído", color: "bg-primary" },
];

const archiveColumn: { id: KanbanStatus; label: string; color: string } = {
  id: "archived",
  label: "Arquivo",
  color: "bg-slate-500",
};

const AUTO_ARCHIVE_COMPLETED_AFTER_DAYS = 3;
const AUTO_ARCHIVE_COMPLETED_AFTER_MS = AUTO_ARCHIVE_COMPLETED_AFTER_DAYS * 24 * 60 * 60 * 1000;
const obligationTaskSource = "grow_obligation_task";
const obligationReadyForReviewStatuses = new Set(["em_revisao", "pronto_para_envio", "concluida"]);

const sectors = [
  "Contábil",
  "Fiscal",
  "Departamento Pessoal",
  "Comercial",
  "Societário",
  "Geral",
];

const taskSectorOptions = [
  "Contábil",
  "Fiscal",
  "Departamento Pessoal",
  "Comercial",
  "Societário",
  "Geral",
];

const priorityDot: Record<string, string> = {
  Urgente: "bg-destructive",
  Alta: "bg-orange-500",
  Média: "bg-amber-500",
  Media: "bg-amber-500",
  Baixa: "bg-muted-foreground",
};

const taskOriginFilterOptions = [
  { value: "all", label: "Todas as origens" },
  { value: "portal", label: "Portal do Cliente" },
  { value: "obligations", label: "Obrigações" },
  { value: "internal", label: "Criação Interna" },
];

const taskPriorityFilterOptions = ["Urgente", "Alta", "Média", "Baixa"];

const normalizeSector = (value: string) =>
  value
    .replace("Cont\u00c3\u00a1bil", "Contábil")
    .replace("Cont\u00c3\u0192\u00c2\u00a1bil", "Contábil")
    .replace("Societ\u00c3\u00a1rio", "Societário")
    .replace("Societ\u00c3\u0192\u00c2\u00a1rio", "Societário")
    .trim();

const normalizePriority = (value: string) =>
  value
    .replace("M\u00c3\u00a9dia", "Média")
    .replace("M\u00c3\u0192\u00c2\u00a9dia", "Média")
    .replace("M\u00c3\u0192\u00c6\u2019\u00c3\u00a2\u20ac\u0161\u00c3\u201a\u00c2\u00a9dia", "Média")
    .trim();

const normalizeText = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const normalizeVisibleSector = (value: string) =>
  normalizeTaskSectorLabel(normalizeSector(value));

const isObligationTask = (task: Pick<KanbanTaskItem, "integration_source">) =>
  task.integration_source === obligationTaskSource;

const getTaskOriginFilterValue = (task: Pick<KanbanTaskItem, "request_id" | "integration_source">) => {
  if (isObligationTask(task)) return "obligations";
  if (task.request_id) return "portal";
  return "internal";
};

const getObligationInstanceId = (task: Pick<KanbanTaskItem, "integration_task_id">) => {
  const value = task.integration_task_id || "";
  return value.startsWith("instance:") ? value.slice("instance:".length) : "";
};

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const getObligationTemplateId = (task: Pick<KanbanTaskItem, "integration_payload">) => {
  const payload = asRecord(task.integration_payload);
  return typeof payload.template_id === "string" ? payload.template_id : "";
};

const getObligationCompetenceKey = (task: Pick<KanbanTaskItem, "integration_payload">) => {
  const payload = asRecord(task.integration_payload);
  return typeof payload.target_competence_key === "string" ? payload.target_competence_key : "";
};

const getObligationGroupName = (task: Pick<KanbanTaskItem, "title" | "client_name">) => {
  const title = task.title || "Obrigação";
  const clientName = task.client_name?.trim();
  if (clientName && title.endsWith(` - ${clientName}`)) {
    return title.slice(0, -` - ${clientName}`.length).trim() || title;
  }
  return title.split(" - ")[0]?.trim() || title;
};

const formatTaskCreatedDate = (value: string | null | undefined) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
};

const shouldAutoArchiveCompletedTask = (task: { status: string; updated_at?: string | null }) => {
  if (task.status !== "done" || !task.updated_at) return false;
  const updatedAt = new Date(task.updated_at).getTime();
  if (Number.isNaN(updatedAt)) return false;
  return Date.now() - updatedAt > AUTO_ARCHIVE_COMPLETED_AFTER_MS;
};

const isSubtasksColumnIssue = (errorMessage: string | undefined) => {
  const normalized = normalizeText(errorMessage || "");
  if (!normalized.includes("subtasks")) return false;
  return normalized.includes("column") || normalized.includes("permission");
};

interface ClientOption {
  id: string;
  name: string;
}

interface TaskSubtask {
  title: string;
  done: boolean;
}

const parseSubtasks = (value: unknown): TaskSubtask[] => {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;

      const subtask = item as { title?: unknown; done?: unknown };
      const title =
        typeof subtask.title === "string" ? subtask.title.trim() : "";
      if (!title) return null;

      return {
        title,
        done: Boolean(subtask.done),
      };
    })
    .filter((item): item is TaskSubtask => item !== null);
};

const tasksByStatusTemplate = (): Record<KanbanStatus, KanbanTaskItem[]> => ({
  backlog: [],
  todo: [],
  doing: [],
  review: [],
  done: [],
  archived: [],
});

const kanbanTaskListColumns = [
  "id",
  "title",
  "client_name",
  "assignee",
  "assigned_to_user_id",
  "priority",
  "sector",
  "status",
  "due_date",
  "tags",
  "request_id",
  "created_at",
  "created_by",
  "updated_at",
  "integration_source",
  "integration_task_id",
  "integration_payload",
].join(",");

const normalizeKanbanTask = (task: Record<string, unknown>): KanbanTaskItem => ({
  ...(task as unknown as KanbanTaskItem),
  description: typeof task.description === "string" ? task.description : null,
  client_name: typeof task.client_name === "string" ? task.client_name : null,
  assignee: typeof task.assignee === "string" ? task.assignee : null,
  priority: normalizePriority(String(task.priority || "")),
  sector: normalizeVisibleSector(String(task.sector || "")),
  status: String(task.status || "backlog") as KanbanStatus,
  due_date: typeof task.due_date === "string" ? task.due_date : null,
  tags: (Array.isArray(task.tags) && task.tags.length
    ? task.tags
    : task.sector
      ? [task.sector]
      : []
  ).map((sector) => normalizeVisibleSector(String(sector))),
  subtasks: parseSubtasks(task.subtasks),
  request_id: typeof task.request_id === "string" ? task.request_id : null,
  created_at: String(task.created_at || new Date().toISOString()),
  integration_source:
    typeof task.integration_source === "string"
      ? task.integration_source
      : null,
  integration_task_id:
    typeof task.integration_task_id === "string"
      ? task.integration_task_id
      : null,
});

interface ObligationTaskGroup {
  id: string;
  name: string;
  competenceKey: string;
  sector: string;
  priority: string;
  dueDate: string | null;
  tasks: KanbanTaskItem[];
}

const groupBacklogObligationTasks = (tasks: KanbanTaskItem[]) => {
  const groups = new Map<string, ObligationTaskGroup>();
  const regularTasks: KanbanTaskItem[] = [];

  tasks.forEach((task) => {
    if (!isObligationTask(task)) {
      regularTasks.push(task);
      return;
    }

    const templateId = getObligationTemplateId(task);
    const competenceKey = getObligationCompetenceKey(task);
    const name = getObligationGroupName(task);
    const groupId = [templateId || name, competenceKey || "sem-competencia", task.status].join(":");
    const existing = groups.get(groupId);

    if (existing) {
      existing.tasks.push(task);
      return;
    }

    groups.set(groupId, {
      id: groupId,
      name,
      competenceKey,
      sector: task.sector || task.tags[0] || "Geral",
      priority: task.priority,
      dueDate: task.due_date,
      tasks: [task],
    });
  });

  return {
    regularTasks,
    groups: Array.from(groups.values()).sort((left, right) =>
      left.name.localeCompare(right.name, "pt-BR") ||
      left.competenceKey.localeCompare(right.competenceKey),
    ),
  };
};

interface TaskKanbanViewProps {
  embedded?: boolean;
}

export function TaskKanbanView({ embedded = false }: TaskKanbanViewProps) {
  const { user, effectiveAccess, currentOrganizationId } = useAuth();
  const { selectedCompany, selectedCompetence } = useGlobalFilters();
  const location = useLocation();
  const navigate = useNavigate();
  const isAdmin = effectiveAccess?.primaryRole === "admin";
  const [tasks, setTasks] = useState<KanbanTaskItem[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [assigneeOptions, setAssigneeOptions] = useState<TaskAssigneeOption[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [loadingClients, setLoadingClients] = useState(true);
  const [sectorFilter, setSectorFilter] = useState<string>("all");
  const [originFilter, setOriginFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");
  const [taskSearch, setTaskSearch] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [clientPickerOpen, setClientPickerOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<KanbanTaskItem | null>(null);
  const [relatedSourceTask, setRelatedSourceTask] =
    useState<KanbanTaskItem | null>(null);
  const [savingDetail, setSavingDetail] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const [dropTargetStatus, setDropTargetStatus] = useState<KanbanStatus | null>(
    null,
  );
  const [historyVersion, setHistoryVersion] = useState(0);
  const [relationsVersion, setRelationsVersion] = useState(0);
  const [selectedTaskHistory, setSelectedTaskHistory] = useState<
    ChangeHistoryEntry[]
  >([]);
  const [selectedTaskRelations, setSelectedTaskRelations] = useState<
    RelatedTaskSummary[]
  >([]);
  const [newTask, setNewTask] = useState({
    title: "",
    client_name: "",
    assignee: "",
    assigned_to_user_id: "",
    priority: "Média",
    sector: "Contábil",
    subtasks: [] as TaskSubtask[],
  });

  const actorLabel = user?.email || "Usuário";
  const taskSectorAccess = useMemo(
    () => getCanonicalTaskSectorAccess(effectiveAccess),
    [effectiveAccess],
  );
  const availableSectors = useMemo(() => {
    if (taskSectorAccess.canAccessAllTaskSectors) return taskSectorOptions;
    return taskSectorAccess.allowedTaskSectors;
  }, [taskSectorAccess]);
  const creatableSectors = taskSectorOptions;
  const newTaskSectorCode = useMemo<SectorCode | null>(
    () => normalizeSectorCode(newTask.sector),
    [newTask.sector],
  );
  const filteredCreateAssigneeOptions = useMemo(
    () =>
      newTaskSectorCode
        ? assigneeOptions.filter(
            (option) => option.sectorCode === newTaskSectorCode,
          )
        : [],
    [assigneeOptions, newTaskSectorCode],
  );

  useEffect(() => {
    if (!newTask.assigned_to_user_id) return;

    const selected = assigneeOptions.find(
      (option) => option.id === newTask.assigned_to_user_id,
    );
    if (!newTaskSectorCode || selected?.sectorCode !== newTaskSectorCode) {
      setNewTask((prev) => ({
        ...prev,
        assignee: "",
        assigned_to_user_id: "",
      }));
    }
  }, [assigneeOptions, newTask.assigned_to_user_id, newTaskSectorCode]);

  const taskAssigneeFilterOptions = useMemo(() => {
    const options = new Map<string, string>();
    tasks.forEach((task) => {
      if (task.assigned_to_user_id) {
        const knownAssignee = assigneeOptions.find(
          (option) => option.id === task.assigned_to_user_id,
        );
        options.set(
          task.assigned_to_user_id,
          knownAssignee
            ? formatTaskAssigneeLabel(knownAssignee)
            : task.assignee || "Responsável",
        );
        return;
      }
      if (task.assignee) {
        options.set(`name:${task.assignee}`, task.assignee);
      }
    });
    return Array.from(options.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((left, right) => left.label.localeCompare(right.label, "pt-BR"));
  }, [assigneeOptions, tasks]);

  const hasLocalTaskFilters =
    sectorFilter !== "all" ||
    originFilter !== "all" ||
    priorityFilter !== "all" ||
    assigneeFilter !== "all" ||
    taskSearch.trim().length > 0;

  const activeLocalTaskFilterCount = [
    sectorFilter !== "all",
    originFilter !== "all",
    priorityFilter !== "all",
    assigneeFilter !== "all",
    taskSearch.trim().length > 0,
  ].filter(Boolean).length;

  const clearLocalTaskFilters = () => {
    setSectorFilter("all");
    setOriginFilter("all");
    setPriorityFilter("all");
    setAssigneeFilter("all");
    setTaskSearch("");
  };

  const registerTaskHistory = async (
    taskId: string,
    action: string,
    details?: string,
  ) => {
    await recordTaskHistoryEntry({
      organizationId: currentOrganizationId,
      taskId,
      action,
      details,
      actor: actorLabel,
    });
    setHistoryVersion((prev) => prev + 1);
  };

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("create") !== "1") return;

    setRelatedSourceTask(null);
    setCreateOpen(true);
    params.delete("create");
    const nextSearch = params.toString();
    navigate(
      {
        pathname: location.pathname,
        search: nextSearch ? `?${nextSearch}` : "",
      },
      { replace: true },
    );
  }, [location.pathname, location.search, navigate]);

  const openTaskDetails = useCallback(async (task: KanbanTaskItem) => {
    setSelectedTask(task);
    setDetailOpen(true);

    const { data, error } = await supabase
      .from("kanban_tasks")
      .select("*")
      .eq("id", task.id)
      .maybeSingle();

    if (error) {
      toast.error("NÃ£o foi possÃ­vel carregar os detalhes completos da tarefa.");
      return;
    }

    if (data) {
      const fullTask = normalizeKanbanTask(data as Record<string, unknown>);
      setSelectedTask(fullTask);
      setTasks((prev) =>
        prev.map((current) => current.id === fullTask.id ? { ...current, ...fullTask } : current),
      );
    }
  }, []);

  useEffect(() => {
    if (loading) return;

    const params = new URLSearchParams(location.search);
    const taskId = params.get("task");
    if (!taskId) return;

    const targetTask = tasks.find((task) => task.id === taskId);
    if (!targetTask) {
      toast.error("Tarefa da notificação não encontrada.");
      params.delete("task");
      const nextSearch = params.toString();
      navigate(
        {
          pathname: location.pathname,
          search: nextSearch ? `?${nextSearch}` : "",
        },
        { replace: true },
      );
      return;
    }

    void openTaskDetails(targetTask);
    if (targetTask.status === "archived") {
      setShowArchived(true);
    }

    params.delete("task");
    const nextSearch = params.toString();
    navigate(
      {
        pathname: location.pathname,
        search: nextSearch ? `?${nextSearch}` : "",
      },
      { replace: true },
    );
  }, [loading, location.pathname, location.search, navigate, openTaskDetails, tasks]);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("kanban_tasks")
      .select(kanbanTaskListColumns)
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Erro ao carregar tarefas");
      setLoading(false);
      return;
    }

    const tasksToAutoArchive = (data || []).filter(shouldAutoArchiveCompletedTask);
    let autoArchivedIds = new Set<string>();
    if (tasksToAutoArchive.length > 0) {
      const { error: archiveError } = await supabase
        .from("kanban_tasks")
        .update({ status: "archived", updated_at: new Date().toISOString() })
        .in("id", tasksToAutoArchive.map((task) => task.id));

      if (archiveError) {
        toast.error("Não foi possível arquivar automaticamente tarefas concluídas antigas.");
      } else {
        autoArchivedIds = new Set(tasksToAutoArchive.map((task) => task.id));
      }
    }

    const normalized = (data || []).map((task) => {
      const normalizedTask = normalizeKanbanTask(task as Record<string, unknown>);
      return {
        ...normalizedTask,
        status: (autoArchivedIds.has(normalizedTask.id) ? "archived" : normalizedTask.status) as KanbanStatus,
      };
    });
    setTasks(normalized);
    setLoading(false);
  }, []);

  const fetchClients = useCallback(async () => {
    setLoadingClients(true);
    const { data, error } = await supabase
      .from("clients")
      .select("id, name")
      .eq("status", "Ativo")
      .order("name");

    if (error) {
      toast.error("Erro ao carregar clientes cadastrados");
      setLoadingClients(false);
      return;
    }

    setClients((data || []) as ClientOption[]);
    setLoadingClients(false);
  }, []);

  const fetchAssignees = useCallback(async () => {
    try {
      setAssigneeOptions(await loadTaskAssignees(currentOrganizationId));
    } catch {
      setAssigneeOptions([]);
      toast.error("Não foi possível carregar os responsáveis.");
    }
  }, [currentOrganizationId]);

  useEffect(() => {
    void fetchTasks();
    void fetchClients();
    void fetchAssignees();
  }, [fetchAssignees, fetchClients, fetchTasks, user?.id]);

  const validateObligationStatusChange = useCallback(
    async (task: KanbanTaskItem, newStatus: KanbanStatus) => {
      if (!isObligationTask(task) || !["review", "done"].includes(newStatus)) {
        return { allowed: true };
      }

      const instanceId = getObligationInstanceId(task);
      if (!instanceId) {
        return {
          allowed: false,
          message: "Esta tarefa de obrigação não possui vínculo técnico com a competência.",
        };
      }

      const { data, error } = await supabase
        .from("obligation_instances")
        .select("id, status")
        .eq("id", instanceId)
        .maybeSingle();

      if (error || !data) {
        return {
          allowed: false,
          message: error?.message || "Não foi possível validar a competência desta obrigação.",
        };
      }

      const instanceStatus = String((data as { status?: string }).status || "");
      if (!obligationReadyForReviewStatuses.has(instanceStatus)) {
        return {
          allowed: false,
          message: "Anexe o arquivo esperado na competência correta antes de enviar esta obrigação para revisão ou conclusão.",
        };
      }

      if (newStatus === "done" && task.status !== "review" && instanceStatus !== "concluida") {
        return {
          allowed: false,
          message: "Após anexar o arquivo esperado, a tarefa deve passar pela Revisão antes de ser concluída.",
        };
      }

      return { allowed: true };
    },
    [],
  );

  const filteredTasks = tasks.filter((task) => {
    if (!isAdmin && task.status === "archived") return false;
    if (!matchesSelectedCompany(task.client_name, selectedCompany))
      return false;
    if (
      !matchesSelectedCompetence(
        getTaskCompetence(task.due_date, task.created_at),
        selectedCompetence,
      )
    )
      return false;
    const taskSectors =
      task.tags.length > 0 ? task.tags : task.sector ? [task.sector] : [];
    if (
      sectorFilter !== "all" &&
      !taskSectors.some(
        (sector) => normalizeVisibleSector(sector) === sectorFilter,
      )
    )
      return false;
    if (originFilter !== "all" && getTaskOriginFilterValue(task) !== originFilter)
      return false;
    if (priorityFilter !== "all" && normalizePriority(task.priority) !== priorityFilter)
      return false;
    if (assigneeFilter !== "all") {
      if (assigneeFilter === "unassigned") {
        if (task.assigned_to_user_id || task.assignee) return false;
      } else {
        const assigneeKey = task.assigned_to_user_id || (task.assignee ? `name:${task.assignee}` : "");
        if (assigneeKey !== assigneeFilter) return false;
      }
    }
    const searchToken = normalizeText(taskSearch);
    if (searchToken) {
      const searchable = normalizeText([
        task.title,
        task.client_name || "",
        task.assignee || "",
        task.sector || "",
        task.tags.join(" "),
      ].join(" "));
      if (!searchable.includes(searchToken)) return false;
    }
    return true;
  });

  useEffect(() => {
    if (sectorFilter === "all") return;
    if (!availableSectors.includes(sectorFilter)) setSectorFilter("all");
  }, [availableSectors, sectorFilter]);

  useEffect(() => {
    if (creatableSectors.length === 0) return;
    if (!creatableSectors.includes(newTask.sector)) {
      setNewTask((prev) => ({ ...prev, sector: creatableSectors[0] }));
    }
  }, [creatableSectors, newTask.sector]);

  const tasksByStatus = useMemo(() => {
    const grouped = tasksByStatusTemplate();
    filteredTasks.forEach((task) => {
      grouped[task.status].push(task);
    });
    return grouped;
  }, [filteredTasks]);
  const archivedCount = tasksByStatus.archived.length;

  useEffect(() => {
    if (!currentOrganizationId || !selectedTask?.id) {
      setSelectedTaskHistory([]);
      return;
    }

    let cancelled = false;
    const loadHistory = async () => {
      const history = await getTaskHistoryEntries(
        currentOrganizationId,
        selectedTask.id,
        30,
      );
      if (!cancelled) setSelectedTaskHistory(history);
    };

    void loadHistory();
    return () => {
      cancelled = true;
    };
  }, [currentOrganizationId, historyVersion, selectedTask?.id]);

  useEffect(() => {
    if (!currentOrganizationId || !selectedTask?.id) {
      setSelectedTaskRelations([]);
      return;
    }

    let cancelled = false;
    const loadRelations = async () => {
      try {
        const relations = await loadRelatedTasks(
          currentOrganizationId,
          selectedTask.id,
        );
        if (!cancelled) setSelectedTaskRelations(relations);
      } catch (error) {
        if (!cancelled) {
          setSelectedTaskRelations([]);
          toast.error(
            error instanceof Error
              ? error.message
              : "Não foi possível carregar tarefas relacionadas.",
          );
        }
      }
    };

    void loadRelations();
    return () => {
      cancelled = true;
    };
  }, [currentOrganizationId, relationsVersion, selectedTask?.id]);

  const handleStatusChange = async (
    taskId: string,
    newStatus: KanbanStatus,
    options?: { undoable?: boolean; skipHistory?: boolean },
  ) => {
    const currentTask = tasks.find((task) => task.id === taskId);
    if (!currentTask || currentTask.status === newStatus) return;

    const validation = await validateObligationStatusChange(currentTask, newStatus);
    if (!validation.allowed) {
      toast.error(validation.message || "Movimento bloqueado para esta tarefa.");
      return;
    }

    const obligationInstanceId = getObligationInstanceId(currentTask);
    if (isObligationTask(currentTask) && newStatus === "done" && obligationInstanceId) {
      try {
        await invokeGrowObligations({
          action: "update_instance",
          instance_id: obligationInstanceId,
          status: "concluida",
          event_comment: "Tarefa concluída manualmente após revisão do documento esperado.",
        });
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Não foi possível concluir a obrigação vinculada.");
        return;
      }
    }

    const previousStatus = currentTask.status;
    const updatedAt = new Date().toISOString();
    const { error } = await supabase
      .from("kanban_tasks")
      .update({ status: newStatus, updated_at: updatedAt })
      .eq("id", taskId);
    if (error) {
      toast.error(`Erro ao mover tarefa: ${error.message}`);
      return;
    }

    setTasks((prev) =>
      prev.map((task) =>
        task.id === taskId ? { ...task, status: newStatus, updated_at: updatedAt } : task,
      ),
    );
    setSelectedTask((prev) =>
      prev && prev.id === taskId ? { ...prev, status: newStatus, updated_at: updatedAt } : prev,
    );

    if (!options?.skipHistory) {
      void registerTaskHistory(
        taskId,
        "Status alterado",
        `${previousStatus} -> ${newStatus}`,
      );
    }

    if (options?.undoable === false) {
      toast.success("Status da tarefa atualizado");
      return;
    }

    toast.success("Status da tarefa atualizado", {
      action: {
        label: "Desfazer",
        onClick: () => {
          void handleStatusChange(taskId, previousStatus, {
            undoable: false,
            skipHistory: true,
          });
          void registerTaskHistory(
            taskId,
            "Alteração de status desfeita",
            `${newStatus} -> ${previousStatus}`,
          );
        },
      },
    });
  };

  const handleSaveTaskDetails = async (
    taskId: string,
    updates: {
      description: string | null;
      client_name: string | null;
      assignee: string | null;
      assigned_to_user_id: string | null;
      priority: string;
      sector: string;
      status: KanbanStatus;
      due_date: string | null;
      tags: string[];
    },
  ) => {
    const previousTask = tasks.find((task) => task.id === taskId);
    if (previousTask && previousTask.status !== updates.status) {
      const validation = await validateObligationStatusChange(previousTask, updates.status);
      if (!validation.allowed) {
        toast.error(validation.message || "Movimento bloqueado para esta tarefa.");
        return;
      }

      const obligationInstanceId = getObligationInstanceId(previousTask);
      if (isObligationTask(previousTask) && updates.status === "done" && obligationInstanceId) {
        try {
          await invokeGrowObligations({
            action: "update_instance",
            instance_id: obligationInstanceId,
            status: "concluida",
            event_comment: "Tarefa concluída manualmente após revisão do documento esperado.",
          });
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "Não foi possível concluir a obrigação vinculada.");
          return;
        }
      }
    }

    setSavingDetail(true);
    const { error } = await supabase
      .from("kanban_tasks")
      .update(updates)
      .eq("id", taskId);
    setSavingDetail(false);

    if (error) {
      toast.error(`Erro ao salvar detalhes da tarefa: ${error.message}`);
      return;
    }

    setTasks((prev) =>
      prev.map((task) => (task.id === taskId ? { ...task, ...updates } : task)),
    );
    setSelectedTask((prev) =>
      prev && prev.id === taskId ? { ...prev, ...updates } : prev,
    );
    if (previousTask) {
      const changedFields: string[] = [];
      const formatHistoryValue = (value: string | null | undefined) =>
        value && value.trim() ? value.trim() : "vazio";
      const addChange = (
        label: string,
        previousValue: string | null | undefined,
        nextValue: string | null | undefined,
      ) => {
        if ((previousValue || "") === (nextValue || "")) return;
        changedFields.push(
          `${label}: ${formatHistoryValue(previousValue)} -> ${formatHistoryValue(nextValue)}`,
        );
      };

      addChange("Descrição", previousTask.description, updates.description);
      addChange("Cliente", previousTask.client_name, updates.client_name);
      addChange("Responsável", previousTask.assignee, updates.assignee);
      addChange("Responsável ID", previousTask.assigned_to_user_id || null, updates.assigned_to_user_id);
      addChange("Prioridade", previousTask.priority, updates.priority);
      addChange("Setor principal", previousTask.sector, updates.sector);
      addChange("Status", previousTask.status, updates.status);
      addChange("Prazo", previousTask.due_date, updates.due_date);
      if ((previousTask.description || "") !== (updates.description || ""))
        changedFields.push("descrição");
      if ((previousTask.client_name || "") !== (updates.client_name || ""))
        changedFields.push("cliente");
      if ((previousTask.assignee || "") !== (updates.assignee || ""))
        changedFields.push("responsável");
      if (previousTask.priority !== updates.priority)
        changedFields.push("prioridade");
      if (previousTask.sector !== updates.sector) changedFields.push("setor");
      if (previousTask.status !== updates.status) changedFields.push("status");
      if ((previousTask.due_date || "") !== (updates.due_date || ""))
        changedFields.push("prazo");
      const previousTags = (previousTask.tags || []).join("|");
      const nextTags = updates.tags.join("|");
      if (previousTags !== nextTags) {
        changedFields.push(
          `Setores: ${formatHistoryValue((previousTask.tags || []).join(", "))} -> ${formatHistoryValue(updates.tags.join(", "))}`,
        );
        changedFields.push("tags");
      }
      const previousSectorSet = new Set(previousTask.tags || []);
      const addedSectors = updates.tags.filter((sector) => !previousSectorSet.has(sector));
      if (changedFields.length > 0) {
        void registerTaskHistory(
          taskId,
          "Detalhes da tarefa atualizados",
          changedFields.join(", "),
        );
      }
      if (addedSectors.length > 0 && user?.id) {
        const { error: commentError } = await supabase.from("kanban_task_comments").insert({
          task_id: taskId,
          user_id: user.id,
          content: JSON.stringify({
            type: "task_sector_added",
            sectors: addedSectors,
            text: `Setor${addedSectors.length > 1 ? "es" : ""} adicionado${addedSectors.length > 1 ? "s" : ""}: ${addedSectors.join(", ")}`,
          }),
          ...(currentOrganizationId ? { organization_id: currentOrganizationId } : {}),
        });
        if (commentError) {
          toast.error("Tarefa salva, mas não foi possível notificar o novo setor.");
        }
      }
    }
    toast.success("Tarefa atualizada");
  };

  const handleSubtaskToggle = (taskId: string, subtaskIndex: number) => {
    const taskToUpdate = tasks.find((task) => task.id === taskId);
    if (!taskToUpdate || !taskToUpdate.subtasks[subtaskIndex]) return;
    const toggledSubtask = taskToUpdate.subtasks[subtaskIndex];

    const updatedSubtasks = taskToUpdate.subtasks.map((subtask, index) =>
      index === subtaskIndex ? { ...subtask, done: !subtask.done } : subtask,
    );

    setTasks((prev) =>
      prev.map((task) => {
        if (task.id !== taskId) return task;
        return { ...task, subtasks: updatedSubtasks };
      }),
    );

    setSelectedTask((prev) => {
      if (!prev || prev.id !== taskId) return prev;
      return { ...prev, subtasks: updatedSubtasks };
    });

    void registerTaskHistory(
      taskId,
      toggledSubtask.done ? "Subtarefa reaberta" : "Subtarefa concluída",
      toggledSubtask.title,
    );

    void supabase
      .from("kanban_tasks")
      .update({ subtasks: updatedSubtasks })
      .eq("id", taskId)
      .then(({ error }) => {
        if (error) {
          if (isSubtasksColumnIssue(error.message)) {
            toast.warning("Subtarefas não estão disponíveis no banco atual.");
            return;
          }
          toast.error(`Erro ao atualizar subtarefa: ${error.message}`);
        }
      });
  };

  const handleCreate = async () => {
    if (!newTask.title.trim()) {
      toast.error("Título é obrigatório");
      return;
    }

    if (!canCreateTaskInSector(newTask.sector, effectiveAccess)) {
      toast.error("Você não tem permissão para criar tarefas neste setor");
      return;
    }

    const selectedClient = newTask.client_name.trim()
      ? clients.find(
          (client) =>
            normalizeText(client.name) === normalizeText(newTask.client_name),
        )
      : null;
    if (newTask.client_name.trim() && !selectedClient) {
      toast.error("Cliente inválido. Selecione um cliente da lista");
      return;
    }

    const createdTask = {
      id: crypto.randomUUID(),
      title: newTask.title,
    };
    const canViewCreatedTask = canViewTaskByCanonicalScope(
      { sector: newTask.sector, assignedToUserId: newTask.assigned_to_user_id || null },
      effectiveAccess,
    );

    const { error } = await supabase
      .from("kanban_tasks")
      .insert({
        id: createdTask.id,
        title: newTask.title,
        client_name: selectedClient?.name || null,
        assignee: newTask.assignee || null,
        assigned_to_user_id: newTask.assigned_to_user_id || null,
        priority: newTask.priority,
        sector: newTask.sector,
        status: "todo",
        tags: [newTask.sector],
        subtasks: newTask.subtasks,
        created_by: user?.id,
      });

    if (error) {
      toast.error(
        `Erro ao criar tarefa: ${error?.message || "Não foi possível criar a tarefa"}`,
      );
      return;
    }

    if (canViewCreatedTask) {
      void registerTaskHistory(createdTask.id, "Tarefa criada", createdTask.title);
    }
    if (relatedSourceTask && canViewCreatedTask) {
      if (!currentOrganizationId) {
        toast.warning("Tarefa criada, mas a relação não foi salva por falta de organização ativa.");
      } else {
        try {
          await createTaskRelations({
            organizationId: currentOrganizationId,
            sourceTaskId: createdTask.id,
            targetTaskIds: [relatedSourceTask.id],
            createdBy: user?.id,
          });
          void registerTaskHistory(
            createdTask.id,
            "Tarefa relacionada criada",
            relatedSourceTask.title,
          );
          void registerTaskHistory(
            relatedSourceTask.id,
            "Tarefa relacionada criada",
            createdTask.title,
          );
          setRelationsVersion((prev) => prev + 1);
        } catch (relationError) {
          toast.warning(
            relationError instanceof Error
              ? `Tarefa criada, mas a relação não foi salva: ${relationError.message}`
              : "Tarefa criada, mas a relação não foi salva.",
          );
        }
      }
    }

    toast.success("Tarefa adicionada ao Kanban");
    setCreateOpen(false);
    setRelatedSourceTask(null);
    setNewTask({
      title: "",
      client_name: "",
      assignee: "",
      assigned_to_user_id: "",
      priority: "Média",
      sector: creatableSectors[0] || "Geral",
      subtasks: [],
    });
    void fetchTasks();
  };

  useEffect(() => {
    if (!selectedCompany) return;
    const selectedActiveClient = clients.find(
      (client) => normalizeText(client.name) === normalizeText(selectedCompany),
    );
    if (selectedActiveClient) {
      setNewTask((prev) => ({
        ...prev,
        client_name: selectedActiveClient.name,
      }));
    }
  }, [clients, selectedCompany]);

  const handleRemoveRelatedTask = async (relationId: string) => {
    const relation = selectedTaskRelations.find(
      (item) => item.relationId === relationId,
    );
    try {
      await deleteTaskRelation(relationId);
      if (selectedTask?.id) {
        void registerTaskHistory(
          selectedTask.id,
          "Relação removida",
          relation?.title,
        );
      }
      setRelationsVersion((prev) => prev + 1);
      toast.success("Relação removida.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível remover a relação.",
      );
    }
  };

  const handleCreateRelatedTask = (sourceTaskId: string) => {
    const sourceTask = tasks.find((task) => task.id === sourceTaskId);
    if (!sourceTask) {
      toast.error("Tarefa de origem não encontrada.");
      return;
    }

    setRelatedSourceTask(sourceTask);
    setDetailOpen(false);
    setCreateOpen(true);
  };

  const handleOpenRelatedTask = (taskId: string) => {
    const relatedTask = tasks.find((task) => task.id === taskId);
    if (!relatedTask) {
      toast.error("Tarefa relacionada não encontrada.");
      return;
    }

    void openTaskDetails(relatedTask);
    if (relatedTask.status === "archived") {
      setShowArchived(true);
    }
  };

  const handleDragStart = (taskId: string) => {
    setDraggingTaskId(taskId);
  };

  const handleDragEnd = () => {
    setDraggingTaskId(null);
    setDropTargetStatus(null);
  };

  const handleColumnDragOver = (
    event: DragEvent<HTMLDivElement>,
    status: KanbanStatus,
  ) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    if (dropTargetStatus !== status) setDropTargetStatus(status);
  };

  const handleColumnDrop = async (
    event: DragEvent<HTMLDivElement>,
    status: KanbanStatus,
  ) => {
    event.preventDefault();
    const taskId = draggingTaskId || event.dataTransfer.getData("text/plain");
    const draggedTask = tasks.find((task) => task.id === taskId);

    handleDragEnd();
    if (!draggedTask || draggedTask.status === status) return;
    if (status === "archived" && draggedTask.status !== "done") {
      toast.error(
        "Somente tarefas concluídas podem ser movidas para o arquivo",
      );
      return;
    }

    await handleStatusChange(taskId, status);
  };

  const content = (
    <>
      <div className="space-y-4">
        <div className="space-y-3">
          {!embedded && (
            <div className="flex items-center justify-between">
              <div>
                <ModuleContextPill icon={KanbanSquare} label="Quadro Kanban" />
                <h1 className="font-heading text-2xl font-bold">Kanban</h1>
                <p className="text-sm text-muted-foreground">
                  Gestão visual de demandas
                </p>
              </div>
              <Button
                variant="default"
                size="sm"
                onClick={() => {
                  setRelatedSourceTask(null);
                  setCreateOpen(true);
                }}
              >
                <Plus className="h-4 w-4 mr-1" /> Nova Tarefa
              </Button>
            </div>
          )}
          <div className="rounded-lg border border-border/60 bg-card/45 px-3 py-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <TaskOriginLegend />
              <div className={`flex flex-wrap items-center gap-2 ${embedded ? "ml-auto" : ""}`}>
                <Button
                  type="button"
                  variant={filtersOpen || hasLocalTaskFilters ? "secondary" : "ghost"}
                  size="sm"
                  className="h-9 gap-1.5 rounded-md px-3 text-xs"
                  onClick={() => setFiltersOpen((current) => !current)}
                  aria-expanded={filtersOpen}
                >
                  <Filter className="h-3.5 w-3.5" />
                  Filtros
                  {activeLocalTaskFilterCount > 0 && (
                    <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold leading-none text-primary-foreground">
                      {activeLocalTaskFilterCount}
                    </span>
                  )}
                  <ChevronDown
                    className={cn(
                      "h-3.5 w-3.5 transition-transform",
                      filtersOpen && "rotate-180",
                    )}
                  />
                </Button>
                {isAdmin && (
                  <Button
                    type="button"
                    variant={showArchived ? "secondary" : "ghost"}
                    size="sm"
                    className="h-9 gap-1.5 rounded-md px-2.5 text-xs text-muted-foreground"
                    onClick={() => setShowArchived((current) => !current)}
                  >
                    <Archive className="h-3.5 w-3.5" />
                    Arquivo
                    {archivedCount > 0 && (
                      <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] leading-none">
                        {archivedCount}
                      </span>
                    )}
                  </Button>
                )}
              </div>
            </div>
            {filtersOpen && (
              <div className="mt-3 grid gap-2 border-t border-border/60 pt-3 sm:grid-cols-2 lg:grid-cols-[minmax(220px,1.4fr)_repeat(4,minmax(150px,1fr))_auto]">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={taskSearch}
                    onChange={(event) => setTaskSearch(event.target.value)}
                    placeholder="Buscar tarefa ou cliente"
                    className="h-9 w-full rounded-md border-border/70 bg-background/80 pl-8 text-xs"
                  />
                </div>
                <Select value={sectorFilter} onValueChange={setSectorFilter}>
                  <SelectTrigger className="h-9 w-full rounded-md border-border/70 bg-background/80 text-xs">
                    <SelectValue placeholder="Filtrar setor" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os Setores</SelectItem>
                    {availableSectors.map((sector) => (
                      <SelectItem key={sector} value={sector}>
                        {sector}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={originFilter} onValueChange={setOriginFilter}>
                  <SelectTrigger className="h-9 w-full rounded-md border-border/70 bg-background/80 text-xs">
                    <SelectValue placeholder="Origem" />
                  </SelectTrigger>
                  <SelectContent>
                    {taskOriginFilterOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                  <SelectTrigger className="h-9 w-full rounded-md border-border/70 bg-background/80 text-xs">
                    <SelectValue placeholder="Prioridade" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas prioridades</SelectItem>
                    {taskPriorityFilterOptions.map((priority) => (
                      <SelectItem key={priority} value={priority}>
                        {priority}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
                  <SelectTrigger className="h-9 w-full rounded-md border-border/70 bg-background/80 text-xs">
                    <SelectValue placeholder="Responsável" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos responsáveis</SelectItem>
                    <SelectItem value="unassigned">Sem responsável</SelectItem>
                    {taskAssigneeFilterOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {hasLocalTaskFilters ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-9 gap-1.5 rounded-md px-2.5 text-xs text-muted-foreground"
                    onClick={clearLocalTaskFilters}
                  >
                    <X className="h-3.5 w-3.5" />
                    Limpar
                  </Button>
                ) : null}
              </div>
            )}
          </div>
        </div>
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="flex items-start gap-5">
            <div className="min-w-0 flex-1 overflow-x-auto pb-4">
              <div className="grid w-full min-w-[1120px] grid-cols-5 gap-4 pr-2 2xl:min-w-0">
                {baseColumns.map((column) => {
                  const columnTasks = tasksByStatus[column.id] || [];
                  const backlogObligationGroups =
                    column.id === "backlog"
                      ? groupBacklogObligationTasks(columnTasks)
                      : null;
                  const visibleColumnTasks =
                    backlogObligationGroups?.regularTasks || columnTasks;
                  const visibleItemCount =
                    visibleColumnTasks.length + (backlogObligationGroups?.groups.length || 0);

                  return (
                    <div
                      key={column.id}
                      className="min-w-0"
                    >
                      <div className="mb-2.5 flex items-center gap-2 px-1">
                        <div className={`h-2 w-2 rounded-full ${column.color}`} />
                        <span className="text-sm font-semibold">
                          {column.label}
                        </span>
                        <span className="ml-auto text-xs text-muted-foreground">
                          {columnTasks.length}
                        </span>
                      </div>
                      <div
                        onDragOver={(event) =>
                          handleColumnDragOver(event, column.id)
                        }
                        onDrop={(event) => void handleColumnDrop(event, column.id)}
                        className={`min-h-[calc(100vh-270px)] space-y-3 rounded-lg border border-dashed p-2.5 transition-colors ${
                          draggingTaskId && dropTargetStatus === column.id
                            ? "border-primary bg-primary/5"
                            : "border-border/35 bg-background/40"
                        }`}
                      >
                        {backlogObligationGroups?.groups.map((group) => (
                          <ObligationTaskGroupCard
                            key={group.id}
                            group={group}
                            currentStatus={column.id}
                            onStatusChange={handleStatusChange}
                            onOpenTask={(task) => {
                              void openTaskDetails(task);
                            }}
                            onDragStart={handleDragStart}
                            onDragEnd={handleDragEnd}
                            draggingTaskId={draggingTaskId}
                            canArchive={isAdmin}
                          />
                        ))}
                        {visibleColumnTasks.map((task, index) => (
                          <KanbanCard
                            key={task.id}
                            task={task}
                            index={index}
                            currentStatus={column.id}
                            onStatusChange={handleStatusChange}
                            onOpenDetails={() => {
                              void openTaskDetails(task);
                            }}
                            onDragStart={handleDragStart}
                            onDragEnd={handleDragEnd}
                            isDragging={draggingTaskId === task.id}
                            canArchive={isAdmin}
                          />
                        ))}
                        {visibleItemCount === 0 && (
                          <div className="rounded-lg border border-dashed bg-card/40 p-5 text-center text-xs leading-relaxed text-muted-foreground">
                            Arraste uma tarefa para esta coluna
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {isAdmin && showArchived && (
              <aside className="hidden max-h-[calc(100vh-180px)] w-[310px] shrink-0 overflow-y-auto border-l border-border/60 pl-5 pr-1 xl:block">
                <div className="mb-3 flex items-center gap-2 px-1">
                  <Archive className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-sm font-semibold">{archiveColumn.label}</span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {archivedCount}
                  </span>
                </div>
                <div
                  onDragOver={(event) =>
                    handleColumnDragOver(event, archiveColumn.id)
                  }
                  onDrop={(event) => void handleColumnDrop(event, archiveColumn.id)}
                  className={`space-y-3 rounded-lg border border-dashed p-3 transition-colors ${
                    draggingTaskId && dropTargetStatus === archiveColumn.id
                      ? "border-primary bg-primary/5"
                      : "border-border/35 bg-background/40"
                  }`}
                >
                  {tasksByStatus.archived.map((task, index) => (
                    <KanbanCard
                      key={task.id}
                      task={task}
                      index={index}
                      currentStatus={archiveColumn.id}
                      onStatusChange={handleStatusChange}
                      onOpenDetails={() => {
                        void openTaskDetails(task);
                      }}
                      onDragStart={handleDragStart}
                      onDragEnd={handleDragEnd}
                      isDragging={draggingTaskId === task.id}
                      canArchive={isAdmin}
                    />
                  ))}
                  {tasksByStatus.archived.length === 0 && (
                    <div className="rounded-lg border border-dashed bg-card/40 p-5 text-center text-xs leading-relaxed text-muted-foreground">
                      Tarefas arquivadas aparecem aqui.
                    </div>
                  )}
                </div>
              </aside>
            )}
          </div>
        )}
      </div>

      <KanbanTaskDetailSheet
        task={selectedTask}
        open={detailOpen}
        saving={savingDetail}
        canArchive={isAdmin}
        onOpenChange={setDetailOpen}
        onSave={handleSaveTaskDetails}
        onSubtaskToggle={handleSubtaskToggle}
        onHistory={(taskId, action, details) => {
          void registerTaskHistory(taskId, action, details);
        }}
        historyEntries={selectedTaskHistory}
        relatedTasks={selectedTaskRelations}
        onOpenRelatedTask={handleOpenRelatedTask}
        onRemoveRelatedTask={(relationId) => {
          void handleRemoveRelatedTask(relationId);
        }}
        onCreateRelatedTask={handleCreateRelatedTask}
      />

      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) setRelatedSourceTask(null);
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {relatedSourceTask
                ? "Nova tarefa relacionada"
                : "Nova Tarefa no Kanban"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {relatedSourceTask && (
              <div className="rounded-lg border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                Esta tarefa será relacionada a{" "}
                <span className="font-medium text-foreground">
                  {relatedSourceTask.title}
                </span>
                . A relação é apenas informativa e não bloqueia o fluxo.
              </div>
            )}
            <div className="space-y-2">
              <Label>Título *</Label>
              <Input
                placeholder="Ex: Fechamento contábil"
                value={newTask.title}
                onChange={(e) =>
                  setNewTask((prev) => ({ ...prev, title: e.target.value }))
                }
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Cliente (opcional)</Label>
                <Popover
                  open={clientPickerOpen}
                  onOpenChange={setClientPickerOpen}
                >
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      role="combobox"
                      aria-expanded={clientPickerOpen}
                      className="w-full justify-between"
                      disabled={loadingClients}
                    >
                      {newTask.client_name ||
                        (loadingClients
                          ? "Carregando clientes..."
                          : "Sem cliente")}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                    <Command>
                      <CommandInput placeholder="Buscar cliente..." />
                      <CommandList>
                        <CommandEmpty>Nenhum cliente encontrado.</CommandEmpty>
                        <CommandGroup>
                          <CommandItem
                            value="sem cliente"
                            onSelect={() => {
                              setNewTask((prev) => ({
                                ...prev,
                                client_name: "",
                              }));
                              setClientPickerOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                !newTask.client_name
                                  ? "opacity-100"
                                  : "opacity-0",
                              )}
                            />
                            Sem cliente
                          </CommandItem>
                          {clients.map((client) => (
                            <CommandItem
                              key={client.id}
                              value={client.name}
                              onSelect={(selectedValue) => {
                                const matchedClient = clients.find(
                                  (item) =>
                                    normalizeText(item.name) ===
                                    normalizeText(selectedValue),
                                );
                                if (matchedClient) {
                                  setNewTask((prev) => ({
                                    ...prev,
                                    client_name: matchedClient.name,
                                  }));
                                  setClientPickerOpen(false);
                                }
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  newTask.client_name === client.name
                                    ? "opacity-100"
                                    : "opacity-0",
                                )}
                              />
                              {client.name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label>Responsável</Label>
                <Select
                  disabled={!isAdmin}
                  value={newTask.assigned_to_user_id || "unassigned"}
                  onValueChange={(value) => {
                    const selected = filteredCreateAssigneeOptions.find(
                      (option) => option.id === value,
                    );
                    setNewTask((prev) => ({
                      ...prev,
                      assigned_to_user_id: value === "unassigned" ? "" : value,
                      assignee: selected?.name || "",
                    }));
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sem responsável" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Sem responsável</SelectItem>
                    {filteredCreateAssigneeOptions.map((option) => (
                      <SelectItem key={option.id} value={option.id}>
                        {formatTaskAssigneeLabel(option)}
                      </SelectItem>
                    ))}
                    {!newTaskSectorCode && (
                      <SelectItem value="select-sector-first" disabled>
                        Selecione um setor primeiro
                      </SelectItem>
                    )}
                    {newTaskSectorCode &&
                      filteredCreateAssigneeOptions.length === 0 && (
                        <SelectItem value="no-sector-assignees" disabled>
                          Nenhum responsável no setor selecionado
                        </SelectItem>
                      )}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Setor</Label>
                <Select
                  value={newTask.sector}
                  onValueChange={(value) =>
                    setNewTask((prev) => ({ ...prev, sector: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {creatableSectors.map((sector) => (
                      <SelectItem key={sector} value={sector}>
                        {sector}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Prioridade</Label>
                <Select
                  value={newTask.priority}
                  onValueChange={(value) =>
                    setNewTask((prev) => ({ ...prev, priority: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["Urgente", "Alta", "Média", "Baixa"].map((priority) => (
                      <SelectItem key={priority} value={priority}>
                        {priority}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCreateOpen(false);
                setRelatedSourceTask(null);
                setNewTask({
                  title: "",
                  client_name: "",
                  assignee: "",
                  assigned_to_user_id: "",
                  priority: "Média",
                  sector: creatableSectors[0] || "Geral",
                  subtasks: [],
                });
              }}
            >
              Cancelar
            </Button>
            <Button onClick={handleCreate}>Adicionar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );

  if (embedded) {
    return content;
  }

  return <AppLayout>{content}</AppLayout>;
}

export default function KanbanPage() {
  return <TaskKanbanView />;
}

function KanbanCard({
  task,
  index,
  currentStatus,
  onStatusChange,
  onOpenDetails,
  onDragStart,
  onDragEnd,
  isDragging,
  canArchive,
}: {
  task: KanbanTaskItem;
  index: number;
  currentStatus: KanbanStatus;
  onStatusChange: (id: string, status: KanbanStatus) => void;
  onOpenDetails: () => void;
  onDragStart: (taskId: string) => void;
  onDragEnd: () => void;
  isDragging: boolean;
  canArchive: boolean;
}) {
  const nextStatus: Partial<
    Record<KanbanStatus, { label: string; target: KanbanStatus }>
  > = {
    backlog: { label: "Mover para A Fazer", target: "todo" },
    todo: { label: "Iniciar", target: "doing" },
    doing: { label: "Enviar para Revisão", target: "review" },
    review: { label: "Concluir", target: "done" },
    done: canArchive ? { label: "Arquivar", target: "archived" } : undefined,
  };

  const taskSectors =
    task.tags.length > 0 ? task.tags : task.sector ? [task.sector] : [];
  const primarySector = taskSectors[0] || "Geral";
  const extraSectors = Math.max(taskSectors.length - 1, 0);
  const action = nextStatus[currentStatus];
  const createdDate = formatTaskCreatedDate(task.created_at);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      draggable
      onDragStart={(event: DragEvent<HTMLDivElement>) => {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", task.id);
        onDragStart(task.id);
      }}
      onDragEnd={onDragEnd}
      onClick={onOpenDetails}
      className={`group relative flex min-h-[122px] flex-col overflow-hidden rounded-lg border border-border/60 bg-card/95 p-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-all hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-sm cursor-grab active:cursor-grabbing ${
        isDragging ? "opacity-50" : ""
      }`}
    >
      <TaskOriginRibbon
        requestId={task.request_id}
        integrationSource={task.integration_source}
        className="right-2"
      />
      <div className="flex flex-1 flex-col gap-2.5 pr-3">
        <div className="space-y-1.5">
          <div className="flex items-start justify-between gap-2">
            <span className="line-clamp-2 text-sm font-semibold leading-snug text-foreground/95">
              {task.title}
            </span>
            <div
              className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${priorityDot[task.priority] || "bg-muted-foreground"}`}
              title={`Prioridade: ${task.priority}`}
            />
          </div>

          {task.client_name && (
            <div className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
              {task.client_name}
            </div>
          )}

          {createdDate && (
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground/80">
              <CalendarDays className="h-3 w-3" />
              <span>Criada em {createdDate}</span>
            </div>
          )}
        </div>

        <div className="mt-auto flex items-center justify-between gap-3">
          <span className="max-w-[180px] rounded-md bg-muted/70 px-2 py-1 text-xs leading-tight text-muted-foreground">
            {extraSectors > 0
              ? `${primarySector} +${extraSectors}`
              : primarySector}
          </span>
          {task.assignee && (
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted/80 ring-1 ring-border/60">
              <span className="text-[10px] font-semibold text-primary">
                {task.assignee
                  .split(" ")
                  .map((name) => name[0])
                  .join("")
                  .slice(0, 2)}
              </span>
            </div>
          )}
          {!task.assignee && (
            <div className="h-7 w-7 shrink-0 rounded-full border border-dashed border-border/60" />
          )}
        </div>
      </div>

      {action && (
        <div className="mt-1.5 hidden group-hover:block">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-full justify-start px-2 text-xs text-muted-foreground"
            onClick={(event) => {
              event.stopPropagation();
              onStatusChange(task.id, action.target);
            }}
          >
            {action.label} {"->"}
          </Button>
        </div>
      )}
    </motion.div>
  );
}

function ObligationTaskGroupCard({
  group,
  currentStatus,
  onStatusChange,
  onOpenTask,
  onDragStart,
  onDragEnd,
  draggingTaskId,
  canArchive,
}: {
  group: ObligationTaskGroup;
  currentStatus: KanbanStatus;
  onStatusChange: (id: string, status: KanbanStatus) => void;
  onOpenTask: (task: KanbanTaskItem) => void;
  onDragStart: (taskId: string) => void;
  onDragEnd: () => void;
  draggingTaskId: string | null;
  canArchive: boolean;
}) {
  const [open, setOpen] = useState(false);
  const dueDate = formatTaskCreatedDate(group.dueDate);

  return (
    <div className="overflow-hidden rounded-lg border border-border/60 bg-background/70">
      <button
        type="button"
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left transition-colors hover:bg-muted/35"
        onClick={() => setOpen((current) => !current)}
      >
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
        />
        <p className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground/95">
          {group.name}
        </p>
        {group.competenceKey && (
          <span className="hidden shrink-0 text-[11px] text-muted-foreground 2xl:inline">
            {group.competenceKey}
          </span>
        )}
        {dueDate && (
          <span className="hidden shrink-0 text-[11px] text-muted-foreground 2xl:inline">
            {dueDate}
          </span>
        )}
        <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
          {group.tasks.length}
        </span>
      </button>

      {open && (
        <div className="space-y-3 border-t border-border/50 bg-muted/15 p-2.5">
          {group.tasks.map((task, index) => (
            <KanbanCard
              key={task.id}
              task={task}
              index={index}
              currentStatus={currentStatus}
              onStatusChange={onStatusChange}
              onOpenDetails={() => onOpenTask(task)}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              isDragging={draggingTaskId === task.id}
              canArchive={canArchive}
            />
          ))}
        </div>
      )}
    </div>
  );
}
