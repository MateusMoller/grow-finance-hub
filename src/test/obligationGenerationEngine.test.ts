import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(process.cwd());
const edgeFunction = readFileSync(
  resolve(root, "supabase/functions/grow-obligations-module/index.ts"),
  "utf8",
);
const canonicalMigration = readFileSync(
  resolve(root, "supabase/migrations/20260806114901_unify_obligation_generation_day_25.sql"),
  "utf8",
);

describe("canonical obligation generation engine", () => {
  it("keeps all API generation paths on the database RPC", () => {
    expect(edgeFunction).toContain('.rpc("generate_obligation_occurrences"');
    expect(edgeFunction).not.toContain("ensureInstancesForProfiles");
    expect(edgeFunction).not.toContain("currentCompetenceGenerationWindow");
  });

  it("runs the monthly automation on day 25", () => {
    expect(canonicalMigration).toContain("'0 6 25 * *'");
    expect(canonicalMigration).not.toContain("'0 6 27 * *'");
  });

  it("protects generation with canonical identity and a transaction lock", () => {
    expect(canonicalMigration).toContain("pg_try_advisory_xact_lock");
    expect(canonicalMigration).toContain("ux_obligation_instances_active_occurrence");
    expect(canonicalMigration).toContain("ON CONFLICT (client_id, template_id, competence_key) DO NOTHING");
  });

  it("keeps date regression checks alongside the database rule", () => {
    expect(canonicalMigration).toContain("day 31 regression");
    expect(canonicalMigration).toContain("leap year regression");
    expect(canonicalMigration).toContain("business day regression");
    expect(canonicalMigration).toContain("last business day regression");
  });

  it("saves client links in bulk without failing the main template save", () => {
    expect(edgeFunction).toContain('.upsert(profileRows, { onConflict: "client_id,template_id" })');
    expect(edgeFunction).toContain("Promise.allSettled(");
    expect(edgeFunction).toContain("generation_warnings: generationWarnings");
  });
});
