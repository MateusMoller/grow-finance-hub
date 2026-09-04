export const organizationFeatureDefaults = {
  portal: true,
  obrigacoes: true,
  ia: true,
  whatsapp: true,
  robo_documentos: true,
  crm: true,
  calendario: true,
  tarefas: true,
  relatorios: true,
  usuarios: true,
  solicitacoes: true,
  newsletter: true,
  // Temporarily retired. Kept in the feature schema for future reactivation.
  integra_contador: false,
  notas_fiscais: true,
  integra_parcelamentos: false,
} as const;

export const permissionRolloutDefaults = {
  canonical_user_permissions: false,
} as const;

export type OrganizationFeatureKey = keyof typeof organizationFeatureDefaults;

export const routeFeatureMap: Record<string, OrganizationFeatureKey> = {
  "/app/portal": "portal",
  "/app/obrigacoes": "obrigacoes",
  "/app/econtinuo": "obrigacoes",
  "/app/crm": "crm",
  "/app/whatsapp": "whatsapp",
  "/app/calendario": "calendario",
  "/app/tarefas": "tarefas",
  "/app/kanban": "tarefas",
  "/app/relatorios": "relatorios",
  "/app/usuarios": "usuarios",
  "/app/solicitacoes": "solicitacoes",
  "/app/newsletter": "newsletter",
  "/app/notas-fiscais": "notas_fiscais",
  "/app/parcelamentos": "integra_parcelamentos",
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
