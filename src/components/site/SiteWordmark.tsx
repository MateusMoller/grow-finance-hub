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
        "relative inline-grid min-w-0 grid-cols-1 justify-items-center text-[#232844] dark:text-[#eef2ff]",
        className,
      )}
    >
      <span
        className={cn(
          "font-heading font-black uppercase leading-none tracking-[-0.09em]",
          isHeader ? "text-[1.95rem] sm:text-[2.15rem]" : "text-[1.62rem] sm:text-[1.88rem]",
        )}
      >
        Grow
      </span>
      <span
        className={cn(
          "block w-full text-center font-bold lowercase leading-none text-[#7d87a7]",
          isHeader
            ? "mt-[-2px] text-[0.42rem] tracking-[0.52em] sm:text-[0.48rem]"
            : "mt-[-2px] text-[0.39rem] tracking-[0.44em] sm:text-[0.43rem]",
        )}
      >
        contabilidade
      </span>
    </span>
  );
}
