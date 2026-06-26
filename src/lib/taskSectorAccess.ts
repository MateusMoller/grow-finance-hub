import { normalizeRoles } from "@/lib/accessControl";
import {
  SECTOR_LABELS,
  normalizeSectorCode,
  type EffectiveAccess,
} from "@/lib/userPermissions";

const ALL_TASK_SECTOR_ROLES = new Set(["admin"]);

const TASK_SECTORS_BY_ROLE: Record<string, string[]> = {
  contabil: ["Contabil"],
  fiscal: ["Fiscal"],
  departamento_pessoal: ["Departamento Pessoal"],
  commercial: ["Comercial"],
  employee: ["Geral"],
};

const normalizeTaskSectorToken = (value: string | null | undefined) => {
  const normalized = String(value || "")
    .replace(/ContÃƒÆ’Ã‚Â¡bil|ContÃƒÂ¡bil|ContÃ¡bil/gi, "Contabil")
    .replace(/SocietÃƒÆ’Ã‚Â¡rio|SocietÃƒÂ¡rio|SocietÃ¡rio/gi, "Societario")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

  if (normalized.includes("fiscal")) return "fiscal";
  if (normalized.includes("pessoal") || normalized === "dp") return "departamento_pessoal";
  if (normalized.includes("cont")) return "contabil";
  if (normalized.includes("comer")) return "commercial";
  if (normalized.includes("financ")) return "financeiro";
  if (normalized.includes("societ")) return "societario";
  if (normalized.includes("geral")) return "geral";
  return normalized;
};

export const normalizeTaskSectorLabel = (value: string | null | undefined) => {
  const token = normalizeTaskSectorToken(value);
  if (token === "contabil") return "Contabil";
  if (token === "fiscal") return "Fiscal";
  if (token === "departamento_pessoal") return "Departamento Pessoal";
  if (token === "commercial") return "Comercial";
  if (token === "financeiro") return "Financeiro";
  if (token === "societario") return "Societario";
  if (token === "geral") return "Geral";
  return String(value || "Geral").trim() || "Geral";
};

export const getTaskSectorAccess = (roles: readonly (string | null | undefined)[] | null | undefined) => {
  const normalizedRoles = normalizeRoles(roles);
  const canAccessAllTaskSectors = normalizedRoles.some((role) => ALL_TASK_SECTOR_ROLES.has(role));

  if (canAccessAllTaskSectors) {
    return {
      canAccessAllTaskSectors,
      allowedTaskSectors: [] as string[],
    };
  }

  const allowedTaskSectors = Array.from(
    new Set(normalizedRoles.flatMap((role) => TASK_SECTORS_BY_ROLE[role] || [])),
  );

  return {
    canAccessAllTaskSectors,
    allowedTaskSectors,
  };
};

export const canAccessTaskSector = (
  sector: string | null | undefined,
  roles: readonly (string | null | undefined)[] | null | undefined,
) => {
  const access = getTaskSectorAccess(roles);
  if (access.canAccessAllTaskSectors) return true;

  const sectorToken = normalizeTaskSectorToken(sector);
  return access.allowedTaskSectors.some((allowedSector) => normalizeTaskSectorToken(allowedSector) === sectorToken);
};

export const getCanonicalTaskSectorAccess = (access: EffectiveAccess | null) => {
  if (!access) {
    return {
      canAccessAllTaskSectors: false,
      allowedTaskSectors: [] as string[],
    };
  }
  if (access.primaryRole === "admin") {
    return {
      canAccessAllTaskSectors: true,
      allowedTaskSectors: [] as string[],
    };
  }
  if (access.primaryRole !== "colaborador" || !access.sectorCode) {
    return {
      canAccessAllTaskSectors: false,
      allowedTaskSectors: [] as string[],
    };
  }
  return {
    canAccessAllTaskSectors: false,
    allowedTaskSectors: [SECTOR_LABELS[access.sectorCode]],
  };
};

export const canCreateTaskInSector = (sector: string, access: EffectiveAccess | null) => {
  if (!access || access.status !== "active" || access.requiresAccessReview) return false;
  if (access.primaryRole === "admin") return true;
  return access.primaryRole === "colaborador" &&
    Boolean(access.sectorCode) &&
    normalizeSectorCode(sector) === access.sectorCode;
};

export const canViewTaskByCanonicalScope = (
  task: { sector: string | null; assignedToUserId?: string | null },
  access: EffectiveAccess | null,
) => {
  if (!access || access.status !== "active" || access.requiresAccessReview) return false;
  if (access.primaryRole === "admin") return true;
  if (access.primaryRole !== "colaborador" || !access.enabledModules.includes("tarefas")) return false;

  return (
    (Boolean(access.sectorCode) && normalizeSectorCode(task.sector) === access.sectorCode) ||
    task.assignedToUserId === access.userId
  );
};
