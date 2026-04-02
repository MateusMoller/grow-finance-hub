import { type ChangeEvent, useMemo, useRef, useState } from "react";
import {
  BarChart3,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  Loader2,
  LockKeyhole,
  Plus,
  Trash2,
  TrendingDown,
  TrendingUp,
  Upload,
  Wallet,
} from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  cashflowCategoriesByType,
  type NewPortalCashflowEntryPayload,
  type PortalCashflowEntry,
  type PortalCashflowEntryStatus,
  type PortalCashflowEntryType,
} from "@/components/portal/types";
import { parseCashflowFiles, type ParsedCashflowSuggestion } from "@/lib/cashflowImportParser";

interface ClientPortalCashflowProps {
  enabled: boolean;
  loading: boolean;
  entries: PortalCashflowEntry[];
  creating: boolean;
  onCreateEntry: (payload: NewPortalCashflowEntryPayload) => Promise<boolean>;
  onCreateEntriesBatch: (
    payloads: NewPortalCashflowEntryPayload[],
  ) => Promise<{ success: boolean; inserted: number }>;
  onRequestEnable: () => void;
}

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 2,
});

const toLocalDateInput = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const toMonthKey = (dateString: string) => dateString.slice(0, 7);

const formatDate = (dateString: string) =>
  new Date(`${dateString}T00:00:00`).toLocaleDateString("pt-BR");

const statusLabel: Record<PortalCashflowEntryStatus, string> = {
  confirmed: "Confirmado",
  predicted: "Previsto",
};

const typeLabel: Record<PortalCashflowEntryType, string> = {
  income: "Entrada",
  expense: "Saida",
};

const getSignedAmount = (entry: PortalCashflowEntry) =>
  entry.entry_type === "income" ? entry.amount : -entry.amount;

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

const suggestionToDraftRow = (suggestion: ParsedCashflowSuggestion, index: number): ImportDraftRow => {
  const defaultCategory =
    suggestion.entryType === "income"
      ? cashflowCategoriesByType.income[0]
      : cashflowCategoriesByType.expense[0];

  return {
    id: `${suggestion.sourceFile}-${index}-${suggestion.entryDate}`,
    selected: true,
    entryDate: suggestion.entryDate,
    entryType: suggestion.entryType,
    category: defaultCategory,
    description: suggestion.description,
    amountText: suggestion.amount.toFixed(2),
    status: "predicted",
    sourceFile: suggestion.sourceFile,
    sourceLine: suggestion.sourceLine,
    confidence: suggestion.confidence,
  };
};

export function ClientPortalCashflow({
  enabled,
  loading,
  entries,
  creating,
  onCreateEntry,
  onCreateEntriesBatch,
  onRequestEnable,
}: ClientPortalCashflowProps) {
  const today = useMemo(() => new Date(), []);
  const [referenceMonth, setReferenceMonth] = useState(() => `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`);
  const [entryDate, setEntryDate] = useState(() => toLocalDateInput(today));
  const [entryType, setEntryType] = useState<PortalCashflowEntryType>("income");
  const [entryCategory, setEntryCategory] = useState(cashflowCategoriesByType.income[0]);
  const [entryStatus, setEntryStatus] = useState<PortalCashflowEntryStatus>("confirmed");
  const [entryDescription, setEntryDescription] = useState("");
  const [entryAmount, setEntryAmount] = useState("");
  const [importFiles, setImportFiles] = useState<File[]>([]);
  const [parsingImport, setParsingImport] = useState(false);
  const [importingDrafts, setImportingDrafts] = useState(false);
  const [importDrafts, setImportDrafts] = useState<ImportDraftRow[]>([]);
  const importFileInputRef = useRef<HTMLInputElement>(null);

  const monthlyEntries = useMemo(
    () =>
      entries.filter((entry) => toMonthKey(entry.entry_date) === referenceMonth),
    [entries, referenceMonth],
  );

  const sortedMonthlyEntries = useMemo(
    () =>
      [...monthlyEntries].sort(
        (a, b) =>
          b.entry_date.localeCompare(a.entry_date) || b.created_at.localeCompare(a.created_at),
      ),
    [monthlyEntries],
  );

  const totals = useMemo(() => {
    const confirmedIncome = monthlyEntries
      .filter((entry) => entry.status === "confirmed" && entry.entry_type === "income")
      .reduce((sum, entry) => sum + entry.amount, 0);

    const confirmedExpense = monthlyEntries
      .filter((entry) => entry.status === "confirmed" && entry.entry_type === "expense")
      .reduce((sum, entry) => sum + entry.amount, 0);

    const projectedBalance = monthlyEntries.reduce((sum, entry) => sum + getSignedAmount(entry), 0);
    const realizedBalance = confirmedIncome - confirmedExpense;

    return {
      confirmedIncome,
      confirmedExpense,
      realizedBalance,
      projectedBalance,
    };
  }, [monthlyEntries]);

  const dailyBalanceChart = useMemo(() => {
    const [yearText, monthText] = referenceMonth.split("-");
    const year = Number(yearText);
    const month = Number(monthText);
    if (!year || !month) return [];

    const daysInMonth = new Date(year, month, 0).getDate;
    const dailyRealized = new Map<number, number>();
    const dailyProjected = new Map<number, number>();

    monthlyEntries.forEach((entry) => {
      const day = Number(entry.entry_date.split("-")[2] || "1");
      const signedAmount = getSignedAmount(entry);
      dailyProjected.set(day, (dailyProjected.get(day) || 0) + signedAmount);

      if (entry.status === "confirmed") {
        dailyRealized.set(day, (dailyRealized.get(day) || 0) + signedAmount);
      }
    });

    let runningRealized = 0;
    let runningProjected = 0;
    const output: Array<{ day: string; realized: number; projected: number }> = [];

    for (let day = 1; day <= daysInMonth; day += 1) {
      runningRealized += dailyRealized.get(day) || 0;
      runningProjected += dailyProjected.get(day) || 0;
      output.push({
        day: String(day).padStart(2, "0"),
        realized: Number(runningRealized.toFixed(2)),
        projected: Number(runningProjected.toFixed(2)),
      });
    }

    return output;
  }, [monthlyEntries, referenceMonth]);

  const expenseByCategory = useMemo(() => {
    const map = new Map<string, number>();
    monthlyEntries
      .filter((entry) => entry.entry_type === "expense")
      .forEach((entry) => {
        map.set(entry.category, (map.get(entry.category) || 0) + entry.amount);
      });

    return [...map.entries()]
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 6);
  }, [monthlyEntries]);

  const handleTypeChange = (value: PortalCashflowEntryType) => {
    setEntryType(value);
    setEntryCategory(cashflowCategoriesByType[value][0]);
  };

  const handleCreateEntry = async () => {
    if (!enabled) {
      toast.error("Este modulo ainda nao foi liberado para este cliente.");
      return;
    }

    const normalizedDescription = entryDescription.trim();
    if (normalizedDescription.length < 3) {
      toast.error("Descreva o lancamento com pelo menos 3 caracteres.");
      return;
    }

    const normalizedAmount = Number(entryAmount.replace(",", "."));
    if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
      toast.error("Informe um valor valido maior que zero.");
      return;
    }

    const success = await onCreateEntry({
      entry_date: entryDate,
      entry_type: entryType,
      category: entryCategory,
      description: normalizedDescription,
      amount: Number(normalizedAmount.toFixed(2)),
      status: entryStatus,
    });

    if (!success) return;

    setEntryDescription("");
    setEntryAmount("");
    setEntryStatus("confirmed");
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
    updateImportDraft(id, (draft) => {
      const categories = cashflowCategoriesByType[type];
      const keepCategory = categories.includes(draft.category);

      return {
        ...draft,
        entryType: type,
        category: keepCategory ? draft.category : categories[0],
      };
    });
  };

  const selectedDrafts = useMemo(
    () => importDrafts.filter((draft) => draft.selected),
    [importDrafts],
  );

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

    if (result.warnings.length > 0) {
      result.warnings.forEach((warning) => toast.warning(warning));
    }

    if (result.entries.length === 0) {
      setImportDrafts([]);
      return;
    }

    const drafts = result.entries.map((entry, index) => suggestionToDraftRow(entry, index));
    setImportDrafts(drafts);
    toast.success(`${drafts.length} sugestao(oes) de lancamento gerada(s) para revisao.`);
  };

  const handleImportSelectedDrafts = async () => {
    if (!enabled) {
      toast.error("Este modulo ainda nao foi liberado para este cliente.");
      return;
    }

    if (selectedDrafts.length === 0) {
      toast.error("Selecione ao menos um lancamento sugerido para importar.");
      return;
    }

    const payloads: NewPortalCashflowEntryPayload[] = [];
    for (const draft of selectedDrafts) {
      const description = draft.description.trim();
      const amount = Number(draft.amountText.replace(",", "."));

      if (!draft.entryDate) {
        toast.error(`Data obrigatoria na sugestao "${description || draft.sourceFile}".`);
        return;
      }

      if (description.length < 3) {
        toast.error(`Descricao invalida na sugestao de ${draft.sourceFile}.`);
        return;
      }

      if (!Number.isFinite(amount) || amount <= 0) {
        toast.error(`Valor invalido na sugestao de ${draft.sourceFile}.`);
        return;
      }

      payloads.push({
        entry_date: draft.entryDate,
        entry_type: draft.entryType,
        category: draft.category,
        description,
        amount: Number(amount.toFixed(2)),
        status: draft.status,
      });
    }

    setImportingDrafts(true);
    const result = await onCreateEntriesBatch(payloads);
    setImportingDrafts(false);

    if (!result.success) return;

    toast.success(`${result.inserted} lancamento(s) importado(s) com sucesso.`);
    clearImportData();
  };

  if (!enabled) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <LockKeyhole className="h-4 w-4 text-amber-600" />
            Controle de caixa bloqueado
          </CardTitle>
          <CardDescription>
            O acesso a este modulo depende de liberacao do admin. Ao ser liberado, voce podera acompanhar saldo, entradas, saidas e previsoes.
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

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Wallet className="h-4 w-4 text-primary" />
            Dashboard de caixa
          </CardTitle>
          <CardDescription>
            Visao mensal com saldo realizado, saldo projetado e principais saidas para apoiar decisao rapida.
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Saldo realizado do mes</p>
            <p className={`text-2xl font-semibold mt-1 ${totals.realizedBalance >= 0 ? "text-emerald-600" : "text-destructive"}`}>
              {currencyFormatter.format(totals.realizedBalance)}
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">Somente lancamentos confirmados</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Entradas confirmadas</p>
            <div className="flex items-center gap-2 mt-1">
              <TrendingUp className="h-4 w-4 text-emerald-600" />
              <p className="text-2xl font-semibold text-emerald-600">{currencyFormatter.format(totals.confirmedIncome)}</p>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">Receitas efetivamente recebidas</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Saidas confirmadas</p>
            <div className="flex items-center gap-2 mt-1">
              <TrendingDown className="h-4 w-4 text-destructive" />
              <p className="text-2xl font-semibold text-destructive">{currencyFormatter.format(totals.confirmedExpense)}</p>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">Pagamentos e custos efetivados</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Saldo projetado do mes</p>
            <div className="flex items-center gap-2 mt-1">
              <CircleDollarSign className="h-4 w-4 text-primary" />
              <p className={`text-2xl font-semibold ${totals.projectedBalance >= 0 ? "text-primary" : "text-destructive"}`}>
                {currencyFormatter.format(totals.projectedBalance)}
              </p>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">Considera confirmados e previstos</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-primary" />
              Evolucao diaria do saldo
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex justify-end mb-3">
              <Input
                type="month"
                className="w-[180px]"
                value={referenceMonth}
                onChange={(event) => setReferenceMonth(event.target.value)}
              />
            </div>
            {loading ? (
              <div className="h-[260px] flex items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              </div>
            ) : dailyBalanceChart.length === 0 ? (
              <div className="h-[260px] flex items-center justify-center text-sm text-muted-foreground">
                Sem dados para o mes selecionado.
              </div>
            ) : (
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={dailyBalanceChart}>
                    <defs>
                      <linearGradient id="realizedGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.04} />
                      </linearGradient>
                      <linearGradient id="projectedGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--muted-foreground))" stopOpacity={0.28} />
                        <stop offset="95%" stopColor="hsl(var(--muted-foreground))" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="day" tickMargin={8} />
                    <YAxis tickFormatter={(value) => currencyFormatter.format(Number(value)).replace("R$", "R$ ")} width={96} />
                    <Tooltip
                      formatter={(value: number, name: string) => [
                        currencyFormatter.format(Number(value)),
                        name === "realized" ? "Saldo realizado" : "Saldo projetado",
                      ]}
                      labelFormatter={(value) => `Dia ${value}`}
                    />
                    <Area
                      type="monotone"
                      dataKey="projected"
                      stroke="hsl(var(--muted-foreground))"
                      strokeWidth={1.8}
                      fill="url(#projectedGradient)"
                    />
                    <Area
                      type="monotone"
                      dataKey="realized"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2.2}
                      fill="url(#realizedGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              Principais saidas por categoria
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {expenseByCategory.length === 0 ? (
              <div className="h-[260px] flex items-center justify-center text-sm text-muted-foreground">
                Nenhuma saida registrada para o mes selecionado.
              </div>
            ) : (
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={expenseByCategory}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="category" tick={{ fontSize: 11 }} interval={0} angle={-12} textAnchor="end" height={56} />
                    <YAxis tickFormatter={(value) => currencyFormatter.format(Number(value)).replace("R$", "R$ ")} width={90} />
                    <Tooltip formatter={(value: number) => currencyFormatter.format(Number(value))} />
                    <Bar dataKey="amount" fill="hsl(var(--destructive))" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Upload className="h-4 w-4 text-primary" />
            Importacao automatica de extratos
          </CardTitle>
          <CardDescription>
            Envie PDF, Excel, CSV ou imagem do extrato. O sistema gera os lancamentos automaticamente para voce revisar e confirmar.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-0">
          <div className="grid gap-3 xl:grid-cols-[1fr_auto_auto] xl:items-end">
            <div className="space-y-1.5">
              <Label className="text-xs">Arquivos do extrato</Label>
              <Input
                ref={importFileInputRef}
                type="file"
                multiple
                accept=".pdf,.xls,.xlsx,.csv,.png,.jpg,.jpeg,.webp"
                onChange={handleImportFileSelection}
              />
            </div>
            <Button
              type="button"
              variant="outline"
              className="gap-1.5"
              onClick={() => void handleParseImportFiles()}
              disabled={parsingImport || importFiles.length === 0}
            >
              {parsingImport ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {parsingImport ? "Lendo arquivos..." : "Gerar sugestoes"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={clearImportData}
              disabled={parsingImport || importingDrafts}
            >
              Limpar
            </Button>
          </div>

          {importFiles.length > 0 ? (
            <div className="rounded-lg border p-3">
              <p className="text-xs font-medium text-muted-foreground mb-2">Arquivos selecionados</p>
              <div className="flex flex-wrap gap-2">
                {importFiles.map((file, index) => (
                  <Badge key={`${file.name}-${index}`} variant="secondary" className="gap-1.5 py-1.5">
                    {file.name}
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-foreground"
                      onClick={() => removeImportFile(index)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>
          ) : null}

          {importDrafts.length > 0 ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2 justify-between">
                <p className="text-xs text-muted-foreground">
                  {selectedDrafts.length} de {importDrafts.length} sugestao(oes) selecionada(s)
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setImportDrafts((currentDrafts) =>
                        currentDrafts.map((draft) => ({ ...draft, selected: true })),
                      )
                    }
                  >
                    Selecionar tudo
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setImportDrafts((currentDrafts) =>
                        currentDrafts.map((draft) => ({ ...draft, selected: false })),
                      )
                    }
                  >
                    Limpar selecao
                  </Button>
                </div>
              </div>

              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">Ok</TableHead>
                      <TableHead className="w-[130px]">Data</TableHead>
                      <TableHead className="w-[120px]">Tipo</TableHead>
                      <TableHead className="w-[170px]">Categoria</TableHead>
                      <TableHead>Descricao</TableHead>
                      <TableHead className="w-[120px]">Valor</TableHead>
                      <TableHead className="w-[140px]">Status</TableHead>
                      <TableHead className="w-[150px]">Origem</TableHead>
                      <TableHead className="w-10"></TableHead>
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
                          <Select
                            value={draft.entryType}
                            onValueChange={(value) => handleDraftTypeChange(draft.id, value as PortalCashflowEntryType)}
                          >
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
                          <Select
                            value={draft.category}
                            onValueChange={(value) =>
                              updateImportDraft(draft.id, (currentDraft) => ({
                                ...currentDraft,
                                category: value,
                              }))
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {cashflowCategoriesByType[draft.entryType].map((category) => (
                                <SelectItem key={category} value={category}>
                                  {category}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
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
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <p className="text-xs font-medium line-clamp-1">{draft.sourceFile}</p>
                            <p className="text-[11px] text-muted-foreground line-clamp-1">{draft.sourceLine}</p>
                            <Badge variant="outline" className="text-[10px]">
                              Confianca {Math.round(draft.confidence * 100)}%
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() =>
                              setImportDrafts((currentDrafts) =>
                                currentDrafts.filter((currentDraft) => currentDraft.id !== draft.id),
                              )
                            }
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex justify-end">
                <Button
                  type="button"
                  className="gap-1.5"
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

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
        <Card className="xl:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Novo lancamento</CardTitle>
            <CardDescription>
              Registre entradas e saidas para manter o dashboard atualizado em tempo real.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Data</Label>
                <Input type="date" value={entryDate} onChange={(event) => setEntryDate(event.target.value)} />
              </div>
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
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Categoria</Label>
              <Select value={entryCategory} onValueChange={setEntryCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {cashflowCategoriesByType[entryType].map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Descricao</Label>
              <Input
                value={entryDescription}
                onChange={(event) => setEntryDescription(event.target.value)}
                placeholder="Ex.: Recebimento da parcela 2 do cliente X"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
            </div>

            <Button type="button" onClick={() => void handleCreateEntry()} disabled={creating} className="w-full">
              {creating ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
              {creating ? "Registrando..." : "Registrar lancamento"}
            </Button>
          </CardContent>
        </Card>

        <Card className="xl:col-span-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Lancamentos recentes</CardTitle>
            <CardDescription>
              Ultimos registros do mes selecionado para revisao rapida do fluxo.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            {sortedMonthlyEntries.length === 0 ? (
              <div className="rounded-lg border border-dashed p-8 text-sm text-center text-muted-foreground">
                Nenhum lancamento registrado neste mes.
              </div>
            ) : (
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Descricao</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedMonthlyEntries.slice(0, 12).map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell className="text-xs text-muted-foreground">{formatDate(entry.entry_date)}</TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <p className="text-sm font-medium line-clamp-1">{entry.description}</p>
                            <Badge
                              variant="outline"
                              className={`text-[10px] border-0 ${
                                entry.entry_type === "income"
                                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                                  : "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300"
                              }`}
                            >
                              {typeLabel[entry.entry_type]}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{entry.category}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-[10px]">
                            {statusLabel[entry.status]}
                          </Badge>
                        </TableCell>
                        <TableCell
                          className={`text-right font-medium ${
                            entry.entry_type === "income" ? "text-emerald-600" : "text-destructive"
                          }`}
                        >
                          {entry.entry_type === "income" ? "+" : "-"} {currencyFormatter.format(entry.amount)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
