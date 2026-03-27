import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Menu, Moon, Sun, X } from "lucide-react";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "next-themes";
import growIcon from "@/assets/grow-icon.png";

const navLinks = [
  { label: "Institucional", to: "/" },
  { label: "Servicos", to: "/#servicos" },
  { label: "Diferenciais", to: "/#diferenciais" },
  { label: "Clientes", to: "/#clientes" },
  { label: "Contato", to: "/contato" },
];

const MOBILE_APP_DEEP_LINK = import.meta.env.VITE_MOBILE_APP_DEEP_LINK ?? "growfinance://app";
const MOBILE_APP_FALLBACK_URL =
  import.meta.env.VITE_MOBILE_APP_FALLBACK_URL ?? "https://github.com/MateusMoller/grow-finance-mobile";

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

  const isDark = resolvedTheme === "dark";
  const toggleTheme = () => {
    setTheme(isDark ? "light" : "dark");
  };

  const openMobileApp = () => {
    window.location.href = MOBILE_APP_DEEP_LINK;

    window.setTimeout(() => {
      const hidden = document.visibilityState === "hidden";
      if (!hidden) {
        window.open(MOBILE_APP_FALLBACK_URL, "_blank", "noopener,noreferrer");
      }
    }, 1200);
  };

  return (
    <header className="fixed left-0 right-0 top-0 z-50 border-b border-border/80 bg-white/95 backdrop-blur dark:bg-[#061330]/95">
      <div className="container flex h-20 items-center justify-between">
        <Link to="/" className="flex items-center gap-3">
          <img src={growIcon} alt="Grow" className="h-8 w-8 rounded-md" />
          <span className="font-heading text-lg font-semibold text-foreground">Grow Contabilidade</span>
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
          <Button type="button" variant="outline" size="sm" className="rounded-full px-5" onClick={openMobileApp}>
            Abrir no App
          </Button>
          <Button asChild size="sm" className="rounded-full px-5">
            <Link to="/#contato">Agende uma Avaliacao</Link>
          </Button>
        </div>

        <button className="rounded-md p-2 lg:hidden" onClick={() => setOpen((prev) => !prev)} aria-label="Abrir menu">
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="border-t border-border bg-white dark:bg-[#061330] lg:hidden"
          >
            <div className="container py-4">
              <div className="flex flex-col gap-2">
                {navLinks.map((link) => (
                  <Link
                    key={link.to}
                    to={link.to}
                    onClick={() => setOpen(false)}
                    className="rounded-lg px-3 py-2 text-sm text-foreground hover:bg-muted"
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
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setOpen(false);
                    openMobileApp();
                  }}
                >
                  Abrir no App
                </Button>
                <Button asChild className="w-full">
                  <Link to="/#contato" onClick={() => setOpen(false)}>
                    Agende uma Avaliacao
                  </Link>
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
