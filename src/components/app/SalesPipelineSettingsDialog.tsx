import type { FormEvent } from "react";
import { Settings2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { SalesCatalogOffer } from "@/components/sales/SalesCatalogManager";
import type { SalesCatalogCategory, SalesRecurrenceType } from "@/lib/salesPipeline";
import type { SalesPipelineStageRow } from "@/lib/salesPipelineData";

export interface SalesStageFormState {
  id?: string;
  name: string;
  position: string;
  color: string;
  isActive: boolean;
}

export interface SalesOfferFormState {
  id?: string;
  name: string;
  category: SalesCatalogCategory;
  defaultRecurrenceType: SalesRecurrenceType;
  defaultValue: string;
  description: string;
  isActive: boolean;
}

interface SalesPipelineSettingsDialogProps {
  open: boolean;
  canManage: boolean;
  stages: SalesPipelineStageRow[];
  offers: SalesCatalogOffer[];
  stageForm: SalesStageFormState;
  offerForm: SalesOfferFormState;
  isSaving?: boolean;
  onOpenChange: (open: boolean) => void;
  onStageFormChange: (form: SalesStageFormState) => void;
  onOfferFormChange: (form: SalesOfferFormState) => void;
  onEditStage: (stage: SalesPipelineStageRow) => void;
  onEditOffer: (offer: SalesCatalogOffer) => void;
  onSaveStage: () => void;
  onSaveOffer: () => void;
}

const categoryLabels: Record<SalesCatalogCategory, string> = {
  service: "Servico",
  product: "Produto",
  consulting: "Consultoria",
  automation: "Automacao",
  system: "Sistema",
  other: "Outro",
};

const recurrenceLabels: Record<SalesRecurrenceType, string> = {
  recurring: "Recorrente",
  one_time: "Avulso",
};

export function SalesPipelineSettingsDialog({
  open,
  canManage,
  stages,
  offers,
  stageForm,
  offerForm,
  isSaving = false,
  onOpenChange,
  onStageFormChange,
  onOfferFormChange,
  onEditStage,
  onEditOffer,
  onSaveStage,
  onSaveOffer,
}: SalesPipelineSettingsDialogProps) {
  const submitStage = (event: FormEvent) => {
    event.preventDefault();
    onSaveStage();
  };

  const submitOffer = (event: FormEvent) => {
    event.preventDefault();
    onSaveOffer();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-muted-foreground" />
            <DialogTitle>Configuracoes comerciais</DialogTitle>
            <Badge variant={canManage ? "default" : "secondary"} className="rounded-full">
              {canManage ? "Edicao liberada" : "Somente leitura"}
            </Badge>
          </div>
          <DialogDescription>
            Gerencie etapas do pipeline e catalogo comercial padrao do sistema.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5 lg:grid-cols-2">
          <section className="rounded-2xl border">
            <div className="border-b p-4">
              <h3 className="font-heading font-semibold">Etapas do pipeline</h3>
              <p className="mt-1 text-xs text-muted-foreground">Etapas inativas ficam preservadas no historico.</p>
            </div>
            <div className="max-h-80 divide-y overflow-y-auto">
              {stages.map((stage) => (
                <button
                  key={stage.id}
                  type="button"
                  className="flex w-full items-center justify-between gap-3 p-4 text-left hover:bg-muted/30"
                  onClick={() => onEditStage(stage)}
                  disabled={!canManage}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: stage.color }} />
                      <span className="truncate text-sm font-semibold">{stage.name}</span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">Posicao {stage.position}</p>
                  </div>
                  <Badge variant={stage.is_active ? "secondary" : "outline"}>{stage.is_active ? "Ativa" : "Inativa"}</Badge>
                </button>
              ))}
            </div>

            <form className="space-y-3 border-t p-4" onSubmit={submitStage}>
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_90px_90px]">
                <div className="space-y-2">
                  <Label>Nome da etapa</Label>
                  <Input
                    value={stageForm.name}
                    onChange={(event) => onStageFormChange({ ...stageForm, name: event.target.value })}
                    disabled={!canManage}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Ordem</Label>
                  <Input
                    inputMode="numeric"
                    value={stageForm.position}
                    onChange={(event) => onStageFormChange({ ...stageForm, position: event.target.value })}
                    disabled={!canManage}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Cor</Label>
                  <Input
                    type="color"
                    value={stageForm.color}
                    onChange={(event) => onStageFormChange({ ...stageForm, color: event.target.value })}
                    disabled={!canManage}
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={stageForm.isActive}
                  onChange={(event) => onStageFormChange({ ...stageForm, isActive: event.target.checked })}
                  disabled={!canManage}
                />
                Etapa ativa
              </label>
              <DialogFooter>
                <Button type="submit" disabled={!canManage || isSaving}>Salvar etapa</Button>
              </DialogFooter>
            </form>
          </section>

          <section className="rounded-2xl border">
            <div className="border-b p-4">
              <h3 className="font-heading font-semibold">Catalogo comercial</h3>
              <p className="mt-1 text-xs text-muted-foreground">Itens inativos continuam visiveis em oportunidades antigas.</p>
            </div>
            <div className="max-h-80 divide-y overflow-y-auto">
              {offers.map((offer) => (
                <button
                  key={offer.id}
                  type="button"
                  className="flex w-full items-center justify-between gap-3 p-4 text-left hover:bg-muted/30"
                  onClick={() => onEditOffer(offer)}
                  disabled={!canManage}
                >
                  <div className="min-w-0">
                    <span className="truncate text-sm font-semibold">{offer.name}</span>
                    <p className="mt-1 text-xs text-muted-foreground">{categoryLabels[offer.category]}</p>
                  </div>
                  <Badge variant={offer.isActive ? "secondary" : "outline"}>{offer.isActive ? "Ativa" : "Inativa"}</Badge>
                </button>
              ))}
            </div>

            <form className="space-y-3 border-t p-4" onSubmit={submitOffer}>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Nome da oferta</Label>
                  <Input
                    value={offerForm.name}
                    onChange={(event) => onOfferFormChange({ ...offerForm, name: event.target.value })}
                    disabled={!canManage}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Categoria</Label>
                  <select
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none"
                    value={offerForm.category}
                    onChange={(event) => onOfferFormChange({ ...offerForm, category: event.target.value as SalesCatalogCategory })}
                    disabled={!canManage}
                  >
                    {Object.entries(categoryLabels).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Recorrencia padrao</Label>
                  <select
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none"
                    value={offerForm.defaultRecurrenceType}
                    onChange={(event) =>
                      onOfferFormChange({ ...offerForm, defaultRecurrenceType: event.target.value as SalesRecurrenceType })
                    }
                    disabled={!canManage}
                  >
                    {Object.entries(recurrenceLabels).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Valor padrao</Label>
                  <Input
                    inputMode="decimal"
                    value={offerForm.defaultValue}
                    onChange={(event) => onOfferFormChange({ ...offerForm, defaultValue: event.target.value })}
                    disabled={!canManage}
                  />
                </div>
              </div>
              <Textarea
                placeholder="Descricao da oferta"
                value={offerForm.description}
                onChange={(event) => onOfferFormChange({ ...offerForm, description: event.target.value })}
                disabled={!canManage}
              />
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={offerForm.isActive}
                  onChange={(event) => onOfferFormChange({ ...offerForm, isActive: event.target.checked })}
                  disabled={!canManage}
                />
                Oferta ativa
              </label>
              <DialogFooter>
                <Button type="submit" disabled={!canManage || isSaving}>Salvar oferta</Button>
              </DialogFooter>
            </form>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
