import { describe, expect, it } from "vitest";
import { reportCatalogById } from "@/lib/reports/catalog";
import { buildSavedReportConflictKey, normalizeSavedReportName, validateSavedReportColumns } from "@/lib/reports/savedReports";

describe("saved report helpers", () => {
  it("normalizes names for duplicate detection", () => {
    expect(normalizeSavedReportName(" Clientes Átivos  ")).toBe("clientes ativos");
    expect(buildSavedReportConflictKey({
      organizationId: "org",
      userId: "user",
      datasetId: "clientes",
      name: "Clientes Átivos",
    })).toBe("org:user:clientes:clientes ativos");
  });

  it("keeps valid columns and reports stale/prohibited columns", () => {
    const dataset = reportCatalogById.get("clientes");
    expect(dataset).toBeTruthy();

    const result = validateSavedReportColumns(dataset!, ["nome", "campo_antigo", "cadastral_cadastro_clientes_socios_status_senha_gov"]);

    expect(result.validColumnKeys).toEqual(["nome"]);
    expect(result.warnings.map((warning) => warning.reason)).toEqual(["unknown", "prohibited"]);
  });
});
