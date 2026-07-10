import { describe, expect, it } from "vitest";

import { evaluateConditionalApplicability } from "@/lib/obligations/conditionalApplicability";

describe("conditional applicability", () => {
  it("applies when evidence is true", () => {
    expect(evaluateConditionalApplicability("has_employees", { hasEmployees: true })).toMatchObject({
      status: "apply",
      evidenceSource: "hasEmployees",
    });
  });

  it("skips when evidence is false", () => {
    expect(evaluateConditionalApplicability("icms_taxpayer", { icmsTaxpayer: false })).toMatchObject({
      status: "skip",
      evidenceSource: "icmsTaxpayer",
    });
  });

  it("skips without review when evidence is missing", () => {
    expect(evaluateConditionalApplicability("iss_applicable", {})).toMatchObject({
      status: "skip",
      reason: "insufficient_client_evidence",
    });
  });

  it("supports positive-evidence keys used by the generic matrix", () => {
    expect(evaluateConditionalApplicability("tax_benefit_or_incentive_usage", {
      taxBenefitOrIncentiveUsage: true,
    })).toMatchObject({
      status: "apply",
      evidenceSource: "taxBenefitOrIncentiveUsage",
    });

    expect(evaluateConditionalApplicability("efd_contribuicoes_applicable", {
      efdContribuicoesApplicable: null,
    })).toMatchObject({
      status: "skip",
      reason: "insufficient_client_evidence",
    });
  });
});
