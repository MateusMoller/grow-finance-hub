import { describe, expect, it } from "vitest";
import { decideTaskCapability } from "@/lib/taskPermissions";
import type { EffectiveAccess } from "@/lib/userPermissions";

const collaborator: EffectiveAccess = { organizationId: "org-a", userId: "user-a", status: "active", primaryRole: "colaborador", sectorCode: "fiscal", enabledModules: ["tarefas"], activeClientIds: [], requiresAccessReview: false };

describe("task permission matrix", () => {
  it("allows operational action only in the collaborator sector", () => {
    expect(decideTaskCapability(collaborator, "task.change_status", { organizationId: "org-a", sector: "Fiscal" }).allowed).toBe(true);
    expect(decideTaskCapability(collaborator, "task.change_status", { organizationId: "org-a", sector: "Contábil" }).allowed).toBe(false);
  });
  it("denies administrative actions to collaborators", () => {
    expect(decideTaskCapability(collaborator, "task.delete", { organizationId: "org-a", sector: "Fiscal" })).toEqual({ allowed: false, reason: "action_not_allowed" });
  });
  it("denies inactive, review-pending and cross-tenant access", () => {
    expect(decideTaskCapability({ ...collaborator, status: "suspended" }, "task.read", { organizationId: "org-a", sector: "Fiscal" }).reason).toBe("access_inactive");
    expect(decideTaskCapability({ ...collaborator, requiresAccessReview: true }, "task.read", { organizationId: "org-a", sector: "Fiscal" }).reason).toBe("access_review_required");
    expect(decideTaskCapability(collaborator, "task.read", { organizationId: "org-b", sector: "Fiscal" }).reason).toBe("task_not_available");
  });
  it("allows only administrators to restore a logically deleted task", () => {
    const admin: EffectiveAccess = { ...collaborator, primaryRole: "admin", sectorCode: null, enabledModules: [] };
    const deleted = { organizationId: "org-a", sector: "Fiscal", deletedAt: "2026-08-12T00:00:00Z" };
    expect(decideTaskCapability(collaborator, "task.restore", deleted).allowed).toBe(false);
    expect(decideTaskCapability(admin, "task.restore", deleted).allowed).toBe(true);
  });
});
