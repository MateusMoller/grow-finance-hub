import { maxReportClassification } from "./classification";
import { clientDataReportFields, clientPartnerReportFields } from "./clientDataCatalog";
import type { ReportDatasetDefinition, ReportDatasetId, ReportFieldDefinition } from "./types";

const internalManagementRoles = ["admin", "director", "manager"] as const;
const internalOperationalRoles = [
  "admin",
  "director",
  "manager",
  "employee",
  "commercial",
  "partner",
  "departamento_pessoal",
  "fiscal",
  "contabil",
] as const;

const field = (definition: ReportFieldDefinition): ReportFieldDefinition => definition;

const clientFields: ReportFieldDefinition[] = [
  field({ key: "nome", label: "Nome", sourcePath: "clients.name", dataType: "text", classification: "internal", exportable: true, previewable: true, defaultSelected: true, module: "Clientes", group: "Dados Gerais" }),
  field({ key: "cnpj", label: "CNPJ", sourcePath: "clients.cnpj", dataType: "text", classification: "sensitive", exportable: true, previewable: true, module: "Clientes", group: "Dados Gerais" }),
  field({ key: "regime", label: "Regime", sourcePath: "clients.regime", dataType: "text", classification: "internal", exportable: true, previewable: true, module: "Clientes", group: "Dados Gerais" }),
  field({ key: "segmento", label: "Segmento", sourcePath: "clients.sector", dataType: "text", classification: "internal", exportable: true, previewable: true, defaultSelected: true, module: "Clientes", group: "Dados Gerais" }),
  field({ key: "status", label: "Status", sourcePath: "clients.status", dataType: "enum", classification: "internal", exportable: true, previewable: true, defaultSelected: true, module: "Clientes", group: "Dados Gerais" }),
  field({ key: "contato", label: "Contato", sourcePath: "clients.contact", dataType: "text", classification: "sensitive", exportable: true, previewable: true, defaultSelected: true, module: "Clientes", group: "Contato" }),
  field({ key: "email", label: "E-mail", sourcePath: "clients.email", dataType: "text", classification: "sensitive", exportable: true, previewable: true, defaultSelected: true, module: "Clientes", group: "Contato" }),
  field({ key: "telefone", label: "Telefone", sourcePath: "clients.phone", dataType: "text", classification: "sensitive", exportable: true, previewable: true, defaultSelected: true, module: "Clientes", group: "Contato" }),
  field({ key: "criado_em", label: "Criado em", sourcePath: "clients.created_at", dataType: "datetime", formatter: "datetime", classification: "internal", exportable: true, previewable: true, module: "Clientes", group: "Controle" }),
  field({ key: "atualizado_em", label: "Atualizado em", sourcePath: "clients.updated_at", dataType: "datetime", formatter: "datetime", classification: "internal", exportable: true, previewable: true, module: "Clientes", group: "Controle" }),
  ...clientDataReportFields.map((definition) =>
    field({
      ...definition,
      defaultSelected: [
        "cadastral_cadastro_clientes_nome_fantasia",
        "cadastral_cadastro_clientes_regime_tributario",
      ].includes(definition.key),
    }),
  ),
  ...clientPartnerReportFields.map((definition) =>
    field({
      ...definition,
      defaultSelected: [
        "cadastral_cadastro_clientes_socios_quantidade",
        "cadastral_cadastro_clientes_socios_pro_labore_total",
      ].includes(definition.key),
    }),
  ),
];

const leadFields: ReportFieldDefinition[] = [
  field({ key: "oportunidade", label: "Oportunidade", sourcePath: "crm_leads.name", dataType: "text", classification: "sensitive", exportable: true, previewable: true, defaultSelected: true, module: "Leads e Vendas", group: "Identificacao" }),
  field({ key: "cliente", label: "Cliente vinculado", sourcePath: "crm_leads.client_id", dataType: "text", classification: "sensitive", exportable: true, previewable: true, module: "Leads e Vendas", group: "Identificacao" }),
  field({ key: "contato", label: "Contato", sourcePath: "crm_leads.contact", dataType: "text", classification: "sensitive", exportable: true, previewable: true, defaultSelected: true, module: "Leads e Vendas", group: "Contato" }),
  field({ key: "email", label: "E-mail", sourcePath: "crm_leads.email", dataType: "text", classification: "sensitive", exportable: true, previewable: true, module: "Leads e Vendas", group: "Contato" }),
  field({ key: "telefone", label: "Telefone", sourcePath: "crm_leads.phone", dataType: "text", classification: "sensitive", exportable: true, previewable: true, module: "Leads e Vendas", group: "Contato" }),
  field({ key: "tipo_venda", label: "Tipo de venda", sourcePath: "crm_leads.sale_type", dataType: "enum", classification: "internal", exportable: true, previewable: true, defaultSelected: true, module: "Leads e Vendas", group: "Pipeline" }),
  field({ key: "oferta", label: "Oferta", sourcePath: "crm_leads.offer_id", dataType: "text", classification: "internal", exportable: true, previewable: true, module: "Leads e Vendas", group: "Pipeline" }),
  field({ key: "oferta_outro", label: "Oferta outro", sourcePath: "crm_leads.other_offer_description", dataType: "text", classification: "internal", exportable: true, previewable: true, module: "Leads e Vendas", group: "Pipeline" }),
  field({ key: "valor", label: "Valor estimado", sourcePath: "crm_leads.estimated_value", dataType: "currency", formatter: "currency", classification: "internal", exportable: true, previewable: true, defaultSelected: true, module: "Leads e Vendas", group: "Pipeline" }),
  field({ key: "recorrencia", label: "Recorrencia", sourcePath: "crm_leads.recurrence_type", dataType: "enum", classification: "internal", exportable: true, previewable: true, module: "Leads e Vendas", group: "Pipeline" }),
  field({ key: "etapa", label: "Etapa", sourcePath: "crm_leads.stage", dataType: "enum", classification: "internal", exportable: true, previewable: true, defaultSelected: true, module: "Leads e Vendas", group: "Pipeline" }),
  field({ key: "status", label: "Status", sourcePath: "crm_leads.status", dataType: "enum", classification: "internal", exportable: true, previewable: true, defaultSelected: true, module: "Leads e Vendas", group: "Pipeline" }),
  field({ key: "responsavel", label: "Responsavel", sourcePath: "crm_leads.owner_user_id", dataType: "text", classification: "internal", exportable: true, previewable: true, module: "Leads e Vendas", group: "Pipeline" }),
  field({ key: "origem", label: "Origem", sourcePath: "crm_leads.source", dataType: "text", classification: "internal", exportable: true, previewable: true, module: "Leads e Vendas", group: "Origem" }),
  field({ key: "previsao_fechamento", label: "Previsao de fechamento", sourcePath: "crm_leads.expected_close_date", dataType: "date", formatter: "date", classification: "internal", exportable: true, previewable: true, module: "Leads e Vendas", group: "Controle" }),
  field({ key: "criado_em", label: "Criado em", sourcePath: "crm_leads.created_at", dataType: "datetime", formatter: "datetime", classification: "internal", exportable: true, previewable: true, defaultSelected: true, module: "Leads e Vendas", group: "Controle" }),
];

const taskFields: ReportFieldDefinition[] = [
  field({ key: "titulo", label: "Titulo", sourcePath: "kanban_tasks.title", dataType: "text", classification: "internal", exportable: true, previewable: true, defaultSelected: true, module: "Tarefas", group: "Execucao" }),
  field({ key: "cliente", label: "Cliente", sourcePath: "kanban_tasks.client_name", dataType: "text", classification: "sensitive", exportable: true, previewable: true, defaultSelected: true, module: "Tarefas", group: "Execucao" }),
  field({ key: "responsavel", label: "Responsavel", sourcePath: "kanban_tasks.assignee", dataType: "text", classification: "internal", exportable: true, previewable: true, defaultSelected: true, module: "Tarefas", group: "Execucao" }),
  field({ key: "setor", label: "Setor", sourcePath: "kanban_tasks.sector", dataType: "text", classification: "internal", exportable: true, previewable: true, defaultSelected: true, module: "Tarefas", group: "Execucao" }),
  field({ key: "prioridade", label: "Prioridade", sourcePath: "kanban_tasks.priority", dataType: "enum", classification: "internal", exportable: true, previewable: true, defaultSelected: true, module: "Tarefas", group: "Execucao" }),
  field({ key: "status", label: "Status", sourcePath: "kanban_tasks.status", dataType: "enum", classification: "internal", exportable: true, previewable: true, defaultSelected: true, module: "Tarefas", group: "Execucao" }),
  field({ key: "prazo", label: "Prazo", sourcePath: "kanban_tasks.due_date", dataType: "date", formatter: "date", classification: "internal", exportable: true, previewable: true, defaultSelected: true, module: "Tarefas", group: "Prazos" }),
  field({ key: "criado_em", label: "Criado em", sourcePath: "kanban_tasks.created_at", dataType: "datetime", formatter: "datetime", classification: "internal", exportable: true, previewable: true, module: "Tarefas", group: "Controle" }),
  field({ key: "atualizado_em", label: "Atualizado em", sourcePath: "kanban_tasks.updated_at", dataType: "datetime", formatter: "datetime", classification: "internal", exportable: true, previewable: true, module: "Tarefas", group: "Controle" }),
];

const teamFields: ReportFieldDefinition[] = [
  field({ key: "colaborador", label: "Colaborador", sourcePath: "profiles.display_name", dataType: "text", classification: "sensitive", exportable: true, previewable: true, defaultSelected: true, module: "Equipe", group: "Identificacao", minimumRoles: [...internalManagementRoles] }),
  field({ key: "papel", label: "Papel", sourcePath: "organization_user_access.primary_role", dataType: "text", formatter: "role", classification: "sensitive", exportable: true, previewable: true, defaultSelected: true, module: "Equipe", group: "Permissoes", minimumRoles: [...internalManagementRoles] }),
  field({ key: "setor", label: "Setor", sourcePath: "organization_user_access.sector_code", dataType: "text", classification: "internal", exportable: true, previewable: true, module: "Equipe", group: "Permissoes", minimumRoles: [...internalManagementRoles] }),
  field({ key: "status", label: "Status", sourcePath: "organization_user_access.status", dataType: "enum", classification: "internal", exportable: true, previewable: true, module: "Equipe", group: "Permissoes", minimumRoles: [...internalManagementRoles] }),
  field({ key: "modulos", label: "Modulos", sourcePath: "user_module_grants.module_key", dataType: "text", classification: "sensitive", exportable: true, previewable: true, module: "Equipe", group: "Permissoes", minimumRoles: [...internalManagementRoles] }),
  field({ key: "usuario_id", label: "Usuario ID", sourcePath: "profiles.user_id", dataType: "text", classification: "sensitive", exportable: true, previewable: true, defaultSelected: true, module: "Equipe", group: "Identificacao", minimumRoles: [...internalManagementRoles] }),
  field({ key: "criado_em", label: "Criado em", sourcePath: "profiles.created_at", dataType: "datetime", formatter: "datetime", classification: "internal", exportable: true, previewable: true, defaultSelected: true, module: "Equipe", group: "Controle", minimumRoles: [...internalManagementRoles] }),
  field({ key: "atualizado_em", label: "Atualizado em", sourcePath: "profiles.updated_at", dataType: "datetime", formatter: "datetime", classification: "internal", exportable: true, previewable: true, defaultSelected: true, module: "Equipe", group: "Controle", minimumRoles: [...internalManagementRoles] }),
  field({ key: "papel_definido_em", label: "Papel definido em", sourcePath: "organization_user_access.created_at", dataType: "datetime", formatter: "datetime", classification: "sensitive", exportable: true, previewable: true, module: "Equipe", group: "Permissoes", minimumRoles: [...internalManagementRoles] }),
];

function dataset(definition: Omit<ReportDatasetDefinition, "classification">): ReportDatasetDefinition {
  return {
    ...definition,
    classification: maxReportClassification(definition.fields.map((fieldDefinition) => fieldDefinition.classification)),
  };
}

export const reportCatalog = [
  dataset({
    id: "clientes",
    name: "Clientes",
    description: "Carteira de clientes, contatos e dados cadastrais aprovados para relatorios internos.",
    sourceOwner: "Operacao e Cadastro",
    sourceTablesOrViews: ["clients", "client_data"],
    defaultFilters: ["organization_id", "company"],
    requiredFilters: ["organization_id"],
    defaultSort: "name",
    previewLimit: 50,
    exportLimit: 5000,
    minimumRoles: [...internalOperationalRoles],
    blockedRoles: ["client"],
    enabled: true,
    fields: clientFields,
  }),
  dataset({
    id: "leads_crm",
    name: "Leads e Vendas",
    description: "Oportunidades comerciais, pipeline, valores, status e dados de contato permitidos.",
    sourceOwner: "Comercial",
    sourceTablesOrViews: ["crm_leads", "crm_commercial_offers"],
    defaultFilters: ["organization_id", "company", "competence"],
    requiredFilters: ["organization_id"],
    defaultSort: "created_at_desc",
    previewLimit: 50,
    exportLimit: 5000,
    minimumRoles: ["admin", "director", "manager", "commercial"],
    blockedRoles: ["client"],
    enabled: true,
    fields: leadFields,
  }),
  dataset({
    id: "tarefas",
    name: "Tarefas",
    description: "Produtividade operacional por cliente, setor, responsavel, status e prazo.",
    sourceOwner: "Operacao",
    sourceTablesOrViews: ["kanban_tasks"],
    defaultFilters: ["organization_id", "company", "competence", "sector", "assignee"],
    requiredFilters: ["organization_id"],
    defaultSort: "created_at_desc",
    previewLimit: 50,
    exportLimit: 5000,
    minimumRoles: ["admin", "director", "manager", "employee", "partner", "departamento_pessoal", "fiscal", "contabil"],
    blockedRoles: ["client"],
    enabled: true,
    fields: taskFields,
  }),
  dataset({
    id: "equipe",
    name: "Equipe",
    description: "Usuarios internos, papeis e datas de controle.",
    sourceOwner: "Administracao",
    sourceTablesOrViews: ["profiles", "organization_user_access", "user_module_grants"],
    defaultFilters: ["organization_id", "competence"],
    requiredFilters: ["organization_id"],
    defaultSort: "display_name",
    previewLimit: 50,
    exportLimit: 1000,
    minimumRoles: [...internalManagementRoles],
    blockedRoles: ["client", "commercial", "employee", "departamento_pessoal", "fiscal", "contabil"],
    enabled: true,
    fields: teamFields,
  }),
] satisfies ReportDatasetDefinition[];

export const reportCatalogById = new Map<ReportDatasetId, ReportDatasetDefinition>(
  reportCatalog.map((definition) => [definition.id, definition]),
);

export function getReportDataset(datasetId: ReportDatasetId) {
  return reportCatalogById.get(datasetId) || null;
}

export function getDefaultReportColumns(datasetId: ReportDatasetId) {
  return getReportDataset(datasetId)?.fields.filter((field) => field.defaultSelected && field.previewable).map((field) => field.key) || [];
}
