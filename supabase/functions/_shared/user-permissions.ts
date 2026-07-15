export const PRIMARY_ROLES = ["admin", "colaborador", "cliente"] as const;
export const USER_STATUSES = ["pending", "active", "suspended", "inactive"] as const;
export const SECTOR_CODES = [
  "contabil",
  "fiscal",
  "departamento_pessoal",
  "comercial",
  "societario",
  "geral",
] as const;
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
  "newsletter",
  "sugestoes",
  "configuracoes",
] as const;

export type PrimaryRole = (typeof PRIMARY_ROLES)[number];
export type UserStatus = (typeof USER_STATUSES)[number];
export type SectorCode = (typeof SECTOR_CODES)[number];
export type ModuleKey = (typeof MODULE_KEYS)[number];
export type JsonRecord = Record<string, unknown>;

export interface ApplyUserAccessPayload {
  organizationId: string;
  targetUserId: string;
  displayName: string;
  primaryRole: PrimaryRole;
  status: UserStatus;
  sectorCode: SectorCode | null;
  enabledModules: ModuleKey[];
  linkedClientIds: string[];
  changeReason: string;
}

const primaryRoleSet = new Set<string>(PRIMARY_ROLES);
const statusSet = new Set<string>(USER_STATUSES);
const sectorSet = new Set<string>(SECTOR_CODES);
const moduleSet = new Set<string>(MODULE_KEYS);
const rpcManagedModuleSet = new Set<string>(
  MODULE_KEYS.filter((moduleKey) => moduleKey !== "cadastrar_clientes"),
);

export const asRecord = (value: unknown): JsonRecord | null =>
  value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : null;

export const asTrimmedString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
};

export const asUuid = (value: unknown): string | null => {
  const text = asTrimmedString(value);
  return text && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text)
    ? text
    : null;
};

export const asPrimaryRole = (value: unknown): PrimaryRole | null => {
  const role = asTrimmedString(value)?.toLowerCase();
  return role && primaryRoleSet.has(role) ? role as PrimaryRole : null;
};

export const asUserStatus = (value: unknown): UserStatus | null => {
  const status = asTrimmedString(value)?.toLowerCase();
  return status && statusSet.has(status) ? status as UserStatus : null;
};

export const asSectorCode = (value: unknown): SectorCode | null => {
  const sector = asTrimmedString(value)?.toLowerCase();
  return sector && sectorSet.has(sector) ? sector as SectorCode : null;
};

export const asModuleKeys = (value: unknown): ModuleKey[] => {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .map((item) => asTrimmedString(item)?.toLowerCase())
        .filter((item): item is ModuleKey => Boolean(item && moduleSet.has(item))),
    ),
  );
};

export const normalizeModulesForRole = (role: PrimaryRole, modules: unknown): ModuleKey[] => {
  if (role !== "colaborador") return [];
  return Array.from(new Set<ModuleKey>(["tarefas", ...asModuleKeys(modules)]));
};

export const normalizeRpcModulesForRole = (role: PrimaryRole, modules: unknown): ModuleKey[] =>
  normalizeModulesForRole(role, modules).filter((moduleKey) => rpcManagedModuleSet.has(moduleKey));

export const applyUserAccessTransaction = async (
  supabaseUser: { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }> },
  payload: ApplyUserAccessPayload,
) => {
  const { data, error } = await supabaseUser.rpc("admin_apply_user_access", {
    _organization_id: payload.organizationId,
    _target_user_id: payload.targetUserId,
    _display_name: payload.displayName,
    _primary_role: payload.primaryRole,
    _status: payload.status,
    _sector_code: payload.primaryRole === "colaborador" ? payload.sectorCode : null,
    _enabled_modules: normalizeRpcModulesForRole(payload.primaryRole, payload.enabledModules),
    _linked_client_ids: payload.primaryRole === "cliente" ? payload.linkedClientIds : [],
    _change_reason: payload.changeReason,
  });

  if (error) throw error;
  const result = asRecord(data);
  if (result?.ok === false) {
    throw new Error(asTrimmedString(result.code) || "permission_update_denied");
  }
  return data;
};

export const extractBearerToken = (request: Request): string | null => {
  const authorization = request.headers.get("authorization");
  if (!authorization?.toLowerCase().startsWith("bearer ")) return null;
  return authorization.slice(7).trim() || null;
};

export const jsonResponse = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    },
  });
