import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface SavedReportFormProps {
  name: string;
  onNameChange: (name: string) => void;
  onSubmit: () => void;
  isSaving?: boolean;
  isEditing?: boolean;
  disabled?: boolean;
}

export function SavedReportForm({ name, onNameChange, onSubmit, isSaving, isEditing, disabled }: SavedReportFormProps) {
  return (
    <div className="grid gap-2">
      <label className="text-sm font-medium" htmlFor="saved-report-name">
        Modelo salvo
      </label>
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
        <Input
          id="saved-report-name"
          value={name}
          onChange={(event) => onNameChange(event.target.value)}
          placeholder="Nome do modelo"
          disabled={disabled || isSaving}
        />
        <Button type="button" variant="outline" className="gap-2" onClick={onSubmit} disabled={disabled || isSaving}>
          <Save className="h-4 w-4" />
          {isEditing ? "Atualizar" : "Salvar"}
        </Button>
      </div>
    </div>
  );
}
