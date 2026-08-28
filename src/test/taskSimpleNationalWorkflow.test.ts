import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const backendSource = readFileSync(resolve(process.cwd(), "supabase/functions/integra-contador-module/index.ts"), "utf8");
const taskSheetSource = readFileSync(resolve(process.cwd(), "src/components/app/KanbanTaskDetailSheet.tsx"), "utf8");
const panelSource = readFileSync(resolve(process.cwd(), "src/features/integra-contador/components/TaskSimpleNationalPanel.tsx"), "utf8");

describe("Simples Nacional inside an obligation task", () => {
  it("uses the task obligation instance as the authoritative context", () => {
    expect(backendSource).toContain('if (action === "get_task_simples_context")');
    expect(backendSource).toContain('.eq("organization_id", organizationId)');
    expect(backendSource).toContain("taskPayload.instance_id");
    expect(backendSource).toContain('.eq("obligation_instance_id", instance.id)');
  });

  it("supports both PGDAS-D and DAS tasks without duplicating the fiscal dossier", () => {
    expect(backendSource).toContain('const isDasTask = templateCode === "das"');
    expect(backendSource).toContain('? dossierQuery.eq("competence_key", competenceKey)');
    expect(backendSource).toContain("_obligation_instance_id: isDasTask ? null : instance.id");
  });

  it("normalizes the annual DEFIS occurrence to its four-digit calendar year", () => {
    expect(backendSource).toContain('const competenceKey = kind === "defis"');
    expect(backendSource).toContain("normalizedInstanceCompetence.slice(0, 4)");
    expect(backendSource).toContain('kind === "defis" ? /^\\d{4}$/.test(competenceKey)');
  });

  it("keeps the retired assisted workflow out of the task sheet", () => {
    expect(taskSheetSource).not.toContain("<TaskSimpleNationalPanel");
    expect(panelSource).toContain("Validar e salvar");
    expect(panelSource).toContain("Calcular");
    expect(panelSource).toContain("Aprovar valores");
    expect(panelSource).toContain("Transmitir declaração");
    expect(panelSource).toContain("Gerar DAS");
  });

  it("exposes the complete DEFIS workflow in the same task panel", () => {
    expect(panelSource).toContain("<DefisDossierEditor");
    expect(panelSource).toContain("Consultar transmitidas");
    expect(panelSource).toContain("Transmitir DEFIS");
    expect(panelSource).toContain('workflow.openArtifact(dossier.id, "declaration")');
    expect(panelSource).toContain('workflow.openArtifact(dossier.id, "receipt")');
  });
});
