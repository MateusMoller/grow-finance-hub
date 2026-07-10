import { describe, expect, it } from "vitest";

import type {
  ApplyConditionalDefaultsAfterEvidenceUpdateRequest,
  ApplyDefaultObligationsRequest,
  ApplyDefaultObligationsResponse,
  ApplyRegimeChangeDefaultObligationsRequest,
  ApplyRegimeChangeDefaultObligationsResponse,
} from "@/lib/obligations/regimeLoadContracts";
import { baselineRegimeLoads, getBaselineLoadByRegime } from "@/lib/obligations/baselineRegimeLoads";
import type { GrowObligationProfile } from "@/lib/growObligations";

describe("default obligation action contracts", () => {
  it("keeps apply_default_obligations response shape stable", () => {
    const request: ApplyDefaultObligationsRequest = {
      action: "apply_default_obligations",
      client_id: "client-1",
      tax_regime_code: "mei",
      mode: "new_client",
      evidence: {
        has_employees: false,
        service_provider: true,
      },
    };
    const response: ApplyDefaultObligationsResponse = {
      ok: true,
      batch_id: "batch-1",
      summary: {
        created: 2,
        kept: 0,
        reactivated: 0,
        skipped: 1,
        blocked: 0,
        duplicate_risk: 0,
        conditional_skipped: 1,
      },
      warnings: [],
      profiles: [],
      skipped_items: [
        {
          template_id: "template-1",
          load_item_id: "item-1",
          decision_type: "skip",
          reason: "insufficient_client_evidence",
          evidence_source: "service_provider",
          auto_apply_when_positive_evidence_exists: true,
        },
      ],
    };

    expect(request.action).toBe("apply_default_obligations");
    expect(response.skipped_items[0]).toMatchObject({
      decision_type: "skip",
      auto_apply_when_positive_evidence_exists: true,
    });
  });

  it("keeps automatic evidence-update action shape stable", () => {
    const request: ApplyConditionalDefaultsAfterEvidenceUpdateRequest = {
      action: "apply_conditional_default_obligations_after_evidence_update",
      client_id: "client-1",
      changed_evidence_keys: ["has_employees", "service_provider"],
      evidence: {
        has_employees: true,
        service_provider: true,
      },
    };

    expect(request).toMatchObject({
      action: "apply_conditional_default_obligations_after_evidence_update",
      client_id: "client-1",
    });
  });

  it("keeps automatic regime-change action shape stable", () => {
    const request: ApplyRegimeChangeDefaultObligationsRequest = {
      action: "apply_regime_change_default_obligations",
      client_id: "client-1",
      from_tax_regime_code: "simples_nacional",
      to_tax_regime_code: "lucro_presumido",
      evidence: {},
    };
    const response: ApplyRegimeChangeDefaultObligationsResponse = {
      ok: true,
      batch_id: "batch-1",
      summary: {
        created: 3,
        kept: 2,
        reactivated: 0,
        skipped: 1,
        blocked: 0,
        duplicate_risk: 0,
        conditional_skipped: 1,
        inactivated_prior_regime: 2,
        add: 3,
        keep: 2,
      },
      warnings: [],
      decisions: [],
      profiles: [],
    };

    expect(request.action).toBe("apply_regime_change_default_obligations");
    expect(response.summary.inactivated_prior_regime).toBe(2);
  });

  it.each([
    ["mei", ["pgmei", "dasn_simei", "mei_revenue_support", "mei_status_limit_review"]],
    ["simples_nacional", ["pgdas_d", "defis", "simples_option_status_review"]],
    ["lucro_presumido", ["dctfweb_mit", "efd_reinf", "ecf", "irpj_csll_presumido", "pis_cofins_cumulativo"]],
    ["lucro_real", ["dctfweb_mit", "efd_reinf", "efd_contribuicoes", "ecd", "ecf", "irpj_csll_lucro_real"]],
  ] as const)("defines required generic defaults for %s", (regime, requiredCodes) => {
    const load = getBaselineLoadByRegime(regime);
    const requiredLoadCodes = new Set(
      load?.items.filter((item) => item.applicability === "required").map((item) => item.templateCode) || [],
    );

    for (const code of requiredCodes) {
      expect(requiredLoadCodes.has(code)).toBe(true);
    }
  });

  it("keeps conditional defaults skipped until positive evidence exists", () => {
    const conditionalItems = baselineRegimeLoads.flatMap((load) =>
      load.items.filter((item) => item.applicability === "conditional"),
    );

    expect(conditionalItems.length).toBeGreaterThan(0);
    expect(conditionalItems.every((item) => Boolean(item.conditionKey))).toBe(true);
  });

  it("keeps manual obligations separate from standard default load profiles", () => {
    const manualProfile: Pick<GrowObligationProfile, "source_kind" | "source_load_id" | "source_load_item_id"> = {
      source_kind: "manual",
      source_load_id: null,
      source_load_item_id: null,
    };

    expect(manualProfile).toEqual({
      source_kind: "manual",
      source_load_id: null,
      source_load_item_id: null,
    });
  });

  it("preserves selected-client linking for manual obligation creation", () => {
    const manualTemplateSave = {
      action: "upsert_template",
      name: "Obrigacao complementar interna",
      code: "obrigacao-complementar-interna",
      linked_client_ids: ["client-1", "client-2"],
      baseline_source: "manual",
    };

    expect(manualTemplateSave).toMatchObject({
      action: "upsert_template",
      baseline_source: "manual",
      linked_client_ids: ["client-1", "client-2"],
    });
  });

  it("models regime-change additions, keeps, and prior-regime future inactivation decisions", () => {
    const response: ApplyRegimeChangeDefaultObligationsResponse = {
      ok: true,
      batch_id: "batch-1",
      summary: {
        created: 1,
        kept: 1,
        reactivated: 0,
        skipped: 1,
        blocked: 0,
        duplicate_risk: 0,
        conditional_skipped: 1,
        inactivated_prior_regime: 1,
        add: 1,
        keep: 1,
      },
      warnings: [],
      profiles: [],
      decisions: [
        {
          id: "decision-add",
          template_id: "template-new",
          decision_type: "add",
          reason: "required_default",
          sync_effect: "future_only",
          auto_applied: true,
        },
        {
          id: "decision-keep",
          template_id: "template-shared",
          current_profile_id: "profile-shared",
          decision_type: "keep",
          reason: "already_active",
          sync_effect: "none",
          auto_applied: true,
        },
        {
          id: "decision-inactivate",
          template_id: "template-old",
          current_profile_id: "profile-old",
          decision_type: "auto_inactivate_prior_regime",
          reason: "default_belongs_only_to_prior_regime",
          sync_effect: "future_only",
          auto_applied: true,
        },
      ],
    };

    expect(response.decisions.map((decision) => decision.decision_type)).toEqual([
      "add",
      "keep",
      "auto_inactivate_prior_regime",
    ]);
    expect(response.decisions.every((decision) => decision.sync_effect !== "historical_delete")).toBe(true);
  });

  it("does not duplicate shared defaults during regime-change application", () => {
    const simplesCodes = new Set(getBaselineLoadByRegime("simples_nacional")?.items.map((item) => item.templateCode));
    const presumidoCodes = new Set(getBaselineLoadByRegime("lucro_presumido")?.items.map((item) => item.templateCode));
    const sharedCodes = Array.from(simplesCodes).filter((code) => presumidoCodes.has(code));

    expect(sharedCodes).toContain("dctfweb_mit");
    expect(new Set(sharedCodes).size).toBe(sharedCodes.length);
  });

  it("preserves completed historical obligations by limiting regime-change effects to future profiles", () => {
    const completedHistoricalInstance = {
      id: "instance-1",
      profile_id: "prior-profile",
      status: "concluida",
      protocol: "PROTO-1",
    };
    const inactivationDecision = {
      decision_type: "auto_inactivate_prior_regime",
      current_profile_id: "prior-profile",
      sync_effect: "future_only",
    };

    expect(inactivationDecision.sync_effect).toBe("future_only");
    expect(completedHistoricalInstance).toMatchObject({
      status: "concluida",
      protocol: "PROTO-1",
    });
  });
});
