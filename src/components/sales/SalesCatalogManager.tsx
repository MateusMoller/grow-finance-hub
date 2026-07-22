import { PackagePlus, Pencil, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { SalesCatalogCategory, SalesRecurrenceType } from "@/lib/salesPipeline";

export interface SalesCatalogOffer {
  id: string;
  name: string;
  category: SalesCatalogCategory;
  defaultRecurrenceType: SalesRecurrenceType;
  defaultValue?: number | null;
  description?: string | null;
  isActive: boolean;
}

interface SalesCatalogManagerProps {
  offers: SalesCatalogOffer[];
  canManage: boolean;
  onCreateOffer?: () => void;
  onEditOffer?: (offer: SalesCatalogOffer) => void;
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

export function SalesCatalogManager({
  offers,
  canManage,
  onCreateOffer,
  onEditOffer,
}: SalesCatalogManagerProps) {
  return (
    <section className="rounded-2xl border bg-card shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b px-5 py-4">
        <div>
          <h2 className="font-heading font-semibold">Catalogo comercial</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Servicos, produtos e ofertas usados nas oportunidades.
          </p>
        </div>
        {canManage ? (
          <Button variant="outline" size="sm" className="rounded-xl" onClick={onCreateOffer}>
            <Plus className="mr-2 h-4 w-4" />
            Nova oferta
          </Button>
        ) : null}
      </div>

      <div className="divide-y">
        {offers.length === 0 ? (
          <div className="flex min-h-36 flex-col items-center justify-center gap-2 p-8 text-center text-sm text-muted-foreground">
            <PackagePlus className="h-8 w-8" />
            Nenhuma oferta cadastrada.
          </div>
        ) : (
          offers.map((offer) => (
            <div key={offer.id} className="flex items-center justify-between gap-4 px-5 py-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="truncate text-sm font-semibold">{offer.name}</h3>
                  <Badge variant="secondary" className="rounded-full">
                    {categoryLabels[offer.category]}
                  </Badge>
                  <Badge variant="outline" className="rounded-full">
                    {recurrenceLabels[offer.defaultRecurrenceType]}
                  </Badge>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[11px] font-medium",
                      offer.isActive ? "bg-emerald-50 text-emerald-700" : "bg-muted text-muted-foreground",
                    )}
                  >
                    {offer.isActive ? "Ativa" : "Inativa"}
                  </span>
                </div>
                {offer.description ? (
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{offer.description}</p>
                ) : null}
              </div>
              {canManage ? (
                <Button variant="ghost" size="icon" className="shrink-0" onClick={() => onEditOffer?.(offer)}>
                  <Pencil className="h-4 w-4" />
                </Button>
              ) : null}
            </div>
          ))
        )}
      </div>
    </section>
  );
}
