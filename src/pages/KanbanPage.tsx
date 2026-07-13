import { AppLayout } from "@/components/app/AppLayout";
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
import { motion } from "framer-motion";
import { Archive, CalendarDays, Check, ChevronsUpDown, Filter, Loader2, Plus, X } from "lucide-react";
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
  addHistoryEntry,
  getEntityHistory,
  type ChangeHistoryEntry,
} from "@/lib/changeHistory";
import {
  canCreateTaskInSector,
  getCanonicalTaskSectorAccess,
  normalizeTaskSectorLabel,
} from "@/lib/taskSectorAccess";
import { loadTaskAssignees } from "@/lib/taskAssignees";

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

const sectors = [
  "Contábil",
  "Fiscal",
  "Departamento Pessoal",
  "Comercial",
  "Societário",
  "Geral",
];

const taskSectorOptions = [
  "Contabil",
  "Fiscal",
  "Departamento Pessoal",
  "Comercial",
  "Societario",
  "Geral",
];

const priorityDot: Record<string, string> = {
  Urgente: "bg-destructive",
  Alta: "bg-orange-500",
  Média: "bg-amber-500",
  Media: "bg-amber-500",
  Baixa: "bg-muted-foreground",
};

const normalizeSector = (value: string) =>
  value
    .replace("ContÃ¡bil", "Contábil")
    .replace("ContÃƒÂ¡bil", "Contábil")
    .replace("SocietÃ¡rio", "Societário")
    .replace("SocietÃƒÂ¡rio", "Societário")
    .trim();

const normalizePriority = (value: string) =>
  value
    .replace("MÃ©dia", "Média")
    .replace("MÃƒÂ©dia", "Média")
    .replace("MÃƒÆ’Ã‚Â©dia", "Média")
    .trim();

const normalizeText = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const normalizeVisibleSector = (value: string) =>
  normalizeTaskSectorLabel(normalizeSector(value));

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
  const [assigneeOptions, setAssigneeOptions] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [loadingClients, setLoadingClients] = useState(true);
  const [sectorFilter, setSectorFilter] = useState<string>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [clientPickerOpen, setClientPickerOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<KanbanTaskItem | null>(null);
  const [savingDetail, setSavingDetail] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const [dropTargetStatus, setDropTargetStatus] = useState<KanbanStatus | null>(
    null,
  );
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [historyVersion, setHistoryVersion] = useState(0);
  const [selectedTaskHistory, setSelectedTaskHistory] = useState<
    ChangeHistoryEntry[]
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

  const registerTaskHistory = (
    taskId: string,
    action: string,
    details?: string,
  ) => {
    if (!user?.id) return;
    addHistoryEntry(user.id, {
      entityType: "task",
      entityId: taskId,
      action,
      details,
      actor: actorLabel,
    });
    setHistoryVersion((prev) => prev + 1);
  };

  const columns = useMemo(
    () => (isAdmin && showArchived ? [...baseColumns, archiveColumn] : baseColumns),
    [isAdmin, showArchived],
  );

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("create") !== "1") return;

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

  const fetchTasks = useCallback(async () => {
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

    const tasksToAutoArchive = (data || []).filter(shouldAutoArchiveCompletedTask);
    let autoArchivedIds = new Set<string>();
    if (tasksToAutoArchive.length > 0) {
      const { error: archiveError } = await supabase
        .from("kanban_tasks")
        .update({ status: "archived", updated_at: new Date().toISOString() })
        .in("id", tasksToAutoArchive.map((task) => task.id));

      if (archiveError) {
        toast.error("Nao foi possivel arquivar automaticamente tarefas concluidas antigas.");
      } else {
        autoArchivedIds = new Set(tasksToAutoArchive.map((task) => task.id));
      }
    }

    const normalized = (data || []).map((task) => {
      const taskRecord = task as unknown as Record<string, unknown>;
      return {
        ...task,
        priority: normalizePriority(task.priority || ""),
        sector: normalizeVisibleSector(task.sector || ""),
        status: (autoArchivedIds.has(task.id) ? "archived" : task.status) as KanbanStatus,
        tags: (task.tags?.length
          ? task.tags
          : task.sector
            ? [task.sector]
            : []
        ).map((sector) => normalizeVisibleSector(sector)),
        subtasks: parseSubtasks(task.subtasks),
        integration_source:
          typeof taskRecord.integration_source === "string"
            ? taskRecord.integration_source
            : null,
        integration_task_id:
          typeof taskRecord.integration_task_id === "string"
            ? taskRecord.integration_task_id
            : null,
      };
    });
    setTasks(normalized as KanbanTaskItem[]);
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
      toast.error("Nao foi possivel carregar os responsaveis.");
    }
  }, [currentOrganizationId]);

  useEffect(() => {
    void fetchTasks();
    void fetchClients();
    void fetchAssignees();
  }, [fetchAssignees, fetchClients, fetchTasks, user?.id]);

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
    return true;
  });

  useEffect(() => {
    if (sectorFilter === "all") return;
    if (!availableSectors.includes(sectorFilter)) setSectorFilter("all");
  }, [availableSectors, sectorFilter]);

  useEffect(() => {
    if (availableSectors.length === 0) return;
    if (!availableSectors.includes(newTask.sector)) {
      setNewTask((prev) => ({ ...prev, sector: availableSectors[0] }));
    }
  }, [availableSectors, newTask.sector]);

  const tasksByStatus = useMemo(() => {
    const grouped = tasksByStatusTemplate();
    filteredTasks.forEach((task) => {
      grouped[task.status].push(task);
    });
    return grouped;
  }, [filteredTasks]);
  const archivedCount = tasksByStatus.archived.length;

  useEffect(() => {
    if (!user?.id || !selectedTask?.id) {
      setSelectedTaskHistory([]);
      return;
    }

    setSelectedTaskHistory(
      getEntityHistory(user.id, "task", selectedTask.id, 15),
    );
  }, [historyVersion, selectedTask?.id, user?.id]);

  const handleStatusChange = async (
    taskId: string,
    newStatus: KanbanStatus,
    options?: { undoable?: boolean; skipHistory?: boolean },
  ) => {
    const currentTask = tasks.find((task) => task.id === taskId);
    if (!currentTask || currentTask.status === newStatus) return;

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
      registerTaskHistory(
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
          registerTaskHistory(
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
      if ((previousTask.description || "") !== (updates.description || ""))
        changedFields.push("descrição");
      if ((previousTask.client_name || "") !== (updates.client_name || ""))
        changedFields.push("cliente");
      if ((previousTask.assignee || "") !== (updates.assignee || ""))
        changedFields.push("responsavel");
      if (previousTask.priority !== updates.priority)
        changedFields.push("prioridade");
      if (previousTask.sector !== updates.sector) changedFields.push("setor");
      if (previousTask.status !== updates.status) changedFields.push("status");
      if ((previousTask.due_date || "") !== (updates.due_date || ""))
        changedFields.push("prazo");
      const previousTags = (previousTask.tags || []).join("|");
      const nextTags = updates.tags.join("|");
      if (previousTags !== nextTags) changedFields.push("tags");
      if (changedFields.length > 0) {
        registerTaskHistory(
          taskId,
          "Detalhes da tarefa atualizados",
          changedFields.join(", "),
        );
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

    registerTaskHistory(
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
      toast.error("Titulo e obrigatorio");
      return;
    }

    if (!canCreateTaskInSector(newTask.sector, effectiveAccess)) {
      toast.error("Voce nao tem permissao para criar tarefas neste setor");
      return;
    }

    const selectedClient = newTask.client_name.trim()
      ? clients.find(
          (client) =>
            normalizeText(client.name) === normalizeText(newTask.client_name),
        )
      : null;
    if (newTask.client_name.trim() && !selectedClient) {
      toast.error("Cliente invalido. Selecione um cliente da lista");
      return;
    }

    const { data: createdTask, error } = await supabase
      .from("kanban_tasks")
      .insert({
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
      })
      .select("id, title")
      .single();

    if (error || !createdTask) {
      toast.error(
        `Erro ao criar tarefa: ${error?.message || "Não foi possível criar a tarefa"}`,
      );
      return;
    }

    registerTaskHistory(createdTask.id, "Tarefa criada", createdTask.title);

    toast.success("Tarefa adicionada ao Kanban");
    setCreateOpen(false);
    setNewSubtaskTitle("");
    setNewTask({
      title: "",
      client_name: "",
      assignee: "",
      assigned_to_user_id: "",
      priority: "Média",
      sector: availableSectors[0] || "Geral",
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

  const handleAddDraftSubtask = () => {
    const title = newSubtaskTitle.trim();
    if (!title) return;

    setNewTask((prev) => ({
      ...prev,
      subtasks: [...prev.subtasks, { title, done: false }],
    }));
    setNewSubtaskTitle("");
  };

  const handleRemoveDraftSubtask = (index: number) => {
    setNewTask((prev) => ({
      ...prev,
      subtasks: prev.subtasks.filter((_, itemIndex) => itemIndex !== index),
    }));
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
        <div className="flex items-center justify-between">
          {!embedded && (
            <div>
              <h1 className="font-heading text-2xl font-bold">Kanban</h1>
              <p className="text-sm text-muted-foreground">
                Gestão visual de demandas
              </p>
            </div>
          )}
          <div className={`flex gap-2 ${embedded ? "ml-auto" : ""}`}>
            <Select value={sectorFilter} onValueChange={setSectorFilter}>
              <SelectTrigger className="w-52">
                <Filter className="h-4 w-4 mr-1" />
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
            {isAdmin && (
              <Button
                type="button"
                variant={showArchived ? "secondary" : "ghost"}
                size="sm"
                className="gap-1.5 text-muted-foreground"
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
            {!embedded && (
              <Button
                variant="default"
                size="sm"
                onClick={() => setCreateOpen(true)}
              >
                <Plus className="h-4 w-4 mr-1" /> Nova Tarefa
              </Button>
            )}
          </div>
        </div>

        <TaskOriginLegend />

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-4">
            {columns.map((column) => {
              const columnTasks = tasksByStatus[column.id] || [];

              return (
                <div
                  key={column.id}
                  className="min-w-[calc(100vw-2.75rem)] w-[calc(100vw-2.75rem)] shrink-0 sm:min-w-[280px] sm:w-[280px]"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <div className={`h-2 w-2 rounded-full ${column.color}`} />
                    <span className="text-sm font-semibold">
                      {column.label}
                    </span>
                    <span className="text-xs text-muted-foreground ml-auto">
                      {columnTasks.length}
                    </span>
                  </div>
                  <div
                    onDragOver={(event) =>
                      handleColumnDragOver(event, column.id)
                    }
                    onDrop={(event) => void handleColumnDrop(event, column.id)}
                    className={`space-y-2 rounded-lg border border-dashed p-2 transition-colors ${
                      draggingTaskId && dropTargetStatus === column.id
                        ? "border-primary bg-primary/5"
                        : "border-border/40"
                    }`}
                  >
                    {columnTasks.map((task, index) => (
                      <KanbanCard
                        key={task.id}
                        task={task}
                        index={index}
                        currentStatus={column.id}
                        onStatusChange={handleStatusChange}
                        onOpenDetails={() => {
                          setSelectedTask(task);
                          setDetailOpen(true);
                        }}
                        onDragStart={handleDragStart}
                        onDragEnd={handleDragEnd}
                        isDragging={draggingTaskId === task.id}
                        canArchive={isAdmin}
                      />
                    ))}
                    {columnTasks.length === 0 && (
                      <div className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
                        Arraste uma tarefa para esta coluna
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
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
        historyEntries={selectedTaskHistory}
      />

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nova Tarefa no Kanban</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Titulo *</Label>
              <Input
                placeholder="Ex: Fechamento contábil"
                value={newTask.title}
                onChange={(e) =>
                  setNewTask((prev) => ({ ...prev, title: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Subtarefas</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Ex: Validar documentos enviados"
                  value={newSubtaskTitle}
                  onChange={(event) => setNewSubtaskTitle(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      handleAddDraftSubtask();
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleAddDraftSubtask}
                  disabled={!newSubtaskTitle.trim()}
                >
                  Adicionar
                </Button>
              </div>
              {newTask.subtasks.length > 0 ? (
                <div className="space-y-1.5 rounded-lg border p-2">
                  {newTask.subtasks.map((subtask, index) => (
                    <div
                      key={`${subtask.title}-${index}`}
                      className="flex items-center justify-between gap-2 rounded-md bg-muted/40 px-2 py-1.5"
                    >
                      <span className="text-sm">{subtask.title}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => handleRemoveDraftSubtask(index)}
                        aria-label={`Remover subtarefa ${index + 1}`}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Nenhuma subtarefa adicionada.
                </p>
              )}
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
                <Label>Responsavel</Label>
                <Select
                  disabled={!isAdmin}
                  value={newTask.assigned_to_user_id || "unassigned"}
                  onValueChange={(value) => {
                    const selected = assigneeOptions.find(
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
                    {assigneeOptions.map((option) => (
                      <SelectItem key={option.id} value={option.id}>
                        {option.name}
                      </SelectItem>
                    ))}
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
                    {availableSectors.map((sector) => (
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
                setNewSubtaskTitle("");
                setNewTask({
                  title: "",
                  client_name: "",
                  assignee: "",
                  assigned_to_user_id: "",
                  priority: "Média",
                  sector: availableSectors[0] || "Geral",
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
      className={`relative flex min-h-[150px] flex-col overflow-hidden rounded-xl border border-border/80 bg-card p-3.5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-md group cursor-grab active:cursor-grabbing ${
        isDragging ? "opacity-50" : ""
      }`}
    >
      <TaskOriginRibbon
        requestId={task.request_id}
        integrationSource={task.integration_source}
        className="right-2"
      />
      <div className="flex flex-1 flex-col gap-3 pr-5">
        <div className="space-y-1.5">
          <div className="flex items-start justify-between gap-2">
            <span className="text-[15px] font-semibold leading-snug text-foreground">
              {task.title}
            </span>
            <div
              className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${priorityDot[task.priority] || "bg-muted-foreground"}`}
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

        <div className="mt-auto flex items-end justify-between gap-2">
          <span className="max-w-[150px] rounded-md bg-muted px-2 py-1 text-xs leading-tight text-muted-foreground">
            {extraSectors > 0
              ? `${primarySector} +${extraSectors}`
              : primarySector}
          </span>
          {task.assignee && (
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 ring-1 ring-primary/10">
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
            <div className="h-7 w-7 shrink-0 rounded-full border border-dashed border-border" />
          )}
        </div>
      </div>

      {action && (
        <div className="pt-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-full text-xs opacity-0 transition-opacity group-hover:opacity-100"
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
