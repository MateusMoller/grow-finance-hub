import { formatReportCell } from "./formatters";
import type { ReportDatasetDefinition, ReportFieldDefinition, ReportRow } from "./types";

function sanitizeFileName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function writeReportXlsx(input: {
  dataset: ReportDatasetDefinition;
  fields: readonly ReportFieldDefinition[];
  rows: readonly ReportRow[];
  scopeLabel: string;
}) {
  const XLSX = await import("xlsx");
  const exportRows = input.rows.map((row) => {
    const output: Record<string, string> = {};
    input.fields.forEach((field) => {
      output[field.label] = formatReportCell(row[field.key], field);
    });
    return output;
  });
  const worksheet = XLSX.utils.json_to_sheet(exportRows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, input.dataset.name.slice(0, 30));

  const now = new Date().toISOString().replace(/[:.]/g, "-");
  const fileName = `${sanitizeFileName(`${input.dataset.name}-${input.scopeLabel}-${now}`)}.xlsx`;
  XLSX.writeFile(workbook, fileName);
  return fileName;
}
