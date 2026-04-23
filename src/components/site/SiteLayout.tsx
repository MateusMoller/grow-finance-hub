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
    <div className="executive-shell min-h-screen flex flex-col">
      <a
        href="#site-main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[80] focus:rounded-full focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-foreground focus:shadow-lg focus:ring-2 focus:ring-ring"
      >
        Pular para o conteudo
      </a>
      <SiteHeader />
      <main id="site-main" className="flex-1 scroll-mt-24 pt-16 pb-20 sm:pt-20 md:pb-0">{children}</main>
      <SiteFooter />
      <SiteWhatsAppButton />

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-[#806589]/15 bg-[#01000D]/95 text-[#806589] shadow-[0_-18px_50px_-34px_rgba(1,0,13,0.95)] backdrop-blur md:hidden">
        <div
          className="grid grid-cols-4 px-2 pb-[calc(env(safe-area-inset-bottom)+0.25rem)] pt-1"
          style={{ paddingBottom: "max(env(safe-area-inset-bottom), 0.25rem)" }}
        >
          {mobileNavItems.map((item) => {
            const isActive = location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  isActive ? "bg-[#806589]/10 text-[#806589]" : "text-[#64518C] hover:bg-[#806589]/5 hover:text-[#806589]",
                )}
              >
                <item.icon className={cn("h-4 w-4", isActive && "text-[#806589]")} aria-hidden="true" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
