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

  it("keeps the complete editable client field catalog available", () => {
    const clients = reportCatalog.find((dataset) => dataset.id === "clientes")!;
    const availableFields = clients.fields.filter((field) => field.previewable && field.exportable);

    expect(availableFields.length).toBeGreaterThanOrEqual(95);
    expect(availableFields.some((field) => field.key === "cadastral_cadastro_fiscal_emite_nfe")).toBe(true);
    expect(availableFields.some((field) => field.key === "cadastral_cadastro_departamento_pessoal_sindicato_nome")).toBe(true);
    expect(availableFields.some((field) => field.key === "cadastral_cadastro_honorarios_valor_mensal")).toBe(true);
  });
});
