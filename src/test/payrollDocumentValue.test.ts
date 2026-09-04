import { describe, expect, it } from "vitest";
import { extractPayrollDocumentValue } from "../../supabase/functions/_shared/payroll-document-value";

describe("payroll document value extraction", () => {
  it("uses Base INSS instead of the nearby net salary", () => {
    const result = extractPayrollDocumentValue(
      "SALÁRIO LÍQUIDO R$ 1.442,69 Salário base 1.621,00 Base INSS 1.621,00 Base FGTS 0,00",
    );
    expect(result).toEqual({ amount: 1621, label: "base_inss", confidence: 0.94 });
  });

  it("prioritizes the payroll total with charges", () => {
    const result = extractPayrollDocumentValue(
      "Total proventos 8.500,00 Folha com encargos R$ 10.125,43 Salário líquido 7.100,00",
    );
    expect(result).toEqual({ amount: 10125.43, label: "folha_com_encargos", confidence: 1 });
  });

  it("does not accept net salary as payroll", () => {
    expect(extractPayrollDocumentValue("SALÁRIO LÍQUIDO R$ 1.442,69")).toBeNull();
  });
});
