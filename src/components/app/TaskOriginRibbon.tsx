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
      className={cn("pointer-events-none absolute right-4 top-0 z-10", className)}
      aria-label={meta.label}
      title={meta.label}
    >
      <div className="relative">
        <div
          className={cn(
            "h-12 w-7 rounded-b-sm bg-gradient-to-b shadow-[0_10px_18px_rgba(15,23,42,0.12)] ring-1 ring-black/5",
            meta.ribbonClass,
          )}
          style={{ clipPath: "polygon(0 0, 100% 0, 100% 80%, 50% 100%, 0 80%)" }}
        />
        <div className={cn("absolute inset-x-1 top-0 h-1 rounded-b-full opacity-70", meta.glowClass)} />
      </div>
    </div>
  );
}
