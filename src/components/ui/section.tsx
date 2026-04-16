import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/utils";

export function Section({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return <section className={cn("py-12 sm:py-14 md:py-16", className)} {...props} />;
}

interface SectionHeadingProps extends HTMLAttributes<HTMLDivElement> {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
}

export function SectionHeading({ className, eyebrow, title, description, ...props }: SectionHeadingProps) {
  return (
    <div className={cn("space-y-3", className)} {...props}>
      {eyebrow ? (
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary/90">{eyebrow}</p>
      ) : null}
      <h2 className="font-heading text-2xl font-semibold leading-tight text-foreground sm:text-3xl">{title}</h2>
      {description ? (
        <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground sm:text-base">{description}</p>
      ) : null}
    </div>
  );
}
