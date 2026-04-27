import { cn } from "@/lib/utils";
import { resolveTaskOrigin, taskOriginMeta } from "@/lib/taskOrigin";

interface TaskOriginRibbonProps {
  requestId?: string | null;
  integrationSource?: string | null;
  className?: string;
}

export function TaskOriginRibbon({ requestId, integrationSource, className }: TaskOriginRibbonProps) {
  const origin = resolveTaskOrigin({ requestId, integrationSource });
  const meta = taskOriginMeta[origin];

  return (
    <div
      className={cn("pointer-events-none absolute right-3 top-0 z-10", className)}
      aria-label={meta.label}
      title={meta.label}
    >
      <div className="relative">
        <div
          className={cn(
            "h-10 w-5 rounded-b-[4px] bg-gradient-to-b shadow-[0_6px_14px_rgba(15,23,42,0.08)] ring-1 ring-black/5",
            meta.ribbonClass,
          )}
          style={{ clipPath: "polygon(0 0, 100% 0, 100% 78%, 50% 100%, 0 78%)" }}
        />
        <div className={cn("absolute inset-x-[3px] top-0 h-[2px] rounded-b-full opacity-60", meta.glowClass)} />
      </div>
    </div>
  );
}
