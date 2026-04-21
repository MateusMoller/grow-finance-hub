
import { AppLayout } from "@/components/app/AppLayout";
import { motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  BarChart3,
  Briefcase,
  ClipboardList,
  Download,
  Edit3,
  FileSpreadsheet,
  Loader2,
  PlayCircle,
  RefreshCw,
  Save,
  Trash2,
  TrendingUp,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useGlobalFilters } from "@/hooks/useGlobalFilters";
import { getTaskCompetence, matchesSelectedCompany, matchesSelectedCompetence, normalizeCompetence } from "@/lib/globalFilters";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

type ReportDatasetId = "clientes" | "leads_crm" | "tarefas" | "equipe";
type ExportFormat = "csv" | "xlsx";
type ReportRow = Record<string, unknown>;

type ClientRow = Pick<
  Tables<"clients">,
  "id" | "name" | "cnpj" | "regime" | "sector" | "status" | "contact" | "email" | "phone" | "created_at" | "updated_at"
>;

type LeadRow = Pick<
  Tables<"site_leads">,
  "id" | "full_name" | "company_name" | "email" | "phone" | "source_tag" | "origin_page" | "created_at"
>;

type TaskRow = Pick<
  Tables<"kanban_tasks">,
  "id" | "title" | "client_name" | "assignee" | "sector" | "priority" | "status" | "due_date" | "created_at" | "updated_at"
>;

type ProfileRow = Pick<Tables<"profiles">, "user_id" | "display_name" | "created_at" | "updated_at">;
type RoleRow = Pick<Tables<"user_roles">, "user_id" | "role" | "created_at">;

type SavedReportRow = Pick<
  Tables<"saved_reports">,
  "id" | "name" | "dataset_id" | "column_keys" | "format" | "auto_generate" | "created_at" | "updated_at"
>;

type ClientDataRow = Pick<
  Tables<"client_data">,
  "client_id" | "category" | "field_name" | "field_value" | "period"
>;

interface TeamReportRow {
  user_id: string;
  display_name: string;
  role: string;
  created_at: string;
  updated_at: string;
  role_created_at: string | null;
}

interface ReportColumnDefinition {
  key: string;
  label: string;
  formatter?: (value: unknown) => string;
}

interface ReportDatasetDefinition {
  id: ReportDatasetId;
  name: string;
  description: string;
  icon: LucideIcon;
  colorClass: string;
  columns: ReportColumnDefinition[];
  defaultColumns: string[];
}

interface AutomaticReportCard {
  datasetId: ReportDatasetId;
  count: number;
  stats: Array<{ label: string; value: string }>;
}

interface SavedReportConfig {
  id: string;
  name: string;
  datasetId: ReportDatasetId;
  columnKeys: string[];
  format: ExportFormat;
  autoGenerate: boolean;
  createdAt: string;
  updatedAt: string;
}

const roleOrder = [
  "admin",
  "director",
  "manager",
  "employee",
  "commercial",
  "departamento_pessoal",
  "fiscal",
  "contabil",
] as const;

const rolePriority = new Map(roleOrder.map((role, index) => [role, index]));
const doneTaskStatuses = new Set(["done", "archived", "concluído", "concluída", "completed", "fechado"]);

const normalizeText = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const formatDateTime = (value: unknown) => {
  if (typeof value !== "string" || !value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("pt-BR");
};

const formatDate = (value: unknown) => {
  if (typeof value !== "string" || !value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("pt-BR");
};

const parseNumericValue = (value: unknown): number | null => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value !== "string") return null;

  const cleaned = value.trim().replace(/\s+/g, "").replace(/r\$/gi, "");
  if (!cleaned) return null;

  let normalized = cleaned;
  if (cleaned.includes(",") && cleaned.includes(".")) {
    normalized = cleaned.replace(/\./g, "").replace(",", ".");
  } else {
    normalized = cleaned.replace(",", ".");
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const formatDecimal = (value: unknown, fractionDigits = 2) => {
  const numeric = parseNumericValue(value);
  if (numeric === null) return "-";
  return numeric.toLocaleString("pt-BR", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
};

const formatCurrency = (value: unknown) => {
  const numeric = parseNumericValue(value);
  if (numeric === null) return "-";
  return numeric.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
};

const formatPercent = (value: unknown) => {
  const decimal = formatDecimal(value, 2);
  if (decimal === "-") return "-";
  return `${decimal}%`;
};

const formatRole = (role: string) =>
  role
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

const pickPrimaryRole = (roles: string[]) => {
  if (roles.length === 0) return "";
  const sorted = [...roles].sort((a, b) => {
    const aPriority = rolePriority.get(a as (typeof roleOrder)[number]) ?? 999;
    const bPriority = rolePriority.get(b as (typeof roleOrder)[number]) ?? 999;
    return aPriority - bPriority;
  });
  return sorted[0];
};

const isTaskDone = (status: string) => {
  const normalized = normalizeText(status || "");
  return doneTaskStatuses.has(normalized);
};

const taskStatusLabel = (status: string) => {
  const normalized = normalizeText(status || "");
  if (normalized === "todo") return "A fazer";
  if (normalized === "doing") return "Em andamento";
  if (normalized === "review") return "Em revisão";
  if (normalized === "done") return "Concluído";
  if (normalized === "archived") return "Arquivado";
  return status || "Sem status";
};

const sanitizeFileName = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w-]+/g, "-")
    .replace(/--+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();

const formatCellValue = (value: unknown, formatter?: (value: unknown) => string) => {
  if (formatter) return formatter(value);
  if (value === null || value === undefined) return "";
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map((item) => String(item)).join(", ");
  return JSON.stringify(value);
};

const triggerBlobDownload = (blob: Blob, fileName: string) => {
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
};

const getCurrentCompetence = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
};

const monthlyClientDataCategories = ["contabilidade", "fiscal", "dp"] as const;
type MonthlyClientDataCategory = (typeof monthlyClientDataCategories)[number];

const cadastralClientDataCategories = [
  "cadastro_clientes",
  "cadastro_fiscal",
  "cadastro_departamento_pessoal",
  "cadastro_contabil",
  "cadastro_obrigacoes",
  "cadastro_honorarios",
  "cadastro_documentos",
] as const;
type CadastralClientDataCategory = (typeof cadastralClientDataCategories)[number];
type ClientDataCategory = MonthlyClientDataCategory | CadastralClientDataCategory;

interface ClientDataFieldDefinition {
  name: string;
  label: string;
}

interface ClientPartnerReportEntry {
  nome: string;
  percentual_participacao: number;
  pro_labore: number;
  senha_gov: string;
}

const monthlyClientDataCategoryLabel: Record<MonthlyClientDataCategory, string> = {
  contabilidade: "Contabilidade",
  fiscal: "Fiscal",
  dp: "Dept. Pessoal",
};

const cadastralClientDataCategoryLabel: Record<CadastralClientDataCategory, string> = {
  cadastro_clientes: "Cadastro Clientes",
  cadastro_fiscal: "Setor Fiscal",
  cadastro_departamento_pessoal: "Setor DP",
  cadastro_contabil: "Setor Contábil",
  cadastro_obrigacoes: "Obrigações",
  cadastro_honorarios: "Honorarios",
  cadastro_documentos: "Documentos",
};

const monthlyClientDataFieldsByCategory: Record<MonthlyClientDataCategory, ClientDataFieldDefinition[]> = {
  contabilidade: [
    { name: "faturamento_mensal", label: "Faturamento Mensal (R$)" },
    { name: "despesas_operacionais", label: "Despesas Operacionais (R$)" },
    { name: "lucro_liquido", label: "Lucro Liquido (R$)" },
    { name: "ativo_total", label: "Ativo Total (R$)" },
    { name: "passivo_total", label: "Passivo Total (R$)" },
    { name: "patrimonio_liquido", label: "Patrimonio Liquido (R$)" },
    { name: "capital_social", label: "Capital Social (R$)" },
    { name: "contas_a_receber", label: "Contas a Receber (R$)" },
    { name: "contas_a_pagar", label: "Contas a Pagar (R$)" },
    { name: "estoque", label: "Estoque (R$)" },
  ],
  fiscal: [
    { name: "regime_tributário", label: "Regime Tributario" },
    { name: "aliquota_irpj", label: "Aliquota IRPJ (%)" },
    { name: "aliquota_csll", label: "Aliquota CSLL (%)" },
    { name: "aliquota_pis", label: "Aliquota PIS (%)" },
    { name: "aliquota_cofins", label: "Aliquota COFINS (%)" },
    { name: "aliquota_iss", label: "Aliquota ISS (%)" },
    { name: "aliquota_icms", label: "Aliquota ICMS (%)" },
    { name: "inscricao_estadual", label: "Inscricao Estadual" },
    { name: "inscricao_municipal", label: "Inscricao Municipal" },
    { name: "cnae_principal", label: "CNAE Principal" },
    { name: "nfe_emitidas", label: "NF-e Emitidas no Período" },
    { name: "valor_total_nfe", label: "Valor Total NF-e (R$)" },
  ],
  dp: [
    { name: "total_funcionarios", label: "Total de Funcionários" },
    { name: "folha_pagamento", label: "Folha de Pagamento (R$)" },
    { name: "encargos_sociais", label: "Encargos Sociais (R$)" },
    { name: "fgts_mensal", label: "FGTS Mensal (R$)" },
    { name: "inss_patronal", label: "INSS Patronal (R$)" },
    { name: "vale_transporte", label: "Vale Transporte (R$)" },
    { name: "vale_alimentacao", label: "Vale Alimentacao (R$)" },
    { name: "admissões_periodo", label: "Admissoes no Período" },
    { name: "demissoes_periodo", label: "Demissões no Período" },
    { name: "ferias_programadas", label: "Férias Programadas" },
    { name: "sindical_contribuicao", label: "Contribuicao Sindical (R$)" },
  ],
};

const cadastralClientDataFieldsByCategory: Record<CadastralClientDataCategory, ClientDataFieldDefinition[]> = {
  cadastro_clientes: [
    { name: "codigo", label: "Codigo" },
    { name: "nome_fantasia", label: "Nome Fantasia" },
    { name: "inscricao_estadual", label: "Inscricao Estadual" },
    { name: "inscricao_municipal", label: "Inscricao Municipal" },
    { name: "regime_tributário", label: "Regime Tributario" },
    { name: "cnae_principal", label: "CNAE Principal" },
    { name: "data_abertura", label: "Data de Abertura" },
    { name: "cep", label: "CEP" },
    { name: "endereço", label: "Rua / Logradouro" },
    { name: "numero_estabelecimento", label: "Número do Estabelecimento" },
    { name: "complemento_endereco", label: "Complemento" },
    { name: "bairro", label: "Bairro" },
    { name: "perfil_atuacao", label: "Classificação de Atividade" },
    { name: "cidade", label: "Cidade" },
    { name: "estado", label: "Estado" },
    { name: "inscricao_estadual_uf", label: "UF da Inscricao Estadual" },
    { name: "inscricao_estadual_data", label: "Data da Inscricao Estadual" },
    { name: "inscricao_municipal_data", label: "Data da Inscricao Municipal" },
    { name: "ddd", label: "DDD" },
    { name: "telefone", label: "Telefone" },
    { name: "whatsapp", label: "WhatsApp" },
    { name: "website_empresa", label: "Website da Empresa" },
    { name: "grupo_empresas", label: "Grupo de Empresas" },
    { name: "apelido_econtinuo", label: "Apelido E-Continuo" },
    { name: "nire", label: "NIRE" },
    { name: "outros_identificadores", label: "Outros Identificadores" },
    { name: "empresa_ativa", label: "Empresa Ativa?" },
    { name: "empresa_isenta", label: "Empresa Isenta?" },
  ],
  cadastro_fiscal: [
    { name: "regime_icms", label: "Regime ICMS" },
    { name: "contribuinte_icms", label: "Contribuinte ICMS" },
    { name: "contribuinte_ipi", label: "Contribuinte IPI" },
    { name: "tipo_operacao", label: "Tipo de Operação" },
    { name: "emite_nfe", label: "Emite NF-e" },
    { name: "emite_nfse", label: "Emite NFS-e" },
    { name: "portal_nf_utilizado", label: "Portal NF utilizado" },
    { name: "possui_st", label: "Possui ST" },
    { name: "estados_que_opera", label: "Estados que Opera" },
    { name: "controle_estoque", label: "Controle de Estoque" },
    { name: "sistema_vendas", label: "Sistema de Vendas" },
    { name: "integracao_contabil", label: "Integração Contábil" },
    { name: "entrega_gia", label: "Entrega GIA" },
    { name: "entrega_sped_fiscal", label: "Entrega SPED Fiscal" },
  ],
  cadastro_departamento_pessoal: [
    { name: "possui_pro_labore", label: "Possui Pro-labore" },
    { name: "possui_funcionarios", label: "Possui Funcionários" },
    { name: "possui_variaveis", label: "Possui Variaveis" },
    { name: "possui_inss", label: "Possui INSS" },
    { name: "possui_fgts", label: "Possui FGTS" },
    { name: "possui_adiantamento_salarial", label: "Possui adiantamento salarial?" },
    { name: "envia_folha_ponto", label: "Envia Folha Ponto?" },
    { name: "beneficios", label: "Beneficios" },
    { name: "hora_extra_banco_horas", label: "Hora extra / Banco de horas" },
    { name: "envia_relatorio_ferias", label: "Envia relatório de férias?" },
    { name: "clinica_parceira", label: "Clinica parceira" },
    { name: "possui_decimo_terceiro", label: "Possui 13o?" },
    { name: "sindicato_nome", label: "Nome do Sindicato" },
    { name: "sindicato_cnpj", label: "CNPJ do Sindicato" },
    { name: "sindicato_codigo_registro", label: "Codigo/Registro do Sindicato" },
    { name: "sindicato_contato", label: "Contato do Sindicato" },
    { name: "sindicato_telefone_whatsapp", label: "Telefone/WhatsApp do Sindicato" },
    { name: "sindicato_observacoes", label: "Observacoes do Sindicato" },
  ],
  cadastro_contabil: [
    { name: "obrigacao_contabil", label: "Obrigação Contábil" },
    { name: "envia_extratos_bancarios", label: "Envia Extratos Bancarios" },
    { name: "envia_notas_fiscais", label: "Envia Notas Fiscais" },
    { name: "controle_financeiro", label: "Controle Financeiro" },
    { name: "sistema_financeiro", label: "Sistema Financeiro" },
    { name: "integracao_contabil", label: "Integração Contábil" },
    { name: "balanco_anual", label: "Balanco Anual" },
    { name: "responsavel_contabil_grow", label: "Responsavel Contábil Grow" },
    { name: "periodicidade_relatorios", label: "Periodicidade Relatórios" },
    { name: "observacoes_contabeis", label: "Observacoes Contabeis" },
  ],
  cadastro_obrigacoes: [
    { name: "pgdas", label: "PGDAS" },
    { name: "gia", label: "GIA" },
    { name: "sped_fiscal", label: "SPED Fiscal" },
    { name: "efd_contribuicoes", label: "EFD Contribuicoes" },
    { name: "dctf", label: "DCTF" },
    { name: "defis", label: "DEFIS" },
    { name: "ecd", label: "ECD" },
    { name: "ecf", label: "ECF" },
  ],
  cadastro_honorarios: [
    { name: "plano", label: "Plano" },
    { name: "valor_mensal", label: "Valor Mensal (R$)" },
    { name: "forma_pagamento", label: "Forma de Pagamento" },
    { name: "vencimento", label: "Vencimento" },
    { name: "situacao", label: "Situacao" },
  ],
  cadastro_documentos: [
    { name: "contrato", label: "Contrato" },
    { name: "procuracao", label: "Procuracao" },
    { name: "certificado_digital", label: "Certificado Digital" },
    { name: "contrato_social", label: "Contrato Social" },
    { name: "alteracoes_contratuais", label: "Alterações Contratuais" },
    { name: "outros_documentos", label: "Outros Documentos" },
  ],
};

const parseClientPartnersField = (rawValue: string | null | undefined): ClientPartnerReportEntry[] => {
  if (!rawValue?.trim()) return [];

  try {
    const parsed = JSON.parse(rawValue) as unknown;
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((item): ClientPartnerReportEntry | null => {
        if (!item || typeof item !== "object" || Array.isArray(item)) return null;
        const row = item as Record<string, unknown>;

        const nome = typeof row.nome === "string"
          ? row.nome.trim()
          : typeof row.name === "string"
            ? row.name.trim()
            : "";
        const percentual = parseNumericValue(row.percentual_participacao ?? row.percentual ?? row.ownershipPercent);
        const proLabore = parseNumericValue(row.pro_labore ?? row.proLabore ?? row.prolabore);
        const senhaGov = typeof row.senha_gov === "string"
          ? row.senha_gov.trim()
          : typeof row.govPassword === "string"
            ? row.govPassword.trim()
            : "";

        return {
          nome,
          percentual_participacao: percentual ?? 0,
          pro_labore: proLabore ?? 0,
          senha_gov: senhaGov,
        };
      })
      .filter((partner): partner is ClientPartnerReportEntry => Boolean(partner));
  } catch {
    return [];
  }
};

const summarizeClientPartners = (partners: ClientPartnerReportEntry[]) => {
  const total = partners.length;
  const names = partners.map((partner) => partner.nome).filter(Boolean).join("; ");
  const totalOwnership = partners.reduce((sum, partner) => sum + partner.percentual_participacao, 0);
  const totalProLabore = partners.reduce((sum, partner) => sum + partner.pro_labore, 0);
  const withGovPassword = partners.filter((partner) => Boolean(partner.senha_gov)).length;
  const govPasswordStatus =
    total === 0 ? "Não informado" : withGovPassword === total ? "Completo" : withGovPassword > 0 ? "Parcial" : "Nao";
  const ownershipByPartner = partners
    .map((partner) => {
      const partnerName = partner.nome || "Sócio sem nome";
      return `${partnerName}: ${formatPercent(partner.percentual_participacao)}`;
    })
    .join(" | ");

  return {
    total,
    names,
    totalOwnership,
    totalProLabore,
    withGovPassword,
    govPasswordStatus,
    ownershipByPartner,
  };
};

const toMonthlyClientDataColumnKey = (category: MonthlyClientDataCategory, fieldName: string) =>
  `mensal_${category}_${fieldName}`;
const toCadastralClientDataColumnKey = (category: CadastralClientDataCategory, fieldName: string) =>
  `cadastral_${category}_${fieldName}`;

const monthlyClientDataCategorySet = new Set<string>(monthlyClientDataCategories);
const cadastralClientDataCategorySet = new Set<string>(cadastralClientDataCategories);

const clientDataReportColumns: ReportColumnDefinition[] = [
  { key: "dados_mensais_periodo", label: "Dados Mensais: Período" },
  ...monthlyClientDataCategories.flatMap((category) =>
    monthlyClientDataFieldsByCategory[category].map((field) => ({
      key: toMonthlyClientDataColumnKey(category, field.name),
      label: `Mensal ${monthlyClientDataCategoryLabel[category]}: ${field.label}`,
    })),
  ),
  ...cadastralClientDataCategories.flatMap((category) =>
    cadastralClientDataFieldsByCategory[category].map((field) => ({
      key: toCadastralClientDataColumnKey(category, field.name),
      label: `Cadastral ${cadastralClientDataCategoryLabel[category]}: ${field.label}`,
    })),
  ),
  {
    key: "cadastral_cadastro_clientes_socios_quantidade",
    label: "Cadastral Cadastro Clientes: Sócios - Quantidade",
  },
  {
    key: "cadastral_cadastro_clientes_socios_nomes",
    label: "Cadastral Cadastro Clientes: Sócios - Nomes",
  },
  {
    key: "cadastral_cadastro_clientes_socios_participacao_total",
    label: "Cadastral Cadastro Clientes: Sócios - Participação Total (%)",
    formatter: formatPercent,
  },
  {
    key: "cadastral_cadastro_clientes_socios_participacao_por_socio",
    label: "Cadastral Cadastro Clientes: Sócios - Participação por Sócio",
  },
  {
    key: "cadastral_cadastro_clientes_socios_pro_labore_total",
    label: "Cadastral Cadastro Clientes: Sócios - Pro-labore Total (R$)",
    formatter: formatCurrency,
  },
  {
    key: "cadastral_cadastro_clientes_socios_com_senha_gov",
    label: "Cadastral Cadastro Clientes: Sócios com Senha GOV",
  },
  {
    key: "cadastral_cadastro_clientes_socios_status_senha_gov",
    label: "Cadastral Cadastro Clientes: Sócios - Status Senha GOV",
  },
];

const reportDefinitions: Record<ReportDatasetId, ReportDatasetDefinition> = {
  clientes: {
    id: "clientes",
    name: "Clientes",
    description: "Carteira de clientes ativos, inativos e dados cadastrais.",
    icon: Users,
    colorClass: "bg-primary/10 text-primary",
    columns: [
      { key: "nome", label: "Nome" },
      { key: "cnpj", label: "CNPJ" },
      { key: "regime", label: "Regime" },
      { key: "segmento", label: "Segmento" },
      { key: "status", label: "Status" },
      { key: "contato", label: "Contato" },
      { key: "email", label: "E-mail" },
      { key: "telefone", label: "Telefone" },
      { key: "criado_em", label: "Criado em", formatter: formatDateTime },
      { key: "atualizado_em", label: "Atualizado em", formatter: formatDateTime },
      ...clientDataReportColumns,
    ],
    defaultColumns: [
      "nome",
      "status",
      "segmento",
      "contato",
      "email",
      "telefone",
      "dados_mensais_periodo",
      "mensal_contabilidade_faturamento_mensal",
      "mensal_contabilidade_lucro_liquido",
      "mensal_fiscal_regime_tributário",
      "mensal_dp_total_funcionarios",
      "cadastral_cadastro_clientes_nome_fantasia",
      "cadastral_cadastro_clientes_regime_tributário",
      "cadastral_cadastro_clientes_socios_quantidade",
      "cadastral_cadastro_clientes_socios_pro_labore_total",
    ],
  },
  leads_crm: {
    id: "leads_crm",
    name: "Leads e CRM",
    description: "Leads capturados no site e distribuicao por origem.",
    icon: TrendingUp,
    colorClass: "bg-amber-100 text-amber-700 dark:bg-amber-900/20",
    columns: [
      { key: "nome", label: "Nome" },
      { key: "empresa", label: "Empresa" },
      { key: "email", label: "E-mail" },
      { key: "telefone", label: "Telefone" },
      { key: "origem", label: "Origem" },
      { key: "pagina_origem", label: "Pagina de origem" },
      { key: "criado_em", label: "Criado em", formatter: formatDateTime },
    ],
    defaultColumns: ["nome", "empresa", "email", "telefone", "origem", "criado_em"],
  },
  tarefas: {
    id: "tarefas",
    name: "Tarefas",
    description: "Produtividade da operação com status, prioridade e prazos.",
    icon: ClipboardList,
    colorClass: "bg-blue-100 text-blue-700 dark:bg-blue-900/20",
    columns: [
      { key: "titulo", label: "Titulo" },
      { key: "cliente", label: "Cliente" },
      { key: "responsavel", label: "Responsavel" },
      { key: "setor", label: "Setor" },
      { key: "prioridade", label: "Prioridade" },
      { key: "status", label: "Status" },
      { key: "prazo", label: "Prazo", formatter: formatDate },
      { key: "criado_em", label: "Criado em", formatter: formatDateTime },
      { key: "atualizado_em", label: "Atualizado em", formatter: formatDateTime },
    ],
    defaultColumns: ["titulo", "cliente", "setor", "responsavel", "prioridade", "status", "prazo"],
  },
  equipe: {
    id: "equipe",
    name: "Equipe",
    description: "Visão da equipe interna com papeis e datas de cadastro.",
    icon: Briefcase,
    colorClass: "bg-orange-100 text-orange-700 dark:bg-orange-900/20",
    columns: [
      { key: "colaborador", label: "Colaborador" },
      { key: "papel", label: "Papel" },
      { key: "usuario_id", label: "Usuário ID" },
      { key: "criado_em", label: "Criado em", formatter: formatDateTime },
      { key: "atualizado_em", label: "Atualizado em", formatter: formatDateTime },
      { key: "papel_definido_em", label: "Papel definido em", formatter: formatDateTime },
    ],
    defaultColumns: ["colaborador", "papel", "usuario_id", "criado_em", "atualizado_em"],
  },
};

const reportDatasetIds = Object.keys(reportDefinitions) as ReportDatasetId[];

const clientGeneralColumnKeys = new Set([
  "nome",
  "cnpj",
  "regime",
  "segmento",
  "status",
  "contato",
  "email",
  "telefone",
]);

const clientTimelineColumnKeys = new Set(["criado_em", "atualizado_em"]);
const leadsSourceColumnKeys = new Set(["origem", "pagina_origem"]);
const leadsContactColumnKeys = new Set(["nome", "empresa", "email", "telefone"]);
const taskExecutionColumnKeys = new Set(["titulo", "cliente", "responsavel", "setor", "prioridade", "status"]);
const taskTimelineColumnKeys = new Set(["prazo", "criado_em", "atualizado_em"]);
const teamIdentityColumnKeys = new Set(["colaborador", "papel", "usuario_id"]);
const teamTimelineColumnKeys = new Set(["criado_em", "atualizado_em", "papel_definido_em"]);

const resolveMonthlyCategoryFromColumnKey = (columnKey: string): MonthlyClientDataCategory | null =>
  monthlyClientDataCategories.find((category) => columnKey.startsWith(`mensal_${category}_`)) || null;

const resolveCadastralCategoryFromColumnKey = (columnKey: string): CadastralClientDataCategory | null =>
  cadastralClientDataCategories.find((category) => columnKey.startsWith(`cadastral_${category}_`)) || null;

const getColumnModulePath = (datasetId: ReportDatasetId, columnKey: string): [string, string] => {
  if (datasetId === "clientes") {
    if (columnKey === "dados_mensais_periodo") return ["Clientes", "Dados Mensais > Período"];

    const monthlyCategory = resolveMonthlyCategoryFromColumnKey(columnKey);
    if (monthlyCategory) {
      return ["Clientes", `Dados Mensais > ${monthlyClientDataCategoryLabel[monthlyCategory]}`];
    }

    const cadastralCategory = resolveCadastralCategoryFromColumnKey(columnKey);
    if (cadastralCategory) {
      return ["Clientes", `Dados Cadastrais > ${cadastralClientDataCategoryLabel[cadastralCategory]}`];
    }

    if (clientGeneralColumnKeys.has(columnKey)) return ["Clientes", "Dados Gerais"];
    if (clientTimelineColumnKeys.has(columnKey)) return ["Clientes", "Datas de Controle"];
    return ["Clientes", "Outros"];
  }

  if (datasetId === "leads_crm") {
    if (leadsSourceColumnKeys.has(columnKey)) return ["Leads e CRM", "Origem e Captação"];
    if (leadsContactColumnKeys.has(columnKey)) return ["Leads e CRM", "Identificação e Contato"];
    return ["Leads e CRM", "Datas e Controle"];
  }

  if (datasetId === "tarefas") {
    if (taskExecutionColumnKeys.has(columnKey)) return ["Tarefas", "Execucao e Responsabilidade"];
    if (taskTimelineColumnKeys.has(columnKey)) return ["Tarefas", "Datas e Prazos"];
    return ["Tarefas", "Outros"];
  }

  if (teamIdentityColumnKeys.has(columnKey)) return ["Equipe", "Identificação e Papel"];
  if (teamTimelineColumnKeys.has(columnKey)) return ["Equipe", "Datas de Controle"];
  return ["Equipe", "Outros"];
};

const isReportDatasetId = (value: string): value is ReportDatasetId =>
  reportDatasetIds.includes(value as ReportDatasetId);

const sanitizeColumnKeysForDataset = (datasetId: ReportDatasetId, columnKeys: unknown): string[] => {
  if (!Array.isArray(columnKeys)) return [];
  const validColumns = new Set(reportDefinitions[datasetId].columns.map((column) => column.key));

  return Array.from(
    new Set(
      columnKeys
        .filter((item): item is string => typeof item === "string")
        .filter((columnKey) => validColumns.has(columnKey)),
    ),
  );
};

const mapSavedReportRow = (row: SavedReportRow): SavedReportConfig | null => {
  const datasetId = isReportDatasetId(row.dataset_id) ? row.dataset_id : null;
  if (!datasetId) return null;

  const name = (row.name || "").trim();
  if (!name) return null;

  const columnKeys = sanitizeColumnKeysForDataset(datasetId, row.column_keys);
  if (columnKeys.length === 0) return null;

  return {
    id: row.id,
    name,
    datasetId,
    columnKeys,
    format: row.format === "csv" ? "csv" : "xlsx",
    autoGenerate: Boolean(row.auto_generate),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

export default function RelatoriosPage() {
  const { user } = useAuth();
  const { selectedCompany, selectedCompetence } = useGlobalFilters();
  const autoGeneratedReportIdsRef = useRef<Set<string>>(new Set());
  const clientDataReportPeriod = normalizeCompetence(selectedCompetence) || getCurrentCompetence();

  const [loading, setLoading] = useState(true);
  const [loadingSavedReports, setLoadingSavedReports] = useState(true);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [clientDataEntries, setClientDataEntries] = useState<ClientDataRow[]>([]);
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [team, setTeam] = useState<TeamReportRow[]>([]);

  const [customDatasetId, setCustomDatasetId] = useState<ReportDatasetId>("clientes");
  const [selectedColumns, setSelectedColumns] = useState<string[]>(reportDefinitions.clientes.defaultColumns);
  const [leftSelectedKeys, setLeftSelectedKeys] = useState<string[]>([]);
  const [rightSelectedKeys, setRightSelectedKeys] = useState<string[]>([]);
  const [savedReports, setSavedReports] = useState<SavedReportConfig[]>([]);
  const [savedReportName, setSavedReportName] = useState("");
  const [savedReportFormat, setSavedReportFormat] = useState<ExportFormat>("xlsx");
  const [savedReportAutoGenerate, setSavedReportAutoGenerate] = useState(false);
  const [editingSavedReportId, setEditingSavedReportId] = useState<string | null>(null);
  const skipDatasetResetRef = useRef(false);

  const loadReportData = useCallback(async () => {
    setLoading(true);

    const [clientsRes, monthlyClientDataRes, cadastralClientDataRes, leadsRes, tasksRes, profilesRes, rolesRes] = await Promise.all([
      supabase
        .from("clients")
        .select("id, name, cnpj, regime, sector, status, contact, email, phone, created_at, updated_at")
        .order("name"),
      supabase
        .from("client_data")
        .select("client_id, category, field_name, field_value, period")
        .in("category", [...monthlyClientDataCategories])
        .eq("period", clientDataReportPeriod),
      supabase
        .from("client_data")
        .select("client_id, category, field_name, field_value, period")
        .in("category", [...cadastralClientDataCategories])
        .is("period", null),
      supabase
        .from("site_leads")
        .select("id, full_name, company_name, email, phone, source_tag, origin_page, created_at")
        .order("created_at", { ascending: false })
        .limit(2000),
      supabase
        .from("kanban_tasks")
        .select("id, title, client_name, assignee, sector, priority, status, due_date, created_at, updated_at")
        .order("created_at", { ascending: false })
        .limit(3000),
      supabase
        .from("profiles")
        .select("user_id, display_name, created_at, updated_at")
        .order("created_at", { ascending: false }),
      supabase
        .from("user_roles")
        .select("user_id, role, created_at")
        .order("created_at", { ascending: false }),
    ]);

    const firstError =
      clientsRes.error ||
      monthlyClientDataRes.error ||
      cadastralClientDataRes.error ||
      leadsRes.error ||
      tasksRes.error ||
      profilesRes.error ||
      rolesRes.error;

    if (firstError) {
      toast.error(`Falha ao carregar relatórios: ${firstError.message}`);
    }

    const nextClients = (clientsRes.data || []) as ClientRow[];
    const nextClientData = [
      ...((monthlyClientDataRes.data || []) as ClientDataRow[]),
      ...((cadastralClientDataRes.data || []) as ClientDataRow[]),
    ];
    const nextLeads = (leadsRes.data || []) as LeadRow[];
    const nextTasks = (tasksRes.data || []) as TaskRow[];
    const nextProfiles = (profilesRes.data || []) as ProfileRow[];
    const nextRoles = (rolesRes.data || []) as RoleRow[];

    const profileByUserId = new Map(nextProfiles.map((profile) => [profile.user_id, profile]));
    const rolesByUserId = new Map<string, RoleRow[]>();
    nextRoles.forEach((role) => {
      const current = rolesByUserId.get(role.user_id) || [];
      current.push(role);
      rolesByUserId.set(role.user_id, current);
    });

    const allTeamUserIds = new Set<string>();
    nextProfiles.forEach((profile) => allTeamUserIds.add(profile.user_id));
    nextRoles.forEach((role) => allTeamUserIds.add(role.user_id));

    const teamRows = Array.from(allTeamUserIds)
      .map((userId) => {
        const profile = profileByUserId.get(userId);
        const userRoles = (rolesByUserId.get(userId) || []).map((item) => item.role);
        const mainRole = pickPrimaryRole(userRoles);
        const firstRoleCreatedAt = (rolesByUserId.get(userId) || [])[0]?.created_at || null;

        return {
          user_id: userId,
          display_name: profile?.display_name || `Usuário ${userId.slice(0, 6)}`,
          role: mainRole ? formatRole(mainRole) : "Sem papel",
          created_at: profile?.created_at || firstRoleCreatedAt || "",
          updated_at: profile?.updated_at || profile?.created_at || firstRoleCreatedAt || "",
          role_created_at: firstRoleCreatedAt,
        };
      })
      .sort((a, b) => a.display_name.localeCompare(b.display_name, "pt-BR"));

    setClients(nextClients);
    setClientDataEntries(nextClientData);
    setLeads(nextLeads);
    setTasks(nextTasks);
    setTeam(teamRows);
    setLastUpdatedAt(new Date().toISOString());
    setLoading(false);
  }, [clientDataReportPeriod]);

  const loadSavedReports = useCallback(async () => {
    if (!user?.id) {
      setSavedReports([]);
      setLoadingSavedReports(false);
      return;
    }

    setLoadingSavedReports(true);
    const { data, error } = await supabase
      .from("saved_reports")
      .select("id, name, dataset_id, column_keys, format, auto_generate, created_at, updated_at")
      .order("updated_at", { ascending: false });

    if (error) {
      toast.error(`Falha ao carregar relatórios salvos: ${error.message}`);
      setSavedReports([]);
      setLoadingSavedReports(false);
      return;
    }

    const mapped = ((data || []) as SavedReportRow[])
      .map((row) => mapSavedReportRow(row))
      .filter((item): item is SavedReportConfig => Boolean(item));

    setSavedReports(mapped);
    setLoadingSavedReports(false);
  }, [user?.id]);

  useEffect(() => {
    void loadReportData();
  }, [loadReportData]);

  useEffect(() => {
    void loadSavedReports();
    autoGeneratedReportIdsRef.current = new Set();
  }, [loadSavedReports]);

  useEffect(() => {
    if (skipDatasetResetRef.current) {
      skipDatasetResetRef.current = false;
      return;
    }
    setSelectedColumns(reportDefinitions[customDatasetId].defaultColumns);
    setLeftSelectedKeys([]);
    setRightSelectedKeys([]);
  }, [customDatasetId]);

  const filteredClients = useMemo(
    () =>
      clients.filter(
        (client) =>
          matchesSelectedCompany(client.name, selectedCompany) &&
          matchesSelectedCompetence(client.created_at, selectedCompetence),
      ),
    [clients, selectedCompany, selectedCompetence],
  );

  const filteredLeads = useMemo(
    () =>
      leads.filter(
        (lead) =>
          matchesSelectedCompany(lead.company_name || lead.full_name, selectedCompany) &&
          matchesSelectedCompetence(lead.created_at, selectedCompetence),
      ),
    [leads, selectedCompany, selectedCompetence],
  );

  const filteredTasks = useMemo(
    () =>
      tasks.filter(
        (task) =>
          matchesSelectedCompany(task.client_name, selectedCompany) &&
          matchesSelectedCompetence(getTaskCompetence(task.due_date, task.created_at), selectedCompetence),
      ),
    [tasks, selectedCompany, selectedCompetence],
  );

  const filteredTeam = useMemo(
    () =>
      team.filter((member) =>
        selectedCompetence ? matchesSelectedCompetence(member.created_at, selectedCompetence) : true,
      ),
    [team, selectedCompetence],
  );

  const clientDataByClientId = useMemo(() => {
    const byClientId = new Map<string, Record<string, string>>();

    clientDataEntries.forEach((entry) => {
      const current = byClientId.get(entry.client_id) || {};

      if (entry.category === "cadastro_clientes" && !entry.period && entry.field_name === "socios") {
        const partners = parseClientPartnersField(entry.field_value);
        const summary = summarizeClientPartners(partners);
        current.cadastral_cadastro_clientes_socios_quantidade = String(summary.total);
        current.cadastral_cadastro_clientes_socios_nomes = summary.names;
        current.cadastral_cadastro_clientes_socios_participacao_total = String(summary.totalOwnership);
        current.cadastral_cadastro_clientes_socios_participacao_por_socio = summary.ownershipByPartner;
        current.cadastral_cadastro_clientes_socios_pro_labore_total = String(summary.totalProLabore);
        current.cadastral_cadastro_clientes_socios_com_senha_gov = `${summary.withGovPassword}/${summary.total}`;
        current.cadastral_cadastro_clientes_socios_status_senha_gov = summary.govPasswordStatus;
        byClientId.set(entry.client_id, current);
        return;
      }

      let columnKey: string | null = null;

      if (entry.period && monthlyClientDataCategorySet.has(entry.category)) {
        columnKey = toMonthlyClientDataColumnKey(entry.category as MonthlyClientDataCategory, entry.field_name);
      } else if (!entry.period && cadastralClientDataCategorySet.has(entry.category)) {
        columnKey = toCadastralClientDataColumnKey(entry.category as CadastralClientDataCategory, entry.field_name);
      }

      if (!columnKey) return;

      current[columnKey] = entry.field_value || "";
      byClientId.set(entry.client_id, current);
    });

    return byClientId;
  }, [clientDataEntries]);

  const rowsByDataset = useMemo<Record<ReportDatasetId, ReportRow[]>>(
    () => ({
      clientes: filteredClients.map((client) => ({
        id: client.id,
        nome: client.name,
        cnpj: client.cnpj || "",
        regime: client.regime || "",
        segmento: client.sector || "",
        status: client.status || "",
        contato: client.contact || "",
        email: (client.email || "").toLowerCase(),
        telefone: client.phone || "",
        criado_em: client.created_at,
        atualizado_em: client.updated_at,
        dados_mensais_periodo: clientDataReportPeriod,
        ...(clientDataByClientId.get(client.id) || {}),
      })),
      leads_crm: filteredLeads.map((lead) => ({
        id: lead.id,
        nome: lead.full_name,
        empresa: lead.company_name || "",
        email: lead.email,
        telefone: lead.phone || "",
        origem: lead.source_tag,
        pagina_origem: lead.origin_page || "",
        criado_em: lead.created_at,
      })),
      tarefas: filteredTasks.map((task) => ({
        id: task.id,
        titulo: task.title,
        cliente: task.client_name || "",
        responsavel: task.assignee || "",
        setor: task.sector,
        prioridade: task.priority,
        status: taskStatusLabel(task.status),
        prazo: task.due_date || "",
        criado_em: task.created_at,
        atualizado_em: task.updated_at,
      })),
      equipe: filteredTeam.map((member) => ({
        id: member.user_id,
        colaborador: member.display_name,
        papel: member.role,
        usuario_id: member.user_id,
        criado_em: member.created_at,
        atualizado_em: member.updated_at,
        papel_definido_em: member.role_created_at,
      })),
    }),
    [clientDataByClientId, clientDataReportPeriod, filteredClients, filteredLeads, filteredTasks, filteredTeam],
  );

  const automaticCards = useMemo<AutomaticReportCard[]>(() => {
    const activeClients = filteredClients.filter((client) => normalizeText(client.status || "") === "ativo").length;
    const clientsWithContact = filteredClients.filter((client) => Boolean(client.contact || client.email)).length;

    const leadsFromSite = filteredLeads.filter((lead) => normalizeText(lead.source_tag || "").includes("site")).length;
    const leadsIn30Days = filteredLeads.filter((lead) => {
      const createdAt = new Date(lead.created_at).getTime();
      if (Number.isNaN(createdAt)) return false;
      const now = Date.now();
      const last30DaysMs = 30 * 24 * 60 * 60 * 1000;
      return now - createdAt <= last30DaysMs;
    }).length;

    const doneTasks = filteredTasks.filter((task) => isTaskDone(task.status)).length;
    const openTasks = filteredTasks.length - doneTasks;

    const teamWithRole = filteredTeam.filter((member) => normalizeText(member.role) !== "sem papel").length;
    const teamWithoutRole = filteredTeam.length - teamWithRole;

    return [
      {
        datasetId: "clientes",
        count: rowsByDataset.clientes.length,
        stats: [
          { label: "Ativos", value: String(activeClients) },
          { label: "Com contato", value: String(clientsWithContact) },
        ],
      },
      {
        datasetId: "leads_crm",
        count: rowsByDataset.leads_crm.length,
        stats: [
          { label: "Ultimos 30 dias", value: String(leadsIn30Days) },
          { label: "Origem site", value: String(leadsFromSite) },
        ],
      },
      {
        datasetId: "tarefas",
        count: rowsByDataset.tarefas.length,
        stats: [
          { label: "Concluídas", value: String(doneTasks) },
          { label: "Em aberto", value: String(openTasks) },
        ],
      },
      {
        datasetId: "equipe",
        count: rowsByDataset.equipe.length,
        stats: [
          { label: "Com papel", value: String(teamWithRole) },
          { label: "Sem papel", value: String(teamWithoutRole) },
        ],
      },
    ];
  }, [filteredClients, filteredLeads, filteredTasks, filteredTeam, rowsByDataset]);

  const activeFilterBadges = useMemo(() => {
    const items: string[] = [];
    if (selectedCompany) items.push(`Empresa: ${selectedCompany}`);
    if (selectedCompetence) items.push(`Competência: ${selectedCompetence}`);
    items.push(`Dados mensais (relatório): ${clientDataReportPeriod}`);
    return items;
  }, [clientDataReportPeriod, selectedCompany, selectedCompetence]);

  const customDefinition = reportDefinitions[customDatasetId];

  const selectedColumnDefinitions = useMemo(
    () =>
      selectedColumns
        .map((columnKey) => customDefinition.columns.find((column) => column.key === columnKey))
        .filter((column): column is ReportColumnDefinition => Boolean(column)),
    [customDefinition.columns, selectedColumns],
  );

  const availableColumns = useMemo(
    () => customDefinition.columns.filter((column) => !selectedColumns.includes(column.key)),
    [customDefinition.columns, selectedColumns],
  );

  const availableColumnsByModule = useMemo(() => {
    const moduleMap = new Map<
      string,
      {
        id: string;
        label: string;
        subfolders: Map<string, { id: string; label: string; columns: ReportColumnDefinition[] }>;
      }
    >();

    availableColumns.forEach((column) => {
      const [moduleLabel, subfolderLabel] = getColumnModulePath(customDatasetId, column.key);
      const moduleId = normalizeText(moduleLabel);
      const subfolderId = normalizeText(subfolderLabel);

      if (!moduleMap.has(moduleId)) {
        moduleMap.set(moduleId, { id: moduleId, label: moduleLabel, subfolders: new Map() });
      }

      const moduleEntry = moduleMap.get(moduleId)!;
      if (!moduleEntry.subfolders.has(subfolderId)) {
        moduleEntry.subfolders.set(subfolderId, { id: subfolderId, label: subfolderLabel, columns: [] });
      }

      moduleEntry.subfolders.get(subfolderId)!.columns.push(column);
    });

    return Array.from(moduleMap.values()).map((moduleEntry) => {
      const subfolderList = Array.from(moduleEntry.subfolders.values());
      const totalColumns = subfolderList.reduce((sum, subfolder) => sum + subfolder.columns.length, 0);
      return {
        id: moduleEntry.id,
        label: moduleEntry.label,
        subfolders: subfolderList,
        totalColumns,
      };
    });
  }, [availableColumns, customDatasetId]);

  useEffect(() => {
    const availableSet = new Set(availableColumns.map((column) => column.key));
    setLeftSelectedKeys((current) => current.filter((key) => availableSet.has(key)));
  }, [availableColumns]);

  useEffect(() => {
    const selectedSet = new Set(selectedColumns);
    setRightSelectedKeys((current) => current.filter((key) => selectedSet.has(key)));
  }, [selectedColumns]);

  const toggleLeftSelection = (columnKey: string) => {
    setLeftSelectedKeys((current) =>
      current.includes(columnKey) ? current.filter((key) => key !== columnKey) : [...current, columnKey],
    );
  };

  const toggleRightSelection = (columnKey: string) => {
    setRightSelectedKeys((current) =>
      current.includes(columnKey) ? current.filter((key) => key !== columnKey) : [...current, columnKey],
    );
  };

  const handleAddColumns = () => {
    if (leftSelectedKeys.length === 0) return;
    const orderedKeys = customDefinition.columns.map((column) => column.key);

    setSelectedColumns((current) => {
      const merged = Array.from(new Set([...current, ...leftSelectedKeys]));
      merged.sort((a, b) => orderedKeys.indexOf(a) - orderedKeys.indexOf(b));
      return merged;
    });
    setLeftSelectedKeys([]);
  };

  const handleRemoveColumns = () => {
    if (rightSelectedKeys.length === 0) return;
    setSelectedColumns((current) => current.filter((key) => !rightSelectedKeys.includes(key)));
    setRightSelectedKeys([]);
  };

  const canMoveSelectedColumn = rightSelectedKeys.length === 1;
  const selectedColumnForMove = canMoveSelectedColumn ? rightSelectedKeys[0] : null;
  const selectedColumnIndex = selectedColumnForMove ? selectedColumns.indexOf(selectedColumnForMove) : -1;

  const handleMoveSelectedColumn = (direction: "up" | "down") => {
    if (!selectedColumnForMove || selectedColumnIndex < 0) return;
    const targetIndex = direction === "up" ? selectedColumnIndex - 1 : selectedColumnIndex + 1;
    if (targetIndex < 0 || targetIndex >= selectedColumns.length) return;

    const next = [...selectedColumns];
    const [moved] = next.splice(selectedColumnIndex, 1);
    next.splice(targetIndex, 0, moved);
    setSelectedColumns(next);
  };

  const buildExportRows = useCallback(
    (datasetId: ReportDatasetId, columnKeys: string[]) => {
      const definition = reportDefinitions[datasetId];
      const sourceRows = rowsByDataset[datasetId];

      return sourceRows.map((row) => {
        const output: Record<string, string> = {};
        columnKeys.forEach((columnKey) => {
          const column = definition.columns.find((item) => item.key === columnKey);
          if (!column) return;
          output[column.label] = formatCellValue(row[column.key], column.formatter);
        });
        return output;
      });
    },
    [rowsByDataset],
  );

  const handleExport = useCallback(
    async (datasetId: ReportDatasetId, columnKeys: string[], format: ExportFormat, scopeLabel: string) => {
      const definition = reportDefinitions[datasetId];
      const totalRows = rowsByDataset[datasetId].length;

      if (totalRows === 0) {
        toast.warning("Não há dados para exportar neste relatório.");
        return;
      }
      if (columnKeys.length === 0) {
        toast.warning("Selecione ao menos uma coluna para exportar.");
        return;
      }

      const XLSX = await import("xlsx");
      const exportRows = buildExportRows(datasetId, columnKeys);
      const worksheet = XLSX.utils.json_to_sheet(exportRows);
      const now = new Date().toISOString().replace(/[:.]/g, "-");
      const baseName = sanitizeFileName(`${definition.name}-${scopeLabel}-${now}`);

      if (format === "xlsx") {
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, definition.name.slice(0, 30));
        XLSX.writeFile(workbook, `${baseName}.xlsx`);
      } else {
        const csv = XLSX.utils.sheet_to_csv(worksheet);
        const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8;" });
        triggerBlobDownload(blob, `${baseName}.csv`);
      }

      toast.success(`Relatório ${definition.name} exportado com sucesso.`);
    },
    [buildExportRows, rowsByDataset],
  );

  const handleSaveCurrentReport = useCallback(async () => {
    if (!user?.id) {
      toast.error("Voce precisa estar autenticado para salvar relatórios.");
      return;
    }

    const name = savedReportName.trim();
    if (!name) {
      toast.error("Informe um nome para salvar o relatório.");
      return;
    }

    const sanitizedColumns = sanitizeColumnKeysForDataset(customDatasetId, selectedColumns);
    if (sanitizedColumns.length === 0) {
      toast.error("Selecione ao menos uma coluna para salvar.");
      return;
    }

    const now = new Date().toISOString();
    const normalizedName = normalizeText(name);
    const existing = savedReports.find(
      (report) => report.datasetId === customDatasetId && normalizeText(report.name) === normalizedName,
    );
    const isEditing = Boolean(editingSavedReportId);
    const editingTarget = isEditing ? savedReports.find((report) => report.id === editingSavedReportId) : null;

    const payload = {
      user_id: user.id,
      name,
      dataset_id: customDatasetId,
      column_keys: sanitizedColumns,
      format: savedReportFormat,
      auto_generate: savedReportAutoGenerate,
      updated_at: now,
    };

    const query = isEditing
      ? supabase.from("saved_reports").update(payload).eq("id", editingSavedReportId).eq("user_id", user.id)
      : supabase.from("saved_reports").upsert(payload, { onConflict: "user_id,name,dataset_id" });

    const { data, error } = await query
      .select("id, name, dataset_id, column_keys, format, auto_generate, created_at, updated_at")
      .single();

    if (error) {
      if (error.code === "23505") {
        toast.error("Ja existe um relatório salvo com este nome nesta categoria.");
        return;
      }
      toast.error(`Falha ao salvar relatório: ${error.message}`);
      return;
    }

    const mapped = mapSavedReportRow(data as SavedReportRow);
    if (!mapped) {
      await loadSavedReports();
      toast.success(isEditing ? "Relatório atualizado com sucesso." : existing ? "Relatório salvo atualizado." : "Relatório salvo com sucesso.");
      return;
    }

    if (savedReportAutoGenerate) {
      autoGeneratedReportIdsRef.current.add(mapped.id);
    } else {
      autoGeneratedReportIdsRef.current.delete(mapped.id);
    }

    setSavedReports((current) => {
      const filtered = current.filter((report) => report.id !== mapped.id);
      return [mapped, ...filtered].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    });

    setEditingSavedReportId(mapped.id);
    if (isEditing && editingTarget?.id && editingTarget.id !== mapped.id) {
      autoGeneratedReportIdsRef.current.delete(editingTarget.id);
    }
    toast.success(isEditing ? "Relatório atualizado com sucesso." : existing ? "Relatório salvo atualizado." : "Relatório salvo com sucesso.");
  }, [
    customDatasetId,
    editingSavedReportId,
    loadSavedReports,
    savedReportAutoGenerate,
    savedReportFormat,
    savedReportName,
    savedReports,
    selectedColumns,
    user?.id,
  ]);

  const handleLoadSavedReport = (report: SavedReportConfig) => {
    setEditingSavedReportId(null);
    skipDatasetResetRef.current = true;
    setCustomDatasetId(report.datasetId);
    setSelectedColumns(report.columnKeys);
    setSavedReportName(report.name);
    setSavedReportFormat(report.format);
    setSavedReportAutoGenerate(report.autoGenerate);
    setLeftSelectedKeys([]);
    setRightSelectedKeys([]);
    toast.success("Configuração do relatório carregada.");
  };

  const handleStartEditingSavedReport = (report: SavedReportConfig) => {
    skipDatasetResetRef.current = true;
    setCustomDatasetId(report.datasetId);
    setSelectedColumns(report.columnKeys);
    setSavedReportName(report.name);
    setSavedReportFormat(report.format);
    setSavedReportAutoGenerate(report.autoGenerate);
    setLeftSelectedKeys([]);
    setRightSelectedKeys([]);
    setEditingSavedReportId(report.id);
    toast.success("Relatório carregado em modo de edicao.");
  };

  const handleCancelEditingSavedReport = () => {
    setEditingSavedReportId(null);
    setSavedReportName("");
    setSavedReportFormat("xlsx");
    setSavedReportAutoGenerate(false);
    toast.success("Edicao de relatório cancelada.");
  };

  const handleDeleteSavedReport = useCallback(async (reportId: string, reportName: string) => {
    if (!user?.id) {
      toast.error("Voce precisa estar autenticado para excluir relatórios salvos.");
      return;
    }

    const shouldDelete = window.confirm(`Excluir o relatório salvo "${reportName}"?`);
    if (!shouldDelete) return;

    const { error } = await supabase
      .from("saved_reports")
      .delete()
      .eq("id", reportId)
      .eq("user_id", user.id);

    if (error) {
      toast.error(`Falha ao remover relatório salvo: ${error.message}`);
      return;
    }

    setSavedReports((current) => current.filter((report) => report.id !== reportId));
    autoGeneratedReportIdsRef.current.delete(reportId);
    if (editingSavedReportId === reportId) {
      setEditingSavedReportId(null);
      setSavedReportName("");
      setSavedReportFormat("xlsx");
      setSavedReportAutoGenerate(false);
    }
    toast.success("Relatório salvo removido.");
  }, [editingSavedReportId, user?.id]);

  const handleRunSavedReport = useCallback(
    async (report: SavedReportConfig, scope: "manual" | "automático" = "manual") => {
      await handleExport(
        report.datasetId,
        report.columnKeys,
        report.format,
        `salvo-${scope}-${sanitizeFileName(report.name)}`,
      );
    },
    [handleExport],
  );

  useEffect(() => {
    if (loading || loadingSavedReports || savedReports.length === 0) return;
    const pendingAutoReports = savedReports.filter(
      (report) => report.autoGenerate && !autoGeneratedReportIdsRef.current.has(report.id),
    );
    if (pendingAutoReports.length === 0) return;

    let cancelled = false;
    const runAutoReports = async () => {
      for (const report of pendingAutoReports) {
        if (cancelled) return;
        autoGeneratedReportIdsRef.current.add(report.id);
        await handleRunSavedReport(report, "automático");
      }
    };

    void runAutoReports();
    return () => {
      cancelled = true;
    };
  }, [handleRunSavedReport, loading, loadingSavedReports, savedReports]);

  const customRows = rowsByDataset[customDatasetId];
  const customPreviewRows = customRows.slice(0, 10);

  return (
    <AppLayout>
      <div className="space-y-6 max-w-7xl">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="font-heading text-2xl font-bold">Relatórios</h1>
            <p className="text-sm text-muted-foreground">
              Relatórios automaticos com dados do banco e construtor personalizado.
            </p>
            {lastUpdatedAt && (
              <p className="text-xs text-muted-foreground mt-1">Atualizado em {formatDateTime(lastUpdatedAt)}</p>
            )}
          </div>
          <Button variant="outline" className="gap-2 w-fit" onClick={() => void loadReportData()} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Atualizar dados
          </Button>
        </div>

        {activeFilterBadges.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {activeFilterBadges.map((badge) => (
              <Badge key={badge} variant="secondary">
                <FilterBadgeLabel text={badge} />
              </Badge>
            ))}
          </div>
        )}

        <Tabs defaultValue="automaticos" className="space-y-4">
          <TabsList>
            <TabsTrigger value="automaticos">Relatórios automaticos</TabsTrigger>
            <TabsTrigger value="personalizado">Gerar relatório personalizado</TabsTrigger>
          </TabsList>

          <TabsContent value="automaticos" className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {automaticCards.map((card, index) => {
                const definition = reportDefinitions[card.datasetId];
                const Icon = definition.icon;

                return (
                  <motion.div
                    key={card.datasetId}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="rounded-xl border bg-card p-5 space-y-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className={`h-10 w-10 rounded-lg ${definition.colorClass} flex items-center justify-center`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <Badge variant="outline">{card.count} registros</Badge>
                    </div>

                    <div>
                      <h3 className="font-medium">{definition.name}</h3>
                      <p className="text-xs text-muted-foreground mt-1">{definition.description}</p>
                    </div>

                    <div className="space-y-1.5">
                      {card.stats.map((stat) => (
                        <div key={`${card.datasetId}-${stat.label}`} className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">{stat.label}</span>
                          <span className="font-medium">{stat.value}</span>
                        </div>
                      ))}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-2"
                        onClick={() =>
                          void handleExport(
                            card.datasetId,
                            reportDefinitions[card.datasetId].defaultColumns,
                            "csv",
                            "automático",
                          )
                        }
                      >
                        <Download className="h-4 w-4" />
                        CSV
                      </Button>
                      <Button
                        size="sm"
                        className="gap-2"
                        onClick={() =>
                          void handleExport(
                            card.datasetId,
                            reportDefinitions[card.datasetId].defaultColumns,
                            "xlsx",
                            "automático",
                          )
                        }
                      >
                        <FileSpreadsheet className="h-4 w-4" />
                        XLSX
                      </Button>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            <div className="rounded-xl border bg-card">
              <div className="p-4 border-b flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-heading font-semibold">Resumo rapido</h2>
                <span className="text-xs text-muted-foreground">
                  Totais carregados:{" "}
                  {Object.values(rowsByDataset)
                    .reduce((sum, rows) => sum + rows.length, 0)
                    .toLocaleString("pt-BR")}{" "}
                  registros
                </span>
              </div>
              <div className="p-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5 text-sm">
                {Object.values(reportDefinitions).map((definition) => (
                  <div key={definition.id} className="rounded-lg border p-3">
                    <p className="font-medium">{definition.name}</p>
                    <p className="text-2xl font-bold mt-1">{rowsByDataset[definition.id].length}</p>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="personalizado" className="space-y-4">
            <div className="rounded-xl border bg-card p-4 space-y-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="font-heading font-semibold">Gerar relatório</h2>
                  <p className="text-xs text-muted-foreground">
                    Escolha o modulo, selecione as colunas e exporte seu modelo customizado.
                  </p>
                </div>
                <div className="w-full lg:w-[280px]">
                  <Select value={customDatasetId} onValueChange={(value) => setCustomDatasetId(value as ReportDatasetId)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a categoria" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.values(reportDefinitions).map((definition) => (
                        <SelectItem key={definition.id} value={definition.id}>
                          {definition.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="rounded-lg border p-3 space-y-3">
                <p className="text-sm font-medium">Salvar relatório para gerar depois</p>
                {editingSavedReportId && (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-primary/30 bg-primary/5 px-2.5 py-2 text-xs">
                    <span className="text-primary font-medium">Modo edicao ativo para relatório salvo.</span>
                    <Button type="button" size="sm" variant="ghost" className="h-7" onClick={handleCancelEditingSavedReport}>
                      Cancelar edicao
                    </Button>
                  </div>
                )}
                <div className="grid gap-3 lg:grid-cols-[1fr_200px_auto]">
                  <Input
                    placeholder="Nome do relatório salvo"
                    value={savedReportName}
                    onChange={(event) => setSavedReportName(event.target.value)}
                  />
                  <Select value={savedReportFormat} onValueChange={(value) => setSavedReportFormat(value as ExportFormat)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="xlsx">XLSX</SelectItem>
                      <SelectItem value="csv">CSV</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button type="button" className="gap-2" onClick={() => void handleSaveCurrentReport()}>
                    <Save className="h-4 w-4" />
                    {editingSavedReportId ? "Atualizar relatório" : "Salvar relatório"}
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={savedReportAutoGenerate} onCheckedChange={setSavedReportAutoGenerate} />
                  <p className="text-sm text-muted-foreground">
                    Gerar automaticamente ao abrir esta pagina na proxima vez.
                  </p>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-[1fr_auto_1fr]">
                <div className="rounded-lg border p-3">
                  <p className="text-sm font-medium">Colunas disponíveis</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {availableColumns.length} campo(s) disponível(is)
                  </p>
                  <div className="mt-3 max-h-72 overflow-auto space-y-2 pr-1">
                    {availableColumns.length === 0 && (
                      <p className="text-sm text-muted-foreground py-6 text-center">Sem colunas para adicionar.</p>
                    )}
                    {availableColumnsByModule.map((moduleEntry) => (
                      <div key={moduleEntry.id} className="rounded-md border bg-muted/20 p-2 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                            {moduleEntry.label}
                          </p>
                          <Badge variant="outline" className="h-5 text-[10px]">
                            {moduleEntry.totalColumns}
                          </Badge>
                        </div>
                        <div className="space-y-2">
                          {moduleEntry.subfolders.map((subfolder) => (
                            <div key={`${moduleEntry.id}-${subfolder.id}`} className="rounded-md border bg-background p-2 space-y-1">
                              <p className="text-[11px] font-medium text-muted-foreground">{subfolder.label}</p>
                              {subfolder.columns.map((column) => {
                                const selected = leftSelectedKeys.includes(column.key);
                                return (
                                  <button
                                    key={column.key}
                                    type="button"
                                    onClick={() => toggleLeftSelection(column.key)}
                                    className={`w-full text-left text-sm rounded-md px-2.5 py-2 border transition-colors ${
                                      selected ? "bg-primary/10 border-primary text-primary" : "hover:bg-muted/40"
                                    }`}
                                  >
                                    {column.label}
                                  </button>
                                );
                              })}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex flex-row lg:flex-col items-center justify-center gap-2">
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    onClick={handleAddColumns}
                    disabled={leftSelectedKeys.length === 0}
                    aria-label="Adicionar colunas"
                  >
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    onClick={handleRemoveColumns}
                    disabled={rightSelectedKeys.length === 0}
                    aria-label="Remover colunas"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                </div>

                <div className="rounded-lg border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium">Colunas selecionadas</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {selectedColumnDefinitions.length} campo(s) no relatório
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => handleMoveSelectedColumn("up")}
                        disabled={!canMoveSelectedColumn || selectedColumnIndex <= 0}
                        aria-label="Mover coluna para cima"
                      >
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => handleMoveSelectedColumn("down")}
                        disabled={!canMoveSelectedColumn || selectedColumnIndex < 0 || selectedColumnIndex >= selectedColumns.length - 1}
                        aria-label="Mover coluna para baixo"
                      >
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="mt-3 max-h-72 overflow-auto space-y-1">
                    {selectedColumnDefinitions.length === 0 && (
                      <p className="text-sm text-muted-foreground py-6 text-center">Adicione colunas para montar o relatório.</p>
                    )}
                    {selectedColumnDefinitions.map((column) => {
                      const selected = rightSelectedKeys.includes(column.key);
                      return (
                        <button
                          key={column.key}
                          type="button"
                          onClick={() => toggleRightSelection(column.key)}
                          className={`w-full text-left text-sm rounded-md px-2.5 py-2 border transition-colors ${
                            selected ? "bg-primary/10 border-primary text-primary" : "hover:bg-muted/40"
                          }`}
                        >
                          {column.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setSelectedColumns(reportDefinitions[customDatasetId].defaultColumns)}
                >
                  Usar colunas padrão
                </Button>
                <Button type="button" variant="outline" onClick={() => setSelectedColumns([])}>
                  Limpar seleção
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="gap-2"
                  onClick={() => void handleExport(customDatasetId, selectedColumns, "csv", "personalizado")}
                >
                  <Download className="h-4 w-4" />
                  Exportar CSV
                </Button>
                <Button
                  type="button"
                  className="gap-2"
                  onClick={() => void handleExport(customDatasetId, selectedColumns, "xlsx", "personalizado")}
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  Exportar XLSX
                </Button>
              </div>

              <div className="rounded-lg border p-3 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">Relatórios salvos</p>
                  <Badge variant="outline">{savedReports.length}</Badge>
                </div>
                {loadingSavedReports ? (
                  <p className="text-sm text-muted-foreground">Carregando relatórios salvos...</p>
                ) : savedReports.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Nenhum relatório salvo ainda. Monte o relatório e clique em salvar.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-72 overflow-auto pr-1">
                    {savedReports.map((report) => {
                      const definition = reportDefinitions[report.datasetId];
                      return (
                        <div key={report.id} className="rounded-md border p-2.5">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <p className="text-sm font-medium">{report.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {definition.name} · {report.columnKeys.length} colunas · {report.format.toUpperCase()}
                              </p>
                            </div>
                            <div className="flex items-center gap-1">
                              {report.autoGenerate && <Badge variant="secondary">Auto</Badge>}
                              <Badge variant="outline">{formatDateTime(report.updatedAt)}</Badge>
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 mt-2">
                            <Button type="button" size="sm" variant="outline" onClick={() => handleLoadSavedReport(report)}>
                              Carregar
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="gap-1.5"
                              onClick={() => handleStartEditingSavedReport(report)}
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                              Editar
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="gap-1.5"
                              onClick={() => void handleRunSavedReport(report)}
                            >
                              <PlayCircle className="h-3.5 w-3.5" />
                              Gerar
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="gap-1.5 text-destructive hover:text-destructive"
                              onClick={() => void handleDeleteSavedReport(report.id, report.name)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Excluir
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-xl border bg-card">
              <div className="p-4 border-b flex items-center justify-between gap-3">
                <div>
                  <h3 className="font-heading font-semibold">Preview do relatório</h3>
                  <p className="text-xs text-muted-foreground">
                    Mostrando ate 10 linhas de {customRows.length} registro(s) da base.
                  </p>
                </div>
                <Badge variant="outline">{reportDefinitions[customDatasetId].name}</Badge>
              </div>

              {selectedColumnDefinitions.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  Selecione colunas para exibir o preview do relatório.
                </div>
              ) : customRows.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  Nenhum dado encontrado para os filtros atuais.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b bg-muted/30">
                        {selectedColumnDefinitions.map((column) => (
                          <th key={column.key} className="text-left text-xs font-semibold text-muted-foreground p-3 whitespace-nowrap">
                            {column.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {customPreviewRows.map((row, rowIndex) => {
                        const rowKey = String(row.id || `${customDatasetId}-${rowIndex}`);
                        return (
                          <tr key={rowKey} className="hover:bg-muted/20 transition-colors">
                            {selectedColumnDefinitions.map((column) => {
                              const value = formatCellValue(row[column.key], column.formatter);
                              return (
                                <td key={`${rowKey}-${column.key}`} className="p-3 text-sm whitespace-nowrap">
                                  {value || "-"}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

function FilterBadgeLabel({ text }: { text: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <BarChart3 className="h-3.5 w-3.5" />
      {text}
    </span>
  );
}
