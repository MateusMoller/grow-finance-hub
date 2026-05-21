import { taskOriginMeta, type TaskOrigin } from "@/lib/taskOrigin";
import { cn } from "@/lib/utils";

const taskOriginLegendOrder: TaskOrigin[] = ["portal", "obrigacoes", "interno"];

interface TaskOriginLegendProps {
  className?: string;
}

export function TaskOriginLegend({ className }: TaskOriginLegendProps) {
  return (
    <div className={cn("inline-flex max-w-full flex-wrap items-center gap-3 rounded-2xl border border-border/70 bg-card/80 px-3 py-2 shadow-sm", className)}>
      <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
        Origem
      </span>
      {taskOriginLegendOrder.map((origin) => {
        const meta = taskOriginMeta[origin];

        return (
          <div key={origin} className="flex items-center gap-2 rounded-full bg-muted/50 px-2.5 py-1">
            <span
              className={cn("h-4 w-2.5 shrink-0 rounded-b-[2px] bg-gradient-to-b", meta.ribbonClass)}
              style={{ clipPath: "polygon(0 0, 100% 0, 100% 78%, 50% 100%, 0 78%)" }}
              aria-hidden="true"
            />
            <span className="text-xs text-muted-foreground">{meta.label}</span>
          </div>
        );
      })}
    </div>
  );
}
