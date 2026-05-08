export type DocumentFingerprint = {
  probable_title: string | null;
  top_tokens: string[];
  key_phrases: string[];
  page_count: number;
  line_count: number;
  char_count: number;
  detected_fields: string[];
};

export type AnalyzedDocument = {
  file_name: string;
  extracted_text: string;
  extracted_text_preview: string;
  text_extraction_status: "completed" | "failed";
  ocr_status: "not_needed" | "completed" | "failed";
  detected_cnpj: string | null;
  competence_detected: string | null;
  fingerprint_payload: DocumentFingerprint;
  keywords: string[];
  primary_cues: string[];
};

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
  "para",
  "com",
  "sem",
  "que",
  "por",
  "em",
  "ref",
  "referencia",
  "competencia",
  "periodo",
  "pagina",
  "documento",
]);

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeToken(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function getFileExtension(fileName: string) {
  const parts = fileName.toLowerCase().split(".");
  return parts.length > 1 ? parts[parts.length - 1] : "";
}

function normalizeCnpj(value: string | null | undefined) {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  return digits.length === 14 ? digits : null;
}

function extractCnpj(rawText: string) {
  const cnpjPattern = /\d{2}[.\s]?\d{3}[.\s]?\d{3}[/\s]?\d{4}[-\s]?\d{2}/g;
  const directMatch = rawText.match(cnpjPattern);
  if (directMatch?.[0]) {
    return normalizeCnpj(directMatch[0]);
  }

  const digitsOnlyPattern = /(?:^|[^0-9])(\d{14})(?:[^0-9]|$)/;
  const digitsMatch = rawText.match(digitsOnlyPattern);
  if (digitsMatch?.[1]) {
    return normalizeCnpj(digitsMatch[1]);
  }

  return null;
}

function toCompetence(year: string, month: string) {
  const monthValue = Number(month);
  const yearValue = Number(year);
  if (!Number.isFinite(monthValue) || !Number.isFinite(yearValue)) return null;
  if (monthValue < 1 || monthValue > 12) return null;
  if (yearValue < 2000 || yearValue > 2100) return null;
  return `${yearValue}-${String(monthValue).padStart(2, "0")}`;
}

function extractCompetence(rawText: string) {
  const text = rawText.replace(/\s+/g, " ");
  const yearMonthPattern = /(?:competencia|periodo|ref(?:erencia)?)?\s*[:-]?\s*(20\d{2})[/_.-]?(0[1-9]|1[0-2])/i;
  const monthYearPattern = /(?:competencia|periodo|ref(?:erencia)?)?\s*[:-]?\s*(0[1-9]|1[0-2])[/_.-](20\d{2})/i;
  const compactMonthYearPattern = /(?:^|[^0-9])(0[1-9]|1[0-2])(20\d{2})(?:[^0-9]|$)/;
  const compactYearMonthPattern = /(?:^|[^0-9])(20\d{2})(0[1-9]|1[0-2])(?:[^0-9]|$)/;

  const yearMonthMatch = text.match(yearMonthPattern);
  if (yearMonthMatch) return toCompetence(yearMonthMatch[1], yearMonthMatch[2]);

  const monthYearMatch = text.match(monthYearPattern);
  if (monthYearMatch) return toCompetence(monthYearMatch[2], monthYearMatch[1]);

  const compactMonthYearMatch = text.match(compactMonthYearPattern);
  if (compactMonthYearMatch) return toCompetence(compactMonthYearMatch[2], compactMonthYearMatch[1]);

  const compactYearMonthMatch = text.match(compactYearMonthPattern);
  if (compactYearMonthMatch) return toCompetence(compactYearMonthMatch[1], compactYearMonthMatch[2]);

  return null;
}

function tokenize(value: string) {
  return normalizeToken(value)
    .split(" ")
    .filter((token) => token.length >= 3 && !tokenStopwords.has(token));
}

function extractPrimaryCues(text: string) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => normalizeWhitespace(line))
    .filter(Boolean)
    .slice(0, 12);

  return Array.from(new Set(lines.filter((line) => line.length >= 8))).slice(0, 8);
}

function buildFingerprint(text: string, pageCount: number): DocumentFingerprint {
  const compactText = normalizeWhitespace(text);
  const lines = text
    .split(/\r?\n/)
    .map((line) => normalizeWhitespace(line))
    .filter(Boolean);

  const title = lines.find((line) => line.length >= 8 && line.length <= 120) || null;

  const tokenFrequency = new Map<string, number>();
  for (const token of tokenize(compactText)) {
    tokenFrequency.set(token, (tokenFrequency.get(token) || 0) + 1);
  }

  const topTokens = [...tokenFrequency.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 20)
    .map(([token]) => token);

  const keyPhrases = Array.from(new Set(lines.filter((line) => line.length >= 16))).slice(0, 10);
  const detectedFields = [
    extractCnpj(compactText) ? "cnpj" : null,
    extractCompetence(compactText) ? "competence" : null,
    /folha/i.test(compactText) ? "folha" : null,
    /fiscal/i.test(compactText) ? "fiscal" : null,
    /relatorio/i.test(compactText) ? "relatorio" : null,
  ].filter((item): item is string => Boolean(item));

  return {
    probable_title: title,
    top_tokens: topTokens,
    key_phrases: keyPhrases,
    page_count: pageCount,
    line_count: lines.length,
    char_count: compactText.length,
    detected_fields: detectedFields,
  };
}

async function loadPdfJs() {
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
          getViewport: (params: { scale: number }) => { width: number; height: number };
          render: (params: { canvasContext: CanvasRenderingContext2D; viewport: { width: number; height: number } }) => {
            promise: Promise<void>;
          };
          getTextContent: () => Promise<{ items: Array<{ str?: string }> }>;
        }>;
      }>;
    };
  };

  if (pdfJs.GlobalWorkerOptions) {
    pdfJs.GlobalWorkerOptions.workerSrc =
      (pdfWorkerModule as { default?: string }).default || "pdf.worker.min.mjs";
  }

  return pdfJs;
}

async function parsePdfText(file: File) {
  const pdfJs = await loadPdfJs();
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

  return {
    text: pages.join("\n"),
    pageCount: Math.min(pdf.numPages, maxPages),
    fileData,
    pdf,
    pdfJs,
  };
}

async function runOcrFromBlob(blob: Blob) {
  const tesseractModule = await import("tesseract.js");
  const recognize =
    (tesseractModule as { recognize?: (...args: unknown[]) => Promise<unknown> }).recognize ||
    (tesseractModule as { default?: { recognize?: (...args: unknown[]) => Promise<unknown> } }).default?.recognize;

  if (!recognize) {
    throw new Error("OCR indisponivel neste navegador.");
  }

  const result = (await recognize(blob, "por+eng")) as { data?: { text?: string } };
  return normalizeWhitespace(result?.data?.text || "");
}

async function renderPdfPageToBlob(page: {
  getViewport: (params: { scale: number }) => { width: number; height: number };
  render: (params: { canvasContext: CanvasRenderingContext2D; viewport: { width: number; height: number } }) => { promise: Promise<void> };
}) {
  const viewport = page.getViewport({ scale: 1.5 });
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas 2D indisponivel.");

  await page.render({ canvasContext: context, viewport }).promise;

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Nao foi possivel gerar imagem da pagina para OCR."));
        return;
      }
      resolve(blob);
    }, "image/png");
  });
}

async function parsePdfWithOcrFallback(file: File) {
  const pdfResult = await parsePdfText(file);
  const initialText = normalizeWhitespace(pdfResult.text);

  if (initialText.length >= 80) {
    return {
      text: initialText,
      pageCount: pdfResult.pageCount,
      textExtractionStatus: "completed" as const,
      ocrStatus: "not_needed" as const,
    };
  }

  const ocrPages: string[] = [];
  try {
    const ocrMaxPages = Math.min(pdfResult.pageCount, 3);
    for (let pageNumber = 1; pageNumber <= ocrMaxPages; pageNumber += 1) {
      const page = await pdfResult.pdf.getPage(pageNumber);
      const blob = await renderPdfPageToBlob(page);
      const pageText = await runOcrFromBlob(blob);
      if (pageText) ocrPages.push(pageText);
    }
  } catch {
    return {
      text: initialText,
      pageCount: pdfResult.pageCount,
      textExtractionStatus: initialText ? ("completed" as const) : ("failed" as const),
      ocrStatus: "failed" as const,
    };
  }

  const mergedText = normalizeWhitespace([initialText, ...ocrPages].filter(Boolean).join("\n"));
  return {
    text: mergedText,
    pageCount: pdfResult.pageCount,
    textExtractionStatus: mergedText ? ("completed" as const) : ("failed" as const),
    ocrStatus: ocrPages.length > 0 ? ("completed" as const) : ("failed" as const),
  };
}

export async function analyzePdfDocument(file: File): Promise<AnalyzedDocument> {
  if (getFileExtension(file.name) !== "pdf") {
    throw new Error("A V1 aceita apenas PDF para reconhecimento inteligente.");
  }

  const parsed = await parsePdfWithOcrFallback(file);
  const text = normalizeWhitespace(parsed.text);
  const fingerprint = buildFingerprint(text, parsed.pageCount);
  const cues = extractPrimaryCues(parsed.text);
  const keywords = fingerprint.top_tokens.slice(0, 12);

  return {
    file_name: file.name,
    extracted_text: text,
    extracted_text_preview: text.slice(0, 600),
    text_extraction_status: parsed.textExtractionStatus,
    ocr_status: parsed.ocrStatus,
    detected_cnpj: extractCnpj(text),
    competence_detected: extractCompetence(text),
    fingerprint_payload: fingerprint,
    keywords,
    primary_cues: cues,
  };
}
