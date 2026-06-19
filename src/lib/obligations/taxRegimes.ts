import type { BranchRegimeResolution, TaxRegimeCode, TaxRegimeDefinition } from "./regimeLoadTypes";

export const taxRegimeDefinitions: TaxRegimeDefinition[] = [
  {
    code: "simples_nacional",
    label: "Simples Nacional",
    aliases: ["simples", "simples nacional", "sn", "simei optante simples"],
    is_active: true,
    sort_order: 10,
  },
  {
    code: "lucro_presumido",
    label: "Lucro Presumido",
    aliases: ["lucro presumido", "presumido", "lp"],
    is_active: true,
    sort_order: 20,
  },
  {
    code: "lucro_real",
    label: "Lucro Real",
    aliases: ["lucro real", "real", "lr"],
    is_active: true,
    sort_order: 30,
  },
  {
    code: "mei",
    label: "MEI",
    aliases: ["mei", "microempreendedor individual", "simei"],
    is_active: true,
    sort_order: 40,
  },
];

const regimeLookup = new Map<string, TaxRegimeCode>(
  taxRegimeDefinitions.flatMap((definition) => [
    [definition.code, definition.code] as const,
    [normalizeRegimeText(definition.label), definition.code] as const,
    ...definition.aliases.map((alias) => [normalizeRegimeText(alias), definition.code] as const),
  ]),
);

export function normalizeRegimeText(value: string | null | undefined): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function normalizeTaxRegime(value: string | null | undefined): TaxRegimeCode | null {
  const normalized = normalizeRegimeText(value);
  if (!normalized) return null;
  return regimeLookup.get(normalized) ?? null;
}

export interface BranchRegimeInput {
  companyRegime?: string | null;
  parentRegime?: string | null;
  isBranch?: boolean;
  inheritsParentRegime?: boolean;
}

export function resolveBranchTaxRegime(input: BranchRegimeInput): BranchRegimeResolution {
  const ownRegime = normalizeTaxRegime(input.companyRegime);
  if (ownRegime && (!input.isBranch || !input.inheritsParentRegime)) {
    return { status: "own_regime", taxRegimeCode: ownRegime };
  }

  const parentRegime = normalizeTaxRegime(input.parentRegime);
  if (input.isBranch && input.inheritsParentRegime && parentRegime) {
    return {
      status: "inherited_requires_review",
      taxRegimeCode: parentRegime,
      reason: "branch_inherits_parent_regime",
    };
  }

  if (ownRegime) {
    return { status: "own_regime", taxRegimeCode: ownRegime };
  }

  return {
    status: "unsupported",
    taxRegimeCode: null,
    reason: "unsupported_or_missing_tax_regime",
  };
}
