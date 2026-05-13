import type { LucideIcon } from "lucide-react";

export type RequestStatus = "pending" | "in_progress" | "completed" | "cancelled";

export interface PortalClientProfile {
  id: string;
  name: string;
  contact: string | null;
  email: string | null;
  portal_cashflow_enabled: boolean;
  portal_user_id: string | null;
}

export interface PortalClientRequest {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  category: string;
  sector: string;
  status: RequestStatus;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface PortalRequestMessage {
  id: string;
  request_id: string;
  user_id: string;
  content: string;
  is_from_team: boolean;
  created_at: string;
}

export interface PortalClientDocument {
  id: string;
  user_id: string;
  request_id: string | null;
  file_name: string;
  file_path: string;
  file_size: number | null;
  category: string;
  created_at: string;
  processed_at: string | null;
  processed_by: string | null;
}

export type PortalObligationInstanceStatus =
  | "pendente"
  | "em_andamento"
  | "aguardando_documento"
  | "em_revisao"
  | "concluida"
  | "atrasada"
  | "cancelada";

export interface PortalObligationDocument {
  id: string;
  instance_id: string;
  template_id: string;
  template_name: string;
  template_sector: string | null;
  competence_key: string;
  competence_label: string;
  competence_date: string;
  technical_due_date: string;
  legal_due_date: string | null;
  instance_status: PortalObligationInstanceStatus;
  protocol: string | null;
  protocol_issued_at: string | null;
  processed_automatically: boolean;
  file_name: string;
  storage_bucket: string;
  storage_path: string;
  file_size: number | null;
  content_type: string | null;
  triage_status: "accepted" | "reviewed" | "rejected";
  source: string;
  source_kind: "web_manual" | "local_robot" | "api";
  protocol_number: string | null;
  created_at: string;
}

export type PortalTaskStatus = "pending_client" | "in_analysis" | "completed" | "cancelled";
export type PortalTaskType = "document" | "request_return" | "operational" | "deadline" | "other";

export interface PortalClientTask {
  id: string;
  client_id: string;
  title: string;
  description: string | null;
  type: PortalTaskType;
  status: PortalTaskStatus;
  due_date: string | null;
  sector: string;
  request_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type PortalCashflowEntryType = "income" | "expense";
export type PortalCashflowEntryStatus = "predicted" | "confirmed";
export type CashflowLifecycleStatus = "predicted" | "due" | "overdue" | "confirmed";
export type CashflowOriginType = "manual" | "import_file" | "open_finance" | "obligation_projection" | "recurring_rule";
export type CashflowReconciliationStatus = "not_applicable" | "pending" | "suggested" | "reconciled" | "ignored";
export type CashflowReviewStatus = "pending_review" | "classified" | "approved";
export type CashflowAccountSourceType = "manual" | "bank_open_finance" | "cash" | "other";
export type CashflowHealthStatus = "em_dia" | "atencao" | "critico";

export interface CashflowConsultiveAlert {
  id: string;
  client_id: string;
  source_type: string;
  source_key: string;
  severity: "info" | "warning" | "critical";
  title: string;
  message: string;
  status: "active" | "resolved" | "dismissed";
  metadata: Record<string, unknown>;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CashflowHealthSnapshot {
  client_id: string;
  health_status: CashflowHealthStatus;
  current_balance: number;
  projected_balance_7: number;
  projected_balance_15: number;
  projected_balance_30: number;
  overdue_entries: number;
  pending_review_entries: number;
  pending_reconciliation_entries: number;
  review_coverage: number;
  critical_calendar_events: number;
  last_activity_at: string | null;
  projected_gap_date: string | null;
  metadata: Record<string, unknown>;
  generated_at: string;
  updated_at: string;
}

export interface CashflowRule {
  id: string;
  client_id: string | null;
  match_text: string;
  entry_type: PortalCashflowEntryType;
  category: string;
  counterparty_name: string | null;
  mark_as_transfer: boolean;
  auto_approve_threshold: number;
  is_active: boolean;
  notes: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CashflowAccount {
  id: string;
  client_id: string;
  label: string;
  source_type: CashflowAccountSourceType;
  currency_code: string;
  open_finance_account_id: string | null;
  open_finance_connection_id: string | null;
  institution_name: string | null;
  account_mask: string | null;
  is_primary: boolean;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface PortalCashflowEntry {
  id: string;
  client_id: string;
  entry_date: string;
  due_date: string | null;
  effective_date: string | null;
  competence_month: string | null;
  account_id: string | null;
  entry_type: PortalCashflowEntryType;
  category: string;
  description: string;
  amount: number;
  status: PortalCashflowEntryStatus;
  lifecycle_status: CashflowLifecycleStatus | null;
  matched_rule_id: string | null;
  origin_type: CashflowOriginType | null;
  reconciliation_status: CashflowReconciliationStatus | null;
  review_status: CashflowReviewStatus | null;
  review_owner_id: string | null;
  reviewed_at: string | null;
  rule_match_confidence: number | null;
  counterparty_name: string | null;
  document_ref: string | null;
  notes: string | null;
  is_transfer: boolean;
  is_hidden_from_projection: boolean;
  integration_source: string | null;
  integration_key: string | null;
  integration_connection_id: string | null;
  integration_account_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface NewPortalCashflowEntryPayload {
  entry_date: string;
  due_date?: string;
  effective_date?: string | null;
  competence_month?: string | null;
  account_id?: string | null;
  entry_type: PortalCashflowEntryType;
  category: string;
  description: string;
  amount: number;
  status: PortalCashflowEntryStatus;
  lifecycle_status?: CashflowLifecycleStatus;
  origin_type?: CashflowOriginType;
  reconciliation_status?: CashflowReconciliationStatus;
  review_status?: CashflowReviewStatus;
  counterparty_name?: string | null;
  document_ref?: string | null;
  notes?: string | null;
  is_transfer?: boolean;
  is_hidden_from_projection?: boolean;
}

export type OpenFinanceProvider = "pluggy" | "openi";

export interface OpenFinanceConnection {
  id: string;
  client_id: string;
  provider: OpenFinanceProvider;
  status: string;
  consent_status: string;
  consent_expires_at: string | null;
  external_item_id: string;
  last_synced_at: string | null;
  last_sync_error: string | null;
  disconnected_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface OpenFinanceAccount {
  id: string;
  connection_id: string;
  external_account_id: string;
  account_name: string | null;
  account_type: string | null;
  institution_name: string | null;
  account_mask: string | null;
  currency_code: string | null;
  is_active: boolean;
}

export interface OpenFinanceSyncStatus {
  connectionId: string;
  syncedAccounts: number;
  syncedTransactions: number;
  importedEntries: number;
}

export interface OpenFinanceTransactionDigest {
  external_transaction_id: string;
  occurred_at: string;
  description: string;
  amount: number;
  direction: "in" | "out";
  category: string | null;
}

export interface RequestStatusMeta {
  label: string;
  icon: LucideIcon;
  className: string;
}

export interface PortalSummaryMetric {
  label: string;
  value: number;
  helper: string;
}

export interface PortalActionItem {
  id: string;
  title: string;
  description: string;
  dueDate?: string | null;
  sector?: string;
  requestId?: string | null;
}

export interface PortalRequestTemplate {
  key: string;
  label: string;
  description: string;
  examples: string[];
  defaultSector: string;
}

export const portalRequestTemplates: PortalRequestTemplate[] = [
  {
    key: "Fiscal / impostos",
    label: "Fiscal / impostos",
    description: "Duvidas e demandas sobre tributos, guias e obrigações fiscais.",
    examples: ["Apuracao de imposto do mes", "Duvida sobre guia atrasada"],
    defaultSector: "Fiscal",
  },
  {
    key: "Contábil",
    label: "Contábil",
    description: "Assuntos de fechamento, balanco, DRE e lançamentos.",
    examples: ["Fechamento contábil mensal", "Revisão de lançamentos"],
    defaultSector: "Contábil",
  },
  {
    key: "Departamento pessoal",
    label: "Departamento pessoal",
    description: "Admissão, folha, férias, rescisão e rotinas de colaboradores.",
    examples: ["Admissão de colaborador", "Conferência de folha"],
    defaultSector: "Departamento Pessoal",
  },
  {
    key: "Documentacao",
    label: "Documentacao",
    description: "Envio e conferência de documentos para rotinas internas.",
    examples: ["Envio de contrato social", "Documentos para cadastro bancário"],
    defaultSector: "Geral",
  },
  {
    key: "Abertura / alteração",
    label: "Abertura / alteração",
    description: "Abertura de empresa e alterações cadastrais/societárias.",
    examples: ["Alteração de endereço", "Abertura de CNPJ"],
    defaultSector: "Societario",
  },
  {
    key: "Financeiro",
    label: "Financeiro",
    description: "Fluxo financeiro, conciliacoes e controles de recebimentos/pagamentos.",
    examples: ["Conciliação bancária", "Duvida sobre contas a pagar"],
    defaultSector: "Financeiro",
  },
  {
    key: "Outros",
    label: "Outros",
    description: "Assuntos gerais que não se encaixam nas categorias anteriores.",
    examples: ["Suporte geral do portal", "Solicitação administrativa"],
    defaultSector: "Geral",
  },
];

export const sectorOptions = [
  "Contábil",
  "Fiscal",
  "Departamento Pessoal",
  "Financeiro",
  "Comercial",
  "Societario",
  "Geral",
];

export const documentCategories = [
  "Documentos Cadastrais",
  "Documentos Fiscais",
  "Documentos Contabeis",
  "Dept. Pessoal",
  "Contratos",
  "Outros",
];

export const recommendedMonthlyUploads = [
  { id: "extratos", label: "Extratos bancários" },
  { id: "notas", label: "XML/PDF de notas emitidas e recebidas" },
  { id: "folha", label: "Folhas e recibos de pagamento" },
  { id: "contratos", label: "Contratos novos ou alterados no mes" },
  { id: "cadastro", label: "Documentos cadastrais atualizados" },
];

export const supportSectors = [
  "Fiscal",
  "Contábil",
  "Departamento Pessoal",
  "Financeiro",
  "Societario",
];

export const cashflowCategoriesByType: Record<PortalCashflowEntryType, string[]> = {
  income: [
    "Recebimento de clientes",
    "Aporte dos sócios",
    "Crédito bancário",
    "Outras entradas",
  ],
  expense: [
    "Folha de pagamento",
    "Impostos",
    "Fornecedores",
    "Despesas operacionais",
    "Pro-labore",
    "Outras saidas",
  ],
};
