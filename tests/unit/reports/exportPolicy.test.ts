import { describe, expect, it } from "vitest";
import { reportCatalogById } from "@/lib/reports/catalog";
import { evaluateReportExport, requiresBackendReportExport } from "@/lib/reports/exportPolicy";

describe("report export policy", () => {
  it("blocks prohibited fields", () => {
    const dataset = reportCatalogById.get("clientes")!;
    const field = dataset.fields.find((item) => item.classification === "prohibited")!;
    const result = evaluateReportExport({ dataset, fields: [field], rowCount: 1 });

    expect(result.status).toBe("blocked");
    expect(result.reason).toBe("prohibited_field");
  });

  it("requires backend export for sensitive fields", () => {
    const dataset = reportCatalogById.get("clientes")!;
    const field = dataset.fields.find((item) => item.classification === "sensitive")!;

    expect(requiresBackendReportExport({ dataset, fields: [field], rowCount: 1 })).toBe(true);
  });
});
