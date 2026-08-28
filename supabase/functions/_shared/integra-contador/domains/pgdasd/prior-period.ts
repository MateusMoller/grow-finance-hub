export type PreviousPgdasValues = {
  competence: string;
  grossRevenue: number;
  declarationId: string | null;
  declarationPdf: string | null;
};

type JsonRecord = Record<string, unknown>;

export function previousCompetence(value: string) {
  if (!/^\d{6}$/.test(value)) throw new Error("PGDASD_INVALID_COMPETENCE");
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(4, 6));
  if (month < 1 || month > 12) throw new Error("PGDASD_INVALID_COMPETENCE");
  const previous = new Date(Date.UTC(year, month - 2, 1));
  return `${previous.getUTCFullYear()}${String(previous.getUTCMonth() + 1).padStart(2, "0")}`;
}

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function parseMoney(value: string) {
  const normalized = value.replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * 100) / 100 : null;
}

function findNumberByKey(value: unknown, keys: Set<string>): number | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findNumberByKey(item, keys);
      if (found != null) return found;
    }
    return null;
  }
  const record = asRecord(value);
  for (const [key, item] of Object.entries(record)) {
    if (keys.has(key.toLocaleLowerCase("pt-BR"))) {
      const numeric = typeof item === "number" ? item : typeof item === "string" ? parseMoney(item) : null;
      if (numeric != null) return numeric;
    }
  }
  for (const item of Object.values(record)) {
    const found = findNumberByKey(item, keys);
    if (found != null) return found;
  }
  return null;
}

function findStringByKey(value: unknown, keys: Set<string>): string | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findStringByKey(item, keys);
      if (found) return found;
    }
    return null;
  }
  const record = asRecord(value);
  for (const [key, item] of Object.entries(record)) {
    if (keys.has(key.toLocaleLowerCase("pt-BR")) && typeof item === "string" && item.trim()) return item;
  }
  for (const item of Object.values(record)) {
    const found = findStringByKey(item, keys);
    if (found) return found;
  }
  return null;
}

export function extractPreviousPgdasValues(payload: unknown, competence: string): PreviousPgdasValues {
  const internal = findNumberByKey(payload, new Set([
    "receitapacompetenciainterno",
    "receitabrutainterna",
    "receitainterna",
  ]));
  const external = findNumberByKey(payload, new Set([
    "receitapacompetenciaexterno",
    "receitabrutaexterna",
    "receitaexterna",
  ])) || 0;
  const directTotal = findNumberByKey(payload, new Set([
    "receitabrutatotal",
    "receitatotal",
    "valortotalreceita",
  ]));
  const grossRevenue = directTotal ?? (internal == null ? null : internal + external);
  if (grossRevenue == null) throw new Error("PGDASD_PREVIOUS_REVENUE_NOT_STRUCTURED");

  return {
    competence,
    grossRevenue: Math.round(grossRevenue * 100) / 100,
    declarationId: findStringByKey(payload, new Set(["numerodeclaracao", "idDeclaracao".toLocaleLowerCase("pt-BR")])),
    declarationPdf: findStringByKey(payload, new Set(["declaracao", "pdfdeclaracao", "arquivodeclaracao"])),
  };
}

function decodeBase64(value: string) {
  const clean = value.includes(",") ? value.slice(value.indexOf(",") + 1) : value;
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

async function extractPdfText(pdfBase64: string) {
  const pdfJs = await import("npm:pdfjs-dist@5.6.205/legacy/build/pdf.mjs");
  const loadingTask = pdfJs.getDocument({ data: decodeBase64(pdfBase64), isEvalSupported: false });
  const document = await loadingTask.promise;
  const pages: string[] = [];
  try {
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      pages.push(content.items.map((item) => "str" in item ? item.str : "").join(" "));
    }
  } finally {
    await document.destroy();
  }
  return pages.join("\n").replace(/\s+/g, " ").trim();
}

function extractRevenueFromPdfText(text: string) {
  const patterns = [
    /receita\s+bruta\s+(?:total\s+)?do\s+pa[^\d]{0,120}(?:r\$\s*)?([\d.]+,\d{2})/iu,
    /receita\s+pa\s+compet[êe]ncia\s+(?:mercado\s+)?interno[^\d]{0,80}(?:r\$\s*)?([\d.]+,\d{2})/iu,
    /receita\s+bruta\s+(?:no\s+)?mercado\s+interno[^\d]{0,80}(?:r\$\s*)?([\d.]+,\d{2})/iu,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    const value = match?.[1] ? parseMoney(match[1]) : null;
    if (value != null) return value;
  }
  return null;
}

export async function resolvePreviousPgdasValues(payload: unknown, competence: string): Promise<PreviousPgdasValues> {
  try {
    return extractPreviousPgdasValues(payload, competence);
  } catch (error) {
    if (!(error instanceof Error) || error.message !== "PGDASD_PREVIOUS_REVENUE_NOT_STRUCTURED") throw error;
  }

  const declarationPdf = findStringByKey(payload, new Set(["declaracao", "pdfdeclaracao", "arquivodeclaracao"]));
  if (!declarationPdf) throw new Error("PGDASD_PREVIOUS_DECLARATION_PDF_MISSING");
  const grossRevenue = extractRevenueFromPdfText(await extractPdfText(declarationPdf));
  if (grossRevenue == null) throw new Error("PGDASD_PREVIOUS_REVENUE_NOT_RECOGNIZED");
  return {
    competence,
    grossRevenue,
    declarationId: findStringByKey(payload, new Set(["numerodeclaracao", "iddeclaracao"])),
    declarationPdf,
  };
}
