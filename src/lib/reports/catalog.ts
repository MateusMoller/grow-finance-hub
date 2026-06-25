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
  field({ key: "nome", label: "Nome", sourcePath: "site_leads.full_name", dataType: "text", classification: "sensitive", exportable: true, previewable: true, defaultSelected: true, module: "Leads e CRM", group: "Identificacao" }),
  field({ key: "empresa", label: "Empresa", sourcePath: "site_leads.company_name", dataType: "text", classification: "internal", exportable: true, previewable: true, defaultSelected: true, module: "Leads e CRM", group: "Identificacao" }),
  field({ key: "email", label: "E-mail", sourcePath: "site_leads.email", dataType: "text", classification: "sensitive", exportable: true, previewable: true, defaultSelected: true, module: "Leads e CRM", group: "Contato" }),
  field({ key: "telefone", label: "Telefone", sourcePath: "site_leads.phone", dataType: "text", classification: "sensitive", exportable: true, previewable: true, defaultSelected: true, module: "Leads e CRM", group: "Contato" }),
  field({ key: "origem", label: "Origem", sourcePath: "site_leads.source_tag", dataType: "text", classification: "internal", exportable: true, previewable: true, defaultSelected: true, module: "Leads e CRM", group: "Origem" }),
  field({ key: "pagina_origem", label: "Pagina de origem", sourcePath: "site_leads.origin_page", dataType: "text", classification: "internal", exportable: true, previewable: true, module: "Leads e CRM", group: "Origem" }),
  field({ key: "criado_em", label: "Criado em", sourcePath: "site_leads.created_at", dataType: "datetime", formatter: "datetime", classification: "internal", exportable: true, previewable: true, defaultSelected: true, module: "Leads e CRM", group: "Controle" }),
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
  field({ key: "papel", label: "Papel", sourcePath: "user_roles.role", dataType: "text", formatter: "role", classification: "sensitive", exportable: true, previewable: true, defaultSelected: true, module: "Equipe", group: "Permissoes", minimumRoles: [...internalManagementRoles] }),
  field({ key: "usuario_id", label: "Usuario ID", sourcePath: "profiles.user_id", dataType: "text", classification: "sensitive", exportable: true, previewable: true, defaultSelected: true, module: "Equipe", group: "Identificacao", minimumRoles: [...internalManagementRoles] }),
  field({ key: "criado_em", label: "Criado em", sourcePath: "profiles.created_at", dataType: "datetime", formatter: "datetime", classification: "internal", exportable: true, previewable: true, defaultSelected: true, module: "Equipe", group: "Controle", minimumRoles: [...internalManagementRoles] }),
  field({ key: "atualizado_em", label: "Atualizado em", sourcePath: "profiles.updated_at", dataType: "datetime", formatter: "datetime", classification: "internal", exportable: true, previewable: true, defaultSelected: true, module: "Equipe", group: "Controle", minimumRoles: [...internalManagementRoles] }),
  field({ key: "papel_definido_em", label: "Papel definido em", sourcePath: "user_roles.created_at", dataType: "datetime", formatter: "datetime", classification: "sensitive", exportable: true, previewable: true, module: "Equipe", group: "Permissoes", minimumRoles: [...internalManagementRoles] }),
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
    name: "Leads e CRM",
    description: "Leads capturados e origem comercial com dados de contato permitidos.",
    sourceOwner: "Comercial",
    sourceTablesOrViews: ["site_leads"],
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
    sourceTablesOrViews: ["profiles", "user_roles"],
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
