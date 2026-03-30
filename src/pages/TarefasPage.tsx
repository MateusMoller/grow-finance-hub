import { AppLayout } from "@/components/app/AppLayout";
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
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { TaskDetailSheet } from "@/components/app/TaskDetailSheet";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { useGlobalFilters } from "@/hooks/useGlobalFilters";
import { getTaskCompetence, matchesSelectedCompany, matchesSelectedCompetence } from "@/lib/globalFilters";
import type { Tables } from "@/integrations/supabase/types";
import { addHistoryEntry, getEntityHistory, type ChangeHistoryEntry } from "@/lib/changeHistory";

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
  priority: "Alta" | "Media" | "Baixa" | "Urgente";
  dueDate: string;
  status: "Pendente" | "Em andamento" | "Em revisao" | "Concluido" | "Atrasado";
  createdAt: string;
  tags: string[];
  subtasks: TaskSubtask[];
  attachments: number;
  comments: number;
}

interface KanbanTaskRow {
  id: string;
  title: string;
  description: string | null;
  client_name: string | null;
  sector: string;
  assignee: string | null;
  priority: string;
  due_date: string | null;
  status: string;
  tags: string[] | null;
  created_at: string;
  subtasks?: unknown;
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

const statusConfig: Record<string, { color: string; bg: string; icon: typeof Circle }> = {
  Pendente: { color: "text-muted-foreground", bg: "bg-muted", icon: Circle },
  "Em andamento": { color: "text-primary", bg: "bg-primary/10", icon: Clock },
  "Em revisao": { color: "text-amber-600", bg: "bg-amber-100 dark:bg-amber-900/20", icon: AlertTriangle },
  Concluido: { color: "text-primary", bg: "bg-primary/10", icon: CheckCircle2 },
  Atrasado: { color: "text-destructive", bg: "bg-destructive/10", icon: AlertTriangle },
};

const sectors = ["Todos", "Contabil", "Fiscal", "Departamento Pessoal", "Financeiro"];
const statuses = ["Todos", "Pendente", "Em andamento", "Em revisao", "Concluido", "Atrasado"];

const normalizeText = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const normalizeSector = (value: string): string => {
  const normalized = normalizeText(value);
  if (normalized.includes("contabil")) return "Contabil";
  if (normalized.includes("fiscal")) return "Fiscal";
  if (normalized.includes("pessoal")) return "Departamento Pessoal";
  if (normalized.includes("finance")) return "Financeiro";
  return value || "Geral";
};

const normalizePriority = (value: string): Task["priority"] => {
  const normalized = normalizeText(value);
  if (normalized.includes("urgente")) return "Urgente";
  if (normalized.includes("alta")) return "Alta";
  if (normalized.includes("baixa")) return "Baixa";
  return "Media";
};

const deriveStatus = (status: string, dueDate: string | null): Task["status"] => {
  const normalizedStatus = normalizeText(status);

  if (normalizedStatus === "done" || normalizedStatus === "archived") {
    return "Concluido";
  }

  if (dueDate) {
    const dueAt = new Date(`${dueDate}T23:59:59`).getTime();
    if (!Number.isNaN(dueAt) && dueAt < Date.now()) {
      return "Atrasado";
    }
  }

  if (normalizedStatus === "doing") return "Em andamento";
  if (normalizedStatus === "review") return "Em revisao";
  return "Pendente";
};

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

const mapRowToTask = (row: KanbanTaskRow): Task => ({
  id: row.id,
  title: row.title,
  description: row.description || "",
  client: row.client_name || "",
  sector: normalizeSector(row.sector || ""),
  assignee: row.assignee || "",
  priority: normalizePriority(row.priority || ""),
  dueDate: row.due_date || "",
  status: deriveStatus(row.status || "todo", row.due_date),
  createdAt: row.created_at,
  tags: row.tags?.length ? row.tags.map(normalizeSector) : row.sector ? [normalizeSector(row.sector)] : [],
  subtasks: parseSubtasks(row.subtasks),
  attachments: 0,
  comments: 0,
});

const isSubtasksColumnIssue = (errorMessage: string | undefined) => {
  const normalized = normalizeText(errorMessage || "");
  if (!normalized.includes("subtasks")) return false;
  return normalized.includes("column") || normalized.includes("permission");
};

export default function TarefasPage() {
  const { user } = useAuth();
  const { selectedCompany, selectedCompetence } = useGlobalFilters();
  const location = useLocation();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
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
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [historyVersion, setHistoryVersion] = useState(0);
  const [selectedTaskHistory, setSelectedTaskHistory] = useState<ChangeHistoryEntry[]>([]);
  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    client: "",
    sector: "Contabil",
    assignee: "",
    priority: "Media" as Task["priority"],
    dueDate: "",
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
    const subtasksColumnReturned = rows.some((row) => Object.prototype.hasOwnProperty.call(row, "subtasks"));
    const mapped = rows
      .filter((row) => row.status !== "archived")
      .map(mapRowToTask);

    setSubtasksAvailable((prev) => (rows.length === 0 ? prev : subtasksColumnReturned));
    setTasks(mapped);
    setLoading(false);
  }, []);

  const loadClients = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    void loadTasks();
    void loadClients();
  }, [loadClients, loadTasks]);

  const scopedTasks = useMemo(
    () =>
      tasks.filter(
        (task) =>
          matchesSelectedCompany(task.client, selectedCompany) &&
          matchesSelectedCompetence(
            getTaskCompetence(task.dueDate || null, task.createdAt),
            selectedCompetence
          )
      ),
    [tasks, selectedCompany, selectedCompetence]
  );

  const filtered = scopedTasks.filter((task) => {
    const searchTerm = search.toLowerCase();
    if (search && !task.title.toLowerCase().includes(searchTerm) && !task.client.toLowerCase().includes(searchTerm)) return false;
    if (sectorFilter !== "Todos" && task.sector !== sectorFilter) return false;
    if (statusFilter !== "Todos" && task.status !== statusFilter) return false;
    return true;
  });

  useEffect(() => {
    if (!user?.id || !selectedTask?.id) {
      setSelectedTaskHistory([]);
      return;
    }

    setSelectedTaskHistory(getEntityHistory(user.id, "task", selectedTask.id, 12));
  }, [historyVersion, selectedTask?.id, user?.id]);

  const handleSubtaskToggle = (taskId: string, subtaskIndex: number) => {
    if (!subtasksAvailable) {
      toast.warning("Subtarefas nao estao disponiveis no banco atual.");
      return;
    }

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
      toggledSubtask.done ? "Subtarefa reaberta" : "Subtarefa concluida",
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
            toast.warning("Subtarefas nao estao disponiveis no banco atual.");
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

    if (!newTask.client.trim()) {
      toast.error("Selecione um cliente cadastrado");
      return;
    }

    const selectedClient = clients.find(
      (client) => normalizeText(client.name) === normalizeText(newTask.client)
    );
    if (!selectedClient) {
      toast.error("Cliente invalido. Selecione um cliente da lista");
      return;
    }

    const baseInsertPayload = {
      title: newTask.title.trim(),
      description: newTask.description.trim() || null,
      client_name: selectedClient.name,
      sector: newTask.sector,
      assignee: newTask.assignee.trim() || null,
      priority: newTask.priority,
      due_date: newTask.dueDate || null,
      status: "todo",
      tags: [newTask.sector],
      created_by: user?.id || null,
    };

    const firstTry = await supabase
      .from("kanban_tasks")
      .insert(subtasksAvailable ? { ...baseInsertPayload, subtasks: newTask.subtasks } : baseInsertPayload)
      .select("id, title")
      .single();

    let createdTask = firstTry.data;
    let error = firstTry.error;
    let savedWithoutSubtasks = !subtasksAvailable;

    if (error && subtasksAvailable && isSubtasksColumnIssue(error.message)) {
      setSubtasksAvailable(false);
      savedWithoutSubtasks = true;
      const fallbackInsert = await supabase
        .from("kanban_tasks")
        .insert(baseInsertPayload)
        .select("id, title")
        .single();
      createdTask = fallbackInsert.data;
      error = fallbackInsert.error;
    }

    if (error || !createdTask) {
      toast.error(`Erro ao criar tarefa: ${error?.message || "Nao foi possivel criar a tarefa"}`);
      return;
    }

    registerTaskHistory(createdTask.id, "Tarefa criada", createdTask.title);

    setCreateOpen(false);
    setNewSubtaskTitle("");
    setNewTask({
      title: "",
      description: "",
      client: "",
      sector: "Contabil",
      assignee: "",
      priority: "Media",
      dueDate: "",
      subtasks: [],
    });
    if (savedWithoutSubtasks && newTask.subtasks.length > 0) {
      toast.success("Tarefa criada. Subtarefas nao foram salvas neste banco.");
    } else {
      toast.success("Tarefa criada com sucesso");
    }
    await loadTasks();
  };

  useEffect(() => {
    if (!selectedCompany) return;
    setNewTask((prev) => ({ ...prev, client: selectedCompany }));
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

  const handleDeleteTask = async (taskId: string) => {
    const taskToDelete = tasks.find((task) => task.id === taskId);
    if (!taskToDelete) return;

    const confirmed = window.confirm(`Excluir a tarefa "${taskToDelete.title}"?`);
    if (!confirmed) return;

    const { data: snapshot } = await supabase
      .from("kanban_tasks")
      .select("*")
      .eq("id", taskId)
      .maybeSingle();

    const { error } = await supabase.from("kanban_tasks").delete().eq("id", taskId);

    if (error) {
      toast.error(`Erro ao excluir tarefa: ${error.message}`);
      return;
    }

    setTasks((prev) => prev.filter((task) => task.id !== taskId));
    setSelectedTask((prev) => (prev?.id === taskId ? null : prev));
    setSheetOpen(false);
    registerTaskHistory(taskId, "Tarefa excluida", taskToDelete.title);

    toast.success("Tarefa excluida", {
      action: {
        label: "Desfazer",
        onClick: () => {
          if (!snapshot) return;
          void (async () => {
            const { error: restoreError } = await supabase
              .from("kanban_tasks")
              .insert(snapshot as KanbanTaskSnapshot);

            if (restoreError) {
              toast.error(`Nao foi possivel desfazer: ${restoreError.message}`);
              return;
            }

            setTasks((prev) => [mapRowToTask(snapshot as unknown as KanbanTaskRow), ...prev]);
            registerTaskHistory(taskId, "Exclusao desfeita", taskToDelete.title);
            toast.success("Tarefa restaurada com sucesso");
          })();
        },
      },
    });
  };

  return (
    <AppLayout>
      <div className="space-y-6 max-w-7xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-heading text-2xl font-bold">Tarefas</h1>
            <p className="text-sm text-muted-foreground">Gestao completa de tarefas da equipe</p>
          </div>
          <Button className="gap-2" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> Nova Tarefa
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: "Total", value: scopedTasks.length, color: "text-foreground" },
            { label: "Pendentes", value: scopedTasks.filter((t) => t.status === "Pendente").length, color: "text-muted-foreground" },
            { label: "Em andamento", value: scopedTasks.filter((t) => t.status === "Em andamento").length, color: "text-primary" },
            { label: "Atrasadas", value: scopedTasks.filter((t) => t.status === "Atrasado").length, color: "text-destructive" },
            { label: "Concluidas", value: scopedTasks.filter((t) => t.status === "Concluido").length, color: "text-primary" },
          ].map((item) => (
            <div key={item.label} className="rounded-lg border bg-card p-3 text-center">
              <div className={`text-xl font-bold ${item.color}`}>{item.value}</div>
              <div className="text-xs text-muted-foreground">{item.label}</div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex w-full items-center gap-2 rounded-lg border bg-card px-3 py-2 sm:flex-1 sm:min-w-[200px] sm:max-w-sm">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              className="bg-transparent text-sm outline-none w-full placeholder:text-muted-foreground"
              placeholder="Buscar tarefa ou cliente..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <select className="text-sm bg-card border rounded-lg px-3 py-2 outline-none" value={sectorFilter} onChange={(event) => setSectorFilter(event.target.value)}>
              {sectors.map((sector) => (
                <option key={sector}>{sector}</option>
              ))}
            </select>
            <select className="text-sm bg-card border rounded-lg px-3 py-2 outline-none" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              {statuses.map((status) => (
                <option key={status}>{status}</option>
              ))}
            </select>
          </div>
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
              const subtaskDone = task.subtasks.filter((subtask) => subtask.done).length;
              const subtaskPct = task.subtasks.length ? Math.round((subtaskDone / task.subtasks.length) * 100) : 0;
              const StatusIcon = statusCfg.icon;

              return (
                <motion.div
                  key={task.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.04 }}
                  className="rounded-xl border bg-card p-4 hover:shadow-md transition-all cursor-pointer"
                  onClick={() => {
                    setSelectedTask(task);
                    setSheetOpen(true);
                  }}
                >
                  <div className="flex items-start gap-4">
                    <div className={`mt-1 h-8 w-8 rounded-lg ${statusCfg.bg} flex items-center justify-center shrink-0`}>
                      <StatusIcon className={`h-4 w-4 ${statusCfg.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="font-medium text-sm">{task.title}</h3>
                          <p className="text-xs text-muted-foreground mt-0.5">{task.client || "Sem cliente"}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge variant="outline" className={`text-xs ${priorityCfg.color} ${priorityCfg.bg} border-0`}>
                            {task.priority}
                          </Badge>
                          <Badge variant="outline" className={`text-xs ${statusCfg.color} ${statusCfg.bg} border-0`}>
                            {task.status}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-4 mt-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><CalendarDays className="h-3 w-3" />{task.dueDate ? new Date(task.dueDate).toLocaleDateString("pt-BR") : "Sem prazo"}</span>
                        <span>{task.assignee || "Sem responsavel"}</span>
                        <span>{task.sector}</span>
                        <span className="flex items-center gap-1"><Paperclip className="h-3 w-3" />{task.attachments}</span>
                        <span className="flex items-center gap-1"><MessageSquare className="h-3 w-3" />{task.comments}</span>
                        <div className="flex items-center gap-1">
                          {task.tags.map((tag) => (
                            <span key={tag} className="flex items-center gap-0.5 bg-muted px-1.5 py-0.5 rounded text-xs">
                              <Tag className="h-2.5 w-2.5" />{tag}
                            </span>
                          ))}
                        </div>
                      </div>
                      {task.subtasks.length > 0 && (
                        <div className="flex items-center gap-3 mt-3">
                          <Progress value={subtaskPct} className="h-1.5 flex-1 max-w-[200px]" />
                          <span className="text-xs text-muted-foreground">{subtaskDone}/{task.subtasks.length} subtarefas</span>
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
        historyEntries={selectedTaskHistory}
      />

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nova Tarefa</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Titulo *</Label>
              <Input placeholder="Ex: Fechamento contabil" value={newTask.title} onChange={(event) => setNewTask((prev) => ({ ...prev, title: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Descricao</Label>
              <Textarea placeholder="Descreva a tarefa..." value={newTask.description} onChange={(event) => setNewTask((prev) => ({ ...prev, description: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Subtarefas</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Ex: Conferir pendencias do cliente"
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
                      {newTask.client || (loadingClients ? "Carregando clientes..." : "Selecione um cliente")}
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
                                  setNewTask((prev) => ({ ...prev, client: matchedClient.name }));
                                  setClientPickerOpen(false);
                                }
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  newTask.client === client.name ? "opacity-100" : "opacity-0"
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
                <Input placeholder="Nome" value={newTask.assignee} onChange={(event) => setNewTask((prev) => ({ ...prev, assignee: event.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Setor</Label>
                <select className="w-full text-sm bg-card border rounded-lg px-3 py-2 outline-none" value={newTask.sector} onChange={(event) => setNewTask((prev) => ({ ...prev, sector: event.target.value }))}>
                  {sectors.filter((sector) => sector !== "Todos").map((sector) => <option key={sector}>{sector}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Prioridade</Label>
                <select className="w-full text-sm bg-card border rounded-lg px-3 py-2 outline-none" value={newTask.priority} onChange={(event) => setNewTask((prev) => ({ ...prev, priority: event.target.value as Task["priority"] }))}>
                  {["Urgente", "Alta", "Media", "Baixa"].map((priority) => <option key={priority}>{priority}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Prazo</Label>
                <Input type="date" value={newTask.dueDate} onChange={(event) => setNewTask((prev) => ({ ...prev, dueDate: event.target.value }))} />
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
                  description: "",
                  client: "",
                  sector: "Contabil",
                  assignee: "",
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
    </AppLayout>
  );
}

