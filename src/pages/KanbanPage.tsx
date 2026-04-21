import { AppLayout } from "@/components/app/AppLayout";
import { KanbanTaskDetailSheet, type KanbanStatus, type KanbanTaskItem } from "@/components/app/KanbanTaskDetailSheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useGlobalFilters } from "@/hooks/useGlobalFilters";
import { motion } from "framer-motion";
import { Building2, Check, ChevronsUpDown, ExternalLink, Filter, FolderOpen, ListChecks, Loader2, Plus, X } from "lucide-react";
import { useEffect, useMemo, useState, type DragEvent } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getTaskCompetence, matchesSelectedCompany, matchesSelectedCompetence } from "@/lib/globalFilters";
import { addHistoryEntry, getEntityHistory, type ChangeHistoryEntry } from "@/lib/changeHistory";
import { completeLinkedRequestAndFormSubmissions } from "@/lib/requestStatusCascade";

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

const sectors = ["Contábil", "Fiscal", "Departamento Pessoal", "Financeiro", "Comercial", "Societário", "Geral"];

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
      const title = typeof subtask.title === "string" ? subtask.title.trim() : "";
      if (!title) return null;

      return {
        title,
        done: Boolean(subtask.done),
      };
    })
    .filter((item): item is TaskSubtask => item !== null);
};

const getOptionalTaskField = (task: KanbanTaskItem, field: string) => {
  const value = (task as unknown as Record<string, unknown>)[field];
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const isObligationTask = (task: KanbanTaskItem) => {
  const integrationSource = normalizeText(getOptionalTaskField(task, "integration_source") || "");
  if (integrationSource === "acessorias_obrigacao_semanal") return true;

  const hasObligationTag = (task.tags || []).some((tag) => normalizeText(tag).includes("obrigac"));
  if (hasObligationTag) return true;

  const title = normalizeText(task.title || "");
  return title.startsWith("[obrigação") || title.startsWith("obrigação");
};

const emptyStatusBuckets = (): Record<KanbanStatus, KanbanTaskItem[]> => ({
  backlog: [],
  todo: [],
  doing: [],
  review: [],
  done: [],
  archived: [],
});

export default function KanbanPage() {
  const { user, role } = useAuth();
  const { selectedCompany, selectedCompetence } = useGlobalFilters();
  const isAdmin = role === "admin";
  const [tasks, setTasks] = useState<KanbanTaskItem[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingClients, setLoadingClients] = useState(true);
  const [sectorFilter, setSectorFilter] = useState<string>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [clientPickerOpen, setClientPickerOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<KanbanTaskItem | null>(null);
  const [savingDetail, setSavingDetail] = useState(false);
  const [obligationFolderOpen, setObligationFolderOpen] = useState(false);
  const [obligationFolderStatus, setObligationFolderStatus] = useState<KanbanStatus | null>(null);
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const [dropTargetStatus, setDropTargetStatus] = useState<KanbanStatus | null>(null);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [historyVersion, setHistoryVersion] = useState(0);
  const [selectedTaskHistory, setSelectedTaskHistory] = useState<ChangeHistoryEntry[]>([]);
  const [newTask, setNewTask] = useState({
    title: "",
    client_name: "",
    assignee: "",
    priority: "Média",
    sector: "Contábil",
    subtasks: [] as TaskSubtask[],
  });

  const actorLabel = user?.email || "Usuário";

  const registerTaskHistory = (taskId: string, action: string, details?: string) => {
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
    () => (isAdmin ? [...baseColumns, archiveColumn] : baseColumns),
    [isAdmin]
  );

  useEffect(() => {
    void fetchTasks();
    void fetchClients();
  }, []);

  const fetchTasks = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("kanban_tasks").select("*").order("created_at", { ascending: false });

    if (error) {
      toast.error("Erro ao carregar tarefas");
      setLoading(false);
      return;
    }

    const normalized = (data || []).map((task) => {
      const taskRecord = task as unknown as Record<string, unknown>;
      return {
        ...task,
        priority: normalizePriority(task.priority || ""),
        sector: normalizeSector(task.sector || ""),
        status: task.status as KanbanStatus,
        tags: (task.tags?.length ? task.tags : task.sector ? [task.sector] : []).map((sector) => normalizeSector(sector)),
        subtasks: parseSubtasks(task.subtasks),
        integration_source:
          typeof taskRecord.integration_source === "string" ? taskRecord.integration_source : null,
        integration_task_id:
          typeof taskRecord.integration_task_id === "string" ? taskRecord.integration_task_id : null,
      };
    });
    setTasks(normalized as KanbanTaskItem[]);
    setLoading(false);
  };

  const fetchClients = async () => {
    setLoadingClients(true);
    const { data, error } = await supabase
      .from("clients")
      .select("id, name")
      .order("name");

    if (error) {
      toast.error("Erro ao carregar clientes cadastrados");
      setLoadingClients(false);
      return;
    }

    setClients((data || []) as ClientOption[]);
    setLoadingClients(false);
  };

  const filteredTasks = tasks.filter((task) => {
    if (!isAdmin && task.status === "archived") return false;
    if (!matchesSelectedCompany(task.client_name, selectedCompany)) return false;
    if (!matchesSelectedCompetence(getTaskCompetence(task.due_date, task.created_at), selectedCompetence)) return false;
    const taskSectors = task.tags.length > 0 ? task.tags : task.sector ? [task.sector] : [];
    if (sectorFilter !== "all" && !taskSectors.includes(sectorFilter)) return false;
    return true;
  });

  const obligationTasksByStatus = useMemo(() => {
    const grouped = emptyStatusBuckets();
    filteredTasks.forEach((task) => {
      if (!isObligationTask(task)) return;
      grouped[task.status].push(task);
    });
    return grouped;
  }, [filteredTasks]);

  const regularTasksByStatus = useMemo(() => {
    const grouped = emptyStatusBuckets();
    filteredTasks.forEach((task) => {
      if (isObligationTask(task)) return;
      grouped[task.status].push(task);
    });
    return grouped;
  }, [filteredTasks]);

  const selectedObligationFolderTasks = useMemo(() => {
    if (!obligationFolderStatus) return [];
    const tasksByStatus = obligationTasksByStatus[obligationFolderStatus] || [];
    return [...tasksByStatus].sort((left, right) => {
      const leftDueDate = left.due_date || "9999-12-31";
      const rightDueDate = right.due_date || "9999-12-31";
      if (leftDueDate === rightDueDate) {
        return left.title.localeCompare(right.title, "pt-BR");
      }
      return leftDueDate.localeCompare(rightDueDate);
    });
  }, [obligationFolderStatus, obligationTasksByStatus]);

  const selectedObligationFolderLabel = useMemo(
    () => columns.find((column) => column.id === obligationFolderStatus)?.label || "",
    [columns, obligationFolderStatus],
  );

  useEffect(() => {
    if (!user?.id || !selectedTask?.id) {
      setSelectedTaskHistory([]);
      return;
    }

    setSelectedTaskHistory(getEntityHistory(user.id, "task", selectedTask.id, 15));
  }, [historyVersion, selectedTask?.id, user?.id]);

  const handleStatusChange = async (
    taskId: string,
    newStatus: KanbanStatus,
    options?: { undoable?: boolean; skipHistory?: boolean },
  ) => {
    const currentTask = tasks.find((task) => task.id === taskId);
    if (!currentTask || currentTask.status === newStatus) return;

    const previousStatus = currentTask.status;
    const { error } = await supabase.from("kanban_tasks").update({ status: newStatus }).eq("id", taskId);
    if (error) {
      toast.error(`Erro ao mover tarefa: ${error.message}`);
      return;
    }

    setTasks((prev) => prev.map((task) => (task.id === taskId ? { ...task, status: newStatus } : task)));
    setSelectedTask((prev) => (prev && prev.id === taskId ? { ...prev, status: newStatus } : prev));

    if (!options?.skipHistory) {
      registerTaskHistory(taskId, "Status alterado", `${previousStatus} -> ${newStatus}`);
    }

    const shouldCascadeCompletion = newStatus === "done" && Boolean(currentTask.request_id);
    let cascadeErrors: string[] = [];

    if (shouldCascadeCompletion) {
      const cascadeResult = await completeLinkedRequestAndFormSubmissions(currentTask.request_id);
      cascadeErrors = cascadeResult.errors;
    }

    if (cascadeErrors.length > 0) {
      toast.warning(`Tarefa atualizada, mas houve falha na cascata: ${cascadeErrors.join(" | ")}`);
      return;
    }

    if (options?.undoable === false || shouldCascadeCompletion) {
      if (shouldCascadeCompletion) {
        toast.success("Tarefa concluida e itens vinculados finalizados.");
        return;
      }
      toast.success("Status da tarefa atualizado");
      return;
    }

    toast.success("Status da tarefa atualizado", {
      action: {
        label: "Desfazer",
        onClick: () => {
          void handleStatusChange(taskId, previousStatus, { undoable: false, skipHistory: true });
          registerTaskHistory(taskId, "Alteração de status desfeita", `${newStatus} -> ${previousStatus}`);
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
      priority: string;
      sector: string;
      status: KanbanStatus;
      due_date: string | null;
      tags: string[];
    }
  ) => {
    const previousTask = tasks.find((task) => task.id === taskId);
    setSavingDetail(true);
    const { error } = await supabase.from("kanban_tasks").update(updates).eq("id", taskId);
    setSavingDetail(false);

    if (error) {
      toast.error(`Erro ao salvar detalhes da tarefa: ${error.message}`);
      return;
    }

    setTasks((prev) => prev.map((task) => (task.id === taskId ? { ...task, ...updates } : task)));
    setSelectedTask((prev) => (prev && prev.id === taskId ? { ...prev, ...updates } : prev));

    const shouldCascadeCompletion =
      Boolean(previousTask?.request_id) && updates.status === "done" && previousTask?.status !== "done";
    let cascadeErrors: string[] = [];

    if (shouldCascadeCompletion && previousTask?.request_id) {
      const cascadeResult = await completeLinkedRequestAndFormSubmissions(previousTask.request_id);
      cascadeErrors = cascadeResult.errors;
    }
    if (previousTask) {
      const changedFields: string[] = [];
      if ((previousTask.description || "") !== (updates.description || "")) changedFields.push("descrição");
      if ((previousTask.client_name || "") !== (updates.client_name || "")) changedFields.push("cliente");
      if ((previousTask.assignee || "") !== (updates.assignee || "")) changedFields.push("responsavel");
      if (previousTask.priority !== updates.priority) changedFields.push("prioridade");
      if (previousTask.sector !== updates.sector) changedFields.push("setor");
      if (previousTask.status !== updates.status) changedFields.push("status");
      if ((previousTask.due_date || "") !== (updates.due_date || "")) changedFields.push("prazo");
      const previousTags = (previousTask.tags || []).join("|");
      const nextTags = updates.tags.join("|");
      if (previousTags !== nextTags) changedFields.push("tags");
      if (changedFields.length > 0) {
        registerTaskHistory(taskId, "Detalhes da tarefa atualizados", changedFields.join(", "));
      }
    }
    if (cascadeErrors.length > 0) {
      toast.warning(`Tarefa atualizada, mas houve falha na cascata: ${cascadeErrors.join(" | ")}`);
      return;
    }

    if (shouldCascadeCompletion) {
      toast.success("Tarefa atualizada e itens vinculados finalizados.");
      return;
    }

    toast.success("Tarefa atualizada");
  };

  const handleSubtaskToggle = (taskId: string, subtaskIndex: number) => {
    const taskToUpdate = tasks.find((task) => task.id === taskId);
    if (!taskToUpdate || !taskToUpdate.subtasks[subtaskIndex]) return;
    const toggledSubtask = taskToUpdate.subtasks[subtaskIndex];

    const updatedSubtasks = taskToUpdate.subtasks.map((subtask, index) =>
      index === subtaskIndex ? { ...subtask, done: !subtask.done } : subtask
    );

    setTasks((prev) =>
      prev.map((task) => {
        if (task.id !== taskId) return task;
        return { ...task, subtasks: updatedSubtasks };
      })
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

    if (!newTask.client_name.trim()) {
      toast.error("Selecione um cliente cadastrado");
      return;
    }

    const selectedClient = clients.find(
      (client) => normalizeText(client.name) === normalizeText(newTask.client_name)
    );
    if (!selectedClient) {
      toast.error("Cliente invalido. Selecione um cliente da lista");
      return;
    }

    const { data: createdTask, error } = await supabase
      .from("kanban_tasks")
      .insert({
        title: newTask.title,
        client_name: selectedClient.name,
        assignee: newTask.assignee || null,
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
      toast.error(`Erro ao criar tarefa: ${error?.message || "Não foi possível criar a tarefa"}`);
      return;
    }

    registerTaskHistory(createdTask.id, "Tarefa criada", createdTask.title);

    toast.success("Tarefa adicionada ao Kanban");
    setCreateOpen(false);
    setNewSubtaskTitle("");
    setNewTask({ title: "", client_name: "", assignee: "", priority: "Média", sector: "Contábil", subtasks: [] });
    void fetchTasks();
  };

  useEffect(() => {
    if (!selectedCompany) return;
    setNewTask((prev) => ({ ...prev, client_name: selectedCompany }));
  }, [selectedCompany]);

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

  const handleColumnDragOver = (event: DragEvent<HTMLDivElement>, status: KanbanStatus) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    if (dropTargetStatus !== status) setDropTargetStatus(status);
  };

  const handleColumnDrop = async (event: DragEvent<HTMLDivElement>, status: KanbanStatus) => {
    event.preventDefault();
    const taskId = draggingTaskId || event.dataTransfer.getData("text/plain");
    const draggedTask = tasks.find((task) => task.id === taskId);

    handleDragEnd();
    if (!draggedTask || draggedTask.status === status) return;
    if (status === "archived" && draggedTask.status !== "done") {
      toast.error("Somente tarefas concluídas podem ser movidas para o arquivo");
      return;
    }

    await handleStatusChange(taskId, status);
  };

  const openObligationFolder = (status: KanbanStatus) => {
    setObligationFolderStatus(status);
    setObligationFolderOpen(true);
  };

  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-heading text-2xl font-bold">Kanban</h1>
            <p className="text-sm text-muted-foreground">Gestão visual de demandas</p>
          </div>
          <div className="flex gap-2">
            <Select value={sectorFilter} onValueChange={setSectorFilter}>
              <SelectTrigger className="w-52">
                <Filter className="h-4 w-4 mr-1" />
                <SelectValue placeholder="Filtrar setor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Setores</SelectItem>
                {sectors.map((sector) => (
                  <SelectItem key={sector} value={sector}>
                    {sector}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="default" size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> Nova Tarefa
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-4">
            {columns.map((column) => {
              const columnObligationTasks = obligationTasksByStatus[column.id] || [];
              const columnRegularTasks = regularTasksByStatus[column.id] || [];
              const columnTotalTasks = columnObligationTasks.length + columnRegularTasks.length;
              const companiesTotal = columnObligationTasks.reduce((acc, task) => acc + task.subtasks.length, 0);
              const companiesDone = columnObligationTasks.reduce(
                (acc, task) => acc + task.subtasks.filter((subtask) => subtask.done).length,
                0,
              );

              return (
                <div key={column.id} className="min-w-[calc(100vw-2.75rem)] w-[calc(100vw-2.75rem)] shrink-0 sm:min-w-[280px] sm:w-[280px]">
                  <div className="flex items-center gap-2 mb-3">
                    <div className={`h-2 w-2 rounded-full ${column.color}`} />
                    <span className="text-sm font-semibold">{column.label}</span>
                    <span className="text-xs text-muted-foreground ml-auto">{columnTotalTasks}</span>
                  </div>
                  <div
                    onDragOver={(event) => handleColumnDragOver(event, column.id)}
                    onDrop={(event) => void handleColumnDrop(event, column.id)}
                    className={`space-y-2 rounded-lg border border-dashed p-2 transition-colors ${
                      draggingTaskId && dropTargetStatus === column.id ? "border-primary bg-primary/5" : "border-border/40"
                    }`}
                  >
                    <ObligationsFolderCard
                      columnLabel={column.label}
                      obligationsCount={columnObligationTasks.length}
                      companiesCount={companiesTotal}
                      companiesDone={companiesDone}
                      onOpen={() => openObligationFolder(column.id)}
                    />
                    {columnRegularTasks.map((task, index) => (
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
                    {columnRegularTasks.length === 0 && columnObligationTasks.length === 0 && (
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

      <Dialog open={obligationFolderOpen} onOpenChange={setObligationFolderOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[88vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderOpen className="h-4 w-4" />
              Pasta de Obrigações - {selectedObligationFolderLabel || "Etapa"}
            </DialogTitle>
            <DialogDescription>
              Veja as obrigações desta etapa, marque as empresas concluídas e mova a obrigação inteira de etapa.
            </DialogDescription>
          </DialogHeader>

          {selectedObligationFolderTasks.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground text-center">
              Nenhuma obrigação nesta etapa.
            </div>
          ) : (
            <div className="space-y-4">
              {selectedObligationFolderTasks.map((task) => {
                const doneCount = task.subtasks.filter((subtask) => subtask.done).length;
                const totalCount = task.subtasks.length;
                const progress = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

                return (
                  <div key={task.id} className="rounded-lg border p-4 space-y-3">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="space-y-1">
                        <p className="text-sm font-semibold">{task.title}</p>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            <Building2 className="h-3.5 w-3.5" />
                            {totalCount} empresa(s)
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <ListChecks className="h-3.5 w-3.5" />
                            {doneCount} concluída(s)
                          </span>
                          {task.due_date && <span>Vencimento: {new Date(task.due_date).toLocaleDateString("pt-BR")}</span>}
                        </div>
                      </div>
                      <div className="w-full md:w-56 space-y-1">
                        <Label className="text-xs">Mover obrigação para etapa</Label>
                        <Select
                          value={task.status}
                          onValueChange={(value) =>
                            void handleStatusChange(task.id, value as KanbanStatus, { undoable: false })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {columns.map((column) => (
                              <SelectItem key={column.id} value={column.id}>
                                {column.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <Progress value={progress} className="h-2" />
                    <p className="text-xs text-muted-foreground">
                      Progresso: {doneCount}/{totalCount} empresa(s) ({progress}%)
                    </p>

                    {totalCount === 0 ? (
                      <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                        Esta obrigação ainda não possui empresas cadastradas como subtarefa.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {task.subtasks.map((subtask, subtaskIndex) => (
                          <label
                            key={`${task.id}-${subtask.title}-${subtaskIndex}`}
                            className="flex items-center gap-2 rounded-md border px-2.5 py-2 text-sm cursor-pointer"
                          >
                            <Checkbox
                              checked={subtask.done}
                              onCheckedChange={() => handleSubtaskToggle(task.id, subtaskIndex)}
                            />
                            <span className={subtask.done ? "line-through text-muted-foreground" : ""}>
                              {subtask.title}
                            </span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nova Tarefa no Kanban</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Titulo *</Label>
              <Input placeholder="Ex: Fechamento contábil" value={newTask.title} onChange={(e) => setNewTask((prev) => ({ ...prev, title: e.target.value }))} />
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
                <Button type="button" variant="outline" onClick={handleAddDraftSubtask} disabled={!newSubtaskTitle.trim()}>
                  Adicionar
                </Button>
              </div>
              {newTask.subtasks.length > 0 ? (
                <div className="space-y-1.5 rounded-lg border p-2">
                  {newTask.subtasks.map((subtask, index) => (
                    <div key={`${subtask.title}-${index}`} className="flex items-center justify-between gap-2 rounded-md bg-muted/40 px-2 py-1.5">
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
                <p className="text-xs text-muted-foreground">Nenhuma subtarefa adicionada.</p>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Cliente</Label>
                <Popover open={clientPickerOpen} onOpenChange={setClientPickerOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      role="combobox"
                      aria-expanded={clientPickerOpen}
                      className="w-full justify-between"
                      disabled={loadingClients}
                    >
                      {newTask.client_name || (loadingClients ? "Carregando clientes..." : "Selecione um cliente")}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                    <Command>
                      <CommandInput placeholder="Buscar cliente..." />
                      <CommandList>
                        <CommandEmpty>Nenhum cliente encontrado.</CommandEmpty>
                        <CommandGroup>
                          {clients.map((client) => (
                            <CommandItem
                              key={client.id}
                              value={client.name}
                              onSelect={(selectedValue) => {
                                const matchedClient = clients.find(
                                  (item) => normalizeText(item.name) === normalizeText(selectedValue)
                                );
                                if (matchedClient) {
                                  setNewTask((prev) => ({ ...prev, client_name: matchedClient.name }));
                                  setClientPickerOpen(false);
                                }
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  newTask.client_name === client.name ? "opacity-100" : "opacity-0"
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
                <Input placeholder="Nome" value={newTask.assignee} onChange={(e) => setNewTask((prev) => ({ ...prev, assignee: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Setor</Label>
                <Select value={newTask.sector} onValueChange={(value) => setNewTask((prev) => ({ ...prev, sector: value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{sectors.map((sector) => <SelectItem key={sector} value={sector}>{sector}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Prioridade</Label>
                <Select value={newTask.priority} onValueChange={(value) => setNewTask((prev) => ({ ...prev, priority: value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{["Urgente", "Alta", "Média", "Baixa"].map((priority) => <SelectItem key={priority} value={priority}>{priority}</SelectItem>)}</SelectContent>
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
                setNewTask({ title: "", client_name: "", assignee: "", priority: "Média", sector: "Contábil", subtasks: [] });
              }}
            >
              Cancelar
            </Button>
            <Button onClick={handleCreate}>Adicionar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

function ObligationsFolderCard({
  columnLabel,
  obligationsCount,
  companiesCount,
  companiesDone,
  onOpen,
}: {
  columnLabel: string;
  obligationsCount: number;
  companiesCount: number;
  companiesDone: number;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full rounded-lg border bg-muted/20 p-3 text-left transition-colors hover:bg-muted/30"
    >
      <div className="flex items-start gap-2">
        <FolderOpen className="h-4 w-4 mt-0.5 text-primary shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-semibold">Obrigações</p>
          <p className="text-xs text-muted-foreground">
            Etapa {columnLabel}: {obligationsCount} obrigação(oes)
          </p>
          <p className="text-xs text-muted-foreground">
            Empresas: {companiesDone}/{companiesCount} concluídas
          </p>
        </div>
      </div>
    </button>
  );
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
  const nextStatus: Partial<Record<KanbanStatus, { label: string; target: KanbanStatus }>> = {
    backlog: { label: "Mover para A Fazer", target: "todo" },
    todo: { label: "Iniciar", target: "doing" },
    doing: { label: "Enviar para Revisão", target: "review" },
    review: { label: "Concluir", target: "done" },
    done: canArchive ? { label: "Arquivar", target: "archived" } : undefined,
  };

  const taskSectors = task.tags.length > 0 ? task.tags : task.sector ? [task.sector] : [];
  const primarySector = taskSectors[0] || "Geral";
  const extraSectors = Math.max(taskSectors.length - 1, 0);
  const action = nextStatus[currentStatus];

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
      className={`rounded-lg border bg-card p-3.5 hover:shadow-md transition-shadow group cursor-grab active:cursor-grabbing ${
        isDragging ? "opacity-50" : ""
      }`}
    >
      <div className="flex items-start justify-between mb-2">
        <span className="text-sm font-medium leading-tight">{task.title}</span>
        <div className={`h-2 w-2 rounded-full mt-1.5 shrink-0 ${priorityDot[task.priority] || "bg-muted-foreground"}`} />
      </div>

      {task.client_name && <div className="text-xs text-muted-foreground">{task.client_name}</div>}

      <div className="flex items-center justify-between mt-3">
        <div className="flex items-center gap-1.5">
          <span className="text-xs px-2 py-0.5 rounded-md bg-muted text-muted-foreground">
            {extraSectors > 0 ? `${primarySector} +${extraSectors}` : primarySector}
          </span>
          {task.request_id && (
            <Badge variant="outline" className="text-[10px] gap-0.5 px-1.5 py-0">
              <ExternalLink className="h-2.5 w-2.5" /> Solicitação
            </Badge>
          )}
        </div>
        {task.assignee && (
          <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center">
            <span className="text-[10px] font-semibold text-primary">
              {task.assignee.split(" ").map((name) => name[0]).join("").slice(0, 2)}
            </span>
          </div>
        )}
      </div>

      {action && (
        <Button
          variant="ghost"
          size="sm"
          className="w-full mt-2 h-7 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(event) => {
            event.stopPropagation();
            onStatusChange(task.id, action.target);
          }}
        >
          {action.label} {"->"}
        </Button>
      )}
    </motion.div>
  );
}

