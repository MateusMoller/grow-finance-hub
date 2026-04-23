import { useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, Mail, MapPin, Phone } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import growIcon from "@/assets/grow-icon.png";
import { subscribeToNewsletter } from "@/lib/newsletter";

const footerLinks = {
  servicos: [
    { label: "Contabilidade Consultiva", to: "/solucoes" },
    { label: "Assessoria Fiscal", to: "/solucoes" },
    { label: "Departamento Pessoal", to: "/solucoes" },
    { label: "BPO Financeiro", to: "/solucoes" },
  ],
  institucional: [
    { label: "Institucional", to: "/" },
    { label: "Newsletter", to: "/newsletter" },
    { label: "Contato", to: "/contato" },
    { label: "Área interna", to: "/login" },
  ],
} as const;

export function SiteFooter() {
  const [email, setEmail] = useState("");
  const [subscribing, setSubscribing] = useState(false);

  const handleSubscribe = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const normalizedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      toast.error("Informe um e-mail válido para assinar a newsletter.");
      return;
    }

    setSubscribing(true);

    try {
      const { error } = await subscribeToNewsletter({
        email: normalizedEmail,
        source: "site_footer",
      });

      if (error) {
        toast.error(`Não foi possível assinar a newsletter: ${error.message}`);
        return;
      }

      setEmail("");
      toast.success("Pronto! Você agora recebe as próximas newsletters da Grow.");
    } finally {
      setSubscribing(false);
    }
  };

  return (
    <footer className="border-t border-border bg-[#efeff2] pb-16 dark:bg-[#031029] md:pb-0">
      <div className="container py-12 sm:py-14">
        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.7fr_0.7fr_1fr]">
          <div className="rounded-[28px] border border-border bg-card p-6 shadow-sm dark:border-[#223058] dark:bg-[#0a1734]">
            <Link to="/" className="flex items-center gap-3">
              <img src={growIcon} alt="Grow" className="h-9 w-9 rounded-xl" />
              <div>
                <p className="font-heading text-lg font-semibold text-foreground">Grow Contabilidade</p>
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Consultoria e operação</p>
              </div>
            </Link>

            <p className="mt-5 max-w-sm text-sm leading-7 text-muted-foreground">
              Estruturamos processos contábeis, fiscais e financeiros para empresas que precisam crescer com controle,
              previsibilidade e leitura gerencial.
            </p>

            <div className="mt-6 space-y-3 text-sm text-muted-foreground">
              <div className="flex items-start gap-3">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span>Rua Julio de Castilhos, 2579 - Sl 212 - Centro, Taquara - RS</span>
              </div>
              <div className="flex items-center gap-3">
                <Phone className="h-4 w-4 shrink-0 text-primary" />
                <span>(51) 99532-5592</span>
              </div>
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 shrink-0 text-primary" />
                <span>contato@contabilidadegrow.com.br</span>
              </div>
            </div>
          </div>

          <div className="rounded-[28px] border border-border bg-card p-6 shadow-sm dark:border-[#223058] dark:bg-[#0a1734]">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Serviços</p>
            <ul className="mt-5 space-y-3 text-sm text-muted-foreground">
              {footerLinks.servicos.map((item) => (
                <li key={item.label}>
                  <Link to={item.to} className="transition-colors hover:text-foreground">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-[28px] border border-border bg-card p-6 shadow-sm dark:border-[#223058] dark:bg-[#0a1734]">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Institucional</p>
            <ul className="mt-5 space-y-3 text-sm text-muted-foreground">
              {footerLinks.institucional.map((item) => (
                <li key={item.label}>
                  <Link to={item.to} className="transition-colors hover:text-foreground">
                    {item.label}
                  </Link>
                </li>
              ))}
              <li>
                <a
                  href="https://www.instagram.com/contabilidade.grow/"
                  target="_blank"
                  rel="noreferrer"
                  className="transition-colors hover:text-foreground"
                >
                  Instagram
                </a>
              </li>
            </ul>
          </div>

          <div className="rounded-[28px] border border-border bg-card p-6 shadow-sm dark:border-[#223058] dark:bg-[#0a1734]">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Newsletter</p>
            <h3 className="mt-3 font-heading text-xl font-semibold">Receba conteúdos da Grow</h3>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">
              Assine para receber novidades, orientações e materiais sobre gestão, contabilidade e crescimento empresarial.
            </p>

            <form onSubmit={handleSubscribe} className="mt-5 space-y-3">
              <Input
                type="email"
                placeholder="Seu e-mail"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="h-11 rounded-full bg-white dark:border-[#28355f] dark:bg-[#0a1734]"
              />
              <Button type="submit" disabled={subscribing} className="h-11 w-full rounded-full">
                {subscribing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Inscrever-se"}
              </Button>
            </form>
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-3 border-t border-border pt-5 text-xs text-muted-foreground md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <p>© {new Date().getFullYear()} Grow Contabilidade. Todos os direitos reservados.</p>
            <p>
              Criado por{" "}
              <a
                href="https://www.linkedin.com/in/mateus-henrique-moller/"
                target="_blank"
                rel="noreferrer"
                className="transition-colors hover:text-foreground hover:underline underline-offset-2"
              >
                Mateus Henrique Moller
              </a>
              .
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <Link to="/privacidade" className="transition-colors hover:text-foreground">
              Política de Privacidade
            </Link>
            <Link to="/termos" className="transition-colors hover:text-foreground">
              Termos
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
