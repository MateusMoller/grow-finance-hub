import { describe, expect, it } from "vitest";

import {
  canAccessModule,
  ensureCollaboratorModules,
  normalizeSectorCode,
  resolveRouteModule,
} from "@/lib/userPermissions";
import { mapLegacyRoleToCanonical } from "@/lib/accessControl";

describe("user permissions", () => {
  it("normalizes every fixed sector family", () => {
    expect(normalizeSectorCode("Contábil")).toBe("contabil");
    expect(normalizeSectorCode("Departamento Pessoal")).toBe("departamento_pessoal");
    expect(normalizeSectorCode("Societário")).toBe("societario");
  });

  it("always includes tasks for colaboradores", () => {
    expect(ensureCollaboratorModules(["obrigacoes"])).toEqual(["tarefas", "obrigacoes"]);
    expect(ensureCollaboratorModules(["tarefas", "tarefas"])).toEqual(["tarefas"]);
  });

  it("maps legacy roles to canonical roles", () => {
    expect(mapLegacyRoleToCanonical(["admin"])).toBe("admin");
    expect(mapLegacyRoleToCanonical(["fiscal"])).toBe("colaborador");
    expect(mapLegacyRoleToCanonical(["client"])).toBe("cliente");
  });

  it("resolves route modules and denies disabled modules", () => {
    expect(resolveRouteModule("/app/clientes/123")).toBe("clientes");
    expect(resolveRouteModule("/app/tarefas")).toBe("tarefas");
    expect(
      canAccessModule(
        {
          primaryRole: "colaborador",
          status: "active",
          enabledModules: ["tarefas"],
          requiresAccessReview: false,
        },
        "obrigacoes",
      ),
    ).toBe(false);
  });
});
