import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Menu, Moon, Sun, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import growLockupHorizontalDark from "@/assets/brand/grow-lockup-horizontal-dark.png";

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
    <header className="fixed left-0 right-0 top-0 z-[60] border-b border-border/60 bg-background/82 shadow-sm backdrop-blur-xl dark:bg-[#061330]/90">
      <div className="container flex h-[60px] items-center justify-between sm:h-20">
        <Link
          to="/"
          className="flex min-w-0 items-center rounded-2xl border border-border/70 bg-card/78 px-2.5 py-1.5 shadow-sm transition-colors hover:border-primary/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <img
            src={growLockupHorizontalDark}
            alt="Grow Contabilidade"
            width={176}
            height={56}
            className="h-9 w-auto rounded-xl object-cover sm:h-11"
          />
        </Link>

        <nav className="hidden items-center gap-1 lg:flex" aria-label="Navegacao institucional">
          {navLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                isNavActive(location.pathname, location.hash, link.to)
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-card hover:text-foreground"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          {mounted ? (
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-10 w-10 rounded-full border-border/80 bg-background/85"
              onClick={toggleTheme}
              aria-label={isDark ? "Ativar modo claro" : "Ativar modo escuro"}
            >
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
          ) : (
            <span className="h-9 w-9 rounded-full border border-border/80 bg-background" />
          )}

          <Button asChild variant="ghost" size="sm" className="rounded-full">
            <Link to="/login">Entrar</Link>
          </Button>
          <Button asChild size="sm" className="rounded-full px-5">
            <Link to="/#contato">Agende uma Avaliacao</Link>
          </Button>
        </div>

        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border/80 bg-background shadow-sm transition-colors hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 lg:hidden"
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
            <SheetTitle className="text-base">Navegacao Grow</SheetTitle>
          </SheetHeader>

          <div className="h-full overflow-y-auto px-4 py-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
            <div className="mb-4 rounded-2xl border bg-card p-3 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Acesso rapido</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Link
                  to="/#contato"
                  onClick={() => setOpen(false)}
                  className="rounded-lg border bg-background px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  Agendar avaliacao
                </Link>
                <Link
                  to="/newsletter"
                  onClick={() => setOpen(false)}
                  className="rounded-lg border bg-background px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
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
                  className={`rounded-xl px-3 py-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                    isNavActive(location.pathname, location.hash, link.to)
                      ? "bg-primary/10 text-primary"
                      : "text-foreground hover:bg-muted"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </div>

            <Button type="button" variant="outline" className="mt-4 w-full" onClick={toggleTheme}>
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
