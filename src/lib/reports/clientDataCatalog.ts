import { normalizeReportToken } from "./classification";
import type { ReportFieldDataType, ReportFieldDefinition } from "./types";

interface ClientDataFieldConfig {
  name: string;
  label: string;
  dataType?: ReportFieldDataType;
  classification?: ReportFieldDefinition["classification"];
  formatter?: ReportFieldDefinition["formatter"];
}

interface ClientDataCategoryConfig {
  category: string;
  label: string;
  fields: readonly ClientDataFieldConfig[];
}

const sensitiveFieldNames = new Set([
  "clinica_parceira_cnpj",
  "clinica_parceira_contato",
  "clinica_parceira_email",
  "clinica_parceira_telefone_whatsapp",
  "sindicato_cnpj",
  "sindicato_contato",
  "sindicato_telefone_whatsapp",
  "telefone",
  "whatsapp",
]);

const booleanFieldNames = new Set([
  "balanco_anual",
  "certificado_digital",
  "contrato",
  "contrato_social",
  "controle_estoque",
  "contribuinte_icms",
  "contribuinte_ipi",
  "dctf",
  "defis",
  "ecd",
  "ecf",
  "efd_contribuicoes",
  "emite_nfe",
  "emite_nfse",
  "entrega_gia",
  "entrega_sped_fiscal",
  "envia_extratos_bancarios",
  "envia_folha_ponto",
  "envia_notas_fiscais",
  "envia_relatorio_ferias",
  "gia",
  "hora_extra_banco_horas",
  "integracao_contabil",
  "outros_documentos",
  "pgdas",
  "possui_adiantamento_salarial",
  "possui_decimo_terceiro",
  "possui_fgts",
  "possui_funcionarios",
  "possui_inss",
  "possui_pro_labore",
  "possui_st",
  "possui_variaveis",
  "procuracao",
  "sped_fiscal",
]);

export const clientDataCategories = [
  {
    category: "cadastro_clientes",
    label: "Cadastro de Clientes",
    fields: [
      { name: "codigo", label: "Codigo", dataType: "number" },
      { name: "nome_fantasia", label: "Nome Fantasia" },
      { name: "inscricao_estadual", label: "Inscricao Estadual" },
      { name: "inscricao_municipal", label: "Inscricao Municipal" },
      { name: "regime_tributario", label: "Regime Tributario" },
      { name: "cnae_principal", label: "CNAE Principal" },
      { name: "data_abertura", label: "Data de Abertura", dataType: "date", formatter: "date" },
      { name: "cep", label: "CEP" },
      { name: "endereco", label: "Rua / Logradouro" },
      { name: "numero_estabelecimento", label: "Numero do Estabelecimento" },
      { name: "complemento", label: "Complemento" },
      { name: "bairro", label: "Bairro" },
      { name: "cidade", label: "Cidade" },
      { name: "estado", label: "Estado" },
      { name: "ddd", label: "DDD" },
      { name: "telefone", label: "Telefone" },
      { name: "whatsapp", label: "WhatsApp" },
    ],
  },
  {
    category: "cadastro_fiscal",
    label: "Setor Fiscal",
    fields: [
      { name: "regime_icms", label: "Regime ICMS" },
      { name: "contribuinte_icms", label: "Contribuinte ICMS" },
      { name: "contribuinte_ipi", label: "Contribuinte IPI" },
      { name: "tipo_operacao", label: "Tipo de Operacao" },
      { name: "emite_nfe", label: "Emite NF-e" },
      { name: "emite_nfse", label: "Emite NFS-e" },
      { name: "portal_nf_utilizado", label: "Portal NF utilizado" },
      { name: "possui_st", label: "Possui ST" },
      { name: "estados_que_opera", label: "Estados que Opera" },
      { name: "controle_estoque", label: "Controle de Estoque" },
      { name: "sistema_vendas", label: "Sistema de Vendas" },
      { name: "integracao_contabil", label: "Integracao Contabil" },
      { name: "entrega_gia", label: "Entrega GIA" },
      { name: "entrega_sped_fiscal", label: "Entrega SPED Fiscal" },
    ],
  },
  {
    category: "cadastro_departamento_pessoal",
    label: "Departamento Pessoal",
    fields: [
      { name: "possui_pro_labore", label: "Possui Pro-labore" },
      { name: "possui_funcionarios", label: "Possui Funcionarios" },
      { name: "possui_variaveis", label: "Possui Variaveis" },
      { name: "possui_inss", label: "Possui INSS" },
      { name: "possui_fgts", label: "Possui FGTS" },
      { name: "possui_adiantamento_salarial", label: "Possui adiantamento salarial" },
      { name: "envia_folha_ponto", label: "Envia Folha Ponto" },
      { name: "beneficios", label: "Beneficios" },
      { name: "hora_extra_banco_horas", label: "Hora extra / Banco de horas" },
      { name: "envia_relatorio_ferias", label: "Envia relatorio de ferias" },
      { name: "possui_decimo_terceiro", label: "Possui 13o" },
      { name: "clinica_parceira", label: "Nome da Clinica Parceira" },
      { name: "clinica_parceira_cnpj", label: "CNPJ da Clinica Parceira" },
      { name: "clinica_parceira_contato", label: "Contato da Clinica Parceira" },
      { name: "clinica_parceira_telefone_whatsapp", label: "Telefone/WhatsApp da Clinica Parceira" },
      { name: "clinica_parceira_email", label: "E-mail da Clinica Parceira" },
      { name: "clinica_parceira_observacoes", label: "Observacoes da Clinica Parceira" },
      { name: "sindicato_nome", label: "Nome do Sindicato" },
      { name: "sindicato_cnpj", label: "CNPJ do Sindicato" },
      { name: "sindicato_codigo_registro", label: "Codigo/Registro do Sindicato" },
      { name: "sindicato_contato", label: "Contato do Sindicato" },
      { name: "sindicato_telefone_whatsapp", label: "Telefone/WhatsApp do Sindicato" },
      { name: "sindicato_observacoes", label: "Observacoes do Sindicato" },
    ],
  },
  {
    category: "cadastro_contabil",
    label: "Setor Contabil",
    fields: [
      { name: "obrigacao_contabil", label: "Obrigacao Contabil" },
      { name: "envia_extratos_bancarios", label: "Envia Extratos Bancarios" },
      { name: "envia_notas_fiscais", label: "Envia Notas Fiscais" },
      { name: "integracao_contabil", label: "Integracao Contabil" },
      { name: "balanco_anual", label: "Balanco Anual" },
      { name: "responsavel_contabil_grow", label: "Responsavel Contabil Grow" },
      { name: "periodicidade_relatorios", label: "Periodicidade Relatorios" },
      { name: "observacoes_contabeis", label: "Observacoes Contabeis" },
    ],
  },
  {
    category: "cadastro_obrigacoes",
    label: "Obrigacoes",
    fields: [
      { name: "pgdas", label: "PGDAS" },
      { name: "gia", label: "GIA" },
      { name: "sped_fiscal", label: "SPED Fiscal" },
      { name: "efd_contribuicoes", label: "EFD Contribuicoes" },
      { name: "dctf", label: "DCTF" },
      { name: "defis", label: "DEFIS" },
      { name: "ecd", label: "ECD" },
      { name: "ecf", label: "ECF" },
    ],
  },
  {
    category: "cadastro_honorarios",
    label: "Honorarios",
    fields: [
      { name: "plano", label: "Plano" },
      { name: "valor_mensal", label: "Valor Mensal (R$)", dataType: "currency", formatter: "currency", classification: "regulated" },
      { name: "forma_pagamento", label: "Forma de Pagamento", classification: "sensitive" },
      { name: "vencimento", label: "Vencimento", dataType: "number" },
      { name: "situacao", label: "Situacao" },
    ],
  },
  {
    category: "cadastro_documentos",
    label: "Documentos",
    fields: [
      { name: "contrato", label: "Contrato" },
      { name: "procuracao", label: "Procuracao" },
      { name: "certificado_digital", label: "Certificado Digital" },
      { name: "contrato_social", label: "Contrato Social" },
      { name: "alteracoes_contratuais", label: "Alteracoes Contratuais" },
      { name: "outros_documentos", label: "Outros Documentos" },
    ],
  },
] as const satisfies readonly ClientDataCategoryConfig[];

function toClientDataField(category: ClientDataCategoryConfig, config: ClientDataFieldConfig): ReportFieldDefinition {
  const normalizedName = normalizeReportToken(config.name);
  const dataType = config.dataType || (booleanFieldNames.has(normalizedName) ? "boolean" : "text");
  const classification = config.classification || (sensitiveFieldNames.has(normalizedName) ? "sensitive" : "internal");

  return {
    key: `cadastral_${category.category}_${normalizedName}`,
    label: config.label,
    description: `${category.label}: ${config.label}`,
    sourcePath: `client_data.${category.category}.${config.name}`,
    dataType,
    classification,
    formatter: config.formatter,
    exportable: true,
    previewable: true,
    module: "Clientes",
    group: category.label,
  };
}

export const clientDataReportFields: ReportFieldDefinition[] = clientDataCategories.flatMap((category) =>
  category.fields.map((config) => toClientDataField(category, config)),
);

export const clientPartnerReportFields: ReportFieldDefinition[] = [
  {
    key: "cadastral_cadastro_clientes_socios_quantidade",
    label: "Quantidade de Socios",
    sourcePath: "client_data.cadastro_clientes.socios",
    dataType: "number",
    classification: "sensitive",
    exportable: true,
    previewable: true,
    module: "Clientes",
    group: "Socios",
  },
  {
    key: "cadastral_cadastro_clientes_socios_nomes",
    label: "Nomes dos Socios",
    sourcePath: "client_data.cadastro_clientes.socios.nome",
    dataType: "text",
    classification: "sensitive",
    exportable: true,
    previewable: true,
    module: "Clientes",
    group: "Socios",
  },
  {
    key: "cadastral_cadastro_clientes_socios_participacao_total",
    label: "Participacao Total dos Socios (%)",
    sourcePath: "client_data.cadastro_clientes.socios.percentual_participacao",
    dataType: "percent",
    formatter: "percent",
    classification: "sensitive",
    exportable: true,
    previewable: true,
    module: "Clientes",
    group: "Socios",
  },
  {
    key: "cadastral_cadastro_clientes_socios_participacao_por_socio",
    label: "Participacao por Socio",
    sourcePath: "client_data.cadastro_clientes.socios.percentual_participacao",
    dataType: "text",
    classification: "sensitive",
    exportable: true,
    previewable: true,
    module: "Clientes",
    group: "Socios",
  },
  {
    key: "cadastral_cadastro_clientes_socios_pro_labore_total",
    label: "Pro-labore Total dos Socios (R$)",
    sourcePath: "client_data.cadastro_clientes.socios.pro_labore",
    dataType: "currency",
    formatter: "currency",
    classification: "regulated",
    exportable: true,
    previewable: true,
    module: "Clientes",
    group: "Socios",
  },
  {
    key: "cadastral_cadastro_clientes_socios_status_senha_gov",
    label: "Status de credencial GOV",
    sourcePath: "client_data.cadastro_clientes.socios.credential_status",
    dataType: "text",
    classification: "prohibited",
    exportable: false,
    previewable: false,
    module: "Clientes",
    group: "Socios",
  },
];
