import type { ConditionalClientEvidence } from "@/lib/obligations/conditionalApplicability";
import type { RegimeLoad, RegimeLoadItem, RegimeLoadSyncRun, TaxRegimeCode } from "@/lib/obligations/regimeLoadTypes";

export const obligationFixtureOrganizationId = "00000000-0000-4000-8000-000000000001";
export const obligationFixtureClientId = "00000000-0000-4000-8000-000000000101";
export const obligationFixtureLoadId = "00000000-0000-4000-8000-000000000201";

export const fixtureClientEvidenceWithEmployees: ConditionalClientEvidence = {
  hasEmployees: true,
  issApplicable: null,
  icmsTaxpayer: false,
  serviceProvider: true,
  accountingContracted: true,
};

export function createRegimeLoadFixture(overrides: Partial<RegimeLoad> = {}): RegimeLoad {
  return {
    id: obligationFixtureLoadId,
    organization_id: obligationFixtureOrganizationId,
    tax_regime_code: "simples_nacional",
    name: "Simples Nacional - Carga Padrao",
    status: "active",
    version: 1,
    description: null,
    owner_sector: "Fiscal",
    review_notes: null,
    effective_from: "2026-06-01",
    effective_until: null,
    ...overrides,
  };
}

export function createRegimeLoadItemFixture(overrides: Partial<RegimeLoadItem> = {}): RegimeLoadItem {
  return {
    id: "00000000-0000-4000-8000-000000000301",
    organization_id: obligationFixtureOrganizationId,
    load_id: obligationFixtureLoadId,
    template_id: "00000000-0000-4000-8000-000000000401",
    applicability: "conditional",
    condition_key: "has_employees",
    default_start_policy: "client_created_at",
    default_due_day_override: null,
    notes: null,
    is_active: true,
    sort_order: 10,
    ...overrides,
  };
}

export function createSyncRunFixture(overrides: Partial<RegimeLoadSyncRun> = {}): RegimeLoadSyncRun {
  return {
    id: "00000000-0000-4000-8000-000000000501",
    organization_id: obligationFixtureOrganizationId,
    load_id: obligationFixtureLoadId,
    tax_regime_code: "simples_nacional",
    status: "completed",
    scope: "existing_clients_same_regime",
    clients_total: 10,
    clients_processed: 10,
    profiles_created: 4,
    profiles_reactivated: 1,
    profiles_inactivated_future: 0,
    profiles_skipped: 2,
    review_required: 1,
    warnings: [],
    ...overrides,
  };
}

export const branchRegimeCases: Array<{
  label: string;
  companyRegime: string | null;
  parentRegime: string | null;
  isBranch: boolean;
  inheritsParentRegime: boolean;
  expectedRegime: TaxRegimeCode | null;
}> = [
  {
    label: "branch with own regime",
    companyRegime: "Lucro Presumido",
    parentRegime: "Simples Nacional",
    isBranch: true,
    inheritsParentRegime: false,
    expectedRegime: "lucro_presumido",
  },
  {
    label: "branch inheriting parent regime",
    companyRegime: null,
    parentRegime: "Simples Nacional",
    isBranch: true,
    inheritsParentRegime: true,
    expectedRegime: "simples_nacional",
  },
];
