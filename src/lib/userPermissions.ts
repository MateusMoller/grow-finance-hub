export const PRIMARY_ROLES = ["admin", "colaborador", "cliente"] as const;
export type PrimaryRole = (typeof PRIMARY_ROLES)[number];

export const USER_STATUSES = ["pending", "active", "suspended", "inactive"] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const SECTOR_CODES = [
  "contabil",
  "fiscal",
  "departamento_pessoal",
  "comercial",
  "societario",
  "geral",
] as const;
export type SectorCode = (typeof SECTOR_CODES)[number];

export const SECTOR_LABELS: Record<SectorCode, string> = {
  contabil: "Contábil",
  fiscal: "Fiscal",
  departamento_pessoal: "Departamento Pessoal",
  comercial: "Comercial",
  societario: "Societário",
  geral: "Geral",
};

export const MODULE_KEYS = [
  "dashboard",
  "clientes",
  "cadastrar_clientes",
  "obrigacoes",
  "ia",
  "whatsapp",
  "robo_documentos",
  "crm",
  "chat_interno",
  "calendario",
  "tarefas",
  "relatorios",
  "notificacoes",
  "usuarios",
  "solicitacoes",
  "newsletter",
  "sugestoes",
  "configuracoes",
  "notas_fiscais",
] as const;
export type ModuleKey = (typeof MODULE_KEYS)[number];

export const MODULE_LABELS: Record<ModuleKey, string> = {
  dashboard: "Dashboard",
  clientes: "Clientes",
  cadastrar_clientes: "Cadastrar clientes",
  obrigacoes: "Obrigações",
  ia: "IA",
  whatsapp: "WhatsApp",
  robo_documentos: "Robô de documentos",
  crm: "Vendas",
  chat_interno: "Chat interno",
  calendario: "Calendário",
  tarefas: "Tarefas",
  relatorios: "Relatórios",
  notificacoes: "Notificações",
  usuarios: "Usuários",
  solicitacoes: "Solicitações",
  newsletter: "Newsletter",
  sugestoes: "Sugestões",
  configuracoes: "Configurações",
  notas_fiscais: "Notas fiscais",
};

export const DEFAULT_COLLABORATOR_MODULES: readonly ModuleKey[] = ["tarefas"];

export const ROUTE_MODULE_MAP: Record<string, ModuleKey> = {
  "/app": "dashboard",
  "/app/clientes": "clientes",
  "/app/obrigacoes": "obrigacoes",
  "/app/econtinuo": "obrigacoes",
  "/app/crm": "crm",
  "/app/whatsapp": "whatsapp",
  "/app/chat-interno": "chat_interno",
  "/app/calendario": "calendario",
  "/app/tarefas": "tarefas",
  "/app/kanban": "tarefas",
  "/app/relatorios": "relatorios",
  "/app/notificacoes": "notificacoes",
  "/app/usuarios": "usuarios",
  "/app/solicitacoes": "solicitacoes",
  "/app/newsletter": "newsletter",
  "/app/sugestoes": "sugestoes",
  "/app/configuracoes": "configuracoes",
  "/app/notas-fiscais": "notas_fiscais",
};

export interface EffectiveAccess {
  organizationId: string;
  userId: string;
  status: UserStatus;
  primaryRole: PrimaryRole;
  sectorCode: SectorCode | null;
  enabledModules: ModuleKey[];
  activeClientIds: string[];
  requiresAccessReview: boolean;
}

const primaryRoleSet = new Set<string>(PRIMARY_ROLES);
const statusSet = new Set<string>(USER_STATUSES);
const sectorSet = new Set<string>(SECTOR_CODES);
const moduleSet = new Set<string>(MODULE_KEYS);

export const isPrimaryRole = (value: unknown): value is PrimaryRole =>
  typeof value === "string" && primaryRoleSet.has(value);

export const isUserStatus = (value: unknown): value is UserStatus =>
  typeof value === "string" && statusSet.has(value);

export const isSectorCode = (value: unknown): value is SectorCode =>
  typeof value === "string" && sectorSet.has(value);

export const isModuleKey = (value: unknown): value is ModuleKey =>
  typeof value === "string" && moduleSet.has(value);

export const normalizeSectorCode = (value: string | null | undefined): SectorCode | null => {
  const normalized = String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_");

  if (!normalized) return null;
  if (normalized.includes("pessoal") || normalized === "dp") return "departamento_pessoal";
  if (normalized.includes("contab")) return "contabil";
  if (normalized.includes("fiscal")) return "fiscal";
  if (normalized.includes("comer")) return "comercial";
  if (normalized.includes("societ")) return "societario";
  if (normalized.includes("geral")) return "geral";
  return isSectorCode(normalized) ? normalized : null;
};

export const normalizeModuleKeys = (values: readonly unknown[] | null | undefined): ModuleKey[] =>
  Array.from(
    new Set(
      (Array.isArray(values) ? values : [])
        .filter(isModuleKey),
    ),
  );

export const ensureCollaboratorModules = (values: readonly unknown[] | null | undefined): ModuleKey[] =>
  Array.from(new Set<ModuleKey>(["tarefas", ...normalizeModuleKeys(values)]));

export const canAccessModule = (
  access: Pick<EffectiveAccess, "primaryRole" | "status" | "enabledModules" | "requiresAccessReview">,
  moduleKey: ModuleKey,
) => {
  if (access.status !== "active" || access.requiresAccessReview) return false;
  if (access.primaryRole === "admin") return true;
  if (access.primaryRole !== "colaborador") return false;
  return access.enabledModules.includes(moduleKey);
};

export const resolveRouteModule = (pathname: string): ModuleKey | null => {
  const route = Object.keys(ROUTE_MODULE_MAP)
    .sort((left, right) => right.length - left.length)
    .find((candidate) => pathname === candidate || pathname.startsWith(`${candidate}/`));
  return route ? ROUTE_MODULE_MAP[route] : null;
};
