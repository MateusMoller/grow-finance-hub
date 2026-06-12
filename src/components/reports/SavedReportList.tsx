import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { SavedReportModel } from "@/lib/reports/types";
import { SavedReportDeleteDialog } from "./SavedReportDeleteDialog";

interface SavedReportListProps {
  reports: readonly SavedReportModel[];
  onLoad: (model: SavedReportModel) => void;
  onEdit: (model: SavedReportModel) => void;
  onDelete: (model: SavedReportModel) => void;
  isDeleting?: boolean;
}

export function SavedReportList({ reports, onLoad, onEdit, onDelete, isDeleting }: SavedReportListProps) {
  if (reports.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhum modelo salvo ainda.</p>;
  }

  return (
    <div className="max-h-72 space-y-2 overflow-auto pr-1">
      {reports.map((report) => (
        <div key={report.id} className="rounded-md border p-2.5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{report.name}</p>
              <p className="text-xs text-muted-foreground">
                {report.datasetId} · {report.columnKeys.length} colunas
              </p>
            </div>
            <Badge variant="outline" className="shrink-0">
              XLSX
            </Badge>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => onLoad(report)}>
              Carregar
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => onEdit(report)}>
              Editar
            </Button>
            <SavedReportDeleteDialog reportName={report.name} onConfirm={() => onDelete(report)} disabled={isDeleting} />
          </div>
        </div>
      ))}
    </div>
  );
}
