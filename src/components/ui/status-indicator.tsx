import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const statusIndicatorVariants = cva(
  "inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-wide",
  {
    variants: {
      tone: {
        neutral: "border-border/90 bg-muted/55 text-muted-foreground",
        success: "border-emerald-200 bg-emerald-100 text-emerald-700 dark:border-emerald-800/70 dark:bg-emerald-950/40 dark:text-emerald-300",
        warning: "border-amber-200 bg-amber-100 text-amber-700 dark:border-amber-800/70 dark:bg-amber-950/40 dark:text-amber-300",
        danger: "border-red-200 bg-red-100 text-red-700 dark:border-red-800/70 dark:bg-red-950/40 dark:text-red-300",
        info: "border-blue-200 bg-blue-100 text-blue-700 dark:border-blue-800/70 dark:bg-blue-950/40 dark:text-blue-300",
      },
    },
    defaultVariants: {
      tone: "neutral",
    },
  },
);

interface StatusIndicatorProps extends VariantProps<typeof statusIndicatorVariants> {
  label: string;
  className?: string;
}

export function StatusIndicator({ label, tone, className }: StatusIndicatorProps) {
  return (
    <span className={cn(statusIndicatorVariants({ tone }), className)}>
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
      {label}
    </span>
  );
}
