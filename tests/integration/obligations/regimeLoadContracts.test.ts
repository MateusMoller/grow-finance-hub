import { describe, expect, it } from "vitest";

import type {
  ApplyRegimeLoadRequest,
  DetectObligationDuplicatesRequest,
  ListRegimeLoadsRequest,
  PreviewApplyRegimeLoadRequest,
  SyncRegimeLoadExistingClientsRequest,
} from "@/lib/obligations/regimeLoadContracts";

describe("regime load action contracts", () => {
  it("keeps the list_regime_loads action shape stable", () => {
    const request: ListRegimeLoadsRequest = {
      action: "list_regime_loads",
      organization_id: "org-1",
      tax_regime_code: "simples_nacional",
      status: "active",
    };

    expect(request).toMatchObject({ action: "list_regime_loads", tax_regime_code: "simples_nacional" });
  });

  it("keeps preview/apply/sync action names stable", () => {
    const preview: PreviewApplyRegimeLoadRequest = {
      action: "preview_apply_regime_load",
      client_id: "client-1",
      tax_regime_code: "lucro_presumido",
      mode: "regime_migration",
    };
    const apply: ApplyRegimeLoadRequest = {
      action: "apply_regime_load",
      client_id: "client-1",
      tax_regime_code: "lucro_presumido",
      mode: "new_client",
      auto_generate_instances: false,
    };
    const sync: SyncRegimeLoadExistingClientsRequest = {
      action: "sync_regime_load_existing_clients",
      load_id: "load-1",
      tax_regime_code: "lucro_presumido",
      mode: "published_load_change",
    };

    expect([preview.action, apply.action, sync.action]).toEqual([
      "preview_apply_regime_load",
      "apply_regime_load",
      "sync_regime_load_existing_clients",
    ]);
  });

  it("keeps duplicate diagnostic action shape stable", () => {
    const request: DetectObligationDuplicatesRequest = {
      action: "detect_obligation_duplicates",
      name: "F.G.T.S.",
      code: "fgts",
    };

    expect(request).toEqual(expect.objectContaining({ action: "detect_obligation_duplicates" }));
  });
});
