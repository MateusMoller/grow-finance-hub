import type {
  CashflowAccount,
  CashflowLifecycleStatus,
  CashflowOriginType,
  CashflowReconciliationStatus,
  CashflowReviewStatus,
  PortalCashflowEntry,
  PortalCashflowEntryType,
} from "@/components/portal/types";

export type CashflowGroupBy = "day" | "week" | "month" | "account" | "category" | "client";

export interface CashflowGroupedRow {
  key: string;
  label: string;
  income: number;
  expense: number;
  net: number;
  count: number;
}

export interface CashflowTrendPoint {
  label: string;
  realized: number;
  projected: number;
}

export interface CashflowGapAlert {
  date: string;
  balance: number;
}

export interface CashflowNamedMapValue {
  label?: string | null;
  name?: string | null;
}

const DAY_IN_MS = 1000 * 60 * 60 * 24;

export const cashflowCurrencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 2,
});

export const getIsoDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const getTodayIsoDate = () => getIsoDateKey(new Date());

export const normalizeCashflowText = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

export const getEntryDueDate = (entry: PortalCashflowEntry) => entry.due_date || entry.entry_date;

export const getEntryEffectiveDate = (entry: PortalCashflowEntry) => entry.effective_date || null;

export const getEntryLifecycleStatus = (entry: PortalCashflowEntry): CashflowLifecycleStatus => {
  if (entry.lifecycle_status) return entry.lifecycle_status;
  if (entry.status === "confirmed" || getEntryEffectiveDate(entry)) return "confirmed";

  const dueDate = getEntryDueDate(entry);
  const today = getTodayIsoDate();

  if (dueDate < today) return "overdue";
  if (dueDate === today) return "due";
  return "predicted";
};

export const getEntryReferenceDate = (entry: PortalCashflowEntry) => {
  const lifecycleStatus = getEntryLifecycleStatus(entry);
  return lifecycleStatus === "confirmed"
    ? getEntryEffectiveDate(entry) || getEntryDueDate(entry)
    : getEntryDueDate(entry);
};

export const toMonthKey = (dateString: string | null | undefined) => String(dateString || "").slice(0, 7);

export const getSignedAmount = (entry: PortalCashflowEntry) =>
  entry.entry_type === "income" ? entry.amount : -entry.amount;

export const isEntryProjected = (entry: PortalCashflowEntry) =>
  !entry.is_hidden_from_projection && !entry.is_transfer;

export const isEntryVisibleInManagerialView = (entry: PortalCashflowEntry) =>
  !entry.is_hidden_from_projection && !entry.is_transfer;

export const formatCashflowLifecycleStatus = (status: CashflowLifecycleStatus) => {
  if (status === "confirmed") return "Confirmado";
  if (status === "overdue") return "Vencido";
  if (status === "due") return "Vence hoje";
  return "Previsto";
};

export const formatCashflowOriginType = (originType: CashflowOriginType | null) => {
  if (originType === "open_finance") return "Open Finance";
  if (originType === "import_file") return "Importacao";
  if (originType === "obligation_projection") return "Obrigacao";
  if (originType === "recurring_rule") return "Recorrencia";
  return "Manual";
};

export const formatCashflowReconciliationStatus = (status: CashflowReconciliationStatus | null) => {
  if (status === "pending") return "Pendente";
  if (status === "suggested") return "Sugerido";
  if (status === "reconciled") return "Conciliado";
  if (status === "ignored") return "Ignorado";
  return "Nao aplicavel";
};

export const formatCashflowReviewStatus = (status: CashflowReviewStatus | null) => {
  if (status === "pending_review") return "Pendente";
  if (status === "classified") return "Classificado";
  return "Aprovado";
};

export const formatCashflowAccountLabel = (account: CashflowAccount | null | undefined) => {
  if (!account) return "Sem conta";
  if (account.account_mask) return `${account.label} (${account.account_mask})`;
  return account.label;
};

export const getCashflowAccountMap = (accounts: CashflowAccount[]) =>
  new Map(accounts.map((account) => [account.id, account]));

const parseIsoDate = (value: string) => new Date(`${value}T00:00:00`);

const addDays = (value: string, days: number) => {
  const date = parseIsoDate(value);
  date.setDate(date.getDate() + days);
  return getIsoDateKey(date);
};

const isDateInRange = (value: string, startDate?: string | null, endDate?: string | null) => {
  if (startDate && value < startDate) return false;
  if (endDate && value > endDate) return false;
  return true;
};

const daysBetweenIsoDates = (left: string, right: string) => {
  const leftTime = parseIsoDate(left).getTime();
  const rightTime = parseIsoDate(right).getTime();
  return Math.abs(leftTime - rightTime) / DAY_IN_MS;
};

const formatShortDate = (value: string) => parseIsoDate(value).toLocaleDateString("pt-BR");

const getStartOfWeek = (value: string) => {
  const date = parseIsoDate(value);
  const day = date.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + offset);
  return getIsoDateKey(date);
};

const getWeekLabel = (value: string) => {
  const start = getStartOfWeek(value);
  const end = addDays(start, 6);
  return `Semana ${formatShortDate(start)} a ${formatShortDate(end)}`;
};

const isProjectedPendingEntry = (entry: PortalCashflowEntry, referenceDate: string, endDate?: string) => {
  if (!isEntryVisibleInManagerialView(entry)) return false;
  if (getEntryLifecycleStatus(entry) === "confirmed") return false;

  const dueDate = getEntryDueDate(entry);
  if (dueDate < referenceDate) return true;
  return isDateInRange(dueDate, referenceDate, endDate || null);
};

const resolveNamedMapLabel = (
  map: Map<string, CashflowNamedMapValue> | undefined,
  id: string | null | undefined,
  fallback: string,
) => {
  if (!id || !map) return fallback;
  const item = map.get(id);
  if (!item) return fallback;
  return item.label || item.name || fallback;
};

export const getCurrentCashBalance = (entries: PortalCashflowEntry[], referenceDate = getTodayIsoDate()) =>
  entries
    .filter((entry) => isEntryVisibleInManagerialView(entry))
    .filter((entry) => getEntryLifecycleStatus(entry) === "confirmed")
    .filter((entry) => getEntryReferenceDate(entry) <= referenceDate)
    .reduce((sum, entry) => sum + getSignedAmount(entry), 0);

export const getProjectedBalanceAtHorizon = (
  entries: PortalCashflowEntry[],
  horizonDays: number,
  referenceDate = getTodayIsoDate(),
) => {
  const horizonDate = addDays(referenceDate, horizonDays);
  const currentBalance = getCurrentCashBalance(entries, referenceDate);

  const projectedVariation = entries
    .filter((entry) => isProjectedPendingEntry(entry, referenceDate, horizonDate))
    .reduce((sum, entry) => sum + getSignedAmount(entry), 0);

  return currentBalance + projectedVariation;
};

export const getUpcomingDueEntries = (
  entries: PortalCashflowEntry[],
  horizonDays: number,
  referenceDate = getTodayIsoDate(),
) => {
  const horizonDate = addDays(referenceDate, horizonDays);

  return entries
    .filter((entry) => isEntryVisibleInManagerialView(entry))
    .filter((entry) => getEntryLifecycleStatus(entry) !== "confirmed")
    .filter((entry) => {
      const dueDate = getEntryDueDate(entry);
      return dueDate >= referenceDate && dueDate <= horizonDate;
    })
    .sort((left, right) => getEntryDueDate(left).localeCompare(getEntryDueDate(right)));
};

export const getTopFutureExpenses = (
  entries: PortalCashflowEntry[],
  horizonDays: number,
  limit = 5,
  referenceDate = getTodayIsoDate(),
) => {
  const horizonDate = addDays(referenceDate, horizonDays);

  return entries
    .filter((entry) => isProjectedPendingEntry(entry, referenceDate, horizonDate))
    .filter((entry) => entry.entry_type === "expense")
    .sort((left, right) => right.amount - left.amount)
    .slice(0, limit);
};

export const getCashflowGapAlert = (
  entries: PortalCashflowEntry[],
  horizonDays: number,
  referenceDate = getTodayIsoDate(),
): CashflowGapAlert | null => {
  const horizonDate = addDays(referenceDate, horizonDays);
  const pendingEntries = entries
    .filter((entry) => isProjectedPendingEntry(entry, referenceDate, horizonDate))
    .sort((left, right) => {
      const dueDiff = getEntryDueDate(left).localeCompare(getEntryDueDate(right));
      if (dueDiff !== 0) return dueDiff;
      return right.created_at.localeCompare(left.created_at);
    });

  let runningBalance = getCurrentCashBalance(entries, referenceDate);
  for (const entry of pendingEntries) {
    runningBalance += getSignedAmount(entry);
    if (runningBalance < 0) {
      return {
        date: getEntryDueDate(entry),
        balance: Number(runningBalance.toFixed(2)),
      };
    }
  }

  return null;
};

export const buildCashflowTrendSeries = (
  entries: PortalCashflowEntry[],
  startDate: string,
  endDate: string,
): CashflowTrendPoint[] => {
  const realizedByDate = new Map<string, number>();
  const projectedByDate = new Map<string, number>();

  entries
    .filter((entry) => isEntryVisibleInManagerialView(entry))
    .forEach((entry) => {
      const dueDate = getEntryDueDate(entry);
      if (!isDateInRange(dueDate, startDate, endDate)) return;

      if (getEntryLifecycleStatus(entry) === "confirmed") {
        const effectiveDate = getEntryReferenceDate(entry);
        if (isDateInRange(effectiveDate, startDate, endDate)) {
          realizedByDate.set(effectiveDate, (realizedByDate.get(effectiveDate) || 0) + getSignedAmount(entry));
        }
      }

      projectedByDate.set(dueDate, (projectedByDate.get(dueDate) || 0) + getSignedAmount(entry));
    });

  const output: CashflowTrendPoint[] = [];
  let runningRealized = 0;
  let runningProjected = 0;

  for (let cursor = startDate; cursor <= endDate; cursor = addDays(cursor, 1)) {
    runningRealized += realizedByDate.get(cursor) || 0;
    runningProjected += projectedByDate.get(cursor) || 0;

    output.push({
      label: formatShortDate(cursor),
      realized: Number(runningRealized.toFixed(2)),
      projected: Number(runningProjected.toFixed(2)),
    });
  }

  return output;
};

export const groupCashflowEntries = (
  entries: PortalCashflowEntry[],
  groupBy: CashflowGroupBy,
  options?: {
    accountMap?: Map<string, CashflowAccount>;
    clientMap?: Map<string, CashflowNamedMapValue>;
  },
) => {
  const groups = new Map<string, CashflowGroupedRow>();

  const resolveGroup = (entry: PortalCashflowEntry) => {
    const referenceDate = getEntryReferenceDate(entry);

    if (groupBy === "day") {
      return { key: referenceDate, label: formatShortDate(referenceDate) };
    }

    if (groupBy === "week") {
      const key = getStartOfWeek(referenceDate);
      return { key, label: getWeekLabel(referenceDate) };
    }

    if (groupBy === "month") {
      const key = toMonthKey(referenceDate);
      const label = parseIsoDate(`${key}-01`).toLocaleDateString("pt-BR", {
        month: "long",
        year: "numeric",
      });
      return { key, label };
    }

    if (groupBy === "account") {
      const key = entry.account_id || "without-account";
      const label = entry.account_id
        ? formatCashflowAccountLabel(options?.accountMap?.get(entry.account_id))
        : "Sem conta";
      return { key, label };
    }

    if (groupBy === "client") {
      const key = entry.client_id;
      const label = resolveNamedMapLabel(options?.clientMap, entry.client_id, "Cliente nao encontrado");
      return { key, label };
    }

    return {
      key: entry.category || "without-category",
      label: entry.category || "Sem categoria",
    };
  };

  entries.forEach((entry) => {
    const { key, label } = resolveGroup(entry);
    const group = groups.get(key) || {
      key,
      label,
      income: 0,
      expense: 0,
      net: 0,
      count: 0,
    };

    if (entry.entry_type === "income") {
      group.income += entry.amount;
    } else {
      group.expense += entry.amount;
    }

    group.net += getSignedAmount(entry);
    group.count += 1;
    groups.set(key, group);
  });

  const output = [...groups.values()].map((group) => ({
    ...group,
    income: Number(group.income.toFixed(2)),
    expense: Number(group.expense.toFixed(2)),
    net: Number(group.net.toFixed(2)),
  }));

  if (groupBy === "day" || groupBy === "week" || groupBy === "month") {
    return output.sort((left, right) => left.key.localeCompare(right.key));
  }

  return output.sort((left, right) => Math.abs(right.net) - Math.abs(left.net) || right.count - left.count);
};

export const getUniqueCashflowCategories = (entries: PortalCashflowEntry[]) =>
  [...new Set(entries.map((entry) => entry.category).filter(Boolean))].sort((left, right) => left.localeCompare(right));

export const getUniqueCashflowCounterparties = (entries: PortalCashflowEntry[]) =>
  [...new Set(entries.map((entry) => entry.counterparty_name).filter(Boolean) as string[])].sort((left, right) =>
    left.localeCompare(right),
  );

export const detectPotentialDuplicateEntryIds = (entries: PortalCashflowEntry[]) => {
  const duplicateIds = new Set<string>();

  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    const baseDate = getEntryReferenceDate(entry);
    const baseDescription = normalizeCashflowText(entry.description);

    for (let compareIndex = index + 1; compareIndex < entries.length; compareIndex += 1) {
      const candidate = entries[compareIndex];

      if (entry.client_id !== candidate.client_id) continue;
      if ((entry.account_id || null) !== (candidate.account_id || null)) continue;
      if (entry.entry_type !== candidate.entry_type) continue;
      if (entry.amount !== candidate.amount) continue;
      if ((entry.origin_type || "manual") !== (candidate.origin_type || "manual")) continue;

      const candidateDescription = normalizeCashflowText(candidate.description);
      if (!baseDescription || baseDescription !== candidateDescription) continue;

      const candidateDate = getEntryReferenceDate(candidate);
      if (daysBetweenIsoDates(baseDate, candidateDate) > 3) continue;

      duplicateIds.add(entry.id);
      duplicateIds.add(candidate.id);
    }
  }

  return duplicateIds;
};
