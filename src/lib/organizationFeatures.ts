export const organizationFeatureDefaults = {
  portal: true,
  financeiro: true,
  obrigacoes: true,
  ia: true,
  whatsapp: true,
  open_finance: true,
  acessorias: true,
  robo_documentos: true,
  crm: true,
  calendario: true,
  tarefas: true,
  relatorios: true,
  usuarios: true,
  newsletter: true,
} as const;

export type OrganizationFeatureKey = keyof typeof organizationFeatureDefaults;

export const routeFeatureMap: Record<string, OrganizationFeatureKey> = {
  "/app/portal": "portal",
  "/app/financeiro": "financeiro",
  "/app/obrigacoes": "obrigacoes",
  "/app/econtinuo": "obrigacoes",
  "/app/acessorias": "acessorias",
  "/app/crm": "crm",
  "/app/calendario": "calendario",
  "/app/tarefas": "tarefas",
  "/app/kanban": "tarefas",
  "/app/relatorios": "relatorios",
  "/app/usuarios": "usuarios",
  "/app/newsletter": "newsletter",
};

export const normalizeFeatureFlags = (value: unknown) => {
  const source = value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

  return Object.fromEntries(
    Object.entries(organizationFeatureDefaults).map(([key, defaultValue]) => [
      key,
      typeof source[key] === "boolean" ? source[key] : defaultValue,
    ]),
  ) as Record<OrganizationFeatureKey, boolean>;
};
