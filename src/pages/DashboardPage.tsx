import { AppLayout } from "@/components/app/AppLayout";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";
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
  Loader2,
  KanbanSquare,
  Headset,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "react-router-dom";

export default function DashboardPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalTasks: 0,
    openTasks: 0,
    doneTasks: 0,
    totalRequests: 0,
    pendingRequests: 0,
  });
  const [recentTasks, setRecentTasks] = useState<any[]>([]);
  const [recentRequests, setRecentRequests] = useState<any[]>([]);

  useEffect(() => {
    if (user) fetchDashboardData();
  }, [user]);

  const fetchDashboardData = async () => {
    setLoading(true);
    const [tasksRes, requestsRes] = await Promise.all([
      supabase.from("kanban_tasks").select("*").order("created_at", { ascending: false }).limit(100),
      supabase.from("client_requests").select("*").order("created_at", { ascending: false }).limit(100),
    ]);

    const tasks = tasksRes.data || [];
    const requests = requestsRes.data || [];

    setStats({
      totalTasks: tasks.length,
      openTasks: tasks.filter(t => !["done"].includes(t.status)).length,
      doneTasks: tasks.filter(t => t.status === "done").length,
      totalRequests: requests.length,
      pendingRequests: requests.filter(r => r.status === "pending").length,
    });

    setRecentTasks(tasks.slice(0, 5));
    setRecentRequests(requests.slice(0, 5));
    setLoading(false);
  };

  const statsCards = [
    { label: "Tarefas no Kanban", value: stats.totalTasks, icon: KanbanSquare, color: "text-primary" },
    { label: "Tarefas Abertas", value: stats.openTasks, icon: FileText, color: "text-amber-600" },
    { label: "Concluídas", value: stats.doneTasks, icon: CheckCircle2, color: "text-primary" },
    { label: "Solicitações", value: stats.totalRequests, icon: Headset, color: "text-blue-600" },
    { label: "Pendentes", value: stats.pendingRequests, icon: Clock, color: "text-destructive" },
  ];

  const statusLabels: Record<string, { label: string; class: string }> = {
    backlog: { label: "Backlog", class: "bg-muted text-muted-foreground" },
    todo: { label: "A Fazer", class: "bg-amber-100 text-amber-700 dark:bg-amber-900/30" },
    doing: { label: "Em Andamento", class: "bg-primary/10 text-primary" },
    review: { label: "Revisão", class: "bg-purple-100 text-purple-700 dark:bg-purple-900/30" },
    done: { label: "Concluído", class: "bg-primary/10 text-primary" },
  };

  const requestStatusLabels: Record<string, { label: string; class: string }> = {
    pending: { label: "Pendente", class: "bg-amber-100 text-amber-700 dark:bg-amber-900/30" },
    in_progress: { label: "Em andamento", class: "bg-blue-100 text-blue-700 dark:bg-blue-900/30" },
    completed: { label: "Concluída", class: "bg-primary/10 text-primary" },
    cancelled: { label: "Cancelada", class: "bg-destructive/10 text-destructive" },
  };

  const priorityColors: Record<string, string> = {
    Urgente: "text-destructive",
    Alta: "text-orange-600",
    Média: "text-amber-600",
    Baixa: "text-muted-foreground",
  };

  return (
    <AppLayout>
      <div className="space-y-6 max-w-7xl">
        <div>
          <h1 className="font-heading text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Visão geral da operação Grow Finance</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              {statsCards.map((card, i) => (
                <motion.div
                  key={card.label}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.08 }}
                  className="rounded-xl border bg-card p-5 hover:shadow-md transition-shadow"
                >
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
                    <card.icon className={`h-5 w-5 ${card.color}`} />
                  </div>
                  <div className="font-heading text-2xl font-bold">{card.value}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{card.label}</div>
                </motion.div>
              ))}
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
              {/* Recent Kanban Tasks */}
              <div className="rounded-xl border bg-card">
                <div className="p-5 border-b flex items-center justify-between">
                  <h2 className="font-heading font-semibold">Tarefas Recentes (Kanban)</h2>
                  <Link to="/app/kanban" className="text-xs text-primary hover:underline">Ver todas →</Link>
                </div>
                <div className="divide-y">
                  {recentTasks.length === 0 ? (
                    <div className="p-8 text-center text-sm text-muted-foreground">Nenhuma tarefa ainda</div>
                  ) : (
                    recentTasks.map((task: any) => {
                      const st = statusLabels[task.status] || statusLabels.backlog;
                      return (
                        <div key={task.id} className="p-4 flex items-center justify-between gap-4 hover:bg-muted/30 transition-colors">
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium truncate">{task.title}</div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {task.client_name || task.sector} {task.assignee && `· ${task.assignee}`}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className={`text-xs font-medium ${priorityColors[task.priority] || ""}`}>
                              {task.priority}
                            </span>
                            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${st.class}`}>
                              {st.label}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Recent Requests */}
              <div className="rounded-xl border bg-card">
                <div className="p-5 border-b flex items-center justify-between">
                  <h2 className="font-heading font-semibold">Solicitações Recentes</h2>
                  <Link to="/app/solicitacoes" className="text-xs text-primary hover:underline">Ver todas →</Link>
                </div>
                <div className="divide-y">
                  {recentRequests.length === 0 ? (
                    <div className="p-8 text-center text-sm text-muted-foreground">Nenhuma solicitação ainda</div>
                  ) : (
                    recentRequests.map((req: any) => {
                      const st = requestStatusLabels[req.status] || requestStatusLabels.pending;
                      return (
                        <div key={req.id} className="p-4 flex items-center justify-between gap-4 hover:bg-muted/30 transition-colors">
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium truncate">{req.title}</div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {req.category} · {new Date(req.created_at).toLocaleDateString("pt-BR")}
                            </div>
                          </div>
                          <span className={`text-xs px-2.5 py-1 rounded-full font-medium shrink-0 ${st.class}`}>
                            {st.label}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
