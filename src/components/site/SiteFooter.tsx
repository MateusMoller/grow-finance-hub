import { Link } from "react-router-dom";
import { useState } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
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
    <footer className="relative overflow-hidden border-t border-border bg-[#eef0f4] pb-16 dark:bg-[#031029] md:pb-0">
      <img
        src={growMonogramVertical}
        alt=""
        aria-hidden="true"
        width={360}
        height={520}
        loading="lazy"
        className="brand-watermark -right-20 top-8 hidden h-[28rem] w-auto md:block"
      />
      <div className="container relative py-10 sm:py-14">
        <div className="grid gap-8 sm:gap-10 md:grid-cols-2 lg:grid-cols-5">
          <div className="institutional-card relative overflow-hidden space-y-4 p-5 lg:col-span-2">
            <Link
              to="/"
              className="block w-fit rounded-[1.35rem] border border-[#50516f]/10 bg-[#50516f] p-2.5 shadow-sm transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <img
                src={growLockupHorizontalDark}
                alt="Grow Contabilidade"
                width={220}
                height={70}
                className="h-12 w-auto rounded-[0.95rem] object-cover sm:h-14"
              />
            </Link>
            <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
              Contabilidade consultiva, proximidade e tecnologia para empresas que precisam crescer com clareza e solidez.
            </p>
            <div className="flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              <span>Compliance</span>
              <span>•</span>
              <span>Clareza</span>
              <span>•</span>
              <span>Decisao</span>
            </div>
          </div>

          <div>
            <h4 className="font-heading text-sm font-semibold uppercase tracking-wide text-foreground">Servicos</h4>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li><Link to="/solucoes" className="premium-link">Contabilidade Consultiva</Link></li>
              <li><Link to="/solucoes" className="premium-link">Assessoria Fiscal</Link></li>
              <li><Link to="/solucoes" className="premium-link">Departamento Pessoal</Link></li>
              <li><Link to="/solucoes" className="premium-link">Abertura de Empresas</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-heading text-sm font-semibold uppercase tracking-wide text-foreground">Institucional</h4>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li><Link to="/" className="premium-link">Sobre a Grow</Link></li>
              <li><Link to="/#clientes" className="premium-link">Clientes</Link></li>
              <li><Link to="/newsletter" className="premium-link">Newsletter</Link></li>
              <li><Link to="/contato" className="premium-link">Contato</Link></li>
              <li><Link to="/login" className="premium-link">Area interna</Link></li>
            </ul>
          </div>

          <div className="space-y-4">
            <div>
              <h4 className="font-heading text-sm font-semibold uppercase tracking-wide text-foreground">Contato</h4>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                <li>Rua Julio de Castilhos, 2579 - Sl 212 - Centro, Taquara - RS</li>
                <li><a href="tel:+5551995325592" className="premium-link">Telefone: (51) 99532-5592</a></li>
                <li><a href="mailto:contato@contabilidadegrow.com.br" className="premium-link">contato@contabilidadegrow.com.br</a></li>
                <li>
                  <a
                    href="https://www.instagram.com/contabilidade.grow/"
                    target="_blank"
                    rel="noreferrer"
                    className="premium-link"
                  >
                    @contabilidade.grow
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Assine nossa newsletter</p>
              <form onSubmit={handleSubscribe} className="mt-2 flex flex-col gap-2 sm:flex-row">
                <label htmlFor="footer-newsletter-email" className="sr-only">E-mail para newsletter</label>
                <Input
                  id="footer-newsletter-email"
                  name="newsletter_email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  spellCheck={false}
                  placeholder="voce@empresa.com.br"
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
                  {subscribing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                      <span className="sr-only">Inscrevendo…</span>
                    </>
                  ) : (
                    "Inscrever"
                  )}
                  {!subscribing && <ArrowRight className="h-4 w-4" aria-hidden="true" />}
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
            <Link to="/privacidade" className="premium-link">Politica de Privacidade</Link>
            <Link to="/termos" className="premium-link">Termos</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
