import { Link } from "react-router-dom";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import growIcon from "@/assets/grow-icon.png";
import { subscribeToNewsletter } from "@/lib/newsletter";

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
    <footer className="border-t border-border/70 bg-background/95 pb-16 md:pb-0">
      <div className="container py-10 sm:py-14">
        <div className="grid gap-7 sm:gap-8 lg:grid-cols-[1.35fr_1fr_1fr_1.25fr]">
          <section className="rounded-2xl border border-border/70 bg-card/80 p-5 shadow-xs sm:p-6">
            <Link to="/" className="flex items-center gap-3">
              <span className="inline-flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl border border-border/70 bg-background shadow-xs">
                <img src={growIcon} alt="Grow" className="h-full w-full object-cover" />
              </span>
              <span className="font-heading text-lg font-semibold tracking-tight text-foreground">Grow Contabilidade</span>
            </Link>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted-foreground">
              Contabilidade consultiva para empresas que buscam crescimento com organizacao, clareza e suporte estrategico.
            </p>

            <dl className="mt-5 space-y-2 text-sm">
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">Endereco</dt>
                <dd className="mt-0.5 text-foreground">Rua Julio de Castilhos, 2579 - Sala 212, Centro, Taquara - RS</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">Contato</dt>
                <dd className="mt-0.5 text-foreground">(51) 99532-5592 | contato@contabilidadegrow.com.br</dd>
              </div>
            </dl>
          </section>

          <section>
            <h4 className="font-heading text-sm font-semibold uppercase tracking-wide text-foreground">Servicos</h4>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li><Link to="/solucoes" className="transition-colors hover:text-foreground">Contabilidade consultiva</Link></li>
              <li><Link to="/solucoes" className="transition-colors hover:text-foreground">Assessoria fiscal</Link></li>
              <li><Link to="/solucoes" className="transition-colors hover:text-foreground">Departamento pessoal</Link></li>
              <li><Link to="/solucoes" className="transition-colors hover:text-foreground">Abertura de empresas</Link></li>
            </ul>
          </section>

          <section>
            <h4 className="font-heading text-sm font-semibold uppercase tracking-wide text-foreground">Institucional</h4>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li><Link to="/" className="transition-colors hover:text-foreground">Sobre a Grow</Link></li>
              <li><Link to="/#clientes" className="transition-colors hover:text-foreground">Clientes</Link></li>
              <li><Link to="/newsletter" className="transition-colors hover:text-foreground">Newsletter</Link></li>
              <li><Link to="/contato" className="transition-colors hover:text-foreground">Contato</Link></li>
              <li><Link to="/login" className="transition-colors hover:text-foreground">Area interna</Link></li>
            </ul>
          </section>

          <section className="rounded-2xl border border-border/70 bg-card/80 p-5 shadow-xs sm:p-6">
            <h4 className="font-heading text-sm font-semibold uppercase tracking-wide text-foreground">Novidades da Grow</h4>
            <p className="mt-2 text-sm text-muted-foreground">
              Receba conteudos sobre gestao, obrigacoes e oportunidades para sua empresa.
            </p>
            <form onSubmit={handleSubscribe} className="mt-4 flex flex-col gap-2">
              <Input
                type="email"
                placeholder="Seu e-mail"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="h-10 bg-background"
              />
              <Button type="submit" variant="hero" size="sm" disabled={subscribing} className="h-10 w-full rounded-xl">
                {subscribing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Assinar newsletter"}
              </Button>
            </form>
          </section>
        </div>

        <div className="mt-8 flex flex-col gap-3 border-t border-border/70 pt-5 text-xs text-muted-foreground md:mt-10 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <p>© {new Date().getFullYear()} Grow Contabilidade. Todos os direitos reservados.</p>
            <p>
              Criado por{" "}
              <a
                href="https://www.linkedin.com/in/mateus-henrique-moller/"
                target="_blank"
                rel="noreferrer"
                className="text-muted-foreground/90 transition-colors hover:text-foreground hover:underline underline-offset-2"
              >
                Mateus Henrique Moller
              </a>
              .
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 sm:gap-4">
            <Link to="/privacidade" className="transition-colors hover:text-foreground">Politica de privacidade</Link>
            <Link to="/termos" className="transition-colors hover:text-foreground">Termos</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
