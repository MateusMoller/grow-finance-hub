import { useMemo, useState } from "react";
import {
  BarChart3,
  CalendarDays,
  CircleDollarSign,
  Loader2,
  LockKeyhole,
  Plus,
  TrendingDown,
  TrendingUp,
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

interface ClientPortalCashflowProps {
  enabled: boolean;
  loading: boolean;
  entries: PortalCashflowEntry[];
  creating: boolean;
  onCreateEntry: (payload: NewPortalCashflowEntryPayload) => Promise<boolean>;
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

export function ClientPortalCashflow({
  enabled,
  loading,
  entries,
  creating,
  onCreateEntry,
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
