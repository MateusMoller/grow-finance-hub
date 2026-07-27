import { AppLayout } from "@/components/app/AppLayout";
import { ModuleContextPill } from "@/components/app/ModuleContextPill";
import { motion } from "framer-motion";
import {
  CheckCircle2,
  Circle,
  Clock,
  Filter,
  Plus,
  Search,
  AlertTriangle,
  Paperclip,
  MessageSquare,
  CalendarDays,
  Tag,
  Loader2,
  Check,
  ChevronsUpDown,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { TaskDetailSheet } from "@/components/app/TaskDetailSheet";
import { TaskOriginLegend } from "@/components/app/TaskOriginLegend";
import { TaskOriginRibbon } from "@/components/app/TaskOriginRibbon";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { useGlobalFilters } from "@/hooks/useGlobalFilters";
import {
  getTaskCompetence,
  matchesSelectedCompany,
  matchesSelectedCompetence,
} from "@/lib/globalFilters";
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
import type { Tables } from "@/integrations/supabase/types";
import {
  getTaskHistoryEntries,
  recordTaskHistoryEntry,
  type ChangeHistoryEntry,
} from "@/lib/changeHistory";
import {
  createTaskRelations,
  deleteTaskRelation,
  loadRelatedTasks,
  type RelatedTaskSummary,
} from "@/lib/taskRelations";

interface TaskSubtask {
  title: string;
  done: boolean;
}

interface Task {
  id: string;
  title: string;
  description: string;
  client: string;
  sector: string;
  assignee: string;
  assignedToUserId: string | null;
  priority: "Alta" | "Media" | "Baixa" | "Urgente";
  dueDate: string;
  status: "Pendente" | "Em andamento" | "Em revisão" | "Concluído" | "Atrasado";
  createdAt: string;
  tags: string[];
  subtasks: TaskSubtask[];
  attachments: number;
  comments: number;
  requestId: string | null;
  integrationSource: string | null;
}

interface KanbanTaskRow {
  id: string;
  title: string;
  description: string | null;
  client_name: string | null;
  sector: string;
  assignee: string | null;
  assigned_to_user_id?: string | null;
  priority: string;
  due_date: string | null;
  status: string;
  tags: string[] | null;
  created_at: string;
  subtasks?: unknown;
  request_id?: string | null;
  integration_source?: string | null;
}

type KanbanTaskSnapshot = Tables<"kanban_tasks">;

interface ClientOption {
  id: string;
  name: string;
}

const priorityConfig: Record<string, { color: string; bg: string }> = {
  Urgente: { color: "text-destructive", bg: "bg-destructive/10" },
  Alta: { color: "text-orange-600", bg: "bg-orange-100 dark:bg-orange-900/20" },
  Media: { color: "text-amber-600", bg: "bg-amber-100 dark:bg-amber-900/20" },
  Baixa: { color: "text-muted-foreground", bg: "bg-muted" },
};

const statusConfig: Record<
  string,
  { color: string; bg: string; icon: typeof Circle }
> = {
  Pendente: { color: "text-muted-foreground", bg: "bg-muted", icon: Circle },
  "Em andamento": { color: "text-primary", bg: "bg-primary/10", icon: Clock },
  "Em revisão": {
    color: "text-amber-600",
    bg: "bg-amber-100 dark:bg-amber-900/20",
    icon: AlertTriangle,
  },
  Concluído: { color: "text-primary", bg: "bg-primary/10", icon: CheckCircle2 },
  Atrasado: {
    color: "text-destructive",
    bg: "bg-destructive/10",
    icon: AlertTriangle,
  },
};

const sectors = [
  "Todos",
  "Contábil",
  "Fiscal",
  "Departamento Pessoal",
  "Comercial",
  "Societário",
  "Geral",
];
const creatableSectors = sectors.filter((sector) => sector !== "Todos");
const statuses = [
  "Todos",
  "Pendente",
  "Em andamento",
  "Em revisão",
  "Concluído",
  "Atrasado",
];

const normalizeText = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const normalizeSector = (value: string): string => {
  return normalizeTaskSectorLabel(value);
};

const normalizePriority = (value: string): Task["priority"] => {
  const normalized = normalizeText(value);
  if (normalized.includes("urgente")) return "Urgente";
  if (normalized.includes("alta")) return "Alta";
  if (normalized.includes("baixa")) return "Baixa";
  return "Media";
};

const formatPriorityLabel = (priority: string) =>
  priority === "Media" ? "Média" : priority;

const deriveStatus = (
  status: string,
  dueDate: string | null,
): Task["status"] => {
  const normalizedStatus = normalizeText(status);

  if (normalizedStatus === "done" || normalizedStatus === "archived") {
    return "Concluído";
  }

  if (dueDate) {
    const dueAt = new Date(`${dueDate}T23:59:59`).getTime();
    if (!Number.isNaN(dueAt) && dueAt < Date.now()) {
      return "Atrasado";
    }
  }

  if (normalizedStatus === "doing") return "Em andamento";
  if (normalizedStatus === "review") return "Em revisão";
  return "Pendente";
};

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

const mapRowToTask = (row: KanbanTaskRow): Task => ({
  id: row.id,
  title: row.title,
  description: row.description || "",
  client: row.client_name || "",
  sector: normalizeSector(row.sector || ""),
  assignee: row.assignee || "",
  assignedToUserId: row.assigned_to_user_id || null,
  priority: normalizePriority(row.priority || ""),
  dueDate: row.due_date || "",
  status: deriveStatus(row.status || "todo", row.due_date),
  createdAt: row.created_at,
  tags: row.tags?.length
    ? row.tags.map(normalizeSector)
    : row.sector
      ? [normalizeSector(row.sector)]
      : [],
  subtasks: parseSubtasks(row.subtasks),
  attachments: 0,
  comments: 0,
  requestId: row.request_id || null,
  integrationSource: row.integration_source || null,
});

const isSubtasksColumnIssue = (errorMessage: string | undefined) => {
  const normalized = normalizeText(errorMessage || "");
  if (!normalized.includes("subtasks")) return false;
  return normalized.includes("column") || normalized.includes("permission");
};

interface TaskListViewProps {
  embedded?: boolean;
}

export function TaskListView({ embedded = false }: TaskListViewProps) {
  const { user, effectiveAccess, currentOrganizationId } = useAuth();
  const { selectedCompany, selectedCompetence } = useGlobalFilters();
  const location = useLocation();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [assigneeOptions, setAssigneeOptions] = useState<TaskAssigneeOption[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [loadingClients, setLoadingClients] = useState(true);
  const [subtasksAvailable, setSubtasksAvailable] = useState(true);
  const [search, setSearch] = useState("");
  const [sectorFilter, setSectorFilter] = useState("Todos");
  const [statusFilter, setStatusFilter] = useState("Todos");
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [clientPickerOpen, setClientPickerOpen] = useState(false);
  const [relatedSourceTask, setRelatedSourceTask] = useState<Task | null>(null);
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
    description: "",
    client: "",
    sector: "Contábil",
    assignee: "",
    assignedToUserId: "",
    priority: "Media" as Task["priority"],
    dueDate: "",
    subtasks: [] as TaskSubtask[],
  });

  const actorLabel = user?.email || "Usuário";
  const taskSectorAccess = useMemo(
    () => getCanonicalTaskSectorAccess(effectiveAccess),
    [effectiveAccess],
  );
  const availableSectors = useMemo(() => {
    if (taskSectorAccess.canAccessAllTaskSectors)
      return sectors.filter((sector) => sector !== "Todos");
    return taskSectorAccess.allowedTaskSectors;
  }, [taskSectorAccess]);
  const sectorFilterOptions = useMemo(
    () =>
      taskSectorAccess.canAccessAllTaskSectors
        ? sectors
        : ["Todos", ...availableSectors],
    [availableSectors, taskSectorAccess.canAccessAllTaskSectors],
  );
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
    if (!newTask.assignedToUserId) return;

    const selected = assigneeOptions.find(
      (option) => option.id === newTask.assignedToUserId,
    );
    if (!newTaskSectorCode || selected?.sectorCode !== newTaskSectorCode) {
      setNewTask((prev) => ({
        ...prev,
        assignee: "",
        assignedToUserId: "",
      }));
    }
  }, [assigneeOptions, newTask.assignedToUserId, newTaskSectorCode]);

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

  const loadTasks = useCallback(async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from("kanban_tasks")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Erro ao carregar tarefas");
      setLoading(false);
      return;
    }

    const rows = (data || []) as KanbanTaskRow[];
    const subtasksColumnReturned = rows.some((row) =>
      Object.prototype.hasOwnProperty.call(row, "subtasks"),
    );
    const mapped = rows
      .filter((row) => row.status !== "archived")
      .map(mapRowToTask);

    setSubtasksAvailable((prev) =>
      rows.length === 0 ? prev : subtasksColumnReturned,
    );
    setTasks(mapped);
    setLoading(false);
  }, []);

  const loadClients = useCallback(async () => {
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

  const loadAssignees = useCallback(async () => {
    try {
      setAssigneeOptions(await loadTaskAssignees(currentOrganizationId));
    } catch {
      setAssigneeOptions([]);
      toast.error("Não foi possível carregar os responsáveis.");
    }
  }, [currentOrganizationId]);

  useEffect(() => {
    void loadTasks();
    void loadClients();
    void loadAssignees();
  }, [loadAssignees, loadClients, loadTasks]);

  useEffect(() => {
    if (sectorFilter === "Todos") return;
    if (!availableSectors.includes(sectorFilter)) setSectorFilter("Todos");
  }, [availableSectors, sectorFilter]);

  useEffect(() => {
    if (creatableSectors.length === 0) return;
    if (!creatableSectors.includes(newTask.sector)) {
      setNewTask((prev) => ({ ...prev, sector: creatableSectors[0] }));
    }
  }, [newTask.sector]);

  const scopedTasks = useMemo(
    () =>
      tasks.filter(
        (task) =>
          matchesSelectedCompany(task.client, selectedCompany) &&
          matchesSelectedCompetence(
            getTaskCompetence(task.dueDate || null, task.createdAt),
            selectedCompetence,
          ),
      ),
    [tasks, selectedCompany, selectedCompetence],
  );

  const filtered = scopedTasks.filter((task) => {
    const searchTerm = search.toLowerCase();
    if (
      search &&
      !task.title.toLowerCase().includes(searchTerm) &&
      !task.client.toLowerCase().includes(searchTerm)
    )
      return false;
    if (sectorFilter !== "Todos" && task.sector !== sectorFilter) return false;
    if (statusFilter !== "Todos" && task.status !== statusFilter) return false;
    return true;
  });

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

  const handleSubtaskToggle = (taskId: string, subtaskIndex: number) => {
    if (!subtasksAvailable) {
      toast.warning("Subtarefas não estão disponíveis no banco atual.");
      return;
    }

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
            setSubtasksAvailable(false);
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

    const selectedClient = newTask.client.trim()
      ? clients.find(
          (client) =>
            normalizeText(client.name) === normalizeText(newTask.client),
        )
      : null;
    if (newTask.client.trim() && !selectedClient) {
      toast.error("Cliente inválido. Selecione um cliente da lista");
      return;
    }

    const createdTask = {
      id: crypto.randomUUID(),
      title: newTask.title.trim(),
    };
    const canViewCreatedTask = canViewTaskByCanonicalScope(
      { sector: newTask.sector, assignedToUserId: newTask.assignedToUserId || null },
      effectiveAccess,
    );

    const baseInsertPayload = {
      id: createdTask.id,
      title: newTask.title.trim(),
      description: newTask.description.trim() || null,
      client_name: selectedClient?.name || null,
      sector: newTask.sector,
      assignee: newTask.assignee.trim() || null,
      assigned_to_user_id: newTask.assignedToUserId || null,
      priority: newTask.priority,
      due_date: newTask.dueDate || null,
      status: "todo",
      tags: [newTask.sector],
      created_by: user?.id || null,
    };

    const firstTry = await supabase
      .from("kanban_tasks")
      .insert(
        subtasksAvailable
          ? { ...baseInsertPayload, subtasks: newTask.subtasks }
          : baseInsertPayload,
      );

    let error = firstTry.error;
    let savedWithoutSubtasks = !subtasksAvailable;

    if (error && subtasksAvailable && isSubtasksColumnIssue(error.message)) {
      setSubtasksAvailable(false);
      savedWithoutSubtasks = true;
      const fallbackInsert = await supabase
        .from("kanban_tasks")
        .insert(baseInsertPayload);
      error = fallbackInsert.error;
    }

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

    setCreateOpen(false);
    setRelatedSourceTask(null);
    setNewTask({
      title: "",
      description: "",
      client: "",
      sector: creatableSectors[0] || "Geral",
      assignee: "",
      assignedToUserId: "",
      priority: "Media",
      dueDate: "",
      subtasks: [],
    });
    if (savedWithoutSubtasks && newTask.subtasks.length > 0) {
      toast.success("Tarefa criada. Subtarefas não foram salvas neste banco.");
    } else {
      toast.success("Tarefa criada com sucesso");
    }
    await loadTasks();
  };

  useEffect(() => {
    if (!selectedCompany) return;
    const selectedActiveClient = clients.find(
      (client) => normalizeText(client.name) === normalizeText(selectedCompany),
    );
    if (selectedActiveClient) {
      setNewTask((prev) => ({ ...prev, client: selectedActiveClient.name }));
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
    setSheetOpen(false);
    setCreateOpen(true);
  };

  const handleOpenRelatedTask = (taskId: string) => {
    const relatedTask = tasks.find((task) => task.id === taskId);
    if (!relatedTask) {
      toast.error("Tarefa relacionada não encontrada.");
      return;
    }

    setSelectedTask(relatedTask);
    setSheetOpen(true);
  };

  const handleDeleteTask = async (taskId: string) => {
    const taskToDelete = tasks.find((task) => task.id === taskId);
    if (!taskToDelete) return;

    const confirmed = window.confirm(
      `Excluir a tarefa "${taskToDelete.title}"?`,
    );
    if (!confirmed) return;

    const { data: snapshot } = await supabase
      .from("kanban_tasks")
      .select("*")
      .eq("id", taskId)
      .maybeSingle();

    const { error } = await supabase
      .from("kanban_tasks")
      .delete()
      .eq("id", taskId);

    if (error) {
      toast.error(`Erro ao excluir tarefa: ${error.message}`);
      return;
    }

    setTasks((prev) => prev.filter((task) => task.id !== taskId));
    setSelectedTask((prev) => (prev?.id === taskId ? null : prev));
    setSheetOpen(false);
    void registerTaskHistory(taskId, "Tarefa excluída", taskToDelete.title);

    toast.success("Tarefa excluída", {
      action: {
        label: "Desfazer",
        onClick: () => {
          if (!snapshot) return;
          void (async () => {
            const { error: restoreError } = await supabase
              .from("kanban_tasks")
              .insert(snapshot as KanbanTaskSnapshot);

            if (restoreError) {
              toast.error(`Não foi possível desfazer: ${restoreError.message}`);
              return;
            }

            setTasks((prev) => [
              mapRowToTask(snapshot as unknown as KanbanTaskRow),
              ...prev,
            ]);
            void registerTaskHistory(
              taskId,
              "Exclusao desfeita",
              taskToDelete.title,
            );
            toast.success("Tarefa restaurada com sucesso");
          })();
        },
      },
    });
  };

  const updateTaskCounter = (
    taskId: string,
    field: "attachments" | "comments",
    count: number,
  ) => {
    setTasks((prev) =>
      prev.map((task) =>
        task.id === taskId ? { ...task, [field]: count } : task,
      ),
    );

    setSelectedTask((prev) => {
      if (!prev || prev.id !== taskId) return prev;
      return { ...prev, [field]: count };
    });
  };

  const handleCommentCountChange = (taskId: string, count: number) => {
    updateTaskCounter(taskId, "comments", count);
  };

  const handleAttachmentCountChange = (taskId: string, count: number) => {
    updateTaskCounter(taskId, "attachments", count);
  };

  const content = (
    <>
      <div className="max-w-7xl space-y-4">
        {!embedded && (
          <div className="flex items-center justify-between">
            <div>
              <ModuleContextPill icon={CheckCircle2} label="Operação diária" />
              <h1 className="font-heading text-2xl font-bold">Tarefas</h1>
              <p className="text-sm text-muted-foreground">
                Gestão completa de tarefas da equipe
              </p>
            </div>
            <Button
              className="gap-2"
              onClick={() => {
                setRelatedSourceTask(null);
                setCreateOpen(true);
              }}
            >
              <Plus className="h-4 w-4" /> Nova Tarefa
            </Button>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 bg-card/45 px-3 py-2.5">
          <TaskOriginLegend />
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <div className="flex w-full items-center gap-2 rounded-md border border-border/70 bg-background/80 px-3 py-2 sm:w-72">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                placeholder="Buscar tarefa ou cliente..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            <Filter className="hidden h-4 w-4 text-muted-foreground sm:block" />
            <select
              className="h-9 rounded-md border border-border/70 bg-background/80 px-3 text-xs outline-none"
              value={sectorFilter}
              onChange={(event) => setSectorFilter(event.target.value)}
            >
              {sectorFilterOptions.map((sector) => (
                <option key={sector}>{sector}</option>
              ))}
            </select>
            <select
              className="h-9 rounded-md border border-border/70 bg-background/80 px-3 text-xs outline-none"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              {statuses.map((status) => (
                <option key={status}>{status}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5">
          {[
            {
              label: "Total",
              value: scopedTasks.length,
              color: "text-foreground",
            },
            {
              label: "Pendentes",
              value: scopedTasks.filter((t) => t.status === "Pendente").length,
              color: "text-muted-foreground",
            },
            {
              label: "Em andamento",
              value: scopedTasks.filter((t) => t.status === "Em andamento")
                .length,
              color: "text-primary",
            },
            {
              label: "Atrasadas",
              value: scopedTasks.filter((t) => t.status === "Atrasado").length,
              color: "text-destructive",
            },
            {
              label: "Concluídas",
              value: scopedTasks.filter((t) => t.status === "Concluído").length,
              color: "text-primary",
            },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-md border border-border/60 bg-muted/20 px-3 py-2"
            >
              <div className={`text-lg font-semibold leading-none ${item.color}`}>
                {item.value}
              </div>
              <div className="mt-1 text-[11px] text-muted-foreground">
                {item.label}
              </div>
            </div>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((task, index) => {
              const statusCfg = statusConfig[task.status];
              const priorityCfg = priorityConfig[task.priority];
              const subtaskDone = task.subtasks.filter(
                (subtask) => subtask.done,
              ).length;
              const subtaskPct = task.subtasks.length
                ? Math.round((subtaskDone / task.subtasks.length) * 100)
                : 0;
              const StatusIcon = statusCfg.icon;

              return (
                <motion.div
                  key={task.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.04 }}
                  className="relative overflow-hidden rounded-lg border border-border/60 bg-card/95 p-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-all hover:border-primary/25 hover:shadow-sm cursor-pointer"
                  onClick={() => {
                    setSelectedTask(task);
                    setSheetOpen(true);
                  }}
                >
                  <TaskOriginRibbon
                    requestId={task.requestId}
                    integrationSource={task.integrationSource}
                  />
                  <div className="flex items-start gap-3 pr-10 sm:pr-12">
                    <div
                      className={`mt-0.5 h-7 w-7 rounded-md ${statusCfg.bg} flex items-center justify-center shrink-0`}
                    >
                      <StatusIcon className={`h-3.5 w-3.5 ${statusCfg.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-sm font-semibold text-foreground/95">{task.title}</h3>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {task.client || "Sem cliente"}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center justify-end gap-2 shrink-0">
                          <Badge
                            variant="outline"
                            className={`border-0 text-[11px] ${priorityCfg.color} ${priorityCfg.bg}`}
                          >
                            {formatPriorityLabel(task.priority)}
                          </Badge>
                          <Badge
                            variant="outline"
                            className={`border-0 text-[11px] ${statusCfg.color} ${statusCfg.bg}`}
                          >
                            {task.status}
                          </Badge>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <CalendarDays className="h-3 w-3" />
                          {task.dueDate
                            ? new Date(task.dueDate).toLocaleDateString("pt-BR")
                            : "Sem prazo"}
                        </span>
                        <span>{task.assignee || "Sem responsável"}</span>
                        <span>{task.sector}</span>
                        <span className="flex items-center gap-1">
                          <Paperclip className="h-3 w-3" />
                          {task.attachments}
                        </span>
                        <span className="flex items-center gap-1">
                          <MessageSquare className="h-3 w-3" />
                          {task.comments}
                        </span>
                        <div className="flex items-center gap-1">
                          {task.tags.map((tag) => (
                            <span
                              key={tag}
                              className="flex items-center gap-0.5 rounded bg-muted/70 px-1.5 py-0.5 text-xs"
                            >
                              <Tag className="h-2.5 w-2.5" />
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                      {task.subtasks.length > 0 && (
                        <div className="flex items-center gap-3 mt-3">
                          <Progress
                            value={subtaskPct}
                            className="h-1.5 flex-1 max-w-[200px]"
                          />
                          <span className="text-xs text-muted-foreground">
                            {subtaskDone}/{task.subtasks.length} subtarefas
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
            {filtered.length === 0 && (
              <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                Nenhuma tarefa encontrada.
              </div>
            )}
          </div>
        )}
      </div>

      <TaskDetailSheet
        task={selectedTask}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onSubtaskToggle={handleSubtaskToggle}
        onDeleteTask={handleDeleteTask}
        onCommentCountChange={handleCommentCountChange}
        onAttachmentCountChange={handleAttachmentCountChange}
        onHistory={(taskId, action, details) => {
          void registerTaskHistory(taskId, action, details);
        }}
        onOpenRelatedTask={handleOpenRelatedTask}
        onRemoveRelatedTask={(relationId) => {
          void handleRemoveRelatedTask(relationId);
        }}
        onCreateRelatedTask={handleCreateRelatedTask}
        actorName={actorLabel}
        historyEntries={selectedTaskHistory}
        relatedTasks={selectedTaskRelations}
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
              {relatedSourceTask ? "Nova tarefa relacionada" : "Nova Tarefa"}
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
                onChange={(event) =>
                  setNewTask((prev) => ({ ...prev, title: event.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea
                placeholder="Descreva a tarefa..."
                value={newTask.description}
                onChange={(event) =>
                  setNewTask((prev) => ({
                    ...prev,
                    description: event.target.value,
                  }))
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
                      {newTask.client ||
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
                              setNewTask((prev) => ({ ...prev, client: "" }));
                              setClientPickerOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                !newTask.client ? "opacity-100" : "opacity-0",
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
                                    client: matchedClient.name,
                                  }));
                                  setClientPickerOpen(false);
                                }
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  newTask.client === client.name
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
                <select
                  className="w-full rounded-lg border bg-card px-3 py-2 text-sm outline-none"
                  value={newTask.assignedToUserId || "unassigned"}
                  onChange={(event) => {
                    const selected = filteredCreateAssigneeOptions.find(
                      (option) => option.id === event.target.value,
                    );
                    setNewTask((prev) => ({
                      ...prev,
                      assignedToUserId:
                        event.target.value === "unassigned"
                          ? ""
                          : event.target.value,
                      assignee: selected?.name || "",
                    }));
                  }}
                >
                  <option value="unassigned">Sem responsável</option>
                  {!newTaskSectorCode && (
                    <option value="select-sector-first" disabled>
                      Selecione um setor primeiro
                    </option>
                  )}
                  {newTaskSectorCode &&
                    filteredCreateAssigneeOptions.length === 0 && (
                      <option value="no-sector-assignees" disabled>
                        Nenhum responsável no setor selecionado
                      </option>
                    )}
                  {filteredCreateAssigneeOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {formatTaskAssigneeLabel(option)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Setor</Label>
                <select
                  className="w-full text-sm bg-card border rounded-lg px-3 py-2 outline-none"
                  value={newTask.sector}
                  onChange={(event) =>
                    setNewTask((prev) => ({
                      ...prev,
                      sector: event.target.value,
                    }))
                  }
                >
                  {creatableSectors.map((sector) => (
                    <option key={sector}>{sector}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Prioridade</Label>
                <select
                  className="w-full text-sm bg-card border rounded-lg px-3 py-2 outline-none"
                  value={newTask.priority}
                  onChange={(event) =>
                    setNewTask((prev) => ({
                      ...prev,
                      priority: event.target.value as Task["priority"],
                    }))
                  }
                >
                  {["Urgente", "Alta", "Media", "Baixa"].map((priority) => (
                    <option key={priority} value={priority}>
                      {formatPriorityLabel(priority)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Prazo</Label>
                <Input
                  type="date"
                  value={newTask.dueDate}
                  onChange={(event) =>
                    setNewTask((prev) => ({
                      ...prev,
                      dueDate: event.target.value,
                    }))
                  }
                />
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
                  description: "",
                  client: "",
                  sector: creatableSectors[0] || "Geral",
                  assignee: "",
                  assignedToUserId: "",
                  priority: "Media",
                  dueDate: "",
                  subtasks: [],
                });
              }}
            >
              Cancelar
            </Button>
            <Button onClick={handleCreate}>Criar Tarefa</Button>
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

export default function TarefasPage() {
  return <TaskListView />;
}
