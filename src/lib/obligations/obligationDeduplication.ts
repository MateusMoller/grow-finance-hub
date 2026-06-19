import type { ObligationDuplicateMatch } from "./regimeLoadTypes";

export interface ObligationCandidate {
  id: string;
  code?: string | null;
  name: string;
  normalized_name?: string | null;
  is_active?: boolean;
}

const semanticAliases = new Map<string, string>([
  ["f g t s", "fgts"],
  ["fgts mensal", "fgts"],
  ["fundo de garantia do tempo de servico", "fgts"],
  ["dctf web", "dctfweb"],
  ["dctfweb mit", "dctfweb"],
  ["e social", "esocial"],
  ["sped fiscal", "efd icms ipi"],
]);

export function normalizeObligationCode(value: string | null | undefined): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

export function normalizeObligationName(value: string | null | undefined): string {
  const normalized = String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\bf\s*g\s*t\s*s\b/g, "fgts")
    .replace(/\bd\s*c\s*t\s*f\s*web\b/g, "dctfweb")
    .replace(/\be\s*social\b/g, "esocial")
    .trim();

  return semanticAliases.get(normalized) ?? normalized;
}

export function findObligationDuplicateMatches(
  input: { id?: string | null; code?: string | null; name?: string | null },
  existing: ObligationCandidate[],
): ObligationDuplicateMatch[] {
  const inputCode = normalizeObligationCode(input.code);
  const inputName = normalizeObligationName(input.name);
  if (!inputCode && !inputName) return [];

  return existing
    .filter((candidate) => candidate.id !== input.id)
    .map((candidate) => {
      const candidateCode = normalizeObligationCode(candidate.code);
      const candidateName = candidate.normalized_name ?? normalizeObligationName(candidate.name);

      if (inputCode && candidateCode && inputCode === candidateCode) {
        return buildMatch(candidate, candidateName, "code", "block");
      }

      if (inputName && candidateName && inputName === candidateName) {
        return buildMatch(candidate, candidateName, "normalized_name", "block");
      }

      if (inputName && areSemanticNeighbors(inputName, candidateName)) {
        return buildMatch(candidate, candidateName, "semantic", "review");
      }

      return null;
    })
    .filter((match): match is ObligationDuplicateMatch => Boolean(match));
}

function areSemanticNeighbors(left: string, right: string): boolean {
  return Boolean(left && right && (left.includes(right) || right.includes(left)) && Math.min(left.length, right.length) >= 4);
}

function buildMatch(
  candidate: ObligationCandidate,
  normalizedName: string,
  matchType: ObligationDuplicateMatch["match_type"],
  severity: ObligationDuplicateMatch["severity"],
): ObligationDuplicateMatch {
  return {
    template_id: candidate.id,
    code: candidate.code ?? null,
    name: candidate.name,
    normalized_name: normalizedName,
    match_type: matchType,
    severity,
  };
}
