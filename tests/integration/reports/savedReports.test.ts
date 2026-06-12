import { describe, expect, it } from "vitest";
import { reportCatalogById } from "@/lib/reports/catalog";
import { buildSavedReportConflictKey, normalizeSavedReportName, validateSavedReportColumns } from "@/lib/reports/savedReports";

describe("saved report model integration rules", () => {
  it("uses organization, user, dataset and normalized name for duplicate detection", () => {
    const first = buildSavedReportConflictKey({
      organizationId: "org-1",
      userId: "user-1",
      datasetId: "clientes",
      name: "Relatorio Mensal",
    });
    const second = buildSavedReportConflictKey({
      organizationId: "org-1",
      userId: "user-1",
      datasetId: "clientes",
      name: "  relatório   mensal ",
    });

    expect(first).toBe(second);
    expect(normalizeSavedReportName("  relatório   mensal ")).toBe("relatorio mensal");
  });

  it("validates a saved model against the governed catalog before loading", () => {
    const dataset = reportCatalogById.get("clientes");
    expect(dataset).toBeTruthy();

    const result = validateSavedReportColumns(dataset!, ["nome", "campo_removido"]);

    expect(result.validColumnKeys).toEqual(["nome"]);
    expect(result.warnings).toEqual([{ columnKey: "campo_removido", reason: "unknown" }]);
  });
});
