import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import process from "node:process";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

type RobotConfig = {
  supabaseUrl: string;
  supabaseAnonKey: string;
  robotUserEmail: string;
  robotUserPassword: string;
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

function detectCompetenceCandidates(...sources: string[]) {
  const candidates: string[] = [];
  const text = normalizeSearchText(sources.filter(Boolean).join("\n"));

  const isoMatches = text.matchAll(/\b(20\d{2})[-/](0?[1-9]|1[0-2])\b/g);
  for (const match of isoMatches) {
    candidates.push(monthLabel(match[2], match[1]));
  }

  const brMatches = text.matchAll(/\b(0?[1-9]|1[0-2])[-/](20\d{2})\b/g);
  for (const match of brMatches) {
    candidates.push(monthLabel(match[1], match[2]));
  }

  const labelledMatches = text.matchAll(/\b(?:competencia|comp|periodo de apuracao|apuracao|referencia|ref|pa)\D{0,24}(0?[1-9]|1[0-2])\D{0,4}(20\d{2})\b/g);
  for (const match of labelledMatches) {
    candidates.push(monthLabel(match[1], match[2]));
  }

  const compactMatches = text.matchAll(/(?:^|[^\d])((0[1-9]|1[0-2])(20\d{2}))(?:[^\d]|$)/g);
  for (const match of compactMatches) {
    candidates.push(monthLabel(match[2], match[3]));
  }

  const quarterMatches = text.matchAll(/\b([1-4])\s*(?:o|º|°)?\s*trimestre\D{0,12}(20\d{2})\b/g);
  for (const match of quarterMatches) {
    const quarter = Number(match[1]);
    const month = String(quarter * 3).padStart(2, "0");
    candidates.push(`${match[2]}-${month}`);
  }

  return uniqueValues(candidates);
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

async function extractPdfText(filePath: string) {
  const data = await fs.readFile(filePath);
  const pdf = await getDocument({ data: new Uint8Array(data), useSystemFonts: true }).promise;
  const chunks: string[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const textContent = await page.getTextContent({ disableNormalization: false });
    const items = (textContent.items as unknown[]).filter(isPdfTextItem);
    if (items.length > 0) {
      chunks.push(`--- pagina ${pageNumber} ---\n${buildPageText(items)}`);
    }
  }

  await pdf.destroy();

  const extractedText = normalizeReadableText(chunks.join("\n\n"));
  return { extractedText, pageCount: pdf.numPages };
}

async function analyzePdf(filePath: string): Promise<DocumentAnalysisPayload> {
  try {
    const { extractedText, pageCount } = await extractPdfText(filePath);
    const normalizedText = normalizeReadableText(extractedText);
    const flattenedText = normalizedText.replace(/\s+/g, " ").trim();
    const preview = flattenedText ? flattenedText.slice(0, 500) : null;
    const tokens = tokenize(normalizedText);
    const keywords = buildKeywordStats(tokens);
    const cnpjCandidates = detectCnpjCandidates(path.basename(filePath), filePath, normalizedText);
    const competenceCandidates = detectCompetenceCandidates(path.basename(filePath), filePath, normalizedText);

    return {
      extracted_text: normalizedText || null,
      extracted_text_preview: preview,
      detected_cnpj: cnpjCandidates[0] || null,
      competence_detected: competenceCandidates[0] || detectCompetence(normalizedText, filePath),
      text_extraction_status: normalizedText ? "extracted" : "empty",
      ocr_status: normalizedText ? "not_needed" : "not_available",
      fingerprint_payload: {
        version: 2,
        page_count: pageCount,
        extracted_chars: normalizedText.length,
        frequent_tokens: keywords,
        detected_cnpjs: cnpjCandidates,
        competence_candidates: competenceCandidates,
        detection_sources: ["file_name", "file_path", "pdf_text"],
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
      ocr_status: "not_available",
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

  const { error } = await supabase.storage
    .from(config.storageBucket || DEFAULT_BUCKET)
    .upload(storagePath, content, {
      contentType: "application/pdf",
      upsert: true,
    });

  if (error) {
    throw new Error(`Falha no upload para o storage: ${error.message}`);
  }

  return {
    bucket: config.storageBucket || DEFAULT_BUCKET,
    storagePath,
    fileSize: content.byteLength,
    fileName,
  };
}

async function authenticateRobot(config: RobotConfig) {
  const supabase = createClient(config.supabaseUrl, config.supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const { error } = await supabase.auth.signInWithPassword({
    email: config.robotUserEmail,
    password: config.robotUserPassword,
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
    updatedAt: new Date().toISOString(),
  };
}

function shouldProcessEntry(entry: RobotFileState, now: Date, maxRetries: number) {
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
  for (const folder of config.folders) {
    const files = await walkPdfFiles(folder);
    for (const filePath of files) {
      const absolutePath = path.resolve(filePath);
      const stats = await fs.stat(absolutePath);
      const key = normalizeFileKey(absolutePath);
      const existing = state.files[key];

      if (!existing) {
        state.files[key] = buildStateEntry(absolutePath, stats.size, stats.mtimeMs);
        continue;
      }

      if (existing.fileSize !== stats.size || existing.lastModifiedMs !== stats.mtimeMs) {
        state.files[key] = {
          ...buildStateEntry(absolutePath, stats.size, stats.mtimeMs),
          status: existing.status === "processado" ? "reprocessar" : "na_fila",
        };
      }
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
          analysis,
        },
      });

      if (error) {
        throw new Error(error.message);
      }

      const response = (data || {}) as Record<string, unknown>;
      const processingResult = (response.processing_result || {}) as Record<string, unknown>;
      const inboxItem = (response.inbox_item || {}) as Record<string, unknown>;
      const ingestionJob = (response.ingestion_job || {}) as Record<string, unknown>;
      const match = (response.match || {}) as Record<string, unknown>;
      const duplicate = response.duplicate === true;

      const processed = duplicate || processingResult.processed === true;
      const awaitingReview = inboxItem.status === "pending_review" || match.reviewRequired === true;

      state.files[key] = {
        ...entry,
        fileHash,
        fileSize: upload.fileSize,
        status: processed ? "processado" : awaitingReview ? "enviado" : "enviado",
        retries: 0,
        nextRetryAt: null,
        lastError: null,
        remoteInboxItemId: typeof inboxItem.id === "string" ? inboxItem.id : null,
        remoteIngestionJobId: typeof ingestionJob.id === "string" ? ingestionJob.id : null,
        remoteStatus: typeof ingestionJob.status === "string"
          ? ingestionJob.status
          : processed
            ? "completed"
            : awaitingReview
              ? "review_required"
              : "ingested",
        updatedAt: new Date().toISOString(),
      };

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
      state.files[key] = {
        ...entry,
        status: exhausted ? "falhou" : "reprocessar",
        retries,
        nextRetryAt: exhausted ? null : new Date(Date.now() + (config.retryDelayMs || DEFAULT_RETRY_DELAY_MS)).toISOString(),
        lastError: message,
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

  if (!config.supabaseUrl || !config.supabaseAnonKey || !config.robotUserEmail || !config.robotUserPassword || !config.machineId || !config.stateFile || !config.folders?.length) {
    throw new Error("Configuração do robô incompleta. Revise o arquivo JSON informado.");
  }

  config.stateFile = path.resolve(path.dirname(configPath), config.stateFile);
  config.folders = config.folders.map((folder) => path.resolve(folder));

  await runRobot(config);
}

main().catch((error) => {
  console.error("[robot] Encerrado com erro fatal:", error);
  process.exit(1);
});
