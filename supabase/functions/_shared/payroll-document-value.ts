export type PayrollDocumentValue = {
  amount: number;
  label: string;
  confidence: number;
};

const moneyPattern = String.raw`(?:\d{1,3}(?:\.\d{3})+|\d+),\d{2}`;

const payrollLabels: Array<{ label: string; confidence: number; pattern: RegExp }> = [
  { label: "folha_com_encargos", confidence: 1, pattern: new RegExp(String.raw`\b(?:total\s+da\s+)?folha\s+com\s+encargos\s*(?:r\$\s*)?(${moneyPattern})\b`, "i") },
  { label: "total_remuneracao", confidence: 0.98, pattern: new RegExp(String.raw`\btotal\s+(?:da\s+)?remunera(?:cao|coes)\s*(?:r\$\s*)?(${moneyPattern})\b`, "i") },
  { label: "total_proventos", confidence: 0.96, pattern: new RegExp(String.raw`\btotal\s+(?:de\s+)?proventos\s*(?:r\$\s*)?(${moneyPattern})\b`, "i") },
  { label: "total_vencimentos", confidence: 0.96, pattern: new RegExp(String.raw`\btotal\s+(?:de\s+)?vencimentos\s*(?:r\$\s*)?(${moneyPattern})\b`, "i") },
  { label: "base_inss", confidence: 0.94, pattern: new RegExp(String.raw`\bbase\s+inss\s*(?:r\$\s*)?(${moneyPattern})\b`, "i") },
  { label: "salario_base", confidence: 0.9, pattern: new RegExp(String.raw`\bsalario\s+base\s*(?:r\$\s*)?(${moneyPattern})\b`, "i") },
];

function parseBrazilianMoney(value: string) {
  const amount = Number(value.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
}

export function extractPayrollDocumentValue(text: string | null | undefined): PayrollDocumentValue | null {
  if (!text) return null;
  const normalized = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  for (const candidate of payrollLabels) {
    const match = normalized.match(candidate.pattern);
    const amount = match?.[1] ? parseBrazilianMoney(match[1]) : null;
    if (amount != null) return { amount, label: candidate.label, confidence: candidate.confidence };
  }
  return null;
}
