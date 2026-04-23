import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Briefcase,
  Building2,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FileText,
  Handshake,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { SiteLayout } from "@/components/site/SiteLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { captureSiteLead } from "@/lib/siteLeadCapture";
import { cn } from "@/lib/utils";

const heroStats = [
  { value: "+12", label: "anos organizando operações empresariais" },
  { value: "120+", label: "empresas acompanhadas em rotinas críticas" },
  { value: "98%", label: "retenção em relacionamentos de longo prazo" },
] as const;

const quickFilters = [
  "Contábil",
  "Fiscal",
  "Departamento Pessoal",
  "BPO Financeiro",
] as const;

const values = [
  {
    icon: Target,
    title: "Clareza operacional",
    description: "A Grow organiza o que precisa ser visto agora, sem ruído e sem excesso de burocracia.",
  },
  {
    icon: ShieldCheck,
    title: "Segurança técnica",
    description: "Processos padronizados, revisão recorrente e visão preventiva sobre risco fiscal e trabalhista.",
  },
  {
    icon: Handshake,
    title: "Relação consultiva",
    description: "Atendimento próximo, com leitura de contexto e apoio real para o empresário decidir melhor.",
  },
  {
    icon: TrendingUp,
    title: "Foco em crescimento",
    description: "A estrutura contábil deixa de ser apenas obrigação e passa a sustentar expansão com previsibilidade.",
  },
] as const;

const serviceGroups = [
  {
    id: "contabil",
    label: "Contábil",
    eyebrow: "Base estruturada",
    title: "Contabilidade consultiva com leitura gerencial de cada fechamento",
    description:
      "Fechamentos, balanços e relatórios com contexto para o empresário acompanhar margem, caixa, evolução e pontos de atenção.",
    bullets: [
      "Fechamentos mensais organizados com leitura executiva",
      "Indicadores essenciais para decisões recorrentes",
      "Acompanhamento próximo da saúde financeira da operação",
    ],
    highlights: ["Balanço patrimonial", "DRE gerencial", "Indicadores de performance"],
    icon: BarChart3,
  },
  {
    id: "fiscal",
    label: "Fiscal",
    eyebrow: "Menos risco",
    title: "Rotina fiscal monitorada para reduzir exposição e ganhar previsibilidade",
    description:
      "Planejamento, apuração e revisão periódica para reduzir inconsistências, evitar passivos e sustentar conformidade.",
    bullets: [
      "Apuração e conferência de tributos com rotina definida",
      "Visão preventiva sobre inconsistências e obrigações",
      "Orientação sobre enquadramento e impacto tributário",
    ],
    highlights: ["Apuração tributária", "Revisão fiscal", "Prevenção de passivos"],
    icon: ShieldCheck,
  },
  {
    id: "dp",
    label: "Departamento Pessoal",
    eyebrow: "Fluxo humano",
    title: "Departamento pessoal integrado à rotina da empresa e ao dia a dia do RH",
    description:
      "Folha, admissões, desligamentos e obrigações trabalhistas tratados com processo claro, comunicação objetiva e rastreabilidade.",
    bullets: [
      "Folha e encargos com acompanhamento recorrente",
      "Suporte em admissões, férias, rescisões e eventos trabalhistas",
      "Calendário operacional para reduzir urgências e retrabalho",
    ],
    highlights: ["Folha mensal", "Eventos trabalhistas", "Rotinas de RH"],
    icon: Users,
  },
  {
    id: "financeiro",
    label: "BPO Financeiro",
    eyebrow: "Visão de caixa",
    title: "Rotina financeira organizada para ampliar controle e velocidade de decisão",
    description:
      "Processos financeiros com critério, cadência e visibilidade para transformar dados soltos em gestão prática.",
    bullets: [
      "Organização de contas, recebimentos e compromissos financeiros",
      "Leitura recorrente do fluxo para apoiar decisões rápidas",
      "Mais consistência para crescimento com menos improviso",
    ],
    highlights: ["Fluxo de caixa", "Rotina financeira", "Apoio à gestão"],
    icon: Briefcase,
  },
] as const;

const comparisonRows = [
  {
    label: "Visão da operação",
    standard: "Informações descentralizadas e leitura reativa",
    grow: "Painel consolidado com acompanhamento recorrente",
  },
  {
    label: "Tomada de decisão",
    standard: "Baseada em urgências e dados dispersos",
    grow: "Apoiada por indicadores, contexto e prioridade clara",
  },
  {
    label: "Risco fiscal e trabalhista",
    standard: "Ajustes quando o problema já apareceu",
    grow: "Prevenção com rotina de revisão e orientação contínua",
  },
  {
    label: "Relacionamento",
    standard: "Contato eventual e operacional",
    grow: "Atendimento consultivo com acompanhamento de evolução",
  },
] as const;

const trustItems = [
  {
    icon: Building2,
    title: "Estrutura para empresas em fase de expansão",
    text: "Atendimentos desenhados para negócios que precisam crescer sem perder controle.",
  },
  {
    icon: FileText,
    title: "Relatórios objetivos e acionáveis",
    text: "Menos volume sem contexto. Mais leitura executiva do que realmente importa.",
  },
  {
    icon: Clock3,
    title: "Fluxos previsíveis",
    text: "Cadências e entregas com menos improviso, menos retrabalho e mais confiança na rotina.",
  },
] as const;

const sectionReveal = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.2 },
  transition: { duration: 0.45 },
};

export default function AboutPage() {
  const [selectedService, setSelectedService] = useState<(typeof serviceGroups)[number]["id"]>("contabil");
  const [sending, setSending] = useState(false);
  const [leadForm, setLeadForm] = useState({
    fullName: "",
    companyName: "",
    email: "",
  });

  const activeService = serviceGroups.find((service) => service.id === selectedService) ?? serviceGroups[0];
  const ActiveServiceIcon = activeService.icon;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const fullName = leadForm.fullName.trim();
    const email = leadForm.email.trim();

    if (!fullName || !email) {
      toast.error("Preencha nome e e-mail para continuar.");
      return;
    }

    setSending(true);

    try {
      const { error } = await captureSiteLead({
        fullName,
        companyName: leadForm.companyName.trim(),
        email,
        originPage: "about",
      });

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
    } finally {
      setSending(false);
    }
  };

  return (
    <SiteLayout>
      <div className="bg-[#f3f3f6] text-foreground transition-colors dark:bg-[#051334]">
        <section id="institucional" className="overflow-hidden border-b border-border/60 pt-28 dark:border-[#243054] md:pt-32">
          <div className="container pb-14 md:pb-20">
            <motion.div {...sectionReveal} className="mx-auto max-w-4xl text-center">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                <Sparkles className="h-3.5 w-3.5" />
                Grow Contabilidade para empresas em crescimento
              </div>

              <h1 className="mt-6 font-heading text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl lg:text-7xl">
                O parceiro contábil que transforma
                <span className="block text-primary">rotina em direção</span>
              </h1>

              <p className="mx-auto mt-5 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
                Estruturamos contabilidade, fiscal, departamento pessoal e rotinas financeiras para que sua empresa opere com
                mais clareza, menos risco e muito mais previsibilidade.
              </p>

              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Button asChild className="w-full rounded-full px-6 sm:w-auto">
                  <Link to="/#contato">
                    Agendar avaliação
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline" className="w-full rounded-full px-6 sm:w-auto">
                  <Link to="/contato">Falar com especialista</Link>
                </Button>
              </div>
            </motion.div>

            <motion.div
              {...sectionReveal}
              transition={{ duration: 0.45, delay: 0.08 }}
              className="mx-auto mt-10 flex max-w-5xl flex-wrap items-center justify-center gap-2 rounded-[28px] border border-border/70 bg-card/90 p-2 shadow-sm backdrop-blur dark:border-[#243054] dark:bg-[#0a1734]/90"
            >
              {quickFilters.map((filter, index) => (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setSelectedService(serviceGroups[index]?.id ?? "contabil")}
                  className={cn(
                    "rounded-full px-4 py-2 text-sm font-semibold transition-colors",
                    selectedService === serviceGroups[index]?.id
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  {filter}
                </button>
              ))}
            </motion.div>

            <div className="mt-10 grid gap-4 lg:grid-cols-[1.25fr_0.95fr]">
              <motion.div
                {...sectionReveal}
                transition={{ duration: 0.45, delay: 0.12 }}
                className="rounded-[30px] border border-border bg-card p-6 shadow-sm dark:border-[#223058] dark:bg-[#0a1734] md:p-8"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">{activeService.eyebrow}</p>
                    <h2 className="mt-3 max-w-2xl font-heading text-2xl font-semibold leading-tight sm:text-3xl">
                      {activeService.title}
                    </h2>
                  </div>
                  <div className="rounded-2xl border border-border/70 bg-background/80 p-3 dark:border-[#2a3760] dark:bg-[#08142f]">
                    <ActiveServiceIcon className="h-6 w-6 text-primary" />
                  </div>
                </div>

                <p className="mt-5 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">{activeService.description}</p>

                <div className="mt-7 grid gap-3 sm:grid-cols-3">
                  {activeService.highlights.map((item) => (
                    <div
                      key={item}
                      className="rounded-2xl border border-border/70 bg-background/70 px-4 py-3 text-sm font-medium dark:border-[#2a3760] dark:bg-[#08142f]"
                    >
                      {item}
                    </div>
                  ))}
                </div>

                <div className="mt-7 grid gap-3">
                  {activeService.bullets.map((item) => (
                    <div
                      key={item}
                      className="flex items-start gap-3 rounded-2xl border border-border/70 bg-muted/30 px-4 py-4 dark:border-[#2a3760] dark:bg-[#0d1a38]"
                    >
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <p className="text-sm text-foreground">{item}</p>
                    </div>
                  ))}
                </div>
              </motion.div>

              <motion.aside
                {...sectionReveal}
                transition={{ duration: 0.45, delay: 0.16 }}
                className="rounded-[30px] border border-border bg-card p-6 shadow-sm dark:border-[#223058] dark:bg-[#0a1734] md:p-8"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Painel Grow</p>
                    <h2 className="mt-2 font-heading text-xl font-semibold">Como a operação passa a funcionar</h2>
                  </div>
                  <BadgeCheck className="h-5 w-5 text-primary" />
                </div>

                <div className="mt-6 space-y-4">
                  <div className="rounded-3xl border border-border/70 bg-background/80 p-5 dark:border-[#2a3760] dark:bg-[#08142f]">
                    <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      <span>Visão executiva</span>
                      <span>Mensal</span>
                    </div>
                    <div className="mt-5 grid grid-cols-3 gap-3">
                      {heroStats.map((item) => (
                        <div key={item.label} className="rounded-2xl bg-muted/40 p-3 dark:bg-[#0d1a38]">
                          <p className="text-lg font-bold text-foreground">{item.value}</p>
                          <p className="mt-1 text-[11px] leading-4 text-muted-foreground">{item.label}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-3xl border border-border/70 bg-background/80 p-5 dark:border-[#2a3760] dark:bg-[#08142f]">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold">Fluxo de acompanhamento</p>
                        <p className="text-xs text-muted-foreground">Estrutura próxima do que aparece no vídeo de referência.</p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>

                    <div className="mt-5 space-y-3">
                      {[
                        "Diagnóstico inicial da operação",
                        "Plano de organização e prioridades",
                        "Acompanhamento contínuo com leitura gerencial",
                      ].map((step, index) => (
                        <div key={step} className="flex items-center gap-3 rounded-2xl bg-muted/35 px-4 py-3 dark:bg-[#0d1a38]">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                            0{index + 1}
                          </span>
                          <p className="text-sm text-foreground">{step}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.aside>
            </div>
          </div>
        </section>

        <section id="diferenciais" className="py-14 md:py-20">
          <div className="container">
            <motion.div {...sectionReveal} className="mx-auto max-w-3xl text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Nossos valores centrais</p>
              <h2 className="mt-3 font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
                Uma estrutura consultiva desenhada para simplificar a gestão
              </h2>
              <p className="mt-4 text-sm leading-7 text-muted-foreground sm:text-base">
                O layout desta página passa a priorizar mensagem, prova de valor e caminho de ação com a mesma lógica do vídeo.
              </p>
            </motion.div>

            <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {values.map((value, index) => (
                <motion.article
                  key={value.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={{ duration: 0.35, delay: index * 0.06 }}
                  className="rounded-[28px] border border-border bg-card p-6 shadow-sm dark:border-[#223058] dark:bg-[#0a1734]"
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <value.icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-5 font-heading text-lg font-semibold">{value.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-muted-foreground">{value.description}</p>
                </motion.article>
              ))}
            </div>
          </div>
        </section>

        <section id="servicos" className="border-y border-border/60 py-14 dark:border-[#243054] md:py-20">
          <div className="container grid gap-6 lg:grid-cols-[0.92fr_1.08fr]">
            <motion.div {...sectionReveal} className="rounded-[30px] border border-border bg-card p-6 shadow-sm dark:border-[#223058] dark:bg-[#0a1734] md:p-8">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Estrutura de serviços</p>
              <h2 className="mt-3 font-heading text-3xl font-semibold tracking-tight">Especialidades integradas em uma operação mais simples</h2>
              <p className="mt-4 text-sm leading-7 text-muted-foreground">
                Em vez de apresentar blocos genéricos, esta seção usa uma composição mais próxima do vídeo: texto orientado à leitura
                e um painel visual lateral para reforçar a proposta.
              </p>

              <div className="mt-8 space-y-3">
                {trustItems.map((item) => (
                  <div
                    key={item.title}
                    className="rounded-2xl border border-border/70 bg-background/80 p-4 dark:border-[#2a3760] dark:bg-[#08142f]"
                  >
                    <div className="flex items-start gap-3">
                      <item.icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <div>
                        <p className="text-sm font-semibold">{item.title}</p>
                        <p className="mt-1 text-sm text-muted-foreground">{item.text}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div
              {...sectionReveal}
              transition={{ duration: 0.45, delay: 0.08 }}
              className="rounded-[30px] border border-border bg-card p-6 shadow-sm dark:border-[#223058] dark:bg-[#0a1734] md:p-8"
            >
              <div className="grid gap-4 md:grid-cols-2">
                {serviceGroups.map((service) => (
                  <button
                    key={service.id}
                    type="button"
                    onClick={() => setSelectedService(service.id)}
                    className={cn(
                      "rounded-[24px] border px-5 py-5 text-left transition-colors",
                      selectedService === service.id
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background/80 text-foreground hover:bg-muted dark:border-[#2a3760] dark:bg-[#08142f]",
                    )}
                  >
                    <service.icon className="h-5 w-5" />
                    <p className="mt-4 text-base font-semibold">{service.label}</p>
                    <p
                      className={cn(
                        "mt-2 text-sm leading-6",
                        selectedService === service.id ? "text-primary-foreground/85" : "text-muted-foreground",
                      )}
                    >
                      {service.description}
                    </p>
                  </button>
                ))}
              </div>
            </motion.div>
          </div>
        </section>

        <section id="clientes" className="py-14 md:py-20">
          <div className="container">
            <motion.div {...sectionReveal} className="mx-auto max-w-3xl text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Comparativo de proposta</p>
              <h2 className="mt-3 font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
                O que muda quando a contabilidade deixa de atuar só no operacional
              </h2>
            </motion.div>

            <motion.div
              {...sectionReveal}
              transition={{ duration: 0.45, delay: 0.08 }}
              className="mt-10 overflow-hidden rounded-[32px] border border-border bg-card shadow-sm dark:border-[#223058] dark:bg-[#0a1734]"
            >
              <div className="grid grid-cols-[1.1fr_1fr_1fr] border-b border-border/70 bg-background/60 dark:border-[#243054] dark:bg-[#08142f]">
                <div className="px-5 py-4 text-sm font-semibold text-foreground">Critério</div>
                <div className="px-5 py-4 text-sm font-semibold text-muted-foreground">Modelo tradicional</div>
                <div className="px-5 py-4 text-sm font-semibold text-primary">Com a Grow</div>
              </div>

              {comparisonRows.map((row) => (
                <div
                  key={row.label}
                  className="grid grid-cols-1 border-b border-border/70 last:border-b-0 md:grid-cols-[1.1fr_1fr_1fr] dark:border-[#243054]"
                >
                  <div className="px-5 py-5 text-sm font-semibold text-foreground">{row.label}</div>
                  <div className="px-5 py-5 text-sm text-muted-foreground">{row.standard}</div>
                  <div className="px-5 py-5 text-sm text-foreground">{row.grow}</div>
                </div>
              ))}
            </motion.div>
          </div>
        </section>

        <section id="contato" className="pb-16 pt-2 md:pb-20">
          <div className="container">
            <div className="rounded-[34px] bg-primary p-6 text-primary-foreground dark:border dark:border-[#2a3760] dark:bg-[#0d1938] md:p-10">
              <div className="grid gap-8 lg:grid-cols-[1fr_0.95fr] lg:items-start">
                <motion.div {...sectionReveal}>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary-foreground/70">Próximo passo</p>
                  <h2 className="mt-3 max-w-xl font-heading text-3xl font-semibold leading-tight sm:text-4xl">
                    Se a operação cresceu, o layout da sua gestão também precisa evoluir
                  </h2>
                  <p className="mt-4 max-w-xl text-sm leading-7 text-primary-foreground/85">
                    A mesma lógica usada para reformular esta página foi aplicada à proposta da Grow: menos ruído, mais clareza e
                    um caminho de ação evidente para o cliente.
                  </p>

                  <div className="mt-8 space-y-3">
                    {[
                      "Diagnóstico inicial da estrutura contábil e financeira",
                      "Levantamento de prioridades com foco em ganho operacional",
                      "Plano de ação para rotina, conformidade e previsibilidade",
                    ].map((item) => (
                      <div key={item} className="flex items-start gap-3 rounded-2xl border border-white/15 bg-white/10 px-4 py-4">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                        <p className="text-sm text-primary-foreground">{item}</p>
                      </div>
                    ))}
                  </div>
                </motion.div>

                <motion.form
                  {...sectionReveal}
                  transition={{ duration: 0.45, delay: 0.08 }}
                  onSubmit={handleSubmit}
                  className="rounded-[28px] bg-white p-5 text-foreground shadow-sm dark:border dark:border-[#2b3861] dark:bg-[#08142f] dark:text-[#e9eeff] md:p-6"
                >
                  <div className="mb-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Solicitar contato</p>
                    <h3 className="mt-2 font-heading text-2xl font-semibold">Agende uma avaliação inicial</h3>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Mantive a funcionalidade de captura, mas com uma apresentação mais alinhada ao vídeo de referência.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <Input
                      placeholder="Nome completo"
                      required
                      value={leadForm.fullName}
                      onChange={(event) => setLeadForm((prev) => ({ ...prev, fullName: event.target.value }))}
                      className="h-12 rounded-full dark:border-[#2a3760] dark:bg-[#0a1735]"
                    />
                    <Input
                      placeholder="Empresa"
                      value={leadForm.companyName}
                      onChange={(event) => setLeadForm((prev) => ({ ...prev, companyName: event.target.value }))}
                      className="h-12 rounded-full dark:border-[#2a3760] dark:bg-[#0a1735]"
                    />
                    <Input
                      type="email"
                      placeholder="E-mail"
                      required
                      value={leadForm.email}
                      onChange={(event) => setLeadForm((prev) => ({ ...prev, email: event.target.value }))}
                      className="h-12 rounded-full dark:border-[#2a3760] dark:bg-[#0a1735]"
                    />
                  </div>

                  <p className="mt-4 text-xs leading-5 text-muted-foreground dark:text-[#9ca8cf]">
                    Seus dados serão usados apenas para retorno comercial e planejamento da avaliação inicial.
                  </p>

                  <Button type="submit" className="mt-5 h-12 w-full rounded-full" disabled={sending}>
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
