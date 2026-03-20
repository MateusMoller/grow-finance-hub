import { SiteLayout } from "@/components/site/SiteLayout";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  BarChart3,
  FileText,
  Users,
  Shield,
  ArrowRight,
  CheckCircle2,
  Building2,
  TrendingUp,
  Zap,
} from "lucide-react";

const features = [
  {
    icon: BarChart3,
    title: "BPO Financeiro",
    description: "Gestão financeira completa com dashboards inteligentes e controle total do fluxo de caixa.",
  },
  {
    icon: FileText,
    title: "Contabilidade Digital",
    description: "Contabilidade moderna, automatizada e integrada com as melhores ferramentas do mercado.",
  },
  {
    icon: Users,
    title: "Departamento Pessoal",
    description: "Admissão, férias, folha e benefícios com formulários digitais e automação completa.",
  },
  {
    icon: Shield,
    title: "Consultoria Tributária",
    description: "Planejamento tributário estratégico para reduzir custos e maximizar resultados.",
  },
];

const stats = [
  { value: "500+", label: "Clientes ativos" },
  { value: "98%", label: "Satisfação" },
  { value: "15+", label: "Anos de mercado" },
  { value: "R$2B+", label: "Gerenciados" },
];

const benefits = [
  "Portal do cliente 24/7",
  "Formulários digitais inteligentes",
  "Dashboards em tempo real",
  "Equipe especializada dedicada",
  "Integração com os melhores sistemas",
  "Suporte prioritário",
];

const fadeIn = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.6 },
};

export default function HomePage() {
  return (
    <SiteLayout>
      {/* Hero */}
      <section className="bg-hero relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,hsl(160_84%_22%/0.15),transparent_60%)]" />
        <div className="container relative py-24 md:py-36">
          <div className="max-w-3xl space-y-8">
            <motion.div {...fadeIn}>
              <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-xs font-medium text-primary">
                <Zap className="h-3 w-3" />
                Plataforma digital completa
              </span>
            </motion.div>

            <motion.h1
              {...fadeIn}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="font-heading text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight text-primary-foreground leading-[1.1]"
            >
              Gestão contábil e financeira{" "}
              <span className="text-grow-lavender" style={{ color: "hsl(240, 30%, 85%)" }}>
                inteligente
              </span>
            </motion.h1>

            <motion.p
              {...fadeIn}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-lg md:text-xl leading-relaxed max-w-2xl"
              style={{ color: "hsl(150, 10%, 70%)" }}
            >
              A Grow Finance combina tecnologia e expertise para transformar a gestão do seu negócio. 
              Contabilidade, finanças e departamento pessoal em uma única plataforma.
            </motion.p>

            <motion.div
              {...fadeIn}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="flex flex-wrap gap-4"
            >
              <Button variant="hero" size="xl" asChild>
                <Link to="/contato">
                  Comece Agora
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button
                variant="hero-outline"
                size="xl"
                asChild
                className="border-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/10"
              >
                <Link to="/solucoes">Conheça as Soluções</Link>
              </Button>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-b bg-card">
        <div className="container py-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="text-center"
              >
                <div className="font-heading text-3xl md:text-4xl font-bold text-primary">{stat.value}</div>
                <div className="text-sm text-muted-foreground mt-1">{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Solutions */}
      <section className="py-24 bg-background">
        <div className="container">
          <motion.div {...fadeIn} className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-xs font-semibold tracking-widest uppercase text-primary">Soluções</span>
            <h2 className="font-heading text-3xl md:text-4xl font-bold mt-3">
              Tudo que seu negócio precisa em um só lugar
            </h2>
            <p className="text-muted-foreground mt-4">
              Da contabilidade ao financeiro, do departamento pessoal à consultoria — soluções integradas para o crescimento.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, i) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="group relative rounded-2xl border bg-card p-6 hover:shadow-lg transition-all duration-300 hover:border-primary/20"
              >
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                  <feature.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-heading font-semibold text-lg mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-24 bg-muted/30">
        <div className="container">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <motion.div {...fadeIn}>
              <span className="text-xs font-semibold tracking-widest uppercase text-primary">Por que a Grow?</span>
              <h2 className="font-heading text-3xl md:text-4xl font-bold mt-3 mb-6">
                Tecnologia e expertise para seu crescimento
              </h2>
              <p className="text-muted-foreground mb-8 leading-relaxed">
                A Grow Finance não é apenas um escritório contábil. Somos uma plataforma digital completa 
                que une gestão, inteligência e automação para transformar a forma como você administra seu negócio.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {benefits.map((b) => (
                  <div key={b} className="flex items-center gap-2.5">
                    <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                    <span className="text-sm font-medium">{b}</span>
                  </div>
                ))}
              </div>
              <Button variant="hero" size="lg" className="mt-8" asChild>
                <Link to="/contato">
                  Agende uma Reunião
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              className="relative"
            >
              <div className="rounded-2xl bg-grow-dark p-8 shadow-2xl">
                <div className="flex items-center gap-3 mb-6">
                  <div className="h-3 w-3 rounded-full bg-destructive/60" />
                  <div className="h-3 w-3 rounded-full bg-grow-gold/60" />
                  <div className="h-3 w-3 rounded-full bg-primary/60" />
                </div>
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Building2 className="h-5 w-5 text-primary" />
                    <div className="flex-1 h-3 rounded-full bg-primary/20" />
                  </div>
                  <div className="flex items-center gap-3">
                    <TrendingUp className="h-5 w-5 text-grow-gold" />
                    <div className="flex-1 h-3 rounded-full bg-grow-gold/20" style={{ width: "75%" }} />
                  </div>
                  <div className="grid grid-cols-3 gap-3 mt-6">
                    {[
                      { label: "Receita", value: "+23%", color: "text-primary" },
                      { label: "Clientes", value: "+15", color: "text-grow-gold" },
                      { label: "Tarefas", value: "98%", color: "text-primary" },
                    ].map((m) => (
                      <div key={m.label} className="rounded-lg bg-grow-surface p-3 text-center">
                        <div className={`font-heading font-bold text-lg ${m.color}`}>{m.value}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{m.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="absolute -z-10 inset-0 bg-primary/20 rounded-2xl blur-3xl translate-y-4" />
            </motion.div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 bg-hero relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_50%,hsl(160_84%_22%/0.2),transparent_60%)]" />
        <div className="container relative text-center">
          <motion.div {...fadeIn} className="max-w-2xl mx-auto space-y-6">
            <h2 className="font-heading text-3xl md:text-5xl font-bold text-primary-foreground">
              Pronto para crescer?
            </h2>
            <p className="text-lg" style={{ color: "hsl(150, 10%, 70%)" }}>
              Fale com nossa equipe e descubra como a Grow Finance pode transformar a gestão do seu negócio.
            </p>
            <div className="flex flex-wrap justify-center gap-4 pt-4">
              <Button variant="hero" size="xl" asChild className="bg-primary-foreground text-grow-dark hover:bg-primary-foreground/90">
                <Link to="/contato">
                  Fale com um Especialista
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
            </div>
          </motion.div>
        </div>
      </section>
    </SiteLayout>
  );
}
