import { describe, expect, it } from "vitest";

import { normalizeTaxRegime, resolveBranchTaxRegime } from "@/lib/obligations/taxRegimes";

describe("tax regime helpers", () => {
  it("normalizes supported tax regime aliases", () => {
    expect(normalizeTaxRegime("Simples Nacional")).toBe("simples_nacional");
    expect(normalizeTaxRegime("LP")).toBe("lucro_presumido");
    expect(normalizeTaxRegime("lucro real")).toBe("lucro_real");
    expect(normalizeTaxRegime("Microempreendedor Individual")).toBe("mei");
  });

  it("returns unsupported for unknown regimes", () => {
    expect(normalizeTaxRegime("arbitrado")).toBeNull();
  });

  it("uses branch own regime when available", () => {
    expect(
      resolveBranchTaxRegime({
        companyRegime: "Lucro Presumido",
        parentRegime: "Simples Nacional",
        isBranch: true,
        inheritsParentRegime: false,
      }),
    ).toEqual({ status: "own_regime", taxRegimeCode: "lucro_presumido" });
  });

  it("requires review when a branch inherits parent regime", () => {
    expect(
      resolveBranchTaxRegime({
        companyRegime: null,
        parentRegime: "Simples Nacional",
        isBranch: true,
        inheritsParentRegime: true,
      }),
    ).toMatchObject({
      status: "inherited_requires_review",
      taxRegimeCode: "simples_nacional",
      reason: "branch_inherits_parent_regime",
    });
  });
});
