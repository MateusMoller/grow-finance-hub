import type { FormEvent } from "react";
import { AlertTriangle, Building2, Search, UserRound } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { SalesCatalogOffer } from "@/components/sales/SalesCatalogManager";
import type { SalesClientOption, SalesPipelineStageRow, SalesUserOption } from "@/lib/salesPipelineData";
import type { SalesCatalogCategory, SalesRecurrenceType } from "@/lib/salesPipeline";

export interface SalesOpportunityFormState {
  id?: string;
  title: string;
  clientMode: "existing" | "new";
  clientId: string;
  contact: string;
  email: string;
  phone: string;
  saleType: SalesCatalogCategory;
  offerId: string;
  otherOfferDescription: string;
  estimatedValue: string;
  recurrenceType: SalesRecurrenceType;
  probability: string;
  stageId: string;
  stage: string;
  status: "active" | "won" | "lost" | "archived";
  source: string;
  competence: string;
  expectedCloseDate: string;
  ownerUserId: string;
  notes: string;
  lossReason: string;
}

interface SalesOpportunityDialogProps {
  open: boolean;
  mode?: "create" | "edit";
  form: SalesOpportunityFormState;
  clients: SalesClientOption[];
  offers: SalesCatalogOffer[];
  stages: SalesPipelineStageRow[];
  users: SalesUserOption[];
  duplicateWarnings?: Array<{ id: string; name: string; source: "client" | "lead" }>;
  isSaving?: boolean;
  onOpenChange: (open: boolean) => void;
  onFormChange: (form: SalesOpportunityFormState) => void;
  onSubmit: () => void;
}

const saleTypeLabels: Record<SalesCatalogCategory, string> = {
  service: "Servico contabil",
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

const updateField = <K extends keyof SalesOpportunityFormState>(
  form: SalesOpportunityFormState,
  key: K,
  value: SalesOpportunityFormState[K],
) => ({ ...form, [key]: value });

export function SalesOpportunityDialog({
  open,
  mode = "create",
  form,
  clients,
  offers,
  stages,
  users,
  duplicateWarnings = [],
  isSaving = false,
  onOpenChange,
  onFormChange,
  onSubmit,
}: SalesOpportunityDialogProps) {
  const activeOffers = offers.filter((offer) => offer.isActive);
  const selectedClient = clients.find((client) => client.id === form.clientId) || null;
  const selectedOffer = offers.find((offer) => offer.id === form.offerId) || null;

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{mode === "edit" ? "Editar oportunidade" : "Nova oportunidade"}</DialogTitle>
          <DialogDescription>
            Cadastre oportunidades para clientes existentes, novos clientes ou vendas avulsas.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-5" onSubmit={handleSubmit}>
          <section className="rounded-2xl border p-4">
            <div className="mb-4 flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold">Cliente ou lead</h3>
            </div>
            <div className="mb-4 grid grid-cols-2 gap-2 rounded-xl bg-muted p-1">
              <button
                type="button"
                className={cn("rounded-lg px-3 py-2 text-sm font-medium", form.clientMode === "existing" && "bg-background shadow-sm")}
                onClick={() => onFormChange(updateField(form, "clientMode", "existing"))}
              >
                Cliente existente
              </button>
              <button
                type="button"
                className={cn("rounded-lg px-3 py-2 text-sm font-medium", form.clientMode === "new" && "bg-background shadow-sm")}
                onClick={() => onFormChange({ ...form, clientMode: "new", clientId: "" })}
              >
                Novo cliente
              </button>
            </div>

            {form.clientMode === "existing" ? (
              <div className="space-y-2">
                <Label>Cliente ativo</Label>
                <select
                  className="h-11 w-full rounded-xl border bg-background px-3 text-sm outline-none"
                  value={form.clientId}
                  onChange={(event) => {
                    const client = clients.find((item) => item.id === event.target.value);
                    onFormChange({
                      ...form,
                      clientId: event.target.value,
                      title: form.title || client?.name || "",
                      contact: form.contact || client?.contact || "",
                      email: form.email || client?.email || "",
                      phone: form.phone || client?.phone || "",
                    });
                  }}
                >
                  <option value="">Selecione um cliente</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </select>
                {selectedClient ? (
                  <p className="text-xs text-muted-foreground">
                    {selectedClient.cnpj || "Sem CNPJ"} - {selectedClient.contact || "Sem contato principal"}
                  </p>
                ) : null}
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Nome do novo cliente *</Label>
                  <Input value={form.title} onChange={(event) => onFormChange(updateField(form, "title", event.target.value))} />
                </div>
                <div className="space-y-2">
                  <Label>Contato</Label>
                  <Input value={form.contact} onChange={(event) => onFormChange(updateField(form, "contact", event.target.value))} />
                </div>
              </div>
            )}

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>E-mail</Label>
                <Input type="email" value={form.email} onChange={(event) => onFormChange(updateField(form, "email", event.target.value))} />
              </div>
              <div className="space-y-2">
                <Label>Telefone</Label>
                <Input value={form.phone} onChange={(event) => onFormChange(updateField(form, "phone", event.target.value))} />
              </div>
            </div>

            {duplicateWarnings.length > 0 ? (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                <div className="mb-2 flex items-center gap-2 font-semibold">
                  <AlertTriangle className="h-4 w-4" />
                  Possiveis duplicidades
                </div>
                <div className="flex flex-wrap gap-2">
                  {duplicateWarnings.map((warning) => (
                    <Badge key={`${warning.source}-${warning.id}`} variant="outline" className="border-amber-300 bg-white">
                      {warning.name}
                    </Badge>
                  ))}
                </div>
              </div>
            ) : null}
          </section>

          <section className="rounded-2xl border p-4">
            <div className="mb-4 flex items-center gap-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold">Venda e pipeline</h3>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Titulo da oportunidade *</Label>
                <Input value={form.title} onChange={(event) => onFormChange(updateField(form, "title", event.target.value))} />
              </div>
              <div className="space-y-2">
                <Label>Etapa</Label>
                <select
                  className="h-11 w-full rounded-xl border bg-background px-3 text-sm outline-none"
                  value={form.stageId || form.stage}
                  onChange={(event) => {
                    const stage = stages.find((item) => item.id === event.target.value);
                    onFormChange({
                      ...form,
                      stageId: stage?.id || "",
                      stage: stage?.name || event.target.value,
                    });
                  }}
                >
                  {stages.map((stage) => (
                    <option key={stage.id} value={stage.id}>
                      {stage.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Tipo de venda</Label>
                <select
                  className="h-11 w-full rounded-xl border bg-background px-3 text-sm outline-none"
                  value={form.saleType}
                  onChange={(event) => onFormChange(updateField(form, "saleType", event.target.value as SalesCatalogCategory))}
                >
                  {Object.entries(saleTypeLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Oferta</Label>
                <select
                  className="h-11 w-full rounded-xl border bg-background px-3 text-sm outline-none"
                  value={form.offerId}
                  onChange={(event) => {
                    const offer = offers.find((item) => item.id === event.target.value);
                    onFormChange({
                      ...form,
                      offerId: event.target.value,
                      saleType: offer?.category || form.saleType,
                      recurrenceType: offer?.defaultRecurrenceType || form.recurrenceType,
                      estimatedValue: form.estimatedValue || (offer?.defaultValue ? String(offer.defaultValue) : ""),
                    });
                  }}
                >
                  <option value="">Sem oferta cadastrada</option>
                  {activeOffers.map((offer) => (
                    <option key={offer.id} value={offer.id}>
                      {offer.name}
                    </option>
                  ))}
                </select>
                {selectedOffer ? <p className="text-xs text-muted-foreground">{selectedOffer.description}</p> : null}
              </div>
              {form.saleType === "other" ? (
                <div className="space-y-2 md:col-span-2">
                  <Label>Descricao da oferta "Outro" *</Label>
                  <Input
                    value={form.otherOfferDescription}
                    onChange={(event) => onFormChange(updateField(form, "otherOfferDescription", event.target.value))}
                  />
                </div>
              ) : null}
              <div className="space-y-2">
                <Label>Valor estimado</Label>
                <Input
                  inputMode="decimal"
                  placeholder="R$ 0,00"
                  value={form.estimatedValue}
                  onChange={(event) => onFormChange(updateField(form, "estimatedValue", event.target.value))}
                />
              </div>
              <div className="space-y-2">
                <Label>Recorrencia</Label>
                <select
                  className="h-11 w-full rounded-xl border bg-background px-3 text-sm outline-none"
                  value={form.recurrenceType}
                  onChange={(event) => onFormChange(updateField(form, "recurrenceType", event.target.value as SalesRecurrenceType))}
                >
                  {Object.entries(recurrenceLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Probabilidade (%)</Label>
                <Input
                  inputMode="numeric"
                  value={form.probability}
                  onChange={(event) => onFormChange(updateField(form, "probability", event.target.value))}
                />
              </div>
              <div className="space-y-2">
                <Label>Previsao de fechamento</Label>
                <Input
                  type="date"
                  value={form.expectedCloseDate}
                  onChange={(event) => onFormChange(updateField(form, "expectedCloseDate", event.target.value))}
                />
              </div>
              <div className="space-y-2">
                <Label>Responsavel</Label>
                <select
                  className="h-11 w-full rounded-xl border bg-background px-3 text-sm outline-none"
                  value={form.ownerUserId}
                  onChange={(event) => onFormChange(updateField(form, "ownerUserId", event.target.value))}
                >
                  <option value="">Sem responsavel</option>
                  {users.map((item) => (
                    <option key={item.user_id} value={item.user_id}>
                      {item.display_name || item.user_id}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Origem</Label>
                <Input value={form.source} onChange={(event) => onFormChange(updateField(form, "source", event.target.value))} />
              </div>
            </div>
          </section>

          <section className="rounded-2xl border p-4">
            <div className="mb-3 flex items-center gap-2">
              <UserRound className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold">Contexto</h3>
            </div>
            <Textarea
              className="min-h-28"
              value={form.notes}
              onChange={(event) => onFormChange(updateField(form, "notes", event.target.value))}
              placeholder="Registre contexto comercial, proximos passos e pontos de atencao."
            />
          </section>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? "Salvando..." : "Salvar oportunidade"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
