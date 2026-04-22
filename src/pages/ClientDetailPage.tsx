import { useCallback, useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/app/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ArrowLeft, Building2, Save, Upload, FileText, Trash2, Download,
  Loader2, Plus, Calculator, Receipt, Users, FolderOpen, CalendarDays, ClipboardList, Copy, type LucideIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/useAuth";
import { getClientSegmentOptions } from "@/lib/clientSegments";
import { completeLinkedRequestAndFormSubmissions } from "@/lib/requestStatusCascade";
import { sectorOptions } from "@/components/portal/types";
import { toast } from "sonner";
import { motion } from "framer-motion";

interface ClientRecord {
  id: string;
  name: string;
  cnpj: string | null;
  regime: string | null;
  sector: string | null;
  status: string | null;
  contact: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  portal_user_id: string | null;
  portal_cashflow_enabled: boolean;
}

type ClientDataRow = Database["public"]["Tables"]["client_data"]["Row"];
type ClientPortalTaskRow = Database["public"]["Tables"]["client_portal_tasks"]["Row"];
type PortalTaskStatus = "pending_client" | "in_analysis" | "completed" | "cancelled";
type PortalTaskType = "document" | "request_return" | "analysis" | "deliverable" | "general";
type DataMode = "monthly" | "cadastral";

type ClientAcessoriasObligation = {
  id: string;
  obligation_name: string;
  obligation_period: string | null;
  due_date: string | null;
  delivered_at: string | null;
  status: string | null;
  protocol: string | null;
  notes: string | null;
  last_synced_at: string | null;
};

interface ClientFile {
  id: string;
  file_name: string;
  file_path: string;
  file_size: number | null;
  category: string;
  created_at: string;
}

interface ClientDataField {
  name: string;
  label: string;
}
interface ClientCategoryConfig {
  fields: ClientDataField[];
  icon: LucideIcon;
  label: string;
  color: string;
  mode: DataMode;
  description: string;
  allowFiles?: boolean;
}
const monthlyCategoryKeys = ["contabilidade", "fiscal", "dp"] as const;
type MonthlyCategoryKey = (typeof monthlyCategoryKeys)[number];
const cadastralCategoryKeys = [
  "cadastro_clientes",
  "cadastro_fiscal",
  "cadastro_departamento_pessoal",
  "cadastro_contabil",
  "cadastro_obrigacoes",
  "cadastro_honorarios",
  "cadastro_documentos",
] as const;
type CadastralCategoryKey = (typeof cadastralCategoryKeys)[number];
const cadastralCategoryTabKeys = [
  "cadastro_clientes",
  "cadastro_fiscal",
  "cadastro_departamento_pessoal",
  "cadastro_contabil",
  "cadastro_honorarios",
  "cadastro_documentos",
] as const;
type ClientCategoryKey = MonthlyCategoryKey | CadastralCategoryKey;
const contabilidadeFields = [
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
];
const fiscalFields = [
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
];
const dpFields = [
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
];
const cadastroClientesFields = [
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
];
const cadastroFiscalFields = [
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
];
const cadastroDpFields = [
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
];
const cadastroDpDependentYesFieldNames = [
  "possui_fgts",
  "possui_adiantamento_salarial",
  "envia_relatorio_ferias",
  "possui_decimo_terceiro",
] as const;

const cadastroDpSindicatoFields = [
  { name: "sindicato_nome", label: "Nome do Sindicato" },
  { name: "sindicato_cnpj", label: "CNPJ do Sindicato" },
  { name: "sindicato_codigo_registro", label: "Codigo/Registro do Sindicato" },
  { name: "sindicato_contato", label: "Contato do Sindicato" },
  { name: "sindicato_telefone_whatsapp", label: "Telefone/WhatsApp do Sindicato" },
  { name: "sindicato_observacoes", label: "Observacoes do Sindicato" },
];
const cadastroDpSindicatoFieldNames = new Set(cadastroDpSindicatoFields.map((field) => field.name));
const cadastroContábilFields = [
  { name: "obrigacao_contabil", label: "Obrigação Contábil" },
  { name: "envia_extratos_bancarios", label: "Envia Extratos Bancários" },
  { name: "envia_notas_fiscais", label: "Envia Notas Fiscais" },
  { name: "controle_financeiro", label: "Controle Financeiro" },
  { name: "sistema_financeiro", label: "Sistema Financeiro" },
  { name: "integracao_contabil", label: "Integração Contábil" },
  { name: "balanco_anual", label: "Balanco Anual" },
  { name: "responsavel_contabil_grow", label: "Responsavel Contábil Grow" },
  { name: "periodicidade_relatorios", label: "Periodicidade Relatórios" },
  { name: "observacoes_contabeis", label: "Observacoes Contabeis" },
];
const cadastroObrigacoesFields = [
  { name: "pgdas", label: "PGDAS" },
  { name: "gia", label: "GIA" },
  { name: "sped_fiscal", label: "SPED Fiscal" },
  { name: "efd_contribuicoes", label: "EFD Contribuicoes" },
  { name: "dctf", label: "DCTF" },
  { name: "defis", label: "DEFIS" },
  { name: "ecd", label: "ECD" },
  { name: "ecf", label: "ECF" },
];
const cadastroHonoráriosFields = [
  { name: "plano", label: "Plano" },
  { name: "valor_mensal", label: "Valor Mensal (R$)" },
  { name: "forma_pagamento", label: "Forma de Pagamento" },
  { name: "vencimento", label: "Vencimento" },
  { name: "situacao", label: "Situação" },
];
const cadastroDocumentosFields = [
  { name: "contrato", label: "Contrato" },
  { name: "procuracao", label: "Procuração" },
  { name: "certificado_digital", label: "Certificado Digital" },
  { name: "contrato_social", label: "Contrato Social" },
  { name: "alteracoes_contratuais", label: "Alterações Contratuais" },
  { name: "outros_documentos", label: "Outros Documentos" },
];
const categoryConfig: Record<ClientCategoryKey, ClientCategoryConfig> = {
  contabilidade: {
    fields: contabilidadeFields,
    icon: Calculator,
    label: "Contábilidade",
    color: "text-primary",
    mode: "monthly",
    description: "Indicadores mensais para relatório gerencial financeiro e contábil.",
    allowFiles: true,
  },
  fiscal: {
    fields: fiscalFields,
    icon: Receipt,
    label: "Fiscal",
    color: "text-amber-600",
    mode: "monthly",
    description: "Indicadores mensais da area fiscal para análise gerencial.",
    allowFiles: true,
  },
  dp: {
    fields: dpFields,
    icon: Users,
    label: "Dept. Pessoal",
    color: "text-emerald-600",
    mode: "monthly",
    description: "Indicadores mensais de Departamento Pessoal para acompanhamento.",
    allowFiles: true,
  },
  cadastro_clientes: {
    fields: cadastroClientesFields,
    icon: Building2,
    label: "Cadastro Clientes",
    color: "text-primary",
    mode: "cadastral",
    description: "Campos da aba Cadastro_Clientes da planilha (Razao Social e CNPJ ficam em Dados Gerais).",
  },
  cadastro_fiscal: {
    fields: cadastroFiscalFields,
    icon: Receipt,
    label: "Setor Fiscal",
    color: "text-amber-600",
    mode: "cadastral",
    description: "Informações cadastrais do setor Fiscal conforme planilha.",
  },
  cadastro_departamento_pessoal: {
    fields: [...cadastroDpFields, ...cadastroDpSindicatoFields],
    icon: Users,
    label: "Setor DP",
    color: "text-emerald-600",
    mode: "cadastral",
    description: "Informações cadastrais do setor Departamento Pessoal conforme planilha.",
  },
  cadastro_contabil: {
    fields: cadastroContábilFields,
    icon: Calculator,
    label: "Setor Contábil",
    color: "text-primary",
    mode: "cadastral",
    description: "Informações cadastrais do setor Contábil conforme planilha.",
  },
  cadastro_obrigacoes: {
    fields: cadastroObrigacoesFields,
    icon: ClipboardList,
    label: "Obrigações",
    color: "text-violet-600",
    mode: "cadastral",
    description: "Obrigações acessorias cadastradas por cliente conforme planilha.",
  },
  cadastro_honorarios: {
    fields: cadastroHonoráriosFields,
    icon: FileText,
    label: "Honorários",
    color: "text-cyan-700",
    mode: "cadastral",
    description: "Dados cadastrais de plano e cobranca de honorarios conforme planilha.",
  },
  cadastro_documentos: {
    fields: cadastroDocumentosFields,
    icon: FolderOpen,
    label: "Documentos",
    color: "text-muted-foreground",
    mode: "cadastral",
    description: "Checklist cadastral de documentos conforme planilha.",
    allowFiles: true,
  },
};

type FieldValidationType = "yesNo" | "number" | "integer" | "percent" | "date" | "state" | "phone" | "cep";

interface FieldValidationRule {
  type: FieldValidationType;
  min?: number;
  max?: number;
}

const yesNoRule: FieldValidationRule = { type: "yesNo" };
const currencyRule: FieldValidationRule = { type: "number", min: 0 };

const fieldValidationRules: Record<ClientCategoryKey, Partial<Record<string, FieldValidationRule>>> = {
  contabilidade: {
    faturamento_mensal: currencyRule,
    despesas_operacionais: currencyRule,
    lucro_liquido: currencyRule,
    ativo_total: currencyRule,
    passivo_total: currencyRule,
    patrimonio_liquido: currencyRule,
    capital_social: currencyRule,
    contas_a_receber: currencyRule,
    contas_a_pagar: currencyRule,
    estoque: currencyRule,
  },
  fiscal: {
    aliquota_irpj: { type: "percent", min: 0, max: 100 },
    aliquota_csll: { type: "percent", min: 0, max: 100 },
    aliquota_pis: { type: "percent", min: 0, max: 100 },
    aliquota_cofins: { type: "percent", min: 0, max: 100 },
    aliquota_iss: { type: "percent", min: 0, max: 100 },
    aliquota_icms: { type: "percent", min: 0, max: 100 },
    nfe_emitidas: { type: "integer", min: 0 },
    valor_total_nfe: currencyRule,
  },
  dp: {
    total_funcionarios: { type: "integer", min: 0 },
    folha_pagamento: currencyRule,
    encargos_sociais: currencyRule,
    fgts_mensal: currencyRule,
    inss_patronal: currencyRule,
    vale_transporte: currencyRule,
    vale_alimentacao: currencyRule,
    admissões_periodo: { type: "integer", min: 0 },
    demissoes_periodo: { type: "integer", min: 0 },
    sindical_contribuicao: currencyRule,
  },
  cadastro_clientes: {
    codigo: { type: "integer", min: 0 },
    data_abertura: { type: "date" },
    cep: { type: "cep" },
    estado: { type: "state" },
    inscricao_estadual_uf: { type: "state" },
    inscricao_estadual_data: { type: "date" },
    inscricao_municipal_data: { type: "date" },
    ddd: { type: "integer", min: 0, max: 999 },
    telefone: { type: "phone" },
    whatsapp: { type: "phone" },
    empresa_ativa: yesNoRule,
    empresa_isenta: yesNoRule,
  },
  cadastro_fiscal: {
    contribuinte_icms: yesNoRule,
    contribuinte_ipi: yesNoRule,
    emite_nfe: yesNoRule,
    emite_nfse: yesNoRule,
    possui_st: yesNoRule,
    controle_estoque: yesNoRule,
    integracao_contabil: yesNoRule,
    entrega_gia: yesNoRule,
    entrega_sped_fiscal: yesNoRule,
  },
  cadastro_departamento_pessoal: {
    possui_pro_labore: yesNoRule,
    possui_funcionarios: yesNoRule,
    possui_variaveis: yesNoRule,
    possui_inss: yesNoRule,
    possui_fgts: yesNoRule,
    possui_adiantamento_salarial: yesNoRule,
    envia_folha_ponto: yesNoRule,
    hora_extra_banco_horas: yesNoRule,
    envia_relatorio_ferias: yesNoRule,
    possui_decimo_terceiro: yesNoRule,
    sindicato_telefone_whatsapp: { type: "phone" },
  },
  cadastro_contabil: {
    envia_extratos_bancarios: yesNoRule,
    envia_notas_fiscais: yesNoRule,
    controle_financeiro: yesNoRule,
    integracao_contabil: yesNoRule,
    balanco_anual: yesNoRule,
  },
  cadastro_obrigacoes: {
    pgdas: yesNoRule,
    gia: yesNoRule,
    sped_fiscal: yesNoRule,
    efd_contribuicoes: yesNoRule,
    dctf: yesNoRule,
    defis: yesNoRule,
    ecd: yesNoRule,
    ecf: yesNoRule,
  },
  cadastro_honorarios: {
    valor_mensal: currencyRule,
    vencimento: { type: "integer", min: 1, max: 31 },
  },
  cadastro_documentos: {
    contrato: yesNoRule,
    procuracao: yesNoRule,
    certificado_digital: yesNoRule,
    contrato_social: yesNoRule,
    alteracoes_contratuais: yesNoRule,
    outros_documentos: yesNoRule,
  },
};

const normalizeYesNoValue = (value: string) => {
  const normalized = value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (!normalized) return "";
  if (["sim", "s", "yes", "true", "1"].includes(normalized)) return "sim";
  if (["nao", "n", "no", "false", "0"].includes(normalized)) return "nao";
  return normalized;
};

const parseNumericValue = (value: string) => {
  const cleaned = value.replace(/\s+/g, "").replace(/r\$/gi, "");
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

const formatCepValue = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
};

type ViaCepResponse = {
  erro?: boolean;
  cep?: string;
  logradouro?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
};

type BrasilApiCepResponse = {
  cep?: string;
  street?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
};

type CepLookupAddress = {
  cep: string;
  street: string;
  neighborhood: string;
  city: string;
  state: string;
};

const CEP_LOOKUP_TIMEOUT_MS = 8000;

const fetchJsonWithTimeout = async <T,>(url: string, timeoutMs = CEP_LOOKUP_TIMEOUT_MS) => {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      return { ok: false as const, status: response.status, data: null as T | null };
    }

    const data = await response.json() as T;
    return { ok: true as const, status: response.status, data };
  } finally {
    window.clearTimeout(timeout);
  }
};

const sanitizeAddressToken = (value: string | undefined) => (value || "").trim();

const parseViaCepAddress = (data: ViaCepResponse, fallbackCep: string): CepLookupAddress | null => {
  if (data.erro) return null;

  return {
    cep: (data.cep || fallbackCep).replace(/\D/g, "").slice(0, 8),
    street: sanitizeAddressToken(data.logradouro),
    neighborhood: sanitizeAddressToken(data.bairro),
    city: sanitizeAddressToken(data.localidade),
    state: sanitizeAddressToken(data.uf).toUpperCase().slice(0, 2),
  };
};

const parseBrasilApiAddress = (data: BrasilApiCepResponse, fallbackCep: string): CepLookupAddress => ({
  cep: (data.cep || fallbackCep).replace(/\D/g, "").slice(0, 8),
  street: sanitizeAddressToken(data.street),
  neighborhood: sanitizeAddressToken(data.neighborhood),
  city: sanitizeAddressToken(data.city),
  state: sanitizeAddressToken(data.state).toUpperCase().slice(0, 2),
});

const lookupCepAddress = async (cepDigits: string): Promise<CepLookupAddress> => {
  const attempts: string[] = [];

  try {
    const viaCepResult = await fetchJsonWithTimeout<ViaCepResponse>(`https://viacep.com.br/ws/${cepDigits}/json/`);
    if (viaCepResult.ok && viaCepResult.data) {
      const parsed = parseViaCepAddress(viaCepResult.data, cepDigits);
      if (parsed) return parsed;
      throw new Error("CEP não encontrado.");
    }
    attempts.push(`ViaCEP HTTP ${viaCepResult.status}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "erro desconhecido";
    attempts.push(`ViaCEP ${message}`);
  }

  try {
    const brasilApiResult = await fetchJsonWithTimeout<BrasilApiCepResponse>(`https://brasilapi.com.br/api/cep/v1/${cepDigits}`);
    if (brasilApiResult.ok && brasilApiResult.data) {
      return parseBrasilApiAddress(brasilApiResult.data, cepDigits);
    }
    if (brasilApiResult.status === 404) {
      throw new Error("CEP não encontrado.");
    }
    attempts.push(`BrasilAPI HTTP ${brasilApiResult.status}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "erro desconhecido";
    attempts.push(`BrasilAPI ${message}`);
  }

  throw new Error(
    `Não foi possível consultar o CEP agora. Falhas: ${attempts.join(" | ")}`,
  );
};
const normalizeFieldValueForInput = (rule: FieldValidationRule | undefined, value: string) => {
  if (!rule) return value;

  if (rule.type === "yesNo") return normalizeYesNoValue(value);
  if (rule.type === "state") return value.toUpperCase();
  if (rule.type === "cep") return formatCepValue(value);

  return value;
};

const normalizeFieldValueForSave = (rule: FieldValidationRule | undefined, value: string) => {
  const trimmed = value.trim();
  if (!rule) return trimmed;

  if (rule.type === "yesNo") return normalizeYesNoValue(trimmed);
  if (rule.type === "state") return trimmed.toUpperCase();
  if (rule.type === "cep") return formatCepValue(trimmed);
  return trimmed;
};

const validateFieldValue = (rule: FieldValidationRule | undefined, value: string) => {
  const normalizedValue = value.trim();
  if (!rule || !normalizedValue) return null;

  if (rule.type === "yesNo") {
    const normalized = normalizeYesNoValue(normalizedValue);
    if (normalized !== "sim" && normalized !== "nao") {
      return "Use apenas Sim ou Não.";
    }
    return null;
  }

  if (rule.type === "date") {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(normalizedValue)) return "Informe uma data valida (AAAA-MM-DD).";
    const parsed = new Date(`${normalizedValue}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return "Informe uma data valida.";
    return null;
  }

  if (rule.type === "state") {
    const stateRegex = /^[A-Za-z]{2}$/;
    if (!stateRegex.test(normalizedValue)) return "Use a UF com 2 letras (ex.: RS).";
    return null;
  }

  if (rule.type === "phone") {
    const digits = normalizedValue.replace(/\D/g, "");
    if (digits.length < 8 || digits.length > 13) return "Telefone invalido.";
    return null;
  }

  if (rule.type === "cep") {
    const digits = normalizedValue.replace(/\D/g, "");
    if (digits.length !== 8) return "Informe um CEP valido com 8 digitos.";
    return null;
  }

  if (rule.type === "number" || rule.type === "integer" || rule.type === "percent") {
    const numeric = parseNumericValue(normalizedValue);
    if (numeric === null) return "Informe um número valido.";
    if (rule.type === "integer" && !Number.isInteger(numeric)) return "Informe um número inteiro.";
    if (typeof rule.min === "number" && numeric < rule.min) return `Valor mínimo: ${rule.min}.`;
    if (typeof rule.max === "number" && numeric > rule.max) return `Valor máximo: ${rule.max}.`;
    return null;
  }

  return null;
};

const generalInfoCadastralFields = [
  "cep",
  "endereço",
  "numero_estabelecimento",
  "bairro",
  "cidade",
  "estado",
  "inscricao_estadual",
  "inscricao_municipal",
  "perfil_atuacao",
] as const;

type GeneralInfoCadastralFieldName = (typeof generalInfoCadastralFields)[number];

const getCategoryFieldEntryKey = (category: ClientCategoryKey, fieldName: string) => `${category}__${fieldName}`;

const clientBusinessProfileOptions = [
  { key: "comercio", label: "Com\u00e9rcio" },
  { key: "industria", label: "Ind\u00fastria" },
  { key: "prestador_servicos", label: "Prestador de Servi\u00e7os" },
] as const;

type ClientBusinessProfileKey = (typeof clientBusinessProfileOptions)[number]["key"];

const normalizeProfileToken = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "_");

const clientBusinessProfileLabelByKey: Record<ClientBusinessProfileKey, string> = {
  comercio: "Com\u00e9rcio",
  industria: "Ind\u00fastria",
  prestador_servicos: "Prestador de Servi\u00e7os",
};

const clientBusinessProfileKeyByToken: Record<string, ClientBusinessProfileKey> = {
  comercio: "comercio",
  "com\u00e9rcio": "comercio",
  "com\u00c3\u00a9rcio": "comercio",
  industria: "industria",
  "ind\u00fastria": "industria",
  "ind\u00c3\u00bastria": "industria",
  prestador_de_servicos: "prestador_servicos",
  prestador_servicos: "prestador_servicos",
  "prestador_de_servico": "prestador_servicos",
  "prestador_servico": "prestador_servicos",
  servicos: "prestador_servicos",
  "servi\u00e7os": "prestador_servicos",
  "servi\u00c3\u00a7os": "prestador_servicos",
};

const parseBusinessProfilesValue = (rawValue: string | undefined) => {
  if (!rawValue?.trim()) return [] as ClientBusinessProfileKey[];

  const tokens = rawValue.split(/[;,|]/g).map((item) => normalizeProfileToken(item)).filter(Boolean);
  const selected = new Set<ClientBusinessProfileKey>();

  tokens.forEach((token) => {
    const mapped = clientBusinessProfileKeyByToken[token];
    if (mapped) selected.add(mapped);
  });

  return clientBusinessProfileOptions
    .map((option) => option.key)
    .filter((key) => selected.has(key));
};

const serializeBusinessProfilesValue = (profiles: ClientBusinessProfileKey[]) =>
  profiles.map((profile) => clientBusinessProfileLabelByKey[profile]).join(", ");

const buildAddressFromCadastralValues = (values: Record<GeneralInfoCadastralFieldName, string>) => {
  const street = values.endereço.trim();
  const number = values.numero_estabelecimento.trim();
  const neighborhood = values.bairro.trim();
  const city = values.cidade.trim();
  const state = values.estado.trim().toUpperCase();
  const cep = values.cep.trim();

  const streetLine = [street, number ? `N ${number}` : ""].filter(Boolean).join(", ");
  const cityState = [city, state].filter(Boolean).join("/");
  const localityLine = [neighborhood, cityState, cep].filter(Boolean).join(" - ");

  return [streetLine, localityLine].filter(Boolean).join(" | ");
};

const cadastroClientesPartnersFieldName = "socios";
const cadastroClientesPartnersEntryKey = getCategoryFieldEntryKey("cadastro_clientes", cadastroClientesPartnersFieldName);

interface ClientPartnerForm {
  id: string;
  name: string;
  ownershipPercent: string;
  proLabore: string;
  govPassword: string;
}

type ClientPartnerField = Exclude<keyof ClientPartnerForm, "id">;

interface StoredClientPartner {
  nome: string;
  percentual_participacao: number;
  pro_labore: number;
  senha_gov: string;
}

const createPartnerId = () => `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const createEmptyPartner = (): ClientPartnerForm => ({
  id: createPartnerId(),
  name: "",
  ownershipPercent: "",
  proLabore: "",
  govPassword: "",
});

const partnerErrorKey = (partnerId: string, field: ClientPartnerField) => `${partnerId}__${field}`;

const parsePartnersEntry = (rawValue: string | undefined): ClientPartnerForm[] => {
  if (!rawValue?.trim()) return [];

  try {
    const parsed = JSON.parse(rawValue) as unknown;
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((item): ClientPartnerForm | null => {
        if (!item || typeof item !== "object" || Array.isArray(item)) return null;

        const row = item as Record<string, unknown>;
        const name = typeof row.nome === "string"
          ? row.nome
          : typeof row.name === "string"
            ? row.name
            : "";
        const ownershipSource = row.percentual_participacao ?? row.percentual ?? row.ownership_percent ?? row.percent;
        const proLaboreSource = row.pro_labore ?? row.prolabore ?? row.pro_labore_mensal;
        const govPassword = typeof row.senha_gov === "string"
          ? row.senha_gov
          : typeof row.gov_password === "string"
            ? row.gov_password
            : "";

        const ownershipPercent = typeof ownershipSource === "number"
          ? String(ownershipSource)
          : typeof ownershipSource === "string"
            ? ownershipSource
            : "";
        const proLabore = typeof proLaboreSource === "number"
          ? String(proLaboreSource)
          : typeof proLaboreSource === "string"
            ? proLaboreSource
            : "";

        return {
          id: createPartnerId(),
          name,
          ownershipPercent,
          proLabore,
          govPassword,
        };
      })
      .filter((partner): partner is ClientPartnerForm => Boolean(partner));
  } catch {
    return [];
  }
};

const validatePartnerFieldValue = (field: ClientPartnerField, value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return "Campo obrigatório.";

  if (field === "ownershipPercent") {
    const numeric = parseNumericValue(trimmed);
    if (numeric === null) return "Informe um percentual válido.";
    if (numeric <= 0 || numeric > 100) return "Informe um percentual entre 0,01 e 100.";
    return null;
  }

  if (field === "proLabore") {
    const numeric = parseNumericValue(trimmed);
    if (numeric === null) return "Informe um valor valido.";
    if (numeric < 0) return "Valor mínimo: 0.";
    return null;
  }

  return null;
};

const validatePartners = (partners: ClientPartnerForm[]) => {
  const errors: Record<string, string> = {};

  partners.forEach((partner) => {
    const fieldsToValidate: ClientPartnerField[] = ["name", "ownershipPercent", "proLabore", "govPassword"];
    fieldsToValidate.forEach((field) => {
      const value = partner[field];
      const error = validatePartnerFieldValue(field, value);
      if (error) errors[partnerErrorKey(partner.id, field)] = error;
    });
  });

  const totalOwnership = partners.reduce((acc, partner) => {
    const numeric = parseNumericValue(partner.ownershipPercent);
    return acc + (numeric ?? 0);
  }, 0);

  if (partners.length > 0 && totalOwnership > 100) {
    errors.__total = "A soma das participacoes dos sócios não pode passar de 100%.";
  }

  return errors;
};

const normalizePartnersForSave = (partners: ClientPartnerForm[]): StoredClientPartner[] => (
  partners.map((partner) => ({
    nome: partner.name.trim(),
    percentual_participacao: parseNumericValue(partner.ownershipPercent) ?? 0,
    pro_labore: parseNumericValue(partner.proLabore) ?? 0,
    senha_gov: partner.govPassword.trim(),
  }))
);

const portalTaskStatusOptions: PortalTaskStatus[] = [
  "pending_client",
  "in_analysis",
  "completed",
  "cancelled",
];

const portalTaskStatusLabel: Record<PortalTaskStatus, string> = {
  pending_client: "Aguardando cliente",
  in_analysis: "Em análise",
  completed: "Concluída",
  cancelled: "Cancelada",
};

const portalTaskStatusClass: Record<PortalTaskStatus, string> = {
  pending_client: "bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300",
  in_analysis: "bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300",
  completed: "bg-primary/10 text-primary",
  cancelled: "bg-muted text-muted-foreground",
};

const portalTaskTypeOptions: PortalTaskType[] = [
  "document",
  "request_return",
  "analysis",
  "deliverable",
  "general",
];

const portalTaskTypeLabel: Record<PortalTaskType, string> = {
  document: "Documento",
  request_return: "Informacao",
  analysis: "Analise",
  deliverable: "Entrega",
  general: "Geral",
};

const normalizeObligationStatusToken = (status: string | null) => {
  const token = String(status || "").trim().toLowerCase();
  if (!token) return "pendente";
  if (["concluído", "completed", "delivered", "sent", "entregue"].includes(token)) return "concluído";
  if (["atrasado", "overdue", "late", "vencido"].includes(token)) return "atrasado";
  if (["em_andamento", "processing", "in_progress", "resolvendo"].includes(token)) return "em_andamento";
  return "pendente";
};

const obligationStatusLabel: Record<string, string> = {
  pendente: "Pendente",
  em_andamento: "Em andamento",
  atrasado: "Atrasado",
  concluído: "Concluído",
  sem_registro: "Sem registro no mes",
};

const obligationStatusClass: Record<string, string> = {
  pendente: "bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300",
  em_andamento: "bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300",
  atrasado: "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-300",
  concluído: "bg-primary/10 text-primary",
  sem_registro: "bg-muted text-muted-foreground",
};

const toMonthKey = (value: string | null | undefined) => {
  if (!value) return null;
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}$/.test(trimmed)) return trimmed;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed.slice(0, 7);
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  return `${parsed.getUTCFullYear()}-${String(parsed.getUTCMonth() + 1).padStart(2, "0")}`;
};

const normalizeEmail = (value: string | null | undefined) => (value || "").trim().toLowerCase();
const isInactiveClientStatus = (status: string | null | undefined) =>
  String(status || "").trim().toLowerCase() === "inativo";

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [client, setClient] = useState<ClientRecord | null>(null);
  const [clientForm, setClientForm] = useState<Partial<ClientRecord>>({});
  const [dataEntries, setDataEntries] = useState<Record<string, string>>({});
  const [dataFieldErrors, setDataFieldErrors] = useState<Record<string, string>>({});
  const [clientPartners, setClientPartners] = useState<ClientPartnerForm[]>([]);
  const [partnerFieldErrors, setPartnerFieldErrors] = useState<Record<string, string>>({});
  const [files, setFiles] = useState<ClientFile[]>([]);
  const [portalTasks, setPortalTasks] = useState<ClientPortalTaskRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingData, setSavingData] = useState<ClientCategoryKey | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadCategory, setUploadCategory] = useState<ClientCategoryKey>("contabilidade");
  const [portalAccessEnabled, setPortalAccessEnabled] = useState(false);
  const [savingPortalAccess, setSavingPortalAccess] = useState(false);
  const [searchingCep, setSearchingCep] = useState(false);
  const [period, setPeriod] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [obligationMonthFilter, setObligationMonthFilter] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [acessoriasObligations, setAcessoriasObligations] = useState<ClientAcessoriasObligation[]>([]);
  const [loadingAcessoriasObligations, setLoadingAcessoriasObligations] = useState(false);
  const [portalTaskDraft, setPortalTaskDraft] = useState({
    title: "",
    description: "",
    type: "document" as PortalTaskType,
    sector: "Geral",
    dueDate: "",
  });
  const [creatingPortalTask, setCreatingPortalTask] = useState(false);
  const [updatingPortalTaskId, setUpdatingPortalTaskId] = useState<string | null>(null);
  const [deletingPortalTaskId, setDeletingPortalTaskId] = useState<string | null>(null);
  const canManageCashflowAccess = role === "admin";
  const clientIsInactive = isInactiveClientStatus(clientForm.status);

  const loadClientData = useCallback(async () => {
    if (!id) return;

    const [monthlyRes, cadastralRes] = await Promise.all([
      supabase
        .from("client_data")
        .select("*")
        .eq("client_id", id)
        .in("category", [...monthlyCategoryKeys])
        .eq("period", period),
      supabase
        .from("client_data")
        .select("*")
        .eq("client_id", id)
        .in("category", [...cadastralCategoryKeys])
        .is("period", null),
    ]);

    if (monthlyRes.error || cadastralRes.error) {
      toast.error("Não foi possível carregar os dados mensais e cadastrais.");
      return;
    }

    const map: Record<string, string> = {};
    [...(monthlyRes.data || []), ...(cadastralRes.data || [])].forEach((dataRow: ClientDataRow) => {
      map[`${dataRow.category}__${dataRow.field_name}`] = dataRow.field_value || "";
    });

    setDataEntries(map);
    setClientPartners(parsePartnersEntry(map[cadastroClientesPartnersEntryKey]));
    setDataFieldErrors({});
    setPartnerFieldErrors({});
  }, [id, period]);

  const loadClientObligations = useCallback(async () => {
    if (!id) return;
    setLoadingAcessoriasObligations(true);

    const { data, error } = await supabase.functions.invoke<{
      obligations?: ClientAcessoriasObligation[];
    }>("acessorias-module", {
      body: {
        action: "list_obligations",
        client_id: id,
      },
    });

    setLoadingAcessoriasObligations(false);

    if (error) {
      toast.error("Não foi possível carregar as obrigações deste cliente.");
      return;
    }

    const rows = Array.isArray(data?.obligations) ? data.obligations : [];
    setAcessoriasObligations(rows);
  }, [id]);

  const loadClient = useCallback(async () => {
    if (!id) return;
    setLoading(true);

    const [clientRes, filesRes, tasksRes] = await Promise.all([
      supabase.from("clients").select("*").eq("id", id).single(),
      supabase.from("client_files").select("*").eq("client_id", id).order("created_at", { ascending: false }),
      supabase.from("client_portal_tasks").select("*").eq("client_id", id).order("created_at", { ascending: false }),
    ]);

    if (clientRes.error || !clientRes.data) {
      toast.error("Cliente não encontrado");
      navigate("/app/clientes");
      return;
    }

    const c = clientRes.data;
    const normalizedClient: ClientRecord = {
      ...(c as ClientRecord),
      email: c.email ? normalizeEmail(c.email) : c.email,
    };
    setClient(normalizedClient);
    setClientForm(normalizedClient);

    setFiles((filesRes.data || []) as ClientFile[]);
    setPortalTasks((tasksRes.data || []) as ClientPortalTaskRow[]);

    if (tasksRes.error) {
      toast.error("Não foi possível carregar as pendências do cliente.");
    }

    if (normalizedClient.portal_user_id) {
      const { data: roleData, error: roleError } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("user_id", normalizedClient.portal_user_id)
        .eq("role", "client")
        .maybeSingle();

      if (roleError) {
        toast.error("Não foi possível validar a permissão atual do portal.");
        setPortalAccessEnabled(false);
      } else {
        setPortalAccessEnabled(Boolean(roleData));
      }
    } else {
      setPortalAccessEnabled(false);
    }

    setLoading(false);
  }, [id, navigate]);

  useEffect(() => {
    if (id) {
      void loadClient();
    }
  }, [id, loadClient]);

  useEffect(() => {
    if (id) {
      void loadClientData();
    }
  }, [id, loadClientData, period]);

  useEffect(() => {
    if (id) {
      void loadClientObligations();
    }
  }, [id, loadClientObligations]);

  const getFieldRule = (category: ClientCategoryKey, fieldName: string) =>
    fieldValidationRules[category]?.[fieldName];

  const handleDataFieldChange = (category: ClientCategoryKey, fieldName: string, value: string) => {
    const key = getCategoryFieldEntryKey(category, fieldName);
    const rule = getFieldRule(category, fieldName);
    const normalizedValue = normalizeFieldValueForInput(rule, value);

    const updates: Array<{ key: string; fieldName: string; value: string }> = [
      { key, fieldName, value: normalizedValue },
    ];

    if (category === "cadastro_departamento_pessoal" && fieldName === "possui_funcionarios" && normalizedValue === "sim") {
      for (const dependentFieldName of cadastroDpDependentYesFieldNames) {
        updates.push({
          key: getCategoryFieldEntryKey(category, dependentFieldName),
          fieldName: dependentFieldName,
          value: "sim",
        });
      }
    }

    setDataEntries((prev) => {
      const next = { ...prev };
      for (const update of updates) {
        next[update.key] = update.value;
      }
      return next;
    });

    setDataFieldErrors((prev) => {
      const next = { ...prev };
      for (const update of updates) {
        const updateRule = getFieldRule(category, update.fieldName);
        const error = validateFieldValue(updateRule, update.value);
        if (error) next[update.key] = error;
        else delete next[update.key];
      }
      return next;
    });
  };

  const getGeneralInfoFieldValue = (fieldName: GeneralInfoCadastralFieldName) =>
    dataEntries[getCategoryFieldEntryKey("cadastro_clientes", fieldName)] || "";

  const setGeneralInfoFieldValue = (fieldName: GeneralInfoCadastralFieldName, value: string) => {
    handleDataFieldChange("cadastro_clientes", fieldName, value);
  };

  const getSelectedBusinessProfiles = () =>
    parseBusinessProfilesValue(getGeneralInfoFieldValue("perfil_atuacao"));

  const toggleBusinessProfile = (profile: ClientBusinessProfileKey) => {
    const selected = getSelectedBusinessProfiles();
    const isSelected = selected.includes(profile);
    const next = isSelected ? selected.filter((item) => item !== profile) : [...selected, profile];
    setGeneralInfoFieldValue("perfil_atuacao", serializeBusinessProfilesValue(next));
  };

  const handleCepLookup = async (rawCep: string) => {
    const cepDigits = rawCep.replace(/\D/g, "");
    if (cepDigits.length !== 8) {
      toast.error("Informe um CEP valido com 8 digitos.");
      return;
    }

    setSearchingCep(true);

    try {
      const address = await lookupCepAddress(cepDigits);

      setGeneralInfoFieldValue("cep", formatCepValue(address.cep || cepDigits));
      setGeneralInfoFieldValue("endereço", address.street);
      setGeneralInfoFieldValue("bairro", address.neighborhood);
      setGeneralInfoFieldValue("cidade", address.city);
      setGeneralInfoFieldValue("estado", address.state);

      toast.success("Endereco preenchido a partir do CEP.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Não foi possível consultar o CEP no momento.";
      toast.error(message);
    } finally {
      setSearchingCep(false);
    }
  };

  const handleCopyRawCnpj = async () => {
    const rawCnpj = (clientForm.cnpj || "").replace(/\D/g, "");
    if (!rawCnpj) {
      toast.error("Informe um CNPJ para copiar.");
      return;
    }

    try {
      await navigator.clipboard.writeText(rawCnpj);
      toast.success("CNPJ copiado sem pontuação.");
      return;
    } catch {
      const fallback = document.createElement("textarea");
      fallback.value = rawCnpj;
      fallback.setAttribute("readonly", "readonly");
      fallback.style.position = "absolute";
      fallback.style.left = "-9999px";
      document.body.appendChild(fallback);
      fallback.select();
      document.execCommand("copy");
      document.body.removeChild(fallback);
      toast.success("CNPJ copiado sem pontuação.");
    }
  };

  const handleAddPartner = () => {
    setClientPartners((prev) => [...prev, createEmptyPartner()]);
  };

  const handlePartnerFieldChange = (partnerId: string, field: ClientPartnerField, value: string) => {
    setClientPartners((prev) => {
      const next = prev.map((partner) => (partner.id === partnerId ? { ...partner, [field]: value } : partner));
      const changedPartner = next.find((partner) => partner.id === partnerId);
      const fieldError = changedPartner ? validatePartnerFieldValue(field, changedPartner[field]) : null;
      const totalOwnership = next.reduce((acc, partner) => {
        const numeric = parseNumericValue(partner.ownershipPercent);
        return acc + (numeric ?? 0);
      }, 0);

      setPartnerFieldErrors((previousErrors) => {
        const nextErrors = { ...previousErrors };
        const key = partnerErrorKey(partnerId, field);
        if (fieldError) nextErrors[key] = fieldError;
        else delete nextErrors[key];

        if (next.length > 0 && totalOwnership > 100) {
          nextErrors.__total = "A soma das participacoes dos sócios não pode passar de 100%.";
        } else {
          delete nextErrors.__total;
        }

        return nextErrors;
      });

      return next;
    });
  };

  const handleRemovePartner = (partnerId: string) => {
    setClientPartners((prev) => {
      const next = prev.filter((partner) => partner.id !== partnerId);
      const totalOwnership = next.reduce((acc, partner) => {
        const numeric = parseNumericValue(partner.ownershipPercent);
        return acc + (numeric ?? 0);
      }, 0);

      setPartnerFieldErrors((previousErrors) => {
        const nextErrors = { ...previousErrors };
        Object.keys(nextErrors).forEach((errorKey) => {
          if (errorKey.startsWith(`${partnerId}__`)) {
            delete nextErrors[errorKey];
          }
        });

        if (next.length > 0 && totalOwnership > 100) {
          nextErrors.__total = "A soma das participacoes dos sócios não pode passar de 100%.";
        } else {
          delete nextErrors.__total;
        }

        return nextErrors;
      });

      return next;
    });
  };

  const saveClientInfo = async () => {
    if (!id) return;
    const normalizedEmail = normalizeEmail(clientForm.email);

    const nextGeneralFieldErrors: Record<string, string> = {};
    const normalizedGeneralFieldValues = generalInfoCadastralFields.map((fieldName) => {
      const key = getCategoryFieldEntryKey("cadastro_clientes", fieldName);
      const currentValue = dataEntries[key] || "";
      const rule = getFieldRule("cadastro_clientes", fieldName);
      const normalizedValue = normalizeFieldValueForSave(rule, currentValue);
      const validationError = validateFieldValue(rule, normalizedValue);

      if (validationError) {
        nextGeneralFieldErrors[key] = validationError;
      }

      return { fieldName, value: normalizedValue };
    });

    if (Object.keys(nextGeneralFieldErrors).length > 0) {
      setDataFieldErrors((prev) => ({ ...prev, ...nextGeneralFieldErrors }));
      toast.error("Existem campos de endereço invalidos. Revise antes de salvar.");
      return;
    }

    setDataFieldErrors((prev) => {
      const next = { ...prev };
      generalInfoCadastralFields.forEach((fieldName) => {
        delete next[getCategoryFieldEntryKey("cadastro_clientes", fieldName)];
      });
      return next;
    });

    const generalValues = normalizedGeneralFieldValues.reduce<Record<GeneralInfoCadastralFieldName, string>>(
      (acc, entry) => {
        acc[entry.fieldName] = entry.value;
        return acc;
      },
      {
        cep: "",
        endereço: "",
        numero_estabelecimento: "",
        bairro: "",
        cidade: "",
        estado: "",
        inscricao_estadual: "",
        inscricao_municipal: "",
        perfil_atuacao: "",
      },
    );

    const normalizedAddress = buildAddressFromCadastralValues(generalValues);
    const clientWillBeInactive = isInactiveClientStatus(clientForm.status);
    const nextPortalCashflowEnabled = clientWillBeInactive ? false : Boolean(clientForm.portal_cashflow_enabled);

    setSaving(true);

    try {
      const { error } = await supabase.from("clients").update({
        name: clientForm.name,
        cnpj: clientForm.cnpj,
        regime: clientForm.regime,
        sector: clientForm.sector,
        status: clientForm.status,
        contact: clientForm.contact,
        email: normalizedEmail || null,
        phone: clientForm.phone,
        address: normalizedAddress || clientForm.address || null,
        notes: clientForm.notes,
        portal_cashflow_enabled: nextPortalCashflowEnabled,
        ...(clientWillBeInactive ? { portal_user_id: null } : {}),
      }).eq("id", id);

      if (error) {
        toast.error("Erro ao salvar dados do cliente");
        return;
      }

      const { error: deleteGeneralDataError } = await supabase
        .from("client_data")
        .delete()
        .eq("client_id", id)
        .eq("category", "cadastro_clientes")
        .in("field_name", [...generalInfoCadastralFields])
        .is("period", null);

      if (deleteGeneralDataError) {
        toast.error("Dados gerais salvos, mas houve erro ao atualizar os campos cadastrais.");
        return;
      }

      const generalDataRows = normalizedGeneralFieldValues
        .filter((entry) => Boolean(entry.value))
        .map((entry) => ({
          client_id: id,
          category: "cadastro_clientes",
          field_name: entry.fieldName,
          field_value: entry.value,
          period: null,
          created_by: user?.id || null,
        }));

      if (generalDataRows.length > 0) {
        const { error: insertGeneralDataError } = await supabase.from("client_data").insert(generalDataRows);
        if (insertGeneralDataError) {
          toast.error("Dados gerais salvos, mas houve erro ao persistir os campos de endereço.");
          return;
        }
      }

      toast.success("Dados do cliente salvos");

      if (clientWillBeInactive) {
        setPortalAccessEnabled(false);
      }

      setClient({
        ...client!,
        ...clientForm,
        email: normalizedEmail || null,
        address: normalizedAddress || clientForm.address || null,
        portal_cashflow_enabled: nextPortalCashflowEnabled,
        ...(clientWillBeInactive ? { portal_user_id: null } : {}),
      } as ClientRecord);
      setClientForm((prev) => ({
        ...prev,
        email: normalizedEmail || null,
        address: normalizedAddress || prev.address || null,
        portal_cashflow_enabled: nextPortalCashflowEnabled,
      }));
      setDataEntries((prev) => {
        const next = { ...prev };
        normalizedGeneralFieldValues.forEach((entry) => {
          next[getCategoryFieldEntryKey("cadastro_clientes", entry.fieldName)] = entry.value;
        });
        return next;
      });
    } finally {
      setSaving(false);
    }
  };

  const handlePortalAccessChange = async (checked: boolean) => {
    if (!canManageCashflowAccess) {
      toast.error("Apenas usuário admin pode alterar este acesso.");
      return;
    }

    if (checked && clientIsInactive) {
      toast.error("Clientes inativos não podem ter acesso ao portal.");
      return;
    }

    if (!client?.portal_user_id) {
      toast.error("Cliente sem usuário do portal vinculado. Cadastre pelo fluxo de cliente com acesso ao portal.");
      return;
    }

    setSavingPortalAccess(true);

    if (checked) {
      const { error: upsertError } = await supabase.from("user_roles").upsert(
        {
          user_id: client.portal_user_id,
          role: "client" as Database["public"]["Enums"]["app_role"],
        },
        { onConflict: "user_id,role" },
      );

      setSavingPortalAccess(false);

      if (upsertError) {
        toast.error("Não foi possível liberar acesso ao portal.");
        return;
      }

      setPortalAccessEnabled(true);
      toast.success("Acesso ao portal liberado para o cliente.");
      return;
    }

    const { error: deleteError } = await supabase
      .from("user_roles")
      .delete()
      .eq("user_id", client.portal_user_id)
      .eq("role", "client");

    setSavingPortalAccess(false);

    if (deleteError) {
      toast.error("Não foi possível bloquear acesso ao portal.");
      return;
    }

    setPortalAccessEnabled(false);
    toast.success("Acesso ao portal bloqueado para o cliente.");
  };

  const resetPortalTaskDraft = () => {
    setPortalTaskDraft({
      title: "",
      description: "",
      type: "document",
      sector: "Geral",
      dueDate: "",
    });
  };

  const handleCreatePortalTask = async () => {
    if (!id || !user?.id) return;

    if (!client?.portal_user_id || !portalAccessEnabled) {
      toast.error("Libere o acesso ao portal deste cliente antes de criar pendências.");
      return;
    }

    if (!portalTaskDraft.title.trim()) {
      toast.error("Informe o titulo da pendência.");
      return;
    }

    setCreatingPortalTask(true);
    const { data, error } = await supabase
      .from("client_portal_tasks")
      .insert({
        client_id: id,
        title: portalTaskDraft.title.trim(),
        description: portalTaskDraft.description.trim() || null,
        type: portalTaskDraft.type,
        status: "pending_client",
        due_date: portalTaskDraft.dueDate || null,
        sector: portalTaskDraft.sector || "Geral",
        created_by: user.id,
      })
      .select("*")
      .single();
    setCreatingPortalTask(false);

    if (error) {
      toast.error("Não foi possível criar a pendência.");
      return;
    }

    setPortalTasks((prev) => [data as ClientPortalTaskRow, ...prev]);
    resetPortalTaskDraft();
    toast.success("Pendencia criada e publicada para o cliente.");
  };

  const handlePortalTaskStatusChange = async (taskId: string, status: PortalTaskStatus) => {
    const targetTask = portalTasks.find((task) => task.id === taskId) || null;

    setUpdatingPortalTaskId(taskId);
    const { error } = await supabase.from("client_portal_tasks").update({ status }).eq("id", taskId);
    setUpdatingPortalTaskId(null);

    if (error) {
      toast.error("Não foi possível atualizar o status da pendência.");
      return;
    }

    setPortalTasks((prev) => prev.map((task) => (task.id === taskId ? { ...task, status } : task)));

    if (status === "completed" && targetTask?.request_id) {
      const cascadeResult = await completeLinkedRequestAndFormSubmissions(targetTask.request_id);
      if (cascadeResult.errors.length > 0) {
        toast.warning(`Pendencia concluida, mas houve falha na cascata: ${cascadeResult.errors.join(" | ")}`);
        return;
      }
      toast.success("Pendencia concluida e itens vinculados finalizados.");
      return;
    }

    toast.success("Status da pendência atualizado.");
  };

  const handleDeletePortalTask = async (taskId: string) => {
    const confirmed = window.confirm("Deseja excluir esta pendência?");
    if (!confirmed) return;

    setDeletingPortalTaskId(taskId);
    const { error } = await supabase.from("client_portal_tasks").delete().eq("id", taskId);
    setDeletingPortalTaskId(null);

    if (error) {
      toast.error("Não foi possível excluir a pendência.");
      return;
    }

    setPortalTasks((prev) => prev.filter((task) => task.id !== taskId));
    toast.success("Pendencia removida.");
  };

  const saveCategoryData = async (category: ClientCategoryKey) => {
    if (!id || !user) return;
    setSavingData(category);

    const config = categoryConfig[category];
    const entryPeriod = config.mode === "monthly" ? period : null;
    const nextCategoryErrors: Record<string, string> = {};
    let nextPartnerErrors: Record<string, string> = {};

    const entries = config.fields.map((f) => {
      const key = `${category}__${f.name}`;
      const rule = getFieldRule(category, f.name);
      const currentValue = dataEntries[key] || "";
      const normalizedValue = normalizeFieldValueForSave(rule, currentValue);
      const validationError = validateFieldValue(rule, normalizedValue);

      if (validationError) {
        nextCategoryErrors[key] = validationError;
      }

      return {
        client_id: id,
        category,
        field_name: f.name,
        field_value: normalizedValue || null,
        period: entryPeriod,
        created_by: user.id,
      };
    });

    if (category === "cadastro_clientes") {
      nextPartnerErrors = validatePartners(clientPartners);
      entries.push({
        client_id: id,
        category,
        field_name: cadastroClientesPartnersFieldName,
        field_value: clientPartners.length > 0 ? JSON.stringify(normalizePartnersForSave(clientPartners)) : null,
        period: entryPeriod,
        created_by: user.id,
      });
    }

    if (Object.keys(nextCategoryErrors).length > 0 || Object.keys(nextPartnerErrors).length > 0) {
      setSavingData(null);
      setDataFieldErrors((prev) => ({ ...prev, ...nextCategoryErrors }));
      if (category === "cadastro_clientes") {
        setPartnerFieldErrors(nextPartnerErrors);
      }
      toast.error("Existem campos com dados invalidos. Revise antes de salvar.");
      return;
    }

    setDataFieldErrors((prev) => {
      const next = { ...prev };
      config.fields.forEach((field) => {
        delete next[`${category}__${field.name}`];
      });
      return next;
    });
    if (category === "cadastro_clientes") {
      setPartnerFieldErrors({});
    }

    let deleteQuery = supabase.from("client_data")
      .delete()
      .eq("client_id", id)
      .eq("category", category);

    if (config.mode === "monthly") {
      deleteQuery = deleteQuery.eq("period", period);
    } else {
      deleteQuery = deleteQuery.is("period", null);
    }

    const { error: deleteError } = await deleteQuery;
    if (deleteError) {
      setSavingData(null);
      toast.error("Erro ao preparar os dados para salvamento");
      return;
    }

    const { error } = await supabase.from("client_data").insert(entries);
    setSavingData(null);
    if (error) return toast.error("Erro ao salvar dados");
    toast.success(`Dados de ${config.label} salvos`);
    void loadClientData();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !id || !user) return;

    setUploading(true);
    const filePath = `${id}/${uploadCategory}/${Date.now()}_${file.name}`;

    const { error: uploadError } = await supabase.storage
      .from("client-files")
      .upload(filePath, file);

    if (uploadError) {
      setUploading(false);
      return toast.error("Erro ao enviar arquivo");
    }

    const { error: dbError } = await supabase.from("client_files").insert([{
      client_id: id,
      category: uploadCategory,
      file_name: file.name,
      file_path: filePath,
      file_size: file.size,
      uploaded_by: user.id,
    }]);

    setUploading(false);
    if (dbError) return toast.error("Erro ao registrar arquivo");
    toast.success("Arquivo enviado");
    void loadClient();
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const deleteFile = async (fileId: string, filePath: string) => {
    if (!confirm("Excluir este arquivo?")) return;
    await supabase.storage.from("client-files").remove([filePath]);
    await supabase.from("client_files").delete().eq("id", fileId);
    toast.success("Arquivo excluído");
    setFiles((prev) => prev.filter((f) => f.id !== fileId));
  };

  const downloadFile = async (filePath: string, fileName: string) => {
    const { data } = await supabase.storage.from("client-files").download(filePath);
    if (!data) return toast.error("Erro ao baixar arquivo");
    const url = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatBytes = (bytes: number | null) => {
    if (!bytes) return "-";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (!client) return null;

  const selectedBusinessProfiles = getSelectedBusinessProfiles();
  const groupedClientObligations = Array.from(
    acessoriasObligations.reduce((map, row) => {
      const obligationName = (row.obligation_name || "Obrigação sem nome").trim() || "Obrigação sem nome";
      const key = obligationName.toLowerCase();
      const current = map.get(key);
      if (current) {
        current.rows.push(row);
        return map;
      }
      map.set(key, { obligationName, rows: [row] as ClientAcessoriasObligation[] });
      return map;
    }, new Map<string, { obligationName: string; rows: ClientAcessoriasObligation[] }>())
      .values(),
  )
    .map((group) => {
      const rowsForMonth = group.rows
        .filter((row) => {
          const periodMonth = toMonthKey(row.obligation_period);
          const dueMonth = toMonthKey(row.due_date);
          return periodMonth === obligationMonthFilter || dueMonth === obligationMonthFilter;
        })
        .sort((left, right) => {
          const leftDue = left.due_date || "";
          const rightDue = right.due_date || "";
          return leftDue.localeCompare(rightDue);
        });

      let monthStatus = "sem_registro";
      if (rowsForMonth.length > 0) {
        const normalizedStatuses = rowsForMonth.map((row) => normalizeObligationStatusToken(row.status));
        if (normalizedStatuses.includes("atrasado")) monthStatus = "atrasado";
        else if (normalizedStatuses.includes("pendente")) monthStatus = "pendente";
        else if (normalizedStatuses.includes("em_andamento")) monthStatus = "em_andamento";
        else monthStatus = "concluído";
      }

      return {
        obligationName: group.obligationName,
        allRowsCount: group.rows.length,
        rowsForMonth,
        monthStatus,
      };
    })
    .sort((left, right) => left.obligationName.localeCompare(right.obligationName));

  const obligationsWithMonthStatus = groupedClientObligations.filter((group) => group.monthStatus !== "sem_registro").length;

  const renderDataFields = (category: ClientCategoryKey) => {
    const config = categoryConfig[category];
    const categoryFiles = files.filter((file) => file.category === category);
    const isCadastroClientes = category === "cadastro_clientes";
    const isCadastroDp = category === "cadastro_departamento_pessoal";
    const primaryFields = isCadastroDp
      ? config.fields.filter((field) => !cadastroDpSindicatoFieldNames.has(field.name))
      : config.fields;

    const renderField = (field: ClientDataField) => {
      const key = `${category}__${field.name}`;
      const rule = getFieldRule(category, field.name);
      const fieldError = dataFieldErrors[key];
      const isYesNoField = rule?.type === "yesNo";
      const inputMode = rule?.type === "integer" || rule?.type === "number" || rule?.type === "percent"
        ? "decimal"
        : rule?.type === "cep"
          ? "numeric"
          : rule?.type === "phone"
            ? "tel"
            : "text";

      return (
        <div key={key} className="space-y-1.5">
          <Label className="text-xs">{field.label}</Label>
          {isYesNoField ? (
            <select
              className={`h-9 w-full text-sm bg-background border rounded-lg px-3 py-2 outline-none ${fieldError ? "border-destructive" : ""}`}
              value={normalizeYesNoValue(dataEntries[key] || "")}
              onChange={(event) => handleDataFieldChange(category, field.name, event.target.value)}
            >
              <option value="">-</option>
              <option value="sim">Sim</option>
              <option value="nao">Não</option>
            </select>
          ) : (
            <Input
              value={dataEntries[key] || ""}
              onChange={(event) => handleDataFieldChange(category, field.name, event.target.value)}
              inputMode={inputMode}
              type={rule?.type === "date" ? "date" : "text"}
              placeholder="-"
              className={`h-9 ${fieldError ? "border-destructive focus-visible:ring-destructive/30" : ""}`}
            />
          )}
          {fieldError && (
            <p className="text-[11px] text-destructive">{fieldError}</p>
          )}
        </div>
      );
    };

    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <config.icon className={`h-5 w-5 ${config.color}`} />
            <h3 className="font-semibold">{config.label}</h3>
          </div>
          <p className="text-xs text-muted-foreground">{config.description}</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {primaryFields.map(renderField)}
        </div>
        {isCadastroDp && (
          <div className="space-y-3 rounded-xl border bg-muted/20 p-4">
            <div className="space-y-1">
              <h4 className="text-sm font-medium">Informacoes do Sindicato</h4>
              <p className="text-xs text-muted-foreground">
                Dados de contato e identificação do sindicato relacionado ao cliente.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {cadastroDpSindicatoFields.map(renderField)}
            </div>
          </div>
        )}
        {isCadastroClientes && (
          <div className="space-y-4 rounded-xl border bg-muted/20 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <h4 className="text-sm font-medium">Socios</h4>
                <p className="text-xs text-muted-foreground">
                  Cadastre os sócios com participação, pro-labore e senha GOV para relatórios.
                </p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={handleAddPartner}>
                <Plus className="h-3.5 w-3.5 mr-1" />
                Adicionar socio
              </Button>
            </div>

            {partnerFieldErrors.__total && (
              <p className="text-xs text-destructive">{partnerFieldErrors.__total}</p>
            )}

            {clientPartners.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum socio cadastrado.</p>
            ) : (
              <div className="space-y-3">
                {clientPartners.map((partner, index) => {
                  const nameError = partnerFieldErrors[partnerErrorKey(partner.id, "name")];
                  const ownershipError = partnerFieldErrors[partnerErrorKey(partner.id, "ownershipPercent")];
                  const proLaboreError = partnerFieldErrors[partnerErrorKey(partner.id, "proLabore")];
                  const govPasswordError = partnerFieldErrors[partnerErrorKey(partner.id, "govPassword")];

                  return (
                    <div key={partner.id} className="space-y-3 rounded-lg border bg-card p-3">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-medium">Socio {index + 1}</p>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => handleRemovePartner(partner.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-xs">Nome do Socio</Label>
                          <Input
                            value={partner.name}
                            onChange={(event) => handlePartnerFieldChange(partner.id, "name", event.target.value)}
                            placeholder="Nome"
                            className={`h-9 ${nameError ? "border-destructive focus-visible:ring-destructive/30" : ""}`}
                          />
                          {nameError && <p className="text-[11px] text-destructive">{nameError}</p>}
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Participação (%)</Label>
                          <Input
                            value={partner.ownershipPercent}
                            onChange={(event) => handlePartnerFieldChange(partner.id, "ownershipPercent", event.target.value)}
                            placeholder="0,00"
                            inputMode="decimal"
                            className={`h-9 ${ownershipError ? "border-destructive focus-visible:ring-destructive/30" : ""}`}
                          />
                          {ownershipError && <p className="text-[11px] text-destructive">{ownershipError}</p>}
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Pro-labore (R$)</Label>
                          <Input
                            value={partner.proLabore}
                            onChange={(event) => handlePartnerFieldChange(partner.id, "proLabore", event.target.value)}
                            placeholder="0,00"
                            inputMode="decimal"
                            className={`h-9 ${proLaboreError ? "border-destructive focus-visible:ring-destructive/30" : ""}`}
                          />
                          {proLaboreError && <p className="text-[11px] text-destructive">{proLaboreError}</p>}
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Senha GOV</Label>
                          <Input
                            type="password"
                            value={partner.govPassword}
                            onChange={(event) => handlePartnerFieldChange(partner.id, "govPassword", event.target.value)}
                            placeholder="Senha"
                            className={`h-9 ${govPasswordError ? "border-destructive focus-visible:ring-destructive/30" : ""}`}
                          />
                          {govPasswordError && <p className="text-[11px] text-destructive">{govPasswordError}</p>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
        <div className="flex justify-end">
          <Button onClick={() => saveCategoryData(category)} disabled={savingData === category} size="sm">
            {savingData === category ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
            Salvar {config.label}
          </Button>
        </div>
        {config.allowFiles && (
          <>
            <Separator />
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <FolderOpen className="h-4 w-4" /> Documentos - {config.label}
                </h4>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setUploadCategory(category);
                    fileInputRef.current?.click();
                  }}
                  disabled={uploading}
                >
                  {uploading && uploadCategory === category ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                  ) : (
                    <Upload className="h-3.5 w-3.5 mr-1" />
                  )}
                  Enviar Arquivo
                </Button>
              </div>
              {categoryFiles.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">Nenhum documento nesta categoria</p>
              ) : (
                <div className="space-y-2">
                  {categoryFiles.map((file) => (
                    <motion.div
                      key={file.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex items-center justify-between p-3 rounded-lg border bg-card"
                    >
                      <div className="flex items-center gap-3">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">{file.file_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatBytes(file.file_size)} - {new Date(file.created_at).toLocaleDateString("pt-BR")}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => downloadFile(file.file_path, file.file_name)}>
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteFile(file.id, file.file_path)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    );
  };

  const statusColors: Record<string, string> = {
    Ativo: "bg-primary/10 text-primary",
    Onboarding: "bg-amber-100 text-amber-700 dark:bg-amber-900/20",
    Inativo: "bg-muted text-muted-foreground",
  };

  return (
    <AppLayout>
      <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileUpload} />

      <div className="space-y-6 max-w-6xl">
        {/* Header */}
        <section className="executive-hero rounded-[1.8rem] px-5 py-5 text-white md:px-7 md:py-6">
          <div className="flex flex-col gap-5">
            <div className="flex items-start gap-4">
              <Button
                variant="hero-outline"
                size="icon"
                onClick={() => navigate("/app/clientes")}
                className="shrink-0 border-white/20 bg-white/10 text-white hover:bg-white hover:text-primary"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/10">
                <Building2 className="h-7 w-7 text-white" />
              </div>
              <div className="flex-1">
                <span className="inline-flex rounded-full border border-white/14 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-white/72">
                  Workspace do cliente
                </span>
                <h1 className="mt-3 font-heading text-2xl font-bold md:text-3xl">{client.name}</h1>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {client.cnpj && <span className="text-sm text-white/68">{client.cnpj}</span>}
                  {client.sector && <span className="text-sm text-white/68">{client.sector}</span>}
                  {client.regime && <span className="text-sm text-white/68">{client.regime}</span>}
                </div>
              </div>
              <div>
                <Badge variant="outline" className={`text-xs border-0 ${statusColors[client.status || ""] || "bg-muted"}`}>
                  {client.status}
                </Badge>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-white/12 bg-white/8 px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.14em] text-white/56">Documentos</p>
                <p className="mt-2 text-2xl font-semibold">{files.length}</p>
              </div>
              <div className="rounded-2xl border border-white/12 bg-white/8 px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.14em] text-white/56">Perfis de atividade</p>
                <p className="mt-2 text-2xl font-semibold">{selectedBusinessProfiles.length}</p>
              </div>
              <div className="rounded-2xl border border-white/12 bg-white/8 px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.14em] text-white/56">Obrigações no mês</p>
                <p className="mt-2 text-2xl font-semibold">{obligationsWithMonthStatus}</p>
              </div>
              <div className="rounded-2xl border border-white/12 bg-white/8 px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.14em] text-white/56">Pendências portal</p>
                <p className="mt-2 text-2xl font-semibold">{portalTasks.length}</p>
              </div>
            </div>
          </div>
        </section>

        {/* Tabs */}
        <Tabs defaultValue="info" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2 rounded-[1.25rem] border border-border/80 bg-card/90 p-1 sm:grid-cols-5">
            <TabsTrigger value="info">Dados Gerais</TabsTrigger>
            <TabsTrigger value="dados_mensais">Dados Mensais</TabsTrigger>
            <TabsTrigger value="dados_cadastrais">Dados Cadastrais</TabsTrigger>
            <TabsTrigger value="obrigações">Obrigações</TabsTrigger>
            <TabsTrigger value="pendências">Pendências</TabsTrigger>
          </TabsList>

          {/* General Info */}
          <TabsContent value="info" className="space-y-4">
            <div className="rounded-xl border bg-card p-6 space-y-4">
              <h3 className="font-semibold flex items-center gap-2">
                <Building2 className="h-4 w-4" /> Informações do Cliente
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Razão Social</Label>
                  <Input value={clientForm.name || ""} onChange={(e) => setClientForm((p) => ({ ...p, name: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">CNPJ</Label>
                  <div className="flex gap-2">
                    <Input value={clientForm.cnpj || ""} onChange={(e) => setClientForm((p) => ({ ...p, cnpj: e.target.value }))} />
                    <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={() => void handleCopyRawCnpj()}>
                      <Copy className="h-3.5 w-3.5 mr-1" />
                      Copiar
                    </Button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Regime Tributário</Label>
                  <select className="w-full text-sm bg-background border rounded-lg px-3 py-2" value={clientForm.regime || ""} onChange={(e) => setClientForm((p) => ({ ...p, regime: e.target.value }))}>
                    {["Simples Nacional", "Lucro Presumido", "Lucro Real", "MEI"].map((r) => <option key={r}>{r}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Segmento do Cliente</Label>
                  <select className="w-full text-sm bg-background border rounded-lg px-3 py-2" value={clientForm.sector || ""} onChange={(e) => setClientForm((p) => ({ ...p, sector: e.target.value }))}>
                    {getClientSegmentOptions(clientForm.sector).map((segment) => <option key={segment}>{segment}</option>)}
                  </select>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label className="text-xs">Classificação de Atividade</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 rounded-lg border bg-muted/20 p-3">
                    {clientBusinessProfileOptions.map((profile) => (
                      <label key={profile.key} className="flex items-center gap-2 text-sm cursor-pointer">
                        <Checkbox
                          checked={selectedBusinessProfiles.includes(profile.key)}
                          onCheckedChange={() => toggleBusinessProfile(profile.key)}
                        />
                        <span>{profile.label}</span>
                      </label>
                    ))}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Marque uma ou mais opções: comércio, industria e/ou prestador de serviços.
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Status</Label>
                  <select className="w-full text-sm bg-background border rounded-lg px-3 py-2" value={clientForm.status || ""} onChange={(e) => setClientForm((p) => ({ ...p, status: e.target.value }))}>
                    {["Ativo", "Onboarding", "Inativo"].map((s) => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Contato Principal</Label>
                  <Input value={clientForm.contact || ""} onChange={(e) => setClientForm((p) => ({ ...p, contact: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">E-mail</Label>
                  <Input type="email" value={clientForm.email || ""} onChange={(e) => setClientForm((p) => ({ ...p, email: e.target.value.toLowerCase() }))} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Telefone</Label>
                  <Input value={clientForm.phone || ""} onChange={(e) => setClientForm((p) => ({ ...p, phone: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">CEP</Label>
                  <div className="flex gap-2">
                    <Input
                      value={getGeneralInfoFieldValue("cep")}
                      onChange={(event) => setGeneralInfoFieldValue("cep", formatCepValue(event.target.value))}
                      onBlur={() => {
                        const digits = getGeneralInfoFieldValue("cep").replace(/\D/g, "");
                        if (digits.length === 8) {
                          void handleCepLookup(digits);
                        }
                      }}
                      placeholder="00000-000"
                      inputMode="numeric"
                      className={dataFieldErrors[getCategoryFieldEntryKey("cadastro_clientes", "cep")] ? "border-destructive focus-visible:ring-destructive/30" : ""}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="shrink-0"
                      onClick={() => void handleCepLookup(getGeneralInfoFieldValue("cep"))}
                      disabled={searchingCep}
                    >
                      {searchingCep ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Buscar"}
                    </Button>
                  </div>
                  {dataFieldErrors[getCategoryFieldEntryKey("cadastro_clientes", "cep")] && (
                    <p className="text-[11px] text-destructive">{dataFieldErrors[getCategoryFieldEntryKey("cadastro_clientes", "cep")]}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Inscricao Estadual</Label>
                  <Input
                    value={getGeneralInfoFieldValue("inscricao_estadual")}
                    onChange={(event) => setGeneralInfoFieldValue("inscricao_estadual", event.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Inscricao Municipal</Label>
                  <Input
                    value={getGeneralInfoFieldValue("inscricao_municipal")}
                    onChange={(event) => setGeneralInfoFieldValue("inscricao_municipal", event.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Rua / Logradouro</Label>
                  <Input
                    value={getGeneralInfoFieldValue("endereço")}
                    onChange={(event) => setGeneralInfoFieldValue("endereço", event.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Número do Estabelecimento</Label>
                  <Input
                    value={getGeneralInfoFieldValue("numero_estabelecimento")}
                    onChange={(event) => setGeneralInfoFieldValue("numero_estabelecimento", event.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Bairro</Label>
                  <Input
                    value={getGeneralInfoFieldValue("bairro")}
                    onChange={(event) => setGeneralInfoFieldValue("bairro", event.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Cidade</Label>
                  <Input
                    value={getGeneralInfoFieldValue("cidade")}
                    onChange={(event) => setGeneralInfoFieldValue("cidade", event.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Estado (UF)</Label>
                  <Input
                    value={getGeneralInfoFieldValue("estado")}
                    onChange={(event) => setGeneralInfoFieldValue("estado", event.target.value)}
                    placeholder="UF"
                  />
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <Label className="text-xs">Endereco Completo (automático)</Label>
                  <Input
                    value={buildAddressFromCadastralValues({
                      cep: getGeneralInfoFieldValue("cep"),
                      endereço: getGeneralInfoFieldValue("endereço"),
                      numero_estabelecimento: getGeneralInfoFieldValue("numero_estabelecimento"),
                      bairro: getGeneralInfoFieldValue("bairro"),
                      cidade: getGeneralInfoFieldValue("cidade"),
                      estado: getGeneralInfoFieldValue("estado"),
                      inscricao_estadual: getGeneralInfoFieldValue("inscricao_estadual"),
                      inscricao_municipal: getGeneralInfoFieldValue("inscricao_municipal"),
                      perfil_atuacao: getGeneralInfoFieldValue("perfil_atuacao"),
                    }) || clientForm.address || ""}
                    readOnly
                  />
                  <p className="text-[11px] text-muted-foreground">
                    O endereço completo será salvo automaticamente a partir dos campos acima.
                  </p>
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <Label className="text-xs">Observações</Label>
                  <Textarea value={clientForm.notes || ""} onChange={(e) => setClientForm((p) => ({ ...p, notes: e.target.value }))} rows={3} />
                </div>
                <div className="md:col-span-2 rounded-lg border bg-muted/20 px-4 py-3 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">Acesso ao portal do cliente</p>
                      <p className="text-xs text-muted-foreground">
                        Gerencie a liberação de login do cliente no portal.
                      </p>
                      <p className="text-xs mt-1">
                        Status atual:{" "}
                        <span className={portalAccessEnabled ? "text-primary font-medium" : "text-muted-foreground"}>
                          {portalAccessEnabled ? "liberado" : "bloqueado"}
                        </span>
                      </p>
                    </div>
                    <Switch
                      checked={portalAccessEnabled}
                      disabled={!canManageCashflowAccess || savingPortalAccess || clientIsInactive}
                      onCheckedChange={(checked) => void handlePortalAccessChange(checked)}
                      aria-label="Liberar acesso ao portal do cliente"
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {client?.portal_user_id ? (
                      <p className="text-xs text-muted-foreground">
                        Usuário do portal vinculado: {client.portal_user_id.slice(0, 8)}...
                      </p>
                    ) : (
                      <p className="text-xs text-amber-700 dark:text-amber-300">
                        Cliente sem usuário de portal vinculado.
                      </p>
                    )}
                  </div>
                </div>
                <div className="md:col-span-2 rounded-lg border bg-muted/20 px-4 py-3 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">Liberar controle de caixa no portal</p>
                      <p className="text-xs text-muted-foreground">
                        Define se este cliente pode acessar a nova aba de controle de caixa no portal.
                      </p>
                    </div>
                    <Switch
                      checked={clientIsInactive ? false : Boolean(clientForm.portal_cashflow_enabled)}
                      disabled={!canManageCashflowAccess || clientIsInactive}
                      onCheckedChange={(checked) => setClientForm((prev) => ({ ...prev, portal_cashflow_enabled: checked }))}
                      aria-label="Liberar controle de caixa no portal"
                    />
                  </div>
                  {clientIsInactive && (
                    <p className="text-xs text-amber-700 dark:text-amber-300">
                      Cliente inativo: acesso ao portal e fluxo de caixa ficam bloqueados automaticamente.
                    </p>
                  )}
                  {!canManageCashflowAccess && (
                    <p className="text-xs text-amber-700 dark:text-amber-300">
                      Apenas usuários admin podem alterar esta liberação.
                    </p>
                  )}
                </div>
              </div>
              <div className="flex justify-end">
                <Button onClick={saveClientInfo} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
                  Salvar Informações
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="dados_mensais" className="space-y-4">
            <div className="rounded-xl border bg-card p-6 space-y-5">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div className="space-y-1">
                  <h3 className="font-semibold flex items-center gap-2">
                    <CalendarDays className="h-4 w-4" /> Dados mensais
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Informações necessarias para o relatório gerencial mensal.
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Período de referência</Label>
                  <Input
                    type="month"
                    value={period}
                    onChange={(event) => setPeriod(event.target.value)}
                    className="h-9 w-48"
                  />
                </div>
              </div>

              <Tabs defaultValue={monthlyCategoryKeys[0]} className="space-y-4">
                <TabsList className="grid h-auto w-full grid-cols-1 gap-1 sm:grid-cols-3">
                  {monthlyCategoryKeys.map((category) => (
                    <TabsTrigger key={category} value={category} className="h-9">
                      {categoryConfig[category].label}
                    </TabsTrigger>
                  ))}
                </TabsList>

                {monthlyCategoryKeys.map((category) => (
                  <TabsContent key={category} value={category}>
                    <div className="rounded-lg border p-4">
                      {renderDataFields(category)}
                    </div>
                  </TabsContent>
                ))}
              </Tabs>
            </div>
          </TabsContent>

          <TabsContent value="dados_cadastrais" className="space-y-4">
            <div className="rounded-xl border bg-card p-6 space-y-5">
              <div className="space-y-1">
                <h3 className="font-semibold flex items-center gap-2">
                  <Building2 className="h-4 w-4" /> Dados cadastrais por setor
                </h3>
              </div>

              <Tabs defaultValue={cadastralCategoryTabKeys[0]} className="space-y-4">
                <TabsList className="grid h-auto w-full grid-cols-2 gap-1 md:grid-cols-4">
                  {cadastralCategoryTabKeys.map((category) => (
                    <TabsTrigger key={category} value={category} className="h-9 px-2 text-xs sm:text-sm">
                      {categoryConfig[category].label}
                    </TabsTrigger>
                  ))}
                </TabsList>

                {cadastralCategoryTabKeys.map((category) => (
                  <TabsContent key={category} value={category}>
                    <div className="rounded-lg border p-4">
                      {renderDataFields(category)}
                    </div>
                  </TabsContent>
                ))}
              </Tabs>
            </div>
          </TabsContent>

          <TabsContent value="obrigações" className="space-y-4">
            <div className="rounded-xl border bg-card p-6 space-y-5">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div className="space-y-1">
                  <h3 className="font-semibold flex items-center gap-2">
                    <ClipboardList className="h-4 w-4" /> Obrigações da empresa
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Exibe todas as obrigações cadastradas para este cliente e a situação no mês selecionado.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Mes de referência</Label>
                  <Input
                    type="month"
                    value={obligationMonthFilter}
                    onChange={(event) => setObligationMonthFilter(event.target.value)}
                    className="h-9 w-48"
                  />
                </div>
              </div>

              <div className="rounded-lg border bg-muted/20 p-3">
                <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-3">
                  <p>Total de obrigações cadastradas: <span className="font-medium">{groupedClientObligations.length}</span></p>
                  <p>Com situação no mês: <span className="font-medium">{obligationsWithMonthStatus}</span></p>
                  <p>Mes filtrado: <span className="font-medium">{obligationMonthFilter}</span></p>
                </div>
              </div>

              {loadingAcessoriasObligations ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                </div>
              ) : groupedClientObligations.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhuma obrigação encontrada para este cliente.
                </p>
              ) : (
                <div className="space-y-3">
                  {groupedClientObligations.map((group) => (
                    <div key={group.obligationName} className="rounded-lg border p-4 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-medium">{group.obligationName}</p>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="secondary" className="text-[11px]">
                            Histórico: {group.allRowsCount}
                          </Badge>
                          <Badge
                            variant="outline"
                            className={`border-0 text-[11px] ${obligationStatusClass[group.monthStatus] || obligationStatusClass.sem_registro}`}
                          >
                            {obligationStatusLabel[group.monthStatus] || obligationStatusLabel.sem_registro}
                          </Badge>
                        </div>
                      </div>

                      {group.rowsForMonth.length === 0 ? (
                        <p className="text-xs text-muted-foreground">
                          Sem registro desta obrigação no mês selecionado.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {group.rowsForMonth.map((row) => {
                            const rowStatus = normalizeObligationStatusToken(row.status);
                            return (
                              <div key={row.id} className="rounded-md border bg-muted/10 px-3 py-2 space-y-1.5">
                                <div className="flex flex-wrap items-center gap-2">
                                  <Badge
                                    variant="outline"
                                    className={`border-0 text-[11px] ${obligationStatusClass[rowStatus] || obligationStatusClass.pendente}`}
                                  >
                                    {obligationStatusLabel[rowStatus] || obligationStatusLabel.pendente}
                                  </Badge>
                                  {row.obligation_period && (
                                    <span className="text-[11px] text-muted-foreground">
                                      Competência: {row.obligation_period}
                                    </span>
                                  )}
                                  {row.due_date && (
                                    <span className="text-[11px] text-muted-foreground">
                                      Vencimento: {new Date(row.due_date).toLocaleDateString("pt-BR")}
                                    </span>
                                  )}
                                  {row.delivered_at && (
                                    <span className="text-[11px] text-muted-foreground">
                                      Entregue em: {new Date(row.delivered_at).toLocaleDateString("pt-BR")}
                                    </span>
                                  )}
                                </div>
                                {(row.protocol || row.notes) && (
                                  <p className="text-[11px] text-muted-foreground">
                                    {row.protocol ? `Protocolo: ${row.protocol}` : ""}
                                    {row.protocol && row.notes ? " • " : ""}
                                    {row.notes ? `Obs.: ${row.notes}` : ""}
                                  </p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="pendências" className="space-y-4">
            <div className="rounded-xl border bg-card p-6 space-y-5">
              <h3 className="font-semibold flex items-center gap-2">
                <ClipboardList className="h-4 w-4" /> Pendências do cliente
              </h3>

              {(!client?.portal_user_id || !portalAccessEnabled) && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-300">
                  Este cliente ainda não tem acesso ativo ao portal. Libere o acesso para que as pendências sejam exibidas para ele.
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5 md:col-span-2">
                  <Label className="text-xs">Título da pendência</Label>
                  <Input
                    value={portalTaskDraft.title}
                    onChange={(event) => setPortalTaskDraft((prev) => ({ ...prev, title: event.target.value }))}
                    placeholder="Ex.: Enviar extrato bancário do mês"
                  />
                </div>

                <div className="space-y-1.5 md:col-span-2">
                  <Label className="text-xs">Descrição</Label>
                  <Textarea
                    rows={3}
                    value={portalTaskDraft.description}
                    onChange={(event) => setPortalTaskDraft((prev) => ({ ...prev, description: event.target.value }))}
                    placeholder="Descreva as informações ou documentos que o cliente precisa enviar."
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Tipo</Label>
                  <Select
                    value={portalTaskDraft.type}
                    onValueChange={(value) => setPortalTaskDraft((prev) => ({ ...prev, type: value as PortalTaskType }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {portalTaskTypeOptions.map((type) => (
                        <SelectItem key={type} value={type}>
                          {portalTaskTypeLabel[type]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Setor</Label>
                  <Select
                    value={portalTaskDraft.sector}
                    onValueChange={(value) => setPortalTaskDraft((prev) => ({ ...prev, sector: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {sectorOptions.map((sector) => (
                        <SelectItem key={sector} value={sector}>
                          {sector}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Prazo (opcional)</Label>
                  <Input
                    type="date"
                    value={portalTaskDraft.dueDate}
                    onChange={(event) => setPortalTaskDraft((prev) => ({ ...prev, dueDate: event.target.value }))}
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button onClick={() => void handleCreatePortalTask()} disabled={creatingPortalTask}>
                  {creatingPortalTask ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
                  Criar pendência
                </Button>
                <Button type="button" variant="outline" onClick={resetPortalTaskDraft} disabled={creatingPortalTask}>
                  Limpar campos
                </Button>
                <p className="text-xs text-muted-foreground">
                  A pendência aparece no portal do cliente em "Pendências" e na visao geral.
                </p>
              </div>
            </div>

            <div className="rounded-xl border bg-card p-6 space-y-4">
              <h3 className="font-semibold">Pendências cadastradas</h3>

              {portalTasks.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma pendência cadastrada para este cliente.</p>
              ) : (
                <div className="space-y-3">
                  {portalTasks.map((task) => {
                    const status = (portalTaskStatusOptions.includes(task.status as PortalTaskStatus)
                      ? (task.status as PortalTaskStatus)
                      : "pending_client");
                    const type = (portalTaskTypeOptions.includes(task.type as PortalTaskType)
                      ? (task.type as PortalTaskType)
                      : "general");

                    return (
                      <div key={task.id} className="rounded-lg border p-3 space-y-2">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="space-y-1">
                            <p className="text-sm font-medium">{task.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {task.description || "Sem descrição"} {task.due_date ? `• prazo: ${new Date(task.due_date).toLocaleDateString("pt-BR")}` : ""}
                            </p>
                          </div>
                          <Badge variant="outline" className={`border-0 ${portalTaskStatusClass[status]}`}>
                            {portalTaskStatusLabel[status]}
                          </Badge>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="secondary" className="text-[11px]">
                            Tipo: {portalTaskTypeLabel[type]}
                          </Badge>
                          <Badge variant="outline" className="text-[11px]">
                            Setor: {task.sector}
                          </Badge>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <Select
                            value={status}
                            onValueChange={(value) => void handlePortalTaskStatusChange(task.id, value as PortalTaskStatus)}
                          >
                            <SelectTrigger className="h-8 w-[220px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {portalTaskStatusOptions.map((statusOption) => (
                                <SelectItem key={statusOption} value={statusOption}>
                                  {portalTaskStatusLabel[statusOption]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>

                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={updatingPortalTaskId === task.id}
                            onClick={() => void handlePortalTaskStatusChange(task.id, "completed")}
                          >
                            {updatingPortalTaskId === task.id ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
                            Marcar concluída
                          </Button>

                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-destructive"
                            disabled={deletingPortalTaskId === task.id}
                            onClick={() => void handleDeletePortalTask(task.id)}
                          >
                            {deletingPortalTaskId === task.id ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
                            Excluir
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </TabsContent>

        </Tabs>
      </div>
    </AppLayout>
  );
}


