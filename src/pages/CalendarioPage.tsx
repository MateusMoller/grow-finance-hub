import { useCallback, useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/app/AppLayout";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  Clock,
  Loader2,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  addDays,
  endOfDay,
  endOfMonth,
  format,
  isSameDay,
  parseISO,
  startOfDay,
  startOfMonth,
} from "date-fns";
import { ptBR } from "date-fns/locale";

type EntryType = "evento" | "obrigacao";
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

const sectorOptions = [
  "Contábil",
  "Fiscal",
  "Departamento Pessoal",
  "Financeiro",
  "Comercial",
  "Societário",
  "Geral",
];

const priorityLabels: Record<EntryPriority, string> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
  urgente: "Urgente",
};

const priorityClasses: Record<EntryPriority, string> = {
  baixa: "bg-muted text-muted-foreground",
  media: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  alta: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  urgente: "bg-destructive/10 text-destructive",
};

const typeClasses: Record<EntryType, string> = {
  evento: "bg-primary/10 text-primary",
  obrigacao: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
};

const statusLabels: Record<EntryStatus, string> = {
  pending: "Pendente",
  completed: "Concluído",
  cancelled: "Cancelado",
};

const statusClasses: Record<EntryStatus, string> = {
  pending: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  completed: "bg-primary/10 text-primary",
  cancelled: "bg-destructive/10 text-destructive",
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

export default function CalendarioPage() {
  const { user } = useAuth();

  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [events, setEvents] = useState<CalendarEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEntry | null>(null);
  const [form, setForm] = useState<CalendarFormState>(makeFormState(new Date()));
  const [saving, setSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const monthKey = format(selectedDate, "yyyy-MM");

  const loadMonthEvents = useCallback(async (baseDate: Date) => {
    setLoading(true);

    const from = startOfMonth(baseDate).toISOString();
    const to = endOfMonth(baseDate).toISOString();

    const { data, error } = await supabase
      .from("calendar_events")
      .select("*")
      .gte("due_at", from)
      .lte("due_at", to)
      .order("due_at", { ascending: true });

    if (error) {
      toast.error("Erro ao carregar eventos do calendário");
      setEvents([]);
      setLoading(false);
      return;
    }

    setEvents((data || []) as CalendarEntry[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    const [year, month] = monthKey.split("-").map(Number);
    if (!year || !month) return;
    void loadMonthEvents(new Date(year, month - 1, 1));
  }, [loadMonthEvents, monthKey]);

  const selectedDayEvents = useMemo(() => {
    return events.filter((event) => isSameDay(parseISO(event.due_at), selectedDate));
  }, [events, selectedDate]);

  const upcomingObligations = useMemo(() => {
    const today = startOfDay(new Date());
    const nextWeek = endOfDay(addDays(today, 7));

    return events
      .filter((event) => {
        const date = parseISO(event.due_at);
        return (
          event.entry_type === "obrigacao"
          && event.status !== "completed"
          && date >= today
          && date <= nextWeek
        );
      })
      .sort((a, b) => +new Date(a.due_at) - +new Date(b.due_at))
      .slice(0, 8);
  }, [events]);

  const stats = {
    total: events.length,
    obligations: events.filter((event) => event.entry_type === "obrigacao").length,
    pending: events.filter((event) => event.status === "pending").length,
  };

  const eventDays = useMemo(
    () => events.map((event) => parseISO(event.due_at)),
    [events]
  );

  const obligationDays = useMemo(
    () => events.filter((event) => event.entry_type === "obrigacao").map((event) => parseISO(event.due_at)),
    [events]
  );

  const openNewDialog = () => {
    setEditingEvent(null);
    setForm(makeFormState(selectedDate));
    setDialogOpen(true);
  };

  const openEditDialog = (event: CalendarEntry) => {
    const date = parseISO(event.due_at);
    setEditingEvent(event);
    setForm({
      title: event.title,
      description: event.description || "",
      entry_type: event.entry_type,
      priority: event.priority,
      sector: event.sector,
      date: format(date, "yyyy-MM-dd"),
      time: format(date, "HH:mm"),
      all_day: event.all_day,
      status: event.status,
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

  const deleteEvent = async (eventId: string) => {
    const confirmDelete = window.confirm("Deseja realmente excluir este registro?");
    if (!confirmDelete) return;

    setUpdatingId(eventId);

    const { error } = await supabase
      .from("calendar_events")
      .delete()
      .eq("id", eventId);

    setUpdatingId(null);

    if (error) {
      toast.error("Erro ao excluir evento");
      return;
    }

    toast.success("Registro excluído");
    await loadMonthEvents(selectedDate);
  };

  const toggleCompleted = async (event: CalendarEntry) => {
    setUpdatingId(event.id);

    const nextStatus: EntryStatus = event.status === "completed" ? "pending" : "completed";

    const { error } = await supabase
      .from("calendar_events")
      .update({ status: nextStatus })
      .eq("id", event.id);

    setUpdatingId(null);

    if (error) {
      toast.error("Erro ao atualizar status");
      return;
    }

    toast.success(nextStatus === "completed" ? "Marcado como concluído" : "Reaberto como pendente");
    await loadMonthEvents(selectedDate);
  };

  return (
    <AppLayout>
      <div className="space-y-6 max-w-7xl">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="font-heading text-2xl font-bold">Calendário</h1>
            <p className="text-sm text-muted-foreground">
              Cadastre eventos, obrigações e acompanhe prazos da operação.
            </p>
          </div>
          <Button className="gap-2" onClick={openNewDialog}>
            <Plus className="h-4 w-4" /> Novo registro
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-lg border bg-card p-4">
            <p className="text-xs text-muted-foreground">Registros no mês</p>
            <p className="text-2xl font-bold mt-1">{stats.total}</p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <p className="text-xs text-muted-foreground">Obrigações</p>
            <p className="text-2xl font-bold mt-1 text-orange-600">{stats.obligations}</p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <p className="text-xs text-muted-foreground">Pendentes</p>
            <p className="text-2xl font-bold mt-1 text-amber-600">{stats.pending}</p>
          </div>
        </div>

        <div className="grid xl:grid-cols-[370px_minmax(0,1fr)] gap-6">
          <div className="rounded-xl border bg-card p-4 h-fit">
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
              className="w-full"
            />
            <div className="mt-3 text-xs text-muted-foreground space-y-1">
              <p>Legenda:</p>
              <p><span className="inline-block h-2 w-2 rounded-full bg-primary mr-1.5" /> Dia com evento</p>
              <p><span className="inline-block h-2 w-2 rounded-full bg-orange-500 mr-1.5" /> Dia com obrigação</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-xl border bg-card">
              <div className="p-4 border-b flex items-center justify-between gap-2">
                <div>
                  <h2 className="font-semibold">
                    Agenda de {format(selectedDate, "dd 'de' MMMM", { locale: ptBR })}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    {selectedDayEvents.length} registro(s) neste dia
                  </p>
                </div>
              </div>

              {loading ? (
                <div className="p-8 flex justify-center">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                </div>
              ) : selectedDayEvents.length === 0 ? (
                <div className="p-8 text-center">
                  <CalendarDays className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="font-medium">Sem registros neste dia</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Clique em "Novo registro" para adicionar um evento ou obrigação.
                  </p>
                </div>
              ) : (
                <div className="divide-y">
                  {selectedDayEvents.map((event) => (
                    <div key={event.id} className="p-4 space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium mr-auto">{event.title}</p>
                        <Badge variant="outline" className={`border-0 ${typeClasses[event.entry_type]}`}>
                          {event.entry_type === "obrigacao" ? "Obrigação" : "Evento"}
                        </Badge>
                        <Badge variant="outline" className={`border-0 ${priorityClasses[event.priority]}`}>
                          {priorityLabels[event.priority]}
                        </Badge>
                        <Badge variant="outline" className={`border-0 ${statusClasses[event.status]}`}>
                          {statusLabels[event.status]}
                        </Badge>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          {event.all_day ? "Dia todo" : format(parseISO(event.due_at), "HH:mm")}
                        </span>
                        <span>Setor: {event.sector}</span>
                      </div>

                      {event.description && (
                        <p className="text-sm text-muted-foreground">{event.description}</p>
                      )}

                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5"
                          onClick={() => openEditDialog(event)}
                        >
                          <Pencil className="h-3.5 w-3.5" /> Editar
                        </Button>
                        <Button
                          size="sm"
                          variant={event.status === "completed" ? "secondary" : "default"}
                          className="gap-1.5"
                          onClick={() => toggleCompleted(event)}
                          disabled={updatingId === event.id}
                        >
                          {updatingId === event.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          )}
                          {event.status === "completed" ? "Reabrir" : "Concluir"}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive gap-1.5"
                          onClick={() => deleteEvent(event.id)}
                          disabled={updatingId === event.id}
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Excluir
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-xl border bg-card">
              <div className="p-4 border-b">
                <h2 className="font-semibold">Próximas obrigações (7 dias)</h2>
              </div>
              {upcomingObligations.length === 0 ? (
                <div className="p-6 text-sm text-muted-foreground">
                  Nenhuma obrigação pendente para os próximos dias.
                </div>
              ) : (
                <div className="divide-y">
                  {upcomingObligations.map((event) => (
                    <div key={event.id} className="p-4 flex items-center gap-3">
                      <AlertCircle className="h-4 w-4 text-orange-500 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{event.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(parseISO(event.due_at), "dd/MM/yyyy")} {event.all_day ? "· Dia todo" : `· ${format(parseISO(event.due_at), "HH:mm")}`}
                        </p>
                      </div>
                    </div>
                  ))}
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
                    <SelectItem value="obrigacao">Obrigação</SelectItem>
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
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {sectorOptions.map((sector) => (
                      <SelectItem key={sector} value={sector}>{sector}</SelectItem>
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
