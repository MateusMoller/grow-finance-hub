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

export interface PortalCashflowEntry {
  id: string;
  client_id: string;
  entry_date: string;
  entry_type: PortalCashflowEntryType;
  category: string;
  description: string;
  amount: number;
  status: PortalCashflowEntryStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface NewPortalCashflowEntryPayload {
  entry_date: string;
  entry_type: PortalCashflowEntryType;
  category: string;
  description: string;
  amount: number;
  status: PortalCashflowEntryStatus;
}

export interface PortalFormField {
  name: string;
  label: string;
  type: "text" | "email" | "date" | "select" | "textarea";
  required?: boolean;
  options?: string[];
  placeholder?: string;
}

export interface PortalFormTemplate {
  id: string;
  title: string;
  description: string | null;
  sector: string;
  fields: PortalFormField[];
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
    description: "Duvidas e demandas sobre tributos, guias e obrigacoes fiscais.",
    examples: ["Apuracao de imposto do mes", "Duvida sobre guia atrasada"],
    defaultSector: "Fiscal",
  },
  {
    key: "Contabil",
    label: "Contabil",
    description: "Assuntos de fechamento, balanco, DRE e lancamentos.",
    examples: ["Fechamento contabil mensal", "Revisao de lancamentos"],
    defaultSector: "Contabil",
  },
  {
    key: "Departamento pessoal",
    label: "Departamento pessoal",
    description: "Admissao, folha, ferias, rescisao e rotinas de colaboradores.",
    examples: ["Admissao de colaborador", "Conferencia de folha"],
    defaultSector: "Departamento Pessoal",
  },
  {
    key: "Documentacao",
    label: "Documentacao",
    description: "Envio e conferencia de documentos para rotinas internas.",
    examples: ["Envio de contrato social", "Documentos para cadastro bancario"],
    defaultSector: "Geral",
  },
  {
    key: "Abertura / alteracao",
    label: "Abertura / alteracao",
    description: "Abertura de empresa e alteracoes cadastrais/societarias.",
    examples: ["Alteracao de endereco", "Abertura de CNPJ"],
    defaultSector: "Societario",
  },
  {
    key: "Financeiro",
    label: "Financeiro",
    description: "Fluxo financeiro, conciliacoes e controles de recebimentos/pagamentos.",
    examples: ["Conciliacao bancaria", "Duvida sobre contas a pagar"],
    defaultSector: "Financeiro",
  },
  {
    key: "Outros",
    label: "Outros",
    description: "Assuntos gerais que nao se encaixam nas categorias anteriores.",
    examples: ["Suporte geral do portal", "Solicitacao administrativa"],
    defaultSector: "Geral",
  },
];

export const sectorOptions = [
  "Contabil",
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
  { id: "extratos", label: "Extratos bancarios" },
  { id: "notas", label: "XML/PDF de notas emitidas e recebidas" },
  { id: "folha", label: "Folhas e recibos de pagamento" },
  { id: "contratos", label: "Contratos novos ou alterados no mes" },
  { id: "cadastro", label: "Documentos cadastrais atualizados" },
];

export const supportSectors = [
  "Fiscal",
  "Contabil",
  "Departamento Pessoal",
  "Financeiro",
  "Societario",
];

export const cashflowCategoriesByType: Record<PortalCashflowEntryType, string[]> = {
  income: [
    "Recebimento de clientes",
    "Aporte dos socios",
    "Credito bancario",
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

export const parsePortalFields = (value: unknown): PortalFormField[] => {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const raw = item as Record<string, unknown>;
      const type = String(raw.type || "text");
      if (!["text", "email", "date", "select", "textarea"].includes(type)) return null;

      return {
        name: String(raw.name || ""),
        label: String(raw.label || ""),
        type: type as PortalFormField["type"],
        required: Boolean(raw.required),
        options: Array.isArray(raw.options) ? raw.options.map((option) => String(option)) : [],
        placeholder: raw.placeholder ? String(raw.placeholder) : "",
      };
    })
    .filter((field): field is PortalFormField => Boolean(field));
};
