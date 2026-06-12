import type { ReportColumnWarning } from "@/lib/reports/types";

interface SavedReportWarningsProps {
  warnings: readonly ReportColumnWarning[];
}

export function SavedReportWarnings({ warnings }: SavedReportWarningsProps) {
  if (warnings.length === 0) return null;

  return (
    <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
      {warnings.length} coluna(s) do modelo foram ignoradas por estarem ausentes, bloqueadas ou sem permissao.
    </div>
  );
}
