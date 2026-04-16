export interface EcontinuoPreflightClient {
  id: string;
  name: string;
  cnpj: string | null;
}

export interface EcontinuoPreflightObligation {
  client_id: string;
  obligation_name: string;
  obligation_period: string | null;
}

export interface ExtractionEvidence {
  source: "filename" | "content" | "heuristic" | "manual";
  detail: string;
  score: number;
}

export interface EcontinuoPreflightRow {
  id: string;
  file: File;
  fileName: string;
  clientId: string;
  competence: string;
  obligationName: string;
  description: string;
  confidence: number;
  warnings: string[];
  blockingErrors: string[];
  selectedForSend: boolean;
  evidence: ExtractionEvidence[];
}

export interface ParseEcontinuoFilesResult {
  rows: EcontinuoPreflightRow[];
  warnings: string[];
}

interface ParseEcontinuoFilesInput {
  files: File[];
  clients: EcontinuoPreflightClient[];
  obligations: EcontinuoPreflightObligation[];
}

const acceptedExtensions = new Set(["pdf", "xls", "xlsx", "csv", "png", "jpg", "jpeg", "webp"]);

const tokenStopwords = new Set([
  "de",
  "da",
  "do",
  "das",
  "dos",
  "e",
  "a",
  "o",
  "as",
  "os",
  "obrigação",
  "obrigações",
  "mensal",
  "arquivo",
  "documento",
]);

const normalizeWhitespace = (value: string) => value.replace(/\s+/g, " ").trim();

const normalizeToken = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const normalizeCnpj = (value: string | null | undefined) => {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  return digits.length === 14 ? digits : null;
};

const getFileExtension = (fileName: string) => {
  const parts = fileName.toLowerCase().split(".");
  return parts.length > 1 ? parts[parts.length - 1] : "";
};

const toCompetence = (year: string, month: string) => {
  const monthValue = Number(month);
  const yearValue = Number(year);
  if (!Number.isFinite(monthValue) || !Number.isFinite(yearValue)) return null;
  if (monthValue < 1 || monthValue > 12) return null;
  if (yearValue < 2000 || yearValue > 2100) return null;
  return `${year}-${String(monthValue).padStart(2, "0")}`;
};

const extractCompetence = (rawText: string): string | null => {
  const text = rawText.replace(/\s+/g, " ");
  const yearMonthPattern = /(?:competência|competência|período|ref(?:erencia)?)?\s*[:\-]?\s*(20\d{2})[\/\-_.]?(0[1-9]|1[0-2])/i;
  const monthYearPattern = /(?:competência|competência|período|ref(?:erencia)?)?\s*[:\-]?\s*(0[1-9]|1[0-2])[\/\-_.](20\d{2})/i;
  const compactMonthYearPattern = /(?:^|[^0-9])(0[1-9]|1[0-2])(20\d{2})(?:[^0-9]|$)/;
  const compactYearMonthPattern = /(?:^|[^0-9])(20\d{2})(0[1-9]|1[0-2])(?:[^0-9]|$)/;

  const yearMonthMatch = text.match(yearMonthPattern);
  if (yearMonthMatch) {
    return toCompetence(yearMonthMatch[1], yearMonthMatch[2]);
  }

  const monthYearMatch = text.match(monthYearPattern);
  if (monthYearMatch) {
    return toCompetence(monthYearMatch[2], monthYearMatch[1]);
  }

  const compactMonthYearMatch = text.match(compactMonthYearPattern);
  if (compactMonthYearMatch) {
    return toCompetence(compactMonthYearMatch[2], compactMonthYearMatch[1]);
  }

  const compactYearMonthMatch = text.match(compactYearMonthPattern);
  if (compactYearMonthMatch) {
    return toCompetence(compactYearMonthMatch[1], compactYearMonthMatch[2]);
  }

  return null;
};

const extractCnpj = (rawText: string): string | null => {
  const cnpjPattern = /\d{2}[.\s]?\d{3}[.\s]?\d{3}[\/\s]?\d{4}[-\s]?\d{2}/g;
  const directMatch = rawText.match(cnpjPattern);
  if (directMatch && directMatch.length > 0) {
    const normalized = normalizeCnpj(directMatch[0]);
    if (normalized) return normalized;
  }

  const digitsOnlyPattern = /(?:^|[^0-9])(\d{14})(?:[^0-9]|$)/;
  const digitsMatch = rawText.match(digitsOnlyPattern);
  if (digitsMatch?.[1]) {
    return normalizeCnpj(digitsMatch[1]);
  }

  return null;
};

const tokenizeForScore = (value: string) =>
  normalizeToken(value)
    .split(" ")
    .filter((token) => token.length >= 3 && !tokenStopwords.has(token));

const scoreByTokenOverlap = (source: string, candidate: string) => {
  const sourceNormalized = normalizeToken(source);
  const candidateTokens = tokenizeForScore(candidate);
  if (candidateTokens.length === 0) return 0;
  let matches = 0;
  for (const token of candidateTokens) {
    if (sourceNormalized.includes(token)) matches += 1;
  }
  return matches / candidateTokens.length;
};

const summarizeFileName = (fileName: string) =>
  normalizeWhitespace(fileName.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " "));

const parseSpreadsheetText = async (file: File): Promise<string> => {
  const XLSX = await import("xlsx");
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data, { type: "array", cellDates: false, raw: false });
  const lines: string[] = [];

  workbook.SheetNames.slice(0, 3).forEach((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) return;
    const rows = XLSX.utils.sheet_to_json<string[]>(sheet, {
      header: 1,
      raw: false,
      blankrows: false,
      defval: "",
    });

    rows.slice(0, 120).forEach((row) => {
      const line = row
        .map((cell) => normalizeWhitespace(String(cell || "")))
        .filter(Boolean)
        .slice(0, 20)
        .join(" ");
      if (line) lines.push(line);
    });
  });

  return lines.join("\n");
};

const parsePdfText = async (file: File): Promise<string> => {
  const [pdfModule, pdfWorkerModule] = await Promise.all([
    import("pdfjs-dist/legacy/build/pdf.mjs"),
    import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url"),
  ]);

  const pdfJs = pdfModule as unknown as {
    GlobalWorkerOptions?: { workerSrc: string };
    getDocument: (source: { data: ArrayBuffer }) => {
      promise: Promise<{
        numPages: number;
        getPage: (
          page: number,
        ) => Promise<{
          getTextContent: () => Promise<{ items: Array<{ str?: string }> }>;
        }>;
      }>;
    };
  };

  if (pdfJs.GlobalWorkerOptions) {
    pdfJs.GlobalWorkerOptions.workerSrc =
      (pdfWorkerModule as { default?: string }).default || "pdf.worker.min.mjs";
  }

  const fileData = await file.arrayBuffer();
  const docTask = pdfJs.getDocument({ data: fileData });
  const pdf = await docTask.promise;
  const pages: string[] = [];

  const maxPages = Math.min(pdf.numPages, 5);
  for (let pageNumber = 1; pageNumber <= maxPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => normalizeWhitespace(item.str || ""))
      .filter(Boolean)
      .join("\n");
    pages.push(pageText);
  }

  return pages.join("\n");
};

const parseImageText = async (file: File): Promise<string> => {
  const tesseractModule = await import("tesseract.js");
  const recognize =
    (tesseractModule as { recognize?: (...args: unknown[]) => Promise<unknown> }).recognize ||
    (tesseractModule as { default?: { recognize?: (...args: unknown[]) => Promise<unknown> } }).default
      ?.recognize;

  if (!recognize) {
    throw new Error("OCR indisponível neste navegador.");
  }

  const result = (await recognize(file, "por+eng")) as { data?: { text?: string } };
  return normalizeWhitespace(result?.data?.text || "");
};

const parseContentText = async (file: File): Promise<string> => {
  const extension = getFileExtension(file.name);
  if (extension === "pdf") return parsePdfText(file);
  if (extension === "csv" || extension === "xls" || extension === "xlsx") return parseSpreadsheetText(file);
  if (extension === "png" || extension === "jpg" || extension === "jpeg" || extension === "webp") return parseImageText(file);
  return "";
};

const buildObligationLookup = (obligations: EcontinuoPreflightObligation[]) => {
  const map = new Map<string, string[]>();

  for (const row of obligations) {
    const clientId = row.client_id;
    const obligationName = normalizeWhitespace(row.obligation_name || "");
    if (!clientId || !obligationName) continue;

    const existing = map.get(clientId) || [];
    if (!existing.some((item) => normalizeToken(item) === normalizeToken(obligationName))) {
      existing.push(obligationName);
      map.set(clientId, existing);
    }
  }

  map.forEach((value, key) => {
    map.set(
      key,
      [...value].sort((left, right) => left.localeCompare(right, "pt-BR")),
    );
  });

  return map;
};

const findClientSuggestion = (
  sourceText: string,
  clients: EcontinuoPreflightClient[],
): { clientId: string; confidenceGain: number; evidence: ExtractionEvidence | null } => {
  const detectedCnpj = extractCnpj(sourceText);
  if (detectedCnpj) {
    const byCnpj = clients.find((client) => normalizeCnpj(client.cnpj) === detectedCnpj);
    if (byCnpj) {
      return {
        clientId: byCnpj.id,
        confidenceGain: 40,
        evidence: {
          source: "content",
          detail: `Cliente identificado por CNPJ (${detectedCnpj}).`,
          score: 1,
        },
      };
    }
  }

  let bestClientId = "";
  let bestScore = 0;
  for (const client of clients) {
    const score = scoreByTokenOverlap(sourceText, client.name || "");
    if (score > bestScore) {
      bestScore = score;
      bestClientId = client.id;
    }
  }

  if (bestClientId && bestScore >= 0.55) {
    return {
      clientId: bestClientId,
      confidenceGain: Math.round(bestScore * 28),
      evidence: {
        source: "heuristic",
        detail: `Cliente sugerido por similaridade de nome (${Math.round(bestScore * 100)}%).`,
        score: Number(bestScore.toFixed(2)),
      },
    };
  }

  return { clientId: "", confidenceGain: 0, evidence: null };
};

const findObligationSuggestion = (
  sourceText: string,
  obligationsByClient: Map<string, string[]>,
  clientId: string,
): { obligationName: string; confidenceGain: number; evidence: ExtractionEvidence | null } => {
  if (!clientId) return { obligationName: "", confidenceGain: 0, evidence: null };
  const options = obligationsByClient.get(clientId) || [];
  if (options.length === 0) return { obligationName: "", confidenceGain: 0, evidence: null };

  let bestName = "";
  let bestScore = 0;
  for (const option of options) {
    const score = scoreByTokenOverlap(sourceText, option);
    if (score > bestScore) {
      bestScore = score;
      bestName = option;
    }
  }

  if (bestName && bestScore >= 0.45) {
    return {
      obligationName: bestName,
      confidenceGain: Math.round(bestScore * 24),
      evidence: {
        source: "heuristic",
        detail: `Obrigação sugerida por similaridade (${Math.round(bestScore * 100)}%).`,
        score: Number(bestScore.toFixed(2)),
      },
    };
  }

  return { obligationName: "", confidenceGain: 0, evidence: null };
};

export const getPreflightBlockingErrors = (row: Pick<EcontinuoPreflightRow, "clientId" | "competence" | "obligationName">) => {
  const errors: string[] = [];
  if (!normalizeWhitespace(row.clientId)) errors.push("Cliente não identificado.");
  if (!extractCompetence(row.competence || "")) errors.push("Competência invalida. Use AAAA-MM.");
  if (!normalizeWhitespace(row.obligationName)) errors.push("Obrigação não identificada.");
  return errors;
};

export const normalizePreflightCompetence = (value: string) => extractCompetence(value) || "";

export async function parseEcontinuoFiles({
  files,
  clients,
  obligations,
}: ParseEcontinuoFilesInput): Promise<ParseEcontinuoFilesResult> {
  const rows: EcontinuoPreflightRow[] = [];
  const warnings: string[] = [];
  const obligationsByClient = buildObligationLookup(obligations);

  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    const extension = getFileExtension(file.name);
    const rowWarnings: string[] = [];
    const evidence: ExtractionEvidence[] = [];
    let confidence = 18;
    let contentText = "";

    if (!acceptedExtensions.has(extension)) {
      rowWarnings.push("Formato sem leitura automatica completa. Revise manualmente.");
      warnings.push(`Formato com suporte parcial: ${file.name}.`);
    } else {
      try {
        contentText = await parseContentText(file);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Erro desconhecido";
        rowWarnings.push(`Não foi possível extrair o conteúdo: ${message}`);
      }
    }

    const fileSummary = summarizeFileName(file.name);
    const combinedText = `${file.name}\n${fileSummary}\n${contentText}`.slice(0, 24000);

    const clientSuggestion = findClientSuggestion(combinedText, clients);
    if (clientSuggestion.evidence) evidence.push(clientSuggestion.evidence);
    confidence += clientSuggestion.confidenceGain;

    const competence = extractCompetence(combinedText) || "";
    if (competence) {
      confidence += 20;
      evidence.push({
        source: "content",
        detail: `Competência detectada: ${competence}.`,
        score: 0.85,
      });
    } else {
      rowWarnings.push("Competência não detectada automaticamente.");
    }

    const obligationSuggestion = findObligationSuggestion(
      combinedText,
      obligationsByClient,
      clientSuggestion.clientId,
    );
    if (obligationSuggestion.evidence) evidence.push(obligationSuggestion.evidence);
    confidence += obligationSuggestion.confidenceGain;

    const row: EcontinuoPreflightRow = {
      id: `${Date.now()}-${index}-${file.name}`,
      file,
      fileName: file.name,
      clientId: clientSuggestion.clientId,
      competence,
      obligationName: obligationSuggestion.obligationName,
      description: fileSummary,
      confidence: Math.max(0, Math.min(100, Math.round(confidence))),
      warnings: rowWarnings,
      blockingErrors: [],
      selectedForSend: true,
      evidence,
    };

    row.blockingErrors = getPreflightBlockingErrors(row);
    if (row.blockingErrors.length > 0) {
      row.selectedForSend = false;
    }

    rows.push(row);
  }

  return { rows, warnings };
}
