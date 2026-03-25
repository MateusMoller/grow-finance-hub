export const normalizeFilterText = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

export const normalizeCompetence = (value: string | null | undefined): string | null => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const yearMonthMatch = trimmed.match(/^(\d{4})-(\d{2})$/);
  if (yearMonthMatch) return `${yearMonthMatch[1]}-${yearMonthMatch[2]}`;

  const isoDateMatch = trimmed.match(/^(\d{4})-(\d{2})-\d{2}/);
  if (isoDateMatch) return `${isoDateMatch[1]}-${isoDateMatch[2]}`;

  const monthYearMatch = trimmed.match(/^(\d{2})\/(\d{4})$/);
  if (monthYearMatch) return `${monthYearMatch[2]}-${monthYearMatch[1]}`;

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
};

export const formatCompetenceLabel = (value: string) => {
  const normalized = normalizeCompetence(value);
  if (!normalized) return value;
  const [year, month] = normalized.split("-");
  return `${month}/${year}`;
};

export const buildRecentCompetences = (count = 12) => {
  const items: string[] = [];
  const now = new Date();

  for (let index = 0; index < count; index += 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - index, 1);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    items.push(`${year}-${month}`);
  }

  return items;
};

export const getTaskCompetence = (dueDate: string | null | undefined, createdAt: string | null | undefined) =>
  normalizeCompetence(dueDate) || normalizeCompetence(createdAt);

export const matchesSelectedCompany = (companyName: string | null | undefined, selectedCompany: string | null) => {
  if (!selectedCompany) return true;
  return normalizeFilterText(companyName || "") === normalizeFilterText(selectedCompany);
};

export const matchesSelectedCompetence = (
  competenceValue: string | null | undefined,
  selectedCompetence: string | null
) => {
  if (!selectedCompetence) return true;
  return normalizeCompetence(competenceValue) === normalizeCompetence(selectedCompetence);
};
