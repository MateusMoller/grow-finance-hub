import { describe, expect, it } from "vitest";
import { buildReportPreview } from "@/lib/reports/previewService";
import { reportCatalogById } from "@/lib/reports/catalog";

describe("independent dataset failure behavior", () => {
  it("builds a preview for one dataset without requiring another dataset result", () => {
    const dataset = reportCatalogById.get("tarefas")!;
    const preview = buildReportPreview({
      dataset,
      roles: ["admin"],
      columnKeys: ["titulo", "status"],
      rows: [{ id: "task-1", titulo: "Enviar guia", status: "aberta" }],
    });

    expect(preview.rows).toHaveLength(1);
    expect(preview.columns.map((column) => column.key)).toEqual(["titulo", "status"]);
  });
});
