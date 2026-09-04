import { describe, expect, it } from "vitest";

import {
  baselineMasterObligations,
  baselineRegimeLoads,
  excludedSectorSpecificObligationCodes,
  getBaselineLoadByRegime,
} from "@/lib/obligations/baselineRegimeLoads";

describe("baseline regime loads", () => {
  it("defines one active baseline load per supported regime", () => {
    expect(baselineRegimeLoads.map((load) => load.taxRegimeCode).sort()).toEqual([
      "lucro_presumido",
      "lucro_real",
      "mei",
      "simples_nacional",
    ]);
  });

  it("represents shared obligations once in the master catalog", () => {
    const fgtsMasters = baselineMasterObligations.filter((obligation) => obligation.code === "fgts");
    const fgtsLoadReferences = baselineRegimeLoads.flatMap((load) =>
      load.items.filter((item) => item.templateCode === "fgts").map((item) => ({ regime: load.taxRegimeCode, item })),
    );

    expect(fgtsMasters).toHaveLength(1);
    expect(fgtsLoadReferences).toHaveLength(4);
  });

  it("registers only the generic default obligations as master obligations", () => {
    const masterCodes = new Set(baselineMasterObligations.map((obligation) => obligation.code));

    expect(masterCodes).toEqual(
      new Set([
        "das_complementar_review",
        "dasn_simei",
        "defis",
        "dctfweb_mit",
        "destda",
        "dirbi",
        "ecd",
        "ecf",
        "efd_contribuicoes",
        "efd_icms_ipi",
        "efd_reinf",
        "esocial",
        "fgts",
        "generic_municipal_obligations",
        "generic_state_obligations",
        "irpj_csll_lucro_real",
        "irpj_csll_presumido",
        "iss_municipal",
        "mei_revenue_support",
        "mei_status_limit_review",
        "mit",
        "municipal_service_tax_return",
        "nfse_municipal",
        "pgdas_d",
        "pgmei",
        "pis_cofins_cumulativo",
        "pis_cofins_nao_cumulativo",
        "simples_option_status_review",
      ]),
    );
  });

  it("excludes sector-specific obligations from default loads", () => {
    const masterCodes = new Set(baselineMasterObligations.map((obligation) => obligation.code));
    const loadCodes = new Set(baselineRegimeLoads.flatMap((load) => load.items.map((item) => item.templateCode)));

    for (const code of excludedSectorSpecificObligationCodes) {
      expect(masterCodes.has(code)).toBe(false);
      expect(loadCodes.has(code)).toBe(false);
    }
  });

  it("requires condition keys for conditional baseline items", () => {
    const conditionalItems = baselineRegimeLoads.flatMap((load) =>
      load.items.filter((item) => item.applicability === "conditional"),
    );

    expect(conditionalItems.length).toBeGreaterThan(0);
    expect(conditionalItems.every((item) => Boolean(item.conditionKey))).toBe(true);
  });

  it("can find a baseline load by regime", () => {
    expect(getBaselineLoadByRegime("lucro_real")?.name).toBe("Lucro Real - Carga Padrao");
  });

  it("keeps manual obligations outside default-load membership", () => {
    const allDefaultCodes = new Set(baselineRegimeLoads.flatMap((load) => load.items.map((item) => item.templateCode)));

    expect(allDefaultCodes.has("custom_manual_obligation")).toBe(false);
  });

  it("stores annual obligations in their statutory delivery months", () => {
    const annualDueMonths = new Map(
      baselineMasterObligations
        .filter((obligation) => obligation.periodicity === "yearly")
        .map((obligation) => [obligation.code, obligation.yearly_due_month]),
    );

    expect(annualDueMonths.get("defis")).toBe(3);
    expect(annualDueMonths.get("dasn_simei")).toBe(5);
    expect(annualDueMonths.get("ecd")).toBe(6);
    expect(annualDueMonths.get("ecf")).toBe(7);
  });
});
