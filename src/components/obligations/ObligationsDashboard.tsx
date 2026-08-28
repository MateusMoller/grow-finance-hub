import { useMemo, useState } from "react";
import { ArrowRight, ChevronDown, Filter, Search, TimerReset, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  growObligationStatusClass,
  growObligationStatusLabel,
  growPriorityLabel,
  type GrowObligationInstance,
} from "@/lib/growObligations";

const closedStatuses = new Set<GrowObligationInstance["status"]>(["concluida", "cancelada"]);

function todayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function addDays(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T12:00:00`);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatDate(value: string) {
  if (!value) return "Sem data";
  return new Intl.DateTimeFormat("pt-BR").format(new Date(`${value}T12:00:00`));
}

function DashboardInstanceRow({
  instance,
  onOpen,
}: {
  instance: GrowObligationInstance;
  onOpen: (instance: GrowObligationInstance) => void;
}) {
  return (
    <button
      type="button"
      className="flex w-full flex-col gap-2 rounded-xl border border-border/70 bg-background p-3 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      onClick={() => onOpen(instance)}
    >
      <div className="flex w-full flex-wrap items-center justify-between gap-2">
        <span className="min-w-0 truncate text-sm font-medium">{instance.client?.name || "Cliente"}</span>
        <Badge className={`border-0 ${growObligationStatusClass[instance.status]}`}>{growObligationStatusLabel[instance.status]}</Badge>
      </div>
      <div className="flex w-full flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>Competência {instance.competence_label}</span>
        <span>Vence em {formatDate(instance.technical_due_date)}</span>
      </div>
    </button>
  );
}

export function ObligationsDashboard({
  instances,
  onOpenInstance,
  onViewAll,
}: {
  instances: GrowObligationInstance[];
  onOpenInstance: (instance: GrowObligationInstance) => void;
  onViewAll: () => void;
}) {
  const [search, setSearch] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [clientFilter, setClientFilter] = useState("all");
  const [templateFilter, setTemplateFilter] = useState("all");
  const [sectorFilter, setSectorFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const filterOptions = useMemo(() => {
    const clients = new Map<string, string>();
    const templates = new Map<string, string>();
    const sectors = new Set<string>();
    const statuses = new Set<GrowObligationInstance["status"]>();
    for (const instance of instances) {
      if (instance.client_id) clients.set(instance.client_id, instance.client?.name || "Cliente");
      if (instance.template_id) templates.set(instance.template_id, instance.template?.name || "Obrigação");
      if (instance.template?.sector) sectors.add(instance.template.sector);
      statuses.add(instance.status);
    }
    return {
      clients: [...clients].toSorted((left, right) => left[1].localeCompare(right[1], "pt-BR")),
      templates: [...templates].toSorted((left, right) => left[1].localeCompare(right[1], "pt-BR")),
      sectors: [...sectors].toSorted((left, right) => left.localeCompare(right, "pt-BR")),
      statuses: [...statuses].toSorted((left, right) => growObligationStatusLabel[left].localeCompare(growObligationStatusLabel[right], "pt-BR")),
    };
  }, [instances]);

  const filteredInstances = useMemo(() => {
    const token = search.trim().toLocaleLowerCase("pt-BR");
    return instances.filter((instance) => {
      if (clientFilter !== "all" && instance.client_id !== clientFilter) return false;
      if (templateFilter !== "all" && instance.template_id !== templateFilter) return false;
      if (sectorFilter !== "all" && instance.template?.sector !== sectorFilter) return false;
      if (statusFilter !== "all" && instance.status !== statusFilter) return false;
      if (!token) return true;
      return `${instance.client?.name || ""} ${instance.template?.name || ""} ${instance.template?.sector || ""} ${instance.competence_label}`
        .toLocaleLowerCase("pt-BR")
        .includes(token);
    });
  }, [clientFilter, instances, search, sectorFilter, statusFilter, templateFilter]);

  const activeFilterCount = [clientFilter, templateFilter, sectorFilter, statusFilter].filter((value) => value !== "all").length + (search.trim() ? 1 : 0);

  const clearFilters = () => {
    setSearch("");
    setClientFilter("all");
    setTemplateFilter("all");
    setSectorFilter("all");
    setStatusFilter("all");
  };

  const dashboard = useMemo(() => {
    const today = todayKey();
    const nextSevenDays = addDays(today, 7);
    const open = filteredInstances.filter((instance) => !closedStatuses.has(instance.status));
    const overdue = open.filter((instance) => instance.technical_due_date < today);
    const dueSoon = open.filter(
      (instance) => instance.technical_due_date >= today && instance.technical_due_date <= nextSevenDays,
    );
    const upcoming = [...open]
      .sort((left, right) => left.technical_due_date.localeCompare(right.technical_due_date))
      .slice(0, 8);

    const groups = new Map<string, { name: string; sector: string; items: GrowObligationInstance[] }>();
    for (const instance of filteredInstances) {
      const key = instance.template_id || instance.template?.name || "sem-template";
      const current = groups.get(key) || {
        name: instance.template?.name || "Obrigação sem nome",
        sector: instance.template?.sector || "Geral",
        items: [],
      };
      current.items.push(instance);
      groups.set(key, current);
    }
    const grouped = Array.from(groups.values())
      .map((group) => ({
        ...group,
        items: group.items.toSorted((left, right) => left.technical_due_date.localeCompare(right.technical_due_date)),
      }))
      .toSorted((left, right) => left.name.localeCompare(right.name, "pt-BR"));

    return { open, overdue, dueSoon, upcoming, grouped };
  }, [filteredInstances]);

  return (
    <div className="space-y-5">
      <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen} className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 sm:px-4">
          <CollapsibleTrigger asChild>
            <Button type="button" variant={activeFilterCount > 0 ? "secondary" : "ghost"} className="gap-2 rounded-xl">
              <Filter className="h-4 w-4" aria-hidden="true" />
              Filtros do dashboard
              {activeFilterCount > 0 ? <Badge className="h-5 min-w-5 justify-center rounded-full px-1.5">{activeFilterCount}</Badge> : null}
              <ChevronDown className={`h-4 w-4 transition-transform ${filtersOpen ? "rotate-180" : ""}`} aria-hidden="true" />
            </Button>
          </CollapsibleTrigger>
          <span className="text-xs text-muted-foreground">{filteredInstances.length} de {instances.length} competências na visão</span>
        </div>
        <CollapsibleContent className="border-t border-border/60 bg-muted/[0.12] p-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(240px,1.4fr)_repeat(4,minmax(160px,1fr))_auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cliente, obrigação ou competência" className="rounded-xl bg-background pl-9" />
            </div>
            <Select value={clientFilter} onValueChange={setClientFilter}><SelectTrigger className="rounded-xl bg-background"><SelectValue placeholder="Cliente" /></SelectTrigger><SelectContent><SelectItem value="all">Todos os clientes</SelectItem>{filterOptions.clients.map(([id, name]) => <SelectItem key={id} value={id}>{name}</SelectItem>)}</SelectContent></Select>
            <Select value={templateFilter} onValueChange={setTemplateFilter}><SelectTrigger className="rounded-xl bg-background"><SelectValue placeholder="Obrigação" /></SelectTrigger><SelectContent><SelectItem value="all">Todas as obrigações</SelectItem>{filterOptions.templates.map(([id, name]) => <SelectItem key={id} value={id}>{name}</SelectItem>)}</SelectContent></Select>
            <Select value={sectorFilter} onValueChange={setSectorFilter}><SelectTrigger className="rounded-xl bg-background"><SelectValue placeholder="Setor" /></SelectTrigger><SelectContent><SelectItem value="all">Todos os setores</SelectItem>{filterOptions.sectors.map((sector) => <SelectItem key={sector} value={sector}>{sector}</SelectItem>)}</SelectContent></Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="rounded-xl bg-background"><SelectValue placeholder="Status" /></SelectTrigger><SelectContent><SelectItem value="all">Todos os status</SelectItem>{filterOptions.statuses.map((status) => <SelectItem key={status} value={status}>{growObligationStatusLabel[status]}</SelectItem>)}</SelectContent></Select>
            <Button type="button" variant="outline" className="rounded-xl" onClick={clearFilters} disabled={activeFilterCount === 0}><X className="mr-2 h-4 w-4" aria-hidden="true" />Limpar</Button>
          </div>
        </CollapsibleContent>
      </Collapsible>

      <dl className="flex flex-wrap gap-x-8 gap-y-3 border-y py-3" aria-label="Resumo das obrigações">
        {[["Em aberto", dashboard.open.length], ["Próximos 7 dias", dashboard.dueSoon.length], ["Atrasadas", dashboard.overdue.length]].map(([label, value]) => (
          <div key={label} className="flex items-baseline gap-2">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="text-sm font-semibold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>

      <Card className="overflow-hidden rounded-3xl border-border/70 shadow-sm">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Próximas obrigações</CardTitle>
            <CardDescription>Ordem de vencimento das competências que ainda precisam ser trabalhadas.</CardDescription>
          </div>
          <Button type="button" variant="outline" onClick={onViewAll}>Ver lista completa</Button>
        </CardHeader>
        <CardContent>
          {dashboard.upcoming.length > 0 ? (
            <div className="grid gap-3 lg:grid-cols-2">
              {dashboard.upcoming.map((instance) => (
                <button key={instance.id} type="button" onClick={() => onOpenInstance(instance)} className="group flex w-full items-center gap-3 rounded-2xl border border-border/70 bg-background p-3 text-left transition-all hover:border-primary/30 hover:bg-primary/[0.03] hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <div className="rounded-xl bg-primary/10 p-2 text-primary"><TimerReset className="h-4 w-4" aria-hidden="true" /></div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{instance.template?.name || "Obrigação"}</p>
                    <p className="truncate text-xs text-muted-foreground">{instance.client?.name || "Cliente"} · {instance.competence_label}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-medium">{formatDate(instance.technical_due_date)}</p>
                    <Badge variant="outline" className="mt-1">{growPriorityLabel[instance.priority]}</Badge>
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" aria-hidden="true" />
                </button>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">Nenhuma obrigação em aberto.</div>
          )}
        </CardContent>
      </Card>

      <Card className="overflow-hidden rounded-3xl border-border/70 shadow-sm">
        <CardHeader className="gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Obrigações geradas por quadro</CardTitle>
            <CardDescription>Cada quadro reúne clientes e competências da mesma obrigação.</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {dashboard.grouped.length > 0 ? (
            <div className="grid items-start gap-4 lg:grid-cols-2 2xl:grid-cols-3">
              {dashboard.grouped.map((group) => {
                const openCount = group.items.filter((item) => !closedStatuses.has(item.status)).length;
                const overdueCount = group.items.filter((item) => !closedStatuses.has(item.status) && item.technical_due_date < todayKey()).length;
                return (
                  <section key={`${group.name}-${group.sector}`} className="rounded-2xl border border-border/70 bg-gradient-to-b from-muted/20 to-background p-4 shadow-sm transition-colors hover:border-primary/20 [content-visibility:auto]">
                    <div className="mb-4 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate font-semibold">{group.name}</h3>
                        <p className="text-xs text-muted-foreground">{group.sector} · {group.items.length} gerada(s)</p>
                      </div>
                      <div className="flex shrink-0 gap-1.5">
                        <Badge variant="secondary">{openCount} abertas</Badge>
                        {overdueCount > 0 ? <Badge variant="destructive">{overdueCount} atrasadas</Badge> : null}
                      </div>
                    </div>
                    <div className="space-y-2">
                      {group.items.slice(0, 6).map((instance) => <DashboardInstanceRow key={instance.id} instance={instance} onOpen={onOpenInstance} />)}
                    </div>
                    {group.items.length > 6 ? <p className="mt-3 text-center text-xs text-muted-foreground">Mais {group.items.length - 6} competência(s) na lista completa</p> : null}
                  </section>
                );
              })}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">Nenhum quadro encontrado.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
