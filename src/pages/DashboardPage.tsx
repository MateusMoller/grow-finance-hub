import { AppLayout } from "@/components/app/AppLayout";
import { motion } from "framer-motion";
import {
  Users,
  FileText,
  CheckCircle2,
  Clock,
  AlertTriangle,
  TrendingUp,
  UserPlus,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";

const statsCards = [
  {
    label: "Clientes Ativos",
    value: "248",
    change: "+12",
    trend: "up",
    icon: Users,
  },
  {
    label: "Tarefas Abertas",
    value: "87",
    change: "-5",
    trend: "down",
    icon: FileText,
  },
  {
    label: "Concluídas (mês)",
    value: "142",
    change: "+23%",
    trend: "up",
    icon: CheckCircle2,
  },
  {
    label: "Leads Ativos",
    value: "34",
    change: "+8",
    trend: "up",
    icon: UserPlus,
  },
];

const recentTasks = [
  { title: "Fechamento contábil - ABC Ltda", status: "Em andamento", priority: "Alta", assignee: "Maria S." },
  { title: "Admissão - João Silva", status: "Pendente", priority: "Média", assignee: "Carlos R." },
  { title: "Declaração IR - Tech Corp", status: "Em andamento", priority: "Alta", assignee: "Ana L." },
  { title: "Férias - Pedro Santos", status: "Concluído", priority: "Baixa", assignee: "Maria S." },
  { title: "BPO Financeiro - StartupXYZ", status: "Em andamento", priority: "Alta", assignee: "Lucas M." },
];

const statusColors: Record<string, string> = {
  "Em andamento": "bg-primary/10 text-primary",
  Pendente: "bg-grow-gold/10 text-grow-gold-foreground",
  Concluído: "bg-primary/10 text-primary",
};

const priorityColors: Record<string, string> = {
  Alta: "text-destructive",
  Média: "text-grow-gold-foreground",
  Baixa: "text-muted-foreground",
};

const alerts = [
  { icon: AlertTriangle, text: "5 tarefas com prazo vencido", type: "warn" },
  { icon: Clock, text: "12 tarefas com prazo próximo (3 dias)", type: "info" },
  { icon: TrendingUp, text: "Taxa de conversão subiu 15% este mês", type: "success" },
];

export default function DashboardPage() {
  return (
    <AppLayout>
      <div className="space-y-6 max-w-7xl">
        {/* Header */}
        <div>
          <h1 className="font-heading text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Visão geral da operação Grow Finance</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {statsCards.map((card, i) => (
            <motion.div
              key={card.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className="rounded-xl border bg-card p-5 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <card.icon className="h-5 w-5 text-primary" />
                </div>
                <span className={`text-xs font-medium flex items-center gap-0.5 ${
                  card.trend === "up" ? "text-primary" : "text-muted-foreground"
                }`}>
                  {card.trend === "up" ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                  {card.change}
                </span>
              </div>
              <div className="font-heading text-2xl font-bold">{card.value}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{card.label}</div>
            </motion.div>
          ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Recent tasks */}
          <div className="lg:col-span-2 rounded-xl border bg-card">
            <div className="p-5 border-b">
              <h2 className="font-heading font-semibold">Tarefas Recentes</h2>
            </div>
            <div className="divide-y">
              {recentTasks.map((task) => (
                <div key={task.title} className="p-4 flex items-center justify-between gap-4 hover:bg-muted/30 transition-colors">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{task.title}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{task.assignee}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-xs font-medium ${priorityColors[task.priority]}`}>
                      {task.priority}
                    </span>
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusColors[task.status]}`}>
                      {task.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Alerts */}
          <div className="rounded-xl border bg-card">
            <div className="p-5 border-b">
              <h2 className="font-heading font-semibold">Alertas</h2>
            </div>
            <div className="p-4 space-y-3">
              {alerts.map((alert, i) => (
                <div
                  key={i}
                  className={`flex items-start gap-3 p-3 rounded-lg ${
                    alert.type === "warn"
                      ? "bg-destructive/5"
                      : alert.type === "success"
                      ? "bg-primary/5"
                      : "bg-muted/50"
                  }`}
                >
                  <alert.icon className={`h-4 w-4 mt-0.5 shrink-0 ${
                    alert.type === "warn"
                      ? "text-destructive"
                      : alert.type === "success"
                      ? "text-primary"
                      : "text-muted-foreground"
                  }`} />
                  <span className="text-sm">{alert.text}</span>
                </div>
              ))}
            </div>

            {/* Quick stats */}
            <div className="p-4 border-t space-y-3">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Comercial</h3>
              {[
                { label: "Propostas enviadas", value: "18" },
                { label: "Taxa de conversão", value: "42%" },
                { label: "Admissões no mês", value: "7" },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{item.label}</span>
                  <span className="text-sm font-semibold">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
