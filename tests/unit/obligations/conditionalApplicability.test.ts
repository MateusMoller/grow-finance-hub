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

  it("requires review when evidence is missing", () => {
    expect(evaluateConditionalApplicability("iss_applicable", {})).toMatchObject({
      status: "review",
      reason: "insufficient_client_evidence",
    });
  });
});
