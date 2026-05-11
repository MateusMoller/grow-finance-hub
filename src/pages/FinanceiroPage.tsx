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
type FinanceLayer = "operational" | "managerial" | "consultive";

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
  const [clientFilter, setClientFilter] = useState("unselected");
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
        .eq("portal_cashflow_enabled", true)
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
  const enabledClients = useMemo(
    () => clients.filter((client) => client.portal_cashflow_enabled),
    [clients],
  );
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
  const hasSelectedClient = clientFilter !== "unselected";
  const selectedClient = useMemo(
    () => (hasSelectedClient ? clientMap.get(clientFilter) || null : null),
    [clientFilter, clientMap, hasSelectedClient],
  );
  const clientScopedEntries = useMemo(
    () => (hasSelectedClient ? entries.filter((entry) => entry.client_id === clientFilter) : []),
    [clientFilter, entries, hasSelectedClient],
  );
  const clientScopedAccounts = useMemo(
    () => (hasSelectedClient ? accounts.filter((account) => account.client_id === clientFilter) : []),
    [accounts, clientFilter, hasSelectedClient],
  );
  const categories = useMemo(() => getUniqueCashflowCategories(clientScopedEntries), [clientScopedEntries]);
  const duplicateEntryIds = useMemo(() => detectPotentialDuplicateEntryIds(entries), [entries]);
  const normalizedSearch = useMemo(() => normalizeCashflowText(search), [search]);
  const selectedClientSnapshot = useMemo(
    () => (hasSelectedClient ? healthSnapshotMap.get(clientFilter) || null : null),
    [clientFilter, hasSelectedClient, healthSnapshotMap],
  );
  const selectedClientAlerts = useMemo(
    () => (hasSelectedClient ? consultiveAlertsByClient.get(clientFilter) || [] : []),
    [clientFilter, consultiveAlertsByClient, hasSelectedClient],
  );
  const selectedClientRules = useMemo(
    () => (hasSelectedClient ? rules.filter((rule) => !rule.client_id || rule.client_id === clientFilter) : []),
    [clientFilter, hasSelectedClient, rules],
  );
  const activeConsultiveAlertsCount = useMemo(() => selectedClientAlerts.length, [selectedClientAlerts]);
  const activeRulesCount = useMemo(
    () => selectedClientRules.filter((rule) => rule.is_active).length,
    [selectedClientRules],
  );
  const globalRulesCount = useMemo(
    () => selectedClientRules.filter((rule) => !rule.client_id && rule.is_active).length,
    [selectedClientRules],
  );

  const handleClientChange = (value: string) => {
    setClientFilter(value);
    setActiveLayer("operational");
    setQueueFilter("pending_review");
    setSearch("");
    setAccountFilter("all");
    setCategoryFilter("all");
    setEntryTypeFilter("all");
    setOriginFilter("all");
    setLifecycleFilter("all");
    setReviewFilter("all");
    setReconciliationFilter("all");
  };

  const handleReferenceMonthChange = (value: string) => {
    setReferenceMonth(value);
    const bounds = buildMonthBounds(value);
    setPeriodStart(bounds.startDate);
    setPeriodEnd(bounds.endDate);
  };

  const scopedEntries = useMemo(
    () => {
      if (!hasSelectedClient) return [];

      return entries
        .filter((entry) => entry.client_id === clientFilter)
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
        });
    },
    [
      accountFilter,
      accountMap,
      categoryFilter,
      clientFilter,
      clientMap,
      entries,
      entryTypeFilter,
      hasSelectedClient,
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
  const operationalCards = useMemo(
    () => [
      {
        key: "pending_review" as QueueFilter,
        title: "Revisao",
        value: queueCounts.pendingReview,
        helper: "Classificar e aprovar o que ainda esta sem decisao.",
      },
      {
        key: "pending_reconciliation" as QueueFilter,
        title: "Conciliacao",
        value: queueCounts.pendingReconciliation,
        helper: "Tratar extratos e importacoes que ainda nao fecharam.",
      },
      {
        key: "overdue" as QueueFilter,
        title: "Vencidos",
        value: queueCounts.overdue,
        helper: "Prioridade alta para revisar o que ficou em aberto.",
      },
      {
        key: "possible_duplicates" as QueueFilter,
        title: "Duplicidade",
        value: queueCounts.possibleDuplicates,
        helper: "Conferir itens suspeitos antes de distorcer o caixa.",
      },
    ],
    [queueCounts],
  );
  const selectedClientPendingCount = useMemo(
    () => queueCounts.pendingReview + queueCounts.pendingReconciliation + queueCounts.overdue,
    [queueCounts.overdue, queueCounts.pendingReconciliation, queueCounts.pendingReview],
  );
  const selectedClientGapAlert = useMemo(
    () => (hasSelectedClient ? getCashflowGapAlert(clientScopedEntries, 30, todayIso) : null),
    [clientScopedEntries, hasSelectedClient, todayIso],
  );
  const selectedClientHealthStatus = useMemo(() => {
    if (!hasSelectedClient) return null;
    if (selectedClientSnapshot?.health_status) return selectedClientSnapshot.health_status;
    if (selectedClientGapAlert || dashboardMetrics.projectedThirty < 0) return "critico";
    if (selectedClientPendingCount > 0 || selectedClientAlerts.length > 0) return "atencao";
    return "em_dia";
  }, [
    dashboardMetrics.projectedThirty,
    hasSelectedClient,
    selectedClientAlerts.length,
    selectedClientGapAlert,
    selectedClientPendingCount,
    selectedClientSnapshot?.health_status,
  ]);

  useEffect(() => {
    if (clientFilter === "unselected") return;
    if (enabledClients.some((client) => client.id === clientFilter)) return;
    setClientFilter("unselected");
  }, [clientFilter, enabledClients]);

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
                  <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Analise um cliente por vez, com leitura mais limpa e decisao mais criteriosa.</h1>
                  <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-300">
                    O modulo interno agora libera os dados somente depois da escolha do cliente, para manter foco operacional e reduzir poluicao visual.
                  </p>
                </div>
              </div>

              {hasSelectedClient && selectedClientHealthStatus ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 xl:min-w-[430px]">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-slate-300">Cliente em analise</p>
                    <p className="mt-2 text-lg font-semibold text-white">{selectedClient?.name || "Cliente"}</p>
                    <p className="mt-1 text-xs text-slate-300">{selectedClient?.sector || "Sem setor"}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-slate-300">Saldo atual</p>
                    <p className={`mt-2 text-2xl font-semibold ${dashboardMetrics.currentBalance >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
                      {cashflowCurrencyFormatter.format(dashboardMetrics.currentBalance)}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-slate-300">Saude do caixa</p>
                    <p className="mt-2 text-lg font-semibold text-white">{healthStatusMeta[selectedClientHealthStatus].label}</p>
                    <p className="mt-1 text-xs text-slate-300">
                      Projecao 30 dias: {cashflowCurrencyFormatter.format(dashboardMetrics.projectedThirty)}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="xl:min-w-[430px]">
                  <div className="rounded-3xl border border-dashed border-white/20 bg-white/5 p-5">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-slate-300">Passo obrigatorio</p>
                    <p className="mt-2 text-lg font-semibold text-white">Selecione um cliente para abrir a analise.</p>
                    <p className="mt-2 text-sm leading-relaxed text-slate-300">
                      Operacao, gestao e consultivo ficam bloqueados ate essa escolha para forcar uma leitura dedicada por cliente.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {hasSelectedClient ? (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                <MetricCard
                  title="Pendencias operacionais"
                  value={String(queueCounts.pendingReview + queueCounts.pendingReconciliation)}
                  helper="Tudo que precisa de revisao ou conciliacao agora."
                  tone={queueCounts.pendingReview + queueCounts.pendingReconciliation > 0 ? "warning" : "success"}
                />
                <MetricCard
                  title="Vencidos"
                  value={String(queueCounts.overdue)}
                  helper="Itens previstos com vencimento passado."
                  tone={queueCounts.overdue > 0 ? "warning" : "success"}
                />
                <MetricCard
                  title="Projecao 15 dias"
                  value={cashflowCurrencyFormatter.format(dashboardMetrics.projectedFifteen)}
                  helper="Janela curta para negociar prazo, aporte ou prioridade."
                  tone={dashboardMetrics.projectedFifteen >= 0 ? "success" : "danger"}
                />
                <MetricCard
                  title="Alertas consultivos"
                  value={String(activeConsultiveAlertsCount)}
                  helper="Casos que pedem acao da equipe com o cliente."
                  tone={activeConsultiveAlertsCount > 0 ? "warning" : "success"}
                />
              </div>
            ) : null}

          </CardContent>
        </Card>

        <Card className="border-border/70">
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <CardTitle className="text-base">Cliente e recorte</CardTitle>
                <CardDescription>
                  Escolha primeiro o cliente. Os demais filtros so sao liberados depois disso.
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
              <Input
                placeholder="Buscar descricao, conta ou documento"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                disabled={!hasSelectedClient}
              />
            </div>

            <div className="space-y-1.5">
              <Input type="month" value={referenceMonth} onChange={(event) => handleReferenceMonthChange(event.target.value)} disabled={!hasSelectedClient} />
            </div>

            <div className="space-y-1.5">
              <Input type="date" value={periodStart} onChange={(event) => setPeriodStart(event.target.value)} disabled={!hasSelectedClient} />
            </div>

            <div className="space-y-1.5">
              <Input type="date" value={periodEnd} onChange={(event) => setPeriodEnd(event.target.value)} disabled={!hasSelectedClient} />
            </div>

            <Select value={clientFilter} onValueChange={handleClientChange}>
              <SelectTrigger>
                <SelectValue placeholder="Cliente" />
              </SelectTrigger>
            <SelectContent>
                <SelectItem value="unselected">Escolha um cliente</SelectItem>
                {enabledClients.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={accountFilter} onValueChange={setAccountFilter}>
              <SelectTrigger disabled={!hasSelectedClient}>
                <SelectValue placeholder="Conta" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as contas</SelectItem>
                {clientScopedAccounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {formatCashflowAccountLabel(account)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger disabled={!hasSelectedClient}>
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
              <SelectTrigger disabled={!hasSelectedClient}>
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                <SelectItem value="income">Entrada</SelectItem>
                <SelectItem value="expense">Saida</SelectItem>
              </SelectContent>
            </Select>

            <Select value={originFilter} onValueChange={setOriginFilter}>
              <SelectTrigger disabled={!hasSelectedClient}>
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
              <SelectTrigger disabled={!hasSelectedClient}>
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
              <SelectTrigger disabled={!hasSelectedClient}>
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
              <SelectTrigger disabled={!hasSelectedClient}>
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

            <div className="md:col-span-2 xl:col-span-4">
              {hasSelectedClient ? (
                <div className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-muted/20 p-4 md:flex-row md:items-center md:justify-between">
                  <div className="space-y-1">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Cliente em foco</p>
                    <p className="text-sm font-medium">{selectedClient?.name || "Cliente"}</p>
                    <p className="text-xs text-muted-foreground">
                      {selectedClient?.sector || "Sem setor"} â€¢ {clientScopedAccounts.length} conta(s) disponivel(is)
                    </p>
                  </div>
                  <Button type="button" variant="ghost" onClick={() => handleClientChange("unselected")}>
                    Trocar cliente
                  </Button>
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-border/80 bg-muted/10 p-5">
                  <p className="text-sm font-medium">Escolha um cliente para iniciar a leitura.</p>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    A tela fica propositalmente vazia ate essa escolha para evitar comparacoes apressadas e ajudar a equipe a revisar cada operacao com mais criterio.
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {hasSelectedClient ? (
          <Tabs value={activeLayer} onValueChange={(value) => setActiveLayer(value as FinanceLayer)}>
          <TabsList className="grid h-auto w-full grid-cols-1 gap-2 bg-transparent p-0 md:grid-cols-3">
            <TabsTrigger value="operational" className="rounded-xl border px-4 py-3 data-[state=active]:border-primary">
              Operacao
            </TabsTrigger>
            <TabsTrigger value="consultive" className="rounded-xl border px-4 py-3 data-[state=active]:border-primary">
              Consultivo
            </TabsTrigger>
            <TabsTrigger value="managerial" className="rounded-xl border px-4 py-3 data-[state=active]:border-primary">
              Gestao
            </TabsTrigger>
          </TabsList>

          <TabsContent value="operational" className="space-y-6">
            <Card className="border-border/70">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Comece por aqui</CardTitle>
                <CardDescription>Escolha a fila principal do dia e entre direto no trabalho operacional.</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                {operationalCards.map((card) => (
                  <button
                    key={card.key}
                    type="button"
                    onClick={() => setQueueFilter(card.key)}
                    className={`rounded-2xl border p-4 text-left transition ${queueFilter === card.key ? "border-primary bg-primary/5" : "border-border/70 hover:border-primary/40"}`}
                  >
                    <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{card.title}</p>
                    <p className={`mt-2 text-2xl font-semibold ${card.value > 0 ? "text-amber-600" : "text-emerald-600"}`}>{card.value}</p>
                    <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{card.helper}</p>
                  </button>
                ))}
              </CardContent>
            </Card>

            <Card className="border-border/70">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Fila operacional</CardTitle>
                <CardDescription>
                  Trate revisao, conciliacao, vencidos, sem conta e duplicidade sem sair da mesma fila.
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
                                    {entry.counterparty_name ? ` â€¢ ${entry.counterparty_name}` : ""}
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

          <TabsContent value="consultive" className="space-y-6">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                title="Alertas ativos"
                value={String(activeConsultiveAlertsCount)}
                helper="Casos com risco, falha de processo ou necessidade de contato."
                tone="warning"
              />
              <MetricCard
                title="Saude do caixa"
                value={selectedClientHealthStatus ? healthStatusMeta[selectedClientHealthStatus].label : "-"}
                helper="Leitura consolidada entre saldo projetado, alertas e pendencias."
                tone={selectedClientHealthStatus === "critico" ? "danger" : selectedClientHealthStatus === "atencao" ? "warning" : "success"}
              />
              <MetricCard
                title="Pendencias abertas"
                value={String(selectedClientPendingCount)}
                helper="Soma das filas que ainda exigem trabalho da equipe."
                tone={selectedClientPendingCount > 0 ? "warning" : "success"}
              />
              <MetricCard
                title="Regras ativas"
                value={String(activeRulesCount)}
                helper={`${globalRulesCount} globais e ${Math.max(activeRulesCount - globalRulesCount, 0)} por cliente.`}
                tone={activeRulesCount > 0 ? "success" : "default"}
              />
            </div>

            <Card className="border-border/70">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  Alertas e proximos passos
                </CardTitle>
                <CardDescription>
                  O consultivo resume onde a equipe precisa agir com prioridade e contexto.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {selectedClientAlerts.length === 0 ? (
                  <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                    Nenhum alerta consultivo ativo neste momento.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {selectedClientAlerts.slice(0, 8).map((alert) => {
                      const severity = alertSeverityMeta[alert.severity];

                      return (
                        <div key={alert.id} className="rounded-2xl border border-border/70 p-4">
                          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                            <div className="space-y-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-sm font-medium">{alert.title}</p>
                                <Badge variant="outline" className={severity.className}>
                                  {severity.label}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground">{alert.message}</p>
                            </div>
                            <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                              {selectedClient?.name || "Cliente"} • {formatDate(alert.created_at.slice(0, 10))}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-border/70">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  Itens bancarios que ainda afetam a operacao
                </CardTitle>
                <CardDescription>
                  Importacoes e Open Finance que seguem exigindo tratamento antes de estabilizar o processo.
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
                                  {entry.document_ref ? ` â€¢ ${entry.document_ref}` : ""}
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
                <CardTitle className="text-base">Resumo consultivo do cliente</CardTitle>
                <CardDescription>
                  Leia rapidamente o nivel de risco, o gap projetado e o volume de acao necessario para este cliente.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-2xl border border-border/70 p-4">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Cliente</p>
                    <p className="mt-2 text-base font-semibold">{selectedClient?.name || "Cliente"}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{selectedClient?.sector || "Sem setor"}</p>
                  </div>
                  <div className="rounded-2xl border border-border/70 p-4">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Gap projetado</p>
                    <p className={`mt-2 text-base font-semibold ${selectedClientGapAlert ? "text-destructive" : "text-emerald-600"}`}>
                      {selectedClientGapAlert?.date ? formatDate(selectedClientGapAlert.date) : "Sem gap previsto"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {selectedClientGapAlert
                        ? `Saldo projetado de ${cashflowCurrencyFormatter.format(selectedClientGapAlert.projectedBalance)}.`
                        : "Nao ha ruptura de caixa prevista na janela atual."}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-border/70 p-4">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Ultima atividade</p>
                    <p className="mt-2 text-base font-semibold">
                      {formatDate(selectedClientSnapshot?.last_activity_at?.slice(0, 10))}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Cobertura de revisao: {Math.round((selectedClientSnapshot?.review_coverage || 0) * 100)}%
                    </p>
                  </div>
                  <div className="rounded-2xl border border-border/70 p-4">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Alerta principal</p>
                    <p className="mt-2 text-base font-semibold">
                      {selectedClientAlerts[0]?.title || "Nenhum alerta ativo"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {selectedClientAlerts[0]?.message || "Cliente sem alerta consultivo aberto neste momento."}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/70">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Regras automaticas</CardTitle>
                <CardDescription>
                  Configure automacoes depois que a operacao estiver estavel e a classificacao estiver clara.
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
                      {selectedClientRules.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={9} className="py-8 text-center text-sm text-muted-foreground">
                            Nenhuma regra automatica cadastrada.
                          </TableCell>
                        </TableRow>
                      ) : (
                        selectedClientRules.map((rule) => (
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

          </TabsContent>
        </Tabs>
        ) : (
          <Card className="border-border/70">
            <CardContent className="flex flex-col items-center justify-center gap-4 p-10 text-center">
              <div className="rounded-2xl bg-primary/8 p-3 text-primary">
                <Wallet className="h-6 w-6" />
              </div>
              <div className="space-y-2">
                <h2 className="text-lg font-semibold">Nenhum cliente selecionado</h2>
                <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
                  Escolha um cliente no filtro acima para liberar a fila operacional, a leitura gerencial e os alertas consultivos. Assim a equipe analisa cada caixa de forma isolada e sem excesso de informacao.
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}

