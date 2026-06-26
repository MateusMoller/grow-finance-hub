import {
  applyUserAccessTransaction,
  asModuleKeys,
  asPrimaryRole,
  asSectorCode,
  asUserStatus,
  normalizeModulesForRole,
} from "../_shared/user-permissions.ts";

Deno.test("canonical values are validated before protected mutations", () => {
  if (asPrimaryRole("admin") !== "admin") throw new Error("admin role not accepted");
  if (asPrimaryRole("manager") !== null) throw new Error("legacy role accepted");
  if (asUserStatus("active") !== "active") throw new Error("active status not accepted");
  if (asUserStatus("blocked") !== null) throw new Error("invalid status accepted");
  if (asSectorCode("fiscal") !== "fiscal") throw new Error("fixed sector not accepted");
  if (asSectorCode("livre") !== null) throw new Error("free-text sector accepted");
});

Deno.test("Tasks is the only default collaborator module", () => {
  const modules = normalizeModulesForRole("colaborador", ["obrigacoes", "obrigacoes"]);
  if (JSON.stringify(modules) !== JSON.stringify(["tarefas", "obrigacoes"])) {
    throw new Error(`unexpected modules ${JSON.stringify(modules)}`);
  }
  if (normalizeModulesForRole("cliente", ["tarefas"]).length !== 0) {
    throw new Error("cliente received internal modules");
  }
  if (asModuleKeys(["tarefas", "invalid"]).join(",") !== "tarefas") {
    throw new Error("invalid modules were not filtered");
  }
});

Deno.test("protected access helper calls the canonical transaction RPC", async () => {
  const calls: Array<{ fn: string; args: Record<string, unknown> }> = [];
  const response = await applyUserAccessTransaction(
    {
      rpc: async (fn, args) => {
        calls.push({ fn, args });
        return { data: { ok: true }, error: null };
      },
    },
    {
      organizationId: "00000000-0000-4000-8000-000000000001",
      targetUserId: "00000000-0000-4000-8000-000000000002",
      displayName: "Maria",
      primaryRole: "colaborador",
      status: "active",
      sectorCode: "fiscal",
      enabledModules: ["obrigacoes"],
      linkedClientIds: ["00000000-0000-4000-8000-000000000010"],
      changeReason: "contract test",
    },
  );

  if ((response as { ok?: boolean }).ok !== true) throw new Error("unexpected helper response");
  if (calls[0]?.fn !== "admin_apply_user_access") throw new Error("wrong RPC");
  if (JSON.stringify(calls[0].args._enabled_modules) !== JSON.stringify(["tarefas", "obrigacoes"])) {
    throw new Error("collaborator modules were not normalized");
  }
  if (Array.isArray(calls[0].args._linked_client_ids) && (calls[0].args._linked_client_ids as unknown[]).length > 0) {
    throw new Error("collaborator kept client links");
  }
});

Deno.test("controlled final-Admin denial becomes a safe error", async () => {
  let message = "";
  try {
    await applyUserAccessTransaction(
      {
        rpc: async () => ({ data: { ok: false, code: "last_admin_blocked" }, error: null }),
      },
      {
        organizationId: "00000000-0000-4000-8000-000000000001",
        targetUserId: "00000000-0000-4000-8000-000000000002",
        displayName: "Admin",
        primaryRole: "colaborador",
        status: "active",
        sectorCode: "fiscal",
        enabledModules: ["tarefas"],
        linkedClientIds: [],
        changeReason: "contract test",
      },
    );
  } catch (error) {
    message = error instanceof Error ? error.message : "";
  }

  if (message !== "last_admin_blocked") throw new Error(`unexpected denial ${message}`);
});
