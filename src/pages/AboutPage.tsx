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
  { icon: CheckCircle2, title: "Diagnostico inicial", description: "Mapeamento das prioridades contabils, fiscais e financeiras." },
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
      toast.error("Preencha nome e e-mail para continuar.");
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
      toast.error(`Nao foi possivel enviar sua solicitacao: ${error.message}`);
      return;
    }

    setLeadForm({
      fullName: "",
      companyName: "",
      email: "",
    });
    toast.success("Recebemos sua solicitacao. Vamos retornar em breve.");
  };

  return (
    <SiteLayout>
      <div className="bg-[#f3f3f6] text-foreground transition-colors dark:bg-[#051334]">
        <section id="institucional" className="border-b border-border/60 py-10 dark:border-[#243054] sm:py-12 md:py-16">
          <div className="container grid gap-8 sm:gap-10 lg:grid-cols-[1.2fr_1fr] lg:items-start">
            <motion.div {...fadeIn} className="space-y-6">
              <span className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                Grow Contabilidade - Institucional
              </span>
              <h1 className="font-heading text-3xl font-bold leading-tight sm:text-4xl md:text-5xl">
                Mais do que contabilidade, construimos estrategia para o crescimento do seu negocio
              </h1>
              <p className="max-w-2xl text-base leading-relaxed text-muted-foreground">
                A Grow une consultoria, tecnologia e atendimento proximo para organizar sua operacao contabil e financeira.
                Nosso foco e transformar complexidade em clareza, conformidade e crescimento sustentavel.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <Button
                  asChild
                  className="w-full rounded-full border border-white/35 px-5 font-semibold sm:w-auto dark:bg-[#7a62ef] dark:text-white dark:hover:bg-[#8a73f4]"
                >
                  <Link to="/#contato">Solicitar avaliacao gratuita</Link>
                </Button>
                <Button asChild variant="outline" className="w-full rounded-full px-5 sm:w-auto">
                  <Link to="/contato">Falar com especialista</Link>
                </Button>
              </div>
            </motion.div>

            <motion.aside
              {...fadeIn}
              transition={{ duration: 0.45, delay: 0.1 }}
              className="rounded-2xl border border-border bg-card p-5 shadow-sm dark:border-[#223058] dark:bg-[#0a1734]"
            >
              <h2 className="font-heading text-lg font-semibold">Painel institucional</h2>
              <p className="mt-1 text-sm text-muted-foreground">Panorama da proposta de valor da Grow para empresas em crescimento.</p>
              <div className="mt-5 space-y-3">
                {[
                  "Consultoria contabil, fiscal e financeira integrada",
                  "Acompanhamento mensal com relatorios gerenciais",
                  "Suporte estrategico para tomada de decisao",
                ].map((item) => (
                  <div key={item} className="flex items-start gap-2 rounded-lg border border-border/70 bg-muted/20 p-3 dark:border-[#2a3760] dark:bg-[#0d1a38]">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary" />
                    <span className="text-sm text-foreground">{item}</span>
                  </div>
                ))}
              </div>
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
                className="rounded-2xl border border-border bg-card p-4 dark:border-[#223058] dark:bg-[#0a1734]"
              >
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
                Somos uma consultoria contabil com abordagem proativa. Atuamos lado a lado com o empresario para transformar
                dados em decisao e decisao em resultado.
              </p>
            </motion.div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {values.map((value, index) => (
                <motion.article
                  key={value.title}
                  initial={{ opacity: 0, y: 14 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={{ duration: 0.35, delay: index * 0.05 }}
                  className="rounded-2xl border border-border bg-card p-5 dark:border-[#223058] dark:bg-[#0a1734]"
                >
                  <value.icon className="h-5 w-5 text-primary" />
                  <h3 className="mt-3 font-heading text-lg font-semibold">{value.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{value.description}</p>
                </motion.article>
              ))}
            </div>
          </div>
        </section>

        <section id="servicos" className="py-12 md:py-16">
          <div className="container">
            <motion.div {...fadeIn} className="mb-6">
              <h2 className="font-heading text-2xl font-semibold sm:text-3xl">Nossos servicos</h2>
            </motion.div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {services.map((service, index) => (
                <motion.article
                  key={service.title}
                  initial={{ opacity: 0, y: 14 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={{ duration: 0.35, delay: index * 0.04 }}
                  className="rounded-2xl border border-border bg-card p-5 dark:border-[#223058] dark:bg-[#0a1734]"
                >
                  <service.icon className="h-5 w-5 text-primary" />
                  <h3 className="mt-3 font-heading text-base font-semibold">{service.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{service.description}</p>
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

            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
              {testimonials.map((testimonial, index) => (
                <motion.article
                  key={testimonial.name}
                  initial={{ opacity: 0, y: 14 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={{ duration: 0.35, delay: index * 0.05 }}
                  className="rounded-2xl border border-border bg-card p-5 dark:border-[#223058] dark:bg-[#0a1734]"
                >
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
                Porque nossa proposta combina tecnica, proximidade e inteligencia de gestao. Nao entregamos apenas obrigacoes,
                entregamos direcao para o seu negocio.
              </p>
              <div className="mt-4 space-y-2 text-sm">
                <p className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-primary" />Equipe dedicada por cliente</p>
                <p className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-primary" />Entrega mensal com leitura executiva</p>
                <p className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-primary" />Suporte continuo para decisao</p>
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
                    Pronto para tornar sua gestao mais clara e estrategica?
                  </h2>
                  <p className="mt-3 max-w-xl text-sm text-primary-foreground/85 dark:text-[#bcc7ea]">
                    Fale com a Grow e receba um plano inicial para organizar processos, reduzir riscos e evoluir com previsibilidade.
                  </p>
                  <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                    <Button
                      asChild
                      className="w-full rounded-full border border-white/35 px-5 text-sm font-semibold sm:w-auto dark:bg-[#7a62ef] dark:text-white dark:hover:bg-[#8a73f4]"
                    >
                      <Link to="/contato">Solicitar avaliacao gratuita</Link>
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
                  <p className="mt-3 text-xs text-muted-foreground dark:text-[#9ca8cf]">Garantimos confidencialidade e seguranca dos seus dados.</p>
                  <Button type="submit" className="mt-4 w-full rounded-full dark:bg-[#7a62ef] dark:text-white dark:hover:bg-[#8a73f4]" disabled={sending}>
                    {sending ? "Enviando..." : "Enviar solicitacao"}
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
