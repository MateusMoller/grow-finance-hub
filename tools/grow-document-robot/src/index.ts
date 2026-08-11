import { createHash, randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import process from "node:process";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

type RobotConfig = {
  supabaseUrl: string;
  supabaseAnonKey: string;
  robotUserEmail: string;
  robotUserPassword?: string;
  machineId: string;
  stateFile: string;
  scanIntervalMs?: number;
  retryDelayMs?: number;
  maxRetries?: number;
  folders: string[];
  storageBucket?: string;
  storagePrefix?: string;
};

type RobotFileStatus = "na_fila" | "enviado" | "processado" | "falhou" | "reprocessar";

type RobotFileState = {
  submissionId?: string;
  filePath: string;
  fileName: string;
  status: RobotFileStatus;
  fileHash: string | null;
  fileSize: number;
  lastModifiedMs: number;
  retries: number;
  nextRetryAt: string | null;
  lastError: string | null;
  remoteInboxItemId: string | null;
  remoteIngestionJobId: string | null;
  remoteStatus: string | null;
  localFilePresent?: boolean;
  updatedAt: string;
};

type RobotState = {
  files: Record<string, RobotFileState>;
  lastScanAt: string | null;
};

type DocumentAnalysisPayload = {
  extracted_text: string | null;
  extracted_text_preview: string | null;
  detected_cnpj: string | null;
  competence_detected: string | null;
  text_extraction_status: string;
  ocr_status: string;
  fingerprint_payload: Record<string, unknown>;
  keywords: string[];
  primary_cues: string[];
};

const DEFAULT_SCAN_INTERVAL_MS = 30_000;
const DEFAULT_RETRY_DELAY_MS = 120_000;
const DEFAULT_MAX_RETRIES = 5;
const DEFAULT_BUCKET = "obligation-files";
const DEFAULT_PREFIX = "grow-document-robot";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toPosixPath(value: string) {
  return value.replace(/\\/g, "/");
}

function normalizeFileKey(filePath: string) {
  return toPosixPath(path.resolve(filePath)).toLowerCase();
}

function normalizeDigits(value: string | null | undefined) {
  return (value || "").replace(/\D+/g, "");
}

function normalizeCnpj(value: string | null | undefined) {
  const digits = normalizeDigits(value);
  if (digits.length !== 14) return null;
  if (/^(\d)\1{13}$/.test(digits)) return null;
  return isValidCnpj(digits) ? digits : null;
}

function isValidCnpj(cnpj: string) {
  const calculateDigit = (length: number) => {
    const weights = length === 12
      ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
      : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = weights.reduce((total, weight, index) => total + Number(cnpj[index]) * weight, 0);
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };

  return calculateDigit(12) === Number(cnpj[12]) && calculateDigit(13) === Number(cnpj[13]);
}

function normalizeReadableText(value: string) {
  return value
    .normalize("NFKC")
    .replace(/\u00a0/g, " ")
    .replace(/\u00ad/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeSearchText(value: string) {
  return normalizeReadableText(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function uniqueValues<T>(values: T[]) {
  return Array.from(new Set(values));
}

function detectCnpjCandidates(...sources: string[]) {
  const candidates: string[] = [];

  for (const source of sources) {
    const normalized = normalizeReadableText(source);
    const formattedMatches = normalized.match(/\d{2}\s*\.?\s*\d{3}\s*\.?\s*\d{3}\s*\/?\s*\d{4}\s*-?\s*\d{2}/g) || [];
    for (const match of formattedMatches) {
      const cnpj = normalizeCnpj(match);
      if (cnpj) candidates.push(cnpj);
    }

    const digits = normalizeDigits(normalized);
    for (let index = 0; index <= digits.length - 14; index += 1) {
      const cnpj = normalizeCnpj(digits.slice(index, index + 14));
      if (cnpj) candidates.push(cnpj);
    }
  }

  return uniqueValues(candidates);
}

function monthLabel(month: string, year: string) {
  return `${year}-${month.padStart(2, "0")}`;
}

type CompetenceCandidate = {
  value: string;
  score: number;
  source: "file_name" | "file_path" | "pdf_text";
  reason: string;
};

function addCompetenceCandidate(
  candidates: CompetenceCandidate[],
  value: string,
  score: number,
  source: CompetenceCandidate["source"],
  reason: string,
) {
  if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(value)) return;
  candidates.push({ value, score, source, reason });
}

function sourceWeight(source: CompetenceCandidate["source"]) {
  if (source === "file_name") return 1.45;
  if (source === "file_path") return 1.15;
  return 1;
}

function hasCompetenceContext(value: string) {
  return /\b(competencia|comp|periodo|apuracao|referencia|ref|pa|mes\s+base|mes\s+referencia|folha\s+de|salario\s+de)\b/.test(value);
}

function hasDateContext(value: string) {
  return /\b(vencimento|pagamento|emissao|data|gerado|emitido|recolhimento|validade|processamento)\b/.test(value);
}

function detectCompetenceCandidatesDetailed(sources: Array<{ value: string; source: CompetenceCandidate["source"] }>) {
  const candidates: CompetenceCandidate[] = [];

  for (const item of sources) {
    const text = normalizeSearchText(item.value);
    if (!text) continue;
    const weight = sourceWeight(item.source);

    const monthNames: Record<string, string> = {
      janeiro: "01", fevereiro: "02", marco: "03", abril: "04",
      maio: "05", junho: "06", julho: "07", agosto: "08",
      setembro: "09", outubro: "10", novembro: "11", dezembro: "12",
    };
    const namedMonthMatches = text.matchAll(/\b(janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\D{0,8}(20\d{2})\b/g);
    for (const match of namedMonthMatches) {
      addCompetenceCandidate(candidates, `${match[2]}-${monthNames[match[1]]}`, 98 * weight, item.source, "mes_por_extenso");
    }

    const labelledMatches = text.matchAll(/\b(?:competencia|competencia\s+de|comp|periodo\s+de\s+apuracao|periodo|apuracao|referencia|ref|pa|mes\s+referencia|mes\s+base|folha\s+de|salario\s+de)\D{0,32}(0?[1-9]|1[0-2])\D{0,8}(20\d{2})\b/g);
    for (const match of labelledMatches) {
      addCompetenceCandidate(candidates, monthLabel(match[1], match[2]), 95 * weight, item.source, "rotulo_mes_ano");
    }

    const labelledYearFirstMatches = text.matchAll(/\b(?:competencia|comp|periodo\s+de\s+apuracao|apuracao|referencia|ref|pa|mes\s+referencia|mes\s+base)\D{0,32}(20\d{2})\D{0,8}(0?[1-9]|1[0-2])\b/g);
    for (const match of labelledYearFirstMatches) {
      addCompetenceCandidate(candidates, monthLabel(match[2], match[1]), 92 * weight, item.source, "rotulo_ano_mes");
    }

    const compactLabelledMatches = text.matchAll(/\b(?:competencia|comp|periodo\s+de\s+apuracao|apuracao|referencia|ref|pa|mes\s+referencia|mes\s+base)\D{0,24}((0[1-9]|1[0-2])(20\d{2}))\b/g);
    for (const match of compactLabelledMatches) {
      addCompetenceCandidate(candidates, monthLabel(match[2], match[3]), 94 * weight, item.source, "rotulo_compacto");
    }

    const quarterMatches = text.matchAll(/\b([1-4])\s*(?:o|º|°|Âº|Â°)?\s*trimestre\D{0,16}(20\d{2})\b/g);
    for (const match of quarterMatches) {
      const quarter = Number(match[1]);
      const month = String(quarter * 3).padStart(2, "0");
      addCompetenceCandidate(candidates, `${match[2]}-${month}`, 88 * weight, item.source, "trimestre");
    }

    const quarterYearFirstMatches = text.matchAll(/\b(20\d{2})\D{0,16}([1-4])\s*(?:o|º|°|Âº|Â°)?\s*trimestre\b/g);
    for (const match of quarterYearFirstMatches) {
      const quarter = Number(match[2]);
      const month = String(quarter * 3).padStart(2, "0");
      addCompetenceCandidate(candidates, `${match[1]}-${month}`, 86 * weight, item.source, "ano_trimestre");
    }

    const isoMatches = text.matchAll(/\b(20\d{2})[-_/ .](0?[1-9]|1[0-2])\b/g);
    for (const match of isoMatches) {
      const prefix = text.slice(Math.max(0, match.index - 36), match.index);
      const score = hasCompetenceContext(prefix)
        ? 86
        : item.source === "file_name"
          ? 76
          : hasDateContext(prefix)
            ? 22
            : 42;
      addCompetenceCandidate(candidates, monthLabel(match[2], match[1]), score * weight, item.source, "ano_mes");
    }

    const brMatches = text.matchAll(/\b(0?[1-9]|1[0-2])[-_/ .](20\d{2})\b/g);
    for (const match of brMatches) {
      const prefix = text.slice(Math.max(0, match.index - 36), match.index);
      const score = hasCompetenceContext(prefix)
        ? 88
        : item.source === "file_name"
          ? 78
          : hasDateContext(prefix)
            ? 20
            : 45;
      addCompetenceCandidate(candidates, monthLabel(match[1], match[2]), score * weight, item.source, "mes_ano");
    }

    const compactMatches = text.matchAll(/(?:^|[^\d])((0[1-9]|1[0-2])(20\d{2}))(?:[^\d]|$)/g);
    for (const match of compactMatches) {
      const prefix = text.slice(Math.max(0, match.index - 36), match.index);
      if (item.source === "pdf_text" && !hasCompetenceContext(prefix)) continue;
      const score = item.source === "file_name" ? 82 : item.source === "file_path" ? 68 : 72;
      addCompetenceCandidate(candidates, monthLabel(match[2], match[3]), score * weight, item.source, "compacto_mmaaaa");
    }
  }

  const ranked = new Map<string, CompetenceCandidate>();
  for (const candidate of candidates) {
    const existing = ranked.get(candidate.value);
    if (!existing || candidate.score > existing.score) {
      ranked.set(candidate.value, candidate);
    }
  }

  return Array.from(ranked.values())
    .sort((left, right) => right.score - left.score || right.value.localeCompare(left.value));
}

function detectCompetenceCandidates(...sources: string[]) {
  return detectCompetenceCandidatesDetailed(
    sources.filter(Boolean).map((value, index) => ({
      value,
      source: index === 0 ? "file_name" : index === 1 ? "file_path" : "pdf_text",
    })),
  ).map((candidate) => candidate.value);
}

function detectCompetence(text: string, filePath = "") {
  const candidates = detectCompetenceCandidates(path.basename(filePath), filePath, text);
  if (candidates.length > 0) return candidates[0];

  const normalized = normalizeReadableText(text).replace(/\s+/g, " ");
  const isoMatch = normalized.match(/\b(20\d{2})[-/](0[1-9]|1[0-2])\b/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}`;
  }

  const brMatch = normalized.match(/\b(0[1-9]|1[0-2])[/-](20\d{2})\b/);
  if (brMatch) {
    return `${brMatch[2]}-${brMatch[1]}`;
  }

  return null;
}

function tokenize(text: string) {
  const ignoredTokens = new Set([
    "pagina",
    "documento",
    "arquivo",
    "valor",
    "data",
    "codigo",
    "numero",
    "cnpj",
    "cpf",
  ]);

  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3 && !/^\d+$/.test(token) && !ignoredTokens.has(token));
}

function buildKeywordStats(tokens: string[]) {
  const counts = new Map<string, number>();
  for (const token of tokens) {
    counts.set(token, (counts.get(token) || 0) + 1);
  }

  return Array.from(counts.entries())
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 20)
    .map(([token]) => token);
}

function buildDocumentAnalysisTokens(extractedText: string) {
  return tokenize(extractedText);
}

async function ensureParentDir(filePath: string) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const content = await fs.readFile(filePath, "utf8");
    return JSON.parse(content) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return fallback;
    }
    throw error;
  }
}

async function writeJsonFile(filePath: string, value: unknown) {
  await ensureParentDir(filePath);
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function computeFileHash(filePath: string) {
  const buffer = await fs.readFile(filePath);
  return createHash("sha256").update(buffer).digest("hex");
}

type PdfTextItem = {
  str: string;
  transform: number[];
  width: number;
  height: number;
  hasEOL?: boolean;
};

type PositionedTextPage = {
  page: number;
  width: number;
  height: number;
  items: Array<{
    text: string;
    x: number;
    y: number;
    width: number;
    height: number;
  }>;
};

function isPdfTextItem(value: unknown): value is PdfTextItem {
  return Boolean(
    value &&
    typeof value === "object" &&
    "str" in value &&
    typeof (value as { str?: unknown }).str === "string" &&
    Array.isArray((value as { transform?: unknown }).transform),
  );
}

function buildPageText(items: PdfTextItem[]) {
  const positioned = items
    .map((item) => ({
      text: normalizeReadableText(item.str),
      x: Number(item.transform[4] || 0),
      y: Number(item.transform[5] || 0),
      width: Number(item.width || 0),
      height: Number(item.height || Math.abs(Number(item.transform[3] || 0)) || 10),
      hasEOL: Boolean(item.hasEOL),
    }))
    .filter((item) => item.text.length > 0)
    .sort((left, right) => Math.abs(right.y - left.y) > 2 ? right.y - left.y : left.x - right.x);

  const lines: Array<typeof positioned> = [];
  for (const item of positioned) {
    const line = lines.find((current) => Math.abs((current[0]?.y || 0) - item.y) <= Math.max(2, item.height * 0.45));
    if (line) {
      line.push(item);
    } else {
      lines.push([item]);
    }
  }

  return lines
    .map((line) => {
      const ordered = line.sort((left, right) => left.x - right.x);
      let cursor = ordered[0]?.x || 0;
      const pieces: string[] = [];

      for (const item of ordered) {
        const gap = item.x - cursor;
        if (pieces.length > 0 && gap > Math.max(3, item.height * 0.35)) {
          pieces.push(" ");
        }
        pieces.push(item.text);
        cursor = item.x + item.width;
        if (item.hasEOL) pieces.push("\n");
      }

      return pieces.join("").replace(/[ \t]{2,}/g, " ").trim();
    })
    .filter(Boolean)
    .join("\n");
}

function buildPositionedTextPage(pageNumber: number, pageWidth: number, pageHeight: number, items: PdfTextItem[]): PositionedTextPage {
  const positionedItems = items
    .map((item) => {
      const text = normalizeReadableText(item.str);
      const width = Number(item.width || 0);
      const height = Number(item.height || Math.abs(Number(item.transform[3] || 0)) || 8);
      const x = Number(item.transform[4] || 0);
      const y = Number(item.transform[5] || 0);
      if (!text || pageWidth <= 0 || pageHeight <= 0) return null;
      return {
        text,
        x: Math.max(0, Math.min(1, x / pageWidth)),
        y: Math.max(0, Math.min(1, (pageHeight - y - height) / pageHeight)),
        width: Math.max(0.001, Math.min(1, width / pageWidth)),
        height: Math.max(0.001, Math.min(1, height / pageHeight)),
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  return {
    page: pageNumber,
    width: pageWidth,
    height: pageHeight,
    items: positionedItems,
  };
}

function bucketNumber(value: number, step: number) {
  if (!Number.isFinite(value) || value <= 0) return "0";
  return String(Math.round(value / step) * step);
}

function normalizeLayoutLabel(value: string) {
  return normalizeReadableText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function buildLineLayoutPattern(line: string) {
  const compact = normalizeReadableText(line);
  const tokenCount = compact.split(/\s+/).filter(Boolean).length;
  const numberCount = (compact.match(/\d+/g) || []).length;
  const punctuation = Array.from(new Set((compact.match(/[.:/%$,-]/g) || []).slice(0, 8))).join("");
  const hasCurrency = /R\$/i.test(compact) || /\bvalor\b/i.test(compact);
  const hasDate = /\d{1,2}[/. -]\d{1,2}[/. -]\d{2,4}/.test(compact) || /\d{1,2}[/. -]\d{4}/.test(compact);

  return [
    `len:${bucketNumber(compact.length, 12)}`,
    `tok:${bucketNumber(tokenCount, 2)}`,
    `num:${bucketNumber(numberCount, 1)}`,
    punctuation ? `p:${punctuation}` : "p:none",
    hasCurrency ? "money" : null,
    hasDate ? "date" : null,
  ].filter(Boolean).join("|");
}

function extractLayoutFieldLabels(lines: string[]) {
  const labels = lines
    .map((line) => {
      const match = line.match(/^([^:]{3,48}):/);
      if (match) return normalizeLayoutLabel(match[1]);
      const knownField = line.match(/\b(cnpj|cpf|competencia|referencia|periodo|vencimento|valor|codigo|salario|funcionario|empregado|empresa)\b/i);
      return knownField ? normalizeLayoutLabel(knownField[1]) : "";
    })
    .filter((label) => label.length >= 3);

  return Array.from(new Set(labels)).slice(0, 40);
}

function buildLayoutSignature(pageTexts: string[], pageCount: number, text: string) {
  const pages = pageTexts.length > 0 ? pageTexts : [text];
  const allLines = pages
    .flatMap((pageText) => pageText.split(/\r?\n/))
    .map((line) => normalizeReadableText(line))
    .filter(Boolean);

  return {
    version: 1,
    page_count: pageCount,
    line_count: allLines.length,
    char_count_bucket: bucketNumber(normalizeReadableText(text).length, 200),
    page_patterns: pages
      .map((pageText) =>
        pageText
          .split(/\r?\n/)
          .map((line) => normalizeReadableText(line))
          .filter(Boolean)
          .slice(0, 30)
          .map(buildLineLayoutPattern)
          .join(" > "),
      )
      .filter(Boolean)
      .slice(0, 5),
    line_patterns: allLines.slice(0, 80).map(buildLineLayoutPattern),
    field_labels: extractLayoutFieldLabels(allLines),
  };
}

async function extractPdfText(filePath: string) {
  const data = await fs.readFile(filePath);
  const pdf = await getDocument({ data: new Uint8Array(data), useSystemFonts: true }).promise;
  const chunks: string[] = [];
  const pageTexts: string[] = [];
  const positionedTextPages: PositionedTextPage[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1 });
    const textContent = await page.getTextContent({ disableNormalization: false });
    const items = (textContent.items as unknown[]).filter(isPdfTextItem);
    if (items.length > 0) {
      const pageText = buildPageText(items);
      pageTexts.push(pageText);
      chunks.push(`--- pagina ${pageNumber} ---\n${pageText}`);
      positionedTextPages.push(buildPositionedTextPage(pageNumber, viewport.width, viewport.height, items));
    }
  }

  await pdf.destroy();

  const extractedText = normalizeReadableText(chunks.join("\n\n"));
  return { extractedText, pageCount: pdf.numPages, pageTexts, positionedTextPages };
}

async function analyzePdf(filePath: string): Promise<DocumentAnalysisPayload> {
  try {
    const { extractedText, pageCount, pageTexts, positionedTextPages } = await extractPdfText(filePath);
    const normalizedText = normalizeReadableText(extractedText);
    const flattenedText = normalizedText.replace(/\s+/g, " ").trim();
    const preview = flattenedText ? flattenedText.slice(0, 500) : null;
    const tokens = buildDocumentAnalysisTokens(normalizedText);
    const keywords = buildKeywordStats(tokens);
    const cnpjCandidates = detectCnpjCandidates(normalizedText);
    const detailedCompetenceCandidates = detectCompetenceCandidatesDetailed([
      { value: normalizedText, source: "pdf_text" },
    ]);
    const competenceCandidates = detailedCompetenceCandidates.map((candidate) => candidate.value);

    return {
      extracted_text: normalizedText || null,
      extracted_text_preview: preview,
      detected_cnpj: cnpjCandidates[0] || null,
      competence_detected: competenceCandidates[0] || detectCompetence(normalizedText, filePath),
      text_extraction_status: normalizedText ? "completed" : "failed",
      ocr_status: normalizedText ? "not_needed" : "failed",
      fingerprint_payload: {
        version: 3,
        page_count: pageCount,
        extracted_chars: normalizedText.length,
        line_count: normalizedText.split(/\r?\n/).filter((line) => line.trim()).length,
        layout_signature: buildLayoutSignature(pageTexts, pageCount, normalizedText),
        positioned_text_pages: positionedTextPages,
        frequent_tokens: keywords,
        detected_cnpjs: cnpjCandidates,
        competence_candidates: competenceCandidates,
        competence_candidate_details: detailedCompetenceCandidates.slice(0, 8),
        detection_sources: ["pdf_text", "model_zones"],
        title_guess: preview ? preview.slice(0, 120) : null,
      },
      keywords,
      primary_cues: keywords.slice(0, 8),
    };
  } catch (error) {
    return {
      extracted_text: null,
      extracted_text_preview: null,
      detected_cnpj: null,
      competence_detected: null,
      text_extraction_status: "failed",
      ocr_status: "failed",
      fingerprint_payload: {
        version: 1,
        error: error instanceof Error ? error.message : "Falha desconhecida na leitura do PDF",
      },
      keywords: [],
      primary_cues: [],
    };
  }
}

async function walkPdfFiles(rootDir: string): Promise<string[]> {
  const failedFolderName = "nao_processado";
  const absoluteRoot = path.resolve(rootDir);
  const pending = [absoluteRoot];
  const pdfFiles: string[] = [];

  while (pending.length > 0) {
    const current = pending.pop();
    if (!current) continue;

    let entries: Array<{ name: string; isDirectory(): boolean; isFile(): boolean }> = [];
    try {
      entries = (await fs.readdir(current, { withFileTypes: true })).map((entry) => ({
        name: String(entry.name),
        isDirectory: () => entry.isDirectory(),
        isFile: () => entry.isFile(),
      }));
    } catch (error) {
      console.warn(`[robot] Nao foi possivel ler ${current}:`, error);
      continue;
    }

    for (const entry of entries) {
      const entryName = entry.name;
      const fullPath = path.join(current, entryName);
      if (entry.isDirectory()) {
        if (entryName.toLocaleLowerCase("pt-BR") === failedFolderName) {
          continue;
        }
        pending.push(fullPath);
        continue;
      }
      if (entry.isFile() && path.extname(entryName).toLowerCase() === ".pdf") {
        pdfFiles.push(fullPath);
      }
    }
  }

  return pdfFiles;
}

function isPathInsideRoot(rootDir: string, candidatePath: string) {
  const relative = path.relative(path.resolve(rootDir), path.resolve(candidatePath));
  return relative === "" || (
    relative !== ".."
    && !relative.startsWith(`..${path.sep}`)
    && !path.isAbsolute(relative)
  );
}

async function removeProcessedFile(filePath: string) {
  try {
    await fs.unlink(filePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }
}

async function moveToFailedFolder(config: RobotConfig, filePath: string) {
  const absoluteFilePath = path.resolve(filePath);
  const sourceRoot = config.folders
    .filter((folder) => isPathInsideRoot(folder, absoluteFilePath))
    .sort((left, right) => right.length - left.length)[0];

  if (!sourceRoot) {
    throw new Error("Arquivo fora das pastas monitoradas; movimentacao recusada por seguranca.");
  }

  const failedDirectory = path.resolve(sourceRoot, "nao_processado");
  if (!isPathInsideRoot(sourceRoot, failedDirectory)) {
    throw new Error("Destino de falha invalido; movimentacao recusada por seguranca.");
  }

  await fs.mkdir(failedDirectory, { recursive: true });
  const extension = path.extname(absoluteFilePath);
  const baseName = path.basename(absoluteFilePath, extension);
  let destination = path.join(failedDirectory, path.basename(absoluteFilePath));

  try {
    await fs.access(destination);
    destination = path.join(failedDirectory, `${baseName}-${Date.now()}${extension}`);
  } catch {
    // O nome original esta disponivel.
  }

  await fs.rename(absoluteFilePath, destination);
  return destination;
}

async function uploadPdf(
  supabase: SupabaseClient,
  config: RobotConfig,
  filePath: string,
  fileHash: string,
) {
  const fileName = path.basename(filePath);
  const extension = path.extname(fileName) || ".pdf";
  const yearMonth = new Date().toISOString().slice(0, 7).replace("-", "/");
  const storagePath = `${config.storagePrefix || DEFAULT_PREFIX}/${config.machineId}/${yearMonth}/${fileHash}${extension.toLowerCase()}`;
  const content = await fs.readFile(filePath);
  const bucket = config.storageBucket || DEFAULT_BUCKET;
  const storageDirectory = path.posix.dirname(storagePath);
  const storageFileName = path.posix.basename(storagePath);
  const storage = supabase.storage.from(bucket);
  const { data: existingFiles, error: listError } = await storage.list(storageDirectory, {
    limit: 1,
    search: storageFileName,
  });

  if (listError) {
    throw new Error(`Falha ao consultar o storage: ${listError.message}`);
  }

  const alreadyUploaded = (existingFiles || []).some((item) => item.name === storageFileName);

  const { error } = alreadyUploaded
    ? { error: null }
    : await storage.upload(storagePath, content, {
      contentType: "application/pdf",
      upsert: false,
    });

  if (error) {
    throw new Error(`Falha no upload para o storage: ${error.message}`);
  }

  return {
    bucket,
    storagePath,
    fileSize: content.byteLength,
    fileName,
  };
}

async function authenticateRobot(config: RobotConfig) {
  const password = config.robotUserPassword;
  if (!password) {
    throw new Error("Senha do usuario do robo nao informada.");
  }

  const supabase = createClient(config.supabaseUrl, config.supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const { error } = await supabase.auth.signInWithPassword({
    email: config.robotUserEmail,
    password,
  });

  if (error) {
    throw new Error(`Falha na autenticacao do robo: ${error.message}`);
  }

  return supabase;
}

function buildDefaultState(): RobotState {
  return {
    files: {},
    lastScanAt: null,
  };
}

function buildStateEntry(filePath: string, fileSize: number, lastModifiedMs: number): RobotFileState {
  return {
    submissionId: randomUUID(),
    filePath: path.resolve(filePath),
    fileName: path.basename(filePath),
    status: "na_fila",
    fileHash: null,
    fileSize,
    lastModifiedMs,
    retries: 0,
    nextRetryAt: null,
    lastError: null,
    remoteInboxItemId: null,
    remoteIngestionJobId: null,
    remoteStatus: null,
    localFilePresent: true,
    updatedAt: new Date().toISOString(),
  };
}

function shouldProcessEntry(entry: RobotFileState, now: Date, maxRetries: number) {
  // The scan may discover that a user, another cycle or the successful cleanup
  // already removed the file. Never execute a stale queued entry in that case.
  if (entry.localFilePresent === false) {
    return false;
  }
  if (entry.status === "processado" || entry.status === "enviado") {
    return false;
  }
  if (entry.status === "falhou" && entry.retries >= maxRetries) {
    return false;
  }
  if (!entry.nextRetryAt) {
    return entry.status === "na_fila" || entry.status === "reprocessar" || entry.status === "falhou";
  }
  return new Date(entry.nextRetryAt) <= now;
}

async function syncScanState(config: RobotConfig, state: RobotState) {
  const seenKeys = new Set<string>();

  for (const folder of config.folders) {
    const files = await walkPdfFiles(folder);
    for (const filePath of files) {
      const absolutePath = path.resolve(filePath);
      const stats = await fs.stat(absolutePath);
      const key = normalizeFileKey(absolutePath);
      seenKeys.add(key);
      const existing = state.files[key];

      if (!existing) {
        state.files[key] = buildStateEntry(absolutePath, stats.size, stats.mtimeMs);
        continue;
      }

      if (existing.status === "processado" || existing.status === "enviado") {
        if (existing.localFilePresent === true) {
          try {
            await removeProcessedFile(absolutePath);
            state.files[key] = {
              ...existing,
              localFilePresent: false,
              lastError: null,
              updatedAt: new Date().toISOString(),
            };
          } catch (cleanupError) {
            const cleanupMessage = cleanupError instanceof Error ? cleanupError.message : "Falha desconhecida na remocao";
            state.files[key] = {
              ...existing,
              lastError: `Envio concluido, mas o arquivo local nao foi removido: ${cleanupMessage}`,
              updatedAt: new Date().toISOString(),
            };
          }
          continue;
        }

        // O arquivo ja havia desaparecido apos um envio confirmado e voltou a
        // existir. Ele representa uma nova entrada, mesmo com metadados iguais.
        state.files[key] = buildStateEntry(absolutePath, stats.size, stats.mtimeMs);
        continue;
      }

      // A pending/failed file may be removed and later placed back with the
      // same size and preserved modification date. Presence, not mtime, is the
      // signal that this is a new local attempt.
      if (existing.localFilePresent === false) {
        state.files[key] = buildStateEntry(absolutePath, stats.size, stats.mtimeMs);
        continue;
      }

      if (existing.fileSize !== stats.size || existing.lastModifiedMs !== stats.mtimeMs) {
        state.files[key] = buildStateEntry(absolutePath, stats.size, stats.mtimeMs);
      }
    }
  }

  for (const [key, entry] of Object.entries(state.files)) {
    const belongsToMonitoredFolder = config.folders.some((folder) => isPathInsideRoot(folder, entry.filePath));
    if (belongsToMonitoredFolder && !seenKeys.has(key) && entry.localFilePresent !== false) {
      state.files[key] = {
        ...entry,
        localFilePresent: false,
        updatedAt: new Date().toISOString(),
      };
    }
  }

  state.lastScanAt = new Date().toISOString();
}

async function processQueuedEntries(
  supabase: SupabaseClient,
  config: RobotConfig,
  state: RobotState,
) {
  const now = new Date();
  const entries = Object.entries(state.files)
    .filter(([, entry]) => shouldProcessEntry(entry, now, config.maxRetries || DEFAULT_MAX_RETRIES))
    .sort((left, right) => left[1].updatedAt.localeCompare(right[1].updatedAt));

  for (const [key, entry] of entries) {
    try {
      const fileHash = await computeFileHash(entry.filePath);
      const upload = await uploadPdf(supabase, config, entry.filePath, fileHash);
      const analysis = await analyzePdf(entry.filePath);

      const { data, error } = await supabase.functions.invoke("grow-obligations-module", {
        body: {
          action: "register_robot_document_upload",
          file_name: upload.fileName,
          storage_bucket: upload.bucket,
          storage_path: upload.storagePath,
          file_size: upload.fileSize,
          content_type: "application/pdf",
          source_kind: "local_robot",
          file_hash: fileHash,
          robot_origin_path: toPosixPath(entry.filePath),
          robot_machine_id: config.machineId,
          robot_submission_id: entry.submissionId,
          analysis,
        },
      });

      if (error) {
        const context = (error as { context?: Response }).context;
        const responseDetails = context ? await context.clone().text().catch(() => "") : "";
        throw new Error([error.message, responseDetails].filter(Boolean).join(" - "));
      }

      const response = (data || {}) as Record<string, unknown>;
      const processingResult = (response.processing_result || {}) as Record<string, unknown>;
      const inboxItem = (response.inbox_item || {}) as Record<string, unknown>;
      const ingestionJob = (response.ingestion_job || {}) as Record<string, unknown>;
      const match = (response.match || {}) as Record<string, unknown>;
      const duplicate = response.duplicate === true;
      const confirmedRemoteRecord = duplicate
        ? typeof ingestionJob.id === "string" && ingestionJob.id.length > 0
        : typeof inboxItem.id === "string" && inboxItem.id.length > 0;

      if (response.ok !== true || !confirmedRemoteRecord) {
        throw new Error("O servidor nao confirmou o registro do documento na Central. O arquivo local sera preservado para nova tentativa.");
      }

      const duplicateCompleted = duplicate
        && ingestionJob.status === "completed"
        && ["sent", "not_applicable"].includes(String(ingestionJob.communication_status || ""));
      const processed = duplicateCompleted || processingResult.processed === true;
      const awaitingReview = inboxItem.status === "pending_review"
        || match.reviewRequired === true
        || ingestionJob.status === "review_required";

      if (!processed) {
        const deliveryError = typeof processingResult.deliveryError === "string" ? processingResult.deliveryError : null;
        throw new Error(deliveryError || (awaitingReview
          ? "O documento foi recebido, mas ainda depende de revisao e nao foi entregue ao cliente."
          : "O documento foi recebido, mas o processamento e a entrega ainda nao foram concluidos."));
      }

      state.files[key] = {
        ...entry,
        fileHash,
        fileSize: upload.fileSize,
        status: "processado",
        retries: 0,
        nextRetryAt: null,
        lastError: null,
        remoteInboxItemId: typeof inboxItem.id === "string" ? inboxItem.id : null,
        remoteIngestionJobId: typeof ingestionJob.id === "string" ? ingestionJob.id : null,
        remoteStatus: processed
          ? "completed"
          : awaitingReview
            ? "review_required"
            : typeof ingestionJob.status === "string"
              ? ingestionJob.status
              : "ingested",
        localFilePresent: true,
        updatedAt: new Date().toISOString(),
      };

      // Persiste a confirmacao remota antes de remover o arquivo local. Assim,
      // uma interrupcao entre as etapas nao provoca um novo envio do mesmo PDF.
      await writeJsonFile(config.stateFile, state);
      try {
        await removeProcessedFile(entry.filePath);
        state.files[key] = {
          ...state.files[key],
          localFilePresent: false,
          updatedAt: new Date().toISOString(),
        };
        console.log(`[robot] ${entry.fileName}: removido da pasta de entrada apos confirmacao do envio`);
      } catch (cleanupError) {
        const cleanupMessage = cleanupError instanceof Error ? cleanupError.message : "Falha desconhecida na remocao";
        state.files[key] = {
          ...state.files[key],
          lastError: `Envio concluido, mas o arquivo local nao foi removido: ${cleanupMessage}`,
          updatedAt: new Date().toISOString(),
        };
        console.warn(`[robot] ${entry.fileName}: envio concluido, mas nao foi possivel remover o arquivo local: ${cleanupMessage}`);
      }

      const logSuffix = duplicate
        ? "duplicado e reaproveitado"
        : processed
          ? "processado automaticamente"
          : awaitingReview
            ? "enviado para revisao"
            : "enviado";
      console.log(`[robot] ${entry.fileName}: ${logSuffix}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha desconhecida";
      const retries = entry.retries + 1;
      const exhausted = retries >= (config.maxRetries || DEFAULT_MAX_RETRIES);
      let failedFilePath = entry.filePath;
      let finalError = message;

      if (exhausted) {
        try {
          failedFilePath = await moveToFailedFolder(config, entry.filePath);
          console.error(`[robot] ${entry.fileName}: movido para ${failedFilePath} apos esgotar as tentativas`);
        } catch (moveError) {
          const moveMessage = moveError instanceof Error ? moveError.message : "Falha desconhecida na movimentacao";
          finalError = `${message} | Nao foi possivel mover para nao_processado: ${moveMessage}`;
        }
      }
      state.files[key] = {
        ...entry,
        filePath: failedFilePath,
        status: exhausted ? "falhou" : "reprocessar",
        retries,
        nextRetryAt: exhausted ? null : new Date(Date.now() + (config.retryDelayMs || DEFAULT_RETRY_DELAY_MS)).toISOString(),
        lastError: finalError,
        updatedAt: new Date().toISOString(),
      };
      console.error(`[robot] Falha ao processar ${entry.fileName}: ${message}`);
    }

    await writeJsonFile(config.stateFile, state);
  }
}

async function runRobot(config: RobotConfig) {
  const supabase = await authenticateRobot(config);
  const state = await readJsonFile<RobotState>(config.stateFile, buildDefaultState());

  console.log(`[robot] Grow Document Robot iniciado em ${new Date().toISOString()}`);
  console.log(`[robot] Maquina: ${config.machineId}`);
  console.log(`[robot] Pastas monitoradas: ${config.folders.map((folder) => path.resolve(folder)).join(" | ")}`);

  while (true) {
    try {
      await syncScanState(config, state);
      await writeJsonFile(config.stateFile, state);
      await processQueuedEntries(supabase, config, state);
      await writeJsonFile(config.stateFile, state);
    } catch (error) {
      console.error("[robot] Falha no ciclo principal:", error);
    }

    await sleep(config.scanIntervalMs || DEFAULT_SCAN_INTERVAL_MS);
  }
}

async function main() {
  const configArg = process.argv[2];
  const configPath = path.resolve(configArg || "tools/grow-document-robot/config.example.json");
  const config = await readJsonFile<RobotConfig>(configPath, {} as RobotConfig);
  config.robotUserPassword = process.env.GROW_ROBOT_PASSWORD || config.robotUserPassword;

  if (!config.supabaseUrl || !config.supabaseAnonKey || !config.robotUserEmail || !config.robotUserPassword || !config.machineId || !config.stateFile || !config.folders?.length) {
    throw new Error("Configuração do robô incompleta. Revise o arquivo JSON informado.");
  }

  config.stateFile = path.resolve(path.dirname(configPath), config.stateFile);
  config.folders = config.folders.map((folder) => path.resolve(folder));

  if (process.argv.includes("--check")) {
    await authenticateRobot(config);
    await Promise.all(config.folders.map((folder) => fs.mkdir(folder, { recursive: true })));
    console.log("[robot] Configuracao, autenticacao e pastas validadas com sucesso.");
    return;
  }

  await runRobot(config);
}

main().catch((error) => {
  console.error("[robot] Encerrado com erro fatal:", error);
  process.exit(1);
});
