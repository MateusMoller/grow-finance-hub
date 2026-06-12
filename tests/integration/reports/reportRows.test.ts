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
});
