import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const backend = readFileSync(resolve(process.cwd(), "supabase/functions/integra-contador-module/index.ts"), "utf8");
const migration = readFileSync(resolve(process.cwd(), "supabase/migrations/20260902145012_automate_defis_annual_pgdas_values.sql"), "utf8");
const page = readFileSync(resolve(process.cwd(), "src/pages/SimpleNationalAutomationPage.tsx"), "utf8");

describe("DEFIS annual automation", () => {
  it("consolidates the twelve PGDAS-D monthly revenues in the backend", () => {
    expect(migration).toContain("sync_defis_annual_pgdas_values");
    expect(migration).toContain("sum(months.gross_revenue)");
    expect(migration).toContain("defis_pgdas_months_incomplete");
  });

  it("blocks transmission when the annual PGDAS-D history is incomplete", () => {
    expect(backend).toContain('Number(defisData.pgdas_months_complete || 0) !== 12');
  });

  it("publishes declaration and receipt to the canonical obligation", () => {
    expect(backend).toContain("publishDefisDocumentsToObligation");
    expect(backend).toContain('source_kind: "api"');
    expect(backend).toContain('ready_for_delivery_at: now');
  });

  it("exposes annual consolidation in the DEFIS workflow", () => {
    expect(page).toContain("Consolidar receitas");
    expect(page).toContain("PGDAS-D consolidado");
  });
});
