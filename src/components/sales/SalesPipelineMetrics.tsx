import { LucideIcon } from "lucide-react";

export interface SalesPipelineMetric {
  label: string;
  value: string;
  change?: string;
  trend?: "up" | "down" | "neutral";
  icon: LucideIcon;
}

interface SalesPipelineMetricsProps {
  metrics: SalesPipelineMetric[];
}

export function SalesPipelineMetrics({ metrics }: SalesPipelineMetricsProps) {
  return (
    <dl className="flex flex-wrap gap-x-8 gap-y-3 border-y py-3" aria-label="Resumo do funil de vendas">
      {metrics.map((metric) => (
        <div key={metric.label} className="min-w-36">
          <dt className="text-xs text-muted-foreground">{metric.label}</dt>
          <dd className="mt-0.5 flex items-baseline gap-2">
            <span className="text-base font-semibold tabular-nums">{metric.value}</span>
            {metric.change ? <span className="text-xs text-muted-foreground">{metric.change}</span> : null}
          </dd>
        </div>
      ))}
    </dl>
  );
}
