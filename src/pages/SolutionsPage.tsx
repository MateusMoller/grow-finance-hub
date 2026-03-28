import { SiteLayout } from "@/components/site/SiteLayout";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, BarChart3, FileText, Users, Calculator, Briefcase, PieChart } from "lucide-react";

const solutions = [
  {
    icon: FileText,
    title: "Contabilidade Digital",
    description: "Escrituracao fiscal e contabil automatizada, declaracoes e demonstrativos com acompanhamento em tempo real pelo portal.",
    features: ["Escrituracao completa", "Declaracoes fiscais", "Balancos patrimoniais", "Portal em tempo real"],
  },
  {
    icon: BarChart3,
    title: "BPO Financeiro",
    description: "Terceirizacao completa da gestao financeira: contas a pagar e receber, fluxo de caixa, conciliacoes e relatorios gerenciais.",
    features: ["Contas a pagar/receber", "Fluxo de caixa", "Conciliacao bancaria", "Relatorios gerenciais"],
  },
  {
    icon: Users,
    title: "Departamento Pessoal",
    description: "Gestao de folha de pagamento, admissoes, demissoes, ferias e beneficios com formularios digitais inteligentes.",
    features: ["Folha de pagamento", "Admissao digital", "Gestao de ferias", "Beneficios"],
  },
  {
    icon: Calculator,
    title: "Consultoria Tributaria",
    description: "Planejamento tributario personalizado para otimizar a carga fiscal e garantir conformidade.",
    features: ["Planejamento tributario", "Recuperacao de creditos", "Compliance fiscal", "Simulacoes"],
  },
  {
    icon: Briefcase,
    title: "Abertura de Empresas",
    description: "Assessoria completa para constituicao empresarial, escolha de regime tributario e regularizacao.",
    features: ["Constituicao societaria", "Escolha do CNAE", "Regime tributario", "Licencas e alvaras"],
  },
  {
    icon: PieChart,
    title: "Consultoria Financeira",
    description: "Analise de indicadores, planejamento financeiro estrategico e suporte na tomada de decisoes.",
    features: ["Analise de indicadores", "Planejamento estrategico", "Budget e forecast", "KPIs financeiros"],
  },
];

const fadeIn = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.6 },
};

export default function SolutionsPage() {
  return (
    <SiteLayout>
      <section className="bg-background py-12 sm:py-16 md:py-20">
        <div className="container">
          <motion.div {...fadeIn} className="mb-10 max-w-3xl sm:mb-14 md:mb-16">
            <span className="text-xs font-semibold uppercase tracking-widest text-primary">Solucoes</span>
            <h1 className="mt-3 mb-4 font-heading text-3xl font-bold sm:text-4xl md:text-5xl">
              Solucoes completas para a{" "}
              <span className="text-primary">gestao do seu negocio</span>
            </h1>
            <p className="text-base text-muted-foreground md:text-lg">
              Cada servico e desenhado para se integrar com os demais, formando um ecossistema digital completo.
            </p>
          </motion.div>

          <div className="hide-scrollbar mx-[-1rem] flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:gap-5 md:overflow-visible md:px-0 md:pb-0 md:snap-none md:grid-cols-2 lg:grid-cols-3 lg:gap-6">
            {solutions.map((solution, index) => (
              <motion.div
                key={solution.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.08 }}
                className="group min-w-[84%] snap-start flex flex-col rounded-2xl border bg-card p-5 transition-all duration-300 hover:border-primary/20 hover:shadow-lg sm:min-w-[72%] sm:p-6 md:min-w-0"
              >
                <div className="mb-4 h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center transition-colors group-hover:bg-primary/20">
                  <solution.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="mb-2 font-heading text-lg font-semibold sm:text-xl">{solution.title}</h3>
                <p className="mb-4 flex-1 text-sm leading-relaxed text-muted-foreground">{solution.description}</p>
                <ul className="mb-4 space-y-1.5">
                  {solution.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2 text-xs text-muted-foreground">
                      <div className="h-1 w-1 rounded-full bg-primary" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Button variant="ghost" size="sm" className="self-start px-0 text-primary" asChild>
                  <Link to="/contato">
                    Saiba mais <ArrowRight className="ml-1 h-3 w-3" />
                  </Link>
                </Button>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}
