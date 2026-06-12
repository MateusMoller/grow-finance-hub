import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ReportDatasetDefinition, ReportDatasetId } from "@/lib/reports/types";

interface ReportDatasetSelectorProps {
  datasets: readonly ReportDatasetDefinition[];
  value: ReportDatasetId;
  onValueChange: (value: ReportDatasetId) => void;
  disabled?: boolean;
}

export function ReportDatasetSelector({ datasets, value, onValueChange, disabled }: ReportDatasetSelectorProps) {
  return (
    <div className="grid gap-2">
      <label className="text-sm font-medium" htmlFor="report-dataset-selector">
        Base do relatorio
      </label>
      <Select value={value} onValueChange={(nextValue) => onValueChange(nextValue as ReportDatasetId)} disabled={disabled}>
        <SelectTrigger id="report-dataset-selector">
          <SelectValue placeholder="Selecione uma base" />
        </SelectTrigger>
        <SelectContent>
          {datasets.map((dataset) => (
            <SelectItem key={dataset.id} value={dataset.id}>
              {dataset.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
