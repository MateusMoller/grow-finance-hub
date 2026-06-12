import { Badge } from "@/components/ui/badge";
import { buildActiveReportFilterLabels } from "@/lib/reports/filters";
import type { ReportFilters } from "@/lib/reports/types";

interface ReportFilterSummaryProps {
  filters: ReportFilters;
}

export function ReportFilterSummary({ filters }: ReportFilterSummaryProps) {
  const labels = buildActiveReportFilterLabels(filters);
  if (labels.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhum filtro global aplicado.</p>;
  }

  return (
    <div className="flex flex-wrap gap-2" aria-label="Filtros ativos">
      {labels.map((label) => (
        <Badge key={label} variant="secondary">
          {label}
        </Badge>
      ))}
    </div>
  );
}
