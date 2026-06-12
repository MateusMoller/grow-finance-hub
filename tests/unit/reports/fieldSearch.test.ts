import { describe, expect, it } from "vitest";
import { reportCatalogById } from "@/lib/reports/catalog";
import { filterReportFields, groupReportFields } from "@/lib/reports/fieldSearch";

describe("report field search", () => {
  it("filters fields by normalized label", () => {
    const dataset = reportCatalogById.get("clientes")!;
    const result = filterReportFields(dataset.fields, "pro labore");
    expect(result.some((field) => field.key.includes("pro_labore"))).toBe(true);
  });

  it("groups fields by group metadata", () => {
    const dataset = reportCatalogById.get("clientes")!;
    const groups = groupReportFields(dataset.fields);
    expect(groups.length).toBeGreaterThan(1);
  });
});
