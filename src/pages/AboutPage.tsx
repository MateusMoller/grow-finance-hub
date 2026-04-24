import { SiteLayout } from "@/components/site/SiteLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Link } from "react-router-dom";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { ArrowRight, Award, BarChart3, Briefcase, Building2, CheckCircle2, Clock, Eye, FileText, Heart, Shield, Target, TrendingUp, Users } from "lucide-react";
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
  { icon: BarChart3, title: "Contabilidade consultiva", description: "Fechamentos, balanços e indicadores com orientação para decisões gerenciais." },
  { icon: Shield, title: "Assessoria fiscal", description: "Planejamento tributário e revisões periódicas para reduzir risco fiscal." },
  { icon: Users, title: "Departamento pessoal", description: "Rotinas trabalhistas, folha, admissões e suporte contínuo ao RH." },
  { icon: Building2, title: "Abertura e regularização", description: "Constituição de empresa, alterações contratuais e regularizações completas." },
  { icon: Briefcase, title: "Suporte ao empresário", description: "Consultoria para planejamento, estrutura financeira e crescimento sustentável." },
  { icon: FileText, title: "Relatórios gerenciais", description: "Painel mensal com leitura executiva para acompanhamento de performance." },
];

const differentials = [
  "Atendimento por especialistas com agenda de acompanhamento.",
  "Rotina de prevencao de riscos fiscais e trabalhistas.",
  "Indicadores objetivos para apoiar decisão do empresário.",
  "Comunicação clara, prazos definidos e processos rastreaveis.",
];

const journey = [
  { icon: CheckCircle2, title: "Diagnóstico inicial", description: "Mapeamento das prioridades contábeis, fiscais e financeiras." },
  { icon: Clock, title: "Plano de 90 dias", description: "Roadmap com entregas, prazos e responsabilidades definidas." },
  { icon: TrendingUp, title: "Evolução mensal", description: "Monitoramento de indicadores e ajustes contínuos na operação." },
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

const fadeIn = {
  initial: { opacity: 0, y: 18 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.15 },
  transition: { duration: 0.45 },
};

export default function AboutPage() {
  const [sending, setSending] = useState(false);
  const [flippedValues, setFlippedValues] = useState<Record<string, boolean>>({});
  const [leadForm, setLeadForm] = useState({
    fullName: "",
    companyName: "",
    email: "",
  });
  const illustrationPointerX = useMotionValue(0);
  const illustrationPointerY = useMotionValue(0);
  const smoothPointerX = useSpring(illustrationPointerX, { stiffness: 120, damping: 22, mass: 0.7 });
  const smoothPointerY = useSpring(illustrationPointerY, { stiffness: 120, damping: 22, mass: 0.7 });
  const sculptureX = useTransform(smoothPointerX, [-40, 40], [-18, 18]);
  const sculptureY = useTransform(smoothPointerY, [-40, 40], [-14, 14]);
  const haloX = useTransform(smoothPointerX, [-40, 40], [-28, 28]);
  const haloY = useTransform(smoothPointerY, [-40, 40], [-18, 18]);
  const illustrationRotate = useTransform(smoothPointerX, [-40, 40], [-8, 8]);
  const ribbonShift = useTransform(smoothPointerX, [-40, 40], [-12, 12]);
  const ribbonLift = useTransform(smoothPointerY, [-40, 40], [-10, 10]);

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

  const handleIllustrationMove = (event: React.MouseEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const offsetX = ((event.clientX - bounds.left) / bounds.width - 0.5) * 80;
    const offsetY = ((event.clientY - bounds.top) / bounds.height - 0.5) * 80;

    illustrationPointerX.set(offsetX);
    illustrationPointerY.set(offsetY);
  };

  const handleIllustrationLeave = () => {
    illustrationPointerX.set(0);
    illustrationPointerY.set(0);
  };

  const toggleValueCard = (cardId: string) => {
    setFlippedValues((current) => ({
      ...current,
      [cardId]: !current[cardId],
    }));
  };

  return (
    <SiteLayout>
      <div className="bg-[#f3f3f6] text-foreground transition-colors dark:bg-[#051334]">
        <section id="institucional" className="border-b border-border/60 py-10 dark:border-[#243054] sm:py-12 md:py-16">
          <div className="container grid gap-10 lg:grid-cols-[1.08fr_0.92fr] lg:items-start">
            <motion.div {...fadeIn} className="relative space-y-7 pt-2">
              <div className="pointer-events-none absolute -left-8 top-10 hidden h-32 w-32 rounded-full border border-primary/15 lg:block" />
              <div className="pointer-events-none absolute left-16 top-28 hidden h-px w-24 rotate-[28deg] bg-gradient-to-r from-transparent via-primary/40 to-transparent lg:block" />

              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <span className="inline-flex w-fit items-center rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-primary">
                  Grow Contabilidade
                </span>
                <div className="max-w-[220px] border-l border-primary/20 pl-4 text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                  operação, visão e direção em uma estrutura menos previsível
                </div>
              </div>

              <div className="space-y-4">
                <div className="overflow-hidden">
                  <p className="text-[13px] font-semibold uppercase tracking-[0.28em] text-primary/70">Institucional</p>
                </div>
                <h1 className="max-w-4xl font-heading text-[2.9rem] font-black leading-[0.94] tracking-[-0.06em] sm:text-[4.3rem] lg:text-[5.5rem]">
                  <span className="block">CONTABILIDADE</span>
                  <span className="block pl-[0.08em] text-primary">QUE PUXA</span>
                  <span className="block sm:pl-[0.35em]">SEU NEGÓCIO</span>
                  <span className="block text-[0.42em] font-semibold uppercase tracking-[0.24em] text-muted-foreground sm:pl-[1.6em]">
                    onde a rotina ganha asas
                  </span>
                </h1>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <Button
                  asChild
                  className="group h-12 w-full rounded-full border border-white/35 px-6 font-semibold sm:w-auto dark:bg-[#7a62ef] dark:text-white dark:hover:bg-[#8a73f4]"
                >
                  <Link to="/contato">
                    Falar com especialista
                    <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
                  </Link>
                </Button>
                <Button asChild variant="outline" className="group h-12 w-full rounded-full px-6 sm:w-auto">
                  <Link to="/login">
                    Acessar login
                    <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
                  </Link>
                </Button>
              </div>
            </motion.div>

            <motion.aside
              {...fadeIn}
              transition={{ duration: 0.45, delay: 0.1 }}
              onMouseMove={handleIllustrationMove}
              onMouseLeave={handleIllustrationLeave}
              className="relative min-h-[460px] overflow-hidden rounded-[38px] px-2 py-3 lg:mt-6"
            >
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_18%,rgba(82,98,140,0.18),transparent_26%),radial-gradient(circle_at_76%_24%,rgba(82,98,140,0.12),transparent_22%),radial-gradient(circle_at_52%_58%,rgba(82,98,140,0.12),transparent_34%)]" />
              <div className="pointer-events-none absolute left-5 top-4 text-[88px] font-black leading-none tracking-[-0.08em] text-primary/7 dark:text-white/5 md:text-[118px]">
                GROW
              </div>
              <div className="pointer-events-none absolute bottom-1 right-2 text-[64px] font-black leading-none tracking-[-0.06em] text-primary/7 dark:text-white/5 md:text-[88px]">
                Finance
              </div>

              <motion.div
                style={{ x: haloX, y: haloY }}
                className="pointer-events-none absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/12 blur-3xl"
              />

              <motion.div
                style={{ x: sculptureX, y: sculptureY, rotate: illustrationRotate }}
                className="absolute inset-0"
              >
                <motion.div
                  animate={{ rotate: [-14, -8, -14], scale: [1, 1.04, 1] }}
                  transition={{ duration: 8.5, repeat: Infinity, ease: "easeInOut" }}
                  className="absolute left-[18%] top-[16%] h-[280px] w-[190px] rounded-[44%_56%_52%_48%/40%_38%_62%_60%] border border-primary/18 bg-gradient-to-br from-primary/16 via-background/20 to-transparent shadow-[0_28px_70px_-36px_rgba(37,47,81,0.35)] backdrop-blur-[6px]"
                />
                <motion.div
                  animate={{ rotate: [22, 16, 22], scaleY: [1, 1.08, 1] }}
                  transition={{ duration: 7.8, repeat: Infinity, ease: "easeInOut" }}
                  className="absolute left-[34%] top-[20%] h-[245px] w-[160px] border border-primary/22 bg-gradient-to-b from-primary/20 via-background/10 to-transparent [clip-path:polygon(50%_0%,100%_34%,78%_100%,14%_84%,0%_28%)]"
                />
                <motion.div
                  animate={{ rotate: [-28, -18, -28], scale: [1, 1.05, 1] }}
                  transition={{ duration: 6.9, repeat: Infinity, ease: "easeInOut" }}
                  className="absolute left-[49%] top-[44%] h-[150px] w-[122px] rounded-[42%_58%_60%_40%/46%_36%_64%_54%] bg-primary/20 blur-[2px]"
                />
                <motion.div
                  animate={{ y: [0, -18, 0], x: [0, 10, 0] }}
                  transition={{ duration: 5.6, repeat: Infinity, ease: "easeInOut" }}
                  className="absolute left-[12%] top-[68%] h-24 w-24 rounded-full border border-primary/20 bg-gradient-to-br from-background/60 to-primary/10 backdrop-blur"
                />
                <motion.div
                  animate={{ y: [0, 14, 0], x: [0, -8, 0] }}
                  transition={{ duration: 6.1, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
                  className="absolute right-[13%] top-[18%] h-16 w-16 rounded-full bg-primary/18 blur-sm"
                />
              </motion.div>

              <motion.svg
                style={{ x: ribbonShift, y: ribbonLift }}
                viewBox="0 0 420 420"
                className="pointer-events-none absolute inset-0 h-full w-full"
              >
                <motion.path
                  d="M28 156 C 88 94, 170 86, 256 132 S 382 186, 392 108"
                  stroke="hsl(var(--primary) / 0.42)"
                  strokeWidth="1.5"
                  fill="none"
                  strokeLinecap="round"
                  strokeDasharray="5 10"
                  animate={{ pathLength: [0.82, 1, 0.82], opacity: [0.35, 0.9, 0.35] }}
                  transition={{ duration: 5.2, repeat: Infinity, ease: "easeInOut" }}
                />
                <motion.path
                  d="M54 300 C 144 250, 202 212, 254 240 S 350 310, 396 250"
                  stroke="hsl(var(--primary) / 0.28)"
                  strokeWidth="1.5"
                  fill="none"
                  strokeLinecap="round"
                  animate={{ pathLength: [0.7, 1, 0.7], opacity: [0.18, 0.65, 0.18] }}
                  transition={{ duration: 6.4, repeat: Infinity, ease: "easeInOut", delay: 0.4 }}
                />
                <motion.path
                  d="M108 58 C 188 118, 246 184, 206 338"
                  stroke="hsl(var(--foreground) / 0.12)"
                  strokeWidth="1"
                  fill="none"
                  strokeLinecap="round"
                  animate={{ opacity: [0.16, 0.4, 0.16] }}
                  transition={{ duration: 4.8, repeat: Infinity, ease: "easeInOut" }}
                />
                <motion.circle
                  cx="392"
                  cy="108"
                  r="6"
                  fill="hsl(var(--primary))"
                  animate={{ cx: [392, 368, 392], cy: [108, 126, 108] }}
                  transition={{ duration: 5.4, repeat: Infinity, ease: "easeInOut" }}
                />
                <motion.circle
                  cx="54"
                  cy="300"
                  r="5"
                  fill="hsl(var(--primary) / 0.7)"
                  animate={{ cx: [54, 72, 54], cy: [300, 286, 300] }}
                  transition={{ duration: 4.9, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
                />
              </motion.svg>

              <motion.div
                animate={{ x: [0, 8, 0], opacity: [0.5, 0.9, 0.5] }}
                transition={{ duration: 5.2, repeat: Infinity, ease: "easeInOut" }}
                className="pointer-events-none absolute left-10 top-10 text-[11px] font-semibold uppercase tracking-[0.28em] text-primary/70"
              >
                fluxo
              </motion.div>
              <motion.div
                animate={{ x: [0, -10, 0], opacity: [0.4, 0.82, 0.4] }}
                transition={{ duration: 6.1, repeat: Infinity, ease: "easeInOut", delay: 0.4 }}
                className="pointer-events-none absolute right-10 top-24 text-[11px] font-semibold uppercase tracking-[0.28em] text-muted-foreground"
              >
                clareza
              </motion.div>
              <motion.div
                animate={{ x: [0, 12, 0], opacity: [0.4, 0.78, 0.4] }}
                transition={{ duration: 5.7, repeat: Infinity, ease: "easeInOut", delay: 0.2 }}
                className="pointer-events-none absolute bottom-20 left-12 text-[11px] font-semibold uppercase tracking-[0.28em] text-muted-foreground"
              >
                presença
              </motion.div>
              <motion.div
                animate={{ x: [0, -8, 0], opacity: [0.45, 0.8, 0.45] }}
                transition={{ duration: 6.3, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
                className="pointer-events-none absolute bottom-14 right-10 text-[11px] font-semibold uppercase tracking-[0.28em] text-primary/70"
              >
                decisão
              </motion.div>
            </motion.aside>
          </div>

        </section>

        <section className="py-12 md:py-16">
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
                          <span className="mt-6 block text-[11px] font-semibold uppercase tracking-[0.24em] text-primary/75">
                            Grow
                          </span>
                          <span className="mt-3 block font-heading text-2xl font-semibold leading-tight text-foreground">
                            {value.title}
                          </span>
                          <span className="mt-4 block max-w-[240px] text-base leading-7 text-muted-foreground">
                            {value.impact}
                          </span>
                          <span className="mt-6 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary/70">
                            <span className="h-px flex-1 bg-primary/20" />
                            Clique para virar
                          </span>
                        </span>

                        <span className="flip-card-face flip-card-back rounded-[28px] border border-border bg-card p-6 shadow-sm dark:border-[#223058] dark:bg-[#0a1734]">
                          <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary/75">
                            Resumo
                          </span>
                          <span className="mt-4 block font-heading text-2xl font-semibold leading-tight text-foreground">
                            {value.title}
                          </span>
                          <span className="mt-5 block text-sm leading-7 text-muted-foreground">
                            {value.summary}
                          </span>
                          <span className="mt-6 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary/70">
                            <span className="h-px flex-1 bg-primary/20" />
                            Clique para voltar
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

        <section id="serviços" className="py-12 md:py-16">
          <div className="container">
            <motion.div {...fadeIn} className="mb-6">
              <h2 className="font-heading text-2xl font-semibold sm:text-3xl">Nossos serviços</h2>
            </motion.div>

            <div className="hide-scrollbar mx-[-1rem] flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:gap-4 md:overflow-visible md:px-0 md:pb-0 md:snap-none md:grid-cols-2 xl:grid-cols-3">
              {services.map((service, index) => (
                <motion.article
                  key={service.title}
                  initial={{ opacity: 0, y: 14 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={{ duration: 0.35, delay: index * 0.04 }}
                  className="hover-lift-soft surface-sheen group min-w-[84%] snap-start rounded-2xl border border-border bg-card p-5 sm:min-w-[72%] md:min-w-0 dark:border-[#223058] dark:bg-[#0a1734]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10">
                      <service.icon className="h-5 w-5 text-primary" />
                    </div>
                    <span className="rounded-full border border-primary/15 bg-primary/5 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-primary/80 transition-transform duration-200 group-hover:-translate-y-0.5">
                      Grow
                    </span>
                  </div>
                  <h3 className="mt-3 font-heading text-base font-semibold">{service.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{service.description}</p>
                  <div className="mt-4 flex items-center gap-2 text-sm font-medium text-primary">
                    <span>Saiba mais</span>
                    <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
                  </div>
                </motion.article>
              ))}
            </div>
          </div>
        </section>

        <section id="diferenciais" className="py-12 md:py-16">
          <div className="container grid gap-6 lg:grid-cols-[1fr_1fr]">
            <motion.article {...fadeIn} className="rounded-2xl border border-border bg-card p-6 dark:border-[#223058] dark:bg-[#0a1734]">
              <h2 className="font-heading text-2xl font-semibold">Diferenciais Grow</h2>
              <div className="mt-4 space-y-3">
                {differentials.map((item) => (
                  <div key={item} className="flex items-start gap-2 text-sm">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary" />
                    <span className="text-foreground">{item}</span>
                  </div>
                ))}
              </div>
            </motion.article>

            <motion.article
              {...fadeIn}
              transition={{ duration: 0.45, delay: 0.1 }}
              className="rounded-2xl border border-border bg-card p-6 dark:border-[#223058] dark:bg-[#0a1734]"
            >
              <h2 className="font-heading text-2xl font-semibold">Como trabalhamos</h2>
              <div className="mt-4 space-y-3">
                {journey.map((step) => (
                  <div key={step.title} className="rounded-lg border border-border/70 bg-muted/20 p-3 dark:border-[#2a3760] dark:bg-[#0d1a38]">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <step.icon className="h-4 w-4 text-primary" />
                      <span>{step.title}</span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{step.description}</p>
                  </div>
                ))}
              </div>
            </motion.article>
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

        <section className="py-12 md:py-16">
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
