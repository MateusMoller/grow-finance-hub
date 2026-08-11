import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const recognitionSource = readFileSync(resolve(process.cwd(), "src/lib/documentRecognition.ts"), "utf8");
const backendSource = readFileSync(
  resolve(process.cwd(), "supabase/functions/grow-obligations-module/index.ts"),
  "utf8",
);
const localRobotSource = readFileSync(
  resolve(process.cwd(), "tools/grow-document-robot/src/index.ts"),
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
    expect(backendSource).toContain("O conteudo fora das areas marcadas e o nome do arquivo foram ignorados.");
    expect(backendSource).toContain("Modelo reconhecido, mas as areas obrigatorias exigem correcao manual.");
  });

  it("keeps the local robot aligned with model zones", () => {
    expect(localRobotSource).toContain('detection_sources: ["pdf_text", "model_zones"]');
    expect(localRobotSource).toContain("const cnpjCandidates = detectCnpjCandidates(normalizedText);");
    expect(localRobotSource).not.toContain("buildDocumentAnalysisTokens(filePath, normalizedText)");
    expect(localRobotSource).toContain("positioned_text_pages: positionedTextPages");
    expect(backendSource).toContain('julho: "07"');
  });

  it("scopes models and clients to the authenticated organization", () => {
    expect(backendSource).toContain("loadReferenceFilesMap(supabaseAdmin, organizationId)");
    expect(backendSource).toContain("loadClientsMap(supabaseAdmin, organizationId)");
  });
});
