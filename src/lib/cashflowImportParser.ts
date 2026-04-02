import type { PortalCashflowEntryType } from "@/components/portal/types";

export interface ParsedCashflowSuggestion {
  entryDate: string;
  description: string;
  amount: number;
  entryType: PortalCashflowEntryType;
  sourceFile: string;
  sourceLine: string;
  confidence: number;
}

export interface ParseCashflowFilesResult {
  entries: ParsedCashflowSuggestion[];
  warnings: string[];
}

const dateRegex = /\b(\d{2}[./-]\d{2}(?:[./-]\d{2,4})?)\b/;
const amountRegex = /-?\s*(?:R\$\s*)?\d{1,3}(?:[.\s]\d{3})*(?:,\d{2})|-?\s*(?:R\$\s*)?\d+(?:[.,]\d{2})/g;

const incomeKeywords = [
  "credito",
  "crédito",
  "deposito",
  "depósito",
  "recebimento",
  "receita",
  "pix recebido",
  "transferencia recebida",
  "entrada",
  "cash in",
];

const expenseKeywords = [
  "debito",
  "débito",
  "pagamento",
  "tarifa",
  "saque",
  "boleto",
  "pix enviado",
  "transferencia enviada",
  "compra",
  "saida",
  "saída",
  "cash out",
];

const acceptedExtensions = new Set(["pdf", "ofx", "xls", "xlsx", "csv", "png", "jpg", "jpeg", "webp"]);

const normalizeWhitespace = (value: string) => value.replace(/\s+/g, " ").trim();

const toIsoDate = (rawDate: string): string | null => {
  const normalized = rawDate.replace(/[.-]/g, "/").trim();
  const parts = normalized.split("/");
  if (parts.length < 3) return null;

  const day = Number(parts[0]);
  const month = Number(parts[1]);
  let year = Number(parts[2]);

  if (!day || !month || !year) return null;
  if (year < 100) year += 2000;

  const candidate = new Date(year, month - 1, day);
  if (Number.isNaN(candidate.getTime())) return null;
  if (candidate.getFullYear() !== year || candidate.getMonth() !== month - 1 || candidate.getDate() !== day) return null;

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
};

const parseAmount = (rawAmount: string): number | null => {
  if (!rawAmount) return null;

  const compact = rawAmount
    .replace(/\s+/g, "")
    .replace(/R\$/gi, "")
    .replace(/[^0-9,.-]/g, "");

  if (!compact) return null;

  let normalized = compact;
  const hasComma = normalized.includes(",");
  const hasDot = normalized.includes(".");

  if (hasComma && hasDot) {
    const lastComma = normalized.lastIndexOf(",");
    const lastDot = normalized.lastIndexOf(".");
    if (lastComma > lastDot) {
      normalized = normalized.replace(/\./g, "").replace(",", ".");
    } else {
      normalized = normalized.replace(/,/g, "");
    }
  } else if (hasComma) {
    normalized = normalized.replace(/\./g, "").replace(",", ".");
  } else {
    normalized = normalized.replace(/,/g, "");
  }

  const value = Number(normalized);
  if (!Number.isFinite(value)) return null;

  return value;
};

const inferEntryType = (line: string, value: number): PortalCashflowEntryType => {
  if (value < 0) return "expense";

  const normalizedLine = line.toLowerCase();
  if (incomeKeywords.some((keyword) => normalizedLine.includes(keyword))) return "income";
  if (expenseKeywords.some((keyword) => normalizedLine.includes(keyword))) return "expense";

  return "income";
};

const buildSuggestion = (params: {
  date: string;
  description: string;
  value: number;
  line: string;
  sourceFile: string;
  sourceLine: string;
  confidence: number;
}): ParsedCashflowSuggestion | null => {
  const amount = Math.abs(params.value);
  if (!Number.isFinite(amount) || amount <= 0) return null;

  const description = normalizeWhitespace(params.description || "");
  const finalDescription = description.length >= 3 ? description : `Lancamento importado de ${params.sourceFile}`;

  return {
    entryDate: params.date,
    description: finalDescription,
    amount: Number(amount.toFixed(2)),
    entryType: inferEntryType(params.line, params.value),
    sourceFile: params.sourceFile,
    sourceLine: params.sourceLine,
    confidence: Number(Math.min(1, Math.max(0.4, params.confidence)).toFixed(2)),
  };
};

const extractFromTextLine = (line: string, sourceFile: string, sourceLine: string): ParsedCashflowSuggestion | null => {
  const cleanLine = normalizeWhitespace(line);
  if (cleanLine.length < 8) return null;

  const dateMatch = cleanLine.match(dateRegex);
  if (!dateMatch) return null;

  const isoDate = toIsoDate(dateMatch[1]);
  if (!isoDate) return null;

  const amountMatches = [...cleanLine.matchAll(amountRegex)].map((match) => ({ raw: match[0], value: parseAmount(match[0]) }));
  const validAmounts = amountMatches.filter((match): match is { raw: string; value: number } => match.value !== null);
  if (validAmounts.length === 0) return null;

  const selectedAmount =
    validAmounts.find((match) => match.value < 0) || validAmounts[validAmounts.length - 1];

  let description = cleanLine
    .replace(dateMatch[1], " ")
    .replace(selectedAmount.raw, " ");

  description = normalizeWhitespace(description);

  const confidence = description.length >= 3 ? 0.92 : 0.74;

  return buildSuggestion({
    date: isoDate,
    description,
    value: selectedAmount.value,
    line: cleanLine,
    sourceFile,
    sourceLine,
    confidence,
  });
};

const extractFromCells = (
  cells: string[],
  sourceFile: string,
  rowIndex: number,
): ParsedCashflowSuggestion | null => {
  if (cells.length < 2) return null;

  const normalizedCells = cells.map((cell) => normalizeWhitespace(cell));

  let dateIndex = -1;
  let dateValue: string | null = null;

  normalizedCells.forEach((cell, index) => {
    if (dateValue) return;
    const dateMatch = cell.match(dateRegex);
    if (!dateMatch) return;

    const parsedDate = toIsoDate(dateMatch[1]);
    if (parsedDate) {
      dateIndex = index;
      dateValue = parsedDate;
    }
  });

  if (!dateValue) return null;

  let amountIndex = -1;
  let amountValue: number | null = null;

  for (let index = normalizedCells.length - 1; index >= 0; index -= 1) {
    const parsedAmount = parseAmount(normalizedCells[index]);
    if (parsedAmount !== null) {
      amountIndex = index;
      amountValue = parsedAmount;
      break;
    }
  }

  if (amountIndex < 0 || amountValue === null) return null;

  const description = normalizedCells
    .filter((_, index) => index !== dateIndex && index !== amountIndex)
    .join(" ");

  return buildSuggestion({
    date: dateValue,
    description,
    value: amountValue,
    line: normalizedCells.join(" "),
    sourceFile,
    sourceLine: `linha ${rowIndex}`,
    confidence: description.length >= 3 ? 0.96 : 0.8,
  });
};

const dedupeSuggestions = (entries: ParsedCashflowSuggestion[]) => {
  const seen = new Set<string>();
  return entries.filter((entry) => {
    const key = `${entry.entryDate}::${entry.amount.toFixed(2)}::${entry.entryType}::${entry.description.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const parseSpreadsheetFile = async (file: File): Promise<ParsedCashflowSuggestion[]> => {
  const XLSX = await import("xlsx");
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data, { type: "array", cellDates: false, raw: false });

  const suggestions: ParsedCashflowSuggestion[] = [];

  workbook.SheetNames.forEach((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) return;

    const rows = XLSX.utils.sheet_to_json<string[]>(sheet, {
      header: 1,
      raw: false,
      blankrows: false,
      defval: "",
    });

    rows.forEach((row, rowIndex) => {
      const cells = row
        .map((cell) => String(cell || ""))
        .map((cell) => normalizeWhitespace(cell))
        .filter(Boolean);

      if (cells.length === 0) return;

      const fromCells = extractFromCells(cells, file.name, rowIndex + 1);
      if (fromCells) {
        suggestions.push(fromCells);
        return;
      }

      const joined = cells.join(" ");
      const fromLine = extractFromTextLine(joined, file.name, `linha ${rowIndex + 1}`);
      if (fromLine) suggestions.push(fromLine);
    });
  });

  return suggestions;
};

const parsePdfFile = async (file: File): Promise<ParsedCashflowSuggestion[]> => {
  const [pdfModule, pdfWorkerModule] = await Promise.all([
    import("pdfjs-dist/legacy/build/pdf.mjs"),
    import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url"),
  ]);

  const pdfJs = pdfModule as unknown as {
    GlobalWorkerOptions?: { workerSrc: string };
    getDocument: (source: { data: ArrayBuffer }) => { promise: Promise<{ numPages: number; getPage: (page: number) => Promise<{ getTextContent: () => Promise<{ items: Array<{ str?: string }> }> }> }> };
  };

  if (pdfJs.GlobalWorkerOptions) {
    const workerSrc =
      (pdfWorkerModule as { default?: string }).default ||
      "pdf.worker.min.mjs";
    pdfJs.GlobalWorkerOptions.workerSrc = workerSrc;
  }

  const fileData = await file.arrayBuffer();
  const documentTask = pdfJs.getDocument({ data: fileData });
  const pdf = await documentTask.promise;
  const suggestions: ParsedCashflowSuggestion[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();

    const pageText = content.items
      .map((item) => normalizeWhitespace(item.str || ""))
      .filter(Boolean)
      .join("\n");

    pageText
      .split(/\n+/)
      .map((line) => normalizeWhitespace(line))
      .filter(Boolean)
      .forEach((line, lineIndex) => {
        const suggestion = extractFromTextLine(line, file.name, `pag ${pageNumber}, linha ${lineIndex + 1}`);
        if (suggestion) suggestions.push(suggestion);
      });
  }

  return suggestions;
};

const parseImageFile = async (file: File): Promise<ParsedCashflowSuggestion[]> => {
  const tesseractModule = await import("tesseract.js");
  const recognize =
    (tesseractModule as { recognize?: (...args: unknown[]) => Promise<unknown> }).recognize ||
    (tesseractModule as { default?: { recognize?: (...args: unknown[]) => Promise<unknown> } }).default?.recognize;

  if (!recognize) {
    throw new Error("OCR indisponivel para este navegador.");
  }

  const result = (await recognize(file, "por+eng")) as { data?: { text?: string } };
  const text = result?.data?.text || "";

  const suggestions: ParsedCashflowSuggestion[] = [];
  text
    .split(/\n+/)
    .map((line) => normalizeWhitespace(line))
    .filter(Boolean)
    .forEach((line, lineIndex) => {
      const suggestion = extractFromTextLine(line, file.name, `linha OCR ${lineIndex + 1}`);
      if (suggestion) suggestions.push(suggestion);
    });

  return suggestions;
};

const normalizeOfxText = (text: string) =>
  text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\0")
    .join("");

const parseOfxDate = (rawDate: string): string | null => {
  const normalized = normalizeWhitespace(rawDate);
  if (!normalized) return null;

  const digits = normalized.replace(/\D/g, "");
  if (digits.length < 8) return null;

  const year = Number(digits.slice(0, 4));
  const month = Number(digits.slice(4, 6));
  const day = Number(digits.slice(6, 8));
  if (!year || !month || !day) return null;

  const candidate = new Date(year, month - 1, day);
  if (Number.isNaN(candidate.getTime())) return null;
  if (candidate.getFullYear() !== year || candidate.getMonth() !== month - 1 || candidate.getDate() !== day) return null;

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
};

const getOfxTagValue = (block: string, tag: string): string | null => {
  const enclosingTagRegex = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "i");
  const enclosingTagMatch = block.match(enclosingTagRegex);
  if (enclosingTagMatch?.[1]) {
    return normalizeWhitespace(enclosingTagMatch[1]);
  }

  const inlineTagRegex = new RegExp(`<${tag}>([^\\n<]*)`, "i");
  const inlineTagMatch = block.match(inlineTagRegex);
  if (inlineTagMatch?.[1]) {
    return normalizeWhitespace(inlineTagMatch[1]);
  }

  return null;
};

const parseOfxFile = async (file: File): Promise<ParsedCashflowSuggestion[]> => {
  const fileContent = normalizeOfxText(await file.text());
  const transactionBlocks = [...fileContent.matchAll(/<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi)];

  if (transactionBlocks.length === 0) {
    return [];
  }

  const suggestions: ParsedCashflowSuggestion[] = [];

  transactionBlocks.forEach((match, index) => {
    const block = match[1] || "";
    const postedDate = getOfxTagValue(block, "DTPOSTED");
    const amountText = getOfxTagValue(block, "TRNAMT");
    const transactionType = getOfxTagValue(block, "TRNTYPE");
    const memo = getOfxTagValue(block, "MEMO");
    const name = getOfxTagValue(block, "NAME");

    const entryDate = postedDate ? parseOfxDate(postedDate) : null;
    const amount = amountText ? parseAmount(amountText) : null;
    if (!entryDate || amount === null || amount === 0) return;

    const normalizedType = normalizeWhitespace(transactionType || "").toLowerCase();
    const baseDescription = memo || name || transactionType || `Lancamento OFX ${index + 1}`;
    const line = `${normalizedType} ${baseDescription}`;

    let entryType: PortalCashflowEntryType;
    if (normalizedType.includes("debit") || normalizedType.includes("payment")) {
      entryType = "expense";
    } else if (normalizedType.includes("credit") || normalizedType.includes("deposit")) {
      entryType = "income";
    } else {
      entryType = amount < 0 ? "expense" : "income";
    }

    const suggestion = buildSuggestion({
      date: entryDate,
      description: baseDescription,
      value: entryType === "expense" ? -Math.abs(amount) : Math.abs(amount),
      line,
      sourceFile: file.name,
      sourceLine: `transacao OFX ${index + 1}`,
      confidence: 0.99,
    });

    if (suggestion) suggestions.push(suggestion);
  });

  return suggestions;
};

const getFileExtension = (fileName: string) => {
  const parts = fileName.toLowerCase().split(".");
  return parts.length > 1 ? parts[parts.length - 1] : "";
};

const isSpreadsheetExtension = (extension: string) => extension === "xls" || extension === "xlsx" || extension === "csv";
const isImageExtension = (extension: string) => extension === "png" || extension === "jpg" || extension === "jpeg" || extension === "webp";
const isOfxExtension = (extension: string) => extension === "ofx";

export async function parseCashflowFiles(files: File[]): Promise<ParseCashflowFilesResult> {
  const warnings: string[] = [];
  const allSuggestions: ParsedCashflowSuggestion[] = [];

  for (const file of files) {
    const extension = getFileExtension(file.name);

    if (!acceptedExtensions.has(extension)) {
      warnings.push(`Arquivo ignorado (${file.name}): formato nao suportado.`);
      continue;
    }

    try {
      let suggestions: ParsedCashflowSuggestion[] = [];

      if (isSpreadsheetExtension(extension)) {
        suggestions = await parseSpreadsheetFile(file);
      } else if (isOfxExtension(extension)) {
        suggestions = await parseOfxFile(file);
      } else if (extension === "pdf") {
        suggestions = await parsePdfFile(file);
      } else if (isImageExtension(extension)) {
        suggestions = await parseImageFile(file);
      }

      if (suggestions.length === 0) {
        warnings.push(`Nenhum lancamento foi identificado automaticamente em ${file.name}.`);
        continue;
      }

      allSuggestions.push(...suggestions);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Erro desconhecido";
      warnings.push(`Nao foi possivel ler ${file.name}: ${message}`);
    }
  }

  return {
    entries: dedupeSuggestions(allSuggestions),
    warnings,
  };
}
