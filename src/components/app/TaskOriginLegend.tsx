import { taskOriginMeta, type TaskOrigin } from "@/lib/taskOrigin";
import { cn } from "@/lib/utils";

const taskOriginLegendOrder: TaskOrigin[] = ["portal", "obrigacoes", "interno"];

interface TaskOriginLegendProps {
  className?: string;
}

export function TaskOriginLegend({ className }: TaskOriginLegendProps) {
  return (
    <div
      className={cn(
        "inline-flex h-9 max-w-full items-center gap-3 rounded-md border border-border/70 bg-background/80 px-3 text-muted-foreground",
        className,
      )}
    >
      <span className="text-[10px] font-semibold uppercase tracking-[0.18em]">
        Origem
      </span>
      {taskOriginLegendOrder.map((origin) => {
        const meta = taskOriginMeta[origin];

        return (
          <div key={origin} className="flex items-center gap-1.5 whitespace-nowrap">
            <span
              className={cn("h-4 w-2.5 shrink-0 rounded-b-[2px] bg-gradient-to-b opacity-75", meta.ribbonClass)}
              style={{ clipPath: "polygon(0 0, 100% 0, 100% 78%, 50% 100%, 0 78%)" }}
              aria-hidden="true"
            />
            <span className="text-xs">{meta.label}</span>
          </div>
        );
      })}
    </div>
  );
}
