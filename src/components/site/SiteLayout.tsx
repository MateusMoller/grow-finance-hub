import { ReactNode, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { SiteHeader } from "./SiteHeader";
import { SiteFooter } from "./SiteFooter";

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
      <main className="flex-1 pt-16 sm:pt-20">{children}</main>
      <SiteFooter />
    </div>
  );
}
