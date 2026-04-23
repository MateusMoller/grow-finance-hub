import { SiteLayout } from "@/components/site/SiteLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Award, BarChart3, Briefcase, Building2, CheckCircle2, Clock, Eye, FileText, Heart, Shield, Target, TrendingUp, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { captureSiteLead } from "@/lib/siteLeadCapture";

const metrics = [
  { value: "+12", label: "Anos de mercado", detail: "Experiência sólida em contabilidade consultiva" },
  { value: "98%", label: "Satisfação dos clientes", detail: "Relacionamentos duradouros e atendimento próximo" },
  { value: "120+", label: "Empresas atendidas", detail: "Operação ativa em vários segmentos" },
  { value: "100%", label: "Conformidade", detail: "Processos com foco em precisão e segurança" },
];

const values = [
  { icon: Target, title: "Foco em resultados", description: "Cada ação orientada por metas claras de crescimento e eficiência." },
  { icon: Eye, title: "Visão estratégica", description: "Transformamos dados em direção para decisões de curto e longo prazo." },
  { icon: Heart, title: "Atendimento humano", description: "Acompanhamento próximo para entender o contexto real de cada empresa." },
  { icon: Award, title: "Excelencia técnica", description: "Equipe especializada e processos padronizados com alta confiabilidade." },
];

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
                    para fora do operacional automático
                  </span>
                </h1>
              </div>

              <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
                <p className="max-w-xl text-base leading-8 text-muted-foreground">
                  A Grow organiza fiscal, contábil, financeiro e pessoas com uma leitura mais afiada do negócio.
                  Não é só suporte técnico. É estrutura para decidir, corrigir rota e crescer sem operar no escuro.
                </p>
                <motion.div
                  animate={{ y: [0, -8, 0], rotate: [-4, -1, -4] }}
                  transition={{ duration: 6.4, repeat: Infinity, ease: "easeInOut" }}
                  className="w-fit rounded-[28px] border border-primary/15 bg-primary/10 px-5 py-4 shadow-sm"
                >
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">Leitura Grow</p>
                  <p className="mt-2 max-w-[200px] text-sm font-medium leading-6 text-foreground">
                    Clareza operacional com presença consultiva e menos aparência de escritório tradicional.
                  </p>
                </motion.div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <Button
                  asChild
                  className="group h-12 w-full rounded-full border border-white/35 px-6 font-semibold sm:w-auto dark:bg-[#7a62ef] dark:text-white dark:hover:bg-[#8a73f4]"
                >
                  <Link to="/#contato">
                    Solicitar avaliação gratuita
                    <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
                  </Link>
                </Button>
                <Button asChild variant="outline" className="group h-12 w-full rounded-full px-6 sm:w-auto">
                  <Link to="/contato">
                    Falar com especialista
                    <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
                  </Link>
                </Button>
              </div>

              <div className="grid gap-3 sm:grid-cols-[1.05fr_0.95fr_0.95fr]">
                {[
                  {
                    label: "Estrutura viva",
                    text: "Rotina contábil, fiscal e financeira tratada como frente estratégica.",
                    className: "sm:-rotate-[5deg]",
                  },
                  {
                    label: "Leitura mensal",
                    text: "Indicadores e contexto para reduzir achismo na tomada de decisão.",
                    className: "sm:translate-y-6",
                  },
                  {
                    label: "Presença próxima",
                    text: "Acompanhamento que evita urgência crônica e desorganização recorrente.",
                    className: "sm:rotate-[4deg]",
                  },
                ].map((item, index) => (
                  <motion.div
                    key={item.label}
                    initial={{ opacity: 0, y: 18 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.2 }}
                    transition={{ duration: 0.38, delay: index * 0.07 }}
                    className={`hover-lift-soft surface-sheen rounded-[26px] border border-border bg-card px-5 py-5 shadow-sm dark:border-[#223058] dark:bg-[#0a1734] ${item.className}`}
                  >
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">{item.label}</p>
                    <p className="mt-3 text-sm leading-7 text-foreground">{item.text}</p>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            <motion.aside
              {...fadeIn}
              transition={{ duration: 0.45, delay: 0.1 }}
              className="relative min-h-[430px] overflow-hidden rounded-[38px] px-2 py-3 lg:mt-6"
            >
              <motion.div
                className="pointer-events-none absolute inset-y-8 left-1/2 w-[2px] -translate-x-1/2 rounded-full bg-gradient-to-b from-transparent via-primary/50 to-transparent"
                animate={{ opacity: [0.45, 0.9, 0.45], scaleY: [0.96, 1.04, 0.96] }}
                transition={{ duration: 4.6, repeat: Infinity, ease: "easeInOut" }}
              />

              <div className="pointer-events-none absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/12 blur-3xl" />
              <div className="pointer-events-none absolute left-4 top-5 text-[84px] font-black leading-none tracking-[-0.08em] text-primary/8 dark:text-white/5 md:text-[110px]">
                GROW
              </div>
              <div className="pointer-events-none absolute -right-5 bottom-0 text-[64px] font-black leading-none tracking-[-0.08em] text-primary/8 dark:text-white/5 md:text-[92px]">
                FLOW
              </div>

              <motion.div
                animate={{ rotate: [-10, -6, -10], y: [0, -8, 0] }}
                transition={{ duration: 6.2, repeat: Infinity, ease: "easeInOut" }}
                className="absolute left-5 top-7 max-w-[210px] rounded-[28px] border border-border/70 bg-background/90 px-4 py-4 shadow-md backdrop-blur dark:border-[#2a3760] dark:bg-[#091733]/90"
              >
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/12">
                    <BarChart3 className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Painel vivo</p>
                    <p className="text-sm font-medium text-foreground">Estratégia em movimento, não em caixa.</p>
                  </div>
                </div>
              </motion.div>

              <motion.div
                animate={{ y: [0, -12, 0], rotate: [8, 11, 8] }}
                transition={{ duration: 6.8, repeat: Infinity, ease: "easeInOut", delay: 0.4 }}
                className="absolute right-5 top-12 rounded-[30px] border border-primary/20 bg-primary/10 px-4 py-3 shadow-sm backdrop-blur"
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">Clareza</p>
                <p className="mt-1 text-sm font-medium text-foreground">Menos ruído operacional</p>
              </motion.div>

              <motion.div
                animate={{ scale: [1, 1.04, 1], rotate: [45, 50, 45] }}
                transition={{ duration: 5.2, repeat: Infinity, ease: "easeInOut" }}
                className="absolute left-1/2 top-1/2 h-[205px] w-[205px] -translate-x-1/2 -translate-y-1/2 rounded-[50px] border border-primary/20 bg-gradient-to-br from-background/95 via-background/72 to-primary/10 p-5 shadow-[0_24px_60px_-30px_rgba(38,52,89,0.45)] backdrop-blur dark:border-[#34406f] dark:from-[#08142f]/95 dark:via-[#0a1734]/80 dark:to-primary/20"
              >
                <div className="flex h-full flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="rounded-full border border-primary/15 bg-primary/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-primary">
                      Grow
                    </span>
                    <TrendingUp className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                      Direção consultiva
                    </p>
                    <p className="mt-2 font-heading text-[1.7rem] font-black leading-none tracking-[-0.05em] text-foreground">
                      Dados viram
                      <span className="block text-primary">decisão</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    <span className="h-2 w-2 rounded-full bg-primary" />
                    acompanhamento recorrente
                  </div>
                </div>
              </motion.div>

              <div className="pointer-events-none absolute left-[22%] top-[31%] h-px w-28 rotate-[28deg] bg-gradient-to-r from-transparent via-primary/45 to-transparent" />
              <div className="pointer-events-none absolute right-[16%] top-[57%] h-px w-24 -rotate-[34deg] bg-gradient-to-r from-transparent via-primary/45 to-transparent" />
              <div className="pointer-events-none absolute bottom-[27%] left-[34%] h-px w-24 rotate-[11deg] bg-gradient-to-r from-transparent via-primary/35 to-transparent" />

              {[
                {
                  item: "Consultoria contábil, fiscal e financeira integrada",
                  className: "right-2 top-24 rotate-[6deg] md:right-8",
                  delay: 0,
                },
                {
                  item: "Acompanhamento mensal com relatórios gerenciais",
                  className: "left-2 bottom-24 -rotate-[8deg] md:left-8",
                  delay: 0.7,
                },
                {
                  item: "Suporte estratégico para tomada de decisão",
                  className: "bottom-10 right-5 rotate-[4deg] md:right-12",
                  delay: 1.2,
                },
              ].map(({ item, className, delay }) => (
                <motion.div
                  key={item}
                  className={`absolute max-w-[270px] rounded-[24px] border border-border/70 bg-background/90 px-4 py-3 shadow-md backdrop-blur dark:border-[#2a3760] dark:bg-[#091733]/88 ${className}`}
                  animate={{ y: [0, -10, 0], rotate: [0, 1.5, 0] }}
                  transition={{ duration: 5.4, repeat: Infinity, ease: "easeInOut", delay }}
                >
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
                    <span className="text-sm text-foreground">{item}</span>
                  </div>
                </motion.div>
              ))}

              <motion.div
                animate={{ x: [0, 12, 0], opacity: [0.42, 0.82, 0.42] }}
                transition={{ duration: 5.8, repeat: Infinity, ease: "easeInOut" }}
                className="pointer-events-none absolute bottom-14 left-1/2 h-[2px] w-36 -translate-x-1/2 rounded-full bg-gradient-to-r from-transparent via-primary/75 to-transparent"
              />
            </motion.aside>
          </div>

          <div className="container mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {metrics.map((metric, index) => (
              <motion.div
                key={metric.label}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.35, delay: index * 0.05 }}
                className="hover-lift-soft surface-sheen relative rounded-2xl border border-border bg-card p-4 dark:border-[#223058] dark:bg-[#0a1734]"
              >
                <span className="mesh-dot right-3 top-2 h-14 w-14" />
                <div className="mb-3 h-1.5 w-10 rounded-full bg-primary/20" />
                <p className="text-2xl font-bold text-foreground">{metric.value}</p>
                <p className="mt-1 text-sm font-semibold text-foreground">{metric.label}</p>
                <p className="mt-1 text-xs text-muted-foreground">{metric.detail}</p>
              </motion.div>
            ))}
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

            <div className="hide-scrollbar mx-[-1rem] flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:gap-4 md:overflow-visible md:px-0 md:pb-0 md:snap-none md:grid-cols-2 xl:grid-cols-4">
              {values.map((value, index) => (
                <motion.article
                  key={value.title}
                  initial={{ opacity: 0, y: 14 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={{ duration: 0.35, delay: index * 0.05 }}
                  className="hover-lift-soft surface-sheen group min-w-[84%] snap-start rounded-2xl border border-border bg-card p-5 sm:min-w-[72%] md:min-w-0 dark:border-[#223058] dark:bg-[#0a1734]"
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 transition-transform duration-300 group-hover:scale-105">
                    <value.icon className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="mt-3 font-heading text-lg font-semibold">{value.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{value.description}</p>
                  <div className="mt-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-primary/70">
                    <span className="h-px flex-1 bg-primary/20" />
                    Grow
                  </div>
                </motion.article>
              ))}
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
