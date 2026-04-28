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
        "relative inline-flex min-w-0 flex-col items-start text-[#232844] dark:text-[#eef2ff]",
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
        className={cn(
          "block w-full pl-[0.06em] font-semibold lowercase leading-none text-[#4a5274]",
          isHeader
            ? "mt-0.5 text-[0.42rem] tracking-[0.34em] sm:text-[0.46rem]"
            : "mt-0.5 text-[0.38rem] tracking-[0.28em] sm:text-[0.42rem]",
        )}
      >
        contabilidade
      </span>
    </span>
  );
}
