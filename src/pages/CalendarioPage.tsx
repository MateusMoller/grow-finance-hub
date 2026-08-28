import { useCallback, useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/app/AppLayout";
import { ModuleContextPill } from "@/components/app/ModuleContextPill";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertTriangle,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Filter,
  Loader2,
  Plus,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  SECTOR_CODES,
  SECTOR_LABELS,
  normalizeSectorCode,
} from "@/lib/userPermissions";
import {
  endOfMonth,
  format,
  isBefore,
  isSameDay,
  parseISO,
  startOfMonth,
  startOfToday,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";

type EntryType = "evento" | "obrigação";
type EntryPriority = "baixa" | "media" | "alta" | "urgente";
type EntryStatus = "pending" | "completed" | "cancelled";

interface CalendarEntry {
  id: string;
  title: string;
  description: string | null;
  entry_type: EntryType;
  priority: EntryPriority;
  sector: string;
  due_at: string;
  all_day: boolean;
  status: EntryStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

type ObligationInstanceStatus =
  | "pendente"
  | "em_andamento"
  | "aguardando_documento"
  | "em_revisao"
  | "pronto_para_envio"
  | "enviando"
  | "falha_envio"
  | "concluida"
  | "atrasada"
  | "cancelada";

interface CalendarObligationInstance {
  id: string;
  template_id: string;
  client_id: string;
  competence_label: string;
  technical_due_date: string;
  status: ObligationInstanceStatus;
  priority: EntryPriority;
  completed_at: string | null;
  updated_at: string;
  template: {
    id: string;
    name: string;
    sector: string;
  } | null;
  client: {
    id: string;
    name: string;
    cnpj: string | null;
  } | null;
}

interface ObligationDayGroup {
  templateId: string;
  name: string;
  sector: string;
  instances: CalendarObligationInstance[];
  doneCount: number;
}

interface ObligationDateGroup {
  date: string;
  groups: ObligationDayGroup[];
  total: number;
  done: number;
  overdue: number;
}

type CalendarPeriodMode = "day" | "month";
type CalendarStatusFilter = "all" | ObligationInstanceStatus;

interface CalendarTask {
  id: string;
  title: string;
  client_name: string | null;
  sector: string;
  priority: string;
  due_date: string | null;
  status: string;
  integration_source: string | null;
  integration_task_id: string | null;
}

interface CalendarFormState {
  title: string;
  description: string;
  entry_type: EntryType;
  priority: EntryPriority;
  sector: string;
  date: string;
  time: string;
  all_day: boolean;
  status: EntryStatus;
}

const sectorOptions = SECTOR_CODES.map((code) => ({
  code,
  label: SECTOR_LABELS[code],
}));

const priorityLabels: Record<EntryPriority, string> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
  urgente: "Urgente",
};

const obligationStatusLabels: Record<ObligationInstanceStatus, string> = {
  pendente: "Pendente",
  em_andamento: "Em andamento",
  aguardando_documento: "Aguardando documento",
  em_revisao: "Em revisão",
  pronto_para_envio: "Pronta para envio",
  enviando: "Enviando",
  falha_envio: "Falha no envio",
  concluida: "Feita",
  atrasada: "Atrasada",
  cancelada: "Cancelada",
};

const obligationStatusClasses: Record<ObligationInstanceStatus, string> = {
  pendente: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  em_andamento: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  aguardando_documento: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  em_revisao: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  pronto_para_envio: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300",
  enviando: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300",
  falha_envio: "bg-destructive/10 text-destructive",
  concluida: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  atrasada: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  cancelada: "bg-muted text-muted-foreground",
};

const makeFormState = (date: Date): CalendarFormState => ({
  title: "",
  description: "",
  entry_type: "evento",
  priority: "media",
  sector: "Geral",
  date: format(date, "yyyy-MM-dd"),
  time: "09:00",
  all_day: false,
  status: "pending",
});

const obligationStatusOrder: Record<ObligationInstanceStatus, number> = {
  atrasada: 0,
  falha_envio: 1,
  em_revisao: 2,
  aguardando_documento: 3,
  pendente: 4,
  em_andamento: 5,
  pronto_para_envio: 6,
  enviando: 7,
  concluida: 8,
  cancelada: 9,
};

function isOperationallyOverdue(instance: CalendarObligationInstance) {
  return instance.status !== "concluida" && instance.status !== "cancelada" &&
    isBefore(parseISO(`${instance.technical_due_date}T12:00:00`), startOfToday());
}

function buildObligationGroups(instances: CalendarObligationInstance[]) {
  const groups = new Map<string, ObligationDayGroup>();
  for (const instance of instances) {
    const templateId = instance.template?.id || instance.template_id;
    const group = groups.get(templateId) || {
      templateId,
      name: instance.template?.name || "Obrigação sem nome",
      sector: instance.template?.sector || "Geral",
      instances: [],
      doneCount: 0,
    };
    group.instances.push(instance);
    if (instance.status === "concluida") group.doneCount += 1;
    groups.set(templateId, group);
  }
  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      instances: [...group.instances].sort((left, right) =>
        obligationStatusOrder[left.status] - obligationStatusOrder[right.status] ||
        (left.client?.name || "").localeCompare(right.client?.name || "", "pt-BR")),
    }))
    .sort((left, right) => left.name.localeCompare(right.name, "pt-BR"));
}

export default function CalendarioPage() {
  const { user, effectiveAccess } = useAuth();
  const navigate = useNavigate();
  const organizationId = effectiveAccess?.organizationId || null;
  const collaboratorSector =
    effectiveAccess?.primaryRole === "colaborador" ? effectiveAccess.sectorCode : null;
  const availableSectorOptions = collaboratorSector
    ? sectorOptions.filter(({ code }) => code === collaboratorSector)
    : sectorOptions;

  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [events, setEvents] = useState<CalendarEntry[]>([]);
  const [tasks, setTasks] = useState<CalendarTask[]>([]);
  const [obligationInstances, setObligationInstances] = useState<CalendarObligationInstance[]>([]);
  const [loadingObligations, setLoadingObligations] = useState(true);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEntry | null>(null);
  const [form, setForm] = useState<CalendarFormState>(makeFormState(new Date()));
  const [saving, setSaving] = useState(false);
  const [openingTaskId, setOpeningTaskId] = useState<string | null>(null);
  const [periodMode, setPeriodMode] = useState<CalendarPeriodMode>("month");
  const [calendarSearch, setCalendarSearch] = useState("");
  const [sectorFilter, setSectorFilter] = useState(collaboratorSector || "all");
  const [statusFilter, setStatusFilter] = useState<CalendarStatusFilter>("all");
  const [templateFilter, setTemplateFilter] = useState("all");
  const [onlyOverdue, setOnlyOverdue] = useState(false);

  const monthKey = format(selectedDate, "yyyy-MM");

  const loadMonthEvents = useCallback(async (baseDate: Date) => {

    const from = startOfMonth(baseDate).toISOString();
    const to = endOfMonth(baseDate).toISOString();

    let query = supabase
      .from("calendar_events")
      .select("*")
      .gte("due_at", from)
      .lte("due_at", to)
      .order("due_at", { ascending: true });
    if (organizationId) query = query.eq("organization_id", organizationId);
    const effectiveSector = collaboratorSector || (sectorFilter !== "all" ? sectorFilter : null);
    if (effectiveSector) query = query.eq("sector", SECTOR_LABELS[effectiveSector as keyof typeof SECTOR_LABELS]);
    const { data, error } = await query;

    if (error) {
      toast.error("Erro ao carregar eventos do calendário");
      setEvents([]);
      return;
    }

    setEvents(
      ((data || []) as CalendarEntry[]).filter(
        (event) => event.integration_source !== "grow_obligation",
      ),
    );
  }, [collaboratorSector, organizationId, sectorFilter]);

  const loadMonthTasks = useCallback(async (baseDate: Date) => {
    const from = format(startOfMonth(baseDate), "yyyy-MM-dd");
    const to = format(endOfMonth(baseDate), "yyyy-MM-dd");

    let query = supabase
      .from("kanban_tasks")
      .select("id, title, client_name, sector, priority, due_date, status, integration_source, integration_task_id")
      .not("due_date", "is", null)
      .gte("due_date", from)
      .lte("due_date", to)
      .neq("status", "archived")
      .order("due_date", { ascending: true });
    if (organizationId) query = query.eq("organization_id", organizationId);
    const effectiveSector = collaboratorSector || (sectorFilter !== "all" ? sectorFilter : null);
    if (effectiveSector) query = query.eq("sector", SECTOR_LABELS[effectiveSector as keyof typeof SECTOR_LABELS]);
    const { data, error } = await query;

    if (error) {
      toast.error("Erro ao carregar tarefas do calendário");
      setTasks([]);
      return;
    }

    const normalizedData = ((data || []) as CalendarTask[]).filter((task) => {
      if (!collaboratorSector) return true;
      return normalizeSectorCode(task.sector || "") === collaboratorSector;
    });

    setTasks(normalizedData);
  }, [collaboratorSector, organizationId, sectorFilter]);

  const loadMonthObligations = useCallback(async (baseDate: Date) => {
    setLoadingObligations(true);

    const from = format(startOfMonth(baseDate), "yyyy-MM-dd");
    const to = format(endOfMonth(baseDate), "yyyy-MM-dd");

    let query = supabase
      .from("obligation_instances")
      .select(`
        id,
        template_id,
        client_id,
        competence_label,
        technical_due_date,
        status,
        priority,
        completed_at,
        updated_at,
        template:obligation_templates!inner(id, name, sector),
        client:clients(id, name, cnpj)
      `)
      .gte("technical_due_date", from)
      .lte("technical_due_date", to)
      .is("superseded_by_instance_id", null)
      .neq("status", "cancelada")
      .order("technical_due_date", { ascending: true });
    if (organizationId) query = query.eq("organization_id", organizationId);
    const effectiveSector = collaboratorSector || (sectorFilter !== "all" ? sectorFilter : null);
    if (effectiveSector) query = query.eq("obligation_templates.sector", SECTOR_LABELS[effectiveSector as keyof typeof SECTOR_LABELS]);
    if (statusFilter !== "all") query = query.eq("status", statusFilter);
    if (templateFilter !== "all") query = query.eq("template_id", templateFilter);
    const { data, error } = await query;

    if (error) {
      toast.error("Erro ao carregar obrigações do calendário");
      setObligationInstances([]);
      setLoadingObligations(false);
      return;
    }

    const normalizedData = ((data || []) as unknown as CalendarObligationInstance[])
      .filter((instance) => {
        if (!collaboratorSector) return true;
        return normalizeSectorCode(instance.template?.sector || "") === collaboratorSector;
      });

    setObligationInstances(normalizedData);
    setLoadingObligations(false);
  }, [collaboratorSector, organizationId, sectorFilter, statusFilter, templateFilter]);

  useEffect(() => {
    const [year, month] = monthKey.split("-").map(Number);
    if (!year || !month) return;
    const monthDate = new Date(year, month - 1, 1);
    void loadMonthEvents(monthDate);
    void loadMonthTasks(monthDate);
    void loadMonthObligations(monthDate);
  }, [loadMonthEvents, loadMonthObligations, loadMonthTasks, monthKey]);

  useEffect(() => {
    if (collaboratorSector) setSectorFilter(collaboratorSector);
  }, [collaboratorSector]);

  const selectedDayObligationGroups = useMemo<ObligationDayGroup[]>(() => {
    return buildObligationGroups(obligationInstances.filter((instance) =>
      isSameDay(parseISO(`${instance.technical_due_date}T12:00:00`), selectedDate)));
  }, [obligationInstances, selectedDate]);

  const templateOptions = useMemo(() => {
    const templates = new Map<string, string>();
    for (const instance of obligationInstances) {
      templates.set(instance.template_id, instance.template?.name || "Obrigação sem nome");
    }
    return Array.from(templates, ([id, name]) => ({ id, name }))
      .sort((left, right) => left.name.localeCompare(right.name, "pt-BR"));
  }, [obligationInstances]);

  const filteredObligations = useMemo(() => {
    const normalizedSearch = calendarSearch.trim().toLocaleLowerCase("pt-BR");
    return obligationInstances.filter((instance) => {
      if (periodMode === "day" && !isSameDay(parseISO(`${instance.technical_due_date}T12:00:00`), selectedDate)) return false;
      if (sectorFilter !== "all" && normalizeSectorCode(instance.template?.sector || "") !== sectorFilter) return false;
      if (statusFilter !== "all" && instance.status !== statusFilter) return false;
      if (templateFilter !== "all" && instance.template_id !== templateFilter) return false;
      if (onlyOverdue && !isOperationallyOverdue(instance)) return false;
      if (normalizedSearch) {
        const haystack = `${instance.client?.name || ""} ${instance.client?.cnpj || ""} ${instance.template?.name || ""} ${instance.competence_label}`.toLocaleLowerCase("pt-BR");
        if (!haystack.includes(normalizedSearch)) return false;
      }
      return true;
    });
  }, [calendarSearch, obligationInstances, onlyOverdue, periodMode, sectorFilter, selectedDate, statusFilter, templateFilter]);

  const operationalDateGroups = useMemo<ObligationDateGroup[]>(() => {
    const dates = new Map<string, CalendarObligationInstance[]>();
    for (const instance of filteredObligations) {
      const items = dates.get(instance.technical_due_date) || [];
      items.push(instance);
      dates.set(instance.technical_due_date, items);
    }
    return Array.from(dates, ([date, instances]) => ({
      date,
      groups: buildObligationGroups(instances),
      total: instances.length,
      done: instances.filter((instance) => instance.status === "concluida").length,
      overdue: instances.filter(isOperationallyOverdue).length,
    })).sort((left, right) => left.date.localeCompare(right.date));
  }, [filteredObligations]);

  const selectedDayEvents = useMemo(() => {
    return events.filter((event) => isSameDay(parseISO(event.due_at), selectedDate));
  }, [events, selectedDate]);

  const selectedDayTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (!task.due_date || task.integration_source === "grow_obligation_task") return false;
      return isSameDay(parseISO(`${task.due_date}T12:00:00`), selectedDate);
    });
  }, [tasks, selectedDate]);

  const eventDays = useMemo(
    () => [
      ...events.map((event) => parseISO(event.due_at)),
      ...tasks.filter((task) => task.due_date && task.integration_source !== "grow_obligation_task").map((task) => parseISO(`${task.due_date}T12:00:00`)),
    ],
    [events, tasks]
  );

  const obligationDays = useMemo(
    () => obligationInstances.map((instance) => parseISO(`${instance.technical_due_date}T12:00:00`)),
    [obligationInstances]
  );

  const openTaskDetails = useCallback(
    (taskId: string) => {
      navigate(`/app/tarefas?view=kanban&task=${encodeURIComponent(taskId)}`);
    },
    [navigate],
  );

  const openObligationTaskDetails = useCallback(
    async (instanceId: string) => {
      const integrationTaskId = `instance:${instanceId}`;
      const loadedTask = tasks.find((task) => task.integration_task_id === integrationTaskId);
      if (loadedTask) {
        openTaskDetails(loadedTask.id);
        return;
      }

      setOpeningTaskId(instanceId);
      const { data, error } = await supabase
        .from("kanban_tasks")
        .select("id")
        .eq("integration_source", "grow_obligation_task")
        .eq("integration_task_id", integrationTaskId)
        .maybeSingle();
      setOpeningTaskId(null);

      if (error || !data?.id) {
        toast.error(error?.message || "Não foi possível localizar a tarefa desta obrigação.");
        return;
      }

      openTaskDetails(data.id);
    },
    [openTaskDetails, tasks],
  );

  const openNewDialog = () => {
    setEditingEvent(null);
    setForm({
      ...makeFormState(selectedDate),
      sector: collaboratorSector ? SECTOR_LABELS[collaboratorSector] : SECTOR_LABELS.geral,
    });
    setDialogOpen(true);
  };

  const submitForm = async () => {
    if (!form.title.trim()) {
      toast.error("Informe o título");
      return;
    }

    if (!form.date) {
      toast.error("Informe a data");
      return;
    }

    if (!form.all_day && !form.time) {
      toast.error("Informe o horário");
      return;
    }

    const localDateTime = new Date(
      `${form.date}T${form.all_day ? "12:00" : form.time}:00`
    );

    if (Number.isNaN(localDateTime.getTime())) {
      toast.error("Data ou horário inválido");
      return;
    }

    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      entry_type: form.entry_type,
      priority: form.priority,
      sector: form.sector,
      due_at: localDateTime.toISOString(),
      all_day: form.all_day,
      status: form.status,
    };

    setSaving(true);

    if (editingEvent) {
      const { error } = await supabase
        .from("calendar_events")
        .update(payload)
        .eq("id", editingEvent.id);

      setSaving(false);

      if (error) {
        toast.error("Erro ao atualizar evento");
        return;
      }

      toast.success("Evento atualizado");
    } else {
      const { error } = await supabase
        .from("calendar_events")
        .insert({
          ...payload,
          created_by: user?.id || null,
        });

      setSaving(false);

      if (error) {
        toast.error("Erro ao cadastrar evento");
        return;
      }

      toast.success("Evento cadastrado");
    }

    setDialogOpen(false);
    setEditingEvent(null);
    setForm(makeFormState(selectedDate));
    await loadMonthEvents(selectedDate);
  };

  return (
    <AppLayout>
      <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-5 pb-8">
        <section className="relative overflow-hidden rounded-[1.75rem] border border-primary/15 bg-gradient-to-br from-card via-card to-primary/[0.06] p-5 shadow-[0_18px_50px_-32px_hsl(var(--primary)/0.45)] sm:p-7">
          <div className="absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b from-primary via-primary/70 to-primary/20" />
          <div className="pointer-events-none absolute -right-12 -top-16 h-52 w-52 rounded-full bg-primary/10 blur-3xl" />
          <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-3">
            <ModuleContextPill icon={CalendarDays} label="Agenda operacional" />
            <div className="space-y-1">
            <h1 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">Calendário</h1>
            <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Cadastre eventos, obrigações e acompanhe prazos da operação.
            </p>
            </div>
          </div>
          <Button className="h-11 gap-2 self-start rounded-xl px-5 shadow-sm sm:self-auto" onClick={openNewDialog}>
            <Plus className="h-4 w-4" /> Novo registro
          </Button>
          </div>
        </section>

        <section aria-labelledby="calendar-filters-title" className="rounded-3xl border border-border/70 bg-card p-4 shadow-sm sm:p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 id="calendar-filters-title" className="flex items-center gap-2 font-semibold"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary"><Filter className="h-4 w-4" aria-hidden="true" /></span>Controle operacional</h2>
              <p className="mt-1 text-xs text-muted-foreground">Filtre as competências e identifique rapidamente pendências e atrasos.</p>
            </div>
            <Button
              type="button"
              variant={onlyOverdue ? "destructive" : "outline"}
              size="sm"
              className="shrink-0 gap-2 rounded-xl"
              onClick={() => setOnlyOverdue((current) => !current)}
              aria-pressed={onlyOverdue}
            >
              <AlertTriangle className="h-4 w-4" />Atrasadas
            </Button>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1.2fr_repeat(4,minmax(150px,0.8fr))]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input value={calendarSearch} onChange={(event) => setCalendarSearch(event.target.value)} className="rounded-xl bg-muted/20 pl-9" placeholder="Buscar cliente, CNPJ ou obrigação" aria-label="Buscar no calendário" />
            </div>
            <Select value={periodMode} onValueChange={(value) => setPeriodMode(value as CalendarPeriodMode)}>
              <SelectTrigger aria-label="Período da agenda"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="day">Dia selecionado</SelectItem><SelectItem value="month">Mês inteiro</SelectItem></SelectContent>
            </Select>
            <Select value={sectorFilter} onValueChange={setSectorFilter} disabled={Boolean(collaboratorSector)}>
              <SelectTrigger aria-label="Filtrar por setor"><SelectValue placeholder="Setor" /></SelectTrigger>
              <SelectContent><SelectItem value="all">Todos os setores</SelectItem>{availableSectorOptions.map(({ code, label }) => <SelectItem key={code} value={code}>{label}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as CalendarStatusFilter)}>
              <SelectTrigger aria-label="Filtrar por status"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent><SelectItem value="all">Todos os status</SelectItem>{Object.entries(obligationStatusLabels).filter(([status]) => status !== "cancelada").map(([status, label]) => <SelectItem key={status} value={status}>{label}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={templateFilter} onValueChange={setTemplateFilter}>
              <SelectTrigger aria-label="Filtrar por obrigação"><SelectValue placeholder="Obrigação" /></SelectTrigger>
              <SelectContent><SelectItem value="all">Todas as obrigações</SelectItem>{templateOptions.map((template) => <SelectItem key={template.id} value={template.id}>{template.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </section>

        <section aria-labelledby="operational-agenda-title" className="order-4 overflow-hidden rounded-3xl border border-border/70 bg-card shadow-sm">
          <div className="flex flex-col gap-3 border-b border-border/60 bg-gradient-to-r from-muted/30 via-card to-primary/[0.04] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><ClipboardList className="h-5 w-5" aria-hidden="true" /></span>
              <div>
              <h2 id="operational-agenda-title" className="font-semibold">Agenda operacional do {periodMode === "day" ? "dia" : "mês"}</h2>
              <p className="text-xs text-muted-foreground">{filteredObligations.length} competência(s) em {operationalDateGroups.length} data(s), ordenadas por vencimento e criticidade.</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">{filteredObligations.filter((instance) => instance.status !== "concluida").length} em aberto</Badge>
              <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700">{filteredObligations.filter(isOperationallyOverdue).length} atrasada(s)</Badge>
              <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">{filteredObligations.filter((instance) => instance.status === "concluida").length} concluída(s)</Badge>
            </div>
          </div>
          {loadingObligations ? (
            <div className="flex min-h-52 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
          ) : operationalDateGroups.length === 0 ? (
            <div className="flex min-h-52 flex-col items-center justify-center p-6 text-center"><CalendarDays className="mb-2 h-8 w-8 text-muted-foreground" /><p className="font-medium">Nenhuma obrigação encontrada</p><p className="text-sm text-muted-foreground">Altere o período ou remova algum filtro.</p></div>
          ) : (
            <div className="divide-y">
              {operationalDateGroups.map((dateGroup) => (
                <div key={dateGroup.date} className="p-4 transition-colors hover:bg-muted/[0.12] sm:p-5">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className={`flex h-11 min-w-11 flex-col items-center justify-center rounded-xl px-2 ${dateGroup.overdue ? "bg-red-100 text-red-700" : "bg-primary/10 text-primary"}`}>
                        <span className="text-base font-bold leading-none">{format(parseISO(`${dateGroup.date}T12:00:00`), "dd")}</span>
                        <span className="text-[10px] uppercase">{format(parseISO(`${dateGroup.date}T12:00:00`), "MMM", { locale: ptBR })}</span>
                      </div>
                      <div><p className="font-semibold">{format(parseISO(`${dateGroup.date}T12:00:00`), "EEEE", { locale: ptBR })}</p><p className="text-xs text-muted-foreground">{dateGroup.total} competência(s) · {dateGroup.done} concluída(s)</p></div>
                    </div>
                    {dateGroup.overdue > 0 ? <Badge variant="destructive">{dateGroup.overdue} atrasada(s)</Badge> : null}
                  </div>
                  <div className="space-y-2">
                    {dateGroup.groups.map((group) => {
                      const overdueCount = group.instances.filter(isOperationallyOverdue).length;
                      const reviewCount = group.instances.filter((instance) => instance.status === "em_revisao").length;
                      return (
                        <Collapsible key={`${dateGroup.date}-${group.templateId}`} defaultOpen={overdueCount > 0}>
                          <div className="overflow-hidden rounded-2xl border border-border/70 bg-background/80 shadow-sm transition-all hover:border-primary/20 hover:shadow-md">
                            <CollapsibleTrigger className="group flex w-full items-center justify-between gap-3 p-4 text-left hover:bg-primary/[0.025] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
                              <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{group.name}</h3><Badge variant="outline">{group.sector}</Badge></div><p className="mt-1 text-xs text-muted-foreground">{group.instances.length} cliente(s) · {group.doneCount} concluída(s){reviewCount ? ` · ${reviewCount} em revisão` : ""}{overdueCount ? ` · ${overdueCount} atrasada(s)` : ""}</p></div>
                              <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-data-[state=open]:rotate-180" />
                            </CollapsibleTrigger>
                            <CollapsibleContent><div className="divide-y border-t">{group.instances.map((instance) => (
                              <button key={instance.id} type="button" onClick={() => void openObligationTaskDetails(instance.id)} disabled={openingTaskId === instance.id} className="flex w-full flex-wrap items-center gap-3 p-3 text-left hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 sm:flex-nowrap">
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">{openingTaskId === instance.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Building2 className="h-4 w-4" />}</div>
                                <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{instance.client?.name || "Cliente sem nome"}</p><p className="text-xs text-muted-foreground">Competência {instance.competence_label}{instance.client?.cnpj ? ` · ${instance.client.cnpj}` : ""}</p></div>
                                {isOperationallyOverdue(instance) ? <Badge variant="destructive">Atrasada</Badge> : <Badge variant="outline" className={`border-0 ${obligationStatusClasses[instance.status]}`}>{obligationStatusLabels[instance.status]}</Badge>}
                              </button>
                            ))}</div></CollapsibleContent>
                          </div>
                        </Collapsible>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <div className="order-3 grid items-start gap-5 lg:grid-cols-[minmax(390px,0.8fr)_minmax(0,1.2fr)]">
          <div className="h-fit min-w-0 overflow-hidden rounded-3xl border border-border/70 bg-card shadow-sm lg:sticky lg:top-4">
            <div className="flex items-center gap-3 border-b border-border/60 bg-gradient-to-r from-muted/30 to-primary/[0.04] p-5">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><CalendarDays className="h-5 w-5" aria-hidden="true" /></span>
              <div><h2 className="font-semibold">Calendário mensal</h2><p className="text-xs text-muted-foreground">Selecione uma data para ver os detalhes.</p></div>
            </div>
            <div className="p-5 sm:p-6">
            <div className="flex justify-center overflow-hidden">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => date && setSelectedDate(date)}
              onMonthChange={(date) => setSelectedDate(date)}
              locale={ptBR}
              modifiers={{
                hasEvents: eventDays,
                hasObligations: obligationDays,
              }}
              modifiersClassNames={{
                hasEvents: "bg-primary/10 text-primary font-semibold",
                hasObligations: "ring-2 ring-orange-500 ring-inset",
              }}
              className="w-full p-0"
              classNames={{
                month: "w-full space-y-5",
                caption: "relative flex items-center justify-center px-12 pt-0 text-base font-semibold",
                nav_button_previous: "absolute left-0",
                nav_button_next: "absolute right-0",
                table: "w-full border-collapse",
                head_row: "grid grid-cols-7",
                head_cell: "flex h-11 items-center justify-center rounded-md text-[0.85rem] font-normal text-muted-foreground",
                row: "grid grid-cols-7 gap-2",
                cell: "relative flex h-14 items-center justify-center p-0 text-center text-sm",
                day: "h-12 w-12 rounded-xl p-0 text-sm font-normal aria-selected:opacity-100",
              }}
            />
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 border-t pt-4 text-xs text-muted-foreground">
              <p>Legenda:</p>
              <p><span className="inline-block h-2 w-2 rounded-full bg-primary mr-1.5" /> Dia com evento</p>
              <p><span className="inline-block h-2 w-2 rounded-full bg-orange-500 mr-1.5" /> Dia com obrigação</p>
            </div>
            </div>
          </div>

          <div className="min-w-0">
            <div className="overflow-hidden rounded-3xl border border-border/70 bg-card shadow-sm">
              <div className="flex items-center justify-between gap-2 border-b border-border/60 bg-gradient-to-r from-muted/30 via-card to-primary/[0.04] p-5 sm:p-6">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><CheckCircle2 className="h-5 w-5" aria-hidden="true" /></span>
                  <div>
                  <h2 className="font-semibold">
                    Agenda de {format(selectedDate, "dd 'de' MMMM", { locale: ptBR })}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    {selectedDayObligationGroups.reduce((total, group) => total + group.instances.length, 0)} obrigação(ões), {selectedDayTasks.length} tarefa(s) e {selectedDayEvents.length} registro(s)
                  </p>
                  </div>
                </div>
              </div>

              {loadingObligations ? (
                <div className="flex min-h-[360px] justify-center p-8">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                </div>
              ) : selectedDayObligationGroups.length === 0 && selectedDayTasks.length === 0 && selectedDayEvents.length === 0 ? (
                <div className="flex min-h-[360px] flex-col items-center justify-center p-6 text-center">
                  <CalendarDays className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
                  <p className="font-medium">Sem itens neste dia</p>
                  <p className="mt-1 max-w-md text-sm text-muted-foreground">
                    Selecione um dia marcado no calendário para acompanhar obrigações, tarefas e registros.
                  </p>
                </div>
              ) : (
                <div className="space-y-3 p-4">
                  {selectedDayObligationGroups.map((group) => (
                    <Collapsible key={group.templateId}>
                      <div className="rounded-2xl border border-border/70 bg-background/80 shadow-sm transition-all hover:border-primary/20 hover:shadow-md">
                        <CollapsibleTrigger className="group flex w-full items-center justify-between gap-3 p-4 text-left hover:bg-primary/[0.025] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="truncate font-semibold">{group.name}</h3>
                              <Badge variant="outline" className="border-0 bg-muted text-muted-foreground">
                                {group.sector}
                              </Badge>
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {group.doneCount}/{group.instances.length} feita(s)
                            </p>
                          </div>
                          <div className="flex shrink-0 items-center gap-3">
                            <Badge
                              variant="outline"
                              className={group.doneCount === group.instances.length ? "border-0 bg-emerald-100 text-emerald-700" : "border-0 bg-amber-100 text-amber-700"}
                            >
                              {group.doneCount === group.instances.length ? "Completa" : "Em aberto"}
                            </Badge>
                            <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
                          </div>
                        </CollapsibleTrigger>

                        <CollapsibleContent>
                          <div className="divide-y border-t">
                            {group.instances.map((instance) => (
                              <button
                                key={instance.id}
                                type="button"
                                className="flex w-full flex-wrap items-center gap-3 p-3 text-left transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 sm:flex-nowrap"
                                onClick={() => void openObligationTaskDetails(instance.id)}
                                disabled={openingTaskId === instance.id}
                              >
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                                  {openingTaskId === instance.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Building2 className="h-4 w-4" />}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-sm font-medium">{instance.client?.name || "Cliente sem nome"}</p>
                                  <p className="text-xs text-muted-foreground">Competência {instance.competence_label}</p>
                                </div>
                                <Badge variant="outline" className={`shrink-0 border-0 ${obligationStatusClasses[instance.status] || "bg-muted text-muted-foreground"}`}>
                                  {obligationStatusLabels[instance.status] || instance.status}
                                </Badge>
                              </button>
                            ))}
                          </div>
                        </CollapsibleContent>
                      </div>
                    </Collapsible>
                  ))}

                  {(selectedDayTasks.length > 0 || selectedDayEvents.length > 0) && (
                    <div className="rounded-xl border bg-background/60 shadow-sm">
                      <div className="border-b p-4">
                        <div className="flex items-center gap-2">
                          <ClipboardList className="h-4 w-4 text-muted-foreground" />
                          <h3 className="font-semibold">Outras tarefas e registros</h3>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Itens do dia que não fazem parte do agrupamento de obrigações.
                        </p>
                      </div>
                      <div className="divide-y">
                        {selectedDayTasks.map((task) => (
                          <button
                            key={`task-${task.id}`}
                            type="button"
                            className="flex w-full flex-wrap items-center gap-3 p-3 text-left transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 sm:flex-nowrap"
                            onClick={() => openTaskDetails(task.id)}
                          >
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium">{task.title}</p>
                              <p className="text-xs text-muted-foreground">
                                {task.client_name || "Sem cliente"} · {task.sector || "Sem setor"}
                              </p>
                            </div>
                            <Badge variant="outline" className="shrink-0 border-0 bg-blue-100 text-blue-700">
                              Tarefa
                            </Badge>
                            <Badge variant="outline" className="shrink-0 border-0 bg-muted text-muted-foreground">
                              {task.status}
                            </Badge>
                          </button>
                        ))}

                        {selectedDayEvents.map((event) => (
                          <div key={`event-${event.id}`} className="flex flex-wrap items-center gap-3 p-3 sm:flex-nowrap">
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium">{event.title}</p>
                              <p className="text-xs text-muted-foreground">
                                {event.all_day ? "Dia todo" : format(parseISO(event.due_at), "HH:mm")} · {event.sector}
                              </p>
                            </div>
                            <Badge variant="outline" className="shrink-0 border-0 bg-primary/10 text-primary">
                              Registro
                            </Badge>
                            <Badge variant="outline" className="shrink-0 border-0 bg-muted text-muted-foreground">
                              {event.status === "completed" ? "Concluído" : event.status === "cancelled" ? "Cancelado" : "Pendente"}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>


          </div>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingEvent ? "Editar registro" : "Novo registro no calendário"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>Título</Label>
              <Input
                value={form.title}
                onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                placeholder="Ex: Entrega de folha / Reunião com cliente"
              />
            </div>

            <div className="grid sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Tipo</Label>
                <Select
                  value={form.entry_type}
                  onValueChange={(value) => setForm((prev) => ({ ...prev, entry_type: value as EntryType }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="evento">Evento</SelectItem>
                    <SelectItem value="obrigação">Obrigação</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Prioridade</Label>
                <Select
                  value={form.priority}
                  onValueChange={(value) => setForm((prev) => ({ ...prev, priority: value as EntryPriority }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="baixa">Baixa</SelectItem>
                    <SelectItem value="media">Média</SelectItem>
                    <SelectItem value="alta">Alta</SelectItem>
                    <SelectItem value="urgente">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(value) => setForm((prev) => ({ ...prev, status: value as EntryStatus }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pendente</SelectItem>
                    <SelectItem value="completed">Concluído</SelectItem>
                    <SelectItem value="cancelled">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Setor</Label>
                <Select
                  value={form.sector}
                  onValueChange={(value) => setForm((prev) => ({ ...prev, sector: value }))}
                  disabled={Boolean(collaboratorSector)}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {availableSectorOptions.map(({ code, label }) => (
                      <SelectItem key={code} value={label}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Data</Label>
                <Input
                  type="date"
                  value={form.date}
                  onChange={(event) => setForm((prev) => ({ ...prev, date: event.target.value }))}
                />
              </div>
            </div>

            <div className="flex items-center justify-between border rounded-lg p-3">
              <div>
                <p className="text-sm font-medium">Dia todo</p>
                <p className="text-xs text-muted-foreground">Ative para ocultar o horário específico.</p>
              </div>
              <Switch
                checked={form.all_day}
                onCheckedChange={(checked) => setForm((prev) => ({ ...prev, all_day: checked }))}
              />
            </div>

            {!form.all_day && (
              <div className="space-y-1.5">
                <Label>Horário</Label>
                <Input
                  type="time"
                  value={form.time}
                  onChange={(event) => setForm((prev) => ({ ...prev, time: event.target.value }))}
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Descrição</Label>
              <Textarea
                rows={3}
                value={form.description}
                onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                placeholder="Detalhes importantes deste registro..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setDialogOpen(false);
                setEditingEvent(null);
                setForm(makeFormState(selectedDate));
              }}
            >
              Cancelar
            </Button>
            <Button type="button" onClick={submitForm} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
