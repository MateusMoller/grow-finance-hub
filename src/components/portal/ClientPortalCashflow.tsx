import { type ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  Link2,
  Loader2,
  LockKeyhole,
  Plus,
  RefreshCcw,
  ShieldCheck,
  Trash2,
  TrendingDown,
  TrendingUp,
  Unplug,
  Upload,
  Wallet,
} from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PluggyConnect } from "react-pluggy-connect";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type {
  CashflowAccount,
  CashflowConsultiveAlert,
  CashflowHealthSnapshot,
  NewPortalCashflowEntryPayload,
  OpenFinanceAccount,
  OpenFinanceConnection,
  OpenFinanceSyncStatus,
  PortalCashflowEntry,
  PortalCashflowEntryStatus,
  PortalCashflowEntryType,
} from "@/components/portal/types";
import {
  buildCashflowTrendSeries,
  type CashflowGroupBy,
  cashflowCurrencyFormatter as currencyFormatter,
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
  getUpcomingDueEntries,
  getUniqueCashflowCategories,
  getTodayIsoDate,
  groupCashflowEntries,
  isEntryVisibleInManagerialView,
  normalizeCashflowText,
  toMonthKey,
} from "@/lib/cashflow";
import { parseCashflowFiles, type ParsedCashflowSuggestion } from "@/lib/cashflowImportParser";

type PortalLayer = "operational" | "conciliation" | "managerial";

interface ClientPortalCashflowProps {
  enabled: boolean;
  loading: boolean;
  openFinanceLoading: boolean;
  openFinanceConnecting: boolean;
  openFinanceSyncingConnectionId: string | null;
  openFinanceDisconnectingConnectionId: string | null;
  openFinanceConnections: OpenFinanceConnection[];
  openFinanceAccounts: OpenFinanceAccount[];
  cashflowAccounts: CashflowAccount[];
  entries: PortalCashflowEntry[];
  consultiveAlerts: CashflowConsultiveAlert[];
  healthSnapshot: CashflowHealthSnapshot | null;
  creating: boolean;
  onCreateEntry: (payload: NewPortalCashflowEntryPayload) => Promise<boolean>;
  onCreateEntriesBatch: (
    payloads: NewPortalCashflowEntryPayload[],
  ) => Promise<{ success: boolean; inserted: number }>;
  onCreateOpenFinanceSession: () => Promise<string | null>;
  onManualSyncOpenFinance: (connectionId: string) => Promise<OpenFinanceSyncStatus | null>;
  onDisconnectOpenFinance: (connectionId: string) => Promise<boolean>;
  onRefreshOpenFinance: () => Promise<void>;
  onRequestEnable: () => void;
}

interface ImportDraftRow {
  id: string;
  selected: boolean;
  entryDate: string;
  entryType: PortalCashflowEntryType;
  category: string;
  description: string;
  amountText: string;
  status: PortalCashflowEntryStatus;
  sourceFile: string;
  sourceLine: string;
  confidence: number;
}

function MetricCard({
  title,
  value,
  helper,
  tone = "default",
}: {
  title: string;
  value: string;
  helper: string;
  tone?: "default" | "success" | "warning" | "danger";
}) {
  const valueClassName =
    tone === "success"
      ? "text-emerald-600"
      : tone === "warning"
        ? "text-amber-600"
        : tone === "danger"
          ? "text-destructive"
          : "text-foreground";

  return (
    <Card className="border-border/70 bg-card/95">
      <CardContent className="p-4">
        <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{title}</p>
        <p className={`mt-2 text-2xl font-semibold ${valueClassName}`}>{value}</p>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{helper}</p>
      </CardContent>
    </Card>
  );
}

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

  if (!year || !month) {
    const today = new Date();
    const fallback = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
    return buildMonthBounds(fallback);
  }

  const firstDay = `${monthKey}-01`;
  const lastDay = new Date(year, month, 0);
  return {
    startDate: firstDay,
    endDate: toLocalDateInput(lastDay),
  };
};

const formatDate = (dateString: string | null | undefined) =>
  dateString ? new Date(`${dateString}T00:00:00`).toLocaleDateString("pt-BR") : "-";

const formatMoney = (amount: number) => currencyFormatter.format(amount);

const formatConnectionStatus = (status: string) => {
  const token = String(status || "").trim().toLowerCase();
  if (token === "active") return "Ativa";
  if (token === "pending_consent") return "Pendente de consentimento";
  if (token === "inactive") return "Inativa";
  if (token === "error") return "Erro";
  return "Desconhecida";
};

const formatConsentStatus = (status: string) => {
  const token = String(status || "").trim().toLowerCase();
  if (token === "granted") return "Consentimento ativo";
  if (token === "pending") return "Aguardando consentimento";
  if (token === "revoked") return "Consentimento revogado";
  if (token === "expired") return "Consentimento expirado";
  return "Consentimento nao informado";
};

const suggestionToDraftRow = (suggestion: ParsedCashflowSuggestion, index: number): ImportDraftRow => ({
  id: `${suggestion.sourceFile}-${index}-${suggestion.entryDate}`,
  selected: true,
  entryDate: suggestion.entryDate,
  entryType: suggestion.entryType,
  category: suggestion.category,
  description: suggestion.description,
  amountText: suggestion.amount.toFixed(2),
  status: suggestion.confidence >= 0.98 ? "confirmed" : "predicted",
  sourceFile: suggestion.sourceFile,
  sourceLine: suggestion.sourceLine,
  confidence: suggestion.confidence,
});

export function ClientPortalCashflow({
  enabled,
  loading,
  openFinanceLoading,
  openFinanceConnecting,
  openFinanceSyncingConnectionId,
  openFinanceDisconnectingConnectionId,
  openFinanceConnections,
  openFinanceAccounts,
  cashflowAccounts,
  entries,
  consultiveAlerts,
  healthSnapshot,
  creating,
  onCreateEntry,
  onCreateEntriesBatch,
  onCreateOpenFinanceSession,
  onManualSyncOpenFinance,
  onDisconnectOpenFinance,
  onRefreshOpenFinance,
  onRequestEnable,
}: ClientPortalCashflowProps) {
  const today = useMemo(() => new Date(), []);
  const todayIso = useMemo(() => getTodayIsoDate(), []);
  const initialMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  const initialMonthBounds = useMemo(() => buildMonthBounds(initialMonth), [initialMonth]);

  const [activeLayer, setActiveLayer] = useState<PortalLayer>("operational");
  const [referenceMonth, setReferenceMonth] = useState(initialMonth);
  const [periodStart, setPeriodStart] = useState(initialMonthBounds.startDate);
  const [periodEnd, setPeriodEnd] = useState(initialMonthBounds.endDate);
  const [search, setSearch] = useState("");
  const [accountFilter, setAccountFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [entryTypeFilter, setEntryTypeFilter] = useState<PortalCashflowEntryType | "all">("all");
  const [originFilter, setOriginFilter] = useState("all");
  const [lifecycleFilter, setLifecycleFilter] = useState("all");
  const [reconciliationFilter, setReconciliationFilter] = useState("all");
  const [managerialGroupBy, setManagerialGroupBy] = useState<CashflowGroupBy>("category");

  const [entryDueDate, setEntryDueDate] = useState(() => toLocalDateInput(today));
  const [entryEffectiveDate, setEntryEffectiveDate] = useState(() => toLocalDateInput(today));
  const [entryType, setEntryType] = useState<PortalCashflowEntryType>("income");
  const [entryCategory, setEntryCategory] = useState("Recebimento de clientes");
  const [entryStatus, setEntryStatus] = useState<PortalCashflowEntryStatus>("confirmed");
  const [entryDescription, setEntryDescription] = useState("");
  const [entryAmount, setEntryAmount] = useState("");
  const [entryCounterparty, setEntryCounterparty] = useState("");
  const [entryDocumentRef, setEntryDocumentRef] = useState("");
  const [entryNotes, setEntryNotes] = useState("");
  const [entryAccountId, setEntryAccountId] = useState<string>("none");

  const [importAccountId, setImportAccountId] = useState<string>("none");
  const [importFiles, setImportFiles] = useState<File[]>([]);
  const [parsingImport, setParsingImport] = useState(false);
  const [importingDrafts, setImportingDrafts] = useState(false);
  const [importDrafts, setImportDrafts] = useState<ImportDraftRow[]>([]);
  const [pluggyConnectToken, setPluggyConnectToken] = useState<string | null>(null);

  const importFileInputRef = useRef<HTMLInputElement>(null);

  const accountMap = useMemo(() => getCashflowAccountMap(cashflowAccounts), [cashflowAccounts]);
  const activeCashflowAccounts = useMemo(
    () => cashflowAccounts.filter((account) => account.is_active),
    [cashflowAccounts],
  );
  const primaryAccountId = useMemo(
    () => activeCashflowAccounts.find((account) => account.is_primary)?.id || activeCashflowAccounts[0]?.id || "none",
    [activeCashflowAccounts],
  );
  const accountsByConnection = useMemo(() => {
    const map = new Map<string, OpenFinanceAccount[]>();
    openFinanceAccounts.forEach((account) => {
      const collection = map.get(account.connection_id) || [];
      collection.push(account);
      map.set(account.connection_id, collection);
    });
    return map;
  }, [openFinanceAccounts]);

  const categories = useMemo(() => getUniqueCashflowCategories(entries), [entries]);
  const normalizedSearch = useMemo(() => normalizeCashflowText(search), [search]);
  const activeConsultiveAlerts = useMemo(
    () => consultiveAlerts.filter((alert) => alert.status === "active").slice(0, 3),
    [consultiveAlerts],
  );
  const healthStatusMeta = useMemo(() => {
    if (healthSnapshot?.health_status === "critico") {
      return {
        label: "Critico",
        className: "border-rose-200 bg-rose-50 text-rose-700",
      };
    }
    if (healthSnapshot?.health_status === "atencao") {
      return {
        label: "Atencao",
        className: "border-amber-200 bg-amber-50 text-amber-700",
      };
    }
    return {
      label: "Em dia",
      className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    };
  }, [healthSnapshot]);

  useEffect(() => {
    setEntryAccountId((current) => (current === "none" ? primaryAccountId : current));
    setImportAccountId((current) => (current === "none" ? primaryAccountId : current));
  }, [primaryAccountId]);

  const handleReferenceMonthChange = (value: string) => {
    setReferenceMonth(value);
    const monthBounds = buildMonthBounds(value);
    setPeriodStart(monthBounds.startDate);
    setPeriodEnd(monthBounds.endDate);
  };

  const analysisEntries = useMemo(
    () =>
      entries
        .filter((entry) => accountFilter === "all" || entry.account_id === accountFilter)
        .filter((entry) => categoryFilter === "all" || entry.category === categoryFilter)
        .filter((entry) => entryTypeFilter === "all" || entry.entry_type === entryTypeFilter)
        .filter((entry) => originFilter === "all" || (entry.origin_type || "manual") === originFilter),
    [accountFilter, categoryFilter, entries, entryTypeFilter, originFilter],
  );

  const filteredEntries = useMemo(
    () =>
      analysisEntries
        .filter((entry) => {
          const referenceDate = getEntryReferenceDate(entry);
          if (periodStart && referenceDate < periodStart) return false;
          if (periodEnd && referenceDate > periodEnd) return false;
          return true;
        })
        .filter((entry) => lifecycleFilter === "all" || getEntryLifecycleStatus(entry) === lifecycleFilter)
        .filter(
          (entry) => reconciliationFilter === "all" || (entry.reconciliation_status || "not_applicable") === reconciliationFilter,
        )
        .filter((entry) => {
          if (!normalizedSearch) return true;

          const accountLabel = formatCashflowAccountLabel(accountMap.get(entry.account_id || ""));
          const searchable = [
            entry.description,
            entry.category,
            entry.counterparty_name || "",
            entry.document_ref || "",
            accountLabel,
          ]
            .map((value) => normalizeCashflowText(value))
            .join(" ");

          return searchable.includes(normalizedSearch);
        })
        .sort((left, right) => {
          const dateDiff = getEntryReferenceDate(right).localeCompare(getEntryReferenceDate(left));
          if (dateDiff !== 0) return dateDiff;
          return right.created_at.localeCompare(left.created_at);
        }),
    [
      accountMap,
      analysisEntries,
      lifecycleFilter,
      normalizedSearch,
      periodEnd,
      periodStart,
      reconciliationFilter,
    ],
  );

  const managerialEntries = useMemo(
    () => filteredEntries.filter((entry) => isEntryVisibleInManagerialView(entry)),
    [filteredEntries],
  );

  const conciliationEntries = useMemo(
    () =>
      analysisEntries
        .filter((entry) => (entry.origin_type || "manual") !== "manual")
        .filter(
          (entry) =>
            entry.review_status === "pending_review" ||
            entry.review_status === "classified" ||
            entry.reconciliation_status === "pending" ||
            entry.reconciliation_status === "suggested",
        )
        .sort((left, right) => getEntryDueDate(left).localeCompare(getEntryDueDate(right))),
    [analysisEntries],
  );

  const dashboardMetrics = useMemo(() => {
    const currentBalance = getCurrentCashBalance(analysisEntries, todayIso);
    const projectedSeven = getProjectedBalanceAtHorizon(analysisEntries, 7, todayIso);
    const projectedFifteen = getProjectedBalanceAtHorizon(analysisEntries, 15, todayIso);
    const projectedThirty = getProjectedBalanceAtHorizon(analysisEntries, 30, todayIso);
    const upcomingDueEntries = getUpcomingDueEntries(analysisEntries, 7, todayIso);
    const upcomingDueAmount = upcomingDueEntries.reduce((sum, entry) => sum + Math.abs(entry.amount), 0);
    const topFutureExpenses = getTopFutureExpenses(analysisEntries, 30, 5, todayIso);
    const gapAlert = getCashflowGapAlert(analysisEntries, 30, todayIso);

    return {
      currentBalance,
      projectedSeven,
      projectedFifteen,
      projectedThirty,
      upcomingDueEntries,
      upcomingDueAmount,
      topFutureExpenses,
      gapAlert,
    };
  }, [analysisEntries, todayIso]);

  const trendSeries = useMemo(() => buildCashflowTrendSeries(managerialEntries, periodStart, periodEnd), [
    managerialEntries,
    periodEnd,
    periodStart,
  ]);

  const groupedRows = useMemo(
    () =>
      groupCashflowEntries(managerialEntries, managerialGroupBy, {
        accountMap,
      }),
    [accountMap, managerialEntries, managerialGroupBy],
  );

  const expenseByCategory = useMemo(
    () =>
      groupCashflowEntries(
        managerialEntries.filter((entry) => entry.entry_type === "expense"),
        "category",
      ).slice(0, 6),
    [managerialEntries],
  );

  const monthlyEntries = useMemo(
    () => entries.filter((entry) => toMonthKey(getEntryReferenceDate(entry)) === referenceMonth),
    [entries, referenceMonth],
  );

  const selectedDrafts = useMemo(() => importDrafts.filter((draft) => draft.selected), [importDrafts]);

  const handleTypeChange = (value: PortalCashflowEntryType) => {
    setEntryType(value);
    if (value === "income") {
      setEntryCategory("Recebimento de clientes");
      return;
    }
    setEntryCategory("Fornecedores");
  };

  const resetGuidedEntry = () => {
    setEntryDueDate(todayIso);
    setEntryEffectiveDate(todayIso);
    setEntryType("income");
    setEntryCategory("Recebimento de clientes");
    setEntryStatus("confirmed");
    setEntryDescription("");
    setEntryAmount("");
    setEntryCounterparty("");
    setEntryDocumentRef("");
    setEntryNotes("");
    setEntryAccountId(primaryAccountId);
  };

  const handleCreateOpenFinanceSession = async () => {
    if (!enabled) {
      toast.error("Este modulo ainda nao foi liberado para este cliente.");
      return;
    }

    const sessionToken = await onCreateOpenFinanceSession();
    if (!sessionToken) return;

    setPluggyConnectToken(sessionToken);
    toast.success("Sessao de conexao iniciada. Finalize o consentimento no fluxo do banco.");
  };

  const handleManualSyncOpenFinance = async (connectionId: string) => {
    const result = await onManualSyncOpenFinance(connectionId);
    if (!result) return;

    toast.success(
      `Sincronizacao concluida: ${result.syncedTransactions} transacoes e ${result.importedEntries} lancamentos importados.`,
    );
  };

  const handleDisconnectOpenFinance = async (connectionId: string) => {
    const success = await onDisconnectOpenFinance(connectionId);
    if (!success) return;
    toast.success("Conta desconectada. O historico do caixa foi preservado.");
  };

  const handleCreateEntry = async () => {
    if (!enabled) {
      toast.error("Este modulo ainda nao foi liberado para este cliente.");
      return;
    }

    const normalizedDescription = entryDescription.trim();
    const normalizedAmount = Number(entryAmount.replace(",", "."));
    if (normalizedDescription.length < 3) {
      toast.error("Descreva o lancamento com pelo menos 3 caracteres.");
      return;
    }
    if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
      toast.error("Informe um valor valido maior que zero.");
      return;
    }

    const dueDate = entryDueDate;
    const effectiveDate = entryStatus === "confirmed" ? entryEffectiveDate || dueDate : null;

    const success = await onCreateEntry({
      entry_date: dueDate,
      due_date: dueDate,
      effective_date: effectiveDate,
      competence_month: `${dueDate.slice(0, 7)}-01`,
      account_id: entryAccountId === "none" ? null : entryAccountId,
      entry_type: entryType,
      category: entryCategory,
      description: normalizedDescription,
      amount: Number(normalizedAmount.toFixed(2)),
      status: entryStatus,
      lifecycle_status: entryStatus === "confirmed" ? "confirmed" : "predicted",
      origin_type: "manual",
      reconciliation_status: "not_applicable",
      review_status: "pending_review",
      counterparty_name: entryCounterparty.trim() || null,
      document_ref: entryDocumentRef.trim() || null,
      notes: entryNotes.trim() || null,
    });

    if (!success) return;

    toast.success("Lancamento registrado.");
    resetGuidedEntry();
  };

  const handleImportFileSelection = (event: ChangeEvent<HTMLInputElement>) => {
    setImportFiles(Array.from(event.target.files || []));
  };

  const removeImportFile = (index: number) => {
    setImportFiles((currentFiles) => currentFiles.filter((_, fileIndex) => fileIndex !== index));
  };

  const clearImportData = () => {
    setImportFiles([]);
    setImportDrafts([]);
    if (importFileInputRef.current) {
      importFileInputRef.current.value = "";
    }
  };

  const updateImportDraft = (id: string, updater: (draft: ImportDraftRow) => ImportDraftRow) => {
    setImportDrafts((currentDrafts) =>
      currentDrafts.map((draft) => (draft.id === id ? updater(draft) : draft)),
    );
  };

  const handleDraftTypeChange = (id: string, type: PortalCashflowEntryType) => {
    updateImportDraft(id, (draft) => ({
      ...draft,
      entryType: type,
      category: type === "income" ? "Recebimento de clientes" : "Fornecedores",
    }));
  };

  const handleParseImportFiles = async () => {
    if (!enabled) {
      toast.error("Este modulo ainda nao foi liberado para este cliente.");
      return;
    }
    if (importFiles.length === 0) {
      toast.error("Selecione ao menos um arquivo para importar.");
      return;
    }

    setParsingImport(true);
    const result = await parseCashflowFiles(importFiles);
    setParsingImport(false);

    result.warnings.forEach((warning) => toast.warning(warning));

    if (result.entries.length === 0) {
      setImportDrafts([]);
      return;
    }

    setImportDrafts(result.entries.map((entry, index) => suggestionToDraftRow(entry, index)));
    toast.success(`${result.entries.length} sugestoes geradas para revisao.`);
  };

  const handleImportSelectedDrafts = async () => {
    if (!enabled) {
      toast.error("Este modulo ainda nao foi liberado para este cliente.");
      return;
    }
    if (selectedDrafts.length === 0) {
      toast.error("Selecione ao menos um lancamento sugerido.");
      return;
    }

    const payloads: NewPortalCashflowEntryPayload[] = [];

    for (const draft of selectedDrafts) {
      const description = draft.description.trim();
      const amount = Number(draft.amountText.replace(",", "."));

      if (!draft.entryDate) {
        toast.error("Toda sugestao precisa ter uma data.");
        return;
      }
      if (description.length < 3) {
        toast.error(`Descricao invalida em ${draft.sourceFile}.`);
        return;
      }
      if (!Number.isFinite(amount) || amount <= 0) {
        toast.error(`Valor invalido em ${draft.sourceFile}.`);
        return;
      }

      payloads.push({
        entry_date: draft.entryDate,
        due_date: draft.entryDate,
        effective_date: draft.status === "confirmed" ? draft.entryDate : null,
        competence_month: `${draft.entryDate.slice(0, 7)}-01`,
        account_id: importAccountId === "none" ? null : importAccountId,
        entry_type: draft.entryType,
        category: draft.category,
        description,
        amount: Number(amount.toFixed(2)),
        status: draft.status,
        lifecycle_status: draft.status === "confirmed" ? "confirmed" : "predicted",
        origin_type: "import_file",
        reconciliation_status: "pending",
        review_status: "pending_review",
      });
    }

    setImportingDrafts(true);
    const result = await onCreateEntriesBatch(payloads);
    setImportingDrafts(false);

    if (!result.success) return;

    const latestImportedDate = payloads.map((payload) => payload.entry_date).sort().at(-1);
    if (latestImportedDate) {
      handleReferenceMonthChange(latestImportedDate.slice(0, 7));
    }

    toast.success(`${result.inserted} lancamento(s) importado(s).`);
    clearImportData();
    setActiveLayer("conciliation");
  };

  if (!enabled) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <LockKeyhole className="h-4 w-4 text-amber-600" />
            Controle de caixa bloqueado
          </CardTitle>
          <CardDescription>
            O acesso a este modulo depende de liberacao do admin. Quando estiver ativo, voce podera acompanhar saldo,
            previsoes, conciliacao e pendencias operacionais.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <Button type="button" onClick={onRequestEnable}>
            Solicitar liberacao do controle de caixa
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex h-48 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-slate-200/80 bg-gradient-to-br from-stone-50 via-white to-slate-100 text-slate-950 shadow-sm">
        <CardContent className="space-y-6 p-6">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="w-fit border border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-50">Fluxo de caixa Grow</Badge>
                <Badge variant="outline" className={healthStatusMeta.className}>
                  Saude do caixa: {healthStatusMeta.label}
                </Badge>
              </div>
              <div>
                <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Caixa organizado em operacao, conciliacao e gestao.</h2>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
                  Acompanhe o caixa atual, visualize o saldo projetado e resolva pendencias sem sair do portal.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 xl:min-w-[420px]">
              <div className="rounded-2xl border border-slate-200/80 bg-white/85 p-4 shadow-[0_10px_30px_-20px_rgba(15,23,42,0.35)] backdrop-blur">
                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Saldo atual</p>
                <p className={`mt-2 text-2xl font-semibold ${dashboardMetrics.currentBalance >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                  {formatMoney(dashboardMetrics.currentBalance)}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200/80 bg-white/85 p-4 shadow-[0_10px_30px_-20px_rgba(15,23,42,0.35)] backdrop-blur">
                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Projecao 15 dias</p>
                <p className={`mt-2 text-2xl font-semibold ${dashboardMetrics.projectedFifteen >= 0 ? "text-sky-700" : "text-rose-600"}`}>
                  {formatMoney(dashboardMetrics.projectedFifteen)}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200/80 bg-white/85 p-4 shadow-[0_10px_30px_-20px_rgba(15,23,42,0.35)] backdrop-blur">
                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Pendencias</p>
                <p className="mt-2 text-2xl font-semibold text-amber-600">{conciliationEntries.length}</p>
                <p className="mt-1 text-xs text-slate-600">Itens esperando revisao ou conciliacao</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              title="Saldo projetado 7 dias"
              value={formatMoney(dashboardMetrics.projectedSeven)}
              helper="Saldo esperado considerando previstos e vencidos ainda em aberto."
              tone={dashboardMetrics.projectedSeven >= 0 ? "success" : "danger"}
            />
            <MetricCard
              title="Saldo projetado 15 dias"
              value={formatMoney(dashboardMetrics.projectedFifteen)}
              helper="Visao intermediaria para negociar prazos e reforcar caixa."
              tone={dashboardMetrics.projectedFifteen >= 0 ? "success" : "danger"}
            />
            <MetricCard
              title="Saldo projetado 30 dias"
              value={formatMoney(dashboardMetrics.projectedThirty)}
              helper="Leitura do mes para antecipar folga ou estresse de caixa."
              tone={dashboardMetrics.projectedThirty >= 0 ? "success" : "danger"}
            />
            <MetricCard
              title="Contas a vencer"
              value={`${dashboardMetrics.upcomingDueEntries.length}`}
              helper={`${formatMoney(dashboardMetrics.upcomingDueAmount)} previstos nos proximos 7 dias.`}
              tone={dashboardMetrics.upcomingDueEntries.length > 0 ? "warning" : "success"}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.4fr_0.9fr]">
            <div className="rounded-2xl border border-slate-200/80 bg-white/78 p-4 backdrop-blur">
              <div className="flex items-center gap-2 text-sm font-medium">
                <TrendingDown className="h-4 w-4 text-amber-600" />
                Maiores saidas futuras
              </div>
              <div className="mt-4 space-y-3">
                {dashboardMetrics.topFutureExpenses.length === 0 ? (
                  <p className="text-sm text-slate-600">Nenhuma saida relevante prevista nos proximos 30 dias.</p>
                ) : (
                  dashboardMetrics.topFutureExpenses.map((entry) => (
                    <div key={entry.id} className="flex items-start justify-between gap-3 border-b border-slate-200/80 pb-3 last:border-b-0 last:pb-0">
                      <div>
                        <p className="text-sm font-medium text-slate-900">{entry.description}</p>
                        <p className="text-xs text-slate-500">
                          {formatDate(getEntryDueDate(entry))} • {entry.category}
                        </p>
                      </div>
                      <p className="text-sm font-semibold text-rose-600">{formatMoney(entry.amount)}</p>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-white/78 p-4 backdrop-blur">
              <div className="flex items-center gap-2 text-sm font-medium">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                Alerta de caixa
              </div>
              {dashboardMetrics.gapAlert ? (
                <div className="mt-4 space-y-3">
                  <p className="text-sm text-slate-700">
                    O saldo projetado fica negativo em <span className="font-semibold">{formatDate(dashboardMetrics.gapAlert.date)}</span>.
                  </p>
                  <p className="text-2xl font-semibold text-rose-600">{formatMoney(dashboardMetrics.gapAlert.balance)}</p>
                  <p className="text-xs leading-relaxed text-slate-600">
                    Revise as saidas futuras, antecipe recebimentos ou reorganize prazos antes desta data.
                  </p>
                </div>
              ) : (
                <div className="mt-4 space-y-2">
                  <p className="text-sm text-emerald-700">Nenhum buraco de caixa projetado nos proximos 30 dias.</p>
                  <p className="text-xs leading-relaxed text-slate-600">
                    Continue acompanhando entradas previstas, conciliacoes pendentes e despesas de maior impacto.
                  </p>
                </div>
              )}
            </div>
          </div>

          {activeConsultiveAlerts.length > 0 ? (
            <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
              {activeConsultiveAlerts.map((alert) => (
                <div key={alert.id} className="rounded-2xl border border-slate-200/80 bg-white/78 p-4 backdrop-blur">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-slate-900">{alert.title}</p>
                    <Badge
                      variant="outline"
                      className={
                        alert.severity === "critical"
                          ? "border-rose-200 bg-rose-50 text-rose-700"
                          : "border-amber-200 bg-amber-50 text-amber-700"
                      }
                    >
                      {alert.severity === "critical" ? "Critico" : "Atencao"}
                    </Badge>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-slate-600">{alert.message}</p>
                </div>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <CardTitle className="text-base">Filtros e periodo</CardTitle>
              <CardDescription>
                Ajuste a leitura operacional e gerencial do caixa sem perder a visao das pendencias.
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => handleReferenceMonthChange(initialMonth)}>
                Mes atual
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setSearch("")}>
                Limpar busca
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Mes de referencia</Label>
            <Input type="month" value={referenceMonth} onChange={(event) => handleReferenceMonthChange(event.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Periodo inicial</Label>
            <Input type="date" value={periodStart} onChange={(event) => setPeriodStart(event.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Periodo final</Label>
            <Input type="date" value={periodEnd} onChange={(event) => setPeriodEnd(event.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Busca</Label>
            <Input
              placeholder="Descricao, conta, categoria ou documento"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Conta</Label>
            <Select value={accountFilter} onValueChange={setAccountFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Todas as contas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as contas</SelectItem>
                {activeCashflowAccounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {formatCashflowAccountLabel(account)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Categoria</Label>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Todas as categorias" />
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
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Tipo</Label>
            <Select value={entryTypeFilter} onValueChange={(value) => setEntryTypeFilter(value as PortalCashflowEntryType | "all")}>
              <SelectTrigger>
                <SelectValue placeholder="Todos os tipos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                <SelectItem value="income">Entrada</SelectItem>
                <SelectItem value="expense">Saida</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Origem</Label>
            <Select value={originFilter} onValueChange={setOriginFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Todas as origens" />
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
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Situacao</Label>
            <Select value={lifecycleFilter} onValueChange={setLifecycleFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Todas as situacoes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as situacoes</SelectItem>
                <SelectItem value="predicted">Previsto</SelectItem>
                <SelectItem value="due">Vence hoje</SelectItem>
                <SelectItem value="overdue">Vencido</SelectItem>
                <SelectItem value="confirmed">Confirmado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Conciliacao</Label>
            <Select value={reconciliationFilter} onValueChange={setReconciliationFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Todas as situacoes" />
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
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeLayer} onValueChange={(value) => setActiveLayer(value as PortalLayer)}>
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
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <Card className="border-border/70">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <CircleDollarSign className="h-4 w-4 text-primary" />
                  Lancamento guiado
                </CardTitle>
                <CardDescription>
                  Registre o caixa com vencimento, data efetiva, conta, contraparte e observacoes.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Tipo</Label>
                    <Select value={entryType} onValueChange={(value) => handleTypeChange(value as PortalCashflowEntryType)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="income">Entrada</SelectItem>
                        <SelectItem value="expense">Saida</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Conta</Label>
                    <Select value={entryAccountId} onValueChange={setEntryAccountId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a conta" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sem conta definida</SelectItem>
                        {activeCashflowAccounts.map((account) => (
                          <SelectItem key={account.id} value={account.id}>
                            {formatCashflowAccountLabel(account)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Vencimento</Label>
                    <Input type="date" value={entryDueDate} onChange={(event) => setEntryDueDate(event.target.value)} />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Data efetiva</Label>
                    <Input
                      type="date"
                      value={entryStatus === "confirmed" ? entryEffectiveDate : ""}
                      onChange={(event) => setEntryEffectiveDate(event.target.value)}
                      disabled={entryStatus !== "confirmed"}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Categoria</Label>
                    <Input value={entryCategory} onChange={(event) => setEntryCategory(event.target.value)} />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Status</Label>
                    <Select value={entryStatus} onValueChange={(value) => setEntryStatus(value as PortalCashflowEntryStatus)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="confirmed">Confirmado</SelectItem>
                        <SelectItem value="predicted">Previsto</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5 md:col-span-2">
                    <Label className="text-xs">Descricao</Label>
                    <Input
                      value={entryDescription}
                      onChange={(event) => setEntryDescription(event.target.value)}
                      placeholder="Ex.: Recebimento da parcela 2 do cliente X"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Valor (R$)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={entryAmount}
                      onChange={(event) => setEntryAmount(event.target.value)}
                      placeholder="0,00"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Contraparte</Label>
                    <Input
                      value={entryCounterparty}
                      onChange={(event) => setEntryCounterparty(event.target.value)}
                      placeholder="Cliente, banco ou fornecedor"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Documento</Label>
                    <Input
                      value={entryDocumentRef}
                      onChange={(event) => setEntryDocumentRef(event.target.value)}
                      placeholder="NF, recibo, contrato ou referencia interna"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Observacao</Label>
                    <Textarea
                      value={entryNotes}
                      onChange={(event) => setEntryNotes(event.target.value)}
                      className="min-h-[46px]"
                      placeholder="Detalhes que ajudem a Grow a revisar este item."
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                  <Button type="button" variant="ghost" onClick={resetGuidedEntry}>
                    Limpar
                  </Button>
                  <Button type="button" onClick={() => void handleCreateEntry()} disabled={creating} className="gap-2">
                    {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    {creating ? "Registrando..." : "Registrar lancamento"}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-6">
              <Card className="border-border/70">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Upload className="h-4 w-4 text-primary" />
                    Importacao assistida
                  </CardTitle>
                  <CardDescription>
                    Gere sugestoes a partir de arquivos e envie para a mesma fila de revisao da conciliacao.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
                    <Input ref={importFileInputRef} type="file" multiple onChange={handleImportFileSelection} />
                    <Button
                      type="button"
                      className="gap-2"
                      onClick={() => void handleParseImportFiles()}
                      disabled={parsingImport || importFiles.length === 0}
                    >
                      {parsingImport ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                      {parsingImport ? "Lendo..." : "Gerar sugestoes"}
                    </Button>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Conta de destino</Label>
                    <Select value={importAccountId} onValueChange={setImportAccountId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a conta" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sem conta definida</SelectItem>
                        {activeCashflowAccounts.map((account) => (
                          <SelectItem key={account.id} value={account.id}>
                            {formatCashflowAccountLabel(account)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {importFiles.length > 0 ? (
                    <div className="rounded-xl border p-3">
                      <p className="mb-2 text-xs font-medium text-muted-foreground">Arquivos selecionados</p>
                      <div className="flex flex-wrap gap-2">
                        {importFiles.map((file, index) => (
                          <Badge key={`${file.name}-${index}`} variant="secondary" className="gap-1.5 py-1.5">
                            {file.name}
                            <button type="button" onClick={() => removeImportFile(index)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {importDrafts.length > 0 ? (
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs text-muted-foreground">
                          {selectedDrafts.length} de {importDrafts.length} sugestoes selecionadas
                        </p>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setImportDrafts((current) => current.map((draft) => ({ ...draft, selected: true })))}
                          >
                            Selecionar tudo
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setImportDrafts((current) => current.map((draft) => ({ ...draft, selected: false })))}
                          >
                            Limpar selecao
                          </Button>
                        </div>
                      </div>

                      <div className="overflow-x-auto rounded-xl border">
                        <Table className="min-w-[760px]">
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-10">Ok</TableHead>
                              <TableHead>Data</TableHead>
                              <TableHead>Tipo</TableHead>
                              <TableHead>Categoria</TableHead>
                              <TableHead>Descricao</TableHead>
                              <TableHead>Valor</TableHead>
                              <TableHead>Status</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {importDrafts.map((draft) => (
                              <TableRow key={draft.id}>
                                <TableCell>
                                  <input
                                    type="checkbox"
                                    checked={draft.selected}
                                    className="h-4 w-4 rounded border-input bg-background"
                                    onChange={(event) =>
                                      updateImportDraft(draft.id, (currentDraft) => ({
                                        ...currentDraft,
                                        selected: event.target.checked,
                                      }))
                                    }
                                  />
                                </TableCell>
                                <TableCell>
                                  <Input
                                    type="date"
                                    value={draft.entryDate}
                                    onChange={(event) =>
                                      updateImportDraft(draft.id, (currentDraft) => ({
                                        ...currentDraft,
                                        entryDate: event.target.value,
                                      }))
                                    }
                                  />
                                </TableCell>
                                <TableCell>
                                  <Select value={draft.entryType} onValueChange={(value) => handleDraftTypeChange(draft.id, value as PortalCashflowEntryType)}>
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="income">Entrada</SelectItem>
                                      <SelectItem value="expense">Saida</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </TableCell>
                                <TableCell>
                                  <Input
                                    value={draft.category}
                                    onChange={(event) =>
                                      updateImportDraft(draft.id, (currentDraft) => ({
                                        ...currentDraft,
                                        category: event.target.value,
                                      }))
                                    }
                                  />
                                </TableCell>
                                <TableCell>
                                  <Input
                                    value={draft.description}
                                    onChange={(event) =>
                                      updateImportDraft(draft.id, (currentDraft) => ({
                                        ...currentDraft,
                                        description: event.target.value,
                                      }))
                                    }
                                  />
                                </TableCell>
                                <TableCell>
                                  <Input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={draft.amountText}
                                    onChange={(event) =>
                                      updateImportDraft(draft.id, (currentDraft) => ({
                                        ...currentDraft,
                                        amountText: event.target.value,
                                      }))
                                    }
                                  />
                                </TableCell>
                                <TableCell>
                                  <div className="space-y-2">
                                    <Select
                                      value={draft.status}
                                      onValueChange={(value) =>
                                        updateImportDraft(draft.id, (currentDraft) => ({
                                          ...currentDraft,
                                          status: value as PortalCashflowEntryStatus,
                                        }))
                                      }
                                    >
                                      <SelectTrigger>
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="confirmed">Confirmado</SelectItem>
                                        <SelectItem value="predicted">Previsto</SelectItem>
                                      </SelectContent>
                                    </Select>
                                    <p className="text-[11px] text-muted-foreground">
                                      {draft.sourceFile} • confianca {Math.round(draft.confidence * 100)}%
                                    </p>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>

                      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                        <Button type="button" variant="ghost" onClick={clearImportData} disabled={parsingImport || importingDrafts}>
                          Limpar
                        </Button>
                        <Button
                          type="button"
                          className="gap-2"
                          disabled={selectedDrafts.length === 0 || importingDrafts}
                          onClick={() => void handleImportSelectedDrafts()}
                        >
                          {importingDrafts ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                          {importingDrafts ? "Importando..." : `Importar selecionados (${selectedDrafts.length})`}
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </CardContent>
              </Card>

              <Card className="border-border/70">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Link2 className="h-4 w-4 text-primary" />
                    Open Finance
                  </CardTitle>
                  <CardDescription>
                    Conecte o banco, acompanhe sincronizacoes e preserve o historico importado no caixa.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      O consentimento acontece no fluxo seguro do banco. Depois disso, os extratos entram na revisao do caixa.
                    </p>
                    <Button
                      type="button"
                      className="gap-2"
                      onClick={() => void handleCreateOpenFinanceSession()}
                      disabled={openFinanceConnecting}
                    >
                      {openFinanceConnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
                      {openFinanceConnecting ? "Conectando..." : "Conectar conta"}
                    </Button>
                  </div>

                  {pluggyConnectToken ? (
                    <PluggyConnect
                      connectToken={pluggyConnectToken}
                      includeSandbox={false}
                      language="pt"
                      onSuccess={async () => {
                        toast.success("Conta conectada com sucesso.");
                        setPluggyConnectToken(null);
                        await onRefreshOpenFinance();
                      }}
                      onError={(error) => {
                        setPluggyConnectToken(null);
                        toast.error(error?.message || "Erro na conexao bancaria.");
                      }}
                      onClose={async () => {
                        setPluggyConnectToken(null);
                        await onRefreshOpenFinance();
                      }}
                      onLoadError={(error) => {
                        setPluggyConnectToken(null);
                        toast.error(error.message || "Falha ao carregar o Pluggy Connect.");
                      }}
                    />
                  ) : null}

                  <div className="flex justify-end">
                    <Button type="button" variant="ghost" size="sm" className="gap-2" onClick={() => void onRefreshOpenFinance()} disabled={openFinanceLoading}>
                      {openFinanceLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
                      Atualizar conexoes
                    </Button>
                  </div>

                  {openFinanceConnections.length === 0 ? (
                    <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                      Nenhuma conta conectada ainda.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {openFinanceConnections.map((connection) => {
                        const connectionAccounts = accountsByConnection.get(connection.id) || [];

                        return (
                          <div key={connection.id} className="rounded-xl border p-4">
                            <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                              <div className="space-y-2">
                                <div className="flex flex-wrap items-center gap-2">
                                  <Badge variant="outline">{formatConnectionStatus(connection.status)}</Badge>
                                  <Badge variant="secondary">{formatConsentStatus(connection.consent_status)}</Badge>
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  <p>Ultima sincronizacao: {connection.last_synced_at ? new Date(connection.last_synced_at).toLocaleString("pt-BR") : "Ainda nao sincronizado"}</p>
                                  <p>Contas vinculadas: {connectionAccounts.length}</p>
                                </div>
                                {connection.last_sync_error ? (
                                  <p className="text-xs text-destructive">{connection.last_sync_error}</p>
                                ) : null}
                              </div>

                              <div className="flex flex-wrap gap-2">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="gap-2"
                                  onClick={() => void handleManualSyncOpenFinance(connection.id)}
                                  disabled={openFinanceSyncingConnectionId === connection.id}
                                >
                                  {openFinanceSyncingConnectionId === connection.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <RefreshCcw className="h-4 w-4" />
                                  )}
                                  Sincronizar
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  className="gap-2 text-destructive"
                                  onClick={() => void handleDisconnectOpenFinance(connection.id)}
                                  disabled={openFinanceDisconnectingConnectionId === connection.id}
                                >
                                  {openFinanceDisconnectingConnectionId === connection.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Unplug className="h-4 w-4" />
                                  )}
                                  Desconectar
                                </Button>
                              </div>
                            </div>

                            {connectionAccounts.length > 0 ? (
                              <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-2">
                                {connectionAccounts.map((account) => (
                                  <div key={account.id} className="rounded-xl border bg-muted/30 p-3">
                                    <p className="text-sm font-medium">{account.account_name || "Conta bancaria"}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {account.institution_name || "Instituicao nao informada"}
                                      {account.account_mask ? ` • ${account.account_mask}` : ""}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

          <Card className="border-border/70">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <CalendarDays className="h-4 w-4 text-primary" />
                Lista operacional
              </CardTitle>
              <CardDescription>
                {filteredEntries.length} lancamentos no periodo filtrado. Use esta lista para revisar o fluxo do dia a dia.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {filteredEntries.length === 0 ? (
                <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                  Nenhum lancamento encontrado para o recorte atual.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border">
                  <Table className="min-w-[980px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Descricao</TableHead>
                        <TableHead>Conta</TableHead>
                        <TableHead>Origem</TableHead>
                        <TableHead>Situacao</TableHead>
                        <TableHead>Conciliacao</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredEntries.slice(0, 80).map((entry) => (
                        <TableRow key={entry.id}>
                          <TableCell className="text-xs text-muted-foreground">{formatDate(getEntryReferenceDate(entry))}</TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-medium line-clamp-1">{entry.description}</p>
                                {entry.review_status !== "approved" ? <AlertTriangle className="h-3.5 w-3.5 text-amber-600" /> : null}
                              </div>
                              <p className="text-[11px] text-muted-foreground">
                                {entry.category}
                                {entry.counterparty_name ? ` • ${entry.counterparty_name}` : ""}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatCashflowAccountLabel(accountMap.get(entry.account_id || ""))}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-[10px]">
                              {formatCashflowOriginType(entry.origin_type)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="text-[10px]">
                              {formatCashflowLifecycleStatus(getEntryLifecycleStatus(entry))}
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
                            {entry.entry_type === "income" ? "+" : "-"} {formatMoney(entry.amount)}
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

        <TabsContent value="conciliation" className="space-y-6">
          <Card className="border-border/70">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <ShieldCheck className="h-4 w-4 text-primary" />
                Fila de conciliacao e revisao
              </CardTitle>
              <CardDescription>
                Veja o que chegou por importacao ou Open Finance e ainda precisa de tratamento.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {conciliationEntries.length === 0 ? (
                <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                  Nao ha pendencias de conciliacao neste momento.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border">
                  <Table className="min-w-[980px]">
                    <TableHeader>
                      <TableRow>
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
                      {conciliationEntries.slice(0, 80).map((entry) => (
                        <TableRow key={entry.id}>
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
                          <TableCell className="text-sm text-muted-foreground">
                            {formatCashflowAccountLabel(accountMap.get(entry.account_id || ""))}
                          </TableCell>
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
                            {entry.entry_type === "income" ? "+" : "-"} {formatMoney(entry.amount)}
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

        <TabsContent value="managerial" className="space-y-6">
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.3fr_0.7fr]">
            <Card className="border-border/70">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <BarChart3 className="h-4 w-4 text-primary" />
                  Tendencia do periodo
                </CardTitle>
                <CardDescription>
                  Comparativo acumulado entre realizado e projetado no recorte atual.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="h-[320px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trendSeries}>
                      <defs>
                        <linearGradient id="portalRealized" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#0ea5e9" stopOpacity={0.38} />
                          <stop offset="100%" stopColor="#0ea5e9" stopOpacity={0.04} />
                        </linearGradient>
                        <linearGradient id="portalProjected" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#22c55e" stopOpacity={0.28} />
                          <stop offset="100%" stopColor="#22c55e" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="label" tick={{ fontSize: 12 }} minTickGap={24} />
                      <YAxis tickFormatter={(value) => `${Math.round(value / 1000)}k`} tick={{ fontSize: 12 }} />
                      <Tooltip formatter={(value: number) => formatMoney(value)} />
                      <Area
                        type="monotone"
                        dataKey="realized"
                        stroke="#0ea5e9"
                        strokeWidth={2}
                        fill="url(#portalRealized)"
                        name="Realizado"
                      />
                      <Area
                        type="monotone"
                        dataKey="projected"
                        stroke="#22c55e"
                        strokeWidth={2}
                        fill="url(#portalProjected)"
                        name="Projetado"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/70">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <TrendingUp className="h-4 w-4 text-primary" />
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
                      <Tooltip formatter={(value: number) => formatMoney(value)} />
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
                  <CardTitle className="text-sm">Visao agrupada</CardTitle>
                  <CardDescription>
                    Leia o caixa por dia, semana, mes, conta ou categoria para decidir com mais clareza.
                  </CardDescription>
                </div>
                <div className="w-full xl:w-[220px]">
                  <Select value={managerialGroupBy} onValueChange={(value) => setManagerialGroupBy(value as CashflowGroupBy)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Agrupar por" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="day">Dia</SelectItem>
                      <SelectItem value="week">Semana</SelectItem>
                      <SelectItem value="month">Mes</SelectItem>
                      <SelectItem value="account">Conta</SelectItem>
                      <SelectItem value="category">Categoria</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {groupedRows.length === 0 ? (
                <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                  Nenhum dado gerencial disponivel para este periodo.
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
                          <TableCell className="text-right text-emerald-600">{formatMoney(row.income)}</TableCell>
                          <TableCell className="text-right text-destructive">{formatMoney(row.expense)}</TableCell>
                          <TableCell className={`text-right font-medium ${row.net >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                            {formatMoney(row.net)}
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

      <Card className="border-border/70">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Wallet className="h-4 w-4 text-primary" />
            Resumo do mes selecionado
          </CardTitle>
          <CardDescription>
            {monthlyEntries.length} lancamentos em {new Date(`${referenceMonth}-01T00:00:00`).toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <MetricCard
            title="Entradas do mes"
            value={formatMoney(
              monthlyEntries.filter((entry) => entry.entry_type === "income").reduce((sum, entry) => sum + entry.amount, 0),
            )}
            helper="Total bruto de entradas registradas no mes."
            tone="success"
          />
          <MetricCard
            title="Saidas do mes"
            value={formatMoney(
              monthlyEntries.filter((entry) => entry.entry_type === "expense").reduce((sum, entry) => sum + entry.amount, 0),
            )}
            helper="Total bruto de saidas registradas no mes."
            tone="danger"
          />
          <MetricCard
            title="Itens com atencao"
            value={String(monthlyEntries.filter((entry) => entry.review_status !== "approved").length)}
            helper="Lancamentos que ainda pedem revisao ou conciliacao neste mes."
            tone={monthlyEntries.some((entry) => entry.review_status !== "approved") ? "warning" : "success"}
          />
        </CardContent>
      </Card>
    </div>
  );
}
