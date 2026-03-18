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
  ChevronDown,
  MoreHorizontal,
  Paperclip,
  MessageSquare,
  CalendarDays,
  Tag,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

interface Task {
  id: string;
  title: string;
  description: string;
  client: string;
  sector: string;
  assignee: string;
  priority: "Alta" | "Média" | "Baixa" | "Urgente";
  dueDate: string;
  status: "Pendente" | "Em andamento" | "Em revisão" | "Concluído" | "Atrasado";
  tags: string[];
  subtasks: { title: string; done: boolean }[];
  attachments: number;
  comments: number;
}

const tasks: Task[] = [
  {
    id: "1", title: "Fechamento contábil mensal", description: "Realizar fechamento contábil do mês de março",
    client: "ABC Tecnologia Ltda", sector: "Contábil", assignee: "Maria Santos", priority: "Alta",
    dueDate: "2026-03-20", status: "Em andamento", tags: ["Contábil", "Mensal"],
    subtasks: [{ title: "Conciliar contas", done: true }, { title: "Gerar balancete", done: false }, { title: "Enviar relatório", done: false }],
    attachments: 3, comments: 5,
  },
  {
    id: "2", title: "Admissão - João Silva", description: "Processar admissão do novo colaborador",
    client: "Tech Solutions SA", sector: "Departamento Pessoal", assignee: "Carlos Ribeiro", priority: "Média",
    dueDate: "2026-03-22", status: "Pendente", tags: ["DP", "Admissão"],
    subtasks: [{ title: "Coletar documentos", done: true }, { title: "Cadastro eSocial", done: false }],
    attachments: 7, comments: 2,
  },
  {
    id: "3", title: "Declaração IR 2026", description: "Preparar e enviar declaração de IR",
    client: "Startup XYZ ME", sector: "Fiscal", assignee: "Ana Lima", priority: "Urgente",
    dueDate: "2026-03-18", status: "Atrasado", tags: ["Fiscal", "IR"],
    subtasks: [{ title: "Reunir informes", done: true }, { title: "Preencher declaração", done: true }, { title: "Revisar", done: false }, { title: "Enviar", done: false }],
    attachments: 12, comments: 8,
  },
  {
    id: "4", title: "BPO Financeiro - Março", description: "Conciliação e relatórios financeiros",
    client: "Comércio Rápido Ltda", sector: "Financeiro", assignee: "Lucas Moreira", priority: "Média",
    dueDate: "2026-03-25", status: "Em andamento", tags: ["BPO", "Financeiro"],
    subtasks: [{ title: "Conciliar extratos", done: true }, { title: "Classificar despesas", done: true }, { title: "Gerar DRE", done: false }],
    attachments: 5, comments: 3,
  },
  {
    id: "5", title: "Cálculo de férias - Pedro Santos", description: "Calcular e processar férias do colaborador",
    client: "ABC Tecnologia Ltda", sector: "Departamento Pessoal", assignee: "Maria Santos", priority: "Baixa",
    dueDate: "2026-03-28", status: "Em revisão", tags: ["DP", "Férias"],
    subtasks: [{ title: "Calcular valores", done: true }, { title: "Gerar recibo", done: true }, { title: "Aprovação gerência", done: false }],
    attachments: 2, comments: 1,
  },
  {
    id: "6", title: "Alteração salarial - Empresa Beta", description: "Processar alteração salarial para 3 colaboradores",
    client: "Beta Serviços SA", sector: "Departamento Pessoal", assignee: "Carlos Ribeiro", priority: "Alta",
    dueDate: "2026-03-21", status: "Pendente", tags: ["DP", "Salário"],
    subtasks: [{ title: "Validar valores", done: false }, { title: "Atualizar folha", done: false }],
    attachments: 1, comments: 0,
  },
];

const priorityConfig: Record<string, { color: string; bg: string }> = {
  Urgente: { color: "text-destructive", bg: "bg-destructive/10" },
  Alta: { color: "text-orange-600", bg: "bg-orange-100 dark:bg-orange-900/20" },
  Média: { color: "text-amber-600", bg: "bg-amber-100 dark:bg-amber-900/20" },
  Baixa: { color: "text-muted-foreground", bg: "bg-muted" },
};

const statusConfig: Record<string, { color: string; bg: string; icon: typeof Circle }> = {
  Pendente: { color: "text-muted-foreground", bg: "bg-muted", icon: Circle },
  "Em andamento": { color: "text-primary", bg: "bg-primary/10", icon: Clock },
  "Em revisão": { color: "text-amber-600", bg: "bg-amber-100 dark:bg-amber-900/20", icon: AlertTriangle },
  Concluído: { color: "text-primary", bg: "bg-primary/10", icon: CheckCircle2 },
  Atrasado: { color: "text-destructive", bg: "bg-destructive/10", icon: AlertTriangle },
};

const sectors = ["Todos", "Contábil", "Fiscal", "Departamento Pessoal", "Financeiro"];
const statuses = ["Todos", "Pendente", "Em andamento", "Em revisão", "Concluído", "Atrasado"];

export default function TarefasPage() {
  const [search, setSearch] = useState("");
  const [sectorFilter, setSectorFilter] = useState("Todos");
  const [statusFilter, setStatusFilter] = useState("Todos");

  const filtered = tasks.filter((t) => {
    if (search && !t.title.toLowerCase().includes(search.toLowerCase()) && !t.client.toLowerCase().includes(search.toLowerCase())) return false;
    if (sectorFilter !== "Todos" && t.sector !== sectorFilter) return false;
    if (statusFilter !== "Todos" && t.status !== statusFilter) return false;
    return true;
  });

  return (
    <AppLayout>
      <div className="space-y-6 max-w-7xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-heading text-2xl font-bold">Tarefas</h1>
            <p className="text-sm text-muted-foreground">Gestão completa de tarefas da equipe</p>
          </div>
          <Button className="gap-2">
            <Plus className="h-4 w-4" /> Nova Tarefa
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: "Total", value: tasks.length, color: "text-foreground" },
            { label: "Pendentes", value: tasks.filter(t => t.status === "Pendente").length, color: "text-muted-foreground" },
            { label: "Em andamento", value: tasks.filter(t => t.status === "Em andamento").length, color: "text-primary" },
            { label: "Atrasadas", value: tasks.filter(t => t.status === "Atrasado").length, color: "text-destructive" },
            { label: "Concluídas", value: tasks.filter(t => t.status === "Concluído").length, color: "text-primary" },
          ].map((s) => (
            <div key={s.label} className="rounded-lg border bg-card p-3 text-center">
              <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-xs text-muted-foreground">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-card border rounded-lg px-3 py-2 flex-1 min-w-[200px] max-w-sm">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input className="bg-transparent text-sm outline-none w-full placeholder:text-muted-foreground" placeholder="Buscar tarefa ou cliente..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <select className="text-sm bg-card border rounded-lg px-3 py-2 outline-none" value={sectorFilter} onChange={(e) => setSectorFilter(e.target.value)}>
              {sectors.map(s => <option key={s}>{s}</option>)}
            </select>
            <select className="text-sm bg-card border rounded-lg px-3 py-2 outline-none" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              {statuses.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
        </div>

        {/* Task list */}
        <div className="space-y-3">
          {filtered.map((task, i) => {
            const statusCfg = statusConfig[task.status];
            const priorityCfg = priorityConfig[task.priority];
            const subtaskDone = task.subtasks.filter(s => s.done).length;
            const subtaskPct = Math.round((subtaskDone / task.subtasks.length) * 100);
            const StatusIcon = statusCfg.icon;

            return (
              <motion.div
                key={task.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="rounded-xl border bg-card p-4 hover:shadow-md transition-all cursor-pointer"
              >
                <div className="flex items-start gap-4">
                  <div className={`mt-1 h-8 w-8 rounded-lg ${statusCfg.bg} flex items-center justify-center shrink-0`}>
                    <StatusIcon className={`h-4 w-4 ${statusCfg.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-medium text-sm">{task.title}</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">{task.client}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant="outline" className={`text-xs ${priorityCfg.color} ${priorityCfg.bg} border-0`}>
                          {task.priority}
                        </Badge>
                        <Badge variant="outline" className={`text-xs ${statusCfg.color} ${statusCfg.bg} border-0`}>
                          {task.status}
                        </Badge>
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 mt-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><CalendarDays className="h-3 w-3" />{new Date(task.dueDate).toLocaleDateString("pt-BR")}</span>
                      <span>{task.assignee}</span>
                      <span>{task.sector}</span>
                      <span className="flex items-center gap-1"><Paperclip className="h-3 w-3" />{task.attachments}</span>
                      <span className="flex items-center gap-1"><MessageSquare className="h-3 w-3" />{task.comments}</span>
                      <div className="flex items-center gap-1">
                        {task.tags.map(tag => (
                          <span key={tag} className="flex items-center gap-0.5 bg-muted px-1.5 py-0.5 rounded text-xs">
                            <Tag className="h-2.5 w-2.5" />{tag}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 mt-3">
                      <Progress value={subtaskPct} className="h-1.5 flex-1 max-w-[200px]" />
                      <span className="text-xs text-muted-foreground">{subtaskDone}/{task.subtasks.length} subtarefas</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
}
