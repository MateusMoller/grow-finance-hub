import { loadPdfJsClient } from "@/lib/pdfJsClient";

export type DocumentFingerprint = {
  version?: number;
  probable_title: string | null;
  top_tokens: string[];
  key_phrases: string[];
  page_count: number;
  line_count: number;
  char_count: number;
  detected_fields: string[];
  competence_candidates?: Array<{
    value: string;
    score: number;
    source: "file_name" | "pdf_text";
    reason: string;
  }>;
  layout_signature?: {
    version: number;
    page_count: number;
    line_count: number;
    char_count_bucket: string;
    page_patterns: string[];
    line_patterns: string[];
    field_labels: string[];
  };
  extraction_zones?: {
    version: number;
    zones: Array<{
      field: "cpf" | "cnpj" | "competence" | "title";
      label: string;
      page: number;
      shape: "rounded_rect";
      x: number;
      y: number;
      width: number;
      height: number;
    }>;
  };
  positioned_text_pages?: Array<{
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
  }>;
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

function normalizeTaxIdentifier(value: string | null | undefined) {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  return digits.length === 11 || digits.length === 14 ? digits : null;
}

function extractTaxIdentifier(rawText: string) {
  const taxIdPattern = /(?:\d{3}[.\s]?\d{3}[.\s]?\d{3}[-\s]?\d{2}|\d{2}[.\s]?\d{3}[.\s]?\d{3}[/\s]?\d{4}[-\s]?\d{2})/g;
  const directMatch = rawText.match(taxIdPattern);
  if (directMatch?.[0]) {
    return normalizeTaxIdentifier(directMatch[0]);
  }

  const digitsOnlyPattern = /(?:^|[^0-9])(\d{11}|\d{14})(?:[^0-9]|$)/;
  const digitsMatch = rawText.match(digitsOnlyPattern);
  if (digitsMatch?.[1]) {
    return normalizeTaxIdentifier(digitsMatch[1]);
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

export type CompetenceSource = "file_name" | "pdf_text";

export type CompetenceCandidate = {
  value: string;
  score: number;
  source: CompetenceSource;
  reason: string;
};

function monthLabel(month: string, year: string) {
  return toCompetence(year, month.padStart(2, "0"));
}

function addCompetenceCandidate(
  candidates: CompetenceCandidate[],
  value: string | null,
  score: number,
  source: CompetenceSource,
  reason: string,
) {
  if (!value || !/^20\d{2}-(0[1-9]|1[0-2])$/.test(value)) return;
  candidates.push({ value, score, source, reason });
}

function sourceWeight(source: CompetenceSource) {
  return source === "file_name" ? 0 : 1;
}

function normalizeSearchText(value: string) {
  return value
    .normalize("NFKC")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

const competenceMonthNames: Record<string, string> = {
  janeiro: "01",
  fevereiro: "02",
  marco: "03",
  abril: "04",
  maio: "05",
  junho: "06",
  julho: "07",
  agosto: "08",
  setembro: "09",
  outubro: "10",
  novembro: "11",
  dezembro: "12",
};

function hasCompetenceContext(value: string) {
  return /\b(competencia|comp|periodo|apuracao|referencia|ref|pa|mes\s+base|mes\s+referencia|folha\s+de|salario\s+de)\b/.test(value);
}

function hasDateContext(value: string) {
  return /\b(vencimento|pagamento|emissao|emissao|data|gerado|emitido|recolhimento|validade|processamento)\b/.test(value);
}

function hasNonCompetenceDateContext(value: string) {
  return /\b(admissao|nascimento|demissao|afastamento|ferias|assinatura)\b/.test(value);
}

export function detectCompetenceCandidatesDetailed(sources: Array<{ value: string; source: CompetenceSource }>) {
  const candidates: CompetenceCandidate[] = [];

  for (const item of sources) {
    const text = normalizeSearchText(item.value);
    if (!text) continue;
    const weight = sourceWeight(item.source);

    const namedMonthMatches = text.matchAll(/\b(janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)(?:\s+de)?\D{0,8}(20\d{2})\b/g);
    for (const match of namedMonthMatches) {
      addCompetenceCandidate(candidates, `${match[2]}-${competenceMonthNames[match[1]]}`, 98 * weight, item.source, "mes_por_extenso");
    }

    const labelledFullDateMatches = text.matchAll(/\b(?:competencia|periodo|referencia|mes\s+referencia|mes\s+base|referente(?:\s+ao\s+mes|\s+data)?|folha\s+de|salario\s+de)\b\D{0,32}(0?[1-9]|[12]\d|3[01])[-_/ .](0?[1-9]|1[0-2])[-_/ .](20\d{2})\b/g);
    for (const match of labelledFullDateMatches) {
      addCompetenceCandidate(candidates, monthLabel(match[2], match[3]), 99 * weight, item.source, "rotulo_data_completa");
    }

    const labelledMatches = text.matchAll(/\b(?:competencia|comp|periodo\s+de\s+apuracao|periodo|apuracao|referencia|ref|pa|mes\s+referencia|mes\s+base|folha\s+de|salario\s+de)\b\D{0,32}(0?[1-9]|1[0-2])\D{0,8}(20\d{2})\b/g);
    for (const match of labelledMatches) {
      addCompetenceCandidate(candidates, monthLabel(match[1], match[2]), 96 * weight, item.source, "rotulo_mes_ano");
    }

    const labelledYearFirstMatches = text.matchAll(/\b(?:competencia|comp|periodo\s+de\s+apuracao|apuracao|referencia|ref|pa|mes\s+referencia|mes\s+base)\b\D{0,32}(20\d{2})\D{0,8}(0?[1-9]|1[0-2])\b/g);
    for (const match of labelledYearFirstMatches) {
      addCompetenceCandidate(candidates, monthLabel(match[2], match[1]), 94 * weight, item.source, "rotulo_ano_mes");
    }

    const compactLabelledMatches = text.matchAll(/\b(?:competencia|comp|periodo\s+de\s+apuracao|apuracao|referencia|ref|pa|mes\s+referencia|mes\s+base)\b\D{0,24}((0[1-9]|1[0-2])(20\d{2}))\b/g);
    for (const match of compactLabelledMatches) {
      addCompetenceCandidate(candidates, monthLabel(match[2], match[3]), 95 * weight, item.source, "rotulo_compacto");
    }

    const quarterMatches = text.matchAll(/\b([1-4])\s*(?:o|º|°)?\s*trimestre\D{0,16}(20\d{2})\b/g);
    for (const match of quarterMatches) {
      const month = String(Number(match[1]) * 3).padStart(2, "0");
      addCompetenceCandidate(candidates, `${match[2]}-${month}`, 88 * weight, item.source, "trimestre");
    }

    const isoMatches = text.matchAll(/\b(20\d{2})[-_/ .](0?[1-9]|1[0-2])\b/g);
    for (const match of isoMatches) {
      const prefix = text.slice(Math.max(0, match.index - 36), match.index);
      const score = hasNonCompetenceDateContext(prefix)
        ? 4
        : hasCompetenceContext(prefix)
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
      const score = hasNonCompetenceDateContext(prefix)
        ? 4
        : hasCompetenceContext(prefix)
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
      if (item.source !== "file_name" && !hasCompetenceContext(prefix)) continue;
      const score = item.source === "file_name" ? 82 : 72;
      addCompetenceCandidate(candidates, monthLabel(match[2], match[3]), score * weight, item.source, "compacto_mmaaaa");
    }
  }

  const ranked = new Map<string, CompetenceCandidate>();
  for (const candidate of candidates) {
    const existing = ranked.get(candidate.value);
    if (!existing || candidate.score > existing.score) ranked.set(candidate.value, candidate);
  }

  return Array.from(ranked.values()).sort((left, right) => right.score - left.score || right.value.localeCompare(left.value));
}

function extractCompetence(rawText: string) {
  return detectCompetenceCandidatesDetailed([{ value: rawText, source: "pdf_text" }])[0]?.value || null;
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

function bucketNumber(value: number, step: number) {
  if (!Number.isFinite(value) || value <= 0) return "0";
  return String(Math.round(value / step) * step);
}

function buildLineLayoutPattern(line: string) {
  const compact = normalizeWhitespace(line);
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

function extractFieldLabels(lines: string[]) {
  const labels = lines
    .map((line) => {
      const match = line.match(/^([^:]{3,48}):/);
      if (match) return normalizeToken(match[1]);
      const knownField = line.match(/\b(cnpj|cpf|competencia|referencia|periodo|vencimento|valor|codigo|salario|funcionario|empregado|empresa)\b/i);
      return knownField ? normalizeToken(knownField[1]) : "";
    })
    .filter((label) => label.length >= 3);

  return Array.from(new Set(labels)).slice(0, 40);
}

function buildLayoutSignature(pageTexts: string[], pageCount: number, text: string) {
  const pages = pageTexts.length > 0 ? pageTexts : [text];
  const allLines = pages
    .flatMap((pageText) => pageText.split(/\r?\n/))
    .map((line) => normalizeWhitespace(line))
    .filter(Boolean);

  return {
    version: 1,
    page_count: pageCount,
    line_count: allLines.length,
    char_count_bucket: bucketNumber(normalizeWhitespace(text).length, 200),
    page_patterns: pages
      .map((pageText) =>
        pageText
          .split(/\r?\n/)
          .map((line) => normalizeWhitespace(line))
          .filter(Boolean)
          .slice(0, 30)
          .map(buildLineLayoutPattern)
          .join(" > "),
      )
      .filter(Boolean)
      .slice(0, 5),
    line_patterns: allLines.slice(0, 80).map(buildLineLayoutPattern),
    field_labels: extractFieldLabels(allLines),
  };
}

function buildFingerprint(
  text: string,
  pageCount: number,
  contextText = "",
  pageTexts: string[] = [],
  competenceCandidates: CompetenceCandidate[] = [],
): DocumentFingerprint {
  const compactText = normalizeWhitespace(text);
  const searchableText = normalizeWhitespace([contextText, compactText].filter(Boolean).join(" "));
  const lines = text
    .split(/\r?\n/)
    .map((line) => normalizeWhitespace(line))
    .filter(Boolean);

  const title = lines.find((line) => line.length >= 8 && line.length <= 120) || null;

  const tokenFrequency = new Map<string, number>();
  for (const token of tokenize(searchableText)) {
    tokenFrequency.set(token, (tokenFrequency.get(token) || 0) + 1);
  }

  const topTokens = [...tokenFrequency.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 20)
    .map(([token]) => token);

  const keyPhrases = Array.from(new Set(lines.filter((line) => line.length >= 16))).slice(0, 10);
  const detectedFields = [
    extractTaxIdentifier(compactText) ? "tax_identifier" : null,
    extractCompetence(compactText) ? "competence" : null,
    /folha/i.test(compactText) ? "folha" : null,
    /fiscal/i.test(compactText) ? "fiscal" : null,
    /relatorio/i.test(compactText) ? "relatorio" : null,
  ].filter((item): item is string => Boolean(item));

  return {
    version: 2,
    probable_title: title,
    top_tokens: topTokens,
    key_phrases: keyPhrases,
    page_count: pageCount,
    line_count: lines.length,
    char_count: compactText.length,
    detected_fields: detectedFields,
    competence_candidates: competenceCandidates.slice(0, 8),
    layout_signature: buildLayoutSignature(pageTexts, pageCount, text),
  };
}

async function loadPdfJs() {
  return loadPdfJsClient();
}

async function parsePdfText(file: File) {
  const pdfJs = await loadPdfJs();
  const fileData = await file.arrayBuffer();
  const docTask = pdfJs.getDocument({ data: fileData });
  const pdf = await docTask.promise;
  const pages: string[] = [];
  const positionedTextPages: NonNullable<DocumentFingerprint["positioned_text_pages"]> = [];
  const maxPages = Math.min(pdf.numPages, 5);

  for (let pageNumber = 1; pageNumber <= maxPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => normalizeWhitespace(item.str || ""))
      .filter(Boolean)
      .join("\n");
    pages.push(pageText);
    const positionedItems = content.items
      .map((item) => {
        const transform = Array.isArray(item.transform) ? item.transform : [];
        const text = normalizeWhitespace(item.str || "");
        const width = Number(item.width || 0);
        const height = Number(item.height || Math.abs(Number(transform[3] || 0)) || 8);
        const x = Number(transform[4] || 0);
        const y = Number(transform[5] || 0);
        if (!text || viewport.width <= 0 || viewport.height <= 0) return null;
        return {
          text,
          x: Math.max(0, Math.min(1, x / viewport.width)),
          y: Math.max(0, Math.min(1, (viewport.height - y - height) / viewport.height)),
          width: Math.max(0.001, Math.min(1, width / viewport.width)),
          height: Math.max(0.001, Math.min(1, height / viewport.height)),
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item));
    positionedTextPages.push({
      page: pageNumber,
      width: viewport.width,
      height: viewport.height,
      items: positionedItems,
    });
  }

  return {
    text: pages.join("\n"),
    pageTexts: pages,
    positionedTextPages,
    pageCount: Math.min(pdf.numPages, maxPages),
    fileData,
    pdf,
    pdfJs,
  };
}

type PositionedTextItem = NonNullable<DocumentFingerprint["positioned_text_pages"]>[number]["items"][number];

async function runOcrFromBlob(blob: Blob) {
  const tesseractModule = await import("tesseract.js");
  const createWorker =
    tesseractModule.createWorker ||
    (tesseractModule as { default?: { createWorker?: typeof tesseractModule.createWorker } }).default?.createWorker;
  if (!createWorker) {
    throw new Error("OCR indisponivel neste navegador.");
  }
  const worker = await createWorker("por+eng");
  try {
    const result = (await worker.recognize(blob, {}, { text: true, blocks: true })) as {
      data?: {
        text?: string;
        blocks?: Array<{
          paragraphs?: Array<{
            lines?: Array<{
              words?: Array<{ text?: string; bbox?: { x0?: number; y0?: number; x1?: number; y1?: number } }>;
            }>;
          }>;
        }> | null;
      };
    };
    const words = (result.data?.blocks || [])
      .flatMap((block) => block.paragraphs || [])
      .flatMap((paragraph) => paragraph.lines || [])
      .flatMap((line) => line.words || []);
    return { text: normalizeWhitespace(result.data?.text || ""), words };
  } finally {
    await worker.terminate();
  }
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

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Nao foi possivel gerar imagem da pagina para OCR."));
        return;
      }
      resolve(blob);
    }, "image/png");
  });
  return { blob, width: canvas.width, height: canvas.height };
}

async function parsePdfWithOcrFallback(file: File) {
  const pdfResult = await parsePdfText(file);
  const initialText = normalizeWhitespace(pdfResult.text);

  if (initialText.length >= 80) {
    return {
      text: initialText,
      pageTexts: pdfResult.pageTexts,
      positionedTextPages: pdfResult.positionedTextPages,
      pageCount: pdfResult.pageCount,
      textExtractionStatus: "completed" as const,
      ocrStatus: "not_needed" as const,
    };
  }

  const ocrPages: string[] = [];
  const ocrPositionedTextPages: NonNullable<DocumentFingerprint["positioned_text_pages"]> = [];
  try {
    const ocrMaxPages = Math.min(pdfResult.pageCount, 3);
    for (let pageNumber = 1; pageNumber <= ocrMaxPages; pageNumber += 1) {
      const page = await pdfResult.pdf.getPage(pageNumber);
      const rendered = await renderPdfPageToBlob(page);
      const ocr = await runOcrFromBlob(rendered.blob);
      if (ocr.text) ocrPages.push(ocr.text);
      const items = ocr.words
        .map((word): PositionedTextItem | null => {
          const bbox = word.bbox;
          const text = normalizeWhitespace(word.text || "");
          if (!text || !bbox || rendered.width <= 0 || rendered.height <= 0) return null;
          const x0 = Number(bbox.x0 || 0);
          const y0 = Number(bbox.y0 || 0);
          const x1 = Number(bbox.x1 || x0);
          const y1 = Number(bbox.y1 || y0);
          return {
            text,
            x: Math.max(0, Math.min(1, x0 / rendered.width)),
            y: Math.max(0, Math.min(1, y0 / rendered.height)),
            width: Math.max(0.001, Math.min(1, (x1 - x0) / rendered.width)),
            height: Math.max(0.001, Math.min(1, (y1 - y0) / rendered.height)),
          };
        })
        .filter((item): item is PositionedTextItem => Boolean(item));
      if (items.length > 0) {
        ocrPositionedTextPages.push({ page: pageNumber, width: rendered.width, height: rendered.height, items });
      }
    }
  } catch {
    return {
      text: initialText,
      pageTexts: pdfResult.pageTexts,
      positionedTextPages: pdfResult.positionedTextPages,
      pageCount: pdfResult.pageCount,
      textExtractionStatus: initialText ? ("completed" as const) : ("failed" as const),
      ocrStatus: "failed" as const,
    };
  }

  const mergedText = normalizeWhitespace([initialText, ...ocrPages].filter(Boolean).join("\n"));
  return {
    text: mergedText,
    pageTexts: mergedText ? [...pdfResult.pageTexts, ...ocrPages] : pdfResult.pageTexts,
    positionedTextPages: ocrPositionedTextPages.length > 0 ? ocrPositionedTextPages : pdfResult.positionedTextPages,
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
  const competenceCandidates = detectCompetenceCandidatesDetailed([
    { value: text, source: "pdf_text" },
  ]);
  const fingerprint = buildFingerprint(text, parsed.pageCount, "", parsed.pageTexts, competenceCandidates);
  fingerprint.positioned_text_pages = parsed.positionedTextPages;
  const cues = extractPrimaryCues(parsed.text);
  const keywords = fingerprint.top_tokens.slice(0, 12);
  const recognitionText = text;

  return {
    file_name: file.name,
    extracted_text: text,
    extracted_text_preview: text.slice(0, 600),
    text_extraction_status: parsed.textExtractionStatus,
    ocr_status: parsed.ocrStatus,
    detected_cnpj: extractTaxIdentifier(recognitionText),
    competence_detected: competenceCandidates[0]?.value || extractCompetence(recognitionText),
    fingerprint_payload: fingerprint,
    keywords,
    primary_cues: cues,
  };
}
