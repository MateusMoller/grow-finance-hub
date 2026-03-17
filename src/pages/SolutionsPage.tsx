import { SiteLayout } from "@/components/site/SiteLayout";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, BarChart3, FileText, Users, Calculator, Briefcase, PieChart } from "lucide-react";

const solutions = [
  {
    icon: FileText,
    title: "Contabilidade Digital",
    description: "Escrituração fiscal e contábil automatizada, declarações, balanços e demonstrativos com acompanhamento em tempo real pelo portal.",
    features: ["Escrituração completa", "Declarações fiscais", "Balanços patrimoniais", "Portal em tempo real"],
  },
  {
    icon: BarChart3,
    title: "BPO Financeiro",
    description: "Terceirização completa da gestão financeira: contas a pagar e receber, fluxo de caixa, conciliações e relatórios gerenciais.",
    features: ["Contas a pagar/receber", "Fluxo de caixa", "Conciliação bancária", "Relatórios gerenciais"],
  },
  {
    icon: Users,
    title: "Departamento Pessoal",
    description: "Gestão de folha de pagamento, admissões, demissões, férias e benefícios com formulários digitais inteligentes.",
    features: ["Folha de pagamento", "Admissão digital", "Gestão de férias", "Benefícios"],
  },
  {
    icon: Calculator,
    title: "Consultoria Tributária",
    description: "Planejamento tributário personalizado para otimizar a carga fiscal e garantir conformidade.",
    features: ["Planejamento tributário", "Recuperação de créditos", "Compliance fiscal", "Simulações"],
  },
  {
    icon: Briefcase,
    title: "Abertura de Empresas",
    description: "Assessoria completa para constituição empresarial, escolha de regime tributário e regularização.",
    features: ["Constituição societária", "Escolha do CNAE", "Regime tributário", "Licenças e alvarás"],
  },
  {
    icon: PieChart,
    title: "Consultoria Financeira",
    description: "Análise de indicadores, planejamento financeiro estratégico e suporte na tomada de decisões.",
    features: ["Análise de indicadores", "Planejamento estratégico", "Budget e forecast", "KPIs financeiros"],
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
      <section className="py-24 bg-background">
        <div className="container">
          <motion.div {...fadeIn} className="max-w-3xl mb-16">
            <span className="text-xs font-semibold tracking-widest uppercase text-primary">Soluções</span>
            <h1 className="font-heading text-4xl md:text-5xl font-bold mt-3 mb-4">
              Soluções completas para a{" "}
              <span className="text-primary">gestão do seu negócio</span>
            </h1>
            <p className="text-lg text-muted-foreground">
              Cada serviço é desenhado para se integrar com os demais, formando um ecossistema digital completo.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {solutions.map((s, i) => (
              <motion.div
                key={s.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="group rounded-2xl border bg-card p-6 hover:shadow-lg hover:border-primary/20 transition-all duration-300 flex flex-col"
              >
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                  <s.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-heading font-semibold text-xl mb-2">{s.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed mb-4 flex-1">{s.description}</p>
                <ul className="space-y-1.5 mb-4">
                  {s.features.map((f) => (
                    <li key={f} className="text-xs text-muted-foreground flex items-center gap-2">
                      <div className="h-1 w-1 rounded-full bg-primary" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Button variant="ghost" size="sm" className="self-start text-primary" asChild>
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
