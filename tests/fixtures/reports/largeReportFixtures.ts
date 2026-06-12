import type { ReportFieldDefinition, ReportRow } from "@/lib/reports/types";

export function createLargeReportFields(count = 500): ReportFieldDefinition[] {
  return Array.from({ length: count }, (_, index) => ({
    key: `field_${index}`,
    label: `Campo ${index}`,
    sourcePath: `fixture.field_${index}`,
    dataType: "text",
    classification: "internal",
    previewable: true,
    exportable: true,
    group: `Grupo ${index % 10}`,
  }));
}

export function createLargeReportRows(rowCount = 1000, fieldCount = 20): ReportRow[] {
  return Array.from({ length: rowCount }, (_, rowIndex) => {
    const row: ReportRow = { id: `row-${rowIndex}` };
    for (let fieldIndex = 0; fieldIndex < fieldCount; fieldIndex += 1) {
      row[`field_${fieldIndex}`] = `Valor ${rowIndex}-${fieldIndex}`;
    }
    return row;
  });
}
