import { SiteLayout } from "@/components/site/SiteLayout";
import { SiteLeadForm } from "@/components/site/SiteLeadForm";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Award,
  BarChart3,
  Briefcase,
  Building2,
  CheckCircle2,
  Clock,
  Eye,
  FileText,
  Heart,
  Shield,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";

const metrics = [
  { value: "+12", label: "Anos de mercado", detail: "Experiencia solida em contabilidade consultiva" },
  { value: "98%", label: "Satisfacao dos clientes", detail: "Relacionamentos duradouros e atendimento proximo" },
  { value: "120+", label: "Empresas atendidas", detail: "Operacao ativa em varios segmentos" },
  { value: "100%", label: "Conformidade", detail: "Processos com foco em precisao e seguranca" },
];

const values = [
  { icon: Target, title: "Foco em resultados", description: "Cada acao orientada por metas claras de crescimento e eficiencia." },
  { icon: Eye, title: "Visao estrategica", description: "Transformamos dados em direcao para decisoes de curto e longo prazo." },
  { icon: Heart, title: "Atendimento humano", description: "Acompanhamento proximo para entender o contexto real de cada empresa." },
  { icon: Award, title: "Excelencia tecnica", description: "Equipe especializada e processos padronizados com alta confiabilidade." },
];

const services = [
  { icon: BarChart3, title: "Contabilidade consultiva", description: "Fechamentos, balancos e indicadores com orientacao para decisoes gerenciais." },
  { icon: Shield, title: "Assessoria fiscal", description: "Planejamento tributario e revisoes periodicas para reduzir risco fiscal." },
  { icon: Users, title: "Departamento pessoal", description: "Rotinas trabalhistas, folha, admissoes e suporte continuo ao RH." },
  { icon: Building2, title: "Abertura e regularizacao", description: "Constituicao de empresa, alteracoes contratuais e regularizacoes completas." },
  { icon: Briefcase, title: "Suporte ao empresario", description: "Consultoria para planejamento, estrutura financeira e crescimento sustentavel." },
  { icon: FileText, title: "Relatorios gerenciais", description: "Painel mensal com leitura executiva para acompanhamento de performance." },
];

const differentials = [
  "Atendimento por especialistas com agenda de acompanhamento.",
  "Rotina de prevencao de riscos fiscais e trabalhistas.",
  "Indicadores objetivos para apoiar decisao do empresario.",
  "Comunicacao clara, prazos definidos e processos rastreaveis.",
];

const journey = [
  { icon: CheckCircle2, title: "Diagnostico inicial", description: "Mapeamento das prioridades contabeis, fiscais e financeiras." },
  { icon: Clock, title: "Plano de 90 dias", description: "Roadmap com entregas, prazos e responsabilidades definidas." },
  { icon: TrendingUp, title: "Evolucao mensal", description: "Monitoramento de indicadores e ajustes continuos na operacao." },
];

const testimonials = [
  {
    name: "Lucas Moreira",
    role: "CEO, TechNova",
    text: "Com a Grow, nossa gestao financeira ficou clara. Hoje decidimos com base em relatorios consistentes.",
  },
  {
    name: "Mariana Ribeiro",
    role: "Fundadora, Casa Verde",
    text: "Atendimento muito proximo e pratico. Conseguimos regularizar pendencias e organizar o crescimento.",
  },
  {
    name: "Rafael Alves",
    role: "Diretor Financeiro, BlueLine",
    text: "A consultoria estrategica da Grow virou parte da nossa rotina de tomada de decisao.",
  },
];

const faqItems = [
  {
    question: "Como funciona o inicio da parceria com a Grow?",
    answer: "Iniciamos com um diagnostico completo da operacao, definimos prioridades e montamos um plano de acao com entregas e prazos claros.",
  },
  {
    question: "A Grow atende apenas empresas de um segmento especifico?",
    answer: "Nao. Atendemos comercio, servicos, tecnologia, saude, construcao, profissionais liberais e outras estruturas empresariais.",
  },
  {
    question: "Com que frequencia recebo relatorios e orientacoes?",
    answer: "Acompanhamento mensal com relatorios gerenciais, alem de suporte continuo para demandas pontuais do dia a dia.",
  },
  {
    question: "Posso contratar apenas parte dos servicos?",
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
  return (
    <SiteLayout>
      <div className="institutional-page text-foreground transition-colors">
        <section id="institucional" className="container py-8 sm:py-10 md:py-14">
          <div className="institutional-hero grid gap-8 p-5 sm:p-7 lg:grid-cols-[1.15fr_0.85fr] lg:p-9">
            <div
              aria-hidden="true"
              className="brand-watermark -right-20 -top-24 hidden h-[34rem] w-[21rem] rounded-[4rem] border border-[#806589]/15 bg-[#4D4489]/20 lg:block"
            />
            <motion.div {...fadeIn} className="relative z-10 space-y-6">
              <span className="institutional-kicker">Grow Contabilidade</span>
              <h1 className="font-heading text-3xl font-bold leading-tight sm:text-4xl md:text-5xl">
                Mais do que contabilidade: uma operacao consultiva para crescimento seguro.
              </h1>
              <p className="max-w-2xl text-base leading-relaxed text-muted-foreground">
                A Grow une consultoria, tecnologia e atendimento proximo para organizar sua operacao contabil e financeira.
                Nosso foco e transformar complexidade em clareza, conformidade e crescimento sustentavel.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <Button asChild className="w-full rounded-full px-5 font-semibold sm:w-auto">
                  <Link to="/#contato">
                    Solicitar avaliacao gratuita <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </Button>
                <Button asChild variant="outline" className="w-full rounded-full px-5 sm:w-auto">
                  <Link to="/contato">Falar com especialista</Link>
                </Button>
              </div>
            </motion.div>

            <motion.aside {...fadeIn} transition={{ duration: 0.45, delay: 0.1 }} className="relative z-10 institutional-card p-5">
              <div
                role="img"
                aria-label="Painel generico de apresentacao institucional contabil"
                className="generic-insight-visual flex min-h-48 items-end rounded-[1.35rem] border border-[#806589]/20 p-6 shadow-sm"
              >
                <span className="site-wordmark font-heading text-3xl font-bold">Grow</span>
              </div>
              <h2 className="mt-5 font-heading text-lg font-semibold">Painel institucional</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Proposta de valor organizada para empresas que precisam de contabilidade, controle e decisao.
              </p>
              <div className="mt-5 space-y-3">
                {[
                  "Consultoria contabil, fiscal e financeira integrada",
                  "Acompanhamento mensal com relatorios gerenciais",
                  "Suporte estrategico para tomada de decisao",
                ].map((item) => (
                  <div key={item} className="flex items-start gap-2 rounded-xl border border-border/70 bg-muted/20 p-3">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary" aria-hidden="true" />
                    <span className="text-sm text-foreground">{item}</span>
                  </div>
                ))}
              </div>
            </motion.aside>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {metrics.map((metric, index) => (
              <motion.div
                key={metric.label}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.35, delay: index * 0.05 }}
                className="institutional-card-muted p-4"
              >
                <p className="font-heading text-2xl font-bold tabular-nums text-foreground">{metric.value}</p>
                <p className="mt-1 text-sm font-semibold text-foreground">{metric.label}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{metric.detail}</p>
              </motion.div>
            ))}
          </div>
        </section>

        <section className="py-10 md:py-14">
          <div className="container grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
            <motion.article {...fadeIn} className="institutional-card p-6">
              <span className="institutional-kicker">Quem somos</span>
              <h2 className="mt-4 font-heading text-2xl font-semibold sm:text-3xl">Uma consultoria contabil com ritmo de operacao moderna.</h2>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                Atuamos lado a lado com o empresario para transformar dados em decisao e decisao em resultado. A experiencia
                combina padronizacao, rastreabilidade e comunicacao simples.
              </p>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {values.map((value) => (
                  <div key={value.title} className="institutional-card-muted p-4">
                    <value.icon className="h-5 w-5 text-primary" aria-hidden="true" />
                    <h3 className="mt-3 font-heading text-base font-semibold">{value.title}</h3>
                    <p className="mt-2 text-sm text-muted-foreground">{value.description}</p>
                  </div>
                ))}
              </div>
            </motion.article>
            <motion.article
              {...fadeIn}
              transition={{ duration: 0.45, delay: 0.1 }}
              role="img"
              aria-label="Consultoria contabil analisando documentos e indicadores financeiros"
              className="generic-office-visual institutional-card min-h-[420px] overflow-hidden"
            >
            </motion.article>
          </div>
        </section>

        <section id="servicos" className="py-10 md:py-14">
          <div className="container">
            <motion.div {...fadeIn} className="mb-6 max-w-3xl">
              <span className="institutional-kicker">Servicos</span>
              <h2 className="mt-4 font-heading text-2xl font-semibold sm:text-3xl">Competencias conectadas por uma unica experiencia.</h2>
            </motion.div>

            <div className="hide-scrollbar mx-[-1rem] flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:snap-none md:grid-cols-2 md:gap-4 md:overflow-visible md:px-0 md:pb-0 xl:grid-cols-3">
              {services.map((service, index) => (
                <motion.article
                  key={service.title}
                  initial={{ opacity: 0, y: 14 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={{ duration: 0.35, delay: index * 0.04 }}
                  className="institutional-card min-w-[84%] snap-start p-5 sm:min-w-[72%] md:min-w-0"
                >
                  <service.icon className="h-5 w-5 text-primary" aria-hidden="true" />
                  <h3 className="mt-3 font-heading text-base font-semibold">{service.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{service.description}</p>
                </motion.article>
              ))}
            </div>
          </div>
        </section>

        <section id="diferenciais" className="py-10 md:py-14">
          <div className="container grid gap-6 lg:grid-cols-[1fr_1fr]">
            <motion.article {...fadeIn} className="institutional-card p-6">
              <span className="institutional-kicker">Diferenciais</span>
              <h2 className="mt-4 font-heading text-2xl font-semibold">O que muda na rotina do cliente</h2>
              <div className="mt-4 space-y-3">
                {differentials.map((item) => (
                  <div key={item} className="flex items-start gap-2 text-sm">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary" aria-hidden="true" />
                    <span className="text-foreground">{item}</span>
                  </div>
                ))}
              </div>
            </motion.article>

            <motion.article {...fadeIn} transition={{ duration: 0.45, delay: 0.1 }} className="institutional-card p-6">
              <span className="institutional-kicker">Como trabalhamos</span>
              <div className="mt-4 space-y-3">
                {journey.map((step, index) => (
                  <div key={step.title} className="rounded-2xl border border-border/70 bg-background/70 p-4">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <step.icon className="h-4 w-4 text-primary" aria-hidden="true" />
                      <span>{step.title}</span>
                      <span className="ml-auto text-xs tabular-nums text-muted-foreground">0{index + 1}</span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{step.description}</p>
                  </div>
                ))}
              </div>
            </motion.article>
          </div>
        </section>

        <section id="clientes" className="py-10 md:py-14">
          <div className="container">
            <motion.div {...fadeIn} className="mb-6">
              <span className="institutional-kicker">Clientes e depoimentos</span>
              <h2 className="mt-4 font-heading text-2xl font-semibold sm:text-3xl">Sinal de confianca com linguagem simples.</h2>
            </motion.div>

            <div className="hide-scrollbar mx-[-1rem] flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:snap-none md:grid-cols-3 md:gap-4 md:overflow-visible md:px-0 md:pb-0">
              {testimonials.map((testimonial, index) => (
                <motion.article
                  key={testimonial.name}
                  initial={{ opacity: 0, y: 14 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={{ duration: 0.35, delay: index * 0.05 }}
                  className="institutional-card min-w-[84%] snap-start p-5 sm:min-w-[72%] md:min-w-0"
                >
                  <p className="text-sm leading-relaxed text-muted-foreground">"{testimonial.text}"</p>
                  <div className="mt-4 border-t border-border pt-4">
                    <p className="text-sm font-semibold">{testimonial.name}</p>
                    <p className="text-xs text-muted-foreground">{testimonial.role}</p>
                  </div>
                </motion.article>
              ))}
            </div>
          </div>
        </section>

        <section className="py-10 md:py-14">
          <div className="container grid gap-6 lg:grid-cols-[1fr_1fr]">
            <motion.article {...fadeIn} className="institutional-card p-6">
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

            <motion.div
              {...fadeIn}
              transition={{ duration: 0.45, delay: 0.1 }}
            >
              <SiteLeadForm
                formId="about-lead"
                originPage="about"
                submitLabel="Enviar solicitacao"
                successMessage="Recebemos sua solicitacao. Vamos retornar em breve."
                className="institutional-card space-y-4 p-6"
                intro={
                  <>
                    <span className="institutional-kicker">Comece agora</span>
                    <h2 className="font-heading text-2xl font-semibold">Solicite uma avaliacao gratuita</h2>
                  </>
                }
              />
            </motion.div>
          </div>
        </section>
      </div>
    </SiteLayout>
  );
}
