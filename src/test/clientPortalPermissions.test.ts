import { describe, expect, it } from "vitest";

import { canAccessModule, type EffectiveAccess } from "@/lib/userPermissions";
import { buildPortalDataQueryKey, resolveSelectedPortalClient } from "@/lib/portalClientScope";

describe("client portal permissions", () => {
  const clientAccess: EffectiveAccess = {
    organizationId: "00000000-0000-4000-8000-000000000001",
    userId: "00000000-0000-4000-8000-000000000002",
    primaryRole: "cliente",
    status: "active",
    sectorCode: null,
    enabledModules: [],
    activeClientIds: [
      "00000000-0000-4000-8000-000000000010",
      "00000000-0000-4000-8000-000000000011",
    ],
    requiresAccessReview: false,
  };

  it("keeps multiple explicit client links", () => {
    expect(clientAccess.activeClientIds).toHaveLength(2);
  });

  it("never grants internal modules to cliente users", () => {
    expect(canAccessModule(clientAccess, "tarefas")).toBe(false);
    expect(canAccessModule(clientAccess, "usuarios")).toBe(false);
  });

  it("fails closed while access is under review", () => {
    expect(
      canAccessModule(
        { ...clientAccess, primaryRole: "colaborador", enabledModules: ["tarefas"], requiresAccessReview: true },
        "tarefas",
      ),
    ).toBe(false);
  });

  it("scopes portal query cache by selected linked client", () => {
    expect(buildPortalDataQueryKey(clientAccess.userId, clientAccess.activeClientIds[0], "cliente")).toEqual([
      "portal-cliente",
      clientAccess.userId,
      clientAccess.activeClientIds[0],
      "cliente",
    ]);
    expect(buildPortalDataQueryKey(clientAccess.userId, clientAccess.activeClientIds[1], "cliente")).not.toEqual(
      buildPortalDataQueryKey(clientAccess.userId, clientAccess.activeClientIds[0], "cliente"),
    );
  });

  it("keeps selection inside the active linked-client set", () => {
    const clients = [
      { id: clientAccess.activeClientIds[0], name: "Cliente A" },
      { id: clientAccess.activeClientIds[1], name: "Cliente B" },
    ];

    expect(resolveSelectedPortalClient(clients, clientAccess.activeClientIds[1], clientAccess.activeClientIds[0])?.name).toBe(
      "Cliente B",
    );
    expect(resolveSelectedPortalClient(clients, "revoked-client", clientAccess.activeClientIds[0])?.name).toBe(
      "Cliente A",
    );
    expect(resolveSelectedPortalClient(clients, "revoked-client", "missing-client")?.name).toBe("Cliente A");
  });
});
