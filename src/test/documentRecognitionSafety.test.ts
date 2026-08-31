import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/pdfJsClient", () => ({ loadPdfJsClient: vi.fn() }));

import { detectCompetenceCandidatesDetailed } from "@/lib/documentRecognition";

const recognitionSource = readFileSync(resolve(process.cwd(), "src/lib/documentRecognition.ts"), "utf8");
const backendSource = readFileSync(
  resolve(process.cwd(), "supabase/functions/grow-obligations-module/index.ts"),
  "utf8",
);
const localRobotSource = readFileSync(
  resolve(process.cwd(), "tools/grow-document-robot/src/index.ts"),
  "utf8",
);
const workspaceSource = readFileSync(
  resolve(process.cwd(), "src/components/obligations/GrowObligationsWorkspace.tsx"),
  "utf8",
);

describe("document recognition safety contract", () => {
  it("does not use the file name as document content", () => {
    expect(recognitionSource).not.toContain('{ value: file.name, source: "file_name" }');
    expect(recognitionSource).toContain("const recognitionText = text;");
    expect(recognitionSource).toContain('buildFingerprint(text, parsed.pageCount, ""');
  });

  it("makes configured extraction zones authoritative", () => {
    expect(backendSource).toContain("hasConfiguredZoneAuthority");
    expect(backendSource).toContain("zoneSignals.hasCompetenceZone");
    expect(backendSource).toContain("zoneAuthorityApplied");
    expect(backendSource).not.toContain("const zoneCompetence = competenceManuallyEdited ? effectiveCompetence : zoneSignals.competence || effectiveCompetence;");
    expect(backendSource).toContain("O conteudo fora das areas marcadas e o nome do arquivo foram ignorados.");
    expect(backendSource).toContain("Modelo reconhecido, mas as areas obrigatorias exigem correcao manual.");
    expect(workspaceSource).toContain("match.zoneAuthorityApplied");
    expect(workspaceSource).toContain('? match.competenceDetected || ""');
  });

  it("uses the title extraction zone as an auxiliary obligation signal", () => {
    expect(recognitionSource).toContain('field: "cpf" | "cnpj" | "competence" | "title"');
    expect(backendSource).toContain('extractTextFromZone(inputFingerprint, referenceFingerprint, "title")');
    expect(backendSource).toContain("titleScore: referenceTitleTokens.length > 0");
    expect(backendSource).toContain("const titleScore = zoneSignals.titleScore * 0.12;");
  });

  it("supports CPF in the client zone and preserves positioned OCR for cropped reading", () => {
    expect(backendSource).toContain('extractTextFromZone(inputFingerprint, referenceFingerprint, "cpf")');
    expect(backendSource).toContain("detectTaxIdentifierInText");
    expect(recognitionSource).toContain("ocrPositionedTextPages");
    expect(recognitionSource).toContain("ocr.words");
  });

  it("shows the recognized document suggestion even when human confirmation is required", () => {
    expect(workspaceSource).toContain("const nextTemplateId = match.suggestedTemplateId || item.template_id;");
    expect(workspaceSource).toContain("const nextDocumentTypeKey = match.documentTypeKey || item.document_type_key;");
    expect(workspaceSource).not.toContain("const canApplyObligationSuggestion = !match.reviewRequired");
  });

  it("returns a short obligation shortlist when automatic recognition is uncertain", () => {
    expect(backendSource).toContain("const candidateFloor = Math.max(0.25, best.totalScore - 0.18);");
    expect(backendSource).toContain(".slice(0, 5)");
    expect(backendSource).toContain("obligationCandidates: autoAllowed ? [] : obligationCandidates");
  });

  it("keeps the local robot aligned with model zones", () => {
    expect(localRobotSource).toContain('detection_sources: ["pdf_text", "model_zones"]');
    expect(localRobotSource).toContain("const cnpjCandidates = detectCnpjCandidates(normalizedText);");
    expect(localRobotSource).not.toContain("buildDocumentAnalysisTokens(filePath, normalizedText)");
    expect(localRobotSource).toContain("positioned_text_pages: positionedTextPages");
    expect(backendSource).toContain('julho: "07"');
  });

  it("prioritizes the receipt reference date over employee admission dates", () => {
    expect(recognitionSource).toContain('"rotulo_data_completa"');
    expect(recognitionSource).toContain("hasNonCompetenceDateContext(prefix)");
    expect(recognitionSource).toContain("admissao|nascimento|demissao|afastamento|ferias|assinatura");
    expect(localRobotSource).toContain('"rotulo_data_completa"');
    expect(localRobotSource).toContain("hasNonCompetenceDateContext(prefix)");

    const candidates = detectCompetenceCandidatesDetailed([{
      source: "pdf_text",
      value: "Admissão: 24/11/2025. Adto. Salarial referente data: 20/08/2026.",
    }]);
    expect(candidates[0]).toMatchObject({ value: "2026-08", reason: "rotulo_data_completa" });
    expect(candidates.find((candidate) => candidate.value === "2025-11")?.score).toBe(4);
  });

  it("recognizes written-out months without restoring a full-document date over a configured zone", () => {
    const candidates = detectCompetenceCandidatesDetailed([{
      source: "pdf_text",
      value: "Admissão: 24/11/2025. Competência: 20 de agosto de 2026.",
    }]);
    expect(candidates[0]).toMatchObject({ value: "2026-08", reason: "mes_por_extenso" });
    expect(backendSource).toContain("? zoneSignals.competence");
    expect(backendSource).toContain("analysis.competence_detected || suggestedCompetenceLabel");
    expect(workspaceSource).toContain("recognizedCompetence");
    expect(workspaceSource).toContain("competence_detected: recognizedCompetence");
  });

  it("requires a unique cropped date when the zone contains competing dates", () => {
    expect(backendSource).toContain("if (ranked.length === 1 && ranked[0].score >= 50)");
    expect(backendSource).toContain("if (ranked[0].score - (ranked[1]?.score || 0) >= 30)");
    expect(backendSource).toContain("return null;");
    expect(backendSource).toContain("Boolean(finalCompetence)");
  });

  it("scopes models and clients to the authenticated organization", () => {
    expect(backendSource).toContain("loadReferenceFilesMap(supabaseAdmin, organizationId)");
    expect(backendSource).toContain("loadClientsMap(supabaseAdmin, organizationId)");
  });

  it("keeps a manually corrected competence authoritative after preview", () => {
    expect(workspaceSource).toContain("competence_manually_edited: item.competenceManuallyEdited");
    expect(workspaceSource).toContain("competenceManuallyEdited: true");
    expect(backendSource).toMatch(/competenceManuallyEdited\s*\?\s*effectiveCompetence/);
    expect(backendSource).toContain("competenceManuallyEdited ? suggestedCompetenceLabel");
  });
});
