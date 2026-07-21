import type { LucideIcon } from "lucide-react";

interface ModuleContextPillProps {
  icon: LucideIcon;
  label: string;
  className?: string;
}

export function ModuleContextPill({ icon: Icon, label, className = "" }: ModuleContextPillProps) {
  return (
    <div
      className={`mb-2 inline-flex items-center gap-2 rounded-full border bg-background px-3 py-1 text-xs font-medium text-muted-foreground ${className}`}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </div>
  );
}
