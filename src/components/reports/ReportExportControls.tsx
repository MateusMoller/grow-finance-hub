import { FileSpreadsheet, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ReportExportResult } from "@/lib/reports/types";

interface ReportExportControlsProps {
  onExport: () => void;
  disabled?: boolean;
  isExporting?: boolean;
  result?: ReportExportResult | null;
}

export function ReportExportControls({ onExport, disabled, isExporting, result }: ReportExportControlsProps) {
  return (
    <div className="space-y-2">
      <Button type="button" className="gap-2" onClick={onExport} disabled={disabled || isExporting}>
        {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
        Exportar XLSX
      </Button>
      {result?.status === "blocked" && (
        <p className="text-xs text-amber-700 dark:text-amber-300">{result.message || "Exportacao bloqueada por politica de seguranca."}</p>
      )}
      {result?.status === "failed" && (
        <p className="text-xs text-destructive">{result.message || "Falha ao exportar relatorio."}</p>
      )}
      {result?.status === "completed" && (
        <p className="text-xs text-muted-foreground">
          Exportacao processada{result.fileName ? `: ${result.fileName}` : "."}
        </p>
      )}
    </div>
  );
}
