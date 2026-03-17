import { SiteLayout } from "@/components/site/SiteLayout";
import { motion } from "framer-motion";
import { Target, Eye, Heart, Award } from "lucide-react";

const values = [
  { icon: Target, title: "Foco em Resultados", description: "Cada ação é orientada para gerar impacto real no crescimento dos nossos clientes." },
  { icon: Eye, title: "Transparência Total", description: "Comunicação clara, processos visíveis e dashboards em tempo real para você acompanhar tudo." },
  { icon: Heart, title: "Compromisso", description: "Tratamos cada cliente como parceiro. Seu sucesso é o nosso sucesso." },
  { icon: Award, title: "Excelência", description: "Equipe altamente qualificada e ferramentas de ponta para entregar o melhor serviço." },
];

const fadeIn = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.6 },
};

export default function AboutPage() {
  return (
    <SiteLayout>
      <section className="py-24 bg-background">
        <div className="container">
          <motion.div {...fadeIn} className="max-w-3xl">
            <span className="text-xs font-semibold tracking-widest uppercase text-primary">Sobre nós</span>
            <h1 className="font-heading text-4xl md:text-5xl font-bold mt-3 mb-6">
              Mais do que contabilidade.{" "}
              <span className="text-primary">Parceria estratégica.</span>
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed">
              A Grow Finance nasceu com o propósito de transformar a relação entre empresas e sua gestão contábil e financeira. 
              Unimos expertise técnica com tecnologia de ponta para oferecer uma experiência completamente digital, 
              transparente e orientada a resultados.
            </p>
          </motion.div>
        </div>
      </section>

      <section className="py-24 bg-muted/30">
        <div className="container">
          <motion.div {...fadeIn} className="text-center mb-16">
            <span className="text-xs font-semibold tracking-widest uppercase text-primary">Nossos valores</span>
            <h2 className="font-heading text-3xl md:text-4xl font-bold mt-3">O que nos move</h2>
          </motion.div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {values.map((v, i) => (
              <motion.div
                key={v.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="rounded-2xl border bg-card p-6"
              >
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                  <v.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-heading font-semibold text-lg mb-2">{v.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{v.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-24 bg-background">
        <div className="container max-w-3xl">
          <motion.div {...fadeIn} className="space-y-8">
            <div>
              <h2 className="font-heading text-2xl font-bold mb-3">Nossa Missão</h2>
              <p className="text-muted-foreground leading-relaxed">
                Democratizar o acesso a uma gestão contábil e financeira de alto nível, 
                usando tecnologia para simplificar processos e gerar insights que impulsionam o crescimento dos nossos clientes.
              </p>
            </div>
            <div>
              <h2 className="font-heading text-2xl font-bold mb-3">Nossa Visão</h2>
              <p className="text-muted-foreground leading-relaxed">
                Ser referência nacional em contabilidade digital e gestão financeira integrada, 
                reconhecida pela inovação, excelência e impacto positivo nos negócios dos nossos clientes.
              </p>
            </div>
          </motion.div>
        </div>
      </section>
    </SiteLayout>
  );
}
