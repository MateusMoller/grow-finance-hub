import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const backend = readFileSync(resolve(process.cwd(), "supabase/functions/integra-contador-module/index.ts"), "utf8");
const panel = readFileSync(resolve(process.cwd(), "src/features/integra-contador/components/TaskDarfInssPanel.tsx"), "utf8");
const dctfwebPanel = readFileSync(resolve(process.cwd(), "src/features/integra-contador/components/TaskDctfwebPanel.tsx"), "utf8");
const migration = readFileSync(resolve(process.cwd(), "supabase/migrations/20260821192839_add_darf_inss_obligation.sql"), "utf8");

describe("DARF - INSS inside its canonical obligation task", () => {
  it("registers a minimal system obligation that generates tasks", () => {
    expect(migration).toContain("'darf_inss'");
    expect(migration).toContain("'DARF - INSS'");
    expect(migration).toContain("generates_kanban");
  });

  it("requires the matching transmitted DCTFWeb declaration", () => {
    expect(backend).toContain('if (action === "get_task_darf_inss_context")');
    expect(backend).toContain('"dctfweb_transmission_required"');
    expect(backend).toContain('targetObligationInstanceId');
  });

  it("exposes DARF only in the DARF task", () => {
    expect(panel).toContain("Gerar DARF - INSS");
    expect(panel).toContain("Baixar DARF");
    expect(dctfwebPanel).not.toContain("Gerar DARF");
  });
});
