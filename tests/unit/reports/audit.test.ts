import { describe, expect, it } from "vitest";
import { buildReportAuditMetadata } from "@/lib/reports/audit";
import { normalizeReportFilters } from "@/lib/reports/filters";

describe("buildReportAuditMetadata", () => {
  it("keeps report metadata without row content and redacts sensitive filter keys", () => {
    const metadata = buildReportAuditMetadata({
      datasetId: "clientes",
      filters: { ...normalizeReportFilters({ organizationId: "org", company: "Grow" }), token: "secret" } as never,
      columnKeys: ["nome", "email"],
      rowCount: 10,
      format: "xlsx",
      classification: "sensitive",
      failureCode: "blocked",
    });

    expect(metadata).toMatchObject({
      dataset_id: "clientes",
      column_keys: ["nome", "email"],
      row_count: 10,
      format: "xlsx",
      classification: "sensitive",
      failure_code: "blocked",
    });
    expect(Object.values(metadata.filters)).not.toContain("secret");
  });
});
