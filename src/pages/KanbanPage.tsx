import { AppLayout } from "@/components/app/AppLayout";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Filter, Loader2, ExternalLink } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type KanbanStatus = "backlog" | "todo" | "doing" | "review" | "done";

interface KanbanTask {
  id: string;
  title: string;
  description: string | null;
  client_name: string | null;
  assignee: string | null;
  priority: string;
  sector: string;
  status: string;
  due_date: string | null;
  tags: string[];
  request_id: string | null;
  created_at: string;
}

const columns: { id: KanbanStatus; label: string; color: string }[] = [
  { id: "backlog", label: "Backlog", color: "bg-muted-foreground" },
  { id: "todo", label: "A Fazer", color: "bg-amber-500" },
  { id: "doing", label: "Em Andamento", color: "bg-primary" },
  { id: "review", label: "Revisão", color: "bg-purple-500" },
  { id: "done", label: "Concluído", color: "bg-primary" },
];

const sectors = ["Contábil", "Fiscal", "Departamento Pessoal", "Financeiro", "Comercial", "Societário", "Geral"];

const priorityDot: Record<string, string> = {
  Urgente: "bg-destructive",
  Alta: "bg-orange-500",
  Média: "bg-amber-500",
  Baixa: "bg-muted-foreground",
};

export default function KanbanPage() {
  const { user, role } = useAuth();
  const [tasks, setTasks] = useState<KanbanTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [sectorFilter, setSectorFilter] = useState<string>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [newTask, setNewTask] = useState({
    title: "", client_name: "", assignee: "", priority: "Média", sector: "Contábil",
  });

  const isAdmin = role === "admin";

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("kanban_tasks")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Erro ao carregar tarefas");
    } else {
      setTasks(data || []);
    }
    setLoading(false);
  };

  const filteredTasks = tasks.filter(t => {
    if (sectorFilter !== "all" && t.sector !== sectorFilter) return false;
    return true;
  });

  const getColumnTasks = (status: KanbanStatus) =>
    filteredTasks.filter(t => t.status === status);

  const handleStatusChange = async (taskId: string, newStatus: KanbanStatus) => {
    const { error } = await supabase
      .from("kanban_tasks")
      .update({ status: newStatus })
      .eq("id", taskId);

    if (error) {
      toast.error("Erro ao mover tarefa");
      return;
    }
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
  };

  const handleCreate = async () => {
    if (!newTask.title.trim()) { toast.error("Título é obrigatório"); return; }

    const { error } = await supabase.from("kanban_tasks").insert({
      title: newTask.title,
      client_name: newTask.client_name || null,
      assignee: newTask.assignee || null,
      priority: newTask.priority,
      sector: newTask.sector,
      status: "todo",
      tags: [newTask.sector],
      created_by: user?.id,
    });

    if (error) {
      toast.error("Erro ao criar tarefa");
      return;
    }

    toast.success("Tarefa adicionada ao Kanban");
    setCreateOpen(false);
    setNewTask({ title: "", client_name: "", assignee: "", priority: "Média", sector: "Contábil" });
    fetchTasks();
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
              <SelectTrigger className="w-44">
                <Filter className="h-4 w-4 mr-1" />
                <SelectValue placeholder="Filtrar setor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Setores</SelectItem>
                {sectors.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
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
            {columns.map((col) => {
              const colTasks = getColumnTasks(col.id);
              return (
                <div key={col.id} className="min-w-[280px] w-[280px] shrink-0">
                  <div className="flex items-center gap-2 mb-3">
                    <div className={`h-2 w-2 rounded-full ${col.color}`} />
                    <span className="text-sm font-semibold">{col.label}</span>
                    <span className="text-xs text-muted-foreground ml-auto">{colTasks.length}</span>
                  </div>
                  <div className="space-y-2">
                    {colTasks.map((task, i) => (
                      <KanbanCard
                        key={task.id}
                        task={task}
                        index={i}
                        currentStatus={col.id}
                        onStatusChange={handleStatusChange}
                      />
                    ))}
                    {colTasks.length === 0 && (
                      <div className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
                        Nenhuma tarefa
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nova Tarefa no Kanban</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Título *</Label>
              <Input placeholder="Ex: Fechamento contábil" value={newTask.title} onChange={e => setNewTask(p => ({ ...p, title: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Cliente</Label>
                <Input placeholder="Nome do cliente" value={newTask.client_name} onChange={e => setNewTask(p => ({ ...p, client_name: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Responsável</Label>
                <Input placeholder="Nome" value={newTask.assignee} onChange={e => setNewTask(p => ({ ...p, assignee: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Setor</Label>
                <Select value={newTask.sector} onValueChange={v => setNewTask(p => ({ ...p, sector: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {sectors.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Prioridade</Label>
                <Select value={newTask.priority} onValueChange={v => setNewTask(p => ({ ...p, priority: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["Urgente", "Alta", "Média", "Baixa"].map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate}>Adicionar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

// Extracted card component
function KanbanCard({
  task,
  index,
  currentStatus,
  onStatusChange,
}: {
  task: KanbanTask;
  index: number;
  currentStatus: KanbanStatus;
  onStatusChange: (id: string, status: KanbanStatus) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  const nextStatus: Partial<Record<KanbanStatus, { label: string; target: KanbanStatus }>> = {
    backlog: { label: "Mover para A Fazer", target: "todo" },
    todo: { label: "Iniciar", target: "doing" },
    doing: { label: "Enviar para Revisão", target: "review" },
    review: { label: "Concluir", target: "done" },
  };

  const action = nextStatus[currentStatus];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className="rounded-lg border bg-card p-3.5 hover:shadow-md transition-shadow group"
    >
      <div className="flex items-start justify-between mb-2">
        <span className="text-sm font-medium leading-tight">{task.title}</span>
        <div className={`h-2 w-2 rounded-full mt-1.5 shrink-0 ${priorityDot[task.priority] || "bg-muted-foreground"}`} />
      </div>

      {task.client_name && (
        <div className="text-xs text-muted-foreground">{task.client_name}</div>
      )}

      <div className="flex items-center justify-between mt-3">
        <div className="flex items-center gap-1.5">
          <span className="text-xs px-2 py-0.5 rounded-md bg-muted text-muted-foreground">{task.sector}</span>
          {task.request_id && (
            <Badge variant="outline" className="text-[10px] gap-0.5 px-1.5 py-0">
              <ExternalLink className="h-2.5 w-2.5" /> Portal
            </Badge>
          )}
        </div>
        {task.assignee && (
          <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center">
            <span className="text-[10px] font-semibold text-primary">
              {task.assignee.split(" ").map(n => n[0]).join("").slice(0, 2)}
            </span>
          </div>
        )}
      </div>

      {action && (
        <Button
          variant="ghost"
          size="sm"
          className="w-full mt-2 h-7 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={() => onStatusChange(task.id, action.target)}
        >
          {action.label} →
        </Button>
      )}
    </motion.div>
  );
}
