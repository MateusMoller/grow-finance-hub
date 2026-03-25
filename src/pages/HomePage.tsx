import { SiteLayout } from "@/components/site/SiteLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, BarChart3, Briefcase, Building2, CheckCircle2, FileText, FolderOpen, Search, Shield, TrendingUp, Users, Zap } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const heroStats = [
  { value: "+12", label: "Anos de mercado", detail: "Experiencia solida" },
  { value: "98%", label: "Satisfacao dos clientes", detail: "Relacionamentos duradouros" },
  { value: "100%", label: "Conformidade", detail: "Seguranca e precisao" },
];

const services = [
  { icon: BarChart3, title: "Contabilidade Consultiva", description: "Acompanhamento contabil para decisoes estrategicas e crescimento sustentavel." },
  { icon: Shield, title: "Assessoria Fiscal", description: "Planejamento fiscal para reducao de riscos e otimizacao tributaria." },
  { icon: Users, title: "Departamento Pessoal", description: "Gestao de folha, rotinas trabalhistas e atendimento aos colaboradores." },
  { icon: Building2, title: "Abertura de Empresas", description: "Apoio completo desde a escolha do regime ate o registro legal." },
  { icon: CheckCircle2, title: "Regularizacoes", description: "Regularizamos pendencias fiscais e contabils com agilidade e precisao." },
  { icon: FileText, title: "Relatorios Gerenciais", description: "Dashboards e relatorios para analise de desempenho e tomada de decisao." },
  { icon: Briefcase, title: "Suporte Estrategico ao Empresario", description: "Mentoria e suporte para planejamento e execucao de estrategias de crescimento." },
];

const differentials = [
  { icon: Users, title: "Atendimento Proximo", description: "Relacionamento continuo e atendimento personalizado para cada cliente." },
  { icon: Search, title: "Visao Estrategica", description: "Transformamos dados contabils em insights para decisoes inteligentes." },
  { icon: Zap, title: "Agilidade", description: "Respostas rapidas e processos otimizados para reduzir tempo de espera." },
  { icon: Shield, title: "Precisao", description: "Conformidade rigorosa e atencao aos detalhes fiscais e contabils." },
  { icon: TrendingUp, title: "Inovacao", description: "Ferramentas tecnologicas que aumentam eficiencia e transparencia." },
  { icon: BarChart3, title: "Foco em Resultados", description: "Metas alinhadas com o crescimento sustentavel do cliente." },
];

const journey = [
  { icon: FolderOpen, title: "Organizacao", description: "Processos, documentos e prioridades." },
  { icon: Search, title: "Clareza Financeira", description: "Relatorios praticos e objetivos." },
  { icon: Shield, title: "Conformidade", description: "Obrigacoes em dia, sem preocupacoes." },
  { icon: TrendingUp, title: "Suporte a Decisao", description: "Insights estrategicos para crescer." },
  { icon: CheckCircle2, title: "Crescimento Seguro", description: "Evolucao sustentavel e controlada." },
];

const testimonials = [
  {
    name: "Lucas Moreira",
    role: "CEO, TechNova",
    text: "A Grow transformou nossa gestao financeira. Recebemos relatorios claros que facilitaram decisoes e aumentaram nossa margem.",
  },
  {
    name: "Mariana Ribeiro",
    role: "Fundadora, Casa Verde",
    text: "Atendimento humano e solucoes praticas. A Grow nos ajudou a regularizar pendencias e planejar a expansao.",
  },
  {
    name: "Rafael Alves",
    role: "Diretor Financeiro, BlueLine",
    text: "Relatorios gerenciais consistentes e suporte estrategico. Parceria essencial em momentos de crescimento.",
  },
];

const partners = ["Parceiro Alpha", "Parceiro Beta", "Parceiro Gama", "Parceiro Delta", "Parceiro Epsilon"];

const fadeIn = {
  initial: { opacity: 0, y: 18 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.15 },
  transition: { duration: 0.45 },
};

export default function HomePage() {
  const [sending, setSending] = useState(false);

  const handleLeadSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSending(true);

    window.setTimeout(() => {
      setSending(false);
      toast.success("Solicitacao enviada com sucesso. Nossa equipe entrara em contato em breve.");
    }, 900);
  };

  return (
    <SiteLayout>
      <div className="bg-[#f3f3f6] text-foreground transition-colors dark:bg-[#051334]">
        <section className="border-b border-border/60 pb-12 pt-12 dark:border-[#243054] md:pb-16 md:pt-16">
          <div className="container grid gap-10 lg:grid-cols-2 lg:items-start">
            <motion.div {...fadeIn} className="space-y-8">
              <div className="space-y-5">
                <h1 className="font-heading text-4xl font-bold leading-tight text-foreground md:text-5xl">
                  Mais do que contabilidade, impulsionamos o crescimento do seu negocio
                </h1>
                <p className="max-w-xl text-base leading-relaxed text-muted-foreground">
                  A Grow oferece contabilidade consultiva e assessoria estrategica para empresas que buscam organizacao,
                  seguranca fiscal e decisoes embasadas para crescer com confianca.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button asChild className="rounded-full px-6" size="lg">
                  <Link to="/#contato">Quero Crescer</Link>
                </Button>
                <Button asChild variant="outline" className="rounded-full px-6" size="lg">
                  <Link to="/contato">Falar com um Especialista</Link>
                </Button>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                {heroStats.map((item) => (
                  <div key={item.label} className="rounded-2xl border border-border/70 bg-card/80 p-4">
                    <div className="text-lg font-bold text-foreground">{item.value}</div>
                    <p className="text-xs font-medium text-foreground/90">{item.label}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{item.detail}</p>
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div
              {...fadeIn}
              transition={{ duration: 0.45, delay: 0.1 }}
              className="rounded-2xl border border-border bg-card p-5 shadow-sm dark:border-[#223058] dark:bg-[#0a1734] dark:shadow-[0_14px_40px_rgba(0,0,0,0.32)]"
            >
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h3 className="font-heading text-lg font-semibold">Dashboard de Resultados</h3>
                  <p className="text-xs text-muted-foreground">Relatorios gerenciais para decisoes estrategicas.</p>
                </div>
                <span className="text-xs text-muted-foreground">Atualizado hoje</span>
              </div>

              <div className="rounded-xl border border-border/70 bg-[#fafafa] p-4 dark:border-[#27345b] dark:bg-[#111f3d]">
                <div className="flex h-40 items-end gap-3">
                  {[35, 58, 72, 82, 60, 88].map((height, index) => (
                    <div key={index} className="flex-1 rounded-t-md bg-gradient-to-t from-orange-500 to-amber-300" style={{ height: `${height}%` }} />
                  ))}
                </div>
                <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                  <span>Consultoria continua + relatorios mensais</span>
                  <Button asChild size="sm" className="h-8 rounded-full px-4 text-xs">
                    <Link to="/solucoes">Ver Demonstracao</Link>
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        <section id="institucional" className="py-14 md:py-16">
          <div className="container grid gap-6 lg:grid-cols-2">
            <motion.article {...fadeIn} className="rounded-2xl border border-border bg-card p-6">
              <h2 className="font-heading text-2xl font-semibold">Quem somos</h2>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                A Grow Contabilidade combina expertise tecnica com atendimento proximo e estrategico. Atuamos como seu
                parceiro de negocios, oferecendo clareza, conformidade e visao para que sua empresa cresca com seguranca.
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Missao</p>
                  <p className="mt-1 text-sm">Transformar dados em decisoes que geram crescimento.</p>
                </div>
                <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Visao</p>
                  <p className="mt-1 text-sm">Ser referencia em contabilidade consultiva e estrategica.</p>
                </div>
                <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Valores</p>
                  <p className="mt-1 text-sm">Transparencia, proximidade e precisao.</p>
                </div>
              </div>
            </motion.article>

            <motion.article {...fadeIn} transition={{ duration: 0.45, delay: 0.1 }} className="rounded-2xl border border-border bg-card p-6">
              <h2 className="font-heading text-2xl font-semibold">Atendimento consultivo e humano</h2>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                Na Grow, cada cliente tem um time dedicado para apoiar decisoes com relatorios claros, prioridades fiscais
                e planos de acao personalizados para cada fase do negocio.
              </p>
              <div className="mt-5 space-y-3 text-sm">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary" />
                  <span>Atendimento proximo com foco no contexto do seu negocio.</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary" />
                  <span>Visao estrategica para decisões de curto, medio e longo prazo.</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary" />
                  <span>Processos eficientes para reduzir retrabalho e aumentar previsibilidade.</span>
                </div>
              </div>
            </motion.article>
          </div>
        </section>

        <section id="servicos" className="py-14 md:py-16">
          <div className="container">
            <motion.div {...fadeIn} className="mb-6">
              <h2 className="font-heading text-3xl font-semibold">Nossos servicos</h2>
            </motion.div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {services.map((service, index) => (
                <motion.article
                  key={service.title}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.15 }}
                  transition={{ duration: 0.35, delay: index * 0.04 }}
                  className="rounded-2xl border border-border bg-card p-5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="mb-3 inline-flex rounded-lg bg-primary/10 p-2 text-primary">
                        <service.icon className="h-4 w-4" />
                      </div>
                      <h3 className="font-heading text-base font-semibold">{service.title}</h3>
                    </div>
                    <Button asChild variant="outline" className="h-8 rounded-full px-3 text-xs">
                      <Link to="/solucoes">Saiba Mais</Link>
                    </Button>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{service.description}</p>
                </motion.article>
              ))}
            </div>
          </div>
        </section>

        <section id="diferenciais" className="py-14 md:py-16">
          <div className="container">
            <motion.div {...fadeIn} className="mb-6">
              <h2 className="font-heading text-3xl font-semibold">Nossos diferenciais</h2>
            </motion.div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {differentials.map((item, index) => (
                <motion.article
                  key={item.title}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.15 }}
                  transition={{ duration: 0.35, delay: index * 0.04 }}
                  className="rounded-2xl border border-border bg-card p-5"
                >
                  <item.icon className="h-4 w-4 text-primary" />
                  <h3 className="mt-3 font-heading text-base font-semibold">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.description}</p>
                </motion.article>
              ))}
            </div>
          </div>
        </section>

        <section className="py-14 md:py-16">
          <div className="container">
            <motion.div {...fadeIn} className="mb-6">
              <h2 className="font-heading text-3xl font-semibold">Como ajudamos seu negocio</h2>
            </motion.div>
            <div className="rounded-2xl border border-border bg-card px-4 py-6 md:px-8">
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-5">
                {journey.map((item, index) => (
                  <div key={item.title} className="relative text-center">
                    <div className="mx-auto mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <item.icon className="h-4 w-4" />
                    </div>
                    <p className="text-sm font-semibold">{item.title}</p>
                    <p className="mx-auto mt-1 max-w-[180px] text-xs text-muted-foreground">{item.description}</p>
                    {index < journey.length - 1 && (
                      <div className="absolute right-[-10px] top-6 hidden h-px w-5 bg-border lg:block" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="clientes" className="py-14 md:py-16">
          <div className="container space-y-6">
            <motion.div {...fadeIn}>
              <h2 className="font-heading text-3xl font-semibold">Depoimentos</h2>
            </motion.div>

            <div className="grid gap-4 md:grid-cols-3">
              {testimonials.map((testimonial, index) => (
                <motion.article
                  key={testimonial.name}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.15 }}
                  transition={{ duration: 0.35, delay: index * 0.05 }}
                  className="rounded-2xl border border-border bg-card p-5"
                >
                  <p className="text-sm leading-relaxed text-muted-foreground">"{testimonial.text}"</p>
                  <div className="mt-4">
                    <p className="text-sm font-semibold text-foreground">{testimonial.name}</p>
                    <p className="text-xs text-muted-foreground">{testimonial.role}</p>
                  </div>
                </motion.article>
              ))}
            </div>

            <div className="rounded-2xl border border-border bg-card p-4">
              <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {partners.map((partner) => (
                  <div key={partner} className="rounded-xl border border-border/70 bg-muted/20 px-4 py-3 text-center text-xs font-medium text-muted-foreground">
                    {partner}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="contato" className="py-14 md:py-16">
          <div className="container">
            <div className="rounded-2xl bg-primary p-6 text-primary-foreground dark:border dark:border-[#2a3760] dark:bg-[#0d1938] dark:text-[#e9eeff] md:p-10">
              <div className="grid gap-8 lg:grid-cols-[1fr_1.1fr] lg:items-center">
                <motion.div {...fadeIn}>
                  <h2 className="font-heading text-3xl font-semibold leading-tight">
                    Pronto para crescer com organizacao e estrategia?
                  </h2>
                  <p className="mt-3 max-w-xl text-sm text-primary-foreground/85 dark:text-[#bcc7ea]">
                    Agende uma avaliacao gratuita e descubra como a Grow pode estruturar sua contabilidade para apoiar
                    decisoes que impulsionam resultados.
                  </p>
                  <div className="mt-6 flex flex-wrap gap-3">
                    <Button
                      asChild
                      className="rounded-full bg-gradient-to-r from-[#6d4dff] to-[#3f85ff] px-5 text-sm font-semibold text-white shadow-[0_10px_26px_rgba(70,98,255,0.35)] hover:from-[#7a5cff] hover:to-[#4b8fff] dark:from-[#836dff] dark:to-[#5f93ff] dark:hover:from-[#907dff] dark:hover:to-[#6aa0ff]"
                    >
                      <Link to="/contato">Solicitar Avaliacao Gratuita</Link>
                    </Button>
                    <Button asChild variant="outline" className="rounded-full border-white/40 bg-transparent px-5 text-sm text-white hover:bg-white/10 hover:text-white dark:border-[#7d89b5] dark:text-[#d7dffa]">
                      <Link to="/contato">Falar com Consultor</Link>
                    </Button>
                  </div>
                </motion.div>

                <motion.form
                  {...fadeIn}
                  transition={{ duration: 0.45, delay: 0.1 }}
                  onSubmit={handleLeadSubmit}
                  className="rounded-2xl bg-white p-5 text-foreground dark:border dark:border-[#2b3861] dark:bg-[#08142f] dark:text-[#e9eeff]"
                >
                  <div className="space-y-3">
                    <Input placeholder="Nome completo" required className="rounded-full dark:border-[#2a3760] dark:bg-[#0a1735]" />
                    <Input placeholder="Empresa" className="rounded-full dark:border-[#2a3760] dark:bg-[#0a1735]" />
                    <Input type="email" placeholder="E-mail" required className="rounded-full dark:border-[#2a3760] dark:bg-[#0a1735]" />
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground dark:text-[#9ca8cf]">Garantimos confidencialidade e seguranca dos seus dados.</p>
                  <Button type="submit" className="mt-4 w-full rounded-full dark:bg-[#7a62ef] dark:text-white dark:hover:bg-[#8a73f4]" disabled={sending}>
                    {sending ? "Enviando..." : "Enviar Solicitacao"}
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
