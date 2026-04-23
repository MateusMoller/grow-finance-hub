import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Menu, Moon, Sun, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

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
    <header className="fixed left-0 right-0 top-0 z-[60] border-b border-[#806589]/15 bg-[#01000D]/75 shadow-[0_18px_60px_-48px_rgba(1,0,13,0.9)] backdrop-blur-2xl">
      <div className="container flex h-[60px] items-center justify-between sm:h-20">
        <Link
          to="/"
          aria-label="Grow Contabilidade"
          className="site-wordmark flex min-w-0 items-center rounded-2xl border border-[#806589]/20 bg-[#020126]/80 px-3 py-2 font-heading text-xl font-bold shadow-sm transition-colors hover:border-[#806589]/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4D4489] focus-visible:ring-offset-2"
        >
          Grow
        </Link>

        <nav
          className="hidden items-center gap-1 rounded-full border border-[#806589]/18 bg-[#806589]/5 p-1 shadow-[inset_0_1px_0_rgba(128,101,137,0.08)] lg:flex"
          aria-label="Navegacao institucional"
        >
          {navLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                isNavActive(location.pathname, location.hash, link.to)
                  ? "bg-[#806589]/15 text-[#806589] shadow-sm"
                  : "text-[#806589]/70 hover:bg-[#806589]/10 hover:text-[#806589]"
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
              className="h-10 w-10 rounded-full border-[#806589]/20 bg-[#806589]/5 text-[#806589] hover:bg-[#806589]/10"
              onClick={toggleTheme}
              aria-label={isDark ? "Ativar modo claro" : "Ativar modo escuro"}
            >
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
          ) : (
            <span className="h-9 w-9 rounded-full border border-border/80 bg-background" />
          )}

          <Button asChild variant="ghost" size="sm" className="rounded-full text-[#806589]/80 hover:bg-[#806589]/10 hover:text-[#806589]">
            <Link to="/login">Entrar</Link>
          </Button>
          <Button asChild size="sm" className="rounded-full bg-[#4D4489] px-5 text-[#806589] hover:bg-[#64518C]">
            <Link to="/#contato">Agende uma Avaliacao</Link>
          </Button>
        </div>

        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#806589]/20 bg-[#806589]/5 text-[#806589] shadow-sm transition-colors hover:bg-[#806589]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4D4489] focus-visible:ring-offset-2 lg:hidden"
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
          className="w-[calc(100%-1rem)] max-w-sm border-r border-[#806589]/15 bg-[#01000D] p-0 text-[#806589] lg:hidden"
        >
          <SheetHeader className="border-b border-[#806589]/15 px-4 py-4 text-left">
            <SheetTitle className="text-base">Navegacao Grow</SheetTitle>
          </SheetHeader>

          <div className="h-full overflow-y-auto px-4 py-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
            <div className="mb-4 rounded-2xl border border-[#806589]/15 bg-[#806589]/5 p-3 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#806589]/70">Acesso rapido</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Link
                  to="/#contato"
                  onClick={() => setOpen(false)}
                  className="rounded-lg border border-[#806589]/15 bg-[#806589]/5 px-3 py-2 text-xs font-medium text-[#806589] transition-colors hover:bg-[#806589]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4D4489] focus-visible:ring-offset-2"
                >
                  Agendar avaliacao
                </Link>
                <Link
                  to="/newsletter"
                  onClick={() => setOpen(false)}
                  className="rounded-lg border border-[#806589]/15 bg-[#806589]/5 px-3 py-2 text-xs font-medium text-[#806589] transition-colors hover:bg-[#806589]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4D4489] focus-visible:ring-offset-2"
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
                      ? "bg-[#806589]/12 text-[#806589]"
                      : "text-[#806589]/75 hover:bg-[#806589]/10 hover:text-[#806589]"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </div>

            <Button
              type="button"
              variant="outline"
              className="mt-4 w-full rounded-full border-[#806589]/20 bg-[#806589]/5 text-[#806589] hover:bg-[#806589]/10 hover:text-[#806589]"
              onClick={toggleTheme}
            >
              {isDark ? "Usar modo claro" : "Usar modo escuro"}
            </Button>

            <div className="mt-4 grid gap-2 border-t border-[#806589]/15 pt-4">
              <Button asChild variant="outline" className="w-full rounded-full border-[#806589]/20 bg-[#806589]/5 text-[#806589] hover:bg-[#806589]/10 hover:text-[#806589]">
                <Link to="/portal" onClick={() => setOpen(false)}>
                  Portal do Cliente
                </Link>
              </Button>
              <Button asChild variant="outline" className="w-full rounded-full border-[#806589]/20 bg-[#806589]/5 text-[#806589] hover:bg-[#806589]/10 hover:text-[#806589]">
                <Link to="/login" onClick={() => setOpen(false)}>
                  Entrar
                </Link>
              </Button>
              <Button asChild className="w-full rounded-full bg-[#4D4489] text-[#806589] hover:bg-[#64518C]">
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
