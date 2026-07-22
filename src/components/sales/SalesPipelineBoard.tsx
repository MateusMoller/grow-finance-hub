import { ArrowRight, Building2, CalendarClock, CircleDollarSign, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatSalesCurrency, type SalesStageName } from "@/lib/salesPipeline";

export interface SalesPipelineCard {
  id: string;
  title: string;
  contact?: string | null;
  clientName?: string | null;
  value: number;
  probability?: number | null;
  expectedCloseDate?: string | null;
  offerLabel?: string | null;
}

export interface SalesPipelineStage {
  id: string;
  name: SalesStageName | string;
  color?: string | null;
  isActive?: boolean;
  opportunities: SalesPipelineCard[];
}

interface SalesPipelineBoardProps {
  stages: SalesPipelineStage[];
  selectedStage?: string | null;
  onStageSelect?: (stageName: string) => void;
  onOpportunityClick?: (opportunity: SalesPipelineCard) => void;
}

export function SalesPipelineBoard({
  stages,
  selectedStage,
  onStageSelect,
  onOpportunityClick,
}: SalesPipelineBoardProps) {
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-heading text-lg font-semibold">Pipeline de vendas</h2>
          <p className="text-xs text-muted-foreground">Oportunidades por etapa, valor e proximo fechamento.</p>
        </div>
        {selectedStage ? (
          <Button variant="ghost" size="sm" onClick={() => onStageSelect?.("all")}>
            Limpar etapa
          </Button>
        ) : null}
      </div>

      <div className="grid gap-4 overflow-x-auto pb-2 xl:grid-flow-col xl:auto-cols-[minmax(260px,1fr)]">
        {stages.map((stage) => {
          const totalValue = stage.opportunities.reduce((sum, item) => sum + item.value, 0);
          const isSelected = selectedStage === stage.name;

          return (
            <article
              key={stage.id}
              className={cn(
                "min-h-[380px] rounded-2xl border bg-card shadow-sm",
                isSelected && "border-primary shadow-md",
                stage.isActive === false && "opacity-70",
              )}
            >
              <button
                type="button"
                className="flex w-full items-start justify-between gap-3 border-b px-4 py-3 text-left"
                onClick={() => onStageSelect?.(String(stage.name))}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: stage.color || "#4f556f" }}
                    />
                    <h3 className="truncate text-sm font-semibold">{stage.name}</h3>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{formatSalesCurrency(totalValue)}</p>
                </div>
                <Badge variant="secondary" className="rounded-full">
                  {stage.opportunities.length}
                </Badge>
              </button>

              <div className="space-y-3 p-3">
                {stage.opportunities.length === 0 ? (
                  <div className="flex min-h-40 items-center justify-center rounded-xl border border-dashed p-5 text-center text-xs text-muted-foreground">
                    Nenhuma oportunidade nesta etapa.
                  </div>
                ) : (
                  stage.opportunities.map((opportunity) => (
                    <button
                      key={opportunity.id}
                      type="button"
                      className="w-full rounded-xl border bg-background p-3 text-left shadow-sm transition-colors hover:bg-muted/30"
                      onClick={() => onOpportunityClick?.(opportunity)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="line-clamp-2 text-sm font-semibold">{opportunity.title}</h4>
                        <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                      </div>
                      <div className="mt-3 space-y-2 text-xs text-muted-foreground">
                        {opportunity.clientName ? (
                          <div className="flex items-center gap-2">
                            <Building2 className="h-3.5 w-3.5" />
                            <span className="truncate">{opportunity.clientName}</span>
                          </div>
                        ) : null}
                        {opportunity.contact ? (
                          <div className="flex items-center gap-2">
                            <UserRound className="h-3.5 w-3.5" />
                            <span className="truncate">{opportunity.contact}</span>
                          </div>
                        ) : null}
                        <div className="flex items-center justify-between gap-3">
                          <span className="inline-flex items-center gap-1">
                            <CircleDollarSign className="h-3.5 w-3.5" />
                            {formatSalesCurrency(opportunity.value)}
                          </span>
                          {opportunity.probability != null ? <span>{opportunity.probability}%</span> : null}
                        </div>
                        {opportunity.expectedCloseDate ? (
                          <div className="flex items-center gap-2">
                            <CalendarClock className="h-3.5 w-3.5" />
                            <span>{new Date(opportunity.expectedCloseDate).toLocaleDateString("pt-BR")}</span>
                          </div>
                        ) : null}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
