import { ArrowDownRight, ArrowUpRight, LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

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
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {metrics.map((metric) => (
        <article
          key={metric.label}
          className="rounded-2xl border bg-card p-5 shadow-sm transition-colors hover:bg-muted/10"
        >
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <metric.icon className="h-5 w-5" />
            </div>
            {metric.change ? (
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium",
                  metric.trend === "down"
                    ? "bg-red-50 text-destructive"
                    : metric.trend === "up"
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-muted text-muted-foreground",
                )}
              >
                {metric.trend === "down" ? (
                  <ArrowDownRight className="h-3 w-3" />
                ) : metric.trend === "up" ? (
                  <ArrowUpRight className="h-3 w-3" />
                ) : null}
                {metric.change}
              </span>
            ) : null}
          </div>
          <span className="text-xs font-medium text-muted-foreground">{metric.label}</span>
          <div className="mt-1 font-heading text-3xl font-bold tracking-tight">{metric.value}</div>
        </article>
      ))}
    </div>
  );
}
