const monthByName: Record<string, string> = {
  janeiro: "01", fevereiro: "02", marco: "03", abril: "04",
  maio: "05", junho: "06", julho: "07", agosto: "08",
  setembro: "09", outubro: "10", novembro: "11", dezembro: "12",
};

function normalize(value: string | null | undefined) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function competence(year: string, month: string) {
  const numericYear = Number(year);
  const numericMonth = Number(month);
  if (numericYear < 2000 || numericYear > 2100 || numericMonth < 1 || numericMonth > 12) return null;
  return `${numericYear}-${String(numericMonth).padStart(2, "0")}`;
}

/** Reads only the text supplied by the configured competence crop. */
export function parseCompetenceZone(value: string | null | undefined) {
  const text = normalize(value);
  if (!text) return null;
  const label = String.raw`(?:competencia|comp|periodo(?:\s+de\s+apuracao)?|apuracao|referencia|ref|pa|mes\s+(?:base|referencia))`;

  const labelledNamed = text.match(new RegExp(`\\b${label}\\D{0,32}(janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)(?:\\s+de)?\\D{0,8}(20\\d{2})\\b`));
  if (labelledNamed) return competence(labelledNamed[2], monthByName[labelledNamed[1]]);

  const labelledFullDate = text.match(new RegExp(`\\b${label}\\D{0,32}(?:[0-3]?\\d)[-/.\\s]+(0?[1-9]|1[0-2])[-/.\\s]+(20\\d{2})\\b`));
  if (labelledFullDate) return competence(labelledFullDate[2], labelledFullDate[1]);

  const labelledMonthYear = text.match(new RegExp(`\\b${label}\\D{0,32}(0?[1-9]|1[0-2])[-/.\\s]+(20\\d{2})\\b`));
  if (labelledMonthYear) return competence(labelledMonthYear[2], labelledMonthYear[1]);

  const named = text.match(/\b(janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)(?:\s+de)?\D{0,8}(20\d{2})\b/);
  if (named) return competence(named[2], monthByName[named[1]]);

  const fullDate = text.match(/\b(?:[0-3]?\d)[-/.\s]+(0?[1-9]|1[0-2])[-/.\s]+(20\d{2})\b/);
  if (fullDate) return competence(fullDate[2], fullDate[1]);

  const yearFirst = text.match(/\b(20\d{2})[-/.\s]+(0?[1-9]|1[0-2])(?:[-/.\s]+[0-3]?\d)?\b/);
  if (yearFirst) return competence(yearFirst[1], yearFirst[2]);

  const monthYear = text.match(/\b(0?[1-9]|1[0-2])[-/.\s]+(20\d{2})\b/);
  if (monthYear) return competence(monthYear[2], monthYear[1]);

  const compact = text.match(/(?:^|\D)(0[1-9]|1[0-2])(20\d{2})(?:\D|$)/);
  return compact ? competence(compact[2], compact[1]) : null;
}
