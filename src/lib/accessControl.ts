export const INTERNAL_ROLE_LIST = [
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

export const DEPARTMENT_ROLE_LIST = [
  "departamento_pessoal",
  "fiscal",
  "contabil",
] as const;

export const CLIENT_ROLE = "client" as const;

const internalRoleSet = new Set<string>(INTERNAL_ROLE_LIST);
const departmentRoleSet = new Set<string>(DEPARTMENT_ROLE_LIST);
const elevatedInternalRoleSet = new Set<string>(
  INTERNAL_ROLE_LIST.filter((role) => !departmentRoleSet.has(role)),
);

export const rolePriority: string[] = [
  ...INTERNAL_ROLE_LIST,
  CLIENT_ROLE,
];

export const normalizeRole = (role: string | null | undefined) => String(role || "").trim().toLowerCase();

type RoleLike = string | null | undefined;
type RoleListLike = readonly RoleLike[] | null | undefined;

export const normalizeRoles = (roles: RoleListLike) =>
  Array.from(new Set((roles ?? []).map((role) => normalizeRole(role)).filter(Boolean)));

export const isInternalRole = (role: RoleLike) => internalRoleSet.has(normalizeRole(role));

export const hasAnyInternalRole = (roles: RoleListLike) =>
  (roles ?? []).some((role) => internalRoleSet.has(normalizeRole(role)));

export const hasAnyDepartmentRole = (roles: RoleListLike) =>
  (roles ?? []).some((role) => departmentRoleSet.has(normalizeRole(role)));

export const hasClientRole = (roles: RoleListLike) =>
  (roles ?? []).some((role) => normalizeRole(role) === CLIENT_ROLE);

export const isDepartmentOnlyUser = (roles: RoleListLike) => {
  const normalized = normalizeRoles(roles);
  const hasDepartment = normalized.some((role) => departmentRoleSet.has(role));
  const hasElevatedInternal = normalized.some((role) => elevatedInternalRoleSet.has(role));
  return hasDepartment && !hasElevatedInternal;
};

export const hasPortalAccessRole = (roles: RoleListLike) => hasClientRole(roles) || hasAnyInternalRole(roles);

export const getPrimaryRole = (roles: RoleListLike) => {
  const normalized = normalizeRoles(roles);
  if (normalized.length === 0) return null;

  for (const priorityRole of rolePriority) {
    if (normalized.includes(priorityRole)) return priorityRole;
  }

  return normalized[0] ?? null;
};
