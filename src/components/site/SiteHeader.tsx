import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { SiteWordmark } from "./SiteWordmark";

const navLinks = [
  { label: "Institucional", to: "/" },
  { label: "Serviços", to: "/#servicos" },
  { label: "Clientes", to: "/#clientes" },
  { label: "Newsletter", to: "/newsletter" },
  { label: "Contato", to: "/contato" },
];

const isNavActive = (pathname: string, hash: string, target: string) => {
  const [targetPath, targetHash] = target.split("#");

  if (targetHash) {
    return pathname === (targetPath || "/") && hash === `#${targetHash}`;
  }

  return pathname === target;
};

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setOpen(false);
  }, [location.pathname, location.hash]);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 18);
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      className={[
        "fixed left-0 right-0 top-0 z-[60] transition-all duration-300",
        scrolled
          ? "bg-white/88 shadow-[0_14px_40px_-24px_rgba(22,30,58,0.35)] backdrop-blur-xl dark:bg-[#061330]/88"
          : "bg-transparent",
      ].join(" ")}
    >
      <div className="container flex h-[60px] items-center justify-between sm:h-[78px]">
        <Link to="/" aria-label="Grow" className="flex min-w-0 items-center">
          <SiteWordmark size="header" className="max-w-none" />
        </Link>

        <nav className="hidden lg:flex items-center gap-7">
          {navLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={`text-[12px] font-semibold uppercase tracking-[0.16em] transition-colors ${
                isNavActive(location.pathname, location.hash, link.to)
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden lg:flex items-center gap-2.5">
          <Button
            asChild
            variant="outline"
            size="sm"
            className={[
              "h-12 rounded-none px-6 text-[12px] font-semibold uppercase tracking-[0.14em] backdrop-blur transition-colors",
              scrolled
                ? "border-border/80 bg-background/78 hover:bg-background"
                : "border-white/40 bg-white/35 hover:bg-white/55",
            ].join(" ")}
          >
            <Link to="/#contato">Fale com a Grow</Link>
          </Button>
          <Button
            asChild
            variant="default"
            size="sm"
            className={[
              "h-12 rounded-none px-6 text-[12px] font-semibold uppercase tracking-[0.14em] transition-colors",
              scrolled
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : "bg-primary text-primary-foreground hover:bg-primary/92",
            ].join(" ")}
          >
            <Link to="/login">Entrar</Link>
          </Button>
        </div>

        <button
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border/80 bg-background/80 backdrop-blur lg:hidden"
          onClick={() => setOpen((prev) => !prev)}
          aria-label="Abrir menu"
          aria-expanded={open}
          aria-controls="mobile-site-menu"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          id="mobile-site-menu"
          side="left"
          className="w-[calc(100%-1rem)] max-w-sm border-r border-border bg-background p-0 lg:hidden"
        >
          <SheetHeader className="border-b border-border px-4 py-4 text-left">
            <SheetTitle className="text-base">Menu</SheetTitle>
          </SheetHeader>

          <div className="h-full overflow-y-auto px-4 py-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
            <div className="mb-4 rounded-xl border bg-card p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Acesso rapido</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Link
                  to="/#contato"
                  onClick={() => setOpen(false)}
                  className="rounded-lg border bg-background px-3 py-2 text-xs font-medium text-foreground"
                >
                  Agendar avaliacao
                </Link>
                <Link
                  to="/newsletter"
                  onClick={() => setOpen(false)}
                  className="rounded-lg border bg-background px-3 py-2 text-xs font-medium text-foreground"
                >
                  Ver newsletter
                </Link>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              {navLinks.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  onClick={() => setOpen(false)}
                  className={`rounded-lg px-3 py-3 text-sm font-medium transition-colors ${
                    isNavActive(location.pathname, location.hash, link.to)
                      ? "bg-primary/10 text-primary"
                      : "text-foreground hover:bg-muted"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </div>

            <div className="mt-4 grid gap-2 border-t border-border pt-4">
              <Button asChild variant="outline" className="w-full">
                <Link to="/portal" onClick={() => setOpen(false)}>
                  Portal do Cliente
                </Link>
              </Button>
              <Button asChild variant="outline" className="w-full">
                <Link to="/login" onClick={() => setOpen(false)}>
                  Entrar
                </Link>
              </Button>
              <Button asChild className="w-full">
                <Link to="/#contato" onClick={() => setOpen(false)}>
                  Agende uma avaliacao
                </Link>
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </header>
  );
}
