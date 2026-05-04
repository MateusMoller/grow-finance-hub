import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Trash2,
  TrendingDown,
  Wallet,
} from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import { AppLayout } from "@/components/app/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type {
  CashflowAccount,
  CashflowConsultiveAlert,
  CashflowHealthSnapshot,
  CashflowRule,
  PortalCashflowEntry,
  PortalCashflowEntryType,
} from "@/components/portal/types";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import {
  buildCashflowTrendSeries,
  cashflowCurrencyFormatter,
  detectPotentialDuplicateEntryIds,
  formatCashflowAccountLabel,
  formatCashflowLifecycleStatus,
  formatCashflowOriginType,
  formatCashflowReconciliationStatus,
  formatCashflowReviewStatus,
  getCashflowAccountMap,
  getCashflowGapAlert,
  getCurrentCashBalance,
  getEntryDueDate,
  getEntryLifecycleStatus,
  getEntryReferenceDate,
  getProjectedBalanceAtHorizon,
  getTopFutureExpenses,
  getTodayIsoDate,
  getUniqueCashflowCategories,
  groupCashflowEntries,
  isEntryVisibleInManagerialView,
  normalizeCashflowText,
} from "@/lib/cashflow";

type QueueFilter = "all" | "pending_review" | "pending_reconciliation" | "overdue" | "without_account" | "possible_duplicates";
type FinanceLayer = "operational" | "conciliation" | "managerial";

type ClientFinanceRow = Pick<Tables<"clients">, "id" | "name" | "sector" | "status" | "portal_cashflow_enabled">;

function MetricCard({
  title,
  value,
  helper,
  tone = "default",
}: {
  title: string;
  value: string;
  helper: string;
  tone?: "default" | "warning" | "success" | "danger";
}) {
  const valueClassName =
    tone === "warning"
      ? "text-amber-600"
      : tone === "success"
        ? "text-emerald-600"
        : tone === "danger"
          ? "text-destructive"
          : "text-foreground";

  return (
    <Card className="border-border/70">
      <CardContent className="p-4">
        <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{title}</p>
        <p className={`mt-2 text-2xl font-semibold ${valueClassName}`}>{value}</p>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{helper}</p>
      </CardContent>
    </Card>
  );
}

const formatDate = (value: string | null | undefined) => {
  if (!value) return "-";
  return new Date(`${value}T00:00:00`).toLocaleDateString("pt-BR");
};

const toLocalDateInput = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const buildMonthBounds = (monthKey: string) => {
  const [yearText, monthText] = monthKey.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const firstDay = `${monthKey}-01`;
  const lastDay = new Date(year, month, 0);

  return {
    startDate: firstDay,
    endDate: toLocalDateInput(lastDay),
  };
};

const healthStatusMeta = {
  em_dia: {
    label: "Em dia",
    className: "border-emerald-200/70 bg-emerald-50 text-emerald-700",
  },
  atencao: {
    label: "Atencao",
    className: "border-amber-200/70 bg-amber-50 text-amber-700",
  },
  critico: {
    label: "Critico",
    className: "border-rose-200/70 bg-rose-50 text-rose-700",
  },
} as const;

const alertSeverityMeta = {
  info: {
    label: "Info",
    className: "border-sky-200/70 bg-sky-50 text-sky-700",
  },
  warning: {
    label: "Atencao",
    className: "border-amber-200/70 bg-amber-50 text-amber-700",
  },
  critical: {
    label: "Critico",
    className: "border-rose-200/70 bg-rose-50 text-rose-700",
  },
} as const;

export default function FinanceiroPage() {
  const today = useMemo(() => new Date(), []);
  const todayIso = useMemo(() => getTodayIsoDate(), []);
  const initialMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  const initialMonthBounds = useMemo(() => buildMonthBounds(initialMonth), [initialMonth]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [entries, setEntries] = useState<PortalCashflowEntry[]>([]);
  const [accounts, setAccounts] = useState<CashflowAccount[]>([]);
  const [clients, setClients] = useState<ClientFinanceRow[]>([]);
  const [rules, setRules] = useState<CashflowRule[]>([]);
  const [healthSnapshots, setHealthSnapshots] = useState<CashflowHealthSnapshot[]>([]);
  const [consultiveAlerts, setConsultiveAlerts] = useState<CashflowConsultiveAlert[]>([]);

  const [activeLayer, setActiveLayer] = useState<FinanceLayer>("operational");
  const [queueFilter, setQueueFilter] = useState<QueueFilter>("pending_review");
  const [search, setSearch] = useState("");
  const [referenceMonth, setReferenceMonth] = useState(initialMonth);
  const [periodStart, setPeriodStart] = useState(initialMonthBounds.startDate);
  const [periodEnd, setPeriodEnd] = useState(initialMonthBounds.endDate);
  const [clientFilter, setClientFilter] = useState("all");
  const [accountFilter, setAccountFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [entryTypeFilter, setEntryTypeFilter] = useState<PortalCashflowEntryType | "all">("all");
  const [originFilter, setOriginFilter] = useState("all");
  const [lifecycleFilter, setLifecycleFilter] = useState("all");
  const [reviewFilter, setReviewFilter] = useState("all");
  const [reconciliationFilter, setReconciliationFilter] = useState("all");
  const [managerialGroupBy, setManagerialGroupBy] = useState<"day" | "week" | "month" | "account" | "category" | "client">("client");

  const [creatingRule, setCreatingRule] = useState(false);
  const [deletingRuleId, setDeletingRuleId] = useState<string | null>(null);
  const [newRuleClientId, setNewRuleClientId] = useState("global");
  const [newRuleMatchText, setNewRuleMatchText] = useState("");
  const [newRuleEntryType, setNewRuleEntryType] = useState<PortalCashflowEntryType>("expense");
  const [newRuleCategory, setNewRuleCategory] = useState("");
  const [newRuleCounterparty, setNewRuleCounterparty] = useState("");
  const [newRuleThreshold, setNewRuleThreshold] = useState("0.92");
  const [newRuleTransfer, setNewRuleTransfer] = useState(false);

  const fetchFinanceData = useCallback(async () => {
    setRefreshing(true);

    const [entriesRes, accountsRes, clientsRes, rulesRes, healthRes, alertsRes] = await Promise.all([
      supabase
        .from("client_cashflow_entries")
        .select(
          "id, client_id, entry_date, due_date, effective_date, competence_month, account_id, entry_type, category, description, amount, status, lifecycle_status, matched_rule_id, origin_type, reconciliation_status, review_status, review_owner_id, reviewed_at, rule_match_confidence, counterparty_name, document_ref, notes, is_transfer, is_hidden_from_projection, integration_source, integration_key, integration_connection_id, integration_account_id, created_by, created_at, updated_at",
        )
        .order("due_date", { ascending: true })
        .order("created_at", { ascending: false }),
      supabase
        .from("client_cashflow_accounts")
        .select(
          "id, client_id, label, source_type, currency_code, open_finance_account_id, open_finance_connection_id, institution_name, account_mask, is_primary, is_active, notes, created_at, updated_at",
        )
        .order("label", { ascending: true }),
      supabase
        .from("clients")
        .select("id, name, sector, status, portal_cashflow_enabled")
        .order("name", { ascending: true }),
      supabase
        .from("client_cashflow_rules")
        .select(
          "id, client_id, match_text, entry_type, category, counterparty_name, mark_as_transfer, auto_approve_threshold, is_active, notes, created_by, updated_by, created_at, updated_at",
        )
        .order("client_id", { ascending: true })
        .order("match_text", { ascending: true }),
      supabase
        .from("client_cashflow_health_snapshots")
        .select(
          "client_id, health_status, current_balance, projected_balance_7, projected_balance_15, projected_balance_30, overdue_entries, pending_review_entries, pending_reconciliation_entries, review_coverage, critical_calendar_events, last_activity_at, projected_gap_date, metadata, generated_at, updated_at",
        ),
      supabase
        .from("client_cashflow_consultive_alerts")
        .select("id, client_id, source_type, source_key, severity, title, message, status, metadata, resolved_at, created_at, updated_at")
        .eq("status", "active")
        .order("created_at", { ascending: false }),
    ]);

    setRefreshing(false);
    setLoading(false);

    if (entriesRes.error || accountsRes.error || clientsRes.error || rulesRes.error || healthRes.error || alertsRes.error) {
      toast.error("Nao foi possivel carregar o modulo financeiro.");
      return;
    }

    setEntries((entriesRes.data || []) as PortalCashflowEntry[]);
    setAccounts((accountsRes.data || []) as CashflowAccount[]);
    setClients((clientsRes.data || []) as ClientFinanceRow[]);
    setRules((rulesRes.data || []) as CashflowRule[]);
    setHealthSnapshots((healthRes.data || []) as CashflowHealthSnapshot[]);
    setConsultiveAlerts((alertsRes.data || []) as CashflowConsultiveAlert[]);
  }, []);

  useEffect(() => {
    void fetchFinanceData();
  }, [fetchFinanceData]);

  const accountMap = useMemo(() => getCashflowAccountMap(accounts), [accounts]);
  const clientMap = useMemo(() => new Map(clients.map((client) => [client.id, client])), [clients]);
  const healthSnapshotMap = useMemo(
    () => new Map(healthSnapshots.map((snapshot) => [snapshot.client_id, snapshot])),
    [healthSnapshots],
  );
  const consultiveAlertsByClient = useMemo(() => {
    const map = new Map<string, CashflowConsultiveAlert[]>();

    for (const alert of consultiveAlerts) {
      const clientAlerts = map.get(alert.client_id) || [];
      clientAlerts.push(alert);
      map.set(alert.client_id, clientAlerts);
    }

    return map;
  }, [consultiveAlerts]);
  const categories = useMemo(() => getUniqueCashflowCategories(entries), [entries]);
  const duplicateEntryIds = useMemo(() => detectPotentialDuplicateEntryIds(entries), [entries]);
  const normalizedSearch = useMemo(() => normalizeCashflowText(search), [search]);
  const criticalClientsCount = useMemo(
    () => healthSnapshots.filter((snapshot) => snapshot.health_status === "critico").length,
    [healthSnapshots],
  );
  const attentionClientsCount = useMemo(
    () => healthSnapshots.filter((snapshot) => snapshot.health_status === "atencao").length,
    [healthSnapshots],
  );
  const activeConsultiveAlertsCount = useMemo(() => consultiveAlerts.length, [consultiveAlerts]);
  const highlightedConsultiveAlerts = useMemo(() => consultiveAlerts.slice(0, 3), [consultiveAlerts]);

  const handleReferenceMonthChange = (value: string) => {
    setReferenceMonth(value);
    const bounds = buildMonthBounds(value);
    setPeriodStart(bounds.startDate);
    setPeriodEnd(bounds.endDate);
  };

  const scopedEntries = useMemo(
    () =>
      entries
        .filter((entry) => clientFilter === "all" || entry.client_id === clientFilter)
        .filter((entry) => accountFilter === "all" || entry.account_id === accountFilter)
        .filter((entry) => categoryFilter === "all" || entry.category === categoryFilter)
        .filter((entry) => entryTypeFilter === "all" || entry.entry_type === entryTypeFilter)
        .filter((entry) => originFilter === "all" || (entry.origin_type || "manual") === originFilter)
        .filter((entry) => {
          const referenceDate = getEntryReferenceDate(entry);
          if (periodStart && referenceDate < periodStart) return false;
          if (periodEnd && referenceDate > periodEnd) return false;
          return true;
        })
        .filter((entry) => lifecycleFilter === "all" || getEntryLifecycleStatus(entry) === lifecycleFilter)
        .filter((entry) => reviewFilter === "all" || (entry.review_status || "approved") === reviewFilter)
        .filter(
          (entry) => reconciliationFilter === "all" || (entry.reconciliation_status || "not_applicable") === reconciliationFilter,
        )
        .filter((entry) => {
          if (!normalizedSearch) return true;

          const client = clientMap.get(entry.client_id);
          const account = accountMap.get(entry.account_id || "");
          const searchable = [
            entry.description,
            entry.category,
            entry.counterparty_name || "",
            entry.document_ref || "",
            client?.name || "",
            account?.label || "",
          ]
            .map((token) => normalizeCashflowText(token))
            .join(" ");

          return searchable.includes(normalizedSearch);
        }),
    [
      accountFilter,
      accountMap,
      categoryFilter,
      clientFilter,
      clientMap,
      entries,
      entryTypeFilter,
      lifecycleFilter,
      normalizedSearch,
      originFilter,
      periodEnd,
      periodStart,
      reconciliationFilter,
      reviewFilter,
    ],
  );

  const queueCounts = useMemo(() => {
    const pendingReview = scopedEntries.filter((entry) => entry.review_status === "pending_review").length;
    const pendingReconciliation = scopedEntries.filter((entry) => entry.reconciliation_status === "pending").length;
    const overdue = scopedEntries.filter((entry) => getEntryLifecycleStatus(entry) === "overdue").length;
    const withoutAccount = scopedEntries.filter((entry) => !entry.account_id).length;
    const possibleDuplicates = scopedEntries.filter((entry) => duplicateEntryIds.has(entry.id)).length;

    return { pendingReview, pendingReconciliation, overdue, withoutAccount, possibleDuplicates };
  }, [duplicateEntryIds, scopedEntries]);

  const queueEntries = useMemo(() => {
    const queueMatches = (entry: PortalCashflowEntry) => {
      if (queueFilter === "pending_review") return entry.review_status === "pending_review";
      if (queueFilter === "pending_reconciliation") return entry.reconciliation_status === "pending";
      if (queueFilter === "overdue") return getEntryLifecycleStatus(entry) === "overdue";
      if (queueFilter === "without_account") return !entry.account_id;
      if (queueFilter === "possible_duplicates") return duplicateEntryIds.has(entry.id);
      return true;
    };

    return scopedEntries
      .filter((entry) => queueMatches(entry))
      .sort((left, right) => {
        const lifecycleLeft = getEntryLifecycleStatus(left);
        const lifecycleRight = getEntryLifecycleStatus(right);

        if (lifecycleLeft === "overdue" && lifecycleRight !== "overdue") return -1;
        if (lifecycleRight === "overdue" && lifecycleLeft !== "overdue") return 1;

        return getEntryDueDate(left).localeCompare(getEntryDueDate(right)) || right.created_at.localeCompare(left.created_at);
      });
  }, [duplicateEntryIds, queueFilter, scopedEntries]);

  const conciliationEntries = useMemo(
    () =>
      scopedEntries
        .filter((entry) => (entry.origin_type || "manual") !== "manual")
        .filter(
          (entry) =>
            entry.review_status === "pending_review" ||
            entry.review_status === "classified" ||
            entry.reconciliation_status === "pending" ||
            entry.reconciliation_status === "suggested",
        )
        .sort((left, right) => getEntryDueDate(left).localeCompare(getEntryDueDate(right))),
    [scopedEntries],
  );

  const managerialEntries = useMemo(
    () => scopedEntries.filter((entry) => isEntryVisibleInManagerialView(entry)),
    [scopedEntries],
  );

  const dashboardMetrics = useMemo(() => {
    const currentBalance = getCurrentCashBalance(managerialEntries, todayIso);
    const projectedSeven = getProjectedBalanceAtHorizon(managerialEntries, 7, todayIso);
    const projectedFifteen = getProjectedBalanceAtHorizon(managerialEntries, 15, todayIso);
    const projectedThirty = getProjectedBalanceAtHorizon(managerialEntries, 30, todayIso);
    const topFutureExpenses = getTopFutureExpenses(managerialEntries, 30, 5, todayIso);
    const gapAlert = getCashflowGapAlert(managerialEntries, 30, todayIso);

    return {
      currentBalance,
      projectedSeven,
      projectedFifteen,
      projectedThirty,
      topFutureExpenses,
      gapAlert,
    };
  }, [managerialEntries, todayIso]);

  const trendSeries = useMemo(() => buildCashflowTrendSeries(managerialEntries, periodStart, periodEnd), [
    managerialEntries,
    periodEnd,
    periodStart,
  ]);

  const groupedRows = useMemo(
    () =>
      groupCashflowEntries(managerialEntries, managerialGroupBy, {
        accountMap,
        clientMap,
      }),
    [accountMap, clientMap, managerialEntries, managerialGroupBy],
  );

  const expenseByCategory = useMemo(
    () =>
      groupCashflowEntries(
        managerialEntries.filter((entry) => entry.entry_type === "expense"),
        "category",
      ).slice(0, 6),
    [managerialEntries],
  );

  const clientRiskRows = useMemo(
    () =>
      clients
        .map((client) => {
          const clientEntries = entries.filter((entry) => entry.client_id === client.id);
          const snapshot = healthSnapshotMap.get(client.id);
          const clientAlerts = consultiveAlertsByClient.get(client.id) || [];
          const fallbackGapAlert = getCashflowGapAlert(clientEntries, 30, todayIso);
          const pendingItems =
            snapshot?.overdue_entries !== undefined
              ? snapshot.overdue_entries + snapshot.pending_review_entries + snapshot.pending_reconciliation_entries
              : clientEntries.filter(
                  (entry) =>
                    entry.review_status === "pending_review" ||
                    entry.reconciliation_status === "pending" ||
                    getEntryLifecycleStatus(entry) === "overdue",
                ).length;
          const projectedThirty = snapshot?.projected_balance_30 ?? getProjectedBalanceAtHorizon(clientEntries, 30, todayIso);
          const healthStatus =
            snapshot?.health_status ??
            (fallbackGapAlert || projectedThirty < 0
              ? "critico"
              : pendingItems > 0 || clientAlerts.length > 0
                ? "atencao"
                : "em_dia");

          return {
            id: client.id,
            name: client.name,
            sector: client.sector || "Sem setor",
            currentBalance: snapshot?.current_balance ?? getCurrentCashBalance(clientEntries, todayIso),
            projectedThirty,
            pendingItems,
            gapAlert:
              snapshot?.projected_gap_date || fallbackGapAlert
                ? {
                    date: snapshot?.projected_gap_date || fallbackGapAlert?.date || null,
                    projectedBalance: snapshot?.projected_balance_30 ?? fallbackGapAlert?.projectedBalance ?? projectedThirty,
                  }
                : null,
            healthStatus,
            activeAlerts: clientAlerts.length,
            topAlertTitle: clientAlerts[0]?.title || null,
          };
        })
        .filter(
          (row) =>
            row.healthStatus !== "em_dia" || row.pendingItems > 0 || row.activeAlerts > 0 || row.gapAlert || row.projectedThirty < 0,
        )
        .sort((left, right) => {
          const leftRisk = left.healthStatus === "critico" ? 3 : left.healthStatus === "atencao" ? 2 : 1;
          const rightRisk = right.healthStatus === "critico" ? 3 : right.healthStatus === "atencao" ? 2 : 1;
          if (leftRisk !== rightRisk) return rightRisk - leftRisk;
          if (left.activeAlerts !== right.activeAlerts) return right.activeAlerts - left.activeAlerts;
          return right.pendingItems - left.pendingItems;
        })
        .slice(0, 10),
    [clients, consultiveAlertsByClient, entries, healthSnapshotMap, todayIso],
  );
  const clientsRequiringAttentionCount = useMemo(
    () => (healthSnapshots.length > 0 ? criticalClientsCount + attentionClientsCount : clientRiskRows.length),
    [attentionClientsCount, clientRiskRows.length, criticalClientsCount, healthSnapshots.length],
  );

  const resetRuleForm = () => {
    setNewRuleClientId("global");
    setNewRuleMatchText("");
    setNewRuleEntryType("expense");
    setNewRuleCategory("");
    setNewRuleCounterparty("");
    setNewRuleThreshold("0.92");
    setNewRuleTransfer(false);
  };

  const handleCreateRule = async () => {
    const thresholdValue = Number(newRuleThreshold.replace(",", "."));
    if (newRuleMatchText.trim().length < 3) {
      toast.error("Informe um texto gatilho com pelo menos 3 caracteres.");
      return;
    }
    if (newRuleCategory.trim().length < 2) {
      toast.error("Informe a categoria de destino da regra.");
      return;
    }
    if (!Number.isFinite(thresholdValue) || thresholdValue < 0 || thresholdValue > 1) {
      toast.error("O limiar de aprovacao deve ficar entre 0 e 1.");
      return;
    }

    setCreatingRule(true);
    const { error } = await supabase.from("client_cashflow_rules").insert({
      client_id: newRuleClientId === "global" ? null : newRuleClientId,
      match_text: newRuleMatchText.trim(),
      entry_type: newRuleEntryType,
      category: newRuleCategory.trim(),
      counterparty_name: newRuleCounterparty.trim() || null,
      mark_as_transfer: newRuleTransfer,
      auto_approve_threshold: Number(thresholdValue.toFixed(4)),
      is_active: true,
    });
    setCreatingRule(false);

    if (error) {
      toast.error("Nao foi possivel salvar a regra automatica.");
      return;
    }

    resetRuleForm();
    toast.success("Regra automatica criada.");
    await fetchFinanceData();
  };

  const handleDeleteRule = async (ruleId: string) => {
    setDeletingRuleId(ruleId);
    const { error } = await supabase.from("client_cashflow_rules").delete().eq("id", ruleId);
    setDeletingRuleId(null);

    if (error) {
      toast.error("Nao foi possivel excluir a regra.");
      return;
    }

    toast.success("Regra removida.");
    await fetchFinanceData();
  };

  return (
    <AppLayout>
      <div className="space-y-6 p-4 md:p-6">
        <Card className="overflow-hidden border-border/70 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-slate-50">
          <CardContent className="space-y-6 p-6">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
              <div className="max-w-3xl space-y-3">
                <Badge className="w-fit bg-sky-400/20 text-sky-100 hover:bg-sky-400/20">Financeiro Grow</Badge>
                <div>
                  <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Operacao, conciliacao e visao gerencial em uma unica fila.</h1>
                  <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-300">
                    Use esta tela para revisar o caixa multi-cliente, detectar risco com antecedencia e sustentar o acompanhamento consultivo.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 xl:min-w-[430px]">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-slate-300">Saldo atual</p>
                  <p className={`mt-2 text-2xl font-semibold ${dashboardMetrics.currentBalance >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
                    {cashflowCurrencyFormatter.format(dashboardMetrics.currentBalance)}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-slate-300">Projecao 30 dias</p>
                  <p className={`mt-2 text-2xl font-semibold ${dashboardMetrics.projectedThirty >= 0 ? "text-sky-200" : "text-rose-300"}`}>
                    {cashflowCurrencyFormatter.format(dashboardMetrics.projectedThirty)}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-slate-300">Clientes em risco</p>
                  <p className="mt-2 text-2xl font-semibold text-amber-200">{clientsRequiringAttentionCount}</p>
                  <p className="mt-1 text-xs text-slate-300">
                    {criticalClientsCount} criticos, {attentionClientsCount} em atencao
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
              <MetricCard
                title="Pendentes de revisao"
                value={String(queueCounts.pendingReview)}
                helper="Lancamentos aguardando classificacao ou aprovacao."
                tone={queueCounts.pendingReview > 0 ? "warning" : "success"}
              />
              <MetricCard
                title="Pendentes de conciliacao"
                value={String(queueCounts.pendingReconciliation)}
                helper="Itens bancarios ainda nao tratados operacionalmente."
                tone={queueCounts.pendingReconciliation > 0 ? "warning" : "success"}
              />
              <MetricCard
                title="Vencidos"
                value={String(queueCounts.overdue)}
                helper="Previstos com vencimento passado."
                tone={queueCounts.overdue > 0 ? "warning" : "success"}
              />
              <MetricCard
                title="Duplicidade suspeita"
                value={String(queueCounts.possibleDuplicates)}
                helper="Mesmo cliente, conta, valor, origem e descricao."
                tone={queueCounts.possibleDuplicates > 0 ? "warning" : "success"}
              />
              <MetricCard
                title="Projecao 7 dias"
                value={cashflowCurrencyFormatter.format(dashboardMetrics.projectedSeven)}
                helper="Saldo projetado de curtissimo prazo."
                tone={dashboardMetrics.projectedSeven >= 0 ? "success" : "danger"}
              />
              <MetricCard
                title="Projecao 15 dias"
                value={cashflowCurrencyFormatter.format(dashboardMetrics.projectedFifteen)}
                helper="Janela intermediaria para acao consultiva."
                tone={dashboardMetrics.projectedFifteen >= 0 ? "success" : "danger"}
              />
            </div>

            {highlightedConsultiveAlerts.length > 0 ? (
              <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
                {highlightedConsultiveAlerts.map((alert) => {
                  const client = clientMap.get(alert.client_id);
                  const severity = alertSeverityMeta[alert.severity];

                  return (
                    <div key={alert.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium text-slate-50">{alert.title}</p>
                        <Badge variant="outline" className={severity.className}>
                          {severity.label}
                        </Badge>
                      </div>
                      <p className="mt-2 text-xs leading-relaxed text-slate-300">{alert.message}</p>
                      <p className="mt-3 text-[11px] uppercase tracking-[0.16em] text-slate-400">
                        {client?.name || "Cliente"} • {formatDate(alert.created_at.slice(0, 10))}
                      </p>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card className="border-border/70">
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <CardTitle className="text-base">Filtros e recorte</CardTitle>
                <CardDescription>
                  Controle periodo, cliente, conta, tipo, origem, categoria, situacao e conciliacao.
                </CardDescription>
              </div>
              <Button type="button" variant="outline" className="gap-2" onClick={() => void fetchFinanceData()} disabled={refreshing}>
                {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Atualizar dados
              </Button>
            </div>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="space-y-1.5">
              <Input placeholder="Buscar cliente, descricao, conta ou documento" value={search} onChange={(event) => setSearch(event.target.value)} />
            </div>

            <div className="space-y-1.5">
              <Input type="month" value={referenceMonth} onChange={(event) => handleReferenceMonthChange(event.target.value)} />
            </div>

            <div className="space-y-1.5">
              <Input type="date" value={periodStart} onChange={(event) => setPeriodStart(event.target.value)} />
            </div>

            <div className="space-y-1.5">
              <Input type="date" value={periodEnd} onChange={(event) => setPeriodEnd(event.target.value)} />
            </div>

            <Select value={clientFilter} onValueChange={setClientFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Cliente" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os clientes</SelectItem>
                {clients.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={accountFilter} onValueChange={setAccountFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Conta" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as contas</SelectItem>
                {accounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {formatCashflowAccountLabel(account)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as categorias</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={entryTypeFilter} onValueChange={(value) => setEntryTypeFilter(value as PortalCashflowEntryType | "all")}>
              <SelectTrigger>
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                <SelectItem value="income">Entrada</SelectItem>
                <SelectItem value="expense">Saida</SelectItem>
              </SelectContent>
            </Select>

            <Select value={originFilter} onValueChange={setOriginFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Origem" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as origens</SelectItem>
                <SelectItem value="manual">Manual</SelectItem>
                <SelectItem value="import_file">Importacao</SelectItem>
                <SelectItem value="open_finance">Open Finance</SelectItem>
                <SelectItem value="obligation_projection">Obrigacao</SelectItem>
                <SelectItem value="recurring_rule">Recorrencia</SelectItem>
              </SelectContent>
            </Select>

            <Select value={lifecycleFilter} onValueChange={setLifecycleFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Situacao" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as situacoes</SelectItem>
                <SelectItem value="predicted">Previsto</SelectItem>
                <SelectItem value="due">Vence hoje</SelectItem>
                <SelectItem value="overdue">Vencido</SelectItem>
                <SelectItem value="confirmed">Confirmado</SelectItem>
              </SelectContent>
            </Select>

            <Select value={reviewFilter} onValueChange={setReviewFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Revisao" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="pending_review">Pendente</SelectItem>
                <SelectItem value="classified">Classificado</SelectItem>
                <SelectItem value="approved">Aprovado</SelectItem>
              </SelectContent>
            </Select>

            <Select value={reconciliationFilter} onValueChange={setReconciliationFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Conciliacao" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as situacoes</SelectItem>
                <SelectItem value="not_applicable">Nao aplicavel</SelectItem>
                <SelectItem value="pending">Pendente</SelectItem>
                <SelectItem value="suggested">Sugerido</SelectItem>
                <SelectItem value="reconciled">Conciliado</SelectItem>
                <SelectItem value="ignored">Ignorado</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Tabs value={activeLayer} onValueChange={(value) => setActiveLayer(value as FinanceLayer)}>
          <TabsList className="grid h-auto w-full grid-cols-1 gap-2 bg-transparent p-0 md:grid-cols-3">
            <TabsTrigger value="operational" className="rounded-xl border px-4 py-3 data-[state=active]:border-primary">
              Operacional
            </TabsTrigger>
            <TabsTrigger value="conciliation" className="rounded-xl border px-4 py-3 data-[state=active]:border-primary">
              Conciliacao
            </TabsTrigger>
            <TabsTrigger value="managerial" className="rounded-xl border px-4 py-3 data-[state=active]:border-primary">
              Visao gerencial
            </TabsTrigger>
          </TabsList>

          <TabsContent value="operational" className="space-y-6">
            <Card className="border-border/70">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Fila operacional</CardTitle>
                <CardDescription>
                  Use as filas para tratar revisao, conciliacao, vencidos, sem conta e suspeitas de duplicidade.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Tabs value={queueFilter} onValueChange={(value) => setQueueFilter(value as QueueFilter)}>
                  <TabsList className="flex h-auto flex-wrap gap-2 bg-transparent p-0">
                    <TabsTrigger value="pending_review">Revisao</TabsTrigger>
                    <TabsTrigger value="pending_reconciliation">Conciliacao</TabsTrigger>
                    <TabsTrigger value="overdue">Vencidos</TabsTrigger>
                    <TabsTrigger value="without_account">Sem conta</TabsTrigger>
                    <TabsTrigger value="possible_duplicates">Duplicidade</TabsTrigger>
                    <TabsTrigger value="all">Todos</TabsTrigger>
                  </TabsList>
                </Tabs>

                {loading ? (
                  <div className="flex h-56 items-center justify-center">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  </div>
                ) : queueEntries.length === 0 ? (
                  <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                    Nenhum lancamento encontrado para a fila selecionada.
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border">
                    <Table className="min-w-[1180px]">
                      <TableHeader>
                        <TableRow>
                          <TableHead>Cliente</TableHead>
                          <TableHead>Vencimento</TableHead>
                          <TableHead>Efetivacao</TableHead>
                          <TableHead>Descricao</TableHead>
                          <TableHead>Conta</TableHead>
                          <TableHead>Origem</TableHead>
                          <TableHead>Regra</TableHead>
                          <TableHead>Situacao</TableHead>
                          <TableHead>Revisao</TableHead>
                          <TableHead>Conciliacao</TableHead>
                          <TableHead className="text-right">Valor</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {queueEntries.slice(0, 120).map((entry) => {
                          const client = clientMap.get(entry.client_id);
                          const account = accountMap.get(entry.account_id || "");
                          const lifecycleStatus = getEntryLifecycleStatus(entry);
                          const hasPossibleDuplicate = duplicateEntryIds.has(entry.id);
                          const isWarning =
                            lifecycleStatus === "overdue" ||
                            entry.review_status === "pending_review" ||
                            hasPossibleDuplicate;

                          return (
                            <TableRow key={entry.id}>
                              <TableCell>
                                <div className="space-y-1">
                                  <p className="text-sm font-medium">{client?.name || "Cliente nao encontrado"}</p>
                                  <p className="text-[11px] text-muted-foreground">{client?.sector || "Sem setor"}</p>
                                </div>
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">{formatDate(getEntryDueDate(entry))}</TableCell>
                              <TableCell className="text-sm text-muted-foreground">{formatDate(entry.effective_date)}</TableCell>
                              <TableCell>
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <p className="text-sm font-medium line-clamp-1">{entry.description}</p>
                                    {isWarning ? <AlertTriangle className="h-3.5 w-3.5 text-amber-600" /> : <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />}
                                  </div>
                                  <p className="text-[11px] text-muted-foreground">
                                    {entry.category}
                                    {entry.counterparty_name ? ` • ${entry.counterparty_name}` : ""}
                                  </p>
                                </div>
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">{formatCashflowAccountLabel(account)}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className="text-[10px]">
                                  {formatCashflowOriginType(entry.origin_type)}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {entry.matched_rule_id ? (
                                  <div className="space-y-1">
                                    <Badge variant="outline" className="text-[10px]">
                                      Regra aplicada
                                    </Badge>
                                    <p className="text-[11px] text-muted-foreground">
                                      Confianca {Math.round((entry.rule_match_confidence || 0) * 100)}%
                                    </p>
                                    {hasPossibleDuplicate ? <p className="text-[11px] text-amber-600">Suspeita de duplicidade</p> : null}
                                  </div>
                                ) : hasPossibleDuplicate ? (
                                  <p className="text-[11px] text-amber-600">Suspeita de duplicidade</p>
                                ) : (
                                  <span className="text-xs text-muted-foreground">Sem regra</span>
                                )}
                              </TableCell>
                              <TableCell>
                                <Badge variant="secondary" className="text-[10px]">
                                  {formatCashflowLifecycleStatus(lifecycleStatus)}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Badge variant="secondary" className="text-[10px]">
                                  {formatCashflowReviewStatus(entry.review_status)}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Badge variant="secondary" className="text-[10px]">
                                  {formatCashflowReconciliationStatus(entry.reconciliation_status)}
                                </Badge>
                              </TableCell>
                              <TableCell
                                className={`text-right font-medium ${entry.entry_type === "income" ? "text-emerald-600" : "text-destructive"}`}
                              >
                                {entry.entry_type === "income" ? "+" : "-"} {cashflowCurrencyFormatter.format(entry.amount)}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="conciliation" className="space-y-6">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                title="Pendentes de revisao"
                value={String(conciliationEntries.filter((entry) => entry.review_status === "pending_review").length)}
                helper="Itens que ainda precisam de classificacao ou aprovacao."
                tone="warning"
              />
              <MetricCard
                title="Classificados"
                value={String(conciliationEntries.filter((entry) => entry.review_status === "classified").length)}
                helper="Sugestoes geradas, aguardando confirmacao da equipe."
                tone="warning"
              />
              <MetricCard
                title="Pendentes de conciliacao"
                value={String(conciliationEntries.filter((entry) => entry.reconciliation_status === "pending").length)}
                helper="Extratos e importacoes aguardando tratamento."
                tone="warning"
              />
              <MetricCard
                title="Sugeridos"
                value={String(conciliationEntries.filter((entry) => entry.reconciliation_status === "suggested").length)}
                helper="Casos com indicio de conciliacao automatica."
                tone="warning"
              />
            </div>

            <Card className="border-border/70">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  Fila de conciliacao
                </CardTitle>
                <CardDescription>
                  Itens importados ou bancarios que ainda precisam de revisao operacional.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {conciliationEntries.length === 0 ? (
                  <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                    Nenhuma pendencia de conciliacao encontrada.
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border">
                    <Table className="min-w-[980px]">
                      <TableHeader>
                        <TableRow>
                          <TableHead>Cliente</TableHead>
                          <TableHead>Vencimento</TableHead>
                          <TableHead>Descricao</TableHead>
                          <TableHead>Conta</TableHead>
                          <TableHead>Origem</TableHead>
                          <TableHead>Revisao</TableHead>
                          <TableHead>Conciliacao</TableHead>
                          <TableHead className="text-right">Valor</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {conciliationEntries.slice(0, 120).map((entry) => (
                          <TableRow key={entry.id}>
                            <TableCell className="text-sm text-muted-foreground">{clientMap.get(entry.client_id)?.name || "Cliente nao encontrado"}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">{formatDate(getEntryDueDate(entry))}</TableCell>
                            <TableCell>
                              <div className="space-y-1">
                                <p className="text-sm font-medium line-clamp-1">{entry.description}</p>
                                <p className="text-[11px] text-muted-foreground">
                                  {entry.category}
                                  {entry.document_ref ? ` • ${entry.document_ref}` : ""}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">{formatCashflowAccountLabel(accountMap.get(entry.account_id || ""))}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-[10px]">
                                {formatCashflowOriginType(entry.origin_type)}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary" className="text-[10px]">
                                {formatCashflowReviewStatus(entry.review_status)}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary" className="text-[10px]">
                                {formatCashflowReconciliationStatus(entry.reconciliation_status)}
                              </Badge>
                            </TableCell>
                            <TableCell
                              className={`text-right font-medium ${entry.entry_type === "income" ? "text-emerald-600" : "text-destructive"}`}
                            >
                              {entry.entry_type === "income" ? "+" : "-"} {cashflowCurrencyFormatter.format(entry.amount)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-border/70">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Regras automaticas</CardTitle>
                <CardDescription>
                  Regras por cliente ou globais para classificar importacoes e Open Finance, com aprovacao automatica por confianca.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <Select value={newRuleClientId} onValueChange={setNewRuleClientId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Escopo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="global">Regra global Grow</SelectItem>
                      {clients.map((client) => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={newRuleEntryType} onValueChange={(value) => setNewRuleEntryType(value as PortalCashflowEntryType)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="income">Entrada</SelectItem>
                      <SelectItem value="expense">Saida</SelectItem>
                    </SelectContent>
                  </Select>

                  <Input placeholder="Texto gatilho" value={newRuleMatchText} onChange={(event) => setNewRuleMatchText(event.target.value)} />
                  <Input placeholder="Categoria destino" value={newRuleCategory} onChange={(event) => setNewRuleCategory(event.target.value)} />
                  <Input placeholder="Contraparte opcional" value={newRuleCounterparty} onChange={(event) => setNewRuleCounterparty(event.target.value)} />
                  <Input
                    placeholder="Limiar de aprovacao (0-1)"
                    value={newRuleThreshold}
                    onChange={(event) => setNewRuleThreshold(event.target.value)}
                  />
                  <div className="flex items-center justify-between rounded-lg border px-3 py-2">
                    <div>
                      <p className="text-sm font-medium">Marcar como transferencia</p>
                      <p className="text-[11px] text-muted-foreground">Nao entra no resultado gerencial</p>
                    </div>
                    <Switch checked={newRuleTransfer} onCheckedChange={setNewRuleTransfer} />
                  </div>
                  <Button type="button" onClick={() => void handleCreateRule()} disabled={creatingRule}>
                    {creatingRule ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Criar regra
                  </Button>
                </div>

                <div className="overflow-x-auto rounded-xl border">
                  <Table className="min-w-[980px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Escopo</TableHead>
                        <TableHead>Texto gatilho</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Categoria</TableHead>
                        <TableHead>Contraparte</TableHead>
                        <TableHead>Transferencia</TableHead>
                        <TableHead>Limiar</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Acao</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rules.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={9} className="py-8 text-center text-sm text-muted-foreground">
                            Nenhuma regra automatica cadastrada.
                          </TableCell>
                        </TableRow>
                      ) : (
                        rules.map((rule) => (
                          <TableRow key={rule.id}>
                            <TableCell className="text-sm text-muted-foreground">
                              {rule.client_id ? clientMap.get(rule.client_id)?.name || "Cliente removido" : "Global Grow"}
                            </TableCell>
                            <TableCell className="text-sm font-medium">{rule.match_text}</TableCell>
                            <TableCell>{rule.entry_type === "income" ? "Entrada" : "Saida"}</TableCell>
                            <TableCell>{rule.category}</TableCell>
                            <TableCell>{rule.counterparty_name || "-"}</TableCell>
                            <TableCell>{rule.mark_as_transfer ? "Sim" : "Nao"}</TableCell>
                            <TableCell>{Math.round(rule.auto_approve_threshold * 100)}%</TableCell>
                            <TableCell>
                              <Badge variant={rule.is_active ? "secondary" : "outline"} className="text-[10px]">
                                {rule.is_active ? "Ativa" : "Inativa"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => void handleDeleteRule(rule.id)}
                                disabled={deletingRuleId === rule.id}
                              >
                                {deletingRuleId === rule.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                )}
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="managerial" className="space-y-6">
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.25fr_0.75fr]">
              <Card className="border-border/70">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <BarChart3 className="h-4 w-4 text-primary" />
                    Tendencia do periodo
                  </CardTitle>
                  <CardDescription>Comparativo acumulado entre realizado e projetado no recorte atual.</CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="h-[320px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={trendSeries}>
                        <defs>
                          <linearGradient id="financeRealized" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#0ea5e9" stopOpacity={0.38} />
                            <stop offset="100%" stopColor="#0ea5e9" stopOpacity={0.04} />
                          </linearGradient>
                          <linearGradient id="financeProjected" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#22c55e" stopOpacity={0.28} />
                            <stop offset="100%" stopColor="#22c55e" stopOpacity={0.02} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="label" tick={{ fontSize: 12 }} minTickGap={24} />
                        <YAxis tickFormatter={(value) => `${Math.round(value / 1000)}k`} tick={{ fontSize: 12 }} />
                        <Tooltip formatter={(value: number) => cashflowCurrencyFormatter.format(value)} />
                        <Area
                          type="monotone"
                          dataKey="realized"
                          stroke="#0ea5e9"
                          strokeWidth={2}
                          fill="url(#financeRealized)"
                          name="Realizado"
                        />
                        <Area
                          type="monotone"
                          dataKey="projected"
                          stroke="#22c55e"
                          strokeWidth={2}
                          fill="url(#financeProjected)"
                          name="Projetado"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/70">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <TrendingDown className="h-4 w-4 text-primary" />
                    Saidas por categoria
                  </CardTitle>
                  <CardDescription>As categorias que mais pressionam o caixa neste recorte.</CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="h-[320px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={expenseByCategory}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="label" tick={{ fontSize: 11 }} angle={-12} textAnchor="end" height={72} />
                        <YAxis tickFormatter={(value) => `${Math.round(value / 1000)}k`} tick={{ fontSize: 12 }} />
                        <Tooltip formatter={(value: number) => cashflowCurrencyFormatter.format(value)} />
                        <Bar dataKey="expense" fill="#ef4444" radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="border-border/70">
              <CardHeader className="pb-3">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                  <div>
                    <CardTitle className="text-base">Visao agrupada</CardTitle>
                    <CardDescription>
                      Leia o caixa por dia, semana, mes, conta, categoria ou cliente para decidir prioridades.
                    </CardDescription>
                  </div>
                  <div className="w-full xl:w-[240px]">
                    <Select value={managerialGroupBy} onValueChange={(value) => setManagerialGroupBy(value as typeof managerialGroupBy)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Agrupar por" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="day">Dia</SelectItem>
                        <SelectItem value="week">Semana</SelectItem>
                        <SelectItem value="month">Mes</SelectItem>
                        <SelectItem value="account">Conta</SelectItem>
                        <SelectItem value="category">Categoria</SelectItem>
                        <SelectItem value="client">Cliente</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {groupedRows.length === 0 ? (
                  <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                    Nenhum dado gerencial disponivel para o recorte atual.
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border">
                    <Table className="min-w-[760px]">
                      <TableHeader>
                        <TableRow>
                          <TableHead>Grupo</TableHead>
                          <TableHead className="text-right">Entradas</TableHead>
                          <TableHead className="text-right">Saidas</TableHead>
                          <TableHead className="text-right">Saldo</TableHead>
                          <TableHead className="text-right">Lancamentos</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {groupedRows.map((row) => (
                          <TableRow key={row.key}>
                            <TableCell className="font-medium">{row.label}</TableCell>
                            <TableCell className="text-right text-emerald-600">{cashflowCurrencyFormatter.format(row.income)}</TableCell>
                            <TableCell className="text-right text-destructive">{cashflowCurrencyFormatter.format(row.expense)}</TableCell>
                            <TableCell className={`text-right font-medium ${row.net >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                              {cashflowCurrencyFormatter.format(row.net)}
                            </TableCell>
                            <TableCell className="text-right text-muted-foreground">{row.count}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-border/70">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Clientes com maior atencao</CardTitle>
                <CardDescription>
                  Leitura consultiva unificando saude do caixa, alertas ativos e desorganizacao operacional.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {clientRiskRows.length === 0 ? (
                  <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                    Nenhum cliente critico no momento.
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border">
                    <Table className="min-w-[980px]">
                      <TableHeader>
                        <TableRow>
                          <TableHead>Cliente</TableHead>
                          <TableHead>Setor</TableHead>
                          <TableHead>Saude</TableHead>
                          <TableHead className="text-right">Saldo atual</TableHead>
                          <TableHead className="text-right">Proj. 30 dias</TableHead>
                          <TableHead className="text-right">Alertas</TableHead>
                          <TableHead className="text-right">Pendencias</TableHead>
                          <TableHead>Risco</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {clientRiskRows.map((client) => (
                          <TableRow key={client.id}>
                            <TableCell className="font-medium">{client.name}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">{client.sector}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className={healthStatusMeta[client.healthStatus].className}>
                                {healthStatusMeta[client.healthStatus].label}
                              </Badge>
                            </TableCell>
                            <TableCell className={`text-right font-medium ${client.currentBalance >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                              {cashflowCurrencyFormatter.format(client.currentBalance)}
                            </TableCell>
                            <TableCell className={`text-right font-medium ${client.projectedThirty >= 0 ? "text-foreground" : "text-destructive"}`}>
                              {cashflowCurrencyFormatter.format(client.projectedThirty)}
                            </TableCell>
                            <TableCell className="text-right text-muted-foreground">{client.activeAlerts}</TableCell>
                            <TableCell className="text-right text-muted-foreground">{client.pendingItems}</TableCell>
                            <TableCell>
                              {client.gapAlert ? (
                                <Badge variant="destructive">Gap em {formatDate(client.gapAlert.date)}</Badge>
                              ) : client.topAlertTitle ? (
                                <Badge variant="outline" className="text-amber-700">
                                  {client.topAlertTitle}
                                </Badge>
                              ) : client.projectedThirty < 0 ? (
                                <Badge variant="outline" className="text-amber-600">
                                  Saldo negativo
                                </Badge>
                              ) : (
                                <Badge variant="secondary">Atencao operacional</Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
