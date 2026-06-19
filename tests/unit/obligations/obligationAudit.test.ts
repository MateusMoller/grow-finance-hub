import { describe, expect, it } from "vitest";

import { buildObligationAuditMetadata, buildSyncRunAuditSummary } from "@/lib/obligations/obligationAudit";

describe("obligation audit metadata", () => {
  it("redacts sensitive values", () => {
    expect(
      buildObligationAuditMetadata({
        entityType: "regime_load",
        action: "publish",
        before: { token: "secret-token", name: "Draft" },
        after: { name: "Active" },
      }),
    ).toMatchObject({
      before: { token: "[redacted]", name: "Draft" },
      after: { name: "Active" },
    });
  });

  it("marks sync summaries as preserving generated history", () => {
    expect(
      buildSyncRunAuditSummary({
        clientsProcessed: 2,
        profilesCreated: 1,
        profilesReactivated: 0,
        profilesInactivatedFuture: 0,
        profilesSkipped: 1,
        reviewRequired: 0,
      }),
    ).toMatchObject({
      clients_processed: 2,
      generated_history_unchanged: true,
    });
  });
});
