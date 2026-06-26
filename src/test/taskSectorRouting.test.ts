import { describe, expect, it } from "vitest";

import {
  canCreateTaskInSector,
  canViewTaskByCanonicalScope,
  getCanonicalTaskSectorAccess,
} from "@/lib/taskSectorAccess";
import type { EffectiveAccess } from "@/lib/userPermissions";

const collaborator: EffectiveAccess = {
  organizationId: "00000000-0000-4000-8000-000000000001",
  userId: "00000000-0000-4000-8000-000000000002",
  primaryRole: "colaborador",
  status: "active",
  sectorCode: "fiscal",
  enabledModules: ["tarefas"],
  activeClientIds: [],
  requiresAccessReview: false,
};

describe("canonical task sector routing", () => {
  it("limits task creation to the collaborator sector", () => {
    expect(canCreateTaskInSector("Fiscal", collaborator)).toBe(true);
    expect(canCreateTaskInSector("Financeiro", collaborator)).toBe(false);
  });

  it("allows admins to create tasks in every fixed sector", () => {
    expect(
      canCreateTaskInSector("Financeiro", {
        ...collaborator,
        primaryRole: "admin",
        sectorCode: null,
        enabledModules: [],
      }),
    ).toBe(true);
  });

  it("returns one visible creation sector for a collaborator", () => {
    expect(getCanonicalTaskSectorAccess(collaborator)).toEqual({
      canAccessAllTaskSectors: false,
      allowedTaskSectors: ["Fiscal"],
    });
  });

  it("allows matching sector tasks and one direct cross-sector assignment", () => {
    expect(canViewTaskByCanonicalScope({ sector: "Fiscal" }, collaborator)).toBe(true);
    expect(
      canViewTaskByCanonicalScope(
        { sector: "Financeiro", assignedToUserId: collaborator.userId },
        collaborator,
      ),
    ).toBe(true);
    expect(canViewTaskByCanonicalScope({ sector: "Financeiro", assignedToUserId: null }, collaborator)).toBe(false);
  });

  it("requires active status, review clearance and Tasks module for colaboradores", () => {
    expect(canViewTaskByCanonicalScope({ sector: "Fiscal" }, { ...collaborator, status: "suspended" })).toBe(false);
    expect(
      canViewTaskByCanonicalScope(
        { sector: "Fiscal" },
        { ...collaborator, requiresAccessReview: true },
      ),
    ).toBe(false);
    expect(canViewTaskByCanonicalScope({ sector: "Fiscal" }, { ...collaborator, enabledModules: [] })).toBe(false);
  });
});
