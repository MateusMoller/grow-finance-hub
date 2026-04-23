import { SiteLayout } from "@/components/site/SiteLayout";
import { SiteLeadForm } from "@/components/site/SiteLeadForm";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  BarChart3,
  Briefcase,
  CheckCircle2,
  FileText,
  FolderOpen,
  Search,
  Shield,
  Star,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import growLockupHorizontalDark from "@/assets/brand/grow-lockup-horizontal-dark.png";
import growStationery from "@/assets/brand/grow-stationery.jpg";

const trustLogos = ["Grow", "Fiscal Pro", "DP Smart", "Ledger", "Compliance", "Advisory"];

const services = [
  { icon: FileText, title: "Contabilidade consultiva", description: "Fechamentos, demonstrativos e leitura gerencial para decisoes com contexto." },
  { icon: Shield, title: "Assessoria fiscal", description: "Planejamento, revisoes e acompanhamento para reduzir risco tributario." },
  { icon: Users, title: "Departamento pessoal", description: "Folha, admissoes, ferias e rotinas trabalhistas com processos organizados." },
  { icon: BarChart3, title: "Relatorios gerenciais", description: "Indicadores objetivos para acompanhar performance, margem e crescimento." },
];

const differentials = [
  { title: "Profissionais certificados", description: "Equipe experiente para acompanhar decisoes contabeis, fiscais e financeiras." },
  { title: "Clareza nos proximos passos", description: "Prazos, pendencias e prioridades aparecem de forma objetiva para o cliente." },
  { title: "Seguranca de dados", description: "Rotinas com rastreabilidade e cuidado com informacoes sensiveis." },
  { title: "Entrega no prazo", description: "Acompanhamento de obrigacoes para reduzir atrasos e retrabalho." },
];

const journey = [
  { title: "Diagnostico", description: "Mapeamos rotinas, pendencias e riscos atuais.", icon: FolderOpen },
  { title: "Revisao", description: "Auditamos dados e documentos para identificar lacunas.", icon: Search },
  { title: "Execucao", description: "Organizamos fluxos contabeis, fiscais e de pessoal.", icon: Zap },
  { title: "Relatorios", description: "Entregamos leitura estrategica para tomada de decisao.", icon: TrendingUp },
];

const plans = [
  { title: "Essencial", price: "Sob medida", description: "Para empresas que precisam organizar a rotina contabil.", features: ["Rotina contabil", "Acompanhamento fiscal", "Suporte por canal oficial"] },
  { title: "Crescimento", price: "Consultivo", description: "Para times que precisam de indicadores e previsibilidade.", features: ["Relatorios gerenciais", "Revisoes periodicas", "Plano de acao mensal"] },
  { title: "Premium", price: "Estrategico", description: "Para empresas que querem governanca e decisao integrada.", features: ["Consultoria executiva", "Rastreamento de prazos", "Acompanhamento dedicado"] },
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

const insights = [
  { title: "Como transformar obrigacoes em previsibilidade", date: "06 mai. 2026" },
  { title: "Indicadores contabeis que ajudam a decidir melhor", date: "18 mar. 2026" },
  { title: "Rotina fiscal sem sustos para empresas em crescimento", date: "26 jan. 2026" },
];

const fadeIn = {
  initial: { opacity: 0, y: 18 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.15 },
  transition: { duration: 0.45 },
};

export default function HomePage() {
  return (
    <SiteLayout>
      <div className="institutional-page overflow-hidden text-white">
        <section className="relative px-4 pb-14 pt-10 sm:px-6 md:pb-20 md:pt-16">
          <div className="grow-orbit right-[8%] top-16 hidden h-80 w-80 lg:block" />
          <div className="grow-orbit right-[11%] top-20 hidden h-64 w-64 lg:block" />
          <div className="container grid min-h-[620px] items-center gap-10 lg:grid-cols-[1fr_0.95fr]">
            <motion.div {...fadeIn} className="relative z-10 max-w-3xl space-y-7">
              <span className="institutional-kicker">Contabilidade consultiva Grow</span>
              <div className="space-y-4">
                <h1 className="font-heading text-4xl font-bold leading-[0.98] tracking-tight text-white sm:text-5xl md:text-6xl xl:text-7xl">
                  Contabilidade clara e confiavel para empresas em crescimento
                </h1>
                <p className="max-w-xl text-base leading-relaxed text-white/[0.74] sm:text-lg">
                  Organizamos rotinas contabeis, fiscais e financeiras para voce crescer com controle, previsibilidade e menos ruido operacional.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button asChild size="lg" className="rounded-full bg-white px-9 text-primary hover:bg-white/90">
                  <Link to="/#contato">Comecar agora</Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="rounded-full border-white/[0.24] bg-transparent px-9 text-white hover:bg-white/10 hover:text-white">
                  <Link to="/solucoes">Ver servicos</Link>
                </Button>
              </div>
            </motion.div>

            <motion.div {...fadeIn} transition={{ duration: 0.55, delay: 0.1 }} className="relative z-10 min-h-[420px]">
              <div className="grow-finance-card absolute right-4 top-3 w-[min(92%,31rem)] rotate-[14deg] p-6 text-white">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-white/[0.64]">Organizacao fiscal</p>
                    <p className="mt-2 font-heading text-3xl font-bold tabular-nums">96,8%</p>
                  </div>
                  <span className="rounded-full bg-grow-gold px-3 py-1 text-xs font-bold text-grow-gold-foreground">Grow</span>
                </div>
                <div className="mt-8 flex gap-3">
                  <span className="rounded-full bg-white px-8 py-2 text-sm font-semibold text-primary">Revisar</span>
                  <span className="rounded-full border border-white/[0.24] px-8 py-2 text-sm text-white/[0.84]">Relatorio</span>
                </div>
              </div>
              <div className="grow-finance-card absolute bottom-4 left-2 w-[min(94%,32rem)] -rotate-[12deg] p-6 text-white">
                <p className="text-sm text-white/[0.64]">Indicadores mensais</p>
                <p className="mt-2 font-heading text-4xl font-bold tabular-nums">+24,5%</p>
                <div className="mt-8 h-2 overflow-hidden rounded-full bg-white/[0.12]">
                  <div className="h-full w-[72%] rounded-full bg-gradient-to-r from-grow-gold to-white" />
                </div>
                <div className="mt-4 flex justify-between text-xs text-white/[0.64]">
                  <span>Meta</span>
                  <span>Em evolucao</span>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        <section className="grow-logo-strip py-8">
          <div className="container grid grid-cols-2 gap-6 text-center text-sm font-semibold uppercase tracking-[0.18em] text-white/[0.58] sm:grid-cols-3 lg:grid-cols-6">
            {trustLogos.map((logo) => (
              <span key={logo}>{logo}</span>
            ))}
          </div>
        </section>

        <section id="servicos" className="grow-dark-section">
          <div className="container">
            <motion.div {...fadeIn} className="mx-auto mb-10 max-w-3xl text-center">
              <h2 className="font-heading text-3xl font-bold text-white sm:text-4xl">Tudo que sua operacao financeira precisa</h2>
              <p className="mt-4 text-white/[0.68]">Da rotina contabil ao acompanhamento consultivo, a Grow entrega um ecossistema completo.</p>
            </motion.div>
            <div className="mx-auto grid max-w-5xl gap-5 md:grid-cols-2">
              {services.map((service, index) => (
                <motion.article
                  key={service.title}
                  initial={{ opacity: 0, y: 18 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.15 }}
                  transition={{ duration: 0.35, delay: index * 0.05 }}
                  className="institutional-card group p-7"
                >
                  <div className="mb-8 flex h-24 w-24 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-grow-gold">
                    <service.icon className="h-11 w-11" aria-hidden="true" />
                  </div>
                  <h3 className="font-heading text-2xl font-semibold text-white">{service.title}</h3>
                  <p className="mt-3 min-h-14 text-sm leading-relaxed text-white/[0.64]">{service.description}</p>
                  <Button asChild size="sm" className="mt-6 rounded-full bg-gradient-to-r from-primary to-grow-gold px-8 text-white">
                    <Link to="/solucoes">Saiba mais</Link>
                  </Button>
                </motion.article>
              ))}
            </div>
          </div>
        </section>

        <section id="diferenciais" className="grow-dark-section">
          <div className="container">
            <motion.div {...fadeIn} className="mx-auto mb-12 max-w-3xl text-center">
              <h2 className="font-heading text-3xl font-bold text-white sm:text-4xl">Por que empresas escolhem a Grow</h2>
              <p className="mt-4 text-white/[0.68]">A experiencia foi pensada para transmitir controle, clareza e solidez desde o primeiro contato.</p>
            </motion.div>
            <div className="grid items-center gap-10 lg:grid-cols-[0.95fr_1.05fr]">
              <div className="space-y-6">
                {differentials.map((item) => (
                  <div key={item.title} className="flex gap-4">
                    <CheckCircle2 className="mt-1 h-6 w-6 shrink-0 text-grow-gold" aria-hidden="true" />
                    <div>
                      <h3 className="font-heading text-xl font-semibold text-white">{item.title}</h3>
                      <p className="mt-1 text-white/[0.64]">{item.description}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="relative min-h-[360px]">
                <img
                  src={growStationery}
                  alt="Aplicacao da identidade Grow em materiais institucionais"
                  width={980}
                  height={604}
                  loading="lazy"
                  className="absolute right-0 top-4 h-72 w-[80%] rounded-2xl border border-white/[0.18] object-cover shadow-2xl"
                />
                <div className="absolute bottom-8 left-4 rounded-2xl bg-primary px-10 py-5 text-center font-heading text-xl font-bold text-white shadow-xl">
                  12+ anos<br />de solidez
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grow-dark-section">
          <div className="container">
            <motion.div {...fadeIn} className="mx-auto mb-12 max-w-3xl text-center">
              <h2 className="font-heading text-3xl font-bold text-white sm:text-4xl">Nosso processo simplificado</h2>
              <p className="mt-4 text-white/[0.68]">Uma entrada consultiva, objetiva e sem semanas de confusao operacional.</p>
            </motion.div>
            <div className="grid gap-7 md:grid-cols-4">
              {journey.map((item, index) => (
                <div key={item.title} className="relative text-center">
                  <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-primary to-grow-gold text-3xl font-bold text-white shadow-[0_0_50px_rgba(80,81,111,0.35)]">
                    {index + 1}
                  </div>
                  <item.icon className="mx-auto mt-5 h-5 w-5 text-grow-gold" aria-hidden="true" />
                  <h3 className="mt-3 font-heading text-xl font-semibold text-white">{item.title}</h3>
                  <p className="mx-auto mt-2 max-w-[15rem] text-sm text-white/[0.62]">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="grow-dark-section">
          <div className="container">
            <motion.div {...fadeIn} className="mx-auto mb-10 max-w-3xl text-center">
              <h2 className="font-heading text-3xl font-bold text-white sm:text-4xl">Planos transparentes para cada fase</h2>
              <p className="mt-4 text-white/[0.68]">A proposta e desenhada conforme o tamanho, rotina e necessidade da empresa.</p>
            </motion.div>
            <div className="grid gap-6 lg:grid-cols-3">
              {plans.map((plan) => (
                <article key={plan.title} className="institutional-card flex flex-col p-7">
                  <div className="mx-auto mb-5 flex h-10 w-10 items-center justify-center rounded-full border border-grow-gold/60 text-grow-gold">
                    <Briefcase className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <h3 className="text-center font-heading text-xl font-semibold text-white">{plan.title}</h3>
                  <p className="mt-3 text-center font-heading text-4xl font-bold text-white">{plan.price}</p>
                  <p className="mx-auto mt-3 max-w-xs text-center text-sm text-white/[0.64]">{plan.description}</p>
                  <ul className="mt-8 flex-1 space-y-4 text-sm text-white/[0.74]">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-center gap-3">
                        <CheckCircle2 className="h-4 w-4 text-grow-gold" aria-hidden="true" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <Button asChild className="mt-8 rounded-full bg-gradient-to-r from-primary to-grow-gold text-white">
                    <Link to="/#contato">Solicitar avaliacao</Link>
                  </Button>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="clientes" className="grow-dark-section">
          <div className="container">
            <motion.div {...fadeIn} className="mx-auto mb-10 max-w-3xl text-center">
              <h2 className="font-heading text-3xl font-bold text-white sm:text-4xl">Confiada por empresas em crescimento</h2>
            </motion.div>
            <div className="grid gap-6 lg:grid-cols-3">
              {testimonials.map((testimonial) => (
                <article key={testimonial.name} className="institutional-card p-6">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-primary font-bold">
                      {testimonial.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-heading font-semibold text-white">{testimonial.name}</p>
                      <p className="text-xs text-white/[0.54]">{testimonial.role}</p>
                    </div>
                  </div>
                  <p className="mt-5 text-sm leading-relaxed text-white/70">"{testimonial.text}"</p>
                  <div className="mt-4 flex gap-1 text-grow-gold">
                    {Array.from({ length: 5 }).map((_, index) => (
                      <Star key={index} className="h-4 w-4 fill-current" aria-hidden="true" />
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="grow-dark-section">
          <div className="container">
            <motion.div {...fadeIn} className="mx-auto mb-10 max-w-3xl text-center">
              <h2 className="font-heading text-3xl font-bold text-white sm:text-4xl">Insights financeiros</h2>
              <p className="mt-4 text-white/[0.68]">Conteudo pratico para empresarios que querem decidir melhor.</p>
            </motion.div>
            <div className="grid gap-6 lg:grid-cols-3">
              {insights.map((insight) => (
                <article key={insight.title} className="institutional-card overflow-hidden">
                  <div className="h-44 bg-cover bg-center" style={{ backgroundImage: `url(${growStationery})` }} />
                  <div className="p-5">
                    <p className="text-xs text-white/[0.54]">{insight.date}</p>
                    <h3 className="mt-3 font-heading text-xl font-semibold text-white">{insight.title}</h3>
                    <Link to="/newsletter" className="mt-5 inline-flex text-sm font-semibold text-grow-gold hover:text-white">
                      Ler artigo
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="contato" className="grow-gradient-cta py-20 md:py-28">
          <div className="container grid gap-10 lg:grid-cols-[1fr_0.9fr] lg:items-center">
            <motion.div {...fadeIn} className="text-center lg:text-left">
              <img
                src={growLockupHorizontalDark}
                alt="Grow Contabilidade"
                width={220}
                height={70}
                className="mx-auto mb-8 h-14 w-auto rounded-2xl object-cover lg:mx-0"
              />
              <h2 className="font-heading text-4xl font-bold leading-tight text-white sm:text-5xl">
                Vamos simplificar sua contabilidade?
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-white/[0.72] lg:mx-0">
                Agende uma avaliacao gratuita e veja como a Grow pode organizar sua rotina com clareza e estrategia.
              </p>
              <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row lg:justify-start">
                <Button asChild size="lg" className="rounded-full bg-white px-9 text-primary hover:bg-white/90">
                  <Link to="/contato">Falar com especialista</Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="rounded-full border-white/[0.24] bg-transparent px-9 text-white hover:bg-white/10 hover:text-white">
                  <Link to="/solucoes">Conhecer servicos</Link>
                </Button>
              </div>
            </motion.div>

            <motion.div {...fadeIn} transition={{ duration: 0.45, delay: 0.1 }}>
              <SiteLeadForm
                formId="home-lead"
                originPage="home"
                submitLabel="Solicitar avaliacao gratuita"
                successMessage="Solicitacao enviada com sucesso. Nossa equipe entrara em contato em breve."
                className="institutional-card space-y-4 p-6"
                intro={<p className="text-sm text-white/[0.64]">Preencha os dados para nossa equipe entrar em contato.</p>}
              />
            </motion.div>
          </div>
        </section>
      </div>
    </SiteLayout>
  );
}
