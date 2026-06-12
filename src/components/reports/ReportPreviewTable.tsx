import { formatReportCell } from "@/lib/reports/formatters";
import type { ReportPreview } from "@/lib/reports/types";

interface ReportPreviewTableProps {
  preview: ReportPreview;
}

export function ReportPreviewTable({ preview }: ReportPreviewTableProps) {
  if (preview.columns.length === 0) {
    return <div className="p-8 text-center text-sm text-muted-foreground">Selecione colunas validas para exibir o preview.</div>;
  }

  if (preview.rows.length === 0) {
    return <div className="p-8 text-center text-sm text-muted-foreground">Nenhum dado encontrado para os filtros atuais.</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b bg-muted/30">
            {preview.columns.map((column) => (
              <th key={column.key} className="whitespace-nowrap p-3 text-left text-xs font-semibold text-muted-foreground">
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {preview.rows.map((row) => {
            const rowKey = String(row.id || JSON.stringify(row));
            return (
              <tr key={rowKey} className="hover:bg-muted/20">
                {preview.columns.map((column) => (
                  <td key={`${rowKey}-${column.key}`} className="whitespace-nowrap p-3 text-sm">
                    {formatReportCell(row[column.key], column)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
