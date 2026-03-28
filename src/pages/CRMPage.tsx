import { AppLayout } from "@/components/app/AppLayout";
import { motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useState } from "react";
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
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { LeadDetailSheet } from "@/components/app/LeadDetailSheet";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useGlobalFilters } from "@/hooks/useGlobalFilters";
import { matchesSelectedCompany, matchesSelectedCompetence, normalizeCompetence } from "@/lib/globalFilters";
import { useAuth } from "@/hooks/useAuth";
import { addHistoryEntry, getEntityHistory, type ChangeHistoryEntry } from "@/lib/changeHistory";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { SITE_LEAD_TAG, isSiteLeadSource } from "@/lib/siteLeadCapture";

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
  email: string;
  phone: string;
  value: string;
  stage: PipelineStage;
  daysInStage: number;
  competence: string;
  source: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

interface LeadFormState {
  name: string;
  contact: string;
  email: string;
  phone: string;
  value: string;
  stage: PipelineStage;
  competence: string;
  source: string;
  notes: string;
}

interface CrmGoals {
  wonRevenue: number;
  wonDeals: number;
  conversionRate: number;
}

interface GoalFormState {
  wonRevenue: string;
  wonDeals: string;
  conversionRate: string;
}

type SiteLeadRow = Tables<"site_leads">;

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

const parseNumericInput = (value: string) => {
  const sanitized = value.replace(/[^\d,.-]/g, "").trim();
  if (!sanitized) return Number.NaN;

  const normalized = sanitized.includes(",")
    ? sanitized.replace(/\./g, "").replace(",", ".")
    : sanitized;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
};

const isOpenStage = (stage: PipelineStage) => stage !== "Fechado Ganho" && stage !== "Fechado Perdido";
const createLeadId = () => `lead-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const getCurrentCompetence = () => normalizeCompetence(new Date().toISOString()) || "2026-03";
const buildLeadStorageKey = (userId: string) => `grow-crm-leads-${userId}`;
const buildGoalStorageKey = (userId: string) => `grow-crm-goals-${userId}`;
const siteLeadPrefix = "site-lead-";
const buildSiteLeadId = (siteLeadId: string) => `${siteLeadPrefix}${siteLeadId}`;
const extractSiteLeadId = (leadId: string) =>
  leadId.startsWith(siteLeadPrefix) ? leadId.slice(siteLeadPrefix.length) : null;

const defaultGoals: CrmGoals = {
  wonRevenue: 25000,
  wonDeals: 8,
  conversionRate: 40,
};

const createGoalFormState = (goals: CrmGoals): GoalFormState => ({
  wonRevenue: String(goals.wonRevenue),
  wonDeals: String(goals.wonDeals),
  conversionRate: String(goals.conversionRate),
});

const normalizeStage = (value: unknown): PipelineStage => {
  if (typeof value !== "string") return "Oportunidade Nova";
  if (stageOrder.includes(value as PipelineStage)) return value as PipelineStage;
  return "Oportunidade Nova";
};

const createEmptyLeadForm = (selectedCompetence?: string | null): LeadFormState => ({
  name: "",
  contact: "",
  email: "",
  phone: "",
  value: "",
  stage: "Oportunidade Nova",
  competence: normalizeCompetence(selectedCompetence) || getCurrentCompetence(),
  source: "Site",
  notes: "",
});

const sanitizeLead = (value: unknown): Lead | null => {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;

  const id = String(raw.id || "").trim();
  const name = String(raw.name || "").trim();
  if (!id || !name) return null;

  const competence = normalizeCompetence(raw.competence ? String(raw.competence) : null) || getCurrentCompetence();
  const amount = parseCurrency(String(raw.value || "0"));
  const createdAt = raw.createdAt ? String(raw.createdAt) : new Date().toISOString();
  const updatedAt = raw.updatedAt ? String(raw.updatedAt) : createdAt;

  return {
    id,
    name,
    contact: String(raw.contact || "").trim(),
    email: String(raw.email || "").trim(),
    phone: String(raw.phone || "").trim(),
    value: toCurrency(amount),
    stage: normalizeStage(raw.stage),
    daysInStage: Math.max(0, Number(raw.daysInStage) || 0),
    competence,
    source: String(raw.source || "").trim(),
    notes: String(raw.notes || "").trim(),
    createdAt,
    updatedAt,
  };
};

const sanitizeGoalValue = (value: unknown, fallback: number) => {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return value;
  if (typeof value === "string") {
    const parsed = parseNumericInput(value);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return fallback;
};

const sanitizeGoals = (value: unknown): CrmGoals => {
  if (!value || typeof value !== "object") return defaultGoals;
  const raw = value as Record<string, unknown>;

  const wonRevenue = Math.round(sanitizeGoalValue(raw.wonRevenue, defaultGoals.wonRevenue));
  const wonDeals = Math.max(1, Math.round(sanitizeGoalValue(raw.wonDeals, defaultGoals.wonDeals)));
  const conversionRate = Math.min(
    100,
    Math.max(1, Math.round(sanitizeGoalValue(raw.conversionRate, defaultGoals.conversionRate))),
  );

  return { wonRevenue, wonDeals, conversionRate };
};

const readStoredGoals = (userId: string): CrmGoals => {
  if (!userId) return defaultGoals;
  const raw = localStorage.getItem(buildGoalStorageKey(userId));
  if (!raw) return defaultGoals;

  try {
    const parsed: unknown = JSON.parse(raw);
    return sanitizeGoals(parsed);
  } catch {
    return defaultGoals;
  }
};

const readStoredLeads = (userId: string): Lead[] => {
  if (!userId) return [];
  const raw = localStorage.getItem(buildLeadStorageKey(userId));
  if (!raw) return [];

  try {
    const parsed: unknown = JSON.parse(raw);
    const payload = Array.isArray(parsed)
      ? parsed
      : parsed &&
          typeof parsed === "object" &&
          Array.isArray((parsed as { leads?: unknown[] }).leads)
        ? ((parsed as { leads?: unknown[] }).leads || [])
        : [];

    return payload
      .map((item) => sanitizeLead(item))
      .filter((item): item is Lead => Boolean(item))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } catch {
    return [];
  }
};

const mapSiteLeadToLead = (siteLead: SiteLeadRow): Lead => {
  const createdAt = siteLead.created_at;
  const createdTimestamp = new Date(createdAt).getTime();
  const daysInStage =
    Number.isNaN(createdTimestamp) ? 0 : Math.max(0, Math.floor((Date.now() - createdTimestamp) / 86400000));
  const competence = normalizeCompetence(createdAt) || getCurrentCompetence();
  const source = siteLead.source_tag || SITE_LEAD_TAG;
  const normalizedCompany = (siteLead.company_name || "").trim();
  const normalizedName = (siteLead.full_name || "").trim();
  const normalizedPhone = (siteLead.phone || "").trim();
  const normalizedMessage = (siteLead.message || "").trim();
  const notesParts = [
    siteLead.origin_page ? `Lead captado pelo site (${siteLead.origin_page}).` : "Lead captado pelo site.",
    normalizedPhone ? `Telefone informado: ${normalizedPhone}` : "",
    normalizedMessage ? `Mensagem: ${normalizedMessage}` : "",
  ].filter(Boolean);

  return {
    id: buildSiteLeadId(siteLead.id),
    name: normalizedCompany || normalizedName || "Lead captado via site",
    contact: normalizedName,
    email: siteLead.email,
    phone: normalizedPhone,
    value: toCurrency(0),
    stage: "Oportunidade Nova",
    daysInStage,
    competence,
    source,
    notes: notesParts.join("\n"),
    createdAt,
    updatedAt: createdAt,
  };
};

export default function CRMPage() {
  const { user } = useAuth();
  const { selectedCompany, selectedCompetence } = useGlobalFilters();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loadingLeads, setLoadingLeads] = useState(true);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [goalsDialogOpen, setGoalsDialogOpen] = useState(false);
  const [editingLeadId, setEditingLeadId] = useState<string | null>(null);
  const [leadForm, setLeadForm] = useState<LeadFormState>(createEmptyLeadForm());
  const [crmGoals, setCrmGoals] = useState<CrmGoals>(defaultGoals);
  const [goalForm, setGoalForm] = useState<GoalFormState>(createGoalFormState(defaultGoals));
  const [activeStageFilter, setActiveStageFilter] = useState<PipelineStage | "all">("all");
  const [historyVersion, setHistoryVersion] = useState(0);
  const [selectedLeadHistory, setSelectedLeadHistory] = useState<ChangeHistoryEntry[]>([]);

  const actorLabel = user?.email || "Usuario";
  const isEditing = Boolean(editingLeadId);

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
    if (!user?.id) {
      setCrmGoals(defaultGoals);
      setGoalForm(createGoalFormState(defaultGoals));
      return;
    }

    const storedGoals = readStoredGoals(user.id);
    setCrmGoals(storedGoals);
    setGoalForm(createGoalFormState(storedGoals));
  }, [user?.id]);

  const loadLeadsFromSources = useCallback(async (showLoader = false) => {
    if (!user?.id) {
      setLeads([]);
      setLoadingLeads(false);
      return;
    }

    if (showLoader) {
      setLoadingLeads(true);
    }

    const storedLeads = readStoredLeads(user.id);
    const { data, error } = await supabase
      .from("site_leads")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      setLeads(storedLeads);
      if (showLoader) {
        setLoadingLeads(false);
        toast.error(`Nao foi possivel carregar leads do site: ${error.message}`);
      }
      return;
    }

    const siteLeads = ((data || []) as SiteLeadRow[]).map(mapSiteLeadToLead);
    const mergedLeadsMap = new Map<string, Lead>();

    siteLeads.forEach((lead) => {
      mergedLeadsMap.set(lead.id, lead);
    });

    storedLeads.forEach((lead) => {
      mergedLeadsMap.set(lead.id, lead);
    });

    const mergedLeads = Array.from(mergedLeadsMap.values()).sort((a, b) =>
      b.updatedAt.localeCompare(a.updatedAt),
    );

    setLeads(mergedLeads);

    if (showLoader) {
      setLoadingLeads(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) {
      setLeads([]);
      setLoadingLeads(false);
      return;
    }

    void loadLeadsFromSources(true);

    const intervalId = window.setInterval(() => {
      void loadLeadsFromSources(false);
    }, 15000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [loadLeadsFromSources, user?.id]);

  useEffect(() => {
    if (!user?.id || loadingLeads) return;
    localStorage.setItem(buildLeadStorageKey(user.id), JSON.stringify(leads));
  }, [leads, loadingLeads, user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    localStorage.setItem(buildGoalStorageKey(user.id), JSON.stringify(crmGoals));
  }, [crmGoals, user?.id]);

  useEffect(() => {
    if (!selectedLead?.id) return;
    const freshLead = leads.find((lead) => lead.id === selectedLead.id);
    if (!freshLead) {
      setSelectedLead(null);
      setSheetOpen(false);
      return;
    }
    if (freshLead !== selectedLead) {
      setSelectedLead(freshLead);
    }
  }, [leads, selectedLead]);

  useEffect(() => {
    if (!user?.id || !selectedLead?.id) {
      setSelectedLeadHistory([]);
      return;
    }

    setSelectedLeadHistory(getEntityHistory(user.id, "crm", selectedLead.id, 12));
  }, [historyVersion, selectedLead?.id, user?.id]);

  const scopedLeads = useMemo(
    () =>
      leads.filter(
        (lead) =>
          matchesSelectedCompany(lead.name, selectedCompany) &&
          matchesSelectedCompetence(lead.competence, selectedCompetence),
      ),
    [leads, selectedCompany, selectedCompetence],
  );

  const filteredLeads = useMemo(
    () =>
      activeStageFilter === "all"
        ? scopedLeads
        : scopedLeads.filter((lead) => lead.stage === activeStageFilter),
    [scopedLeads, activeStageFilter],
  );

  const metrics = useMemo(() => {
    const allLeadsByValue = scopedLeads.map((lead) => ({ ...lead, amount: parseCurrency(lead.value) }));
    const valueByLead = filteredLeads.map((lead) => ({ ...lead, amount: parseCurrency(lead.value) }));
    const openLeads = valueByLead.filter((lead) => isOpenStage(lead.stage));
    const wonLeads = valueByLead.filter((lead) => lead.stage === "Fechado Ganho");
    const lostLeads = valueByLead.filter((lead) => lead.stage === "Fechado Perdido");
    const proposalLeads = valueByLead.filter(
      (lead) => lead.stage === "Proposta Enviada" || lead.stage === "Negociacao",
    );

    const openRevenue = openLeads.reduce((sum, lead) => sum + lead.amount, 0);
    const wonRevenue = wonLeads.reduce((sum, lead) => sum + lead.amount, 0);
    const avgTicket =
      valueByLead.length > 0
        ? valueByLead.reduce((sum, lead) => sum + lead.amount, 0) / valueByLead.length
        : 0;
    const closedTotal = wonLeads.length + lostLeads.length;
    const conversionRate = closedTotal > 0 ? Math.round((wonLeads.length / closedTotal) * 100) : 0;
    const avgDaysInStage =
      openLeads.length > 0
        ? Math.round(openLeads.reduce((sum, lead) => sum + lead.daysInStage, 0) / openLeads.length)
        : 0;

    const goals = [
      {
        label: "Meta de receita ganha",
        targetLabel: toCurrency(crmGoals.wonRevenue),
        currentLabel: toCurrency(wonRevenue),
        pct:
          crmGoals.wonRevenue > 0
            ? Math.min(100, Math.round((wonRevenue / crmGoals.wonRevenue) * 100))
            : 0,
      },
      {
        label: "Meta de negociacoes ganhas",
        targetLabel: String(crmGoals.wonDeals),
        currentLabel: String(wonLeads.length),
        pct:
          crmGoals.wonDeals > 0
            ? Math.min(100, Math.round((wonLeads.length / crmGoals.wonDeals) * 100))
            : 0,
      },
      {
        label: "Meta de conversao",
        targetLabel: `${crmGoals.conversionRate}%`,
        currentLabel: `${conversionRate}%`,
        pct:
          crmGoals.conversionRate > 0
            ? Math.min(100, Math.round((conversionRate / crmGoals.conversionRate) * 100))
            : 0,
      },
    ];

    const stageStats = stageOrder.map((stage) => {
      const items = allLeadsByValue.filter((lead) => lead.stage === stage);
      const amount = items.reduce((sum, lead) => sum + lead.amount, 0);
      return { stage, count: items.length, amount };
    });

    const topNegotiations = [...valueByLead].sort((a, b) => b.amount - a.amount).slice(0, 5);

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
  }, [crmGoals, filteredLeads, scopedLeads]);

  const stageSummary = metrics.stageStats.map((item) => ({
    label: item.stage,
    count: item.count,
    color: stageColors[item.stage],
  }));
  const hasActiveFilter = activeStageFilter !== "all";
  const siteCapturedLeads = useMemo(
    () => filteredLeads.filter((lead) => isSiteLeadSource(lead.source)).slice(0, 8),
    [filteredLeads],
  );

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

  const openGoalsDialog = () => {
    setGoalForm(createGoalFormState(crmGoals));
    setGoalsDialogOpen(true);
  };

  const handleSaveGoals = () => {
    const wonRevenue = parseNumericInput(goalForm.wonRevenue);
    const wonDeals = parseNumericInput(goalForm.wonDeals);
    const conversionRate = parseNumericInput(goalForm.conversionRate);

    if (!Number.isFinite(wonRevenue) || wonRevenue <= 0) {
      toast.error("Informe uma meta de receita valida.");
      return;
    }

    if (!Number.isFinite(wonDeals) || wonDeals <= 0) {
      toast.error("Informe uma meta valida para negociacoes ganhas.");
      return;
    }

    if (!Number.isFinite(conversionRate) || conversionRate <= 0 || conversionRate > 100) {
      toast.error("A meta de conversao deve ficar entre 1% e 100%.");
      return;
    }

    const nextGoals: CrmGoals = {
      wonRevenue: Math.round(wonRevenue),
      wonDeals: Math.max(1, Math.round(wonDeals)),
      conversionRate: Math.round(conversionRate),
    };

    setCrmGoals(nextGoals);
    setGoalForm(createGoalFormState(nextGoals));
    setGoalsDialogOpen(false);
    toast.success("Metas do CRM atualizadas.");
  };

  const openCreateDialog = () => {
    setEditingLeadId(null);
    setLeadForm(createEmptyLeadForm(selectedCompetence));
    setFormOpen(true);
  };

  const openEditDialog = (leadId: string) => {
    const lead = leads.find((item) => item.id === leadId);
    if (!lead) return;

    setEditingLeadId(lead.id);
    setLeadForm({
      name: lead.name,
      contact: lead.contact,
      email: lead.email,
      phone: lead.phone,
      value: lead.value,
      stage: lead.stage,
      competence: lead.competence,
      source: lead.source,
      notes: lead.notes,
    });
    setFormOpen(true);
  };

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
    const previousDaysInStage = lead.daysInStage;

    setLeads((prev) =>
      prev.map((item) =>
        item.id === leadId
          ? { ...item, stage, daysInStage: 0, updatedAt: new Date().toISOString() }
          : item,
      ),
    );
    registerLeadHistory(leadId, "Etapa alterada", `${previousStage} -> ${stage}`);

    toast.success(`Negociacao movida para "${newStage}"`, {
      action: {
        label: "Desfazer",
        onClick: () => {
          setLeads((prev) =>
            prev.map((item) =>
              item.id === leadId
                ? { ...item, stage: previousStage, daysInStage: previousDaysInStage, updatedAt: new Date().toISOString() }
                : item,
            ),
          );
          registerLeadHistory(leadId, "Alteracao de etapa desfeita", `${stage} -> ${previousStage}`);
        },
      },
    });
  };

  const handleSaveLead = () => {
    const name = leadForm.name.trim();
    if (!name) {
      toast.error("Nome da empresa e obrigatorio");
      return;
    }

    const amount = parseCurrency(leadForm.value);
    if (amount <= 0) {
      toast.error("Informe um valor estimado valido");
      return;
    }

    const email = leadForm.email.trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("Informe um e-mail valido");
      return;
    }

    const competence = normalizeCompetence(leadForm.competence) || getCurrentCompetence();
    const now = new Date().toISOString();
    const payload = {
      name,
      contact: leadForm.contact.trim(),
      email,
      phone: leadForm.phone.trim(),
      value: toCurrency(amount),
      stage: leadForm.stage,
      competence,
      source: leadForm.source.trim(),
      notes: leadForm.notes.trim(),
      updatedAt: now,
    };

    if (editingLeadId) {
      const previousLead = leads.find((lead) => lead.id === editingLeadId);
      if (!previousLead) {
        toast.error("Negociacao nao encontrada");
        return;
      }

      setLeads((prev) =>
        prev.map((lead) => (lead.id === editingLeadId ? { ...lead, ...payload } : lead)),
      );
      registerLeadHistory(editingLeadId, "Negociacao atualizada", previousLead.name);
      toast.success("Negociacao atualizada com sucesso");
    } else {
      const createdLead: Lead = {
        id: createLeadId(),
        ...payload,
        daysInStage: 0,
        createdAt: now,
      };

      setLeads((prev) => [createdLead, ...prev]);
      registerLeadHistory(createdLead.id, "Negociacao criada", createdLead.name);
      toast.success("Negociacao cadastrada com sucesso");
    }

    setFormOpen(false);
    setEditingLeadId(null);
    setLeadForm(createEmptyLeadForm(selectedCompetence));
  };

  const handleSaveNotes = (leadId: string, notes: string) => {
    const lead = leads.find((item) => item.id === leadId);
    if (!lead) return;

    if ((lead.notes || "") === notes) return;

    setLeads((prev) =>
      prev.map((item) =>
        item.id === leadId ? { ...item, notes, updatedAt: new Date().toISOString() } : item,
      ),
    );
    registerLeadHistory(
      leadId,
      "Observacoes atualizadas",
      notes ? "Observacoes registradas" : "Observacoes removidas",
    );
    toast.success("Observacoes salvas");
  };

  const handleDeleteLead = async (leadId: string) => {
    const lead = leads.find((item) => item.id === leadId);
    if (!lead) return;

    const confirmed = window.confirm(`Excluir a negociacao "${lead.name}"?`);
    if (!confirmed) return;

    const siteLeadId = extractSiteLeadId(leadId);
    if (siteLeadId) {
      const { error } = await supabase.from("site_leads").delete().eq("id", siteLeadId);
      if (error) {
        toast.error(`Nao foi possivel excluir lead captado via site: ${error.message}`);
        return;
      }

      setLeads((prev) => prev.filter((item) => item.id !== leadId));
      setSelectedLead((prev) => (prev?.id === leadId ? null : prev));
      setSheetOpen(false);
      registerLeadHistory(leadId, "Lead captado via site excluido", lead.name);
      toast.success("Lead captado via site excluido");
      return;
    }

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
            <p className="text-sm text-muted-foreground">
              Controle de negociacoes e pipeline comercial ({leads.length} cadastradas)
            </p>
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
            <Button size="sm" onClick={openCreateDialog}>
              <Plus className="h-4 w-4 mr-1" /> Nova Negociacao
            </Button>
          </div>
        </div>

        {loadingLeads ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
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
                <div className="mb-4 flex items-center justify-between gap-2">
                  <h2 className="font-heading font-semibold flex items-center gap-2">
                    <Target className="h-4 w-4 text-primary" /> Metas do mes
                  </h2>
                  <Button variant="outline" size="sm" onClick={openGoalsDialog}>
                    Cadastrar metas
                  </Button>
                </div>
                <div className="space-y-5">
                  {metrics.goals.map((goal) => (
                    <div key={goal.label}>
                      <div className="flex items-start justify-between gap-3 mb-1.5">
                        <span className="text-sm">{goal.label}</span>
                        <div className="text-right">
                          <p className="text-sm font-semibold">{goal.pct}%</p>
                          <p className="text-[11px] text-muted-foreground">
                            {goal.currentLabel} / {goal.targetLabel}
                          </p>
                        </div>
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
                              {lead.contact || "Sem contato"} - {lead.stage}
                            </div>
                            {isSiteLeadSource(lead.source) && (
                              <Badge variant="secondary" className="mt-1 text-[10px]">
                                {SITE_LEAD_TAG}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <span className="text-sm font-semibold">{toCurrency(parseCurrency(lead.value))}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="rounded-xl border bg-card">
              <div className="p-5 border-b">
                <h2 className="font-heading font-semibold">Leads captados via site</h2>
                <p className="text-xs text-muted-foreground mt-1">
                  Novos contatos recebidos pelos formulários institucionais
                </p>
              </div>
              <div className="divide-y">
                {siteCapturedLeads.length === 0 ? (
                  <div className="p-8 text-center text-sm text-muted-foreground">
                    Nenhum lead com origem de captação via site no filtro atual.
                  </div>
                ) : (
                  siteCapturedLeads.map((lead) => (
                    <div
                      key={lead.id}
                      className="p-4 flex items-center justify-between gap-3 hover:bg-muted/30 transition-colors cursor-pointer"
                      onClick={() => {
                        setSelectedLead(lead);
                        setSheetOpen(true);
                      }}
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-medium truncate">{lead.name}</p>
                          <Badge variant="secondary" className="text-[10px]">
                            {SITE_LEAD_TAG}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 truncate">
                          {lead.contact || "Sem contato"} {lead.email ? `- ${lead.email}` : ""}
                        </p>
                      </div>
                      <div className="text-xs text-muted-foreground shrink-0">
                        {new Date(lead.createdAt).toLocaleDateString("pt-BR")}
                      </div>
                    </div>
                  ))
                )}
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
                      activeStageFilter === stage.label && "border-primary bg-primary/5 shadow-md",
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
          </>
        )}
      </div>

      <LeadDetailSheet
        lead={selectedLead}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onStageChange={handleStageChange}
        onDeleteLead={handleDeleteLead}
        onEditLead={openEditDialog}
        onSaveNotes={handleSaveNotes}
        historyEntries={selectedLeadHistory}
      />

      <Dialog
        open={goalsDialogOpen}
        onOpenChange={(open) => {
          setGoalsDialogOpen(open);
          if (!open) {
            setGoalForm(createGoalFormState(crmGoals));
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cadastrar metas do CRM</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Meta de receita ganha (R$)</Label>
              <Input
                inputMode="decimal"
                placeholder="25000"
                value={goalForm.wonRevenue}
                onChange={(event) => setGoalForm((prev) => ({ ...prev, wonRevenue: event.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Meta de negociacoes ganhas</Label>
              <Input
                inputMode="numeric"
                placeholder="8"
                value={goalForm.wonDeals}
                onChange={(event) => setGoalForm((prev) => ({ ...prev, wonDeals: event.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Meta de conversao (%)</Label>
              <Input
                inputMode="decimal"
                placeholder="40"
                value={goalForm.conversionRate}
                onChange={(event) => setGoalForm((prev) => ({ ...prev, conversionRate: event.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setGoalsDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveGoals}>Salvar metas</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) {
            setEditingLeadId(null);
            setLeadForm(createEmptyLeadForm(selectedCompetence));
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{isEditing ? "Editar Negociacao" : "Nova Negociacao"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2 col-span-2 sm:col-span-1">
                <Label>Empresa *</Label>
                <Input
                  placeholder="Nome da empresa"
                  value={leadForm.name}
                  onChange={(event) => setLeadForm((prev) => ({ ...prev, name: event.target.value }))}
                />
              </div>
              <div className="space-y-2 col-span-2 sm:col-span-1">
                <Label>Valor estimado *</Label>
                <Input
                  placeholder="R$ 0,00"
                  value={leadForm.value}
                  onChange={(event) => setLeadForm((prev) => ({ ...prev, value: event.target.value }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2 col-span-2 sm:col-span-1">
                <Label>Contato</Label>
                <Input
                  placeholder="Nome do contato"
                  value={leadForm.contact}
                  onChange={(event) => setLeadForm((prev) => ({ ...prev, contact: event.target.value }))}
                />
              </div>
              <div className="space-y-2 col-span-2 sm:col-span-1">
                <Label>Etapa</Label>
                <select
                  className="w-full text-sm bg-background border rounded-lg px-3 py-2 outline-none"
                  value={leadForm.stage}
                  onChange={(event) =>
                    setLeadForm((prev) => ({ ...prev, stage: event.target.value as PipelineStage }))
                  }
                >
                  {stageOrder.map((stage) => (
                    <option key={stage} value={stage}>
                      {stage}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2 col-span-2 sm:col-span-1">
                <Label>E-mail</Label>
                <Input
                  type="email"
                  placeholder="contato@empresa.com"
                  value={leadForm.email}
                  onChange={(event) => setLeadForm((prev) => ({ ...prev, email: event.target.value }))}
                />
              </div>
              <div className="space-y-2 col-span-2 sm:col-span-1">
                <Label>Telefone</Label>
                <Input
                  placeholder="(00) 00000-0000"
                  value={leadForm.phone}
                  onChange={(event) => setLeadForm((prev) => ({ ...prev, phone: event.target.value }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2 col-span-2 sm:col-span-1">
                <Label>Origem</Label>
                <Input
                  placeholder="Site, Indicacao, Outbound..."
                  value={leadForm.source}
                  onChange={(event) => setLeadForm((prev) => ({ ...prev, source: event.target.value }))}
                />
              </div>
              <div className="space-y-2 col-span-2 sm:col-span-1">
                <Label>Competencia</Label>
                <Input
                  placeholder="AAAA-MM"
                  value={leadForm.competence}
                  onChange={(event) => setLeadForm((prev) => ({ ...prev, competence: event.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Observacoes</Label>
              <Textarea
                placeholder="Contexto da negociacao, proximos passos, pontos de atencao..."
                value={leadForm.notes}
                onChange={(event) => setLeadForm((prev) => ({ ...prev, notes: event.target.value }))}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveLead}>
              {isEditing ? "Salvar alteracoes" : "Cadastrar Negociacao"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
