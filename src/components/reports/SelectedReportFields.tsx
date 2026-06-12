import { ArrowDown, ArrowUp, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ReportFieldDefinition } from "@/lib/reports/types";

interface SelectedReportFieldsProps {
  fields: readonly ReportFieldDefinition[];
  onRemove: (fieldKey: string) => void;
  onMove: (fieldKey: string, direction: "up" | "down") => void;
}

export function SelectedReportFields({ fields, onRemove, onMove }: SelectedReportFieldsProps) {
  if (fields.length === 0) {
    return <p className="rounded-md border p-4 text-center text-sm text-muted-foreground">Nenhuma coluna selecionada.</p>;
  }

  return (
    <div className="max-h-72 space-y-1 overflow-auto pr-1">
      {fields.map((field, index) => (
        <div key={field.key} className="flex items-center gap-2 rounded-md border p-2 text-sm">
          <span className="min-w-0 flex-1 truncate">{field.label}</span>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            onClick={() => onMove(field.key, "up")}
            disabled={index === 0}
            aria-label={`Mover ${field.label} para cima`}
          >
            <ArrowUp className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            onClick={() => onMove(field.key, "down")}
            disabled={index === fields.length - 1}
            aria-label={`Mover ${field.label} para baixo`}
          >
            <ArrowDown className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-destructive hover:text-destructive"
            onClick={() => onRemove(field.key)}
            aria-label={`Remover ${field.label}`}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}
    </div>
  );
}
