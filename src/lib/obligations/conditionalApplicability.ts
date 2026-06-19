import type { RegimeLoadConditionKey } from "./regimeLoadTypes";

export type ConditionalDecisionStatus = "apply" | "skip" | "review";

export interface ConditionalClientEvidence {
  hasEmployees?: boolean | null;
  issApplicable?: boolean | null;
  icmsTaxpayer?: boolean | null;
  serviceProvider?: boolean | null;
  accountingContracted?: boolean | null;
}

export interface ConditionalApplicabilityDecision {
  status: ConditionalDecisionStatus;
  conditionKey: RegimeLoadConditionKey;
  evidenceSource: keyof ConditionalClientEvidence | null;
  reason: string;
}

const conditionEvidenceField: Record<RegimeLoadConditionKey, keyof ConditionalClientEvidence> = {
  has_employees: "hasEmployees",
  iss_applicable: "issApplicable",
  icms_taxpayer: "icmsTaxpayer",
  service_provider: "serviceProvider",
  accounting_contracted: "accountingContracted",
};

export function evaluateConditionalApplicability(
  conditionKey: RegimeLoadConditionKey,
  evidence: ConditionalClientEvidence,
): ConditionalApplicabilityDecision {
  const evidenceSource = conditionEvidenceField[conditionKey];
  const value = evidence[evidenceSource];

  if (value === true) {
    return {
      status: "apply",
      conditionKey,
      evidenceSource,
      reason: "client_evidence_indicates_applicability",
    };
  }

  if (value === false) {
    return {
      status: "skip",
      conditionKey,
      evidenceSource,
      reason: "client_evidence_indicates_not_applicable",
    };
  }

  return {
    status: "review",
    conditionKey,
    evidenceSource,
    reason: "insufficient_client_evidence",
  };
}
