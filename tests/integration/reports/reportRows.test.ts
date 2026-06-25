import { describe, expect, it } from "vitest";
import { normalizeReportFilters } from "@/lib/reports/filters";
import { buildClientReportRows, buildTaskReportRows } from "@/lib/reports/rowBuilders";

describe("report row builders", () => {
  it("builds client rows with selected company scope", () => {
    const rows = buildClientReportRows(
      [
        { id: "1", name: "Empresa A", status: "ativo" },
        { id: "2", name: "Empresa B", status: "ativo" },
      ],
      [],
      normalizeReportFilters({ organizationId: "org", company: "Empresa A" }),
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].nome).toBe("Empresa A");
  });

  it("builds task rows with sector and competence scope", () => {
    const rows = buildTaskReportRows(
      [
        { id: "1", title: "Fiscal", sector: "fiscal", due_date: "2026-06-10" },
        { id: "2", title: "DP", sector: "dp", due_date: "2026-06-10" },
      ],
      normalizeReportFilters({ organizationId: "org", sector: "fiscal", competence: "2026-06" }),
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].titulo).toBe("Fiscal");
  });

  it("maps every client data entry and summarizes partners without exposing credentials", () => {
    const rows = buildClientReportRows(
      [{ id: "1", name: "Empresa A", status: "ativo" }],
      [
        {
          client_id: "1",
          category: "cadastro_fiscal",
          field_name: "emite_nfe",
          field_value: "sim",
        },
        {
          client_id: "1",
          category: "cadastro_clientes",
          field_name: "socios",
          field_value: JSON.stringify([
            { nome: "Socio A", percentual_participacao: "60", pro_labore: "1500", senha_gov: "segredo" },
            { nome: "Socio B", percentual_participacao: "40", pro_labore: "1000" },
          ]),
        },
      ],
      normalizeReportFilters({ organizationId: "org" }),
    );

    expect(rows[0].cadastral_cadastro_fiscal_emite_nfe).toBe("sim");
    expect(rows[0].cadastral_cadastro_clientes_socios_nomes).toBe("Socio A; Socio B");
    expect(rows[0].cadastral_cadastro_clientes_socios_participacao_total).toBe("100");
    expect(rows[0].cadastral_cadastro_clientes_socios_pro_labore_total).toBe("2500");
    expect(JSON.stringify(rows[0])).not.toContain("segredo");
  });
});
