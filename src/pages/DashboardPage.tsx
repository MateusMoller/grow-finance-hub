import { AppLayout } from "@/components/app/AppLayout";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import {
  CalendarCheck2,
  CheckCircle2,
  Clock3,
  KanbanSquare,
  Loader2,
  Target,
  User2,
  Users,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useGlobalFilters } from "@/hooks/useGlobalFilters";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";
import { getTaskCompetence, matchesSelectedCompany, matchesSelectedCompetence } from "@/lib/globalFilters";

type KanbanTaskRow = Pick<
  Tables<"kanban_tasks">,
  | "id"
  | "title"
  | "status"
  | "priority"
  | "created_at"
  | "updated_at"
  | "due_date"
  | "created_by"
  | "assignee"
  | "client_name"
  | "sector"
>;

interface ProfileRow {
  user_id: string;
  display_name: string | null;
}

interface UserRoleRow {
  user_id: string;
  role: string;
}

interface DailyDonePoint {
  key: string;
  label: string;
  count: number;
}

interface MetricsSummary {
  totalTasks: number;
  openTasks: number;
  doneTasks: number;
  dueToday: number;
  doneToday: number;
  avgResolutionMs: number | null;
  deadlineAccuracy: number | null;
  dailyDone: DailyDonePoint[];
}

interface UserIndicator extends MetricsSummary {
  userId: string;
  displayName: string;
  roleLabel: string;
}

interface TeamMember {
  userId: string;
  displayName: string;
  role: string;
}

interface DashboardCardDefinition {
  label: string;
  icon: typeof Clock3;
  color: string;
  getValue: (summary: MetricsSummary) => string;
}

const doneStatuses = new Set(["done", "archived"]);
const teamRoles = new Set([
  "admin",
  "director",
  "manager",
  "employee",
  "commercial",
  "departamento_pessoal",
  "fiscal",
  "contabil",
]);

const roleOptions = [
  "admin",
  "director",
  "manager",
  "employee",
  "commercial",
  "departamento_pessoal",
  "fiscal",
  "contabil",
] as const;

const rolePriority = new Map(roleOptions.map((role, index) => [role, index]));

const normalizeText = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const toDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatRole = (role: string) =>
  role
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

const pickPrimaryRole = (roles: string[]) => {
  if (roles.length === 0) return "employee";
  const ordered = [...roles].sort((a, b) => {
    const aPriority = rolePriority.get(a as (typeof roleOptions)[number]) ?? 999;
    const bPriority = rolePriority.get(b as (typeof roleOptions)[number]) ?? 999;
    return aPriority - bPriority;
  });
  return ordered[0];
};

const formatDuration = (ms: number | null) => {
  if (ms === null) return "-";
  const totalMinutes = Math.max(1, Math.round(ms / 60000));
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}min`;
  return `${minutes}min`;
};

const dashboardCardDefinitions: DashboardCardDefinition[] = [
  {
    label: "Tarefas monitoradas",
    icon: KanbanSquare,
    color: "text-primary",
    getValue: (summary) => String(summary.totalTasks),
  },
  {
    label: "Em aberto",
    icon: Clock3,
    color: "text-amber-600",
    getValue: (summary) => String(summary.openTasks),
  },
  {
    label: "Concluidas",
    icon: CheckCircle2,
    color: "text-primary",
    getValue: (summary) => String(summary.doneTasks),
  },
  {
    label: "Para hoje",
    icon: CalendarCheck2,
    color: "text-blue-600",
    getValue: (summary) => String(summary.dueToday),
  },
  {
    label: "Resolvidas hoje",
    icon: Target,
    color: "text-primary",
    getValue: (summary) => String(summary.doneToday),
  },
  {
    label: "Acertividade de prazos",
    icon: Users,
    color: "text-primary",
    getValue: (summary) => (summary.deadlineAccuracy === null ? "-" : `${summary.deadlineAccuracy}%`),
  },
  {
    label: "Tempo medio de resolucao",
    icon: Clock3,
    color: "text-purple-600",
    getValue: (summary) => formatDuration(summary.avgResolutionMs),
  },
];

const getPriorityClass = (priority: string) => {
  const normalized = normalizeText(priority || "");
  if (normalized.includes("urg")) return "text-destructive";
  if (normalized.includes("alta")) return "text-orange-600";
  if (normalized.includes("baixa")) return "text-muted-foreground";
  return "text-amber-600";
};

const getStatusBadge = (status: string) => {
  const normalized = normalizeText(status || "");
  if (normalized === "done") return { label: "Concluido", className: "bg-primary/10 text-primary" };
  if (normalized === "archived") return { label: "Arquivado", className: "bg-muted text-muted-foreground" };
  if (normalized === "review") return { label: "Revisao", className: "bg-purple-100 text-purple-700 dark:bg-purple-900/30" };
  if (normalized === "doing") return { label: "Em andamento", className: "bg-primary/10 text-primary" };
  if (normalized === "todo") return { label: "A fazer", className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30" };
  return { label: "Backlog", className: "bg-muted text-muted-foreground" };
};

const isDoneStatus = (status: string) => doneStatuses.has(normalizeText(status || ""));

const buildDailySeries = (tasks: KanbanTaskRow[], days: number) => {
  const today = new Date();
  const series: DailyDonePoint[] = [];

  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - offset);
    series.push({
      key: toDateKey(date),
      label: date.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", ""),
      count: 0,
    });
  }

  const dayIndex = new Map(series.map((point, index) => [point.key, index]));
  tasks.forEach((task) => {
    if (!isDoneStatus(task.status)) return;
    const finishedAt = new Date(task.updated_at);
    if (Number.isNaN(finishedAt.getTime())) return;
    const key = toDateKey(finishedAt);
    const index = dayIndex.get(key);
    if (index !== undefined) series[index].count += 1;
  });

  return series;
};

const computeMetrics = (tasks: KanbanTaskRow[]): MetricsSummary => {
  const todayKey = toDateKey(new Date());
  let doneTasks = 0;
  let dueToday = 0;
  let doneToday = 0;
  let resolutionCount = 0;
  let resolutionTotalMs = 0;
  let dueTrackedDone = 0;
  let dueTrackedOnTime = 0;

  tasks.forEach((task) => {
    const done = isDoneStatus(task.status);

    if (task.due_date === todayKey && !done) {
      dueToday += 1;
    }

    if (!done) return;

    doneTasks += 1;
    const finishedAt = new Date(task.updated_at);
    if (Number.isNaN(finishedAt.getTime())) return;

    if (toDateKey(finishedAt) === todayKey) {
      doneToday += 1;
    }

    const createdAt = new Date(task.created_at);
    if (!Number.isNaN(createdAt.getTime()) && finishedAt.getTime() >= createdAt.getTime()) {
      resolutionTotalMs += finishedAt.getTime() - createdAt.getTime();
      resolutionCount += 1;
    }

    if (!task.due_date) return;

    const dueEnd = new Date(`${task.due_date}T23:59:59.999`);
    if (Number.isNaN(dueEnd.getTime())) return;

    dueTrackedDone += 1;
    if (finishedAt.getTime() <= dueEnd.getTime()) {
      dueTrackedOnTime += 1;
    }
  });

  const totalTasks = tasks.length;
  const openTasks = totalTasks - doneTasks;
  const avgResolutionMs = resolutionCount > 0 ? resolutionTotalMs / resolutionCount : null;
  const deadlineAccuracy = dueTrackedDone > 0 ? Math.round((dueTrackedOnTime / dueTrackedDone) * 100) : null;

  return {
    totalTasks,
    openTasks,
    doneTasks,
    dueToday,
    doneToday,
    avgResolutionMs,
    deadlineAccuracy,
    dailyDone: buildDailySeries(tasks, 7),
  };
};

export default function DashboardPage() {
  const { user, role } = useAuth();
  const { selectedCompany, selectedCompetence } = useGlobalFilters();
  const isAdmin = role === "admin";

  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<MetricsSummary>({
    totalTasks: 0,
    openTasks: 0,
    doneTasks: 0,
    dueToday: 0,
    doneToday: 0,
    avgResolutionMs: null,
    deadlineAccuracy: null,
    dailyDone: [],
  });
  const [recentTasks, setRecentTasks] = useState<KanbanTaskRow[]>([]);
  const [todayTasks, setTodayTasks] = useState<KanbanTaskRow[]>([]);
  const [userIndicators, setUserIndicators] = useState<UserIndicator[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [teamRoleDrafts, setTeamRoleDrafts] = useState<Record<string, string>>({});
  const [savingTeamUserId, setSavingTeamUserId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    void fetchDashboardData();
  }, [user?.id, isAdmin, selectedCompany, selectedCompetence]);

  const fetchDashboardData = async () => {
    if (!user) return;

    setLoading(true);

    const [tasksRes, profilesRes] = await Promise.all([
      supabase
        .from("kanban_tasks")
        .select("id, title, status, priority, created_at, updated_at, due_date, created_by, assignee, client_name, sector")
        .order("created_at", { ascending: false })
        .limit(2000),
      supabase.from("profiles").select("user_id, display_name"),
    ]);

    let rolesData: UserRoleRow[] = [];
    if (isAdmin) {
      const { data } = await supabase.from("user_roles").select("user_id, role");
      rolesData = ((data || []) as UserRoleRow[]).filter((item) => teamRoles.has(item.role));
    }

    const tasks = (tasksRes.data || []) as KanbanTaskRow[];
    const scopedTasks = tasks.filter(
      (task) =>
        matchesSelectedCompany(task.client_name, selectedCompany) &&
        matchesSelectedCompetence(
          getTaskCompetence(task.due_date, task.created_at),
          selectedCompetence
        )
    );
    const profiles = (profilesRes.data || []) as ProfileRow[];
    const profileById = new Map(profiles.map((profile) => [profile.user_id, profile]));
    const profileByName = new Map<string, string>();

    profiles.forEach((profile) => {
      if (!profile.display_name) return;
      const key = normalizeText(profile.display_name);
      if (!key) return;
      if (!profileByName.has(key)) {
        profileByName.set(key, profile.user_id);
      }
    });

    const resolveTaskOwnerId = (task: KanbanTaskRow) => {
      const assigneeKey = normalizeText(task.assignee || "");
      if (assigneeKey) {
        const assigneeOwnerId = profileByName.get(assigneeKey);
        if (assigneeOwnerId) return assigneeOwnerId;
      }
      return task.created_by;
    };

    const tasksByOwner = new Map<string, KanbanTaskRow[]>();
    scopedTasks.forEach((task) => {
      const ownerId = resolveTaskOwnerId(task);
      if (!ownerId) return;
      const grouped = tasksByOwner.get(ownerId) || [];
      grouped.push(task);
      tasksByOwner.set(ownerId, grouped);
    });

    const myTasks = tasksByOwner.get(user.id) || [];
    const visibleTasks = isAdmin ? scopedTasks : myTasks;
    const todayKey = toDateKey(new Date());
    const dueTodayList = visibleTasks
      .filter((task) => task.due_date === todayKey && !isDoneStatus(task.status))
      .slice(0, 8);

    setSummary(computeMetrics(visibleTasks));
    setRecentTasks(visibleTasks.slice(0, 6));
    setTodayTasks(dueTodayList);

    if (isAdmin) {
      const rolesByUser = new Map<string, string[]>();
      rolesData.forEach((row) => {
        const currentRoles = rolesByUser.get(row.user_id) || [];
        currentRoles.push(row.role);
        rolesByUser.set(row.user_id, currentRoles);
      });

      const teamUserIds = new Set<string>(rolesByUser.keys());
      scopedTasks.forEach((task) => {
        const ownerId = resolveTaskOwnerId(task);
        if (ownerId) teamUserIds.add(ownerId);
      });

      const indicators = Array.from(teamUserIds)
        .map((userId) => {
          const metrics = computeMetrics(tasksByOwner.get(userId) || []);
          const profile = profileById.get(userId);
          const displayName = profile?.display_name || `Usuario ${userId.slice(0, 6)}`;
          const roleLabel = (rolesByUser.get(userId) || []).map(formatRole).join(", ") || "Sem papel";
          return {
            userId,
            displayName,
            roleLabel,
            ...metrics,
          };
        })
        .sort((a, b) => b.openTasks - a.openTasks || b.totalTasks - a.totalTasks);

      setUserIndicators(indicators);

      const members = Array.from(rolesByUser.keys())
        .map((userId) => {
          const profile = profileById.get(userId);
          const displayName = profile?.display_name || `Usuario ${userId.slice(0, 6)}`;
          const primaryRole = pickPrimaryRole(rolesByUser.get(userId) || []);
          return {
            userId,
            displayName,
            role: primaryRole,
          };
        })
        .sort((a, b) => a.displayName.localeCompare(b.displayName));

      setTeamMembers(members);
      setTeamRoleDrafts(
        Object.fromEntries(members.map((member) => [member.userId, member.role]))
      );
    } else {
      setUserIndicators([]);
      setTeamMembers([]);
      setTeamRoleDrafts({});
    }

    setLoading(false);
  };

  const saveTeamRole = async (userId: string) => {
    if (!isAdmin) return;
    const selectedRole = teamRoleDrafts[userId];
    const currentRole = teamMembers.find((member) => member.userId === userId)?.role;
    if (!selectedRole || selectedRole === currentRole) return;

    setSavingTeamUserId(userId);

    const { error: insertError } = await supabase
      .from("user_roles")
      .insert({ user_id: userId, role: selectedRole as never });

    const isDuplicate = insertError?.message?.toLowerCase().includes("duplicate key");
    if (insertError && !isDuplicate) {
      setSavingTeamUserId(null);
      toast.error(`Nao foi possivel salvar o papel: ${insertError.message}`);
      return;
    }

    const { error: cleanupError } = await supabase
      .from("user_roles")
      .delete()
      .eq("user_id", userId)
      .neq("role", selectedRole as never);

    setSavingTeamUserId(null);

    if (cleanupError) {
      toast.error(`Papel atualizado parcialmente: ${cleanupError.message}`);
      return;
    }

    toast.success("Papel atualizado com sucesso.");
    await fetchDashboardData();
  };

  const maxDailyDone = Math.max(1, ...summary.dailyDone.map((point) => point.count));

  return (
    <AppLayout>
      <div className="space-y-6 max-w-7xl">
        <div>
          <h1 className="font-heading text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            {isAdmin
              ? "Visao geral da equipe e indicadores por usuario"
              : "Indicadores pessoais de produtividade e prazos"}
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-7 gap-4">
              {dashboardCardDefinitions.map((card, index) => (
                <motion.div
                  key={card.label}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.04 }}
                  className="rounded-xl border bg-card p-4 hover:shadow-md transition-shadow"
                >
                  <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
                    <card.icon className={`h-4 w-4 ${card.color}`} />
                  </div>
                  <div className="font-heading text-xl font-bold">{card.getValue(summary)}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{card.label}</div>
                </motion.div>
              ))}
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
              <div className="rounded-xl border bg-card">
                <div className="p-5 border-b">
                  <h2 className="font-heading font-semibold">Tarefas realizadas por dia (7 dias)</h2>
                  <p className="text-xs text-muted-foreground mt-1">
                    Volume diario de tarefas concluidas
                  </p>
                </div>
                <div className="p-5">
                  {summary.dailyDone.length === 0 ? (
                    <div className="text-sm text-muted-foreground">Sem dados de conclusao.</div>
                  ) : (
                    <div className="grid grid-cols-7 gap-3 items-end h-40">
                      {summary.dailyDone.map((point) => (
                        <div key={point.key} className="flex flex-col items-center gap-2">
                          <span className="text-xs font-semibold">{point.count}</span>
                          <div className="w-full max-w-[34px] h-28 rounded-md bg-muted/60 flex items-end overflow-hidden">
                            <div
                              className="w-full bg-primary rounded-md transition-all"
                              style={{ height: `${Math.max((point.count / maxDailyDone) * 100, 6)}%` }}
                            />
                          </div>
                          <span className="text-[11px] text-muted-foreground uppercase">{point.label}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-xl border bg-card">
                <div className="p-5 border-b flex items-center justify-between">
                  <div>
                    <h2 className="font-heading font-semibold">Tarefas para hoje</h2>
                    <p className="text-xs text-muted-foreground mt-1">
                      {todayTasks.length} tarefa(s) com prazo para hoje
                    </p>
                  </div>
                  <Link to="/app/tarefas" className="text-xs text-primary hover:underline">
                    Ver tarefas
                  </Link>
                </div>
                <div className="divide-y">
                  {todayTasks.length === 0 ? (
                    <div className="p-8 text-center text-sm text-muted-foreground">
                      Nenhuma tarefa pendente para hoje.
                    </div>
                  ) : (
                    todayTasks.map((task) => {
                      const badge = getStatusBadge(task.status);
                      return (
                        <div key={task.id} className="p-4 flex items-center justify-between gap-3 hover:bg-muted/30 transition-colors">
                          <div className="min-w-0">
                            <div className="text-sm font-medium truncate">{task.title}</div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {(task.client_name || task.sector || "Sem cliente")} {task.assignee ? `- ${task.assignee}` : ""}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className={`text-xs font-semibold ${getPriorityClass(task.priority)}`}>{task.priority}</span>
                            <span className={`text-xs px-2 py-1 rounded-full font-medium ${badge.className}`}>{badge.label}</span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            {isAdmin && (
              <div className="rounded-xl border bg-card overflow-hidden">
                <div className="p-5 border-b">
                  <h2 className="font-heading font-semibold">Indicadores por usuario</h2>
                  <p className="text-xs text-muted-foreground mt-1">
                    Visao consolidada de produtividade e prazo por colaborador
                  </p>
                </div>
                <div className="divide-y">
                  {userIndicators.length === 0 ? (
                    <div className="p-8 text-center text-sm text-muted-foreground">
                      Nenhum usuario com tarefas encontradas.
                    </div>
                  ) : (
                    userIndicators.map((indicator) => (
                      <div key={indicator.userId} className="p-4 grid grid-cols-1 md:grid-cols-8 gap-3 items-center hover:bg-muted/20">
                        <div className="md:col-span-2 min-w-0">
                          <div className="text-sm font-semibold truncate flex items-center gap-2">
                            <User2 className="h-3.5 w-3.5 text-muted-foreground" />
                            {indicator.displayName}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">{indicator.roleLabel}</div>
                        </div>
                        <div className="text-xs">
                          <span className="text-muted-foreground">Abertas:</span> <span className="font-semibold">{indicator.openTasks}</span>
                        </div>
                        <div className="text-xs">
                          <span className="text-muted-foreground">Concluidas:</span> <span className="font-semibold">{indicator.doneTasks}</span>
                        </div>
                        <div className="text-xs">
                          <span className="text-muted-foreground">Para hoje:</span> <span className="font-semibold">{indicator.dueToday}</span>
                        </div>
                        <div className="text-xs">
                          <span className="text-muted-foreground">Hoje:</span> <span className="font-semibold">{indicator.doneToday}</span>
                        </div>
                        <div className="text-xs">
                          <span className="text-muted-foreground">Prazos:</span>{" "}
                          <span className="font-semibold">
                            {indicator.deadlineAccuracy === null ? "-" : `${indicator.deadlineAccuracy}%`}
                          </span>
                        </div>
                        <div className="text-xs">
                          <span className="text-muted-foreground">Tempo medio:</span>{" "}
                          <span className="font-semibold">{formatDuration(indicator.avgResolutionMs)}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {isAdmin && (
              <div className="rounded-xl border bg-card overflow-hidden">
                <div className="p-5 border-b">
                  <h2 className="font-heading font-semibold">Gerenciar equipe</h2>
                  <p className="text-xs text-muted-foreground mt-1">
                    Altere o papel dos usuarios internos
                  </p>
                </div>
                <div className="divide-y">
                  {teamMembers.length === 0 ? (
                    <div className="p-8 text-center text-sm text-muted-foreground">
                      Nenhum usuario interno encontrado.
                    </div>
                  ) : (
                    teamMembers.map((member) => {
                      const selectedRole = teamRoleDrafts[member.userId] || member.role;
                      const isChanged = selectedRole !== member.role;
                      const isSaving = savingTeamUserId === member.userId;

                      return (
                        <div key={member.userId} className="p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3 hover:bg-muted/20">
                          <div className="min-w-0">
                            <div className="text-sm font-semibold truncate">{member.displayName}</div>
                            <div className="text-xs text-muted-foreground truncate">
                              ID: {member.userId.slice(0, 8)}...
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <select
                              className="h-9 min-w-[220px] rounded-md border bg-background px-3 text-sm outline-none"
                              value={selectedRole}
                              onChange={(event) =>
                                setTeamRoleDrafts((prev) => ({
                                  ...prev,
                                  [member.userId]: event.target.value,
                                }))
                              }
                            >
                              {roleOptions.map((roleOption) => (
                                <option key={roleOption} value={roleOption}>
                                  {formatRole(roleOption)}
                                </option>
                              ))}
                            </select>
                            <Button
                              size="sm"
                              onClick={() => void saveTeamRole(member.userId)}
                              disabled={!isChanged || isSaving}
                            >
                              {isSaving && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
                              Salvar
                            </Button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            <div className="rounded-xl border bg-card">
              <div className="p-5 border-b flex items-center justify-between">
                <h2 className="font-heading font-semibold">Tarefas recentes</h2>
                <Link to="/app/kanban" className="text-xs text-primary hover:underline">
                  Ver no Kanban
                </Link>
              </div>
              <div className="divide-y">
                {recentTasks.length === 0 ? (
                  <div className="p-8 text-center text-sm text-muted-foreground">Nenhuma tarefa encontrada.</div>
                ) : (
                  recentTasks.map((task) => {
                    const badge = getStatusBadge(task.status);
                    return (
                      <div key={task.id} className="p-4 flex items-center justify-between gap-4 hover:bg-muted/30 transition-colors">
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium truncate">{task.title}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {(task.client_name || task.sector || "Sem cliente")} {task.assignee ? `- ${task.assignee}` : ""}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`text-xs font-semibold ${getPriorityClass(task.priority)}`}>{task.priority}</span>
                          <span className={`text-xs px-2 py-1 rounded-full font-medium ${badge.className}`}>{badge.label}</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
