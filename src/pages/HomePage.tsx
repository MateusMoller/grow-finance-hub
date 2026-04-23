import { SiteLayout } from "@/components/site/SiteLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BarChart3,
  Briefcase,
  Building2,
  CheckCircle2,
  FileText,
  FolderOpen,
  Search,
  Shield,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { captureSiteLead } from "@/lib/siteLeadCapture";
import growLockupHorizontalDark from "@/assets/brand/grow-lockup-horizontal-dark.png";
import growMonogramVertical from "@/assets/brand/grow-monogram-vertical.png";
import growStationery from "@/assets/brand/grow-stationery.jpg";

const heroStats = [
  { value: "+12", label: "anos de mercado", detail: "experiencia em contabilidade consultiva" },
  { value: "120+", label: "empresas apoiadas", detail: "rotinas contabeis, fiscais e financeiras" },
  { value: "100%", label: "foco em conformidade", detail: "processos com controle e previsibilidade" },
];

const services = [
  { icon: BarChart3, title: "Contabilidade consultiva", description: "Fechamentos, demonstrativos e leitura gerencial para decisoes com contexto." },
  { icon: Shield, title: "Assessoria fiscal", description: "Planejamento, revisoes e acompanhamento para reduzir risco tributario." },
  { icon: Users, title: "Departamento pessoal", description: "Folha, admissoes, ferias e rotinas trabalhistas com processos organizados." },
  { icon: Building2, title: "Abertura de empresas", description: "Apoio completo na estruturacao, regularizacao e escolha de regime." },
  { icon: FileText, title: "Relatorios gerenciais", description: "Indicadores objetivos para acompanhar performance, margem e crescimento." },
  { icon: Briefcase, title: "Suporte ao empresario", description: "Acompanhamento estrategico para priorizar acoes e reduzir pontos cegos." },
];

const differentials = [
  { icon: Search, title: "Clareza operacional", description: "Informacao organizada por prioridade, prazo e impacto para o negocio." },
  { icon: Zap, title: "Rotina mais fluida", description: "Atendimento proximo e processos que reduzem retrabalho no dia a dia." },
  { icon: Shield, title: "Seguranca tecnica", description: "Conformidade fiscal e trabalhista tratada com padrao, historico e controle." },
  { icon: TrendingUp, title: "Visao de crescimento", description: "A contabilidade entra como direcao, nao apenas como obrigacao." },
];

const journey = [
  { icon: FolderOpen, title: "Diagnostico", description: "Mapeamos rotinas, pendencias e riscos atuais." },
  { icon: Search, title: "Organizacao", description: "Criamos um plano pratico com prioridades claras." },
  { icon: Shield, title: "Controle", description: "Acompanhamos prazos, documentos e conformidade." },
  { icon: TrendingUp, title: "Decisao", description: "Transformamos dados contabeis em direcao gerencial." },
];

const testimonials = [
  {
    name: "Lucas Moreira",
    role: "CEO, TechNova",
    text: "A Grow trouxe clareza para nossas decisoes mensais. Hoje sabemos onde agir antes que o problema cresca.",
  },
  {
    name: "Mariana Ribeiro",
    role: "Fundadora, Casa Verde",
    text: "O atendimento ficou mais proximo e organizado. Conseguimos regularizar pendencias sem perder o ritmo da empresa.",
  },
  {
    name: "Rafael Alves",
    role: "Diretor Financeiro, BlueLine",
    text: "A leitura gerencial mensal virou parte importante da nossa rotina de crescimento.",
  },
];

const fadeIn = {
  initial: { opacity: 0, y: 18 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.15 },
  transition: { duration: 0.45 },
};

export default function HomePage() {
  const [sending, setSending] = useState(false);
  const [leadForm, setLeadForm] = useState({
    fullName: "",
    companyName: "",
    email: "",
  });

  const handleLeadSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const fullName = leadForm.fullName.trim();
    const email = leadForm.email.trim();

    if (!fullName || !email) {
      toast.error("Preencha nome e e-mail para continuar.");
      return;
    }

    setSending(true);

    const { error } = await captureSiteLead({
      fullName,
      companyName: leadForm.companyName.trim(),
      email,
      originPage: "home",
    });

    setSending(false);

    if (error) {
      toast.error(`Nao foi possivel enviar sua solicitacao: ${error.message}`);
      return;
    }

    setLeadForm({
      fullName: "",
      companyName: "",
      email: "",
    });
    toast.success("Solicitacao enviada com sucesso. Nossa equipe entrara em contato em breve.");
  };

  return (
    <SiteLayout>
      <div className="institutional-page text-foreground transition-colors">
        <section className="container py-8 sm:py-10 md:py-14">
          <div className="institutional-hero grid gap-8 p-5 sm:p-7 lg:grid-cols-[1.05fr_0.95fr] lg:p-9">
            <img
              src={growMonogramVertical}
              alt=""
              aria-hidden="true"
              width={420}
              height={620}
              className="brand-watermark -right-20 -top-24 hidden h-[34rem] w-auto lg:block"
            />

            <motion.div {...fadeIn} className="relative z-10 flex flex-col justify-between gap-8">
              <div className="space-y-6">
                <span className="institutional-kicker">Contabilidade consultiva premium</span>
                <div className="space-y-4">
                  <h1 className="font-heading text-3xl font-bold leading-tight text-foreground sm:text-4xl md:text-5xl xl:text-6xl">
                    Clareza contabil para empresas que querem crescer com controle.
                  </h1>
                  <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
                    A Grow une atendimento proximo, inteligencia financeira e processos digitais para transformar obrigacoes em
                    decisao, previsibilidade e crescimento seguro.
                  </p>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                  <Button asChild className="w-full rounded-full px-6 sm:w-auto" size="lg">
                    <Link to="/#contato">
                      Quero uma avaliacao <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </Link>
                  </Button>
                  <Button asChild variant="hero-outline" className="w-full rounded-full px-6 sm:w-auto" size="lg">
                    <Link to="/solucoes">Conhecer solucoes</Link>
                  </Button>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                {heroStats.map((item) => (
                  <div key={item.label} className="institutional-card-muted p-4">
                    <div className="font-heading text-2xl font-bold tabular-nums text-foreground">{item.value}</div>
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-foreground/82">{item.label}</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.detail}</p>
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.aside
              {...fadeIn}
              transition={{ duration: 0.45, delay: 0.1 }}
              className="relative z-10 overflow-hidden rounded-[1.75rem] border border-border/80 bg-[#50516f] p-3 shadow-lg"
            >
              <div className="rounded-[1.35rem] bg-white p-3">
                <img
                  src={growLockupHorizontalDark}
                  alt="Identidade visual Grow Contabilidade"
                  width={780}
                  height={248}
                  className="w-full rounded-[1rem] object-cover"
                />
              </div>
              <div className="mt-4 grid gap-3 rounded-[1.35rem] border border-white/12 bg-white/10 p-4 text-white backdrop-blur">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-white/64">Painel de decisao</p>
                    <p className="mt-1 font-heading text-xl font-semibold">Resultado mensal claro</p>
                  </div>
                  <div className="rounded-full bg-grow-gold px-3 py-1 text-xs font-bold text-grow-gold-foreground">Ao vivo</div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {["Fiscal", "Pessoal", "Gestao"].map((label, index) => (
                    <div key={label} className="rounded-2xl border border-white/12 bg-white/10 p-3">
                      <p className="text-[11px] text-white/60">{label}</p>
                      <p className="mt-1 text-lg font-semibold tabular-nums">{[94, 88, 97][index]}%</p>
                    </div>
                  ))}
                </div>
              </div>
            </motion.aside>
          </div>
        </section>

        <section id="institucional" className="py-10 md:py-14">
          <div className="container grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
            <motion.article {...fadeIn} className="institutional-card p-6 md:p-7">
              <span className="institutional-kicker">DNA Grow</span>
              <h2 className="mt-4 font-heading text-2xl font-semibold sm:text-3xl">Tecnica, proximidade e solidez em uma unica jornada.</h2>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                A experiencia institucional precisa transmitir confianca antes do primeiro contato. Por isso, a nova vitrine
                organiza proposta de valor, prova de competencia e caminhos claros para falar com especialistas.
              </p>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                {["Confianca", "Clareza", "Crescimento"].map((item) => (
                  <div key={item} className="institutional-card-muted p-3">
                    <p className="text-sm font-semibold">{item}</p>
                    <p className="mt-1 text-xs text-muted-foreground">Presente em cada ponto de contato.</p>
                  </div>
                ))}
              </div>
            </motion.article>

            <motion.article {...fadeIn} transition={{ duration: 0.45, delay: 0.1 }} className="institutional-card overflow-hidden">
              <img
                src={growStationery}
                alt="Aplicacao da identidade Grow em materiais institucionais"
                width={980}
                height={604}
                loading="lazy"
                className="h-72 w-full object-cover"
              />
              <div className="p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Marca aplicada</p>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  Elementos visuais entram como apoio de credibilidade, sem competir com conteudo, CTA ou leitura.
                </p>
              </div>
            </motion.article>
          </div>
        </section>

        <section id="servicos" className="py-10 md:py-14">
          <div className="container">
            <motion.div {...fadeIn} className="mb-6 max-w-3xl">
              <span className="institutional-kicker">Solucoes integradas</span>
              <h2 className="mt-4 font-heading text-2xl font-semibold sm:text-3xl">O escritorio contabil como plataforma de decisao.</h2>
            </motion.div>
            <div className="hide-scrollbar mx-[-1rem] flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:snap-none md:grid-cols-2 md:gap-4 md:overflow-visible md:px-0 md:pb-0 xl:grid-cols-3">
              {services.map((service, index) => (
                <motion.article
                  key={service.title}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.15 }}
                  transition={{ duration: 0.35, delay: index * 0.04 }}
                  className="institutional-card group min-w-[84%] snap-start p-5 sm:min-w-[72%] md:min-w-0"
                >
                  <div className="mb-4 inline-flex rounded-2xl bg-primary/10 p-3 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                    <service.icon className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <h3 className="font-heading text-base font-semibold">{service.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{service.description}</p>
                </motion.article>
              ))}
            </div>
          </div>
        </section>

        <section id="diferenciais" className="py-10 md:py-14">
          <div className="container grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <motion.div {...fadeIn} className="space-y-4">
              <span className="institutional-kicker">Diferenciais</span>
              <h2 className="font-heading text-2xl font-semibold sm:text-3xl">Menos ruído, mais orientacao para agir.</h2>
              <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
                A Grow combina rigor tecnico com linguagem simples. O resultado e uma experiencia em que o cliente entende
                prazos, riscos, proximas acoes e impacto financeiro.
              </p>
              <Button asChild variant="outline" className="rounded-full">
                <Link to="/contato">Falar com consultor</Link>
              </Button>
            </motion.div>

            <div className="grid gap-3 sm:grid-cols-2">
              {differentials.map((item, index) => (
                <motion.article
                  key={item.title}
                  initial={{ opacity: 0, y: 14 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={{ duration: 0.35, delay: index * 0.05 }}
                  className="institutional-card-muted p-5"
                >
                  <item.icon className="h-5 w-5 text-primary" aria-hidden="true" />
                  <h3 className="mt-3 font-heading text-base font-semibold">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.description}</p>
                </motion.article>
              ))}
            </div>
          </div>
        </section>

        <section className="py-10 md:py-14">
          <div className="container">
            <motion.div {...fadeIn} className="institutional-card p-5 md:p-8">
              <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div>
                  <span className="institutional-kicker">Metodo de trabalho</span>
                  <h2 className="mt-4 font-heading text-2xl font-semibold sm:text-3xl">Da organizacao ao crescimento seguro.</h2>
                </div>
                <p className="max-w-md text-sm text-muted-foreground">
                  Uma jornada simples para transformar rotina contabil em gestao acompanhada.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {journey.map((item, index) => (
                  <div key={item.title} className="relative rounded-2xl border border-border/80 bg-background/70 p-4">
                    <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <item.icon className="h-4 w-4" aria-hidden="true" />
                    </div>
                    <p className="text-sm font-semibold">{item.title}</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.description}</p>
                    <span className="absolute right-4 top-4 text-xs font-bold tabular-nums text-muted-foreground">0{index + 1}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </section>

        <section id="clientes" className="py-10 md:py-14">
          <div className="container space-y-6">
            <motion.div {...fadeIn}>
              <span className="institutional-kicker">Clientes</span>
              <h2 className="mt-4 font-heading text-2xl font-semibold sm:text-3xl">Percepcao de valor desde o primeiro contato.</h2>
            </motion.div>

            <div className="hide-scrollbar mx-[-1rem] flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:snap-none md:grid-cols-3 md:gap-4 md:overflow-visible md:px-0 md:pb-0">
              {testimonials.map((testimonial, index) => (
                <motion.article
                  key={testimonial.name}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.15 }}
                  transition={{ duration: 0.35, delay: index * 0.05 }}
                  className="institutional-card min-w-[84%] snap-start p-5 sm:min-w-[72%] md:min-w-0"
                >
                  <p className="text-sm leading-relaxed text-muted-foreground">"{testimonial.text}"</p>
                  <div className="mt-5 border-t border-border pt-4">
                    <p className="text-sm font-semibold text-foreground">{testimonial.name}</p>
                    <p className="text-xs text-muted-foreground">{testimonial.role}</p>
                  </div>
                </motion.article>
              ))}
            </div>
          </div>
        </section>

        <section id="contato" className="py-12 md:py-16">
          <div className="container">
            <div className="institutional-hero grid gap-8 p-5 sm:p-7 lg:grid-cols-[1fr_1.05fr] lg:p-9">
              <motion.div {...fadeIn}>
                <span className="institutional-kicker">Proxima melhor acao</span>
                <h2 className="mt-4 font-heading text-2xl font-semibold leading-tight sm:text-3xl">
                  Receba uma avaliacao inicial para organizar sua contabilidade com estrategia.
                </h2>
                <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
                  Informe seus dados e a equipe Grow retorna com um primeiro direcionamento para sua empresa.
                </p>
                <div className="mt-6 space-y-3 text-sm">
                  {["Diagnostico inicial", "Prazos e prioridades", "Caminho de crescimento"].map((item) => (
                    <p key={item} className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-primary" aria-hidden="true" />
                      {item}
                    </p>
                  ))}
                </div>
              </motion.div>

              <motion.form
                {...fadeIn}
                transition={{ duration: 0.45, delay: 0.1 }}
                onSubmit={handleLeadSubmit}
                className="institutional-card space-y-4 p-5"
              >
                <div>
                  <label htmlFor="home-lead-name" className="mb-1.5 block text-sm font-medium">Nome completo</label>
                  <Input
                    id="home-lead-name"
                    name="full_name"
                    autoComplete="name"
                    placeholder="Seu nome completo"
                    required
                    value={leadForm.fullName}
                    onChange={(event) => setLeadForm((prev) => ({ ...prev, fullName: event.target.value }))}
                    className="rounded-full"
                  />
                </div>
                <div>
                  <label htmlFor="home-lead-company" className="mb-1.5 block text-sm font-medium">Empresa</label>
                  <Input
                    id="home-lead-company"
                    name="company_name"
                    autoComplete="organization"
                    placeholder="Nome da empresa"
                    value={leadForm.companyName}
                    onChange={(event) => setLeadForm((prev) => ({ ...prev, companyName: event.target.value }))}
                    className="rounded-full"
                  />
                </div>
                <div>
                  <label htmlFor="home-lead-email" className="mb-1.5 block text-sm font-medium">E-mail</label>
                  <Input
                    id="home-lead-email"
                    name="email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    spellCheck={false}
                    placeholder="voce@empresa.com.br"
                    required
                    value={leadForm.email}
                    onChange={(event) => setLeadForm((prev) => ({ ...prev, email: event.target.value }))}
                    className="rounded-full"
                  />
                </div>
                <p className="text-xs text-muted-foreground">Garantimos confidencialidade e seguranca dos seus dados.</p>
                <Button type="submit" className="w-full rounded-full" disabled={sending}>
                  {sending ? "Enviando…" : "Solicitar avaliacao gratuita"}
                  {!sending && <ArrowRight className="h-4 w-4" aria-hidden="true" />}
                </Button>
              </motion.form>
            </div>
          </div>
        </section>
      </div>
    </SiteLayout>
  );
}
