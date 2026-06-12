import { describe, expect, it } from "vitest";
import { filterReportFields } from "@/lib/reports/fieldSearch";
import { createLargeReportFields } from "../../fixtures/reports/largeReportFixtures";

describe("report field search performance guard", () => {
  it("filters 500 fields within an interactive budget", () => {
    const fields = createLargeReportFields(500);
    const startedAt = performance.now();
    const result = filterReportFields(fields, "Campo 49");
    const elapsed = performance.now() - startedAt;

    expect(result.length).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(1000);
  });
});
