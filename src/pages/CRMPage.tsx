import { AppLayout } from "@/components/app/AppLayout";
import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import {
  TrendingUp,
  DollarSign,
  Target,
  Users,
  ArrowUpRight,
  ArrowDownRight,
  ArrowRight,
  Star,
  CheckCircle2,
  Clock,
  Plus,
  Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { LeadDetailSheet } from "@/components/app/LeadDetailSheet";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useGlobalFilters } from "@/hooks/useGlobalFilters";
import { matchesSelectedCompany, matchesSelectedCompetence, normalizeCompetence } from "@/lib/globalFilters";
import { useAuth } from "@/hooks/useAuth";
import { addHistoryEntry, getEntityHistory, type ChangeHistoryEntry } from "@/lib/changeHistory";

const stageOrder = [
  "Oportunidade Nova",
  "Contato Iniciado",
  "Diagnostico",
  "Reuniao Agendada",
  "Proposta Enviada",
  "Negociacao",
  "Fechado Ganho",
  "Fechado Perdido",
] as const;

type PipelineStage = (typeof stageOrder)[number];

interface Lead {
  id: string;
  name: string;
  contact: string;
  value: string;
  stage: PipelineStage;
  daysInStage: number;
  competence: string;
  source?: string;
}

const initialLeads: Lead[] = [
  { id: "lead-alpha", name: "Empresa Alpha", contact: "Roberto Dias", value: "R$ 3.500/mes", stage: "Proposta Enviada", daysInStage: 3, competence: "2026-03", source: "Indicacao" },
  { id: "lead-beta", name: "Beta Servicos", contact: "Juliana Melo", value: "R$ 2.800/mes", stage: "Reuniao Agendada", daysInStage: 1, competence: "2026-03", source: "Site" },
  { id: "lead-gamma", name: "Gamma Tech", contact: "Felipe Rocha", value: "R$ 5.200/mes", stage: "Negociacao", daysInStage: 5, competence: "2026-03", source: "Outbound" },
  { id: "lead-delta", name: "Delta Corp", contact: "Camila Souza", value: "R$ 1.900/mes", stage: "Diagnostico", daysInStage: 2, competence: "2026-02", source: "Site" },
  { id: "lead-epsilon", name: "Epsilon Ltda", contact: "Andre Lima", value: "R$ 4.100/mes", stage: "Oportunidade Nova", daysInStage: 0, competence: "2026-02", source: "Indicacao" },
  { id: "lead-nova-solar", name: "Nova Solar", contact: "Bianca Prado", value: "R$ 3.250/mes", stage: "Fechado Ganho", daysInStage: 0, competence: "2026-03", source: "Site" },
  { id: "lead-conecta-food", name: "Conecta Food", contact: "Marcos Vieira", value: "R$ 2.350/mes", stage: "Fechado Perdido", daysInStage: 0, competence: "2026-01", source: "Outbound" },
];

const stageColors: Record<PipelineStage, string> = {
  "Oportunidade Nova": "bg-muted-foreground",
  "Contato Iniciado": "bg-primary/60",
  Diagnostico: "bg-primary",
  "Reuniao Agendada": "bg-amber-500",
  "Proposta Enviada": "bg-blue-500",
  Negociacao: "bg-purple-500",
  "Fechado Ganho": "bg-emerald-500",
  "Fechado Perdido": "bg-destructive/60",
};

const toCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(value);

const parseCurrency = (value: string) => {
  const numeric = value
    .replace(/[^\d,.-]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const parsed = Number(numeric);
  return Number.isFinite(parsed) ? parsed : 0;
};

const isOpenStage = (stage: PipelineStage) => stage !== "Fechado Ganho" && stage !== "Fechado Perdido";
const createLeadId = () => `lead-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export default function CRMPage() {
  const { user } = useAuth();
  const { selectedCompany, selectedCompetence } = useGlobalFilters();
  const [leads, setLeads] = useState<Lead[]>(initialLeads);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [activeStageFilter, setActiveStageFilter] = useState<PipelineStage | "all">("all");
  const [historyVersion, setHistoryVersion] = useState(0);
  const [selectedLeadHistory, setSelectedLeadHistory] = useState<ChangeHistoryEntry[]>([]);
  const [newLead, setNewLead] = useState({
    name: "",
    contact: "",
    value: "",
    stage: "Oportunidade Nova" as PipelineStage,
    competence: normalizeCompetence(new Date().toISOString()) || "2026-03",
  });

  const actorLabel = user?.email || "Usuario";

  const registerLeadHistory = (leadId: string, action: string, details?: string) => {
    if (!user?.id) return;
    addHistoryEntry(user.id, {
      entityType: "crm",
      entityId: leadId,
      action,
      details,
      actor: actorLabel,
    });
    setHistoryVersion((prev) => prev + 1);
  };

  useEffect(() => {
    setNewLead((prev) => ({
      ...prev,
      name: selectedCompany && !prev.name ? selectedCompany : prev.name,
      competence: selectedCompetence || prev.competence,
    }));
  }, [selectedCompany, selectedCompetence]);

  const scopedLeads = useMemo(
    () =>
      leads.filter(
        (lead) =>
          matchesSelectedCompany(lead.name, selectedCompany) &&
          matchesSelectedCompetence(lead.competence, selectedCompetence)
      ),
    [leads, selectedCompany, selectedCompetence]
  );

  const filteredLeads = useMemo(
    () =>
      activeStageFilter === "all"
        ? scopedLeads
        : scopedLeads.filter((lead) => lead.stage === activeStageFilter),
    [scopedLeads, activeStageFilter]
  );

  useEffect(() => {
    if (!user?.id || !selectedLead?.id) {
      setSelectedLeadHistory([]);
      return;
    }

    setSelectedLeadHistory(getEntityHistory(user.id, "crm", selectedLead.id, 12));
  }, [historyVersion, selectedLead?.id, user?.id]);

  const metrics = useMemo(() => {
    const allLeadsByValue = scopedLeads.map((lead) => ({ ...lead, amount: parseCurrency(lead.value) }));
    const valueByLead = filteredLeads.map((lead) => ({ ...lead, amount: parseCurrency(lead.value) }));
    const openLeads = valueByLead.filter((lead) => isOpenStage(lead.stage));
    const wonLeads = valueByLead.filter((lead) => lead.stage === "Fechado Ganho");
    const lostLeads = valueByLead.filter((lead) => lead.stage === "Fechado Perdido");
    const proposalLeads = valueByLead.filter(
      (lead) => lead.stage === "Proposta Enviada" || lead.stage === "Negociacao"
    );

    const openRevenue = openLeads.reduce((sum, lead) => sum + lead.amount, 0);
    const wonRevenue = wonLeads.reduce((sum, lead) => sum + lead.amount, 0);
    const avgTicket = valueByLead.length > 0 ? valueByLead.reduce((sum, lead) => sum + lead.amount, 0) / valueByLead.length : 0;
    const closedTotal = wonLeads.length + lostLeads.length;
    const conversionRate = closedTotal > 0 ? Math.round((wonLeads.length / closedTotal) * 100) : 0;
    const avgDaysInStage =
      openLeads.length > 0
        ? Math.round(openLeads.reduce((sum, lead) => sum + lead.daysInStage, 0) / openLeads.length)
        : 0;

    const goals = [
      {
        label: "Meta de receita ganha",
        current: wonRevenue,
        target: 25000,
        pct: Math.min(100, Math.round((wonRevenue / 25000) * 100)),
      },
      {
        label: "Meta de negociacoes ganhas",
        current: wonLeads.length,
        target: 8,
        pct: Math.min(100, Math.round((wonLeads.length / 8) * 100)),
      },
      {
        label: "Meta de conversao",
        current: conversionRate,
        target: 40,
        pct: Math.min(100, Math.round((conversionRate / 40) * 100)),
      },
    ];

    const stageStats = stageOrder.map((stage) => {
      const items = allLeadsByValue.filter((lead) => lead.stage === stage);
      const amount = items.reduce((sum, lead) => sum + lead.amount, 0);
      return { stage, count: items.length, amount };
    });

    const topNegotiations = [...valueByLead]
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);

    return {
      openLeads,
      wonLeads,
      lostLeads,
      proposalLeads,
      openRevenue,
      wonRevenue,
      avgTicket,
      conversionRate,
      avgDaysInStage,
      goals,
      stageStats,
      topNegotiations,
      filteredCount: valueByLead.length,
      totalCount: allLeadsByValue.length,
    };
  }, [scopedLeads, filteredLeads]);

  const stageSummary = metrics.stageStats.map((item) => ({
    label: item.stage,
    count: item.count,
    color: stageColors[item.stage],
  }));
  const hasActiveFilter = activeStageFilter !== "all";

  const salesMetrics = [
    {
      label: "Pipeline ativo",
      value: toCurrency(metrics.openRevenue),
      change: `${metrics.openLeads.length} negociacoes`,
      trend: "up" as const,
      icon: DollarSign,
    },
    {
      label: "Fechados com ganho",
      value: String(metrics.wonLeads.length),
      change: `${metrics.conversionRate}% conversao`,
      trend: metrics.conversionRate >= 40 ? ("up" as const) : ("down" as const),
      icon: CheckCircle2,
    },
    {
      label: "Ticket medio",
      value: toCurrency(metrics.avgTicket),
      change: `${metrics.avgDaysInStage} dias em media`,
      trend: "up" as const,
      icon: TrendingUp,
    },
    {
      label: "Propostas em andamento",
      value: String(metrics.proposalLeads.length),
      change: `${metrics.lostLeads.length} perdidas`,
      trend: metrics.proposalLeads.length >= metrics.lostLeads.length ? ("up" as const) : ("down" as const),
      icon: Clock,
    },
  ];

  const handleStageChange = (leadId: string, newStage: string) => {
    const stage = newStage as PipelineStage;
    const lead = leads.find((item) => item.id === leadId);
    if (!lead || lead.stage === stage) return;

    if (stage === "Fechado Perdido") {
      const confirmed = window.confirm(
        `Confirmar mudanca para "Fechado Perdido" na negociacao "${lead.name}"?`,
      );
      if (!confirmed) return;
    }

    const previousStage = lead.stage;
    setLeads((prev) => prev.map((item) => (item.id === leadId ? { ...item, stage, daysInStage: 0 } : item)));
    setSelectedLead((prev) => (prev && prev.id === leadId ? { ...prev, stage, daysInStage: 0 } : prev));
    registerLeadHistory(leadId, "Etapa alterada", `${previousStage} -> ${stage}`);

    toast.success(`Negociacao movida para "${newStage}"`, {
      action: {
        label: "Desfazer",
        onClick: () => {
          setLeads((prev) =>
            prev.map((item) => (item.id === leadId ? { ...item, stage: previousStage } : item)),
          );
          setSelectedLead((prev) =>
            prev && prev.id === leadId ? { ...prev, stage: previousStage } : prev,
          );
          registerLeadHistory(leadId, "Alteracao de etapa desfeita", `${stage} -> ${previousStage}`);
        },
      },
    });
  };

  const handleCreate = () => {
    if (!newLead.name.trim()) {
      toast.error("Nome e obrigatorio");
      return;
    }

    if (!newLead.value.trim()) {
      toast.error("Informe o valor estimado");
      return;
    }

    const createdLead: Lead = {
      id: createLeadId(),
      ...newLead,
      daysInStage: 0,
    };

    setLeads((prev) => [createdLead, ...prev]);
    registerLeadHistory(createdLead.id, "Negociacao criada", createdLead.name);
    setCreateOpen(false);
    setNewLead({
      name: selectedCompany || "",
      contact: "",
      value: "",
      stage: "Oportunidade Nova",
      competence: selectedCompetence || normalizeCompetence(new Date().toISOString()) || "2026-03",
    });
    toast.success("Negociacao cadastrada com sucesso");
  };

  const handleDeleteLead = (leadId: string) => {
    const lead = leads.find((item) => item.id === leadId);
    if (!lead) return;

    const confirmed = window.confirm(`Excluir a negociacao "${lead.name}"?`);
    if (!confirmed) return;

    setLeads((prev) => prev.filter((item) => item.id !== leadId));
    setSelectedLead((prev) => (prev?.id === leadId ? null : prev));
    setSheetOpen(false);
    registerLeadHistory(leadId, "Negociacao excluida", lead.name);

    toast.success("Negociacao excluida", {
      action: {
        label: "Desfazer",
        onClick: () => {
          setLeads((prev) => [lead, ...prev]);
          registerLeadHistory(leadId, "Exclusao desfeita", lead.name);
          toast.success("Negociacao restaurada");
        },
      },
    });
  };

  return (
    <AppLayout>
      <div className="space-y-6 max-w-7xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-heading text-2xl font-bold">CRM</h1>
            <p className="text-sm text-muted-foreground">Controle de negociacoes e pipeline comercial</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setActiveStageFilter("all")}
              disabled={!hasActiveFilter}
            >
              <Filter className="h-4 w-4 mr-1" /> Limpar filtro
            </Button>
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> Nova Negociacao
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {salesMetrics.map((metric, index) => (
            <motion.div
              key={metric.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.06 }}
              className="rounded-xl border bg-card p-5"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground">{metric.label}</span>
                <span
                  className={`text-xs font-medium flex items-center gap-0.5 ${
                    metric.trend === "up" ? "text-primary" : "text-destructive"
                  }`}
                >
                  {metric.trend === "up" ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                  {metric.change}
                </span>
              </div>
              <div className="font-heading text-2xl font-bold">{metric.value}</div>
            </motion.div>
          ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="rounded-xl border bg-card p-5">
            <h2 className="font-heading font-semibold mb-4 flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" /> Metas do mes
            </h2>
            <div className="space-y-5">
              {metrics.goals.map((goal) => (
                <div key={goal.label}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm">{goal.label}</span>
                    <span className="text-sm font-semibold">{goal.pct}%</span>
                  </div>
                  <Progress value={goal.pct} className="h-2" />
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-2 rounded-xl border bg-card">
            <div className="p-5 border-b flex items-center justify-between">
              <h2 className="font-heading font-semibold">Top negociacoes por valor</h2>
              <Button variant="ghost" size="sm" className="gap-1 text-xs">
                {metrics.filteredCount}/{metrics.totalCount} <ArrowRight className="h-3 w-3" />
              </Button>
            </div>
            <div className="divide-y">
              {metrics.topNegotiations.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  Nenhuma negociacao encontrada para o filtro selecionado.
                </div>
              ) : (
                metrics.topNegotiations.map((lead, index) => (
                  <div
                    key={lead.id}
                    className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors cursor-pointer"
                    onClick={() => {
                      setSelectedLead(lead);
                      setSheetOpen(true);
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                        {index + 1}
                      </div>
                      <div>
                        <div className="text-sm font-medium">{lead.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {lead.contact} - {lead.stage}
                        </div>
                      </div>
                    </div>
                    <span className="text-sm font-semibold">{toCurrency(parseCurrency(lead.value))}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-heading font-semibold">Pipeline de negociacoes</h2>
            {hasActiveFilter && (
              <span className="text-xs text-primary font-medium">
                Filtro ativo: {activeStageFilter}
              </span>
            )}
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {stageSummary.map((stage, index) => (
              <motion.div
                key={stage.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className={cn(
                  "rounded-xl border bg-card p-5 hover:shadow-md transition-all relative cursor-pointer",
                  activeStageFilter === stage.label && "border-primary bg-primary/5 shadow-md"
                )}
                onClick={() =>
                  setActiveStageFilter((prev) => (prev === stage.label ? "all" : stage.label))
                }
              >
                {(stage.label === "Negociacao" || stage.label === "Proposta Enviada") && (
                  <Badge className="absolute top-3 right-3 bg-primary/10 text-primary border-0 gap-1">
                    <Star className="h-3 w-3" /> Quente
                  </Badge>
                )}
                <div className={`h-10 w-10 rounded-lg ${stage.color} flex items-center justify-center mb-3`}>
                  <Users className="h-5 w-5 text-white" />
                </div>
                <h3 className="font-medium">{stage.label}</h3>
                <p className="text-xs text-muted-foreground mt-1">{stage.count} negociacao(oes)</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      <LeadDetailSheet
        lead={selectedLead}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onStageChange={handleStageChange}
        onDeleteLead={handleDeleteLead}
        historyEntries={selectedLeadHistory}
      />

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nova Negociacao</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Empresa *</Label>
              <Input
                placeholder="Nome da empresa"
                value={newLead.name}
                onChange={(event) => setNewLead((prev) => ({ ...prev, name: event.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Contato</Label>
                <Input
                  placeholder="Nome do contato"
                  value={newLead.contact}
                  onChange={(event) => setNewLead((prev) => ({ ...prev, contact: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Valor estimado</Label>
                <Input
                  placeholder="R$ 0,00/mes"
                  value={newLead.value}
                  onChange={(event) => setNewLead((prev) => ({ ...prev, value: event.target.value }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreate}>Cadastrar Negociacao</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
