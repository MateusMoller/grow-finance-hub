import { cn } from "@/lib/utils";

type SiteWordmarkProps = {
  className?: string;
  size?: "header" | "footer";
};

export function SiteWordmark({ className, size = "header" }: SiteWordmarkProps) {
  const isHeader = size === "header";

  return (
    <span
      translate="no"
      className={cn(
        "relative inline-flex min-w-0 items-end text-[#232844] dark:text-[#eef2ff]",
        isHeader ? "pb-1" : "pb-0.5",
        className,
      )}
    >
      <span
        className={cn(
          "font-heading font-black uppercase leading-none tracking-[-0.09em]",
          isHeader ? "text-[1.95rem] sm:text-[2.15rem]" : "text-[1.6rem] sm:text-[1.85rem]",
        )}
      >
        Grow
      </span>
      <span
        aria-hidden="true"
        className={cn(
          "mb-[0.28em] ml-1.5 inline-block rounded-full bg-primary/90 shadow-[0_0_0_4px_rgba(77,68,137,0.08)]",
          isHeader ? "h-2.5 w-2.5" : "h-2 w-2",
        )}
      />
    </span>
  );
}
