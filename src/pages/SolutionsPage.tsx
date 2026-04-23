import { SiteLayout } from "@/components/site/SiteLayout";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, BarChart3, Briefcase, Calculator, CheckCircle2, FileText, PieChart, Users } from "lucide-react";

const solutions = [
  {
    icon: FileText,
    title: "Contabilidade digital",
    description: "Escrituracao fiscal e contabil, declaracoes e demonstrativos com acompanhamento claro.",
    features: ["Escrituracao completa", "Declaracoes fiscais", "Balancos patrimoniais", "Portal em tempo real"],
  },
  {
    icon: BarChart3,
    title: "BPO financeiro",
    description: "Gestao financeira terceirizada com contas a pagar e receber, fluxo de caixa e conciliacao.",
    features: ["Contas a pagar/receber", "Fluxo de caixa", "Conciliacao bancaria", "Relatorios gerenciais"],
  },
  {
    icon: Users,
    title: "Departamento pessoal",
    description: "Folha, admissoes, demissoes, ferias e beneficios com processos digitais organizados.",
    features: ["Folha de pagamento", "Admissao digital", "Gestao de ferias", "Beneficios"],
  },
  {
    icon: Calculator,
    title: "Consultoria tributaria",
    description: "Planejamento personalizado para otimizar carga fiscal e manter conformidade.",
    features: ["Planejamento tributario", "Recuperacao de creditos", "Compliance fiscal", "Simulacoes"],
  },
  {
    icon: Briefcase,
    title: "Abertura de empresas",
    description: "Assessoria para constituicao empresarial, regime tributario e regularizacao.",
    features: ["Constituicao societaria", "Escolha do CNAE", "Regime tributario", "Licencas e alvaras"],
  },
  {
    icon: PieChart,
    title: "Consultoria financeira",
    description: "Analise de indicadores, planejamento financeiro estrategico e suporte decisorio.",
    features: ["Analise de indicadores", "Planejamento estrategico", "Budget e forecast", "KPIs financeiros"],
  },
];

const fadeIn = {
  initial: { opacity: 0, y: 18 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.15 },
  transition: { duration: 0.45 },
};

export default function SolutionsPage() {
  return (
    <SiteLayout>
      <div className="institutional-page text-foreground">
        <section className="container py-10 sm:py-14 md:py-16">
          <motion.div {...fadeIn} className="institutional-hero relative overflow-hidden p-5 sm:p-7 md:p-9">
            <div
              aria-hidden="true"
              className="brand-watermark -right-16 -top-28 hidden h-[32rem] w-[20rem] rounded-[4rem] border border-[#806589]/15 bg-[#4D4489]/20 lg:block"
            />
            <div className="relative z-10 max-w-3xl">
              <span className="institutional-kicker">Solucoes Grow</span>
              <h1 className="mt-4 font-heading text-3xl font-bold leading-tight sm:text-4xl md:text-5xl">
                Servicos conectados para uma gestao mais clara, segura e escalavel.
              </h1>
              <p className="mt-4 text-base leading-relaxed text-muted-foreground md:text-lg">
                Cada frente foi pensada para se integrar com as demais, formando uma experiencia contabil que reduz ruido e
                melhora a tomada de decisao.
              </p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <Button asChild className="rounded-full">
                  <Link to="/contato">
                    Conversar com especialista <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </Button>
                <Button asChild variant="outline" className="rounded-full">
                  <Link to="/#contato">Solicitar avaliacao</Link>
                </Button>
              </div>
            </div>
          </motion.div>
        </section>

        <section className="container pb-12 md:pb-16">
          <div className="hide-scrollbar mx-[-1rem] flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:snap-none md:grid-cols-2 md:gap-5 md:overflow-visible md:px-0 md:pb-0 lg:grid-cols-3">
            {solutions.map((solution, index) => (
              <motion.article
                key={solution.title}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.15 }}
                transition={{ duration: 0.35, delay: index * 0.05 }}
                className="institutional-card group flex min-w-[84%] snap-start flex-col p-5 sm:min-w-[72%] sm:p-6 md:min-w-0"
              >
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                    <solution.icon className="h-6 w-6" aria-hidden="true" />
                  </div>
                  <span className="rounded-full border border-border bg-background/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                </div>
                <h2 className="font-heading text-lg font-semibold sm:text-xl">{solution.title}</h2>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">{solution.description}</p>
                <ul className="mt-5 space-y-2">
                  {solution.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2 text-xs text-muted-foreground">
                      <CheckCircle2 className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Button variant="ghost" size="sm" className="mt-5 self-start px-0 text-primary" asChild>
                  <Link to="/contato">
                    Saiba mais <ArrowRight className="ml-1 h-3 w-3" aria-hidden="true" />
                  </Link>
                </Button>
              </motion.article>
            ))}
          </div>
        </section>
      </div>
    </SiteLayout>
  );
}
