import { describe, expect, it } from "vitest";
import { reportCatalogById } from "@/lib/reports/catalog";
import { evaluateReportExport } from "@/lib/reports/exportPolicy";

describe("report export contract", () => {
  it("blocks requests above dataset export limit", () => {
    const dataset = reportCatalogById.get("equipe")!;
    const fields = dataset.fields.filter((field) => field.exportable).slice(0, 1);
    const result = evaluateReportExport({ dataset, fields, rowCount: dataset.exportLimit + 1 });

    expect(result.status).toBe("blocked");
    expect(result.reason).toBe("export_limit_exceeded");
  });
});
