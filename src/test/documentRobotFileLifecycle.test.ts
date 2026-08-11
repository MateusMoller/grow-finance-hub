import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const robotSource = readFileSync("tools/grow-document-robot/src/index.ts", "utf8");

describe("ciclo local de arquivos do robo", () => {
  it("remove o PDF somente depois de persistir a confirmacao remota", () => {
    const persistIndex = robotSource.indexOf("await writeJsonFile(config.stateFile, state);");
    const removeIndex = robotSource.indexOf("await removeProcessedFile(entry.filePath);");

    expect(persistIndex).toBeGreaterThan(-1);
    expect(removeIndex).toBeGreaterThan(persistIndex);
    expect(robotSource).toContain("if (response.ok !== true || !confirmedRemoteRecord)");
    expect(robotSource).toContain("const duplicateCompleted = duplicate");
    expect(robotSource).toContain("O documento foi recebido, mas ainda depende de revisao e nao foi entregue ao cliente.");
  });

  it("move falhas definitivas para nao_processado", () => {
    expect(robotSource).toContain("failedFilePath = await moveToFailedFolder(config, entry.filePath)");
    expect(robotSource).toContain('path.resolve(sourceRoot, "nao_processado")');
  });

  it("ignora a pasta nao_processado durante a varredura", () => {
    expect(robotSource).toContain('const failedFolderName = "nao_processado"');
    expect(robotSource).toContain('entryName.toLocaleLowerCase("pt-BR") === failedFolderName');
  });

  it("trata o reaparecimento de um arquivo enviado como nova entrada", () => {
    expect(robotSource).toContain("localFilePresent?: boolean");
    expect(robotSource).toContain("state.files[key] = buildStateEntry(absolutePath, stats.size, stats.mtimeMs)");
    expect(robotSource).toContain("localFilePresent: false");
  });

  it("nao tenta processar novamente uma entrada cujo arquivo ja desapareceu", () => {
    expect(robotSource).toContain("if (entry.localFilePresent === false)");
  });

  it("recoloca na fila um arquivo pendente que reapareceu com os mesmos metadados", () => {
    expect(robotSource).toContain("if (existing.localFilePresent === false)");
    expect(robotSource).toContain("state.files[key] = buildStateEntry(absolutePath, stats.size, stats.mtimeMs)");
  });

  it("atribui uma identidade persistente a cada nova colocacao na pasta", () => {
    expect(robotSource).toContain("submissionId: randomUUID()");
    expect(robotSource).toContain("robot_submission_id: entry.submissionId");
  });
});
