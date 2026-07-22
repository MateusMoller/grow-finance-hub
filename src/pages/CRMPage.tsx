import { useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, Clock, DollarSign, Filter, Loader2, Plus, Settings2, TrendingUp } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppLayout } from "@/components/app/AppLayout";
import { ModuleContextPill } from "@/components/app/ModuleContextPill";
import { SalesOpportunityDialog, type SalesOpportunityFormState } from "@/components/app/SalesOpportunityDialog";
import { SalesOpportunityDetailSheet } from "@/components/app/SalesOpportunityDetailSheet";
import {
  SalesPipelineSettingsDialog,
  type SalesOfferFormState,
  type SalesStageFormState,
} from "@/components/app/SalesPipelineSettingsDialog";
import { SalesPipelineMetrics } from "@/components/app/SalesPipelineMetrics";
import { SalesPipelineBoard, type SalesPipelineCard, type SalesPipelineStage } from "@/components/app/SalesPipelineBoard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { normalizeCompetence } from "@/lib/globalFilters";
import { recordOperationalAuditLog } from "@/lib/operationalAudit";
import {
  calculateSalesMetrics,
  canManageSalesSettings,
  createSalesAuditMetadata,
  findSalesDuplicateWarnings,
  formatSalesCurrency,
  isLostSalesStage,
  isOpenSalesStage,
  isWonSalesStage,
  normalizeSalesStage,
  parseSalesCurrency,
  validateSalesCatalogSelection,
  type SalesActivityType,
  type SalesCatalogCategory,
  type SalesMetricOpportunity,
  type SalesRecurrenceType,
} from "@/lib/salesPipeline";
import {
  archiveSalesOpportunity,
  createSalesActivity,
  fetchSalesActivities,
  fetchSalesCatalogOffers,
  fetchSalesCommercialLeads,
  fetchSalesClients,
  fetchSalesOpportunities,
  fetchSalesPipelineStages,
  fetchSalesUsers,
  saveSalesOffer,
  saveSalesCommercialLead,
  saveSalesOpportunity,
  saveSalesStage,
  winNewClientOpportunity,
  type SalesCatalogOfferRow,
  type SalesOpportunityRow,
  type SalesPipelineStageRow,
} from "@/lib/salesPipelineData";

const fallbackStageNames = [
  "Oportunidade Nova",
  "Contato Iniciado",
  "Diagnostico",
  "Reuniao Agendada",
  "Proposta Enviada",
  "Negociacao",
  "Fechado Ganho",
  "Fechado Perdido",
] as const;

const saleTypeLabels: Record<SalesCatalogCategory, string> = {
  service: "Servico contabil",
  product: "Produto",
  consulting: "Consultoria",
  automation: "Automacao",
  system: "Sistema",
  other: "Outro",
};

const emptyOpportunityForm = (stage?: SalesPipelineStageRow | null): SalesOpportunityFormState => ({
  title: "",
  clientMode: "existing",
  clientId: "",
  contact: "",
  email: "",
  phone: "",
  saleType: "service",
  offerId: "",
  otherOfferDescription: "",
  estimatedValue: "",
  recurrenceType: "recurring",
  probability: "25",
  stageId: stage?.id || "",
  stage: stage?.name || "Oportunidade Nova",
  status: "active",
  source: "Comercial",
  competence: normalizeCompetence(new Date().toISOString()) || "2026-07",
  expectedCloseDate: "",
  ownerUserId: "",
  notes: "",
  lossReason: "",
});

const emptyStageForm = (position = 1): SalesStageFormState => ({
  name: "",
  position: String(position),
  color: "#4f556f",
  isActive: true,
});

const emptyOfferForm = (): SalesOfferFormState => ({
  name: "",
  category: "service",
  defaultRecurrenceType: "recurring",
  defaultValue: "",
  description: "",
  isActive: true,
});

const mapOfferRow = (offer: SalesCatalogOfferRow) => ({
  id: offer.id,
  name: offer.name,
  category: offer.category,
  defaultRecurrenceType: offer.default_recurrence_type,
  defaultValue: offer.default_value,
  description: offer.description,
  isActive: offer.is_active,
});

const getOpportunityStatus = (opportunity: SalesOpportunityRow): "active" | "won" | "lost" | "archived" => {
  if (opportunity.status) return opportunity.status;
  const stage = normalizeSalesStage(opportunity.stage);
  if (isWonSalesStage(stage)) return "won";
  if (isLostSalesStage(stage)) return "lost";
  return "active";
};

const opportunityToForm = (
  opportunity: SalesOpportunityRow,
  stages: SalesPipelineStageRow[],
): SalesOpportunityFormState => {
  const stage = stages.find((item) => item.id === opportunity.stage_id) || stages.find((item) => item.name === opportunity.stage);

  return {
    id: opportunity.id,
    title: opportunity.name,
    clientMode: opportunity.client_id ? "existing" : "new",
    clientId: opportunity.client_id || "",
    contact: opportunity.contact || "",
    email: opportunity.email || "",
    phone: opportunity.phone || "",
    saleType: opportunity.sale_type || "service",
    offerId: opportunity.offer_id || "",
    otherOfferDescription: opportunity.other_offer_description || "",
    estimatedValue: String(opportunity.estimated_value || ""),
    recurrenceType: opportunity.recurrence_type || "recurring",
    probability: String(opportunity.probability || 0),
    stageId: stage?.id || "",
    stage: stage?.name || opportunity.stage,
    status: getOpportunityStatus(opportunity),
    source: opportunity.source || "",
    competence: opportunity.competence,
    expectedCloseDate: opportunity.expected_close_date || "",
    ownerUserId: opportunity.owner_user_id || "",
    notes: opportunity.notes || "",
    lossReason: opportunity.loss_reason || "",
  };
};

const getDaysSince = (date: string) => {
  const created = new Date(date).getTime();
  if (!Number.isFinite(created)) return 0;
  return Math.max(0, Math.floor((Date.now() - created) / 86_400_000));
};

export default function CRMPage() {
  const queryClient = useQueryClient();
  const { user, currentOrganizationId, role, allRoles, enabledModules, roleLoaded } = useAuth();
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [ownerFilter, setOwnerFilter] = useState("all");
  const [saleTypeFilter, setSaleTypeFilter] = useState("all");
  const [clientFilter, setClientFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedOpportunityId, setSelectedOpportunityId] = useState<string | null>(null);
  const [opportunityForm, setOpportunityForm] = useState<SalesOpportunityFormState>(emptyOpportunityForm());
  const [stageForm, setStageForm] = useState<SalesStageFormState>(emptyStageForm());
  const [offerForm, setOfferForm] = useState<SalesOfferFormState>(emptyOfferForm());
  const [activityTitle, setActivityTitle] = useState("");
  const [activityBody, setActivityBody] = useState("");
  const [activityType, setActivityType] = useState<SalesActivityType>("note");
  const [followUpDate, setFollowUpDate] = useState("");
  const [lossReason, setLossReason] = useState("");

  const canAccessSales = enabledModules.includes("crm") || role === "admin" || role === "manager" || role === "commercial";
  const canManageSettings = canManageSalesSettings(role, allRoles);
  const baseQueryKey = useMemo(() => ["sales-pipeline", currentOrganizationId] as const, [currentOrganizationId]);

  const stagesQuery = useQuery({
    queryKey: [...baseQueryKey, "stages"],
    enabled: Boolean(currentOrganizationId && canAccessSales),
    queryFn: async () => fetchSalesPipelineStages(supabase, currentOrganizationId || ""),
  });

  const offersQuery = useQuery({
    queryKey: [...baseQueryKey, "offers"],
    enabled: Boolean(currentOrganizationId && canAccessSales),
    queryFn: async () => fetchSalesCatalogOffers(supabase, currentOrganizationId || ""),
  });

  const clientsQuery = useQuery({
    queryKey: [...baseQueryKey, "clients"],
    enabled: Boolean(currentOrganizationId && canAccessSales),
    queryFn: async () => fetchSalesClients(supabase, currentOrganizationId || ""),
  });

  const usersQuery = useQuery({
    queryKey: [...baseQueryKey, "users"],
    enabled: Boolean(currentOrganizationId && canAccessSales),
    queryFn: async () => fetchSalesUsers(supabase, currentOrganizationId || ""),
  });

  const commercialLeadsQuery = useQuery({
    queryKey: [...baseQueryKey, "commercial-leads"],
    enabled: Boolean(currentOrganizationId && canAccessSales),
    queryFn: async () => fetchSalesCommercialLeads(supabase, currentOrganizationId || ""),
  });

  const opportunitiesQuery = useQuery({
    queryKey: [...baseQueryKey, "opportunities"],
    enabled: Boolean(currentOrganizationId && canAccessSales),
    queryFn: async () => fetchSalesOpportunities(supabase, currentOrganizationId || ""),
  });

  const activitiesQuery = useQuery({
    queryKey: [...baseQueryKey, "activities", selectedOpportunityId],
    enabled: Boolean(currentOrganizationId && selectedOpportunityId && canAccessSales),
    queryFn: async () => fetchSalesActivities(supabase, currentOrganizationId || "", selectedOpportunityId || ""),
  });

  const stages = useMemo(() => {
    if (stagesQuery.data?.length) return stagesQuery.data;
    return fallbackStageNames.map((name, index) => ({
      id: name,
      organization_id: currentOrganizationId || "local",
      name,
      position: index + 1,
      color: "#4f556f",
      is_won: name === "Fechado Ganho",
      is_lost: name === "Fechado Perdido",
      is_system_default: true,
      is_active: true,
      created_by: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));
  }, [currentOrganizationId, stagesQuery.data]);

  const offers = useMemo(() => (offersQuery.data || []).map(mapOfferRow), [offersQuery.data]);
  const clients = useMemo(() => clientsQuery.data || [], [clientsQuery.data]);
  const commercialLeads = useMemo(() => commercialLeadsQuery.data || [], [commercialLeadsQuery.data]);
  const users = useMemo(() => usersQuery.data || [], [usersQuery.data]);
  const opportunities = useMemo(() => opportunitiesQuery.data || [], [opportunitiesQuery.data]);
  const selectedOpportunity = opportunities.find((item) => item.id === selectedOpportunityId) || null;
  const selectedStage = stages.find((stage) => stage.id === opportunityForm.stageId) || stages[0] || null;

  useEffect(() => {
    if (!selectedOpportunityId) return;
    if (!opportunities.some((item) => item.id === selectedOpportunityId)) {
      setSelectedOpportunityId(null);
      setDetailOpen(false);
    }
  }, [opportunities, selectedOpportunityId]);

  const duplicateWarnings = useMemo(
    () =>
      findSalesDuplicateWarnings(
        {
          email: opportunityForm.email,
          phone: opportunityForm.phone,
        },
        [
          ...clients.map((client) => ({
            id: client.id,
            name: client.name,
            cnpj: client.cnpj,
            email: client.email,
            phone: client.phone,
            source: "client" as const,
          })),
          ...commercialLeads.map((lead) => ({
            id: lead.id,
            name: lead.name,
            email: lead.email,
            phone: lead.phone,
            source: "lead" as const,
          })),
        ],
      ),
    [clients, commercialLeads, opportunityForm.email, opportunityForm.phone],
  );

  const filteredOpportunities = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return opportunities.filter((opportunity) => {
      const status = getOpportunityStatus(opportunity);
      const offer = offers.find((item) => item.id === opportunity.offer_id);
      const client = clients.find((item) => item.id === opportunity.client_id);
      const haystack = [
        opportunity.name,
        opportunity.contact,
        opportunity.email,
        opportunity.phone,
        opportunity.source,
        opportunity.other_offer_description,
        offer?.name,
        client?.name,
        client?.cnpj,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return (
        (!normalizedSearch || haystack.includes(normalizedSearch)) &&
        (stageFilter === "all" || opportunity.stage === stageFilter || opportunity.stage_id === stageFilter) &&
        (statusFilter === "all" || status === statusFilter) &&
        (ownerFilter === "all" || opportunity.owner_user_id === ownerFilter) &&
        (saleTypeFilter === "all" || opportunity.sale_type === saleTypeFilter) &&
        (clientFilter === "all" || opportunity.client_id === clientFilter)
      );
    });
  }, [clients, offers, opportunities, search, stageFilter, statusFilter, ownerFilter, saleTypeFilter, clientFilter]);

  const metricItems = useMemo<SalesMetricOpportunity[]>(
    () =>
      filteredOpportunities.map((opportunity) => ({
        id: opportunity.id,
        stage: normalizeSalesStage(opportunity.stage),
        status: getOpportunityStatus(opportunity),
        estimatedValue: Number(opportunity.estimated_value) || 0,
        recurrenceType: opportunity.recurrence_type || "recurring",
        saleType: opportunity.sale_type || "service",
        offerId: opportunity.offer_id,
        otherOfferDescription: opportunity.other_offer_description,
        daysInStage: getDaysSince(opportunity.updated_at),
      })),
    [filteredOpportunities],
  );

  const metrics = useMemo(() => calculateSalesMetrics(metricItems), [metricItems]);

  const metricCards = useMemo(
    () => [
      {
        label: "Pipeline ativo",
        value: formatSalesCurrency(metrics.activeValue),
        change: `${metrics.activeCount} oportunidades`,
        trend: "up" as const,
        icon: DollarSign,
      },
      {
        label: "Fechadas com ganho",
        value: formatSalesCurrency(metrics.wonValue),
        change: `${metrics.wonCount} ganhas`,
        trend: "up" as const,
        icon: CheckCircle2,
      },
      {
        label: "Conversao",
        value: `${metrics.conversionRate}%`,
        change: `${metrics.lostCount} perdidas`,
        trend: metrics.conversionRate >= 40 ? ("up" as const) : ("down" as const),
        icon: TrendingUp,
      },
      {
        label: "Receita recorrente",
        value: formatSalesCurrency(metrics.recurringValue),
        change: `${formatSalesCurrency(metrics.oneTimeValue)} avulso`,
        trend: "neutral" as const,
        icon: Clock,
      },
    ],
    [metrics],
  );

  const boardStages = useMemo<SalesPipelineStage[]>(
    () =>
      stages
        .filter((stage) => stage.is_active || opportunities.some((opportunity) => opportunity.stage === stage.name || opportunity.stage_id === stage.id))
        .map((stage) => ({
          id: stage.id,
          name: stage.name,
          color: stage.color,
          isActive: stage.is_active,
          opportunities: filteredOpportunities
            .filter((opportunity) => opportunity.stage_id === stage.id || opportunity.stage === stage.name)
            .map((opportunity) => {
              const client = clients.find((item) => item.id === opportunity.client_id);
              const offer = offers.find((item) => item.id === opportunity.offer_id);
              return {
                id: opportunity.id,
                title: opportunity.name,
                contact: opportunity.contact,
                clientName: client?.name || (opportunity.client_id ? "Cliente vinculado" : "Lead comercial"),
                value: Number(opportunity.estimated_value) || 0,
                probability: opportunity.probability,
                expectedCloseDate: opportunity.expected_close_date,
                offerLabel: offer?.name || opportunity.other_offer_description || saleTypeLabels[opportunity.sale_type || "service"],
              } satisfies SalesPipelineCard;
            }),
        })),
    [clients, filteredOpportunities, offers, opportunities, stages],
  );

  const invalidateSales = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: [...baseQueryKey, "opportunities"] }),
      queryClient.invalidateQueries({ queryKey: [...baseQueryKey, "activities"] }),
      queryClient.invalidateQueries({ queryKey: [...baseQueryKey, "offers"] }),
      queryClient.invalidateQueries({ queryKey: [...baseQueryKey, "stages"] }),
      queryClient.invalidateQueries({ queryKey: [...baseQueryKey, "clients"] }),
      queryClient.invalidateQueries({ queryKey: [...baseQueryKey, "commercial-leads"] }),
    ]);
  };

  const saveOpportunityMutation = useMutation({
    mutationFn: async (form: SalesOpportunityFormState) => {
      if (!currentOrganizationId) throw new Error("Organizacao ativa nao encontrada.");
      if (!form.title.trim()) throw new Error("Informe o titulo da oportunidade.");
      if (!validateSalesCatalogSelection({
        offerId: form.offerId || null,
        category: form.saleType,
        otherOfferDescription: form.otherOfferDescription,
      })) {
        throw new Error('Informe a descricao quando a oferta for "Outro".');
      }

      const stage = stages.find((item) => item.id === form.stageId) || selectedStage;
      const commercialLead =
        form.clientMode === "new"
          ? await saveSalesCommercialLead(supabase, {
              id: selectedOpportunity?.commercial_lead_id || null,
              organization_id: currentOrganizationId,
              name: form.title.trim(),
              contact: form.contact.trim() || null,
              email: form.email.trim() || null,
              phone: form.phone.trim() || null,
              source: form.source.trim() || null,
              notes: form.notes.trim() || null,
              created_by: user?.id || null,
            })
          : null;
      const payload = {
        id: form.id,
        organization_id: currentOrganizationId,
        name: form.title.trim(),
        contact: form.contact.trim() || null,
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        estimated_value: parseSalesCurrency(form.estimatedValue),
        client_id: form.clientMode === "existing" && form.clientId ? form.clientId : null,
        commercial_lead_id: commercialLead?.id || null,
        stage_id: stage?.id || null,
        stage: stage?.name || form.stage || "Oportunidade Nova",
        status: form.status,
        sale_type: form.saleType,
        offer_id: form.offerId || null,
        other_offer_description: form.saleType === "other" ? form.otherOfferDescription.trim() : null,
        recurrence_type: form.recurrenceType,
        probability: Math.max(0, Math.min(100, Number(form.probability) || 0)),
        source: form.source.trim() || null,
        competence: normalizeCompetence(form.competence) || form.competence,
        expected_close_date: form.expectedCloseDate || null,
        owner_user_id: form.ownerUserId || null,
        notes: form.notes.trim() || null,
        loss_reason: form.lossReason.trim() || null,
        updated_by: user?.id || null,
        created_by: form.id ? undefined : user?.id || null,
      };

      const saved = await saveSalesOpportunity(supabase, payload);
      await createSalesActivity(supabase, {
        organizationId: currentOrganizationId,
        opportunityId: saved.id,
        actorUserId: user?.id,
        activityType: form.id ? "system" : "note",
        title: form.id ? "Oportunidade atualizada" : "Oportunidade criada",
        body: form.notes || null,
        metadata: createSalesAuditMetadata(form.id ? "sales_opportunity_updated" : "sales_opportunity_created", null, payload),
      });
      await recordOperationalAuditLog({
        organizationId: currentOrganizationId,
        action: form.id ? "sales_opportunity_updated" : "sales_opportunity_created",
        entityType: "crm_leads",
        entityId: saved.id,
        metadata: payload,
      });
      return saved;
    },
    onSuccess: async (saved) => {
      await invalidateSales();
      setSelectedOpportunityId(saved.id);
      setDialogOpen(false);
      toast.success("Oportunidade salva.");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Nao foi possivel salvar a oportunidade."),
  });

  const addActivityMutation = useMutation({
    mutationFn: async () => {
      if (!currentOrganizationId || !selectedOpportunityId) throw new Error("Oportunidade nao selecionada.");
      if (!activityTitle.trim()) throw new Error("Informe o titulo da atividade.");
      return createSalesActivity(supabase, {
        organizationId: currentOrganizationId,
        opportunityId: selectedOpportunityId,
        actorUserId: user?.id,
        activityType,
        title: activityTitle.trim(),
        body: activityBody.trim() || null,
        dueAt: followUpDate || null,
      });
    },
    onSuccess: async () => {
      setActivityTitle("");
      setActivityBody("");
      setFollowUpDate("");
      await invalidateSales();
      toast.success("Atividade registrada.");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Nao foi possivel registrar a atividade."),
  });

  const closeMutation = useMutation({
    mutationFn: async ({ status, reason }: { status: "won" | "lost" | "active"; reason?: string }) => {
      if (!selectedOpportunity || !currentOrganizationId) throw new Error("Oportunidade nao selecionada.");
      if (status === "lost" && !reason?.trim()) throw new Error("Informe o motivo da perda.");
      if (status === "won" && !selectedOpportunity.client_id) {
        const result = await winNewClientOpportunity(supabase, selectedOpportunity.id);
        await recordOperationalAuditLog({
          organizationId: currentOrganizationId,
          action: "sales_opportunity_won_new_client",
          entityType: "crm_leads",
          entityId: selectedOpportunity.id,
          metadata: { result },
        });
        return selectedOpportunity;
      }

      const stage = stages.find((item) =>
        status === "won" ? item.is_won || item.name === "Fechado Ganho" : status === "lost" ? item.is_lost || item.name === "Fechado Perdido" : item.name === "Oportunidade Nova",
      );

      const saved = await saveSalesOpportunity(supabase, {
        id: selectedOpportunity.id,
        organization_id: currentOrganizationId,
        name: selectedOpportunity.name,
        contact: selectedOpportunity.contact,
        email: selectedOpportunity.email,
        phone: selectedOpportunity.phone,
        estimated_value: Number(selectedOpportunity.estimated_value) || 0,
        client_id: selectedOpportunity.client_id,
        commercial_lead_id: selectedOpportunity.commercial_lead_id,
        stage_id: stage?.id || selectedOpportunity.stage_id,
        stage: stage?.name || selectedOpportunity.stage,
        status,
        sale_type: selectedOpportunity.sale_type,
        offer_id: selectedOpportunity.offer_id,
        other_offer_description: selectedOpportunity.other_offer_description,
        recurrence_type: selectedOpportunity.recurrence_type,
        probability: selectedOpportunity.probability,
        source: selectedOpportunity.source,
        competence: selectedOpportunity.competence,
        expected_close_date: selectedOpportunity.expected_close_date,
        owner_user_id: selectedOpportunity.owner_user_id,
        notes: selectedOpportunity.notes,
        loss_reason: status === "lost" ? reason?.trim() || null : null,
        won_at: status === "won" ? new Date().toISOString() : null,
        lost_at: status === "lost" ? new Date().toISOString() : null,
        updated_by: user?.id || null,
      });

      await createSalesActivity(supabase, {
        organizationId: currentOrganizationId,
        opportunityId: selectedOpportunity.id,
        actorUserId: user?.id,
        activityType: "stage_change",
        title: status === "won" ? "Oportunidade ganha" : status === "lost" ? "Oportunidade perdida" : "Oportunidade reaberta",
        body: reason || null,
        metadata: createSalesAuditMetadata("sales_opportunity_status_changed", { status: selectedOpportunity.status }, { status }),
      });

      await recordOperationalAuditLog({
        organizationId: currentOrganizationId,
        action: "sales_opportunity_status_changed",
        entityType: "crm_leads",
        entityId: selectedOpportunity.id,
        metadata: { status, reason },
      });
      return saved;
    },
    onSuccess: async () => {
      setLossReason("");
      await invalidateSales();
      toast.success("Status da oportunidade atualizado.");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Nao foi possivel atualizar o status."),
  });

  const archiveMutation = useMutation({
    mutationFn: async () => {
      if (!selectedOpportunity) throw new Error("Oportunidade nao selecionada.");
      return archiveSalesOpportunity(supabase, selectedOpportunity.id, user?.id);
    },
    onSuccess: async () => {
      setDetailOpen(false);
      setSelectedOpportunityId(null);
      await invalidateSales();
      toast.success("Oportunidade arquivada.");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Nao foi possivel arquivar."),
  });

  const saveStageMutation = useMutation({
    mutationFn: async () => {
      if (!currentOrganizationId) throw new Error("Organizacao ativa nao encontrada.");
      if (!stageForm.name.trim()) throw new Error("Informe o nome da etapa.");
      return saveSalesStage(supabase, {
        id: stageForm.id,
        organization_id: currentOrganizationId,
        name: stageForm.name.trim(),
        position: Math.max(1, Number(stageForm.position) || stages.length + 1),
        color: stageForm.color || "#4f556f",
        is_active: stageForm.isActive,
        created_by: stageForm.id ? undefined : user?.id || null,
      });
    },
    onSuccess: async () => {
      setStageForm(emptyStageForm(stages.length + 1));
      await invalidateSales();
      toast.success("Etapa salva.");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Nao foi possivel salvar a etapa."),
  });

  const saveOfferMutation = useMutation({
    mutationFn: async () => {
      if (!currentOrganizationId) throw new Error("Organizacao ativa nao encontrada.");
      if (!offerForm.name.trim()) throw new Error("Informe o nome da oferta.");
      return saveSalesOffer(supabase, {
        id: offerForm.id,
        organization_id: currentOrganizationId,
        name: offerForm.name.trim(),
        category: offerForm.category,
        default_recurrence_type: offerForm.defaultRecurrenceType,
        default_value: offerForm.defaultValue ? parseSalesCurrency(offerForm.defaultValue) : null,
        description: offerForm.description.trim() || null,
        is_active: offerForm.isActive,
        created_by: offerForm.id ? undefined : user?.id || null,
      });
    },
    onSuccess: async () => {
      setOfferForm(emptyOfferForm());
      await invalidateSales();
      toast.success("Oferta salva.");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Nao foi possivel salvar a oferta."),
  });

  const openCreateDialog = () => {
    setOpportunityForm(emptyOpportunityForm(stages.find((item) => item.is_active) || stages[0]));
    setDialogOpen(true);
  };

  const openEditDialog = () => {
    if (!selectedOpportunity) return;
    setOpportunityForm(opportunityToForm(selectedOpportunity, stages));
    setDialogOpen(true);
  };

  const openOpportunity = (card: SalesPipelineCard) => {
    setSelectedOpportunityId(card.id);
    setDetailOpen(true);
  };

  const loading =
    stagesQuery.isLoading ||
    offersQuery.isLoading ||
    clientsQuery.isLoading ||
    opportunitiesQuery.isLoading ||
    commercialLeadsQuery.isLoading;
  const saving =
    saveOpportunityMutation.isPending ||
    addActivityMutation.isPending ||
    closeMutation.isPending ||
    archiveMutation.isPending ||
    saveStageMutation.isPending ||
    saveOfferMutation.isPending;

  if (roleLoaded && !canAccessSales) {
    return (
      <AppLayout>
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Acesso bloqueado</AlertTitle>
          <AlertDescription>Seu usuario nao possui permissao para acessar o modulo Vendas.</AlertDescription>
        </Alert>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-none space-y-5 px-1">
        <header className="flex flex-wrap items-end justify-between gap-4 border-b pb-5">
          <div>
            <ModuleContextPill icon={TrendingUp} label="Pipeline comercial" />
            <h1 className="font-heading text-3xl font-bold tracking-tight">Vendas</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Pipeline comercial, oportunidades, produtos avulsos e follow-ups.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {canManageSettings ? (
              <Button variant="outline" className="h-11 rounded-xl" onClick={() => setSettingsOpen(true)}>
                <Settings2 className="mr-2 h-4 w-4" />
                Configurar
              </Button>
            ) : null}
            <Button className="h-11 rounded-xl px-5" onClick={openCreateDialog}>
              <Plus className="mr-2 h-4 w-4" />
              Nova oportunidade
            </Button>
          </div>
        </header>

        <section className="rounded-2xl border bg-card p-4 shadow-sm">
          <div className="grid gap-3 lg:grid-cols-[minmax(260px,1fr)_repeat(5,minmax(150px,190px))]">
            <Input
              placeholder="Buscar por oportunidade, cliente, contato, CNPJ, telefone, e-mail ou oferta"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <select className="h-10 rounded-md border bg-background px-3 text-sm outline-none" value={stageFilter} onChange={(event) => setStageFilter(event.target.value)}>
              <option value="all">Todas as etapas</option>
              {stages.map((stage) => <option key={stage.id} value={stage.id}>{stage.name}</option>)}
            </select>
            <select className="h-10 rounded-md border bg-background px-3 text-sm outline-none" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="all">Todos os status</option>
              <option value="active">Ativas</option>
              <option value="won">Ganhas</option>
              <option value="lost">Perdidas</option>
            </select>
            <select className="h-10 rounded-md border bg-background px-3 text-sm outline-none" value={ownerFilter} onChange={(event) => setOwnerFilter(event.target.value)}>
              <option value="all">Todos responsaveis</option>
                {users.map((item) => <option key={item.user_id} value={item.user_id}>{item.display_name || item.user_id}</option>)}
            </select>
            <select className="h-10 rounded-md border bg-background px-3 text-sm outline-none" value={saleTypeFilter} onChange={(event) => setSaleTypeFilter(event.target.value)}>
              <option value="all">Todos os tipos</option>
              {Object.entries(saleTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <select className="h-10 rounded-md border bg-background px-3 text-sm outline-none" value={clientFilter} onChange={(event) => setClientFilter(event.target.value)}>
              <option value="all">Todos clientes</option>
              {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
            </select>
          </div>
          <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
            <Filter className="h-3.5 w-3.5" />
            {filteredOpportunities.length} de {opportunities.length} oportunidades no filtro atual.
          </div>
        </section>

        {loading ? (
          <div className="flex min-h-80 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <SalesPipelineMetrics metrics={metricCards} />

            {filteredOpportunities.length === 0 ? (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Nenhuma oportunidade encontrada</AlertTitle>
                <AlertDescription>Crie uma nova oportunidade ou ajuste os filtros ativos.</AlertDescription>
              </Alert>
            ) : null}

            <SalesPipelineBoard
              stages={boardStages}
              selectedStage={stageFilter === "all" ? null : stageFilter}
              onStageSelect={(stageName) => setStageFilter(stageName === "all" ? "all" : stageName)}
              onOpportunityClick={openOpportunity}
            />

            <section className="rounded-2xl border bg-card shadow-sm">
              <div className="flex items-center justify-between border-b px-5 py-4">
                <h2 className="font-heading font-semibold">Top oportunidades por valor</h2>
                <Badge variant="secondary" className="rounded-full">{metrics.topOpportunities.length}</Badge>
              </div>
              <div className="divide-y">
                {metrics.topOpportunities.length === 0 ? (
                  <div className="p-8 text-center text-sm text-muted-foreground">Sem oportunidades para listar.</div>
                ) : (
                  metrics.topOpportunities.map((item) => {
                    const opportunity = opportunities.find((entry) => entry.id === item.id);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        className="flex w-full items-center justify-between gap-4 p-4 text-left hover:bg-muted/30"
                        onClick={() => {
                          setSelectedOpportunityId(item.id);
                          setDetailOpen(true);
                        }}
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">{opportunity?.name || item.id}</p>
                          <p className="text-xs text-muted-foreground">{saleTypeLabels[item.saleType]} - {item.stage}</p>
                        </div>
                        <span className="text-sm font-semibold">{formatSalesCurrency(item.estimatedValue)}</span>
                      </button>
                    );
                  })
                )}
              </div>
            </section>
          </>
        )}
      </div>

      <SalesOpportunityDialog
        open={dialogOpen}
        mode={opportunityForm.id ? "edit" : "create"}
        form={opportunityForm}
        clients={clients}
        offers={offers}
        stages={stages}
        users={users}
        duplicateWarnings={opportunityForm.clientMode === "new" ? duplicateWarnings : []}
        isSaving={saving}
        onOpenChange={setDialogOpen}
        onFormChange={setOpportunityForm}
        onSubmit={() => saveOpportunityMutation.mutate(opportunityForm)}
      />

      <SalesOpportunityDetailSheet
        open={detailOpen}
        opportunity={selectedOpportunity}
        activities={activitiesQuery.data || []}
        users={users}
        activityTitle={activityTitle}
        activityBody={activityBody}
        activityType={activityType}
        followUpDate={followUpDate}
        lossReason={lossReason}
        isSaving={saving}
        onOpenChange={setDetailOpen}
        onEdit={openEditDialog}
        onActivityTitleChange={setActivityTitle}
        onActivityBodyChange={setActivityBody}
        onActivityTypeChange={setActivityType}
        onFollowUpDateChange={setFollowUpDate}
        onLossReasonChange={setLossReason}
        onAddActivity={() => addActivityMutation.mutate()}
        onCloseWon={() => closeMutation.mutate({ status: "won" })}
        onCloseLost={() => closeMutation.mutate({ status: "lost", reason: lossReason })}
        onReopen={() => closeMutation.mutate({ status: "active" })}
        onArchive={() => archiveMutation.mutate()}
      />

      <SalesPipelineSettingsDialog
        open={settingsOpen}
        canManage={canManageSettings}
        stages={stages}
        offers={offers}
        stageForm={stageForm}
        offerForm={offerForm}
        isSaving={saving}
        onOpenChange={setSettingsOpen}
        onStageFormChange={setStageForm}
        onOfferFormChange={setOfferForm}
        onEditStage={(stage) =>
          setStageForm({
            id: stage.id,
            name: stage.name,
            position: String(stage.position),
            color: stage.color,
            isActive: stage.is_active,
          })
        }
        onEditOffer={(offer) =>
          setOfferForm({
            id: offer.id,
            name: offer.name,
            category: offer.category,
            defaultRecurrenceType: offer.defaultRecurrenceType,
            defaultValue: offer.defaultValue ? String(offer.defaultValue) : "",
            description: offer.description || "",
            isActive: offer.isActive,
          })
        }
        onSaveStage={() => saveStageMutation.mutate()}
        onSaveOffer={() => saveOfferMutation.mutate()}
      />
    </AppLayout>
  );
}
