import { SiteLayout } from "@/components/site/SiteLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Award, BarChart3, Briefcase, Building2, CheckCircle2, Eye, FileText, Heart, Shield, Target, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { captureSiteLead } from "@/lib/siteLeadCapture";

const values = [
  {
    icon: Target,
    title: "Foco em resultados",
    impact: "Cada número precisa empurrar o negócio para frente.",
    summary: "Organizamos prioridades e entregas para que a contabilidade ajude a crescer com mais eficiência e menos dispersão.",
  },
  {
    icon: Eye,
    title: "Visão estratégica",
    impact: "Dados deixam de ser arquivo e viram direção.",
    summary: "Traduzimos informações em leitura prática para decisões de curto e longo prazo com mais segurança.",
  },
  {
    icon: Heart,
    title: "Atendimento humano",
    impact: "A empresa é atendida como contexto, não como protocolo.",
    summary: "Acompanhamos de perto a realidade do cliente para responder com clareza, proximidade e rapidez.",
  },
  {
    icon: Award,
    title: "Excelência técnica",
    impact: "Método forte para sustentar confiança no dia a dia.",
    summary: "Equipe especializada, processo padronizado e revisão constante para manter consistência e confiabilidade.",
  },
] as const;

const services = [
  {
    icon: BarChart3,
    title: "Contabilidade consultiva",
    description: "Fechamentos, balanços e indicadores com orientação para decisões gerenciais.",
    teaser: "Números deixam de ser histórico e passam a orientar próximos movimentos.",
    detail:
      "Fechamos, lemos e traduzimos os dados da operação para que margem, caixa e evolução do negócio fiquem mais claros para o empresário.",
    visualAccent: "Visão de margem",
    visualCaption: "Leitura estratégica dos indicadores que puxam resultado.",
  },
  {
    icon: Shield,
    title: "Assessoria fiscal",
    description: "Planejamento tributário e revisões periódicas para reduzir risco fiscal.",
    teaser: "Mais controle tributário para a empresa crescer sem sustos evitáveis.",
    detail:
      "Revisamos enquadramento, rotinas e obrigações para reduzir exposição fiscal e manter a operação com mais segurança e previsibilidade.",
    visualAccent: "Risco sob controle",
    visualCaption: "Camadas de revisão para proteger decisão e operação.",
  },
  {
    icon: Users,
    title: "Departamento pessoal",
    description: "Rotinas trabalhistas, folha, admissões e suporte contínuo ao RH.",
    teaser: "A rotina de pessoas fica organizada antes de virar urgência.",
    detail:
      "Estruturamos folha, admissões, desligamentos e suporte ao RH com leitura prática para que o time opere com menos ruído trabalhista.",
    visualAccent: "Ritmo do time",
    visualCaption: "Fluxos trabalhistas com mais cadência e menos improviso.",
  },
  {
    icon: Building2,
    title: "Abertura e regularização",
    description: "Constituição de empresa, alterações contratuais e regularizações completas.",
    teaser: "A empresa nasce ou se ajusta com rota jurídica e fiscal mais limpa.",
    detail:
      "Cuidamos da formalização, das alterações contratuais e das regularizações para evitar travas burocráticas no crescimento da empresa.",
    visualAccent: "Estrutura pronta",
    visualCaption: "Mapeamento documental para colocar a operação em ordem.",
  },
  {
    icon: Briefcase,
    title: "Suporte ao empresário",
    description: "Consultoria para planejamento, estrutura financeira e crescimento sustentável.",
    teaser: "O empresário ganha apoio para decidir com mais repertório e clareza.",
    detail:
      "Acompanhamos decisões relevantes com leitura financeira, contábil e operacional para sustentar crescimento sem perder direção.",
    visualAccent: "Decisão assistida",
    visualCaption: "Mais clareza executiva para cada próximo passo do negócio.",
  },
  {
    icon: FileText,
    title: "Relatórios gerenciais",
    description: "Painel mensal com leitura executiva para acompanhamento de performance.",
    teaser: "Relatórios deixam de ser arquivo e passam a virar conversa de gestão.",
    detail:
      "Entregamos leituras mensais objetivas para acompanhar desempenho, corrigir rota e manter o negócio perto das metas mais importantes.",
    visualAccent: "Painel mensal",
    visualCaption: "Resumo executivo para acompanhar evolução sem operar no escuro.",
  },
];

const testimonials = [
  {
    name: "Lucas Moreira",
    role: "CEO, TechNova",
    text: "Com a Grow, nossa gestão financeira ficou clara. Hoje decidimos com base em relatórios consistentes.",
  },
  {
    name: "Mariana Ribeiro",
    role: "Fundadora, Casa Verde",
    text: "Atendimento muito próximo e prático. Conseguimos regularizar pendências e organizar o crescimento.",
  },
  {
    name: "Rafael Alves",
    role: "Diretor Financeiro, BlueLine",
    text: "A consultoria estratégica da Grow virou parte da nossa rotina de tomada de decisão.",
  },
];

const faqItems = [
  {
    question: "Como funciona o início da parceria com a Grow?",
    answer: "Iniciamos com um diagnóstico completo da operação, definimos prioridades e montamos um plano de ação com entregas e prazos claros.",
  },
  {
    question: "A Grow atende apenas empresas de um segmento específico?",
    answer: "Não. Atendemos comércio, serviços, tecnologia, saúde, construção, profissionais liberais e outras estruturas empresariais.",
  },
  {
    question: "Com que frequência recebo relatórios e orientações?",
    answer: "Acompanhamento mensal com relatórios gerenciais, além de suporte contínuo para demandas pontuais do dia a dia.",
  },
  {
    question: "Posso contratar apenas parte dos serviços?",
    answer: "Sim. Montamos uma jornada sob medida, com escopo modular para sua fase atual de crescimento.",
  },
];

const discoveryRail = [
  {
    icon: Target,
    title: "Quem somos",
    description: "Veja a lógica de trabalho da Grow.",
    to: "/#quem-somos",
  },
  {
    icon: BarChart3,
    title: "Serviços",
    description: "Entenda onde entramos na operação.",
    to: "/#servicos",
  },
  {
    icon: Users,
    title: "Clientes",
    description: "Leia sinais de confiança e recorrência.",
    to: "/#clientes",
  },
  {
    icon: CheckCircle2,
    title: "FAQ",
    description: "Tire dúvidas antes de falar com a equipe.",
    to: "/#faq",
  },
] as const;

const fadeIn = {
  initial: { opacity: 0, y: 18 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.15 },
  transition: { duration: 0.45 },
};

export default function AboutPage() {
  const [sending, setSending] = useState(false);
  const [flippedValues, setFlippedValues] = useState<Record<string, boolean>>({});
  const [activeServiceTitle, setActiveServiceTitle] = useState<string | null>(null);
  const [leadForm, setLeadForm] = useState({
    fullName: "",
    companyName: "",
    email: "",
  });

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const fullName = leadForm.fullName.trim();
    const email = leadForm.email.trim();

    if (!fullName || !email) {
      toast.error("Preencha nome e e-mail para contínuar.");
      return;
    }

    setSending(true);

    const { error } = await captureSiteLead({
      fullName,
      companyName: leadForm.companyName.trim(),
      email,
      originPage: "about",
    });

    setSending(false);

    if (error) {
      toast.error(`Não foi possível enviar sua solicitação: ${error.message}`);
      return;
    }

    setLeadForm({
      fullName: "",
      companyName: "",
      email: "",
    });
    toast.success("Recebemos sua solicitação. Vamos retornar em breve.");
  };

  const toggleValueCard = (cardId: string) => {
    setFlippedValues((current) => ({
      ...current,
      [cardId]: !current[cardId],
    }));
  };

  const activeService = services.find((service) => service.title === activeServiceTitle) ?? null;

  const toggleServicePanel = (serviceTitle: string) => {
    setActiveServiceTitle((current) => (current === serviceTitle ? null : serviceTitle));
  };

  return (
    <SiteLayout headerOverlay>
      <div className="bg-[#f3f3f6] text-foreground transition-colors dark:bg-[#051334]">
        <section
          id="institucional"
          className="hero-impact-surface relative isolate flex min-h-[100svh] items-stretch overflow-hidden border-b border-border/50 dark:border-[#243054]"
        >
          <div className="pointer-events-none absolute inset-0">
            <div className="hero-impact-grid absolute inset-0 opacity-45" />
            <div className="hero-impact-orb hero-impact-orb-a" />
            <div className="hero-impact-orb hero-impact-orb-b" />
            <div className="hero-impact-orb hero-impact-orb-c" />
            <div className="hero-impact-line hero-impact-line-a" />
            <div className="hero-impact-line hero-impact-line-b" />
          </div>

          <div className="container relative flex min-h-[100svh] flex-col justify-center py-16 pb-14 pt-28 sm:pt-32 lg:py-20 lg:pt-28">
            <motion.div {...fadeIn} className="relative max-w-6xl space-y-8">
              <div className="flex justify-end">
                <div className="hero-impact-note max-w-[280px] pl-4 text-[11px] font-medium uppercase tracking-[0.26em] text-foreground/60">
                  operação, visão e direção com uma presença mais marcante logo na primeira dobra
                </div>
              </div>

              <div className="max-w-5xl">
                <div className="space-y-6">
                  <h1 className="max-w-5xl font-heading text-[2.95rem] font-black leading-[0.9] tracking-[-0.075em] text-[#1e2237] sm:text-[4.4rem] lg:text-[6.2rem] xl:text-[7.1rem]">
                    <span className="block">CONTABILIDADE</span>
                    <span className="hero-impact-emphasis block pl-[0.04em]">QUE PUXA</span>
                    <span className="block sm:pl-[0.25em]">SEU NEGÓCIO</span>
                    <span className="block pt-2 text-[0.25em] font-semibold uppercase tracking-[0.3em] text-[#5e658a] sm:pl-[1.8em]">
                      onde a rotina ganha asas
                    </span>
                  </h1>
                </div>
              </div>

              <div className="pt-3">
                <div className="mb-4 flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-[#555d84]">
                  <span className="hero-discovery-dot" />
                  Continue explorando
                </div>
                <div className="hero-discovery-layer relative">
                  <div className="hero-discovery-cta-wrap mb-5 flex justify-start xl:absolute xl:right-0 xl:top-[-26px] xl:mb-0">
                    <Button
                      asChild
                      className="hero-impact-cta group h-[52px] w-full rounded-full border-0 px-7 font-semibold text-white sm:w-auto"
                    >
                      <Link to="/contato">
                        Falar com especialista
                        <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
                      </Link>
                    </Button>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {discoveryRail.map((item, index) => (
                      <motion.div
                        key={item.title}
                        initial={{ opacity: 0, y: 12 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, amount: 0.3 }}
                        transition={{ duration: 0.35, delay: 0.06 + index * 0.04 }}
                      >
                        <Link
                          to={item.to}
                          className="hero-discovery-card hover-lift-soft surface-sheen flex h-full items-start gap-3 rounded-[24px] p-4"
                        >
                          <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/55 text-primary shadow-[0_12px_24px_-18px_rgba(29,36,66,0.45)]">
                            <item.icon className="h-4.5 w-4.5" />
                          </span>
                          <span className="block min-w-0">
                            <span className="flex items-center gap-2 font-heading text-[1rem] font-semibold leading-tight text-[#232844]">
                              {item.title}
                              <ArrowRight className="h-3.5 w-3.5 text-[#58608b]" />
                            </span>
                            <span className="mt-1.5 block text-sm leading-6 text-[#4d5478]">
                              {item.description}
                            </span>
                          </span>
                      </Link>
                    </motion.div>
                  ))}
                </div>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        <section id="quem-somos" className="py-12 md:py-16">
          <div className="container">
            <motion.div {...fadeIn} className="mb-6">
              <h2 className="font-heading text-2xl font-semibold sm:text-3xl">Quem somos</h2>
              <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
                Somos uma consultoria contabil com abordagem proativa. Atuamos lado a lado com o empresário para transformar
                dados em decisao e decisao em resultado.
              </p>
            </motion.div>

            <div className="carousel-shell carousel-fade-mask mt-8 overflow-hidden pb-2">
              <div className="carousel-track-right flex w-max gap-4">
                {[...values, ...values].map((value, index) => {
                  const cardId = `${value.title}-${index}`;

                  return (
                  <motion.div
                    key={cardId}
                    initial={{ opacity: 0, y: 14 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.2 }}
                    transition={{ duration: 0.35, delay: (index % values.length) * 0.05 }}
                    className="shrink-0"
                  >
                    <button
                      type="button"
                      onClick={() => toggleValueCard(cardId)}
                      aria-pressed={flippedValues[cardId] === true}
                      aria-label={`Virar card ${value.title}`}
                      className="flip-card-button block h-[270px] w-[280px] text-left sm:w-[320px]"
                      data-flipped={flippedValues[cardId] === true}
                    >
                      <span className="flip-card-inner block h-full w-full">
                        <span className="flip-card-face flip-card-front rounded-[28px] border border-border bg-card p-6 shadow-sm dark:border-[#223058] dark:bg-[#0a1734]">
                          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
                            <value.icon className="h-5 w-5 text-primary" />
                          </span>
                          <span className="mt-3 block font-heading text-2xl font-semibold leading-tight text-foreground">
                            {value.title}
                          </span>
                          <span className="mt-4 block max-w-[240px] text-base leading-7 text-muted-foreground">
                            {value.impact}
                          </span>
                        </span>

                        <span className="flip-card-face flip-card-back rounded-[28px] border border-border bg-card p-6 shadow-sm dark:border-[#223058] dark:bg-[#0a1734]">
                          <span className="mt-4 block font-heading text-2xl font-semibold leading-tight text-foreground">
                            {value.title}
                          </span>
                          <span className="mt-5 block text-sm leading-7 text-muted-foreground">
                            {value.summary}
                          </span>
                        </span>
                      </span>
                    </button>
                  </motion.div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        <section id="servicos" className="py-12 md:py-16">
          <div className="container">
            <motion.div {...fadeIn} className="mb-6">
              <h2 className="font-heading text-2xl font-semibold sm:text-3xl">Nossos serviços</h2>
            </motion.div>

            <div className="service-expand-shell relative">
              <div className="hide-scrollbar mx-[-1rem] flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-4 xl:mx-0 xl:grid xl:gap-5 xl:overflow-visible xl:px-0 xl:pb-0 xl:snap-none xl:grid-cols-3">
                {services.map((service, index) => {
                  const isActive = activeServiceTitle === service.title;

                  return (
                    <motion.button
                      key={service.title}
                      type="button"
                      initial={{ opacity: 0, y: 14 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true, amount: 0.2 }}
                      transition={{ duration: 0.35, delay: index * 0.04 }}
                      onClick={() => toggleServicePanel(service.title)}
                      aria-expanded={isActive}
                      className={[
                        "service-card-button hover-lift-soft surface-sheen group relative min-w-[84%] snap-start rounded-[28px] border border-border bg-card p-5 text-left shadow-sm transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 sm:min-w-[72%] xl:min-w-0",
                        isActive ? "border-primary/30 shadow-[0_28px_60px_-34px_rgba(34,48,88,0.32)]" : "dark:border-[#223058] dark:bg-[#0a1734]",
                        isActive ? "dark:border-[#7a62ef]/45 dark:bg-[#0a1734]" : "",
                      ].join(" ")}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10">
                          <service.icon className="h-5 w-5 text-primary" />
                        </div>
                      </div>
                      <h3 className="mt-3 font-heading text-base font-semibold">{service.title}</h3>
                      <p className="mt-2 text-sm text-muted-foreground">{service.description}</p>
                    </motion.button>
                  );
                })}
              </div>

              <AnimatePresence>
                {activeService && (
                  <motion.div
                    key={activeService.title}
                    initial={{ opacity: 0, y: 18, scale: 0.985 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 12, scale: 0.99 }}
                    transition={{ duration: 0.28, ease: "easeOut" }}
                    className="service-expanded-panel mt-5 xl:absolute xl:inset-0 xl:mt-0"
                  >
                    <div className="grid min-h-[unset] gap-6 rounded-[32px] border border-primary/20 bg-card p-6 shadow-[0_28px_70px_-34px_rgba(34,48,88,0.3)] dark:border-[#2b3861] dark:bg-[#08142f] xl:h-full xl:grid-cols-[minmax(0,1.2fr)_320px] xl:p-8">
                      <div className="flex flex-col justify-between">
                        <div>
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex items-start gap-4">
                              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[22px] bg-primary/10">
                                <activeService.icon className="h-6 w-6 text-primary" />
                              </div>
                              <div>
                                <h3 className="mt-2 font-heading text-[1.9rem] font-semibold leading-tight text-foreground">
                                  {activeService.title}
                                </h3>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => setActiveServiceTitle(null)}
                              className="rounded-full border border-primary/15 bg-primary/5 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-primary transition-colors hover:bg-primary/10"
                            >
                              Fechar
                            </button>
                          </div>

                          <p className="mt-6 max-w-2xl text-lg leading-8 text-foreground/88 dark:text-[#dfe6ff]">
                            {activeService.teaser}
                          </p>
                          <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground">
                            {activeService.detail}
                          </p>
                        </div>

                        <div className="mt-8 grid gap-3 sm:grid-cols-2">
                          <div className="rounded-[24px] border border-primary/14 bg-primary/5 p-4">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-primary/75">
                              Leitura central
                            </p>
                            <p className="mt-3 text-sm leading-7 text-muted-foreground">
                              {activeService.visualCaption}
                            </p>
                          </div>
                          <div className="rounded-[24px] border border-primary/14 bg-background/65 p-4 dark:bg-white/5">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-primary/75">
                              Aplicação prática
                            </p>
                            <p className="mt-3 text-sm leading-7 text-muted-foreground">
                              Atendimento construído para reduzir ruído operacional e dar mais clareza à decisão.
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="relative overflow-hidden rounded-[30px] border border-primary/18 bg-[linear-gradient(180deg,hsl(var(--background))_0%,hsl(var(--primary)/0.06)_100%)] p-5 dark:border-[#2b3861] dark:bg-[linear-gradient(180deg,rgba(10,23,52,0.98)_0%,rgba(122,98,239,0.14)_100%)]">
                        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_24%_20%,rgba(82,98,140,0.2),transparent_26%),radial-gradient(circle_at_72%_72%,rgba(82,98,140,0.16),transparent_34%)]" />
                        <div className="relative flex h-full min-h-[260px] flex-col justify-between">
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary/70">
                              Imagem genérica contextual
                            </p>
                            <p className="mt-2 max-w-[16rem] text-sm leading-6 text-muted-foreground">
                              {activeService.visualCaption}
                            </p>
                          </div>

                          <div className="relative mt-6 h-[210px] rounded-[28px] border border-primary/14 bg-white/70 p-4 shadow-[0_18px_50px_-28px_rgba(34,48,88,0.4)] dark:bg-white/5">
                            <div className="absolute left-4 top-4 rounded-full border border-primary/15 bg-primary/6 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-primary/80">
                              {activeService.visualAccent}
                            </div>
                            <div className="absolute -right-5 bottom-4 h-28 w-28 rounded-full bg-primary/15 blur-2xl" />
                            <div className="absolute left-6 top-16 h-[104px] w-[104px] rounded-[34px] border border-primary/14 bg-gradient-to-br from-primary/18 via-white/40 to-transparent dark:via-white/5" />
                            <div className="absolute right-6 top-14 flex h-[112px] w-[112px] items-center justify-center rounded-[36px] border border-primary/14 bg-background/85 shadow-sm dark:bg-[#0c1836]">
                              <activeService.icon className="h-12 w-12 text-primary" />
                            </div>
                            <div className="absolute bottom-6 left-6 right-6 space-y-2.5">
                              <div className="h-2.5 w-[76%] rounded-full bg-primary/16" />
                              <div className="h-2.5 w-[54%] rounded-full bg-primary/10" />
                              <div className="h-2.5 w-[68%] rounded-full bg-primary/12" />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </section>

        <section id="clientes" className="py-12 md:py-16">
          <div className="container">
            <motion.div {...fadeIn} className="mb-6">
              <h2 className="font-heading text-2xl font-semibold sm:text-3xl">Clientes e depoimentos</h2>
            </motion.div>

            <div className="hide-scrollbar mx-[-1rem] flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:gap-4 md:overflow-visible md:px-0 md:pb-0 md:snap-none md:grid-cols-3">
              {testimonials.map((testimonial, index) => (
                <motion.article
                  key={testimonial.name}
                  initial={{ opacity: 0, y: 14 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={{ duration: 0.35, delay: index * 0.05 }}
                  className="hover-lift-soft surface-sheen min-w-[84%] snap-start rounded-2xl border border-border bg-card p-5 sm:min-w-[72%] md:min-w-0 dark:border-[#223058] dark:bg-[#0a1734]"
                >
                  <div className="mb-4 flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-primary/40" />
                    <span className="h-2 w-2 rounded-full bg-primary/65" />
                    <span className="h-2 w-2 rounded-full bg-primary" />
                  </div>
                  <p className="text-sm text-muted-foreground">"{testimonial.text}"</p>
                  <div className="mt-4">
                    <p className="text-sm font-semibold">{testimonial.name}</p>
                    <p className="text-xs text-muted-foreground">{testimonial.role}</p>
                  </div>
                </motion.article>
              ))}
            </div>
          </div>
        </section>

        <section id="faq" className="py-12 md:py-16">
          <div className="container grid gap-6 lg:grid-cols-[1fr_1fr]">
            <motion.article {...fadeIn} className="rounded-2xl border border-border bg-card p-6 dark:border-[#223058] dark:bg-[#0a1734]">
              <h2 className="font-heading text-2xl font-semibold">Perguntas frequentes</h2>
              <Accordion type="single" collapsible className="mt-3">
                {faqItems.map((faq, index) => (
                  <AccordionItem key={faq.question} value={`faq-${index}`}>
                    <AccordionTrigger className="text-left text-sm">{faq.question}</AccordionTrigger>
                    <AccordionContent className="text-muted-foreground">{faq.answer}</AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </motion.article>

            <motion.article
              {...fadeIn}
              transition={{ duration: 0.45, delay: 0.1 }}
              className="rounded-2xl border border-border bg-card p-6 dark:border-[#223058] dark:bg-[#0a1734]"
            >
              <h2 className="font-heading text-2xl font-semibold">Por que escolher a Grow?</h2>
              <p className="mt-3 text-sm text-muted-foreground">
                Porque nossa proposta combina técnica, proximidade e inteligencia de gestão. Nao entregamos apenas obrigações,
                entregamos direcao para o seu negócio.
              </p>
              <div className="mt-4 space-y-2 text-sm">
                <p className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-primary" />Equipe dedicada por cliente</p>
                <p className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-primary" />Entrega mensal com leitura executiva</p>
                <p className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-primary" />Suporte contínuo para decisao</p>
              </div>
            </motion.article>
          </div>
        </section>

        <section id="contato" className="py-12 md:py-16">
          <div className="container">
            <div className="rounded-2xl bg-primary p-5 text-primary-foreground dark:border dark:border-[#2a3760] dark:bg-[#0d1938] dark:text-[#e9eeff] sm:p-6 md:p-10">
              <div className="grid gap-8 lg:grid-cols-[1fr_1.1fr] lg:items-center">
                <motion.div {...fadeIn}>
                  <h2 className="font-heading text-2xl font-semibold leading-tight sm:text-3xl">
                    Pronto para tornar sua gestão mais clara e estratégica?
                  </h2>
                  <p className="mt-3 max-w-xl text-sm text-primary-foreground/85 dark:text-[#bcc7ea]">
                    Fale com a Grow e receba um plano inicial para organizar processos, reduzir riscos e evoluir com previsibilidade.
                  </p>
                  <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                    <Button
                      asChild
                      className="w-full rounded-full border border-white/35 px-5 text-sm font-semibold sm:w-auto dark:bg-[#7a62ef] dark:text-white dark:hover:bg-[#8a73f4]"
                    >
                      <Link to="/contato">Solicitar avaliação gratuita</Link>
                    </Button>
                    <Button asChild variant="outline" className="w-full rounded-full border-white bg-white px-5 text-sm text-[#1f2a4d] hover:bg-white/90 hover:text-[#1f2a4d] sm:w-auto dark:border-white dark:bg-white dark:text-[#1f2a4d] dark:hover:bg-white/90 dark:hover:text-[#1f2a4d]">
                      <Link to="/contato">Falar com consultor</Link>
                    </Button>
                  </div>
                </motion.div>

                <motion.form
                  {...fadeIn}
                  transition={{ duration: 0.45, delay: 0.1 }}
                  onSubmit={handleSubmit}
                  className="rounded-2xl bg-white p-5 text-foreground dark:border dark:border-[#2b3861] dark:bg-[#08142f] dark:text-[#e9eeff]"
                >
                  <div className="space-y-3">
                    <Input
                      placeholder="Nome completo"
                      required
                      value={leadForm.fullName}
                      onChange={(event) => setLeadForm((prev) => ({ ...prev, fullName: event.target.value }))}
                      className="rounded-full dark:border-[#2a3760] dark:bg-[#0a1735]"
                    />
                    <Input
                      placeholder="Empresa"
                      value={leadForm.companyName}
                      onChange={(event) => setLeadForm((prev) => ({ ...prev, companyName: event.target.value }))}
                      className="rounded-full dark:border-[#2a3760] dark:bg-[#0a1735]"
                    />
                    <Input
                      type="email"
                      placeholder="E-mail"
                      required
                      value={leadForm.email}
                      onChange={(event) => setLeadForm((prev) => ({ ...prev, email: event.target.value }))}
                      className="rounded-full dark:border-[#2a3760] dark:bg-[#0a1735]"
                    />
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground dark:text-[#9ca8cf]">Garantimos confidencialidade e segurança dos seus dados.</p>
                  <Button type="submit" className="mt-4 w-full rounded-full dark:bg-[#7a62ef] dark:text-white dark:hover:bg-[#8a73f4]" disabled={sending}>
                    {sending ? "Enviando..." : "Enviar solicitação"}
                    {!sending && <ArrowRight className="h-4 w-4" />}
                  </Button>
                </motion.form>
              </div>
            </div>
          </div>
        </section>
      </div>
    </SiteLayout>
  );
}
