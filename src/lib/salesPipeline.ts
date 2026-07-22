export const SALES_STAGE_NAMES = [
  "Oportunidade Nova",
  "Contato Iniciado",
  "Diagnostico",
  "Reuniao Agendada",
  "Proposta Enviada",
  "Negociacao",
  "Fechado Ganho",
  "Fechado Perdido",
] as const;

export const SALES_CATALOG_CATEGORIES = [
  "service",
  "product",
  "consulting",
  "automation",
  "system",
  "other",
] as const;

export const SALES_RECURRENCE_TYPES = ["recurring", "one_time"] as const;

export type SalesStageName = (typeof SALES_STAGE_NAMES)[number];
export type SalesCatalogCategory = (typeof SALES_CATALOG_CATEGORIES)[number];
export type SalesRecurrenceType = (typeof SALES_RECURRENCE_TYPES)[number];

export interface SalesCatalogSelection {
  offerId: string | null;
  category: SalesCatalogCategory;
  otherOfferDescription?: string | null;
}

export interface CompletionTaskLike {
  integration_source?: string | null;
  integration_task_id?: string | null;
  status?: string | null;
}

export interface SalesDuplicateCandidate {
  id: string;
  name: string;
  cnpj?: string | null;
  email?: string | null;
  phone?: string | null;
  source: "client" | "lead";
}

export interface SalesDuplicateInput {
  cnpj?: string | null;
  email?: string | null;
  phone?: string | null;
}

export interface SalesMetricOpportunity {
  id: string;
  stage: SalesStageName;
  status: "active" | "won" | "lost" | "archived";
  estimatedValue: number;
  recurrenceType: SalesRecurrenceType;
  saleType: SalesCatalogCategory;
  offerId?: string | null;
  otherOfferDescription?: string | null;
  daysInStage?: number;
}

export interface SalesMetricsSummary {
  activeValue: number;
  wonValue: number;
  lostCount: number;
  activeCount: number;
  wonCount: number;
  conversionRate: number;
  recurringValue: number;
  oneTimeValue: number;
  otherOffersCount: number;
  topOpportunities: SalesMetricOpportunity[];
}

export type SalesActivityType =
  | "note"
  | "call"
  | "meeting"
  | "email"
  | "whatsapp"
  | "task"
  | "stage_change"
  | "system";

const wonStages = new Set<SalesStageName>(["Fechado Ganho"]);
const lostStages = new Set<SalesStageName>(["Fechado Perdido"]);
const managerRoles = new Set(["admin", "director", "manager"]);

export const isSalesStageName = (value: unknown): value is SalesStageName =>
  typeof value === "string" && SALES_STAGE_NAMES.includes(value as SalesStageName);

export const normalizeSalesStage = (value: unknown): SalesStageName =>
  isSalesStageName(value) ? value : "Oportunidade Nova";

export const isOpenSalesStage = (stage: SalesStageName) =>
  !wonStages.has(stage) && !lostStages.has(stage);

export const isWonSalesStage = (stage: SalesStageName) => wonStages.has(stage);

export const isLostSalesStage = (stage: SalesStageName) => lostStages.has(stage);

export const parseSalesCurrency = (value: string) => {
  const numeric = value
    .replace(/[^\d,.-]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const parsed = Number(numeric);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const formatSalesCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);

export const canManageSalesSettings = (role?: string | null, roles: Array<string | null | undefined> = []) => {
  if (role && managerRoles.has(role)) return true;
  return roles.some((item) => Boolean(item && managerRoles.has(item)));
};

export const validateSalesCatalogSelection = (selection: SalesCatalogSelection) => {
  if (selection.category === "other") {
    return Boolean(selection.otherOfferDescription?.trim());
  }

  return Boolean(selection.offerId);
};

export const buildClientCompletionTaskTitle = (clientName: string) => {
  const safeName = clientName.trim() || "cliente";
  return `Complementar cadastro do cliente: ${safeName}`;
};

export const hasCompletionTaskForOpportunity = (
  tasks: CompletionTaskLike[],
  opportunityId: string,
) =>
  tasks.some(
    (task) =>
      task.integration_source === "sales_pipeline" &&
      task.integration_task_id === opportunityId &&
      task.status !== "archived",
  );

export const buildSalesActivitySummary = (
  type: SalesActivityType,
  title: string,
) => {
  const safeTitle = title.trim();
  if (!safeTitle) return "Atividade registrada";

  const prefixByType: Record<SalesActivityType, string> = {
    note: "Nota",
    call: "Ligacao",
    meeting: "Reuniao",
    email: "E-mail",
    whatsapp: "WhatsApp",
    task: "Tarefa",
    stage_change: "Etapa",
    system: "Sistema",
  };

  return `${prefixByType[type]}: ${safeTitle}`;
};

const normalizeComparableText = (value?: string | null) =>
  (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\D/g, "")
    .trim();

const normalizeComparableEmail = (value?: string | null) => (value || "").trim().toLowerCase();

export const findSalesDuplicateWarnings = (
  input: SalesDuplicateInput,
  candidates: SalesDuplicateCandidate[],
) => {
  const cnpj = normalizeComparableText(input.cnpj);
  const phone = normalizeComparableText(input.phone);
  const email = normalizeComparableEmail(input.email);

  return candidates.filter((candidate) => {
    const candidateCnpj = normalizeComparableText(candidate.cnpj);
    const candidatePhone = normalizeComparableText(candidate.phone);
    const candidateEmail = normalizeComparableEmail(candidate.email);

    return Boolean(
      (cnpj && candidateCnpj && cnpj === candidateCnpj) ||
        (phone && candidatePhone && phone === candidatePhone) ||
        (email && candidateEmail && email === candidateEmail),
    );
  });
};

export const createSalesAuditMetadata = (
  action: string,
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
) => ({
  action,
  before,
  after,
  recordedAt: new Date().toISOString(),
});

export const calculateSalesMetrics = (opportunities: SalesMetricOpportunity[]): SalesMetricsSummary => {
  const active = opportunities.filter((item) => item.status === "active" && isOpenSalesStage(item.stage));
  const won = opportunities.filter((item) => item.status === "won" || isWonSalesStage(item.stage));
  const lost = opportunities.filter((item) => item.status === "lost" || isLostSalesStage(item.stage));
  const closedTotal = won.length + lost.length;
  const activeValue = active.reduce((sum, item) => sum + item.estimatedValue, 0);
  const wonValue = won.reduce((sum, item) => sum + item.estimatedValue, 0);

  return {
    activeValue,
    wonValue,
    lostCount: lost.length,
    activeCount: active.length,
    wonCount: won.length,
    conversionRate: closedTotal > 0 ? Math.round((won.length / closedTotal) * 100) : 0,
    recurringValue: opportunities
      .filter((item) => item.recurrenceType === "recurring")
      .reduce((sum, item) => sum + item.estimatedValue, 0),
    oneTimeValue: opportunities
      .filter((item) => item.recurrenceType === "one_time")
      .reduce((sum, item) => sum + item.estimatedValue, 0),
    otherOffersCount: opportunities.filter((item) => item.saleType === "other" || item.otherOfferDescription).length,
    topOpportunities: [...opportunities].sort((a, b) => b.estimatedValue - a.estimatedValue).slice(0, 5),
  };
};
