import { ReactNode, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Home, Layers3, Newspaper, Phone } from "lucide-react";
import { SiteHeader } from "./SiteHeader";
import { SiteFooter } from "./SiteFooter";
import { SiteWhatsAppButton } from "./SiteWhatsAppButton";
import { cn } from "@/lib/utils";

const mobileNavItems = [
  { label: "Inicio", to: "/", icon: Home },
  { label: "Solucoes", to: "/solucoes", icon: Layers3 },
  { label: "Newsletter", to: "/newsletter", icon: Newspaper },
  { label: "Contato", to: "/contato", icon: Phone },
];

export function SiteLayout({ children }: { children: ReactNode }) {
  const location = useLocation();

  useEffect(() => {
    if (!location.hash) {
      window.scrollTo({ top: 0, behavior: "auto" });
      return;
    }

    const sectionId = location.hash.replace("#", "");
    const timer = window.setTimeout(() => {
      const section = document.getElementById(sectionId);
      if (section) {
        section.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 40);

    return () => window.clearTimeout(timer);
  }, [location.pathname, location.hash]);

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1 pt-16 pb-20 sm:pt-20 md:pb-0">{children}</main>
      <SiteFooter />
      <SiteWhatsAppButton />

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border/70 bg-background/92 shadow-[0_-6px_18px_hsl(224_30%_12%_/_0.12)] backdrop-blur-xl md:hidden">
        <div
          className="grid grid-cols-4 gap-1 px-2 pb-[calc(env(safe-area-inset-bottom)+0.35rem)] pt-1.5"
          style={{ paddingBottom: "max(env(safe-area-inset-bottom), 0.25rem)" }}
        >
          {mobileNavItems.map((item) => {
            const isActive = location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-medium transition-colors",
                  isActive
                    ? "bg-primary/12 text-primary shadow-xs"
                    : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
                )}
              >
                <item.icon className={cn("h-4 w-4", isActive && "text-primary")} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
