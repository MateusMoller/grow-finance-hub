import { describe, expect, it } from "vitest";
import { reportCatalog } from "@/lib/reports/catalog";

describe("report catalog contract", () => {
  it("defines required governance metadata for every dataset", () => {
    expect(reportCatalog.map((dataset) => dataset.id).sort()).toEqual(["clientes", "equipe", "leads_crm", "tarefas"]);
    reportCatalog.forEach((dataset) => {
      expect(dataset.sourceOwner).toBeTruthy();
      expect(dataset.sourceTablesOrViews.length).toBeGreaterThan(0);
      expect(dataset.requiredFilters).toContain("organization_id");
      expect(dataset.fields.every((field) => field.classification)).toBe(true);
    });
  });
});
