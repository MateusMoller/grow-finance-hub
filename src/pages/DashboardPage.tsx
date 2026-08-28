import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Building2,
  CalendarDays,
  FileCheck2,
  KanbanSquare,
  Loader2,
  MessageCircle,
} from "lucide-react";

import { AppLayout } from "@/components/app/AppLayout";
import { Button } from "@/components/ui/button";
import { useGlobalFilters } from "@/hooks/useGlobalFilters";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { getTaskCompetence, matchesSelectedCompany, matchesSelectedCompetence } from "@/lib/globalFilters";
import { cn } from "@/lib/utils";

type Task = Pick<
  Tables<"kanban_tasks">,
  "id" | "title" | "status" | "priority" | "created_at" | "due_date" | "assignee" | "client_name" | "sector"
>;

const finalStatuses = new Set(["done", "archived", "concluido", "concluído"]);
const normalize = (value: string | null | undefined) =>
  String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
const dateKey = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};
const isDone = (task: Task) => finalStatuses.has(normalize(task.status));
const formatDate = (value: string | null) =>
  value ? new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }) : "Sem prazo";

const quickLinks = [
  { label: "Tarefas", detail: "Organizar execução", to: "/app/tarefas", icon: KanbanSquare },
  { label: "Obrigações", detail: "Acompanhar entregas", to: "/app/obrigacoes?tab=entregas", icon: FileCheck2 },
  { label: "Calendário", detail: "Ver agenda operacional", to: "/app/calendario", icon: CalendarDays },
  { label: "Clientes", detail: "Consultar carteira", to: "/app/clientes", icon: Building2 },
  { label: "WhatsApp", detail: "Atender conversas", to: "/app/whatsapp", icon: MessageCircle },
];

function TaskRow({ task }: { task: Task }) {
  const overdue = Boolean(task.due_date && task.due_date < dateKey() && !isDone(task));
  return (
    <Link
      to={`/app/tarefas?task=${task.id}`}
      className="flex items-center justify-between gap-4 border-b px-4 py-3 transition-colors last:border-0 hover:bg-muted/20"
    >
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{task.title}</p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {task.client_name || task.sector || "Geral"}{task.assignee ? ` · ${task.assignee}` : " · Sem responsável"}
        </p>
      </div>
      <span className={cn("shrink-0 text-xs", overdue ? "font-semibold text-destructive" : "text-muted-foreground")}>
        {formatDate(task.due_date)}
      </span>
    </Link>
  );
}

export default function DashboardPage() {
  const { selectedCompany, selectedCompetence } = useGlobalFilters();
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: queryError } = await supabase
      .from("kanban_tasks")
      .select("id, title, status, priority, created_at, due_date, assignee, client_name, sector")
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(1000);
    if (queryError) {
      setError("Não foi possível carregar o panorama operacional.");
      setTasks([]);
    } else {
      setTasks((data || []) as Task[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { void loadDashboard(); }, [loadDashboard]);

  const dashboard = useMemo(() => {
    const today = dateKey();
    const scoped = tasks.filter((task) =>
      matchesSelectedCompany(task.client_name, selectedCompany) &&
      matchesSelectedCompetence(getTaskCompetence(task.due_date, task.created_at), selectedCompetence));
    const open = scoped.filter((task) => !isDone(task));
    const overdue = open.filter((task) => Boolean(task.due_date && task.due_date < today));
    const todayTasks = open.filter((task) => task.due_date === today);
    const review = open.filter((task) => normalize(task.status) === "review");
    const unassigned = open.filter((task) => !task.assignee);
    const upcoming = open
      .filter((task) => !task.due_date || task.due_date >= today)
      .slice(0, 7);
    return { scoped, open, overdue, todayTasks, review, unassigned, upcoming };
  }, [selectedCompany, selectedCompetence, tasks]);

  return (
    <AppLayout>
      <div className="mx-auto max-w-[1500px] space-y-5">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-heading text-2xl font-bold tracking-tight">Visão operacional</h1>
            <p className="mt-1 text-sm text-muted-foreground">Prioridades, prazos e acessos rápidos para conduzir o trabalho do dia.</p>
          </div>
          <Button asChild className="h-10 rounded-lg px-4">
            <Link to="/app/tarefas?create=1">Nova tarefa</Link>
          </Button>
        </header>

        {loading ? (
          <div className="flex min-h-80 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : error ? (
          <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-6 text-sm text-destructive">{error}</div>
        ) : (
          <>
            <dl className="flex flex-wrap gap-x-8 gap-y-3 border-y py-3" aria-label="Resumo operacional">
              {[
                ["Em aberto", dashboard.open.length],
                ["Vencidas", dashboard.overdue.length],
                ["Para hoje", dashboard.todayTasks.length],
                ["Em revisão", dashboard.review.length],
                ["Sem responsável", dashboard.unassigned.length],
              ].map(([label, value]) => (
                <div key={label} className="flex items-baseline gap-2">
                  <dt className="text-xs text-muted-foreground">{label}</dt>
                  <dd className="text-sm font-semibold tabular-nums">{value}</dd>
                </div>
              ))}
            </dl>

            <section className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,.75fr)]">
              <div className="overflow-hidden rounded-xl border bg-card">
                <div className="flex items-center justify-between border-b px-4 py-3">
                  <div>
                    <h2 className="font-semibold">Próximas entregas</h2>
                    <p className="text-xs text-muted-foreground">Itens abertos ordenados pelo prazo</p>
                  </div>
                  <Link to="/app/tarefas" className="flex items-center gap-1 text-xs font-medium text-primary hover:underline">Ver todas <ArrowRight className="h-3.5 w-3.5" /></Link>
                </div>
                {dashboard.upcoming.length > 0
                  ? dashboard.upcoming.map((task) => <TaskRow key={task.id} task={task} />)
                  : <div className="p-10 text-center text-sm text-muted-foreground">Nenhuma entrega pendente.</div>}
              </div>

              <div className="rounded-xl border bg-card p-3">
                <div className="px-1 pb-3">
                  <h2 className="font-semibold">Acessos rápidos</h2>
                  <p className="text-xs text-muted-foreground">Principais módulos da operação</p>
                </div>
                <div className="space-y-1">
                  {quickLinks.map((item) => (
                    <Link key={item.to} to={item.to} className="group flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-muted/45">
                      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted/70"><item.icon className="h-4 w-4" /></span>
                      <span className="min-w-0 flex-1"><span className="block text-sm font-medium">{item.label}</span><span className="block truncate text-xs text-muted-foreground">{item.detail}</span></span>
                      <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                    </Link>
                  ))}
                </div>
              </div>
            </section>

            <section className="grid gap-4 lg:grid-cols-2">
              <div className="overflow-hidden rounded-xl border bg-card">
                <div className="border-b px-4 py-3"><h2 className="font-semibold text-destructive">Atrasadas</h2><p className="text-xs text-muted-foreground">Priorize estes itens antes dos demais</p></div>
                {dashboard.overdue.length > 0 ? dashboard.overdue.slice(0, 5).map((task) => <TaskRow key={task.id} task={task} />) : <div className="p-8 text-center text-sm text-muted-foreground">Nenhuma tarefa atrasada.</div>}
              </div>
              <div className="overflow-hidden rounded-xl border bg-card">
                <div className="border-b px-4 py-3"><h2 className="font-semibold">Sem responsável</h2><p className="text-xs text-muted-foreground">Distribua a carga para evitar gargalos</p></div>
                {dashboard.unassigned.length > 0 ? dashboard.unassigned.slice(0, 5).map((task) => <TaskRow key={task.id} task={task} />) : <div className="p-8 text-center text-sm text-muted-foreground">Todas as tarefas possuem responsável.</div>}
              </div>
            </section>
          </>
        )}
      </div>
    </AppLayout>
  );
}
