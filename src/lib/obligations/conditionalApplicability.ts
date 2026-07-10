import type { RegimeLoadConditionKey } from "./regimeLoadTypes";

export type ConditionalDecisionStatus = "apply" | "skip";

export interface ConditionalClientEvidence {
  hasEmployees?: boolean | null;
  issApplicable?: boolean | null;
  icmsTaxpayer?: boolean | null;
  serviceProvider?: boolean | null;
  accountingContracted?: boolean | null;
  municipalServiceDeclarationRequired?: boolean | null;
  stateRegistration?: boolean | null;
  stateRegistrationOrRequired?: boolean | null;
  icmsIpiTaxpayer?: boolean | null;
  icmsStDifalAnticipation?: boolean | null;
  retentionsOrServices?: boolean | null;
  hasEmployeesOrRetentions?: boolean | null;
  ecdApplicable?: boolean | null;
  efdContribuicoesApplicable?: boolean | null;
  taxBenefitOrIncentiveUsage?: boolean | null;
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
  municipal_service_declaration_required: "municipalServiceDeclarationRequired",
  state_registration: "stateRegistration",
  state_registration_or_required: "stateRegistrationOrRequired",
  icms_ipi_taxpayer: "icmsIpiTaxpayer",
  icms_st_difal_anticipation: "icmsStDifalAnticipation",
  retentions_or_services: "retentionsOrServices",
  has_employees_or_retentions: "hasEmployeesOrRetentions",
  ecd_applicable: "ecdApplicable",
  efd_contribuicoes_applicable: "efdContribuicoesApplicable",
  tax_benefit_or_incentive_usage: "taxBenefitOrIncentiveUsage",
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
    status: "skip",
    conditionKey,
    evidenceSource,
    reason: "insufficient_client_evidence",
  };
}

export function getEvidenceFieldForCondition(
  conditionKey: RegimeLoadConditionKey,
): keyof ConditionalClientEvidence {
  return conditionEvidenceField[conditionKey];
}
