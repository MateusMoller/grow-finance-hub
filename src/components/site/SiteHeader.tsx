import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Menu, Moon, Sun, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import growIcon from "@/assets/grow-icon.png";

const navLinks = [
  { label: "Institucional", to: "/" },
  { label: "Servicos", to: "/#servicos" },
  { label: "Diferenciais", to: "/#diferenciais" },
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
  const [mounted, setMounted] = useState(false);
  const location = useLocation();
  const { resolvedTheme, setTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [location.pathname, location.hash]);

  const isDark = resolvedTheme === "dark";
  const toggleTheme = () => {
    setTheme(isDark ? "light" : "dark");
  };

  return (
    <header className="fixed left-0 right-0 top-0 z-[60] border-b border-border/80 bg-white/95 shadow-sm backdrop-blur dark:bg-[#061330]/95">
      <div className="container flex h-[60px] items-center justify-between sm:h-20">
        <Link to="/" className="flex min-w-0 items-center gap-2 sm:gap-3">
          <img src={growIcon} alt="Grow" className="h-8 w-8 rounded-md sm:h-9 sm:w-9" />
          <span className="max-w-[165px] truncate font-heading text-[15px] font-semibold text-foreground sm:max-w-none sm:text-lg">
            Grow Contabilidade
          </span>
        </Link>

        <nav className="hidden lg:flex items-center gap-1">
          {navLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={`rounded-full px-4 py-2 text-sm transition-colors ${
                isNavActive(location.pathname, location.hash, link.to)
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden lg:flex items-center gap-3">
          {mounted ? (
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-9 w-9 rounded-full border-border/80 bg-background/70"
              onClick={toggleTheme}
              aria-label={isDark ? "Ativar modo claro" : "Ativar modo escuro"}
            >
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
          ) : (
            <span className="h-9 w-9 rounded-full border border-border/80 bg-background/70" />
          )}

          <Button asChild variant="ghost" size="sm" className="rounded-full">
            <Link to="/login">Entrar</Link>
          </Button>
          <Button asChild size="sm" className="rounded-full px-5">
            <Link to="/#contato">Agende uma Avaliacao</Link>
          </Button>
        </div>

        <button
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border/80 bg-background/60 lg:hidden"
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
          className="w-[calc(100%-1rem)] max-w-sm border-r border-border bg-background/98 p-0 backdrop-blur lg:hidden"
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

            <Button
              type="button"
              variant="outline"
              className="mt-4 w-full"
              onClick={toggleTheme}
            >
              {isDark ? "Usar modo claro" : "Usar modo escuro"}
            </Button>

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
                  Agende uma Avaliacao
                </Link>
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </header>
  );
}
