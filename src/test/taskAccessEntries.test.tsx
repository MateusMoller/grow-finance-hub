import { describe, expect, it } from "vitest";
import { decideTaskCapability } from "@/lib/taskPermissions";
import type { EffectiveAccess } from "@/lib/userPermissions";

const access = (organizationId: string): EffectiveAccess => ({ organizationId, userId: "user", status: "active", primaryRole: "colaborador", sectorCode: "fiscal", enabledModules: ["tarefas"], activeClientIds: [], requiresAccessReview: false });

describe("task access entries", () => {
  it.each(["kanban", "lista", "calendario", "url-direta"])("uses the same decision for %s", () => {
    expect(decideTaskCapability(access("org-a"), "task.read", { organizationId: "org-b", sector: "Fiscal" }).reason).toBe("task_not_available");
  });
  it("re-evaluates after organization change", () => {
    const task = { organizationId: "org-a", sector: "Fiscal" };
    expect(decideTaskCapability(access("org-a"), "task.read", task).allowed).toBe(true);
    expect(decideTaskCapability(access("org-b"), "task.read", task).allowed).toBe(false);
  });
});
