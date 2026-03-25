import { AppLayout } from "@/components/app/AppLayout";
import { KanbanTaskDetailSheet, type KanbanStatus, type KanbanTaskItem } from "@/components/app/KanbanTaskDetailSheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useGlobalFilters } from "@/hooks/useGlobalFilters";
import { motion } from "framer-motion";
import { Check, ChevronsUpDown, ExternalLink, Filter, Loader2, Plus, X } from "lucide-react";
import { useEffect, useMemo, useState, type DragEvent } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getTaskCompetence, matchesSelectedCompany, matchesSelectedCompetence } from "@/lib/globalFilters";
import { addHistoryEntry, getEntityHistory, type ChangeHistoryEntry } from "@/lib/changeHistory";

const baseColumns: { id: KanbanStatus; label: string; color: string }[] = [
  { id: "backlog", label: "Backlog", color: "bg-muted-foreground" },
  { id: "todo", label: "A Fazer", color: "bg-amber-500" },
  { id: "doing", label: "Em Andamento", color: "bg-primary" },
  { id: "review", label: "Revisao", color: "bg-purple-500" },
  { id: "done", label: "Concluido", color: "bg-primary" },
];

const archiveColumn: { id: KanbanStatus; label: string; color: string } = {
  id: "archived",
  label: "Arquivo",
  color: "bg-slate-500",
};

const sectors = ["ContÃ¡bil", "Fiscal", "Departamento Pessoal", "Financeiro", "Comercial", "SocietÃ¡rio", "Geral"];

const priorityDot: Record<string, string> = {
  Urgente: "bg-destructive",
  Alta: "bg-orange-500",
  "MÃ©dia": "bg-amber-500",
  "MÃƒÂ©dia": "bg-amber-500",
  Media: "bg-amber-500",
  Baixa: "bg-muted-foreground",
};

const normalizeSector = (value: string) =>
  value
    .replace("ContÃƒÂ¡bil", "ContÃ¡bil")
    .replace("SocietÃƒÂ¡rio", "SocietÃ¡rio")
    .trim();

const normalizePriority = (value: string) => value.replace("MÃƒÂ©dia", "MÃ©dia").trim();

const normalizeText = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

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
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const [dropTargetStatus, setDropTargetStatus] = useState<KanbanStatus | null>(null);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [historyVersion, setHistoryVersion] = useState(0);
  const [selectedTaskHistory, setSelectedTaskHistory] = useState<ChangeHistoryEntry[]>([]);
  const [newTask, setNewTask] = useState({
    title: "",
    client_name: "",
    assignee: "",
    priority: "MÃ©dia",
    sector: "ContÃ¡bil",
    subtasks: [] as TaskSubtask[],
  });

  const actorLabel = user?.email || "Usuario";

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

    const normalized = (data || []).map((task) => ({
      ...task,
      priority: normalizePriority(task.priority || ""),
      sector: normalizeSector(task.sector || ""),
      status: task.status as KanbanStatus,
      tags: (task.tags?.length ? task.tags : task.sector ? [task.sector] : []).map((sector) => normalizeSector(sector)),
      subtasks: parseSubtasks(task.subtasks),
    }));
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

  const getColumnTasks = (status: KanbanStatus) => filteredTasks.filter((task) => task.status === status);

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

    if (options?.undoable === false) {
      toast.success("Status da tarefa atualizado");
      return;
    }

    toast.success("Status da tarefa atualizado", {
      action: {
        label: "Desfazer",
        onClick: () => {
          void handleStatusChange(taskId, previousStatus, { undoable: false, skipHistory: true });
          registerTaskHistory(taskId, "Alteracao de status desfeita", `${newStatus} -> ${previousStatus}`);
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
    if (previousTask) {
      const changedFields: string[] = [];
      if ((previousTask.description || "") !== (updates.description || "")) changedFields.push("descricao");
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
    toast.success("Tarefa atualizada");
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
      toast.error(`Erro ao criar tarefa: ${error?.message || "Nao foi possivel criar a tarefa"}`);
      return;
    }

    registerTaskHistory(createdTask.id, "Tarefa criada", createdTask.title);

    toast.success("Tarefa adicionada ao Kanban");
    setCreateOpen(false);
    setNewSubtaskTitle("");
    setNewTask({ title: "", client_name: "", assignee: "", priority: "MÃ©dia", sector: "ContÃ¡bil", subtasks: [] });
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
      toast.error("Somente tarefas concluidas podem ser movidas para o arquivo");
      return;
    }

    await handleStatusChange(taskId, status);
  };

  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-heading text-2xl font-bold">Kanban</h1>
            <p className="text-sm text-muted-foreground">Gestao visual de demandas</p>
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
              const columnTasks = getColumnTasks(column.id);
              return (
                <div key={column.id} className="min-w-[280px] w-[280px] shrink-0">
                  <div className="flex items-center gap-2 mb-3">
                    <div className={`h-2 w-2 rounded-full ${column.color}`} />
                    <span className="text-sm font-semibold">{column.label}</span>
                    <span className="text-xs text-muted-foreground ml-auto">{columnTasks.length}</span>
                  </div>
                  <div
                    onDragOver={(event) => handleColumnDragOver(event, column.id)}
                    onDrop={(event) => void handleColumnDrop(event, column.id)}
                    className={`space-y-2 rounded-lg border border-dashed p-2 transition-colors ${
                      draggingTaskId && dropTargetStatus === column.id ? "border-primary bg-primary/5" : "border-border/40"
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
              <Input placeholder="Ex: Fechamento contabil" value={newTask.title} onChange={(e) => setNewTask((prev) => ({ ...prev, title: e.target.value }))} />
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
            <div className="grid grid-cols-2 gap-3">
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
            <div className="grid grid-cols-2 gap-3">
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
                  <SelectContent>{["Urgente", "Alta", "MÃ©dia", "Baixa"].map((priority) => <SelectItem key={priority} value={priority}>{priority}</SelectItem>)}</SelectContent>
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
                setNewTask({ title: "", client_name: "", assignee: "", priority: "MÃ©dia", sector: "ContÃ¡bil", subtasks: [] });
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
    doing: { label: "Enviar para Revisao", target: "review" },
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
              <ExternalLink className="h-2.5 w-2.5" /> Solicitacao
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

