import { Link } from "react-router-dom";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { subscribeToNewsletter } from "@/lib/newsletter";
import growLockupHorizontalDark from "@/assets/brand/grow-lockup-horizontal-dark.png";
import growMonogramVertical from "@/assets/brand/grow-monogram-vertical.png";

export function SiteFooter() {
  const [email, setEmail] = useState("");
  const [subscribing, setSubscribing] = useState(false);

  const handleSubscribe = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const normalizedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      toast.error("Informe um e-mail valido para assinar a newsletter.");
      return;
    }

    setSubscribing(true);
    const { error } = await subscribeToNewsletter({
      email: normalizedEmail,
      source: "site_footer",
    });
    setSubscribing(false);

    if (error) {
      toast.error(`Nao foi possivel assinar a newsletter: ${error.message}`);
      return;
    }

    setEmail("");
    toast.success("Pronto! Voce agora recebe as proximas newsletters da Grow.");
  };

  return (
    <footer className="border-t border-border bg-[#efeff2] pb-16 dark:bg-[#031029] md:pb-0">
      <div className="container py-10 sm:py-14">
        <div className="grid gap-8 sm:gap-10 md:grid-cols-2 lg:grid-cols-5">
          <div className="executive-panel relative overflow-hidden space-y-4 p-5 lg:col-span-2">
            <img
              src={growMonogramVertical}
              alt=""
              aria-hidden="true"
              className="pointer-events-none absolute -bottom-20 -right-8 hidden h-64 w-auto mix-blend-multiply opacity-[0.07] md:block dark:hidden"
            />
            <Link
              to="/"
              className="relative z-10 block w-fit overflow-hidden rounded-[1.35rem] border border-[#50516f]/10 bg-[#50516f] p-2.5 shadow-sm"
            >
              <img
                src={growLockupHorizontalDark}
                alt="Grow Contabilidade"
                className="h-12 w-auto rounded-[0.95rem] object-cover sm:h-14"
              />
            </Link>
            <p className="relative z-10 max-w-sm text-sm leading-relaxed text-muted-foreground">
              Parceiro estrategico de empresas que buscam crescimento com organizacao, compliance e inteligencia.
            </p>
            <p className="relative z-10 max-w-sm text-xs uppercase tracking-[0.18em] text-muted-foreground/80">
              Consultoria, clareza e presenca de marca com sobriedade.
            </p>
          </div>

          <div>
            <h4 className="font-heading text-sm font-semibold uppercase tracking-wide text-foreground">Servicos</h4>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li><Link to="/solucoes" className="hover:text-foreground">Contabilidade Consultiva</Link></li>
              <li><Link to="/solucoes" className="hover:text-foreground">Assessoria Fiscal</Link></li>
              <li><Link to="/solucoes" className="hover:text-foreground">Departamento Pessoal</Link></li>
              <li><Link to="/solucoes" className="hover:text-foreground">Abertura de Empresas</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-heading text-sm font-semibold uppercase tracking-wide text-foreground">Institucional</h4>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li><Link to="/" className="hover:text-foreground">Sobre a Grow</Link></li>
              <li><Link to="/#clientes" className="hover:text-foreground">Clientes</Link></li>
              <li><Link to="/newsletter" className="hover:text-foreground">Newsletter</Link></li>
              <li><Link to="/contato" className="hover:text-foreground">Contato</Link></li>
              <li><Link to="/login" className="hover:text-foreground">Area interna</Link></li>
            </ul>
          </div>

          <div className="space-y-4">
            <div>
              <h4 className="font-heading text-sm font-semibold uppercase tracking-wide text-foreground">Contato</h4>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                <li>Rua Julio de Castilhos, 2579 - Sl 212 - Centro, Taquara - RS</li>
                <li>Telefone: (51) 99532-5592</li>
                <li>E-mail: contato@contabilidadegrow.com.br</li>
                <li>
                  Instagram:{" "}
                  <a
                    href="https://www.instagram.com/contabilidade.grow/"
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-foreground"
                  >
                    @contabilidade.grow
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Assine nossa newsletter</p>
              <form onSubmit={handleSubscribe} className="mt-2 flex flex-col gap-2 sm:flex-row">
                <Input
                  type="email"
                  placeholder="Seu e-mail"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="h-10 bg-white dark:border-[#28355f] dark:bg-[#0a1734]"
                />
                <Button
                  type="submit"
                  size="sm"
                  disabled={subscribing}
                  className="h-10 w-full rounded-full px-4 sm:w-auto"
                >
                  {subscribing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Inscrever"}
                </Button>
              </form>
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-3 border-t border-border pt-5 text-xs text-muted-foreground md:mt-10 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <p>(c) {new Date().getFullYear()} Grow Contabilidade. Todos os direitos reservados.</p>
            <p>
              Criado por{" "}
              <a
                href="https://www.linkedin.com/in/mateus-henrique-moller/"
                target="_blank"
                rel="noreferrer"
                className="text-muted-foreground/90 transition-colors hover:text-foreground hover:underline underline-offset-2"
              >
                Mateus Henrique Moller
              </a>.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 sm:gap-4">
            <Link to="/privacidade" className="hover:text-foreground">Politica de Privacidade</Link>
            <Link to="/termos" className="hover:text-foreground">Termos</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
