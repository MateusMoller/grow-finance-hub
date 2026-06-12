import { describe, expect, it } from "vitest";
import { reportCatalogById } from "@/lib/reports/catalog";
import { canAccessReportDataset, filterAuthorizedReportFields } from "@/lib/reports/permissions";

describe("report permissions", () => {
  it("blocks client users from internal report datasets", () => {
    const clientes = reportCatalogById.get("clientes");
    expect(clientes).toBeTruthy();
    expect(canAccessReportDataset(clientes!, ["client"])).toBe(false);
  });

  it("allows management roles to access team dataset", () => {
    const equipe = reportCatalogById.get("equipe");
    expect(equipe).toBeTruthy();
    expect(canAccessReportDataset(equipe!, ["manager"])).toBe(true);
    expect(canAccessReportDataset(equipe!, ["commercial"])).toBe(false);
  });

  it("excludes prohibited fields from authorized preview fields", () => {
    const clientes = reportCatalogById.get("clientes");
    const fields = filterAuthorizedReportFields(clientes!, ["admin"], { preview: true });
    expect(fields.some((field) => field.key.includes("senha_gov"))).toBe(false);
  });
});
